"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DEVELOPMENT_POOL_POSITIVE_COUNT_POLICY,
  candidateSetSha256
} = require("../server/prediction/spatial-oof-cache");
const {
  DEFAULT_CALIBRATOR_FAMILIES,
  evaluateCandidateRows,
  probabilityFromAdminEvidence,
  baselineProbabilityFromAdminEvidence,
  scoreSpatialOofCandidates,
  spatialQualityFailures
} = require("../server/prediction/spatial-candidate-scorer");
const {
  FROZEN_NOVEL_GRID_ADMIN_EXPOSURE_CAPS_V1
} = require("../server/prediction/spatial-transfer");
const { prevalenceGroup } = require("../server/prediction/model");
const { parseArguments } = require("./score-zhejiang-spatial-oof-cache");

function makeRow({
  contextIndex,
  taxonId,
  positiveCount,
  developmentPositiveCount,
  kind,
  taxonIndex,
  foldIndex
}) {
  const total = 10;
  const provinceExposure = 100;
  const provinceDetections = kind === "ordinary" ? 3 + (taxonIndex % 15) : 10;
  const cityExposure = 1000;
  const districtExposure = 1000;
  const high = kind === "common-high";
  const low = kind === "common-low";
  const cityDetections = high || low ? 900 : 20 + (taxonIndex % 12) * 55;
  const districtDetections = high || low ? 900 : 10 + (taxonIndex % 10) * 65;
  const row = {
    contextIndex,
    taxonId,
    positiveCount,
    developmentPositiveCount,
    actualPositive: high ? 9 : low ? 1 : (taxonIndex + contextIndex + foldIndex) % 6,
    total,
    rawProbability: 0,
    baselineProbability: 0,
    deepestLevel: "district",
    hasSupportedLocalUnit: false,
    provinceExposure,
    provinceDetections,
    cityExposure,
    cityDetections,
    cityStrength: positiveCount >= 200 ? 24 : 30,
    districtExposure,
    districtDetections,
    districtStrength: positiveCount >= 200 ? 18 : 22
  };
  const baseCaps = FROZEN_NOVEL_GRID_ADMIN_EXPOSURE_CAPS_V1[prevalenceGroup(positiveCount)];
  row.rawProbability = probabilityFromAdminEvidence(row, baseCaps);
  row.baselineProbability = baselineProbabilityFromAdminEvidence(row);
  return row;
}

function makeCache() {
  const taxa = [
    { taxonId: "common-low", positiveCount: 500, developmentPositiveCount: 520, kind: "common-low" },
    { taxonId: "common-high", positiveCount: 600, developmentPositiveCount: 620, kind: "common-high" },
    { taxonId: "boundary-common", positiveCount: 190, developmentPositiveCount: 205, kind: "ordinary" },
    ...Array.from({ length: 19 }, (_, index) => ({
      taxonId: `ordinary-${String(index + 1).padStart(2, "0")}`,
      positiveCount: 100,
      developmentPositiveCount: 120,
      kind: "ordinary"
    }))
  ];
  return {
    fileSha256: "f".repeat(64),
    metadata: {
      panel: "development",
      diagnosticOnly: true,
      candidateSetSha256: candidateSetSha256(),
      developmentPoolPositiveCountPolicy: DEVELOPMENT_POOL_POSITIVE_COUNT_POLICY,
      baseAdminExposureCapsByPrevalence: FROZEN_NOVEL_GRID_ADMIN_EXPOSURE_CAPS_V1,
      sourceSnapshotSha256: "a".repeat(64),
      spatialSplitFileSha256: "b".repeat(64),
      spatialSplitManifestHash: "c".repeat(64),
      evidenceContractSha256: "d".repeat(64),
      generationImplementationSha256: "e".repeat(64),
      predictionImplementationSha256: "1".repeat(64)
    },
    folds: Array.from({ length: 5 }, (_, foldIndex) => {
      const foldId = String(foldIndex + 1);
      const scoreRows = Array.from({ length: 3 }, (_, contextIndex) =>
        taxa.map((taxon, taxonIndex) => makeRow({
          contextIndex,
          taxonId: taxon.taxonId,
          positiveCount: taxon.positiveCount,
          developmentPositiveCount: taxon.developmentPositiveCount,
          kind: taxon.kind,
          taxonIndex,
          foldIndex
        }))
      ).flat();
      return {
        foldId,
        referenceRawMetrics: evaluateCandidateRows(scoreRows.map((row) => ({
          foldId,
          row,
          probability: row.rawProbability
        }))),
        scoreRows
      };
    })
  };
}

function deterministicProjection(report) {
  const clone = structuredClone(report);
  delete clone.generatedAt;
  delete clone.scoring.workers;
  return clone;
}

test("逐鸟 25 组 cap 使用四折选择一折验证并能区分相反空间迁移", async () => {
  const cache = makeCache();
  const before = structuredClone(cache);
  const report = await scoreSpatialOofCandidates(cache, { workers: 2, generatedAt: "fixed" });
  assert.equal(report.diagnosticOnly, true);
  assert.equal(report.freezeEligible, false);
  assert.equal(report.sealedPanelViewed, false);
  assert.equal(report.scoring.candidateCount, 25);
  assert.equal(report.scoring.chunkRecords, 4096);
  assert.equal(report.scoring.fitFoldCount, 4);
  assert.equal(report.scoring.heldoutFoldCount, 5);
  const low = report.speciesCapTuning.species.find((row) => row.taxonId === "common-low");
  const high = report.speciesCapTuning.species.find((row) => row.taxonId === "common-high");
  const boundary = report.speciesCapTuning.species.find((row) => row.taxonId === "boundary-common");
  assert.ok(low);
  assert.ok(high);
  assert.ok(boundary);
  assert.equal(boundary.developmentPositiveCount, 205);
  assert.equal(boundary.crossFit.length, 0);
  assert.equal(report.speciesCapTuning.productionCandidateCount, 3);
  assert.notEqual(low.selectedCandidateId, high.selectedCandidateId);
  assert.equal(low.selectedCandidateId, "city=0,district=0");
  assert.equal(high.selectedCandidateId, "city=infinite,district=300");
  for (const species of [low, high]) {
    assert.equal(species.crossFit.length, 5);
    for (const fold of species.crossFit) {
      assert.equal(fold.trainingFoldIds.length, 4);
      assert.equal(fold.trainingFoldIds.includes(fold.heldoutFoldId), false);
    }
  }
  const familyIds = report.calibratorFamilies.map((row) => row.family.id);
  for (const family of DEFAULT_CALIBRATOR_FAMILIES) assert.ok(familyIds.includes(family.id));
  assert.equal(report.calibratorFamilies.every((family) => family.foldMetrics.length === 5), true);
  assert.deepEqual(cache, before);
});

test("workers=1/2/4 不改变候选、校准和完整指标结果", async () => {
  const cache = makeCache();
  const single = await scoreSpatialOofCandidates(cache, { workers: 1, generatedAt: "one" });
  const dual = await scoreSpatialOofCandidates(cache, { workers: 2, generatedAt: "two" });
  const quad = await scoreSpatialOofCandidates(cache, { workers: 4, generatedAt: "four" });
  assert.deepEqual(deterministicProjection(dual), deterministicProjection(single));
  assert.deepEqual(deterministicProjection(quad), deterministicProjection(single));
});

test("缓存 reference raw metrics 必须能由逐行充分统计完整重算", async () => {
  const cache = makeCache();
  cache.folds[0].referenceRawMetrics.brier += 0.001;
  await assert.rejects(
    () => scoreSpatialOofCandidates(cache, { workers: 1, generatedAt: "fixed" }),
    (error) => error.code === "SPATIAL_OOF_REFERENCE_METRICS_MISMATCH" &&
      error.details?.mismatches?.includes("brier")
  );
});

test("校准器族最终整体 Brier 与 ECE 也受 1%/0.01 保护门约束", async () => {
  const report = await scoreSpatialOofCandidates(makeCache(), { workers: 1, generatedAt: "fixed" });
  for (const family of report.calibratorFamilies) {
    const relativeBrierDegradation =
      (family.metrics.brier - family.rawMetrics.brier) / family.rawMetrics.brier;
    const eceDegradation = family.metrics.ece - family.rawMetrics.ece;
    assert.ok(relativeBrierDegradation <= 0.01 + 1e-12, family.family.id);
    assert.ok(eceDegradation <= 0.01 + 1e-12, family.family.id);
    if (!family.guard.overall.accepted) {
      assert.equal(family.guard.acceptedCount, 0);
      assert.equal(family.productionCalibrators.length, 0);
    }
  }
});

test("正式空间门仍拒绝 maximumSpeciesEce 超过 0.05", () => {
  const failures = spatialQualityFailures({
    brierSkill: 0.02,
    ece: 0.01,
    recallAt20Delta: 0,
    calibrationEce: {
      species: { scopeCount: 2, maximumEce: 0.0500000001 },
      group: { scopeCount: 2, maximumEce: 0.02 }
    }
  });
  assert.deepEqual(failures, ["spatial.species_calibration.maximumEce"]);
});

test("Recall@20 从逐 context 新概率重新排序而不是复用摘要", () => {
  const rows = Array.from({ length: 21 }, (_, index) => ({
    contextIndex: 0,
    taxonId: `taxon-${String(index).padStart(2, "0")}`,
    positiveCount: 300,
    actualPositive: index === 20 ? 1 : 0,
    total: 1,
    baselineProbability: 1 - index / 100,
    rawProbability: 1 - index / 100,
    deepestLevel: "district"
  }));
  const missed = evaluateCandidateRows(rows.map((row, index) => ({
    foldId: "1",
    row,
    probability: 1 - index / 100
  })));
  const recovered = evaluateCandidateRows(rows.map((row, index) => ({
    foldId: "1",
    row,
    probability: index === 20 ? 1 : 0.5 - index / 100
  })));
  assert.equal(missed.recallAt20, 0);
  assert.equal(recovered.recallAt20, 1);
});

test("CLI 不接受 sealed 或自由 cap 参数", () => {
  assert.throws(() => parseArguments(["--sealed-release", "x"]), /未知参数/);
  assert.throws(() => parseArguments(["--city-cap", "50"]), /未知参数/);
});
