"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");

const { buildAdminExposureCapCandidates } = require("../server/prediction/spatial-transfer");
const {
  CONTINUOUS_HABITAT_KERNEL_CONTRACT
} = require("../server/prediction/continuous-habitat");
const {
  ADMIN_CAP_TASK_WIDTH,
  scoreAdminCapChunk,
  scoreAdminCapTasks
} = require("../server/prediction/spatial-transfer-worker");
const {
  DEFAULT_OPTIONS,
  PredictionBuildError,
  collectDevelopmentPoolPositiveCounts,
  parseCliArguments,
  validateBuildSafetyOptions
} = require("./build-zhejiang-prediction-model");

function syntheticTaskValues(recordCount, groupIndex) {
  const values = [];
  for (let index = 0; index < recordCount; index += 1) {
    const total = 1 + (index % 3) * 0.25;
    const actual = index % (5 + groupIndex) === 0 ? Math.min(1, total) : 0;
    const provinceExposure = 20 + (index % 17);
    const provinceDetections = provinceExposure * (0.03 + (index % 7) * 0.01);
    const cityExposure = 50 + (index % 31) * 7;
    const cityDetections = cityExposure * (0.02 + (index % 11) * 0.015);
    const districtExposure = 10 + (index % 19) * 9;
    const districtDetections = districtExposure * (0.01 + (index % 9) * 0.02);
    values.push(
      actual,
      total,
      provinceExposure,
      provinceDetections,
      cityExposure,
      cityDetections,
      20 + groupIndex * 5,
      districtExposure,
      districtDetections,
      12 + groupIndex * 3,
      16 + (index % 13),
      (16 + (index % 13)) * (0.02 + (index % 5) * 0.03),
      CONTINUOUS_HABITAT_KERNEL_CONTRACT.evidencePriorStrength,
      CONTINUOUS_HABITAT_KERNEL_CONTRACT.evidenceExposureCap
    );
  }
  return values;
}

function syntheticTasks(recordCount = 137) {
  return new Map([
    ["group_30_79", syntheticTaskValues(recordCount, 0)],
    ["species_200_plus", syntheticTaskValues(recordCount, 1)]
  ]);
}

function safeCacheBuildOptions(overrides = {}) {
  return {
    ...DEFAULT_OPTIONS,
    testOnly: true,
    pointerPath: null,
    materializationProfile: "evaluation-only",
    spatialSplitManifestPath: "development-splits.json",
    spatialEvaluationPanel: "development",
    habitatFeaturesPath: "development-habitat.json",
    habitatModel: CONTINUOUS_HABITAT_KERNEL_CONTRACT.id,
    writeSpatialOofCachePath: "development-oof-cache.json",
    qualityGate: { ...DEFAULT_OPTIONS.qualityGate },
    holdoutEvaluation: { ...DEFAULT_OPTIONS.holdoutEvaluation },
    unitThresholds: { ...DEFAULT_OPTIONS.unitThresholds },
    ...overrides
  };
}

test("CLI 解析显式 development OOF 缓存输出", () => {
  const options = parseCliArguments([
    "--spatial-split-manifest", "development-splits.json",
    "--spatial-panel", "development",
    "--habitat-features", "development-habitat.json",
    "--habitat-model", CONTINUOUS_HABITAT_KERNEL_CONTRACT.id,
    "--write-spatial-oof-cache", "development-oof-cache.json",
    "--evaluation-only"
  ]);
  assert.equal(options.spatialSplitManifestPath, "development-splits.json");
  assert.equal(options.spatialEvaluationPanel, "development");
  assert.equal(options.habitatFeaturesPath, "development-habitat.json");
  assert.equal(options.habitatModel, CONTINUOUS_HABITAT_KERNEL_CONTRACT.id);
  assert.equal(options.writeSpatialOofCachePath, "development-oof-cache.json");
  assert.equal(options.testOnly, true);
  assert.equal(options.materializationProfile, "evaluation-only");
});

test("OOF 缓存安全门只接受固定分块的显式 development evaluation-only", () => {
  assert.doesNotThrow(() => validateBuildSafetyOptions(safeCacheBuildOptions()));
  for (const overrides of [
    { testOnly: false },
    { materializationProfile: "full" },
    { habitatFeaturesPath: null },
    { spatialSplitManifestPath: null },
    { spatialEvaluationPanel: "sealed-release" },
    { spatialParametersPath: "parameters.json" },
    { sealedEvaluationReceiptPath: "receipt.json" },
    { sealedSpatialPanelConfirmation: "confirmed" },
    {
      holdoutEvaluation: {
        ...DEFAULT_OPTIONS.holdoutEvaluation,
        minimumTaxonPositives: DEFAULT_OPTIONS.holdoutEvaluation.minimumTaxonPositives + 1
      }
    },
    {
      qualityGate: {
        ...DEFAULT_OPTIONS.qualityGate,
        maximumSpeciesEce: DEFAULT_OPTIONS.qualityGate.maximumSpeciesEce + 0.01
      }
    },
    { bandwidthCandidates: [14, 21, 28] },
    { priorStrengths: { ...DEFAULT_OPTIONS.priorStrengths, city: DEFAULT_OPTIONS.priorStrengths.city + 1 } },
    { qualityGate: { ...DEFAULT_OPTIONS.qualityGate, requirePrivateDiagnostic: false } }
  ]) {
    assert.throws(
      () => validateBuildSafetyOptions(safeCacheBuildOptions(overrides)),
      (error) =>
        error instanceof PredictionBuildError &&
        error.code === "SPATIAL_OOF_CACHE_BUILD_FORBIDDEN" &&
        Array.isArray(error.details?.failures) &&
        error.details.failures.length > 0
    );
  }
  assert.throws(
    () => validateBuildSafetyOptions(safeCacheBuildOptions({ workerTaskChunkRecords: 4097 })),
    (error) =>
      error instanceof PredictionBuildError &&
      error.code === "INVALID_OPTIONS" &&
      error.details?.failures?.includes("workerTaskChunkRecords.invalid")
  );
});

test("development-pool 正例名单显式排除全部 sealed buffer 标签", () => {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec(`
      CREATE TABLE training_reports (
        report_id TEXT PRIMARY KEY,
        observer_known INTEGER NOT NULL,
        group_key TEXT,
        grid_r6_unit TEXT
      );
      CREATE TABLE training_detections (
        report_id TEXT NOT NULL,
        taxon_id TEXT NOT NULL
      );
    `);
    const insertReport = database.prepare(
      "INSERT INTO training_reports(report_id, observer_known, group_key, grid_r6_unit) VALUES (?, ?, ?, ?)"
    );
    const insertDetection = database.prepare(
      "INSERT INTO training_detections(report_id, taxon_id) VALUES (?, ?)"
    );
    for (const row of [
      ["dev-1", 1, "group-1", "dev-r6"],
      ["dev-2", 1, "group-1", "dev-r6"],
      ["dev-3", 1, "group-2", "dev-r6"],
      ["dev-unknown", 0, "group-3", "dev-r6"],
      ["sealed-a", 1, "sealed-group-a", "sealed-r6"],
      ["sealed-b", 1, "sealed-group-b", "sealed-r6"],
      ["no-grid", 1, "group-4", null]
    ]) insertReport.run(...row);
    for (const [reportId, taxonId] of [
      ["dev-1", "taxon-a"],
      ["dev-2", "taxon-a"],
      ["dev-3", "taxon-a"],
      ["dev-unknown", "taxon-a"],
      ["sealed-a", "taxon-a"],
      ["sealed-b", "taxon-b"],
      ["no-grid", "taxon-a"]
    ]) insertDetection.run(reportId, taxonId);
    const counts = collectDevelopmentPoolPositiveCounts(database, ["sealed-r6"]);
    assert.deepEqual(Object.fromEntries(counts), { "taxon-a": 2 });
    assert.equal(
      Number(database.prepare("SELECT COUNT(*) AS count FROM evaluation_reserved_r6").get().count),
      0
    );
    assert.throws(
      () => collectDevelopmentPoolPositiveCounts(database, []),
      (error) =>
        error instanceof PredictionBuildError &&
        error.code === "SPATIAL_OOF_CACHE_SEALED_RESERVATION_MISSING"
    );
  } finally {
    database.close();
  }
});

test("worker 单块评分保持任务宽度并产生有限损失", () => {
  const candidates = buildAdminExposureCapCandidates();
  const values = Float64Array.from(syntheticTasks(3).get("group_30_79"));
  assert.equal(values.length, 3 * ADMIN_CAP_TASK_WIDTH);
  const result = scoreAdminCapChunk(values, candidates);
  assert.equal(result.modelLosses.length, 25);
  assert.equal(result.evaluatedWeight, 3.75);
  assert.ok(result.modelLosses.every(Number.isFinite));
  assert.ok(Number.isFinite(result.baselineLoss));
});

test("4096 边界两侧与多块尾部在 workers=1、2、4 下完全一致", async () => {
  const candidates = buildAdminExposureCapCandidates();
  const recordCounts = [4095, 4096, 4097, 8193];
  const tasksByPrevalence = new Map(
    ["rare_under_30", "group_30_79", "group_80_199", "species_200_plus"]
      .map((group, index) => [group, syntheticTaskValues(recordCounts[index], index)])
  );
  const options = { tasksByPrevalence, candidates, chunkRecords: 4096 };
  const single = await scoreAdminCapTasks({ ...options, workers: 1 });
  const dual = await scoreAdminCapTasks({ ...options, workers: 2 });
  const quad = await scoreAdminCapTasks({ ...options, workers: 4 });
  assert.deepEqual(dual.byPrevalence, single.byPrevalence);
  assert.deepEqual(quad.byPrevalence, single.byPrevalence);
  assert.equal(single.taskCount, recordCounts.reduce((sum, count) => sum + count, 0));
  assert.equal(single.chunkRecords, 4096);
  assert.equal(single.deterministicReductionPolicy, "fixed_record_chunks_merged_by_job_id");
  assert.equal(single.workerCount, 1);
  assert.equal(dual.workerCount, 2);
  assert.equal(quad.workerCount, 4);
});
