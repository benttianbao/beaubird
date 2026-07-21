"use strict";

const { createHash } = require("node:crypto");
const {
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} = require("node:fs");
const { dirname, join, relative, resolve, sep } = require("node:path");
const { backup, DatabaseSync } = require("node:sqlite");

const {
  ZHEJIANG_BOUNDS,
  administrativeUnitId,
  areAdjacentGridCells,
  bd09ToWgs84,
  gridCell,
  haversineDistanceMeters,
  isoDateParts,
  isWithinZhejiang,
  neighboringGridCellIds,
  seasonWeek,
  stableHash,
  weekCenterDay
} = require("../server/prediction/geo");
const { betaInterval, betaQuantile, calibrateProbability, fitBetaCalibration } = require("../server/prediction/math");
const {
  DEFAULT_PRIOR_STRENGTHS,
  PREVALENCE_GROUPS,
  PredictionModel,
  SCHEMA_VERSION,
  prevalenceGroup,
  resolvePriorStrength
} = require("../server/prediction/model");
const { analyzeTaxonDetections } = require("../server/prediction/vagrant-events");
const {
  adminCapForTaxon,
  buildAdminExposureCapCandidates,
  capEffectiveEvidence,
  FROZEN_NOVEL_GRID_ADMIN_EXPOSURE_CAPS_V1,
  verifySpatialSplitManifest
} = require("../server/prediction/spatial-transfer");
const { scoreAdminCapTasks } = require("../server/prediction/spatial-transfer-worker");
const { loadSpatialParameterArtifact } = require("../server/prediction/spatial-parameters");
const { loadSealedEvaluationReceipt } = require("../server/prediction/sealed-evaluation-receipt");
const {
  spatialOofCacheGenerationImplementationSha256,
  writeSpatialOofCache
} = require("../server/prediction/spatial-oof-cache");

const PROBABILITY_DEFINITION =
  "P(某鸟在相似日期和地点的一份典型完整 BirdReport 清单中被记录到)，不是生态学绝对存在概率。";

const PRODUCTION_QUALITY_GATE = Object.freeze({
  minimumTimeFolds: 3,
  minimumCalibrationFolds: 2,
  minimumSpatialFolds: 3,
  minimumObserverFolds: 3,
  requireFinalHoldout: true,
  requireSpatialHoldout: true,
  requireObserverHoldout: true,
  minimumBrierSkill: 0,
  maximumEce: 0.1,
  maximumSpeciesEce: 0.05,
  maximumGroupEce: 0.1,
  minimumRecallAt20Delta: -0.02,
  minimumReverseNdcgLift: 0.05
});

const TRAINING_DATA_CONTRACT = "beaubird-unified-quality-filter-v2";
const RELEASE_EVALUATION_OCCURRENCE_POLICY =
  "raw_detections_all_taxa_without_full_data_event_filter";
const TEMPORAL_EVALUATION_WEIGHTING_POLICY =
  "fold_cutoff_half_life_training_and_group_capped_unweighted_validation";
const COORDINATE_QC_EVALUATION_SCOPE =
  "fixed_snapshot_coordinate_qc_target_independent_not_refit_per_fold";
const NESTED_CALIBRATION_GUARD = Object.freeze({
  maximumRelativeBrierDegradation: 0.01,
  maximumEceDegradation: 0.01
});
const PREDICTION_IMPLEMENTATION_FILES = Object.freeze([
  "tools/build-zhejiang-prediction-model.js",
  "server/prediction/geo.js",
  "server/prediction/math.js",
  "server/prediction/model.js",
  "server/prediction/sealed-evaluation-receipt.js",
  "server/prediction/spatial-parameters.js",
  "server/prediction/spatial-oof-cache.js",
  "server/prediction/spatial-candidate-scorer.js",
  "server/prediction/spatial-splits.js",
  "server/prediction/spatial-transfer.js",
  "server/prediction/spatial-transfer-worker.js",
  "server/prediction/vagrant-events.js",
  "tools/score-zhejiang-spatial-oof-cache.js"
]);

const DEFAULT_OPTIONS = Object.freeze({
  minimumNormalReports: 1_000,
  minimumCompleteCoverage: 0.995,
  minimumRefreshCoverage: 0.995,
  minimumCoordinateCoverage: 0.95,
  minimumDateCoverage: 0.995,
  pointDriftMeters: 2_000,
  recencyHalfLifeYears: 3,
  localHistoryYears: 5,
  stabilityWindowMs: 750,
  requireCompletedCrawl: false,
  allowSourceChangesDuringSnapshot: true,
  includeFlaggedCleanReports: true,
  vagrantEventGapDays: 3,
  vagrantDominantEventShare: 0.8,
  vagrantEventWeightCap: 1,
  priorTuningContextSampleModulo: 10,
  outerPriorTuningContextSampleModulo: 20,
  outerCalibrationContextSampleModulo: 10,
  workers: 1,
  workerTaskChunkRecords: 4096,
  forwardTopK: 100,
  reverseTopK: 300,
  materializationProfile: "full",
  novelGridAdminExposureCapsByPrevalence: FROZEN_NOVEL_GRID_ADMIN_EXPOSURE_CAPS_V1,
  bandwidthCandidates: [7, 14, 21, 28],
  priorStrengthMultipliers: [0.5, 1, 2],
  qualityGate: PRODUCTION_QUALITY_GATE,
  holdoutEvaluation: {
    spatialMaximumFolds: 3,
    spatialMinimumChecklists: 30,
    spatialMinimumObservers: 10,
    observerFoldCount: 3,
    minimumTaxonPositives: 30,
    priorTuningMaximumFolds: 2
  },
  unitThresholds: {
    province: { checklists: 1, observers: 1 },
    city: { checklists: 10, observers: 3 },
    district: { checklists: 10, observers: 3 },
    grid_r6: { checklists: 20, observers: 5 },
    grid_r7: { checklists: 30, observers: 10 },
    point: { checklists: 50, observers: 15 }
  },
  priorStrengths: DEFAULT_PRIOR_STRENGTHS
});

const REQUIRED_REPORT_COLUMNS = [
  "report_id",
  "report_kind",
  "start_time",
  "province_name",
  "city_name",
  "district_name",
  "point_name",
  "point_id",
  "longitude",
  "latitude",
  "location_metadata_fetched",
  "taxon_count_reported",
  "raw_report_json"
];

const REQUIRED_OBSERVATION_COLUMNS = [
  "report_id",
  "taxon_key",
  "taxon_id",
  "taxon_name",
  "latinname",
  "englishname",
  "is_red_species",
  "source_outside_type",
  "raw_index"
];

class PredictionBuildError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "PredictionBuildError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function mergeOptions(options = {}) {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
    unitThresholds: { ...DEFAULT_OPTIONS.unitThresholds, ...(options.unitThresholds || {}) },
    priorStrengths: { ...DEFAULT_OPTIONS.priorStrengths, ...(options.priorStrengths || {}) },
    priorStrengthsByPrevalence: options.priorStrengthsByPrevalence || null,
    qualityGate: { ...DEFAULT_OPTIONS.qualityGate, ...(options.qualityGate || {}) },
    holdoutEvaluation: { ...DEFAULT_OPTIONS.holdoutEvaluation, ...(options.holdoutEvaluation || {}) }
  };
}

function validateBuildSafetyOptions(options) {
  if (typeof options.testOnly !== "boolean" && options.testOnly !== undefined) {
    throw new PredictionBuildError("INVALID_OPTIONS", "testOnly 必须是布尔值。");
  }
  if (options.testOnly) {
    if (process.env.NODE_ENV === "production") {
      throw new PredictionBuildError("TEST_ONLY_FORBIDDEN", "生产环境禁止构建 testOnly 模型。");
    }
    if (options.pointerPath) {
      throw new PredictionBuildError("TEST_ONLY_PUBLICATION_FORBIDDEN", "testOnly 模型不得写入发布指针。");
    }
  }

  const failures = [];
  const finite = (path, value) => {
    if (!Number.isFinite(Number(value))) failures.push(`${path}.non_finite`);
  };
  for (const key of [
    "minimumNormalReports",
    "minimumCompleteCoverage",
    "minimumRefreshCoverage",
    "minimumCoordinateCoverage",
    "minimumDateCoverage",
    "forwardTopK",
    "reverseTopK",
    "vagrantEventGapDays",
    "vagrantDominantEventShare",
    "vagrantEventWeightCap",
    "priorTuningContextSampleModulo",
    "outerCalibrationContextSampleModulo",
    "workers",
    "workerTaskChunkRecords"
  ]) finite(key, options[key]);
  if (
    !Number.isInteger(Number(options.outerCalibrationContextSampleModulo)) ||
    Number(options.outerCalibrationContextSampleModulo) < 1
  ) failures.push("outerCalibrationContextSampleModulo.invalid");
  if (!Number.isInteger(Number(options.workers)) || Number(options.workers) < 1 || Number(options.workers) > 32) {
    failures.push("workers.invalid");
  }
  if (
    !Number.isInteger(Number(options.workerTaskChunkRecords)) ||
    Number(options.workerTaskChunkRecords) !== DEFAULT_OPTIONS.workerTaskChunkRecords
  ) failures.push("workerTaskChunkRecords.invalid");
  for (const [key, value] of Object.entries(options.qualityGate || {})) {
    if (!key.startsWith("require")) finite(`qualityGate.${key}`, value);
  }
  for (const [key, value] of Object.entries(options.holdoutEvaluation || {})) {
    finite(`holdoutEvaluation.${key}`, value);
  }
  for (const [level, threshold] of Object.entries(options.unitThresholds || {})) {
    finite(`unitThresholds.${level}.checklists`, threshold?.checklists);
    finite(`unitThresholds.${level}.observers`, threshold?.observers);
  }
  if (!Array.isArray(options.priorStrengthMultipliers) || !options.priorStrengthMultipliers.length) {
    failures.push("priorStrengthMultipliers.empty");
  } else {
    for (const value of options.priorStrengthMultipliers) {
      if (!Number.isFinite(Number(value)) || Number(value) <= 0) failures.push("priorStrengthMultipliers.invalid");
    }
  }
  if (failures.length) {
    throw new PredictionBuildError("INVALID_OPTIONS", "构建门槛包含非有限数值。", { failures });
  }
  if (options.writeSpatialOofCachePath !== undefined) {
    const cacheFailures = [];
    const exactJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);
    if (
      typeof options.writeSpatialOofCachePath !== "string" ||
      !options.writeSpatialOofCachePath.trim()
    ) cacheFailures.push("writeSpatialOofCachePath.invalid");
    if (options.testOnly !== true) cacheFailures.push("testOnly.required");
    if (options.materializationProfile !== "evaluation-only") {
      cacheFailures.push("materializationProfile.evaluation_only_required");
    }
    if (!options.spatialSplitManifestPath) cacheFailures.push("spatialSplitManifestPath.required");
    if (options.spatialEvaluationPanel !== "development") {
      cacheFailures.push("spatialEvaluationPanel.explicit_development_required");
    }
    if (options.spatialParametersPath) cacheFailures.push("spatialParametersPath.forbidden");
    if (options.sealedEvaluationReceiptPath) cacheFailures.push("sealedEvaluationReceiptPath.forbidden");
    if (options.sealedSpatialPanelConfirmation) cacheFailures.push("sealedSpatialPanelConfirmation.forbidden");
    if (options.qualityGate?.requireSpatialHoldout !== true) {
      cacheFailures.push("qualityGate.requireSpatialHoldout.required");
    }
    for (const key of [
      "minimumNormalReports",
      "minimumCompleteCoverage",
      "minimumRefreshCoverage",
      "minimumCoordinateCoverage",
      "minimumDateCoverage",
      "pointDriftMeters",
      "recencyHalfLifeYears",
      "localHistoryYears",
      "includeFlaggedCleanReports",
      "vagrantEventGapDays",
      "vagrantDominantEventShare",
      "vagrantEventWeightCap",
      "priorTuningContextSampleModulo",
      "outerPriorTuningContextSampleModulo",
      "outerCalibrationContextSampleModulo"
    ]) {
      if (options[key] !== DEFAULT_OPTIONS[key]) cacheFailures.push(`${key}.must_match_frozen_default`);
    }
    if (!exactJson(options.qualityGate, DEFAULT_OPTIONS.qualityGate)) {
      cacheFailures.push("qualityGate.must_match_frozen_default");
    }
    if (!exactJson(options.holdoutEvaluation, DEFAULT_OPTIONS.holdoutEvaluation)) {
      cacheFailures.push("holdoutEvaluation.must_match_frozen_default");
    }
    if (!exactJson(options.unitThresholds, DEFAULT_OPTIONS.unitThresholds)) {
      cacheFailures.push("unitThresholds.must_match_frozen_default");
    }
    if (!exactJson(options.bandwidthCandidates, DEFAULT_OPTIONS.bandwidthCandidates)) {
      cacheFailures.push("bandwidthCandidates.must_match_frozen_default");
    }
    if (!exactJson(options.priorStrengthMultipliers, DEFAULT_OPTIONS.priorStrengthMultipliers)) {
      cacheFailures.push("priorStrengthMultipliers.must_match_frozen_default");
    }
    if (!exactJson(options.priorStrengths, DEFAULT_OPTIONS.priorStrengths)) {
      cacheFailures.push("priorStrengths.must_match_frozen_default");
    }
    if (
      !exactJson(
        options.novelGridAdminExposureCapsByPrevalence,
        DEFAULT_OPTIONS.novelGridAdminExposureCapsByPrevalence
      )
    ) cacheFailures.push("novelGridAdminExposureCapsByPrevalence.must_match_frozen_default");
    if (cacheFailures.length) {
      throw new PredictionBuildError(
        "SPATIAL_OOF_CACHE_BUILD_FORBIDDEN",
        "空间 OOF 缓存只能由显式 development 五折的 testOnly evaluation-only 构建生成。",
        { failures: cacheFailures }
      );
    }
  }
  if (options.testOnly) return;

  const atLeast = (path, actual, required) => {
    if (Number(actual) < Number(required)) failures.push(path);
  };
  const atMost = (path, actual, required) => {
    if (Number(actual) > Number(required)) failures.push(path);
  };
  atLeast("minimumNormalReports", options.minimumNormalReports, DEFAULT_OPTIONS.minimumNormalReports);
  atLeast("minimumCompleteCoverage", options.minimumCompleteCoverage, DEFAULT_OPTIONS.minimumCompleteCoverage);
  atLeast("minimumRefreshCoverage", options.minimumRefreshCoverage, DEFAULT_OPTIONS.minimumRefreshCoverage);
  atLeast("minimumCoordinateCoverage", options.minimumCoordinateCoverage, DEFAULT_OPTIONS.minimumCoordinateCoverage);
  atLeast("minimumDateCoverage", options.minimumDateCoverage, DEFAULT_OPTIONS.minimumDateCoverage);
  atLeast("forwardTopK", options.forwardTopK, DEFAULT_OPTIONS.forwardTopK);
  atLeast("reverseTopK", options.reverseTopK, DEFAULT_OPTIONS.reverseTopK);
  if (options.materializationProfile !== "full") failures.push("materializationProfile");
  if (options.includeFlaggedCleanReports !== true) failures.push("includeFlaggedCleanReports");
  if (Number(options.vagrantEventGapDays) !== DEFAULT_OPTIONS.vagrantEventGapDays) failures.push("vagrantEventGapDays");
  if (Number(options.vagrantDominantEventShare) !== DEFAULT_OPTIONS.vagrantDominantEventShare) failures.push("vagrantDominantEventShare");
  if (Number(options.vagrantEventWeightCap) !== DEFAULT_OPTIONS.vagrantEventWeightCap) failures.push("vagrantEventWeightCap");
  if (
    !Number.isInteger(Number(options.priorTuningContextSampleModulo)) ||
    Number(options.priorTuningContextSampleModulo) < 1 ||
    Number(options.priorTuningContextSampleModulo) > DEFAULT_OPTIONS.priorTuningContextSampleModulo
  ) failures.push("priorTuningContextSampleModulo");
  if (Number(options.outerCalibrationContextSampleModulo) > DEFAULT_OPTIONS.outerCalibrationContextSampleModulo) {
    failures.push("outerCalibrationContextSampleModulo");
  }

  for (const key of ["minimumTimeFolds", "minimumCalibrationFolds", "minimumSpatialFolds", "minimumObserverFolds", "minimumBrierSkill", "minimumRecallAt20Delta", "minimumReverseNdcgLift"]) {
    atLeast(`qualityGate.${key}`, options.qualityGate[key], PRODUCTION_QUALITY_GATE[key]);
  }
  atMost("qualityGate.maximumEce", options.qualityGate.maximumEce, PRODUCTION_QUALITY_GATE.maximumEce);
  atMost("qualityGate.maximumSpeciesEce", options.qualityGate.maximumSpeciesEce, PRODUCTION_QUALITY_GATE.maximumSpeciesEce);
  atMost("qualityGate.maximumGroupEce", options.qualityGate.maximumGroupEce, PRODUCTION_QUALITY_GATE.maximumGroupEce);
  if (options.qualityGate.requireFinalHoldout !== true) failures.push("qualityGate.requireFinalHoldout");
  if (options.qualityGate.requireSpatialHoldout !== true) failures.push("qualityGate.requireSpatialHoldout");
  if (options.qualityGate.requireObserverHoldout !== true) failures.push("qualityGate.requireObserverHoldout");

  for (const key of ["spatialMaximumFolds", "spatialMinimumChecklists", "spatialMinimumObservers", "observerFoldCount", "minimumTaxonPositives", "priorTuningMaximumFolds"]) {
    atLeast(`holdoutEvaluation.${key}`, options.holdoutEvaluation[key], DEFAULT_OPTIONS.holdoutEvaluation[key]);
  }
  for (const [level, required] of Object.entries(DEFAULT_OPTIONS.unitThresholds)) {
    atLeast(`unitThresholds.${level}.checklists`, options.unitThresholds[level]?.checklists, required.checklists);
    atLeast(`unitThresholds.${level}.observers`, options.unitThresholds[level]?.observers, required.observers);
  }
  if (failures.length) {
    throw new PredictionBuildError(
      "UNSAFE_RELEASE_THRESHOLDS",
      "非 testOnly 构建不得放宽生产数据、匿名或质量门槛。",
      { failures }
    );
  }
}

function emitProgress(options, phase, details = {}) {
  if (typeof options.onProgress === "function") options.onProgress({ phase, ...details });
}

function safeUnlink(path) {
  if (!path || !existsSync(path)) return;
  unlinkSync(path);
}

function sha256File(path) {
  const hash = createHash("sha256");
  const descriptor = openSync(path, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    while (true) {
      const bytesRead = readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    closeSync(descriptor);
  }
  return hash.digest("hex");
}

function predictionImplementationSha256(projectRoot = resolve(__dirname, "..")) {
  const hash = createHash("sha256");
  for (const relativePath of PREDICTION_IMPLEMENTATION_FILES) {
    const normalized = relativePath.replaceAll("\\", "/");
    hash.update(`${normalized}\0`, "utf8");
    hash.update(readFileSync(resolve(projectRoot, relativePath)));
    hash.update("\0", "utf8");
  }
  return hash.digest("hex");
}

function capturePointerState(path) {
  let contents;
  try {
    contents = readFileSync(path);
  } catch (error) {
    if (error?.code === "ENOENT") return { exists: false, sha256: null, contents: null };
    throw error;
  }
  return {
    exists: true,
    sha256: createHash("sha256").update(contents).digest("hex"),
    contents
  };
}

function pointerStateMatches(expected, actual) {
  return expected.exists === actual.exists && expected.sha256 === actual.sha256;
}

function tableColumns(database, table) {
  return new Set(database.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name));
}

function assertSourceSchema(database) {
  const tables = new Set(
    database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name)
  );
  for (const table of ["crawl_meta", "reports", "observations"]) {
    if (!tables.has(table)) {
      throw new PredictionBuildError("SOURCE_SCHEMA_INVALID", `源库缺少 ${table} 表。`);
    }
  }
  const reportColumns = tableColumns(database, "reports");
  const observationColumns = tableColumns(database, "observations");
  const missingReports = REQUIRED_REPORT_COLUMNS.filter((name) => !reportColumns.has(name));
  const missingObservations = REQUIRED_OBSERVATION_COLUMNS.filter((name) => !observationColumns.has(name));
  if (missingReports.length || missingObservations.length) {
    throw new PredictionBuildError("SOURCE_SCHEMA_INVALID", "源库仍是旧版结构，缺少建模必需列。", {
      missingReportColumns: missingReports,
      missingObservationColumns: missingObservations
    });
  }
}

function assertTrainingSourceContract(database) {
  const tables = new Set(
    database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name)
  );
  let sourceGeneration = null;
  if (tables.has("public_output_safety")) {
    const marker = database
      .prepare("SELECT generation FROM public_output_safety LIMIT 1")
      .get();
    sourceGeneration = marker?.generation || null;
  }
  const summary = database.prepare(`
    SELECT
      COUNT(*) AS observation_count,
      SUM(CASE WHEN COALESCE(is_red_species, 0) = 1 THEN 1 ELSE 0 END) AS stored_red_count,
      SUM(CASE WHEN COALESCE(source_outside_type, 0) = 1 THEN 1 ELSE 0 END) AS stored_outside_count,
      COUNT(DISTINCT CASE
        WHEN COALESCE(is_red_species, 0) = 1 OR COALESCE(source_outside_type, 0) = 1
        THEN report_id END) AS affected_report_count
    FROM observations
  `).get();
  return {
    trainingDataContract: TRAINING_DATA_CONTRACT,
    sourceGeneration,
    observationCount: Number(summary?.observation_count || 0),
    storedRedCount: Number(summary?.stored_red_count || 0),
    storedOutsideCount: Number(summary?.stored_outside_count || 0),
    affectedReportCount: Number(summary?.affected_report_count || 0),
    policy: "保留普通完整报告与标红报告中的未标红鸟种；逐条剔除 is_red_species=1 或 source_outside_type=1。"
  };
}

function crawlState(database) {
  const runningTotal = database.prepare("SELECT COUNT(*) AS count FROM crawl_meta WHERE status = 'running'").get().count;
  const latest = database.prepare("SELECT * FROM crawl_meta ORDER BY started_at DESC LIMIT 1").get() || null;
  const completed = database
    .prepare(
      `SELECT * FROM crawl_meta
       WHERE status = 'completed' AND completed_at IS NOT NULL
       ORDER BY completed_at DESC LIMIT 1`
    )
    .get();
  return {
    running: latest?.status === "running" ? 1 : 0,
    runningTotal: Number(runningTotal) || 0,
    staleRunning: Math.max(0, (Number(runningTotal) || 0) - (latest?.status === "running" ? 1 : 0)),
    latest,
    completed: completed || null
  };
}

function wait(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, Math.max(0, milliseconds)));
}

function fileFingerprint(path) {
  const stats = statSync(path);
  return `${stats.size}:${stats.mtimeMs}`;
}

async function createTrainingSnapshot(options = {}) {
  const resolvedOptions = mergeOptions(options);
  const sourcePath = resolve(resolvedOptions.sourcePath);
  const snapshotPath = resolve(resolvedOptions.snapshotPath);
  if (sourcePath === snapshotPath) {
    throw new PredictionBuildError("SNAPSHOT_PATH_INVALID", "训练快照路径不能与源库相同。" );
  }
  if (existsSync(snapshotPath)) {
    throw new PredictionBuildError("SNAPSHOT_EXISTS", `快照已存在：${snapshotPath}`);
  }
  mkdirSync(dirname(snapshotPath), { recursive: true });
  const temporaryPath = `${snapshotPath}.building-${process.pid}`;
  safeUnlink(temporaryPath);
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  let snapshotMetadata = null;
  try {
    source.exec("PRAGMA query_only = ON");
    assertSourceSchema(source);
    const sourceContract = assertTrainingSourceContract(source);
    const state = crawlState(source);
    if (resolvedOptions.requireCompletedCrawl && !state.completed) {
      throw new PredictionBuildError("CRAWL_NOT_COMPLETED", "没有可验证的 completed 全量抓取记录。" );
    }
    const beforeVersion = source.prepare("PRAGMA data_version").get().data_version;
    const beforeFile = fileFingerprint(sourcePath);
    if (resolvedOptions.stabilityWindowMs > 0) await wait(resolvedOptions.stabilityWindowMs);
    const afterVersion = source.prepare("PRAGMA data_version").get().data_version;
    const afterFile = fileFingerprint(sourcePath);
    if (
      !resolvedOptions.allowSourceChangesDuringSnapshot &&
      (beforeVersion !== afterVersion || beforeFile !== afterFile)
    ) {
      throw new PredictionBuildError("SOURCE_CHANGED", "稳定性检查期间源库发生变化，拒绝创建快照。" );
    }
    emitProgress(resolvedOptions, "snapshot_backup_started", { sourcePath, snapshotPath });
    await backup(source, temporaryPath);
    const finalState = crawlState(source);
    const finalVersion = source.prepare("PRAGMA data_version").get().data_version;
    const finalFile = fileFingerprint(sourcePath);
    if (
      !resolvedOptions.allowSourceChangesDuringSnapshot &&
      (finalState.running > 0 || finalVersion !== beforeVersion || finalFile !== beforeFile)
    ) {
      throw new PredictionBuildError(
        "SOURCE_CHANGED",
        "备份期间源库发生变化或爬虫重新启动，已丢弃快照。",
        finalState
      );
    }
    snapshotMetadata = {
      schemaVersion: 1,
      trainingDataContract: TRAINING_DATA_CONTRACT,
      sourcePath,
      snapshotPath,
      createdAt: new Date().toISOString(),
      sourceContract,
      crawlStateAtStart: state,
      crawlStateAtEnd: finalState,
      sourceChangedDuringSnapshot:
        beforeVersion !== finalVersion || beforeFile !== finalFile,
      sourceDataVersionAtStart: beforeVersion,
      sourceDataVersionAtEnd: finalVersion,
      sourceFingerprintAtStart: beforeFile,
      sourceFingerprintAtEnd: finalFile
    };
  } catch (error) {
    safeUnlink(temporaryPath);
    if (error?.code === "ERR_SQLITE_ERROR" && /locked|busy/i.test(String(error.message))) {
      throw new PredictionBuildError("SOURCE_BUSY", "源库正被写入或锁定，拒绝创建训练快照。" );
    }
    throw error;
  } finally {
    source.close();
  }
  renameSync(temporaryPath, snapshotPath);
  const snapshot = new DatabaseSync(snapshotPath, { readOnly: true });
  try {
    snapshot.exec("PRAGMA query_only = ON");
    const quickCheck = snapshot.prepare("PRAGMA quick_check").get();
    if (String(quickCheck?.quick_check || "").toLowerCase() !== "ok") {
      throw new PredictionBuildError("SNAPSHOT_INTEGRITY_FAILED", "训练快照 SQLite quick_check 未通过。", quickCheck);
    }
    snapshotMetadata.snapshotCounts = snapshot.prepare(`
      SELECT
        (SELECT COUNT(*) FROM reports) AS reports,
        (SELECT COUNT(*) FROM observations) AS observations,
        (SELECT COUNT(DISTINCT taxon_id) FROM observations WHERE COALESCE(taxon_id, '') <> '') AS taxa
    `).get();
  } finally {
    snapshot.close();
  }
  const sha256 = sha256File(snapshotPath);
  writeFileSync(`${snapshotPath}.sha256`, `${sha256}  ${snapshotPath.split(/[\\/]/).pop()}\n`, "utf8");
  snapshotMetadata.sha256 = sha256;
  const manifestPath = `${snapshotPath}.manifest.json`;
  writeFileSync(manifestPath, `${JSON.stringify(snapshotMetadata, null, 2)}\n`, "utf8");
  try {
    chmodSync(snapshotPath, 0o444);
  } catch {
    // Windows ACLs may ignore POSIX mode bits; consumers still open with query_only.
  }
  emitProgress(resolvedOptions, "snapshot_ready", { snapshotPath, sha256 });
  return { snapshotPath, sha256, manifestPath, metadata: snapshotMetadata };
}

function convertReportCoordinate(row) {
  const converted = bd09ToWgs84(row.longitude, row.latitude);
  const withinZhejiang = converted.valid && isWithinZhejiang(converted.longitude, converted.latitude);
  return {
    ...converted,
    conversionValid: converted.valid,
    withinZhejiang,
    valid: Boolean(converted.valid && withinZhejiang && !converted.swapped)
  };
}

function eligibleChecklistCondition(reportAlias = "reports", savedAlias = "saved") {
  return `(
    COALESCE(${savedAlias}.bad_count, 0) = 0
    AND (
      (
        ${reportAlias}.report_kind = 'normal'
        AND COALESCE(${savedAlias}.saved_count, 0) = ${reportAlias}.taxon_count_reported
      )
      OR (
        ${reportAlias}.report_kind = 'flagged'
        AND COALESCE(${savedAlias}.saved_count, 0) > 0
        AND COALESCE(${reportAlias}.outside_count, 0) BETWEEN 0 AND ${reportAlias}.taxon_count_reported
        AND COALESCE(${savedAlias}.saved_count, 0) + COALESCE(${reportAlias}.outside_count, 0)
            = ${reportAlias}.taxon_count_reported
      )
    )
  )`;
}

function inspectSnapshotQuality(database, options = {}) {
  const resolvedOptions = mergeOptions(options);
  assertSourceSchema(database);
  const state = crawlState(database);
  if (resolvedOptions.requireCompletedCrawl && !state.completed) {
    throw new PredictionBuildError("CRAWL_NOT_COMPLETED", "训练快照没有 completed 全量抓取记录。" );
  }
  const eligibility = eligibleChecklistCondition("reports", "saved");
  const counts = database
    .prepare(
      `WITH saved AS (
         SELECT report_id, COUNT(*) AS saved_count,
                SUM(CASE WHEN COALESCE(is_red_species, 0) = 1 OR COALESCE(source_outside_type, 0) = 1
                         THEN 1 ELSE 0 END) AS bad_count
         FROM observations GROUP BY report_id
       )
       SELECT
         SUM(CASE WHEN reports.report_kind = 'normal' THEN 1 ELSE 0 END) AS normal_count,
         SUM(CASE WHEN reports.report_kind = 'normal' AND ${eligibility} THEN 1 ELSE 0 END) AS complete_normal_count,
         SUM(CASE WHEN reports.report_kind = 'flagged' THEN 1 ELSE 0 END) AS flagged_count,
         SUM(CASE WHEN reports.report_kind = 'flagged' AND ${eligibility} THEN 1 ELSE 0 END) AS eligible_flagged_count,
         SUM(CASE WHEN ${eligibility} THEN 1 ELSE 0 END) AS eligible_count,
         SUM(CASE WHEN ${eligibility} AND reports.location_metadata_fetched = 1 THEN 1 ELSE 0 END) AS refreshed_count,
         SUM(CASE WHEN reports.report_kind = 'flagged' AND ${eligibility}
                  THEN COALESCE(reports.outside_count, 0) ELSE 0 END) AS excluded_red_count
       FROM reports
       LEFT JOIN saved ON saved.report_id = reports.report_id`
    )
    .get();
  const normalCount = Number(counts.normal_count) || 0;
  const completeNormalCount = Number(counts.complete_normal_count) || 0;
  const flaggedCount = Number(counts.flagged_count) || 0;
  const eligibleFlaggedCount = Number(counts.eligible_flagged_count) || 0;
  const eligibleCount = Number(counts.eligible_count) || 0;
  const refreshedCount = Number(counts.refreshed_count) || 0;
  if (normalCount < resolvedOptions.minimumNormalReports) {
    throw new PredictionBuildError("TOO_FEW_REPORTS", "普通报告数量未达到建模门槛。", {
      actual: normalCount,
      required: resolvedOptions.minimumNormalReports
    });
  }
  const pointStats = new Map();
  let validCoordinateCount = 0;
  let validDateCount = 0;
  let coordinateCandidateCount = 0;
  let swappedCoordinateCount = 0;
  let outsideCoordinateCount = 0;
  let dataCutoffDate = "";
  let dataStartDate = "";
  const completeRows = database
    .prepare(
      `WITH saved AS (
         SELECT report_id, COUNT(*) AS saved_count,
                SUM(CASE WHEN COALESCE(is_red_species, 0) = 1 OR COALESCE(source_outside_type, 0) = 1
                         THEN 1 ELSE 0 END) AS bad_count
         FROM observations GROUP BY report_id
       )
       SELECT reports.*
       FROM reports LEFT JOIN saved ON saved.report_id = reports.report_id
       WHERE ${eligibility}`
    )
    .iterate();
  for (const row of completeRows) {
    const parts = isoDateParts(String(row.start_time || "").slice(0, 10));
    if (parts) {
      validDateCount += 1;
      if (!dataStartDate || parts.iso < dataStartDate) dataStartDate = parts.iso;
      if (parts.iso > dataCutoffDate) dataCutoffDate = parts.iso;
    }
    const coordinate = convertReportCoordinate(row);
    if (Number(row.location_metadata_fetched)) coordinateCandidateCount += 1;
    if (coordinate.swapped) swappedCoordinateCount += 1;
    if (coordinate.valid) validCoordinateCount += 1;
    else if (coordinate.conversionValid && !coordinate.withinZhejiang) outsideCoordinateCount += 1;
    if (!row.point_id) continue;
    const key = String(row.point_id);
    const stats = pointStats.get(key) || {
      count: 0,
      validCount: 0,
      hasCoordinateProblem: false,
      minLongitude: Infinity,
      maxLongitude: -Infinity,
      minLatitude: Infinity,
      maxLatitude: -Infinity
    };
    stats.count += 1;
    if (!coordinate.valid) {
      stats.hasCoordinateProblem = true;
    } else {
      stats.validCount += 1;
      stats.minLongitude = Math.min(stats.minLongitude, coordinate.longitude);
      stats.maxLongitude = Math.max(stats.maxLongitude, coordinate.longitude);
      stats.minLatitude = Math.min(stats.minLatitude, coordinate.latitude);
      stats.maxLatitude = Math.max(stats.maxLatitude, coordinate.latitude);
    }
    pointStats.set(key, stats);
  }
  let unstablePointCount = 0;
  for (const stats of pointStats.values()) {
    const driftMeters = stats.validCount
      ? haversineDistanceMeters(stats.minLongitude, stats.minLatitude, stats.maxLongitude, stats.maxLatitude)
      : Infinity;
    stats.driftMeters = driftMeters;
    stats.stable = !stats.hasCoordinateProblem && driftMeters <= resolvedOptions.pointDriftMeters;
    if (!stats.stable) unstablePointCount += 1;
  }

  const completeCoverage = normalCount ? completeNormalCount / normalCount : 0;
  const flaggedEligibilityCoverage = flaggedCount ? eligibleFlaggedCount / flaggedCount : 1;
  const refreshCoverage = eligibleCount ? refreshedCount / eligibleCount : 0;
  const coordinateCoverage = eligibleCount ? validCoordinateCount / eligibleCount : 0;
  const dateCoverage = eligibleCount ? validDateCount / eligibleCount : 0;
  const expectedNormal = Number(state.completed?.normal_report_total) || 0;
  const sourceCoverage = expectedNormal > 0 ? normalCount / expectedNormal : 1;
  const report = {
    normalCount,
    completeCount: completeNormalCount,
    completeNormalCount,
    flaggedCount,
    eligibleFlaggedCount,
    eligibleCount,
    excludedRedCount: Number(counts.excluded_red_count) || 0,
    excludedChecklistCount: normalCount + flaggedCount - eligibleCount,
    refreshedCount,
    validCoordinateCount,
    coordinateCandidateCount,
    swappedCoordinateCount,
    outsideCoordinateCount,
    unstablePointCount,
    completeCoverage,
    flaggedEligibilityCoverage,
    refreshCoverage,
    coordinateCoverage,
    dateCoverage,
    sourceCoverage,
    expectedNormal,
    dataCutoffDate,
    dataStartDate,
    coordinateReviewSample: [...pointStats.entries()]
      .filter(([, stats]) => stats.validCount >= 10)
      .sort((left, right) => right[1].count - left[1].count)
      .slice(0, 20)
      .map(([pointId, stats]) => ({
        pointIdHash: stableHash(pointId).slice(0, 16),
        reportCount: stats.count,
        driftMeters: Number(stats.driftMeters.toFixed(1)),
        longitude: Number(((stats.minLongitude + stats.maxLongitude) / 2).toFixed(6)),
        latitude: Number(((stats.minLatitude + stats.maxLatitude) / 2).toFixed(6))
      }))
  };
  const failures = [];
  if (completeCoverage < resolvedOptions.minimumCompleteCoverage) failures.push("completeCoverage");
  if (coordinateCoverage < resolvedOptions.minimumCoordinateCoverage) failures.push("coordinateCoverage");
  if (dateCoverage < resolvedOptions.minimumDateCoverage) failures.push("dateCoverage");
  if (!resolvedOptions.coordinateSystemConfirmed) failures.push("coordinateSystemConfirmation");
  if (failures.length) {
    throw new PredictionBuildError(
      "DATA_QUALITY_GATE_FAILED",
      `数据质量门禁未通过：${failures.join(", ")}。`,
      report
    );
  }
  return { report, pointStats };
}

function createArtifactSchema(database) {
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA secure_delete = ON;

    CREATE TABLE manifest (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) WITHOUT ROWID;

    CREATE TABLE taxa (
      taxon_id TEXT PRIMARY KEY,
      common_name TEXT NOT NULL,
      scientific_name TEXT NOT NULL DEFAULT '',
      english_name TEXT NOT NULL DEFAULT '',
      is_sensitive INTEGER NOT NULL DEFAULT 0 CHECK (is_sensitive IN (0, 1)),
      positive_count INTEGER NOT NULL,
      observer_count INTEGER NOT NULL,
      raw_positive_reports INTEGER NOT NULL DEFAULT 0,
      effective_positive_units REAL NOT NULL DEFAULT 0,
      event_count INTEGER NOT NULL DEFAULT 0,
      support_year_count INTEGER NOT NULL DEFAULT 0,
      dominant_event_share REAL NOT NULL DEFAULT 0,
      event_dominated INTEGER NOT NULL DEFAULT 0 CHECK (event_dominated IN (0, 1)),
      single_support_year INTEGER NOT NULL DEFAULT 0 CHECK (single_support_year IN (0, 1)),
      vagrant_candidate INTEGER NOT NULL DEFAULT 0 CHECK (vagrant_candidate IN (0, 1)),
      vagrant_reason TEXT,
      calibration_scope TEXT NOT NULL DEFAULT 'none'
    ) WITHOUT ROWID;

    CREATE TABLE space_units (
      id TEXT PRIMARY KEY,
      level TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      parent_id TEXT REFERENCES space_units(id),
      city_name TEXT NOT NULL DEFAULT '',
      district_name TEXT NOT NULL DEFAULT '',
      centroid_longitude REAL,
      centroid_latitude REAL,
      boundary_json TEXT,
      min_longitude REAL,
      min_latitude REAL,
      max_longitude REAL,
      max_latitude REAL,
      checklist_count INTEGER NOT NULL,
      observer_count INTEGER NOT NULL,
      support_years_json TEXT NOT NULL,
      supported INTEGER NOT NULL CHECK (supported IN (0, 1))
    ) WITHOUT ROWID;

    CREATE TABLE location_lookup (
      lookup_type TEXT NOT NULL,
      lookup_key TEXT NOT NULL,
      space_unit_id TEXT NOT NULL REFERENCES space_units(id),
      PRIMARY KEY (lookup_type, lookup_key)
    ) WITHOUT ROWID;

    CREATE TABLE checklist_exposure (
      space_unit_id TEXT NOT NULL REFERENCES space_units(id),
      season_week INTEGER NOT NULL CHECK (season_week BETWEEN 1 AND 52),
      effective_checklists REAL NOT NULL,
      raw_checklists INTEGER NOT NULL,
      observer_count INTEGER NOT NULL,
      support_years_json TEXT NOT NULL,
      PRIMARY KEY (space_unit_id, season_week)
    ) WITHOUT ROWID;

    CREATE TABLE taxon_detection (
      space_unit_id TEXT NOT NULL REFERENCES space_units(id),
      season_week INTEGER NOT NULL CHECK (season_week BETWEEN 1 AND 52),
      taxon_id TEXT NOT NULL REFERENCES taxa(taxon_id),
      effective_detections REAL NOT NULL,
      raw_detections INTEGER NOT NULL,
      observer_count INTEGER NOT NULL,
      support_years_json TEXT NOT NULL,
      PRIMARY KEY (space_unit_id, season_week, taxon_id)
    ) WITHOUT ROWID;

    CREATE TABLE calibration_parameters (
      scope TEXT NOT NULL CHECK (scope IN ('species', 'group')),
      scope_id TEXT NOT NULL,
      a REAL NOT NULL,
      b REAL NOT NULL,
      c REAL NOT NULL,
      sample_count REAL NOT NULL,
      positive_count REAL NOT NULL,
      validation_year INTEGER,
      fitted INTEGER NOT NULL,
      PRIMARY KEY (scope, scope_id)
    ) WITHOUT ROWID;

    CREATE TABLE location_predictions (
      space_unit_id TEXT NOT NULL REFERENCES space_units(id),
      resolved_space_unit_id TEXT NOT NULL REFERENCES space_units(id),
      temporal_granularity TEXT NOT NULL CHECK (temporal_granularity IN ('week', 'month')),
      season_bucket INTEGER NOT NULL,
      taxon_id TEXT NOT NULL REFERENCES taxa(taxon_id),
      probability REAL,
      ranking_score REAL NOT NULL,
      interval_lower REAL NOT NULL,
      interval_upper REAL NOT NULL,
      probability_level TEXT NOT NULL,
      effective_checklists REAL NOT NULL,
      observer_count INTEGER NOT NULL,
      support_years_json TEXT NOT NULL,
      confidence TEXT NOT NULL,
      fallback_level TEXT NOT NULL,
      PRIMARY KEY (space_unit_id, temporal_granularity, season_bucket, taxon_id)
    ) WITHOUT ROWID;

    CREATE TABLE reverse_hotspots (
      taxon_id TEXT NOT NULL REFERENCES taxa(taxon_id),
      space_unit_id TEXT NOT NULL REFERENCES space_units(id),
      temporal_granularity TEXT NOT NULL CHECK (temporal_granularity IN ('week', 'month')),
      season_start_day INTEGER NOT NULL,
      season_end_day INTEGER NOT NULL,
      peak_day REAL NOT NULL,
      rank_score REAL NOT NULL,
      probability REAL,
      interval_lower REAL NOT NULL,
      interval_upper REAL NOT NULL,
      probability_level TEXT NOT NULL,
      effective_checklists REAL NOT NULL,
      observer_count INTEGER NOT NULL,
      support_years_json TEXT NOT NULL,
      confidence TEXT NOT NULL,
      member_space_unit_ids_json TEXT NOT NULL,
      hotspot_boundary_json TEXT,
      PRIMARY KEY (taxon_id, space_unit_id, temporal_granularity, season_start_day, season_end_day)
    ) WITHOUT ROWID;

    CREATE TABLE reverse_candidates (
      taxon_id TEXT NOT NULL,
      space_unit_id TEXT NOT NULL,
      temporal_granularity TEXT NOT NULL,
      season_start_day INTEGER NOT NULL,
      season_end_day INTEGER NOT NULL,
      peak_day REAL NOT NULL,
      rank_score REAL NOT NULL,
      probability REAL,
      interval_lower REAL NOT NULL,
      interval_upper REAL NOT NULL,
      probability_level TEXT NOT NULL,
      effective_checklists REAL NOT NULL,
      observer_count INTEGER NOT NULL,
      support_years_json TEXT NOT NULL,
      confidence TEXT NOT NULL
    );

    CREATE INDEX idx_space_units_level_code ON space_units(level, code);
    CREATE INDEX idx_space_units_admin_coverage
      ON space_units(level, supported, min_longitude, max_longitude, min_latitude, max_latitude);
    CREATE INDEX idx_location_predictions_bucket ON location_predictions(space_unit_id, temporal_granularity, season_bucket, ranking_score DESC);
    CREATE INDEX idx_location_predictions_resolved ON location_predictions(resolved_space_unit_id, temporal_granularity, season_bucket);
    CREATE INDEX idx_location_predictions_taxon ON location_predictions(taxon_id, temporal_granularity, season_bucket);
    CREATE INDEX idx_reverse_hotspots_rank ON reverse_hotspots(taxon_id, temporal_granularity, rank_score DESC);
    CREATE INDEX idx_reverse_candidates_taxon_rank ON reverse_candidates(taxon_id, rank_score DESC, space_unit_id);
    CREATE INDEX idx_taxon_detection_unit_taxon_week ON taxon_detection(space_unit_id, taxon_id, season_week);

    CREATE TABLE training_reports (
      report_id TEXT PRIMARY KEY,
      report_kind TEXT NOT NULL CHECK (report_kind IN ('normal', 'flagged')),
      observer_hash TEXT NOT NULL,
      observer_known INTEGER NOT NULL CHECK (observer_known IN (0, 1)),
      group_key TEXT NOT NULL,
      report_date TEXT NOT NULL,
      report_year INTEGER NOT NULL,
      season_week INTEGER NOT NULL,
      base_weight REAL NOT NULL,
      weight REAL NOT NULL,
      is_recent INTEGER NOT NULL,
      province_unit TEXT NOT NULL,
      city_unit TEXT,
      district_unit TEXT,
      grid_r6_unit TEXT,
      grid_r7_unit TEXT,
      point_unit TEXT
    ) WITHOUT ROWID;

    CREATE TABLE training_detections (
      report_id TEXT NOT NULL REFERENCES training_reports(report_id) ON DELETE CASCADE,
      taxon_id TEXT NOT NULL,
      event_id TEXT,
      detection_multiplier REAL NOT NULL DEFAULT 1 CHECK (detection_multiplier > 0 AND detection_multiplier <= 1),
      PRIMARY KEY (report_id, taxon_id)
    ) WITHOUT ROWID;

    CREATE TABLE occurrence_events (
      taxon_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      independent_positive_count INTEGER NOT NULL,
      raw_positive_reports INTEGER NOT NULL,
      observer_count INTEGER NOT NULL,
      grid_r7_count INTEGER NOT NULL,
      grid_r7_ids_json TEXT NOT NULL,
      base_training_weight REAL NOT NULL,
      effective_training_weight REAL NOT NULL,
      weight_multiplier REAL NOT NULL,
      PRIMARY KEY (taxon_id, event_id)
    ) WITHOUT ROWID;

    CREATE TABLE training_taxon_event_summary (
      taxon_id TEXT PRIMARY KEY,
      raw_positive_reports INTEGER NOT NULL,
      independent_positive_count INTEGER NOT NULL,
      independent_observer_count INTEGER NOT NULL,
      effective_positive_units REAL NOT NULL,
      event_count INTEGER NOT NULL,
      support_year_count INTEGER NOT NULL,
      dominant_event_share REAL NOT NULL,
      event_dominated INTEGER NOT NULL,
      single_support_year INTEGER NOT NULL,
      vagrant_candidate INTEGER NOT NULL,
      vagrant_reason TEXT
    ) WITHOUT ROWID;

    CREATE TABLE taxon_catalog (
      taxon_id TEXT PRIMARY KEY,
      common_name TEXT NOT NULL,
      scientific_name TEXT NOT NULL,
      english_name TEXT NOT NULL
    ) WITHOUT ROWID;
  `);
}

function manifestSet(database, key, value) {
  database.prepare("INSERT OR REPLACE INTO manifest(key, value) VALUES (?, ?)").run(key, JSON.stringify(value));
}

function assertArtifactPublishable(path, metadata) {
  const database = new DatabaseSync(path, { readOnly: true });
  try {
    database.exec("PRAGMA query_only = ON");
    const manifest = new Map();
    for (const row of database.prepare("SELECT key, value FROM manifest").all()) {
      let value;
      try {
        value = JSON.parse(String(row.value));
      } catch {
        value = row.value;
      }
      manifest.set(row.key, value);
    }
    if (String(manifest.get("schema_version")) !== SCHEMA_VERSION) {
      throw new Error("公共模型 schema_version 不可发布");
    }
    if (manifest.get("quality_gate")?.passed !== true) {
      throw new Error("公共模型未通过 quality_gate");
    }
    if (manifest.get("quality_gate")?.internalBuild === true || manifest.get("test_only") === true) {
      throw new Error("testOnly/构建中间模型禁止发布");
    }
    const manifestVersion = String(manifest.get("model_version") || "");
    if (metadata.modelVersion && manifestVersion !== String(metadata.modelVersion)) {
      throw new Error("发布参数与 manifest.model_version 不一致");
    }
    const manifestSnapshot = String(manifest.get("source_snapshot_sha256") || "").toLowerCase();
    if (
      metadata.sourceSnapshotSha256 &&
      manifestSnapshot !== String(metadata.sourceSnapshotSha256).toLowerCase()
    ) {
      throw new Error("发布参数与 manifest.source_snapshot_sha256 不一致");
    }
  } finally {
    database.close();
  }
}

function publishModelPointer(pointerPath, outputPath, metadata = {}) {
  const resolvedPointer = resolve(pointerPath);
  const resolvedOutput = resolve(outputPath);
  try {
    if (!statSync(resolvedOutput).isFile()) throw new Error("目标不是常规文件");
  } catch (error) {
    throw new PredictionBuildError("POINTER_UPDATE_FAILED", `拒绝发布不存在的模型制品：${error.message}`, {
      pointerPath: resolvedPointer,
      outputPath: resolvedOutput
    });
  }
  const publicSha256 = String(metadata.artifactSha256 || "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(publicSha256) || sha256File(resolvedOutput) !== publicSha256) {
    throw new PredictionBuildError("POINTER_UPDATE_FAILED", "公共模型制品 SHA-256 缺失或校验失败。");
  }
  try {
    assertArtifactPublishable(resolvedOutput, metadata);
  } catch (error) {
    throw new PredictionBuildError("POINTER_UPDATE_FAILED", `公共模型制品不可发布：${error.message}`);
  }
  mkdirSync(dirname(resolvedPointer), { recursive: true });
  const temporaryPointer = `${resolvedPointer}.building-${process.pid}`;
  safeUnlink(temporaryPointer);
  const database = relative(dirname(resolvedPointer), resolvedOutput).split(sep).join("/");
  let initialPointerState;
  try {
    initialPointerState = capturePointerState(resolvedPointer);
  } catch (error) {
    throw new PredictionBuildError("POINTER_UPDATE_FAILED", `无法记录现有模型版本指针状态：${error.message}`);
  }
  let existing = null;
  if (initialPointerState.exists) {
    try {
      existing = JSON.parse(initialPointerState.contents.toString("utf8"));
    } catch (error) {
      throw new PredictionBuildError("POINTER_UPDATE_FAILED", `现有模型版本指针无效：${error.message}`);
    }
  }
  const sensitiveOutput = metadata.sensitiveArtifactPath
    ? resolve(metadata.sensitiveArtifactPath)
    : null;
  if (sensitiveOutput) {
    try {
      if (!statSync(sensitiveOutput).isFile()) throw new Error("敏感目标不是常规文件");
    } catch (error) {
      throw new PredictionBuildError("POINTER_UPDATE_FAILED", `拒绝发布不存在的敏感模型制品：${error.message}`);
    }
    if (!/^[a-f0-9]{64}$/i.test(String(metadata.sensitiveSha256 || ""))) {
      throw new PredictionBuildError("POINTER_UPDATE_FAILED", "联合发布必须提供有效的 sensitiveSha256。");
    }
    if (sha256File(sensitiveOutput) !== String(metadata.sensitiveSha256).toLowerCase()) {
      throw new PredictionBuildError("POINTER_UPDATE_FAILED", "敏感模型制品 SHA-256 校验失败。");
    }
  } else if (
    (existing?.sensitiveArtifact || existing?.sensitiveArtifactPath || existing?.sensitive_artifact) &&
    metadata.allowSensitiveRemoval !== true
  ) {
    throw new PredictionBuildError(
      "POINTER_UPDATE_FAILED",
      "现有版本指针包含敏感制品；公共模型重建不得静默移除，必须执行联合发布。"
    );
  }
  const payload = {
    schemaVersion: 1,
    database,
    modelVersion: metadata.modelVersion || null,
    sha256: publicSha256,
    updatedAt: new Date().toISOString()
  };
  if (metadata.sourceSnapshotSha256) payload.sourceSnapshotSha256 = metadata.sourceSnapshotSha256;
  if (sensitiveOutput) {
    payload.sensitiveArtifact = relative(dirname(resolvedPointer), sensitiveOutput).split(sep).join("/");
    payload.sensitiveSha256 = String(metadata.sensitiveSha256).toLowerCase();
    if (metadata.sensitiveModelVersion) payload.sensitiveModelVersion = metadata.sensitiveModelVersion;
    if (metadata.sensitiveSourceSnapshotSha256) {
      payload.sensitiveSourceSnapshotSha256 = metadata.sensitiveSourceSnapshotSha256;
    }
  }
  try {
    writeFileSync(temporaryPointer, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    if (typeof metadata.beforePointerCommit === "function") {
      const callbackResult = metadata.beforePointerCommit({
        pointerPath: resolvedPointer,
        temporaryPointer,
        expectedState: {
          exists: initialPointerState.exists,
          sha256: initialPointerState.sha256
        }
      });
      if (callbackResult && typeof callbackResult.then === "function") {
        throw new Error("beforePointerCommit 必须是同步回调");
      }
    }
    const currentPointerState = capturePointerState(resolvedPointer);
    if (!pointerStateMatches(initialPointerState, currentPointerState)) {
      throw new Error("现有模型版本指针在提交期间发生变化，已拒绝覆盖");
    }
    renameSync(temporaryPointer, resolvedPointer);
  } catch (error) {
    safeUnlink(temporaryPointer);
    throw new PredictionBuildError("POINTER_UPDATE_FAILED", `模型已生成，但版本指针更新失败：${error.message}`, {
      pointerPath: resolvedPointer,
      outputPath: resolvedOutput
    });
  }
  return { pointerPath: resolvedPointer, pointer: payload };
}

const OBSERVER_KEYS = new Set([
  "observerid",
  "observer_id",
  "userid",
  "user_id",
  "memberid",
  "member_id",
  "creatorid",
  "creator_id",
  "createby",
  "username",
  "user_name"
]);

function findObserverValue(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 4) return null;
  for (const [key, candidate] of Object.entries(value)) {
    if (OBSERVER_KEYS.has(String(key).toLowerCase()) && ["string", "number"].includes(typeof candidate)) {
      const text = String(candidate).trim();
      if (text) return text;
    }
  }
  for (const candidate of Object.values(value)) {
    const nested = findObserverValue(candidate, depth + 1);
    if (nested) return nested;
  }
  return null;
}

function observerIdentity(rawReportJson, reportId) {
  let parsed = null;
  try {
    parsed = JSON.parse(rawReportJson || "null");
  } catch {
    parsed = null;
  }
  const observer = findObserverValue(parsed);
  if (!observer) {
    return { hash: `anonymous:${stableHash(reportId).slice(0, 32)}`, known: false };
  }
  return { hash: `observer:${stableHash(observer).slice(0, 32)}`, known: true };
}

function taxonIdForObservation(observation) {
  const explicit = String(observation.taxon_id || "").trim();
  if (explicit) return explicit;
  const name = String(observation.taxon_name || "").trim();
  return name ? `name:${stableHash(name).slice(0, 24)}` : "";
}

function makeBoundary(cell) {
  if (Array.isArray(cell.boundary) && cell.boundary.length >= 4) return cell.boundary;
  return [
    [cell.minLongitude, cell.minLatitude],
    [cell.maxLongitude, cell.minLatitude],
    [cell.maxLongitude, cell.maxLatitude],
    [cell.minLongitude, cell.maxLatitude],
    [cell.minLongitude, cell.minLatitude]
  ];
}

function createUnitRegistry() {
  const units = new Map();
  const parentVotes = new Map();
  const pointLookupVotes = new Map();
  const locationLookups = new Map();
  function register(unit) {
    const existing = units.get(unit.id);
    if (!existing) {
      units.set(unit.id, {
        ...unit,
        minLongitude: unit.minLongitude ?? null,
        minLatitude: unit.minLatitude ?? null,
        maxLongitude: unit.maxLongitude ?? null,
        maxLatitude: unit.maxLatitude ?? null
      });
      return units.get(unit.id);
    }
    for (const [key, value] of Object.entries(unit)) {
      if ((existing[key] == null || existing[key] === "") && value != null && value !== "") existing[key] = value;
    }
    return existing;
  }
  function includeCoordinate(unitId, longitude, latitude) {
    const unit = units.get(unitId);
    if (!unit || !Number.isFinite(longitude) || !Number.isFinite(latitude)) return;
    unit.minLongitude = unit.minLongitude == null ? longitude : Math.min(unit.minLongitude, longitude);
    unit.maxLongitude = unit.maxLongitude == null ? longitude : Math.max(unit.maxLongitude, longitude);
    unit.minLatitude = unit.minLatitude == null ? latitude : Math.min(unit.minLatitude, latitude);
    unit.maxLatitude = unit.maxLatitude == null ? latitude : Math.max(unit.maxLatitude, latitude);
    unit.centroidLongitude = (unit.minLongitude + unit.maxLongitude) / 2;
    unit.centroidLatitude = (unit.minLatitude + unit.maxLatitude) / 2;
  }
  function voteParent(unitId, parentId) {
    if (!unitId || !parentId) return;
    if (!parentVotes.has(unitId)) parentVotes.set(unitId, new Map());
    const votes = parentVotes.get(unitId);
    votes.set(parentId, (votes.get(parentId) || 0) + 1);
  }
  function votePointLookup(pointId, unitId) {
    const key = String(pointId || "").trim();
    if (!key || !unitId) return;
    if (!pointLookupVotes.has(key)) pointLookupVotes.set(key, new Map());
    const votes = pointLookupVotes.get(key);
    votes.set(unitId, (votes.get(unitId) || 0) + 1);
  }
  function finalizeParents() {
    for (const [unitId, votes] of parentVotes.entries()) {
      const unit = units.get(unitId);
      if (!unit || !votes.size) continue;
      unit.parentId = [...votes.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0][0];
    }
    for (const [pointId, votes] of pointLookupVotes.entries()) {
      if (!votes.size) continue;
      locationLookups.set(
        pointId,
        [...votes.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0][0]
      );
    }
  }
  return { units, locationLookups, register, includeCoordinate, voteParent, votePointLookup, finalizeParents };
}

function registerAdministrativeUnits(registry, cityName, districtName) {
  const provinceId = administrativeUnitId("province");
  registry.register({
    id: provinceId,
    level: "province",
    code: "330000",
    name: "浙江省",
    parentId: null,
    cityName: "",
    districtName: "",
    centroidLongitude: (ZHEJIANG_BOUNDS.minLongitude + ZHEJIANG_BOUNDS.maxLongitude) / 2,
    centroidLatitude: (ZHEJIANG_BOUNDS.minLatitude + ZHEJIANG_BOUNDS.maxLatitude) / 2,
    minLongitude: ZHEJIANG_BOUNDS.minLongitude,
    minLatitude: ZHEJIANG_BOUNDS.minLatitude,
    maxLongitude: ZHEJIANG_BOUNDS.maxLongitude,
    maxLatitude: ZHEJIANG_BOUNDS.maxLatitude,
    boundary: null
  });
  let cityId = null;
  let districtId = null;
  if (String(cityName || "").trim()) {
    cityId = administrativeUnitId("city", cityName);
    registry.register({
      id: cityId,
      level: "city",
      code: String(cityName).trim(),
      name: String(cityName).trim(),
      parentId: provinceId,
      cityName: String(cityName).trim(),
      districtName: "",
      boundary: null
    });
  }
  if (cityId && String(districtName || "").trim()) {
    districtId = administrativeUnitId("district", cityName, districtName);
    registry.register({
      id: districtId,
      level: "district",
      code: `${String(cityName).trim()}/${String(districtName).trim()}`,
      name: String(districtName).trim(),
      parentId: cityId,
      cityName: String(cityName).trim(),
      districtName: String(districtName).trim(),
      boundary: null
    });
  }
  return { provinceId, cityId, districtId };
}

function registerGridUnit(registry, cell, parentId, cityName, districtName) {
  registry.register({
    id: cell.id,
    level: cell.level,
    code: cell.id,
    name: `H3 ${cell.level === "grid_r7" ? "r7" : "r6"} 网格`,
    parentId,
    cityName: String(cityName || ""),
    districtName: String(districtName || ""),
    centroidLongitude: cell.centroidLongitude,
    centroidLatitude: cell.centroidLatitude,
    minLongitude: cell.minLongitude,
    minLatitude: cell.minLatitude,
    maxLongitude: cell.maxLongitude,
    maxLatitude: cell.maxLatitude,
    boundary: makeBoundary(cell)
  });
  if (cell.level === "grid_r6") registry.voteParent(cell.id, parentId);
}

function insertTrainingRows(source, artifact, pointStats, quality, options) {
  const registry = createUnitRegistry();
  registerAdministrativeUnits(registry, "", "");
  const insertReport = artifact.prepare(
    `INSERT INTO training_reports
       (report_id, report_kind, observer_hash, observer_known, group_key, report_date, report_year, season_week,
        base_weight, weight, is_recent, province_unit, city_unit, district_unit,
        grid_r6_unit, grid_r7_unit, point_unit)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertDetection = artifact.prepare(
    "INSERT OR IGNORE INTO training_detections(report_id, taxon_id) VALUES (?, ?)"
  );
  const insertTaxon = artifact.prepare(
    `INSERT INTO taxon_catalog(taxon_id, common_name, scientific_name, english_name)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(taxon_id) DO UPDATE SET
       common_name = CASE WHEN excluded.common_name <> '' THEN excluded.common_name ELSE taxon_catalog.common_name END,
       scientific_name = CASE WHEN excluded.scientific_name <> '' THEN excluded.scientific_name ELSE taxon_catalog.scientific_name END,
       english_name = CASE WHEN excluded.english_name <> '' THEN excluded.english_name ELSE taxon_catalog.english_name END`
  );
  const seenDuplicates = new Set();
  let current = null;
  let observations = [];
  let insertedReports = 0;
  let duplicateReports = 0;
  let excludedInvalidDetections = 0;
  let knownObserverReports = 0;
  const cutoff = new Date(`${quality.dataCutoffDate}T00:00:00Z`);
  const localCutoff = new Date(cutoff);
  localCutoff.setUTCFullYear(localCutoff.getUTCFullYear() - options.localHistoryYears);

  function flush() {
    if (!current) return;
    const dateText = String(current.start_time || "").slice(0, 10);
    const dateParts = isoDateParts(dateText);
    if (!dateParts) return;
    const coordinate = convertReportCoordinate(current);
    const pointState = current.point_id ? pointStats.get(String(current.point_id)) : null;
    const spatialUsable = coordinate.valid && (!pointState || pointState.stable);
    const admin = registerAdministrativeUnits(registry, current.city_name, current.district_name);
    for (const unitId of [admin.provinceId, admin.cityId, admin.districtId].filter(Boolean)) {
      if (coordinate.withinZhejiang) registry.includeCoordinate(unitId, coordinate.longitude, coordinate.latitude);
    }
    let r6 = null;
    let r7 = null;
    let pointUnitId = null;
    if (spatialUsable) {
      r6 = gridCell(coordinate.longitude, coordinate.latitude, "grid_r6");
      r7 = gridCell(coordinate.longitude, coordinate.latitude, "grid_r7");
      registerGridUnit(registry, r6, admin.districtId || admin.cityId || admin.provinceId, current.city_name, current.district_name);
      registerGridUnit(registry, r7, r6.id, current.city_name, current.district_name);
      if (current.point_id) {
        pointUnitId = `point:${stableHash(current.point_id).slice(0, 32)}`;
        registry.register({
          id: pointUnitId,
          level: "point",
          code: String(current.point_id),
          name: String(current.point_name || "未命名点位"),
          parentId: r7.id,
          cityName: String(current.city_name || ""),
          districtName: String(current.district_name || ""),
          centroidLongitude: coordinate.longitude,
          centroidLatitude: coordinate.latitude,
          minLongitude: coordinate.longitude,
          minLatitude: coordinate.latitude,
          maxLongitude: coordinate.longitude,
          maxLatitude: coordinate.latitude,
          boundary: null
        });
        registry.includeCoordinate(pointUnitId, coordinate.longitude, coordinate.latitude);
        registry.votePointLookup(current.point_id, pointUnitId);
      }
    }
    if (current.point_id && !pointUnitId) {
      registry.votePointLookup(current.point_id, admin.districtId || admin.cityId || admin.provinceId);
    }
    const validObservations = observations.filter((observation) => {
      const taxonId = taxonIdForObservation(observation);
      if (Number(observation.is_red_species) || Number(observation.source_outside_type) === 1) {
        excludedInvalidDetections += 1;
        return false;
      }
      return Boolean(taxonId);
    });
    const taxonIds = [...new Set(validObservations.map(taxonIdForObservation))].sort();
    const observer = observerIdentity(current.raw_report_json, current.report_id);
    const spatialKey = r7?.id || admin.districtId || admin.cityId || admin.provinceId;
    const duplicateKey = stableHash(
      JSON.stringify([observer.known ? observer.hash : "unknown", current.start_time, spatialKey, taxonIds])
    );
    if (seenDuplicates.has(duplicateKey)) {
      duplicateReports += 1;
      return;
    }
    seenDuplicates.add(duplicateKey);
    if (observer.known) knownObserverReports += 1;
    const reportDate = new Date(`${dateText}T00:00:00Z`);
    const ageYears = Math.max(0, (cutoff - reportDate) / (365.2425 * 86400000));
    const baseWeight = 2 ** (-ageYears / options.recencyHalfLifeYears);
    const isRecent = reportDate >= localCutoff ? 1 : 0;
    const groupKey = observer.known
      ? stableHash(`${observer.hash}\u0000${dateText}\u0000${spatialKey}`)
      : stableHash(`anonymous\u0000${current.report_id}`);
    insertReport.run(
      current.report_id,
      current.report_kind,
      observer.hash,
      observer.known ? 1 : 0,
      groupKey,
      dateText,
      dateParts.year,
      seasonWeek(dateText),
      baseWeight,
      baseWeight,
      isRecent,
      admin.provinceId,
      admin.cityId,
      admin.districtId,
      r6?.id || null,
      r7?.id || null,
      pointUnitId
    );
    for (const observation of validObservations) {
      const taxonId = taxonIdForObservation(observation);
      insertTaxon.run(
        taxonId,
        String(observation.taxon_name || taxonId),
        String(observation.latinname || ""),
        String(observation.englishname || "")
      );
      insertDetection.run(current.report_id, taxonId);
    }
    insertedReports += 1;
  }

  const rows = source
    .prepare(
      `WITH saved AS (
         SELECT report_id, COUNT(*) AS saved_count,
                SUM(CASE WHEN COALESCE(is_red_species, 0) = 1 OR COALESCE(source_outside_type, 0) = 1
                         THEN 1 ELSE 0 END) AS bad_count
         FROM observations GROUP BY report_id
       )
       SELECT
         r.report_id, r.report_kind, r.start_time, r.city_name, r.district_name, r.point_name, r.point_id,
         r.longitude, r.latitude, r.location_metadata_fetched, r.raw_report_json,
         o.taxon_key, o.taxon_id, o.taxon_name, o.latinname, o.englishname,
         o.is_red_species, o.source_outside_type
       FROM reports r
       LEFT JOIN saved ON saved.report_id = r.report_id
       LEFT JOIN observations o ON o.report_id = r.report_id
       WHERE ${eligibleChecklistCondition("r", "saved")}
       ORDER BY r.report_id, o.raw_index, o.taxon_key`
    )
    .iterate();

  artifact.exec("BEGIN");
  try {
    for (const row of rows) {
      if (!current || current.report_id !== row.report_id) {
        flush();
        current = row;
        observations = [];
      }
      if (row.taxon_key != null) observations.push(row);
    }
    flush();
    artifact.exec("COMMIT");
  } catch (error) {
    artifact.exec("ROLLBACK");
    throw error;
  }
  registry.finalizeParents();
  artifact.exec(`
    CREATE INDEX IF NOT EXISTS idx_training_reports_group_key
    ON training_reports(group_key);

    UPDATE training_reports
    SET weight = base_weight / (
      SELECT COUNT(*) FROM training_reports grouped
      WHERE grouped.group_key = training_reports.group_key
    );
  `);
  return {
    registry,
    stats: {
      insertedReports,
      duplicateReports,
      excludedInvalidDetections,
      knownObserverReports,
      knownObserverCoverage: insertedReports ? knownObserverReports / insertedReports : 0
    }
  };
}

function analyzeOccurrenceEvents(artifact, options) {
  // training_detections is keyed by (report_id, taxon_id), while event
  // clustering must stream all 1.3M detections grouped by taxon. Without this
  // temporary covering index SQLite performs a large external sort on every
  // rebuild. The index disappears with the training table before publication.
  artifact.exec(`
    CREATE INDEX IF NOT EXISTS idx_training_detections_taxon_report
    ON training_detections(taxon_id, report_id)
  `);
  const insertSummary = artifact.prepare(`
    INSERT INTO training_taxon_event_summary
      (taxon_id, raw_positive_reports, independent_positive_count, independent_observer_count,
       effective_positive_units, event_count, support_year_count, dominant_event_share,
       event_dominated, single_support_year, vagrant_candidate, vagrant_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertEvent = artifact.prepare(`
    INSERT INTO occurrence_events
      (taxon_id, event_id, start_date, end_date, independent_positive_count,
       raw_positive_reports, observer_count, grid_r7_count, grid_r7_ids_json,
       base_training_weight, effective_training_weight, weight_multiplier)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateDetection = artifact.prepare(`
    UPDATE training_detections
    SET event_id = ?, detection_multiplier = ?
    WHERE report_id = ? AND taxon_id = ?
  `);
  const iterator = artifact.prepare(`
    SELECT detections.taxon_id, detections.report_id,
           reports.observer_hash, reports.report_date, reports.grid_r7_unit, reports.weight
    FROM training_detections detections
    JOIN training_reports reports ON reports.report_id = detections.report_id
    WHERE reports.grid_r7_unit IS NOT NULL
    ORDER BY detections.taxon_id
  `).iterate();
  const skippedWithoutGrid = Number(artifact.prepare(`
    SELECT COUNT(*) AS count
    FROM training_detections detections
    JOIN training_reports reports ON reports.report_id = detections.report_id
    WHERE reports.grid_r7_unit IS NULL
  `).get().count || 0);

  let currentTaxonId = null;
  let nodes = [];
  let analyzedTaxa = 0;
  let analyzedDetections = 0;
  let candidateTaxa = 0;
  let eventDominatedTaxa = 0;
  let singleSupportYearTaxa = 0;

  function flushTaxon() {
    if (!currentTaxonId || !nodes.length) return;
    const analysis = analyzeTaxonDetections(nodes, {
      maximumGapDays: options.vagrantEventGapDays,
      dominantEventShareThreshold: options.vagrantDominantEventShare,
      eventWeightCap: options.vagrantEventWeightCap
    });
    const effectivePositiveUnits = analysis.events.reduce(
      (sum, event) => sum + Number(event.effectiveTrainingWeight || 0),
      0
    );
    insertSummary.run(
      analysis.taxonId,
      analysis.rawPositiveCount,
      analysis.independentPositiveCount,
      analysis.independentObserverCount,
      effectivePositiveUnits,
      analysis.eventCount,
      analysis.supportYearCount,
      analysis.dominantEventShare,
      analysis.eventDominated ? 1 : 0,
      analysis.singleSupportYear ? 1 : 0,
      analysis.vagrantCandidate ? 1 : 0,
      analysis.classificationReason
    );
    analyzedTaxa += 1;
    analyzedDetections += analysis.rawPositiveCount;
    if (analysis.eventDominated) eventDominatedTaxa += 1;
    if (analysis.singleSupportYear) singleSupportYearTaxa += 1;
    if (!analysis.vagrantCandidate) return;
    candidateTaxa += 1;
    for (const event of analysis.events) {
      insertEvent.run(
        analysis.taxonId,
        event.eventId,
        event.startDate,
        event.endDate,
        event.independentCount,
        event.rawCount,
        event.observerCount,
        event.gridR7Count,
        JSON.stringify(event.gridR7Ids),
        event.baseTrainingWeight,
        event.effectiveTrainingWeight,
        event.weightMultiplier
      );
    }
    for (const adjustment of analysis.weightAdjustments) {
      updateDetection.run(
        adjustment.eventId,
        adjustment.weightMultiplier,
        adjustment.reportId,
        adjustment.taxonId
      );
    }
  }

  artifact.exec("BEGIN");
  try {
    for (const row of iterator) {
      if (currentTaxonId !== row.taxon_id) {
        flushTaxon();
        currentTaxonId = row.taxon_id;
        nodes = [];
      }
      nodes.push({
        taxonId: row.taxon_id,
        reportId: row.report_id,
        observerHash: row.observer_hash,
        reportDate: row.report_date,
        gridR7: row.grid_r7_unit,
        baseWeight: Number(row.weight)
      });
    }
    flushTaxon();
    artifact.exec("COMMIT");
  } catch (error) {
    artifact.exec("ROLLBACK");
    throw error;
  }
  return {
    analyzedTaxa,
    analyzedDetections,
    skippedWithoutGrid,
    candidateTaxa,
    eventDominatedTaxa,
    singleSupportYearTaxa,
    definition: {
      maximumGapDays: options.vagrantEventGapDays,
      neighborRing: 1,
      dominantEventShareThreshold: options.vagrantDominantEventShare,
      eventWeightCap: options.vagrantEventWeightCap,
      label: "偶发/追鸟聚集候选"
    }
  };
}

const LEVEL_COLUMNS = Object.freeze({
  province: "province_unit",
  city: "city_unit",
  district: "district_unit",
  grid_r6: "grid_r6_unit",
  grid_r7: "grid_r7_unit",
  point: "point_unit"
});

function jsonYearsExpression(column = "report_year") {
  return `'[' || GROUP_CONCAT(DISTINCT ${column}) || ']'`;
}

function aggregateUnitSummaries(artifact, options) {
  const summaries = new Map();
  for (const [level, column] of Object.entries(LEVEL_COLUMNS)) {
    const recentClause = level === "province" ? "" : "AND is_recent = 1";
    const rows = artifact
      .prepare(
        `SELECT ${column} AS unit_id,
                COUNT(*) AS checklist_count,
                COUNT(DISTINCT CASE WHEN observer_known = 1 THEN observer_hash END) AS observer_count,
                ${jsonYearsExpression()} AS support_years_json
         FROM training_reports
         WHERE ${column} IS NOT NULL ${recentClause}
         GROUP BY ${column}`
      )
      .all();
    for (const row of rows) {
      const threshold = options.unitThresholds[level] || { checklists: 1, observers: 1 };
      summaries.set(row.unit_id, {
        level,
        checklistCount: Number(row.checklist_count) || 0,
        observerCount: Number(row.observer_count) || 0,
        supportYearsJson: row.support_years_json || "[]",
        supported:
          Number(row.checklist_count) >= Number(threshold.checklists) &&
          Number(row.observer_count) >= Number(threshold.observers)
      });
    }
  }
  return summaries;
}

function insertSpaceUnits(artifact, registry, summaries) {
  const insert = artifact.prepare(
    `INSERT INTO space_units
       (id, level, code, name, parent_id, city_name, district_name,
        centroid_longitude, centroid_latitude, boundary_json,
        min_longitude, min_latitude, max_longitude, max_latitude,
        checklist_count, observer_count, support_years_json, supported)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const lookup = artifact.prepare(
    "INSERT OR REPLACE INTO location_lookup(lookup_type, lookup_key, space_unit_id) VALUES (?, ?, ?)"
  );
  const order = { province: 0, city: 1, district: 2, grid_r6: 3, grid_r7: 4, point: 5 };
  const units = [...registry.units.values()].sort(
    (left, right) => order[left.level] - order[right.level] || left.id.localeCompare(right.id)
  );
  artifact.exec("BEGIN");
  try {
    for (const unit of units) {
      const summary = summaries.get(unit.id) || {
        checklistCount: 0,
        observerCount: 0,
        supportYearsJson: "[]",
        supported: false
      };
      insert.run(
        unit.id,
        unit.level,
        unit.code,
        unit.name,
        unit.parentId || null,
        unit.cityName || "",
        unit.districtName || "",
        unit.centroidLongitude ?? null,
        unit.centroidLatitude ?? null,
        unit.boundary ? JSON.stringify(unit.boundary) : null,
        unit.minLongitude ?? null,
        unit.minLatitude ?? null,
        unit.maxLongitude ?? null,
        unit.maxLatitude ?? null,
        summary.checklistCount,
        summary.observerCount,
        summary.supportYearsJson,
        summary.supported ? 1 : 0
      );
      if (unit.level === "grid_r6" || unit.level === "grid_r7") lookup.run(unit.level, unit.code, unit.id);
    }
    for (const [pointId, unitId] of registry.locationLookups.entries()) {
      lookup.run("point_id", pointId, unitId);
    }
    artifact.exec("COMMIT");
  } catch (error) {
    artifact.exec("ROLLBACK");
    throw error;
  }
}

function insertTaxa(artifact) {
  artifact.exec(`
    INSERT INTO taxa
      (taxon_id, common_name, scientific_name, english_name,
       is_sensitive, positive_count, observer_count, raw_positive_reports,
       effective_positive_units, event_count, support_year_count, dominant_event_share,
       event_dominated, single_support_year, vagrant_candidate, vagrant_reason,
       calibration_scope)
    SELECT
      catalog.taxon_id,
      catalog.common_name,
      catalog.scientific_name,
      catalog.english_name,
      0,
      COALESCE(MAX(events.independent_positive_count),
               COUNT(DISTINCT CASE WHEN reports.observer_known = 1 THEN reports.group_key END)),
      COUNT(DISTINCT CASE WHEN reports.observer_known = 1 THEN reports.observer_hash END),
      COALESCE(MAX(events.raw_positive_reports), COUNT(*)),
      COALESCE(MAX(events.effective_positive_units), SUM(reports.weight)),
      COALESCE(MAX(events.event_count), 0),
      COALESCE(MAX(events.support_year_count), COUNT(DISTINCT reports.report_year)),
      COALESCE(MAX(events.dominant_event_share), 0),
      COALESCE(MAX(events.event_dominated), 0),
      COALESCE(MAX(events.single_support_year), CASE WHEN COUNT(DISTINCT reports.report_year) = 1 THEN 1 ELSE 0 END),
      COALESCE(MAX(events.vagrant_candidate), CASE WHEN COUNT(DISTINCT reports.report_year) = 1 THEN 1 ELSE 0 END),
      MAX(events.vagrant_reason),
      'none'
    FROM taxon_catalog catalog
    JOIN training_detections detections ON detections.taxon_id = catalog.taxon_id
    JOIN training_reports reports ON reports.report_id = detections.report_id
    LEFT JOIN training_taxon_event_summary events ON events.taxon_id = catalog.taxon_id
    GROUP BY catalog.taxon_id;
  `);
}

function aggregateTrainingStatistics(artifact) {
  // Statements cannot bind column names; create one aggregate statement per level.
  for (const [level, column] of Object.entries(LEVEL_COLUMNS)) {
    const recentClause = level === "province" ? "" : "AND reports.is_recent = 1";
    artifact.exec(`
      INSERT INTO checklist_exposure
        (space_unit_id, season_week, effective_checklists, raw_checklists,
         observer_count, support_years_json)
      SELECT reports.${column}, reports.season_week, SUM(reports.weight), COUNT(*),
              COUNT(DISTINCT CASE WHEN reports.observer_known = 1 THEN reports.observer_hash END),
              ${jsonYearsExpression("reports.report_year")}
      FROM training_reports reports
      JOIN space_units units ON units.id = reports.${column}
      WHERE reports.${column} IS NOT NULL ${recentClause}
      GROUP BY reports.${column}, reports.season_week;

      INSERT INTO taxon_detection
        (space_unit_id, season_week, taxon_id, effective_detections,
         raw_detections, observer_count, support_years_json)
      SELECT reports.${column}, reports.season_week, detections.taxon_id,
              SUM(reports.weight * detections.detection_multiplier), COUNT(*),
              COUNT(DISTINCT CASE WHEN reports.observer_known = 1 THEN reports.observer_hash END),
             ${jsonYearsExpression("reports.report_year")}
      FROM training_reports reports
      JOIN training_detections detections ON detections.report_id = reports.report_id
      JOIN space_units units ON units.id = reports.${column}
      WHERE reports.${column} IS NOT NULL ${recentClause}
      GROUP BY reports.${column}, reports.season_week, detections.taxon_id;
    `);
  }
}

function smoothWeekly(values, targetWeek, bandwidthDays) {
  const target = weekCenterDay(targetWeek);
  let total = 0;
  for (let week = 1; week <= 52; week += 1) {
    const difference = Math.abs(target - weekCenterDay(week));
    const distance = Math.min(difference, 365 - difference);
    if (distance > bandwidthDays * 3.5) continue;
    total += (Number(values[week]) || 0) * Math.exp(-0.5 * (distance / bandwidthDays) ** 2);
  }
  return total;
}

function weeklyArray(rows, valueColumn) {
  const values = Array(53).fill(0);
  for (const row of rows) values[Number(row.season_week)] = Number(row[valueColumn]) || 0;
  return values;
}

function calibrationGroup(positiveCount) {
  if (positiveCount < 30) return null;
  if (positiveCount < 60) return "positive_30_59";
  if (positiveCount < 120) return "positive_60_119";
  if (positiveCount < 200) return "positive_120_199";
  return null;
}

function discountedCumulativeGain(relevances, limit = 10) {
  return relevances.slice(0, limit).reduce(
    (sum, relevance, index) => sum + (2 ** Math.max(0, Number(relevance) || 0) - 1) / Math.log2(index + 2),
    0
  );
}

function evaluateTemporalMetrics({
  taxa,
  trainingExposure,
  validationExposure,
  trainingHits,
  validationHits,
  bandwidthDays,
  calibratorForTaxon = null
}) {
  const eligibleTaxa = taxa.filter((taxon) => Number(taxon.positive_count) >= 30);
  if (!eligibleTaxa.length) return null;
  const totalTrainingExposure = trainingExposure.slice(1).reduce((sum, value) => sum + Number(value || 0), 0);
  const predictionsByWeek = Array.from({ length: 53 }, () => []);
  const eceBins = Array.from({ length: 10 }, () => ({ predicted: 0, positives: 0, total: 0 }));
  let modelLoss = 0;
  let baselineLoss = 0;
  let evaluationWeight = 0;
  const reverseScores = [];

  for (const taxon of eligibleTaxa) {
    const hits = trainingHits.get(taxon.taxon_id) || Array(53).fill(0);
    const validation = validationHits.get(taxon.taxon_id) || Array(53).fill(0);
    const baselineProbability =
      (hits.slice(1).reduce((sum, value) => sum + Number(value || 0), 0) + 1) /
      (totalTrainingExposure + 2);
    const taxonWeeks = [];
    for (let week = 1; week <= 52; week += 1) {
      const total = Number(validationExposure[week]) || 0;
      if (total <= 0) continue;
      const exposure = smoothWeekly(trainingExposure, week, bandwidthDays);
      const positive = Math.min(exposure, smoothWeekly(hits, week, bandwidthDays));
      const rawProbability = (positive + 1) / (exposure + 2);
      const probability = calibrateProbability(
        rawProbability,
        typeof calibratorForTaxon === "function" ? calibratorForTaxon(taxon) : null
      );
      const actualPositive = Math.min(total, Number(validation[week]) || 0);
      modelLoss += actualPositive * (1 - probability) ** 2 + (total - actualPositive) * probability ** 2;
      baselineLoss +=
        actualPositive * (1 - baselineProbability) ** 2 +
        (total - actualPositive) * baselineProbability ** 2;
      evaluationWeight += total;
      const bin = eceBins[Math.min(9, Math.floor(probability * 10))];
      bin.predicted += probability * total;
      bin.positives += actualPositive;
      bin.total += total;
      predictionsByWeek[week].push({
        taxonId: taxon.taxon_id,
        probability,
        baselineProbability,
        actualPositive
      });
      taxonWeeks.push({
        week,
        probability,
        relevance: actualPositive / total
      });
    }
    const ideal = [...taxonWeeks].sort((left, right) => right.relevance - left.relevance);
    const predicted = [...taxonWeeks].sort(
      (left, right) => right.probability - left.probability || left.week - right.week
    );
    const baseline = [...taxonWeeks].sort((left, right) => left.week - right.week);
    const idealDcg = discountedCumulativeGain(ideal.map((row) => row.relevance));
    if (idealDcg > 0) {
      reverseScores.push({
        model: discountedCumulativeGain(predicted.map((row) => row.relevance)) / idealDcg,
        baseline: discountedCumulativeGain(baseline.map((row) => row.relevance)) / idealDcg
      });
    }
  }

  let recallHits = 0;
  let baselineRecallHits = 0;
  let recallActual = 0;
  for (let week = 1; week <= 52; week += 1) {
    const rows = predictionsByWeek[week];
    const actualTaxa = new Set(rows.filter((row) => row.actualPositive > 0).map((row) => row.taxonId));
    if (!actualTaxa.size) continue;
    const modelTop = new Set(
      [...rows]
        .sort((left, right) => right.probability - left.probability || left.taxonId.localeCompare(right.taxonId))
        .slice(0, 20)
        .map((row) => row.taxonId)
    );
    const baselineTop = new Set(
      [...rows]
        .sort(
          (left, right) =>
            right.baselineProbability - left.baselineProbability || left.taxonId.localeCompare(right.taxonId)
        )
        .slice(0, 20)
        .map((row) => row.taxonId)
    );
    for (const taxonId of actualTaxa) {
      if (modelTop.has(taxonId)) recallHits += 1;
      if (baselineTop.has(taxonId)) baselineRecallHits += 1;
    }
    recallActual += actualTaxa.size;
  }

  const brier = evaluationWeight ? modelLoss / evaluationWeight : null;
  const baselineBrier = evaluationWeight ? baselineLoss / evaluationWeight : null;
  const ece = evaluationWeight
    ? eceBins.reduce((sum, bin) => {
        if (!bin.total) return sum;
        return sum + (bin.total / evaluationWeight) * Math.abs(bin.predicted / bin.total - bin.positives / bin.total);
      }, 0)
    : null;
  const reverseNdcgAt10 = reverseScores.length
    ? reverseScores.reduce((sum, row) => sum + row.model, 0) / reverseScores.length
    : null;
  const baselineReverseNdcgAt10 = reverseScores.length
    ? reverseScores.reduce((sum, row) => sum + row.baseline, 0) / reverseScores.length
    : null;
  return {
    brier,
    baselineBrier,
    brierSkill:
      Number.isFinite(brier) && Number.isFinite(baselineBrier) && baselineBrier > 0
        ? 1 - brier / baselineBrier
        : null,
    ece,
    recallAt20: recallActual ? recallHits / recallActual : null,
    baselineRecallAt20: recallActual ? baselineRecallHits / recallActual : null,
    recallAt20Delta: recallActual ? (recallHits - baselineRecallHits) / recallActual : null,
    recallHits,
    baselineRecallHits,
    recallActual,
    calibrationBins: eceBins,
    reverseNdcgAt10,
    baselineReverseNdcgAt10,
    reverseNdcgLift:
      Number.isFinite(reverseNdcgAt10) &&
      Number.isFinite(baselineReverseNdcgAt10) &&
      baselineReverseNdcgAt10 > 0
        ? (reverseNdcgAt10 - baselineReverseNdcgAt10) / baselineReverseNdcgAt10
        : null,
    evaluatedWeight: evaluationWeight,
    evaluatedTaxa: eligibleTaxa.length
  };
}

function aggregateTemporalFoldMetrics(folds) {
  const common = aggregateHoldoutMetrics(folds);
  if (!common) return null;
  const calibratedFolds = folds.filter((fold) => fold.calibrationApplied && fold.metrics);
  const calibrationMetrics = calibratedFolds.length ? aggregateHoldoutMetrics(calibratedFolds) : common;
  const evaluated = folds.filter((fold) => fold.metrics && Number.isFinite(fold.metrics.evaluatedWeight));
  const reverseWeight = evaluated.reduce((sum, fold) => sum + Number(fold.metrics.evaluatedTaxa || 0), 0);
  const reverseNdcgAt10 = reverseWeight
    ? evaluated.reduce(
        (sum, fold) => sum + Number(fold.metrics.reverseNdcgAt10 || 0) * Number(fold.metrics.evaluatedTaxa || 0),
        0
      ) / reverseWeight
    : null;
  const baselineReverseNdcgAt10 = reverseWeight
    ? evaluated.reduce(
        (sum, fold) =>
          sum + Number(fold.metrics.baselineReverseNdcgAt10 || 0) * Number(fold.metrics.evaluatedTaxa || 0),
        0
      ) / reverseWeight
    : null;
  return {
    ...common,
    ece: calibrationMetrics.ece,
    calibrationBins: calibrationMetrics.calibrationBins,
    calibrationScopeBins: calibrationMetrics.calibrationScopeBins,
    calibrationEce: calibrationMetrics.calibrationEce,
    evaluationModel: evaluated[0]?.metrics?.evaluationModel || null,
    baselineModel: evaluated[0]?.metrics?.baselineModel || null,
    reverseNdcgAt10,
    baselineReverseNdcgAt10,
    reverseNdcgLift:
      Number.isFinite(reverseNdcgAt10) &&
      Number.isFinite(baselineReverseNdcgAt10) &&
      baselineReverseNdcgAt10 > 0
        ? (reverseNdcgAt10 - baselineReverseNdcgAt10) / baselineReverseNdcgAt10
        : null
  };
}

const HOLDOUT_LEVEL_COLUMNS = Object.freeze({
  province: "province_unit",
  city: "city_unit",
  district: "district_unit",
  grid_r6: "grid_r6_unit",
  grid_r7: "grid_r7_unit",
  point: "point_unit"
});

function prepareHoldoutTables(artifact) {
  artifact.exec(`
    CREATE TEMP TABLE IF NOT EXISTS evaluation_training_reports (
      report_id TEXT PRIMARY KEY,
      evaluation_weight REAL NOT NULL DEFAULT 1 CHECK (evaluation_weight > 0),
      local_recent INTEGER NOT NULL DEFAULT 1 CHECK (local_recent IN (0, 1))
    ) WITHOUT ROWID;
    CREATE TEMP TABLE IF NOT EXISTS evaluation_validation_reports (
      report_id TEXT PRIMARY KEY,
      evaluation_weight REAL NOT NULL DEFAULT 1 CHECK (evaluation_weight > 0),
      local_recent INTEGER NOT NULL DEFAULT 1 CHECK (local_recent IN (0, 1))
    ) WITHOUT ROWID;
    CREATE TEMP TABLE IF NOT EXISTS evaluation_outer_training_reports (
      report_id TEXT PRIMARY KEY,
      evaluation_weight REAL NOT NULL DEFAULT 1 CHECK (evaluation_weight > 0),
      local_recent INTEGER NOT NULL DEFAULT 1 CHECK (local_recent IN (0, 1))
    ) WITHOUT ROWID;
    CREATE TEMP TABLE IF NOT EXISTS evaluation_outer_validation_reports (
      report_id TEXT PRIMARY KEY,
      evaluation_weight REAL NOT NULL DEFAULT 1 CHECK (evaluation_weight > 0),
      local_recent INTEGER NOT NULL DEFAULT 1 CHECK (local_recent IN (0, 1))
    ) WITHOUT ROWID;
    CREATE TEMP TABLE IF NOT EXISTS evaluation_needed_units (
      level TEXT NOT NULL,
      unit_id TEXT NOT NULL,
      PRIMARY KEY (level, unit_id)
    ) WITHOUT ROWID;
    CREATE TEMP TABLE IF NOT EXISTS evaluation_excluded_r6 (
      unit_id TEXT PRIMARY KEY
    ) WITHOUT ROWID;
    CREATE TEMP TABLE IF NOT EXISTS evaluation_reserved_r6 (
      unit_id TEXT PRIMARY KEY
    ) WITHOUT ROWID;
    CREATE TEMP TABLE IF NOT EXISTS evaluation_validation_r6 (
      unit_id TEXT PRIMARY KEY
    ) WITHOUT ROWID;
    CREATE TEMP TABLE IF NOT EXISTS evaluation_holdout_observers (
      observer_hash TEXT PRIMARY KEY
    ) WITHOUT ROWID;
    CREATE TEMP TABLE IF NOT EXISTS evaluation_group_counts (
      split TEXT NOT NULL,
      group_key TEXT NOT NULL,
      report_count INTEGER NOT NULL CHECK (report_count > 0),
      PRIMARY KEY (split, group_key)
    ) WITHOUT ROWID;
  `);
}

function resetHoldoutTables(artifact) {
  artifact.exec(`
    DELETE FROM evaluation_training_reports;
    DELETE FROM evaluation_validation_reports;
    DELETE FROM evaluation_needed_units;
    DELETE FROM evaluation_excluded_r6;
    DELETE FROM evaluation_reserved_r6;
    DELETE FROM evaluation_validation_r6;
    DELETE FROM evaluation_holdout_observers;
    DELETE FROM evaluation_group_counts;
  `);
}

function populateSpatialHoldoutTables(artifact, {
  validationR6Units,
  excludedR6Units,
  reservedR6Units
}) {
  resetHoldoutTables(artifact);
  const insertExcluded = artifact.prepare("INSERT OR IGNORE INTO evaluation_excluded_r6(unit_id) VALUES (?)");
  const insertReserved = artifact.prepare("INSERT OR IGNORE INTO evaluation_reserved_r6(unit_id) VALUES (?)");
  const insertValidation = artifact.prepare("INSERT OR IGNORE INTO evaluation_validation_r6(unit_id) VALUES (?)");
  for (const unitId of [...new Set(excludedR6Units || [])].map(String).sort()) insertExcluded.run(unitId);
  for (const unitId of [...new Set(reservedR6Units || [])].map(String).sort()) insertReserved.run(unitId);
  for (const unitId of [...new Set(validationR6Units || [])].map(String).sort()) insertValidation.run(unitId);
  artifact.exec(`
    INSERT INTO evaluation_validation_reports(report_id, evaluation_weight, local_recent)
    SELECT reports.report_id, reports.weight, reports.is_recent
    FROM training_reports reports
    JOIN evaluation_validation_r6 validation ON validation.unit_id = reports.grid_r6_unit
    WHERE reports.is_recent = 1;
    INSERT INTO evaluation_training_reports(report_id, evaluation_weight, local_recent)
    SELECT reports.report_id, reports.weight, reports.is_recent
    FROM training_reports reports
    WHERE reports.grid_r6_unit IS NOT NULL
      AND NOT EXISTS (
         SELECT 1 FROM evaluation_excluded_r6 excluded WHERE excluded.unit_id = reports.grid_r6_unit
       )
      AND NOT EXISTS (
         SELECT 1 FROM evaluation_reserved_r6 reserved WHERE reserved.unit_id = reports.grid_r6_unit
       );
  `);
  const diagnostics = holdoutSelectionDiagnostics(artifact);
  const bufferLeakage = Number(
    artifact.prepare(`
      SELECT COUNT(*) AS count
      FROM training_reports reports
      JOIN evaluation_training_reports selected USING (report_id)
      JOIN evaluation_excluded_r6 excluded ON excluded.unit_id = reports.grid_r6_unit
    `).get().count
  ) || 0;
  const reservedLeakage = Number(
    artifact.prepare(`
      SELECT COUNT(*) AS count
      FROM training_reports reports
      JOIN evaluation_training_reports selected USING (report_id)
      JOIN evaluation_reserved_r6 reserved ON reserved.unit_id = reports.grid_r6_unit
    `).get().count
  ) || 0;
  return { ...diagnostics, bufferLeakage, reservedLeakage };
}

function collectDevelopmentPoolPositiveCounts(artifact, reservedUnitIds) {
  const reservedIds = [...new Set((reservedUnitIds || []).map(String))].sort();
  if (!reservedIds.length) {
    throw new PredictionBuildError(
      "SPATIAL_OOF_CACHE_SEALED_RESERVATION_MISSING",
      "development OOF 缓存必须显式排除冻结 split 中的全部 sealed buffer。"
    );
  }
  prepareHoldoutTables(artifact);
  resetHoldoutTables(artifact);
  try {
    const insertReserved = artifact.prepare("INSERT OR IGNORE INTO evaluation_reserved_r6(unit_id) VALUES (?)");
    for (const unitId of reservedIds) insertReserved.run(unitId);
    const storedReservedCount = Number(
      artifact.prepare("SELECT COUNT(*) AS count FROM evaluation_reserved_r6").get().count
    ) || 0;
    if (storedReservedCount !== reservedIds.length) {
      throw new PredictionBuildError(
        "SPATIAL_OOF_CACHE_SEALED_RESERVATION_INCOMPLETE",
        "development-pool 正例数聚合前未能完整恢复 sealed buffer 排除表。",
        { expected: reservedIds.length, actual: storedReservedCount }
      );
    }
    return new Map(
      artifact.prepare(`
        SELECT detections.taxon_id,
               COUNT(DISTINCT CASE WHEN reports.observer_known = 1 THEN reports.group_key END) AS positive_count
        FROM training_reports reports
        JOIN training_detections detections USING (report_id)
        WHERE reports.grid_r6_unit IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM evaluation_reserved_r6 reserved
            WHERE reserved.unit_id = reports.grid_r6_unit
          )
        GROUP BY detections.taxon_id
        ORDER BY detections.taxon_id
      `).all().map((row) => [String(row.taxon_id), Number(row.positive_count)])
    );
  } finally {
    resetHoldoutTables(artifact);
  }
}

function holdoutSelectionDiagnostics(artifact) {
  const reportOverlap = Number(
    artifact
      .prepare(
        `SELECT COUNT(*) AS count
         FROM evaluation_training_reports training
         JOIN evaluation_validation_reports validation USING (report_id)`
      )
      .get().count
  ) || 0;
  const observerOverlap = Number(
    artifact
      .prepare(
        `SELECT COUNT(*) AS count
         FROM (
           SELECT DISTINCT reports.observer_hash
           FROM training_reports reports
           JOIN evaluation_training_reports selected USING (report_id)
           WHERE reports.observer_known = 1
         ) training
         JOIN (
           SELECT DISTINCT reports.observer_hash
           FROM training_reports reports
           JOIN evaluation_validation_reports selected USING (report_id)
           WHERE reports.observer_known = 1
         ) validation USING (observer_hash)`
      )
      .get().count
  ) || 0;
  return {
    trainingReports: Number(artifact.prepare("SELECT COUNT(*) AS count FROM evaluation_training_reports").get().count) || 0,
    validationReports:
      Number(artifact.prepare("SELECT COUNT(*) AS count FROM evaluation_validation_reports").get().count) || 0,
    reportOverlap,
    observerOverlap
  };
}

function holdoutContextKey(row) {
  return [
    row.province_unit || "",
    row.city_unit || "",
    row.district_unit || "",
    row.grid_r6_unit || "",
    row.grid_r7_unit || "",
    row.point_unit || "",
    Number(row.season_week) || 0
  ].join("\u0000");
}

function evaluationProbability({
  context,
  taxonId,
  taxonPositiveCount,
  exposures,
  hits,
  supports,
  bandwidthDays,
  options,
  intervalMode = "none",
  smoothedCache = null,
  captureAdminEvidence = false
}) {
  const cachedSmooth = (cacheKey, values) => {
    if (!smoothedCache) return smoothWeekly(values, context.season_week, bandwidthDays);
    if (!smoothedCache.has(cacheKey)) {
      smoothedCache.set(cacheKey, smoothWeekly(values, context.season_week, bandwidthDays));
    }
    return smoothedCache.get(cacheKey);
  };
  const adminExposureCapsByPrevalence = options.novelGridAdminExposureCapsByPrevalence || null;
  const hasSupportedLocalUnit = ["grid_r6", "grid_r7", "point"].some((level) => {
    const unitId = context[HOLDOUT_LEVEL_COLUMNS[level]];
    const support = unitId ? supports.get(unitId) : null;
    const threshold = options.unitThresholds[level] || { checklists: 1, observers: 1 };
    return Boolean(
      support &&
      support.checklists >= Number(threshold.checklists) &&
      support.observers >= Number(threshold.observers)
    );
  });
  const applyAdminTransferCaps = Boolean(adminExposureCapsByPrevalence && !hasSupportedLocalUnit);
  const taxonPrevalenceGroup = prevalenceGroup(taxonPositiveCount);
  const adminEvidence = captureAdminEvidence
    ? {
        province: { exposure: 0, detections: 0, strength: 0 },
        city: { exposure: 0, detections: 0, strength: 0 },
        district: { exposure: 0, detections: 0, strength: 0 }
      }
    : null;
  let alpha = 1;
  let beta = 1;
  let baselineProbability = null;
  let baselineAlpha = null;
  let baselineBeta = null;
  let deepestLevel = "province";
  let deepestUnitId = context.province_unit || null;
  for (const [level, column] of Object.entries(HOLDOUT_LEVEL_COLUMNS)) {
    const unitId = context[column];
    if (!unitId) continue;
    const support = supports.get(unitId);
    const threshold = options.unitThresholds[level] || { checklists: 1, observers: 1 };
    if (
      !support ||
      support.checklists < Number(threshold.checklists) ||
      support.observers < Number(threshold.observers)
    ) {
      continue;
    }
    let exposure = cachedSmooth(
      `exposure\u0000${unitId}\u0000${context.season_week}\u0000${bandwidthDays}`,
      exposures.get(unitId) || Array(53).fill(0)
    );
    let detections = Math.min(
      exposure,
      cachedSmooth(
        `detection\u0000${unitId}\u0000${taxonId}\u0000${context.season_week}\u0000${bandwidthDays}`,
        hits.get(`${unitId}\u0000${taxonId}`) || Array(53).fill(0)
      )
    );
    if (adminEvidence && (level === "province" || level === "city" || level === "district")) {
      adminEvidence[level] = {
        exposure,
        detections,
        strength: level === "province"
          ? 0
          : resolvePriorStrength(
              options.priorStrengths,
              options.priorStrengthsByPrevalence,
              level,
              taxonPositiveCount
            )
      };
    }
    if (applyAdminTransferCaps && (level === "city" || level === "district")) {
      const cap = adminCapForTaxon(adminExposureCapsByPrevalence, taxonPrevalenceGroup, level);
      const capped = capEffectiveEvidence(exposure, detections, cap);
      exposure = capped.exposure;
      detections = capped.detections;
    }
    if (exposure <= 0) continue;
    if (level === "province") {
      alpha = 1 + detections;
      beta = 1 + Math.max(0, exposure - detections);
      baselineProbability = alpha / (alpha + beta);
      baselineAlpha = alpha;
      baselineBeta = beta;
      deepestLevel = level;
      deepestUnitId = unitId;
      continue;
    }
    const parentProbability = alpha / (alpha + beta);
    const strength = resolvePriorStrength(
      options.priorStrengths,
      options.priorStrengthsByPrevalence,
      level,
      taxonPositiveCount
    );
    alpha = parentProbability * strength + detections;
    beta = (1 - parentProbability) * strength + Math.max(0, exposure - detections);
    deepestLevel = level;
    deepestUnitId = unitId;
  }
  const probability = alpha / (alpha + beta);
  let intervalLower = probability;
  let intervalUpper = probability;
  let baselineIntervalLower = baselineProbability ?? probability;
  let baselineIntervalUpper = baselineProbability ?? probability;
  if (intervalMode === "lower") {
    intervalLower = betaQuantile(0.05, alpha, beta);
    baselineIntervalLower = betaQuantile(0.05, baselineAlpha ?? alpha, baselineBeta ?? beta);
  } else if (intervalMode === "full") {
    const interval = betaInterval(alpha, beta, 0.9);
    const baselineInterval = betaInterval(baselineAlpha ?? alpha, baselineBeta ?? beta, 0.9);
    intervalLower = interval.lower;
    intervalUpper = interval.upper;
    baselineIntervalLower = baselineInterval.lower;
    baselineIntervalUpper = baselineInterval.upper;
  }
  return {
    probability,
    baselineProbability: baselineProbability ?? probability,
    intervalLower,
    intervalUpper,
    baselineIntervalLower,
    baselineIntervalUpper,
    deepestLevel,
    deepestUnitId,
    hasSupportedLocalUnit,
    adminEvidence
  };
}

function emptyEceBins() {
  return Array.from({ length: 10 }, () => ({ predicted: 0, positives: 0, total: 0 }));
}

function addEceObservation(bins, probability, positives, total) {
  const bin = bins[Math.min(9, Math.floor(Math.max(0, Math.min(0.999999999, probability)) * 10))];
  bin.predicted += probability * total;
  bin.positives += positives;
  bin.total += total;
}

function eceFromBins(bins) {
  const total = (bins || []).reduce((sum, bin) => sum + Number(bin.total || 0), 0);
  if (total <= 0) return null;
  return bins.reduce((sum, bin) => {
    if (!bin.total) return sum;
    return sum + (bin.total / total) * Math.abs(bin.predicted / bin.total - bin.positives / bin.total);
  }, 0);
}

function serializeCalibrationScopeBins(scopeBins) {
  return {
    species: Object.fromEntries(scopeBins.species),
    group: Object.fromEntries(scopeBins.group)
  };
}

function summarizeCalibrationScopeBins(serialized) {
  const summarize = (entries) => {
    const scopes = Object.entries(entries || {})
      .map(([scopeId, bins]) => ({ scopeId, ece: eceFromBins(bins) }))
      .filter((entry) => Number.isFinite(entry.ece))
      .sort((left, right) => right.ece - left.ece || left.scopeId.localeCompare(right.scopeId));
    return {
      scopeCount: scopes.length,
      maximumEce: scopes[0]?.ece ?? null,
      worstScopeId: scopes[0]?.scopeId ?? null,
      scopes
    };
  };
  return {
    species: summarize(serialized?.species),
    group: summarize(serialized?.group)
  };
}

function evaluatePreparedHoldoutDetails(artifact, bandwidthDays, options, evaluationOptions = {}) {
  const calibrationPoints = new Map();
  const collectAdminCapTasks = Boolean(evaluationOptions.collectAdminCapTasks);
  const collectScoreRows = Boolean(evaluationOptions.collectScoreRows);
  const adminCapTasksByPrevalence = new Map();
  const scoreRows = [];
  const contextSampleModulo = Math.max(1, Number(evaluationOptions.contextSampleModulo) || 1);
  const validationRows = artifact
    .prepare(
      `SELECT reports.province_unit, reports.city_unit, reports.district_unit, reports.grid_r6_unit,
              reports.grid_r7_unit, reports.point_unit,
              reports.season_week, SUM(selected.evaluation_weight) AS exposure
       FROM training_reports reports
       JOIN evaluation_validation_reports selected USING (report_id)
       GROUP BY reports.province_unit, reports.city_unit, reports.district_unit,
                 reports.grid_r6_unit, reports.grid_r7_unit, reports.point_unit, reports.season_week
       ORDER BY reports.province_unit, reports.city_unit, reports.district_unit,
                reports.grid_r6_unit, reports.grid_r7_unit, reports.point_unit, reports.season_week`
    )
    .all();
  if (!validationRows.length) return { metrics: null, calibrationPoints, scoreRows, adminCapTasksByPrevalence };

  const contexts = new Map();
  const insertNeededUnit = artifact.prepare(
    "INSERT OR IGNORE INTO evaluation_needed_units(level, unit_id) VALUES (?, ?)"
  );
  artifact.exec("DELETE FROM evaluation_needed_units");
  const preparedContexts = validationRows.map((row) => {
    const context = {
      province_unit: row.province_unit,
      city_unit: row.city_unit,
      district_unit: row.district_unit,
      grid_r6_unit: row.grid_r6_unit,
      grid_r7_unit: row.grid_r7_unit,
      point_unit: row.point_unit,
      season_week: Number(row.season_week),
      exposure: Number(row.exposure) || 0,
      hits: new Map()
    };
    const contextKey = holdoutContextKey(context);
    return { context, contextKey, sampleHash: stableHash(contextKey) };
  });
  let sampledContexts = preparedContexts.filter(({ sampleHash }) =>
    !(
      contextSampleModulo > 1 &&
      Number.parseInt(sampleHash.slice(0, 8), 16) % contextSampleModulo !== 0
    )
  );
  if (!sampledContexts.length && preparedContexts.length) {
    sampledContexts = [[...preparedContexts].sort(
      (left, right) => left.sampleHash.localeCompare(right.sampleHash) || left.contextKey.localeCompare(right.contextKey)
    )[0]];
  }
  for (const { context, contextKey } of sampledContexts) {
    contexts.set(contextKey, context);
    for (const [level, column] of Object.entries(HOLDOUT_LEVEL_COLUMNS)) {
      if (context[column]) insertNeededUnit.run(level, context[column]);
    }
  }

  for (const row of artifact
    .prepare(
      `SELECT reports.province_unit, reports.city_unit, reports.district_unit, reports.grid_r6_unit,
              reports.grid_r7_unit, reports.point_unit,
              reports.season_week, detections.taxon_id,
              SUM(selected.evaluation_weight) AS positives
       FROM training_reports reports
       JOIN evaluation_validation_reports selected USING (report_id)
       JOIN training_detections detections USING (report_id)
       GROUP BY reports.province_unit, reports.city_unit, reports.district_unit,
                 reports.grid_r6_unit, reports.grid_r7_unit, reports.point_unit,
                 reports.season_week, detections.taxon_id
       ORDER BY reports.province_unit, reports.city_unit, reports.district_unit,
                reports.grid_r6_unit, reports.grid_r7_unit, reports.point_unit,
                reports.season_week, detections.taxon_id`
    )
    .iterate()) {
    const context = contexts.get(holdoutContextKey(row));
    if (context) context.hits.set(row.taxon_id, Number(row.positives) || 0);
  }

  const minimumTaxonPositives = Number(options.holdoutEvaluation.minimumTaxonPositives) || 1;
  const eligibleTaxa = artifact
    .prepare(
      `SELECT detections.taxon_id,
              COUNT(DISTINCT CASE WHEN reports.observer_known = 1 THEN reports.group_key END) AS positive_count
       FROM training_reports reports
       JOIN evaluation_training_reports selected USING (report_id)
       JOIN training_detections detections USING (report_id)
       GROUP BY detections.taxon_id
       HAVING COUNT(DISTINCT CASE WHEN reports.observer_known = 1 THEN reports.group_key END) >= ?
       ORDER BY detections.taxon_id`
    )
    .all(minimumTaxonPositives)
    .map((row) => ({
      taxon_id: String(row.taxon_id),
      positive_count: Number(row.positive_count) || 0
    }));
  if (!eligibleTaxa.length) return { metrics: null, calibrationPoints, scoreRows, adminCapTasksByPrevalence };

  const exposures = new Map();
  const hits = new Map();
  const supports = new Map();
  for (const [level, column] of Object.entries(HOLDOUT_LEVEL_COLUMNS)) {
    const recentClause = level === "province" ? "" : "AND selected.local_recent = 1";
    for (const row of artifact
      .prepare(
        `SELECT reports.${column} AS unit_id, reports.season_week,
                SUM(selected.evaluation_weight) AS exposure
         FROM training_reports reports
         JOIN evaluation_training_reports selected USING (report_id)
         JOIN evaluation_needed_units needed
           ON needed.level = ? AND needed.unit_id = reports.${column}
         WHERE reports.${column} IS NOT NULL ${recentClause}
         GROUP BY reports.${column}, reports.season_week`
      )
      .iterate(level)) {
      if (!exposures.has(row.unit_id)) exposures.set(row.unit_id, Array(53).fill(0));
      exposures.get(row.unit_id)[Number(row.season_week)] = Number(row.exposure) || 0;
    }
    for (const row of artifact
      .prepare(
        `SELECT reports.${column} AS unit_id, COUNT(*) AS checklist_count,
                COUNT(DISTINCT CASE WHEN reports.observer_known = 1 THEN reports.observer_hash END) AS observer_count
         FROM training_reports reports
         JOIN evaluation_training_reports selected USING (report_id)
         JOIN evaluation_needed_units needed
           ON needed.level = ? AND needed.unit_id = reports.${column}
         WHERE reports.${column} IS NOT NULL ${recentClause}
         GROUP BY reports.${column}`
      )
      .iterate(level)) {
      supports.set(row.unit_id, {
        checklists: Number(row.checklist_count) || 0,
        observers: Number(row.observer_count) || 0
      });
    }
    for (const row of artifact
      .prepare(
        `SELECT reports.${column} AS unit_id, reports.season_week, detections.taxon_id,
                SUM(selected.evaluation_weight) AS positives
         FROM training_reports reports
         JOIN evaluation_training_reports selected USING (report_id)
         JOIN evaluation_needed_units needed
           ON needed.level = ? AND needed.unit_id = reports.${column}
         JOIN training_detections detections USING (report_id)
         WHERE reports.${column} IS NOT NULL ${recentClause}
         GROUP BY reports.${column}, reports.season_week, detections.taxon_id`
      )
      .iterate(level)) {
      const key = `${row.unit_id}\u0000${row.taxon_id}`;
      if (!hits.has(key)) hits.set(key, Array(53).fill(0));
      hits.get(key)[Number(row.season_week)] = Number(row.positives) || 0;
    }
  }

  const eceBins = emptyEceBins();
  const calibrationScopeBins = { species: new Map(), group: new Map() };
  const prevalenceLosses = new Map(PREVALENCE_GROUPS.map((group) => [group, {
    modelLoss: 0,
    baselineLoss: 0,
    evaluatedWeight: 0
  }]));
  let modelLoss = 0;
  let baselineLoss = 0;
  let evaluatedWeight = 0;
  let recallHits = 0;
  let baselineRecallHits = 0;
  let recallActual = 0;
  const fallbackLevels = new Map();
  let contextIndex = 0;
  for (const context of contexts.values()) {
    const currentContextIndex = contextIndex++;
    if (context.exposure <= 0) continue;
    const rows = [];
    for (const taxon of eligibleTaxa) {
      const taxonId = taxon.taxon_id;
      const rawScore = evaluationProbability({
        context,
        taxonId,
        taxonPositiveCount: taxon.positive_count,
        exposures,
        hits,
        supports,
        bandwidthDays,
        options,
        captureAdminEvidence: collectAdminCapTasks
      });
      const calibrator = typeof evaluationOptions.calibratorForTaxon === "function"
        ? evaluationOptions.calibratorForTaxon(taxon)
        : null;
      const probability = calibrateProbability(rawScore.probability, calibrator);
      const actualPositive = Math.min(context.exposure, Number(context.hits.get(taxonId)) || 0);
      if (collectScoreRows) {
        scoreRows.push({
          contextIndex: currentContextIndex,
          taxonId,
          positiveCount: taxon.positive_count,
          actualPositive,
          total: context.exposure,
          rawProbability: rawScore.probability,
          baselineProbability: rawScore.baselineProbability,
          deepestLevel: rawScore.deepestLevel,
          hasSupportedLocalUnit: rawScore.hasSupportedLocalUnit,
          ...(collectAdminCapTasks ? { adminEvidence: rawScore.adminEvidence } : {})
        });
      }
      if (collectAdminCapTasks && !rawScore.hasSupportedLocalUnit) {
        const group = prevalenceGroup(taxon.positive_count);
        if (!adminCapTasksByPrevalence.has(group)) adminCapTasksByPrevalence.set(group, []);
        const values = adminCapTasksByPrevalence.get(group);
        const evidence = rawScore.adminEvidence;
        values.push(
          actualPositive,
          context.exposure,
          evidence.province.exposure,
          evidence.province.detections,
          evidence.city.exposure,
          evidence.city.detections,
          evidence.city.strength,
          evidence.district.exposure,
          evidence.district.detections,
          evidence.district.strength
        );
      }
      modelLoss +=
        actualPositive * (1 - probability) ** 2 +
        (context.exposure - actualPositive) * probability ** 2;
      baselineLoss +=
        actualPositive * (1 - rawScore.baselineProbability) ** 2 +
        (context.exposure - actualPositive) * rawScore.baselineProbability ** 2;
      evaluatedWeight += context.exposure;
      addEceObservation(eceBins, probability, actualPositive, context.exposure);
      if (Number(taxon.positive_count) >= 30) {
        const scopeType = Number(taxon.positive_count) >= 200 ? "species" : "group";
        const scopeId = scopeType === "species" ? taxonId : calibrationGroup(taxon.positive_count);
        if (!calibrationScopeBins[scopeType].has(scopeId)) {
          calibrationScopeBins[scopeType].set(scopeId, emptyEceBins());
        }
        addEceObservation(
          calibrationScopeBins[scopeType].get(scopeId),
          probability,
          actualPositive,
          context.exposure
        );
      }
      const prevalence = prevalenceLosses.get(prevalenceGroup(taxon.positive_count));
      prevalence.modelLoss +=
        actualPositive * (1 - probability) ** 2 +
        (context.exposure - actualPositive) * probability ** 2;
      prevalence.baselineLoss +=
        actualPositive * (1 - rawScore.baselineProbability) ** 2 +
        (context.exposure - actualPositive) * rawScore.baselineProbability ** 2;
      prevalence.evaluatedWeight += context.exposure;
      fallbackLevels.set(rawScore.deepestLevel, (fallbackLevels.get(rawScore.deepestLevel) || 0) + 1);
      if (evaluationOptions.collectCalibrationPoints) {
        if (!calibrationPoints.has(taxonId)) calibrationPoints.set(taxonId, []);
        calibrationPoints.get(taxonId).push({
          probability: rawScore.probability,
          positives: actualPositive,
          total: context.exposure
        });
      }
      rows.push({
        taxonId,
        actualPositive,
        probability,
        baselineProbability: rawScore.baselineProbability
      });
    }
    const actualTaxa = rows.filter((row) => row.actualPositive > 0);
    if (!actualTaxa.length) continue;
    const modelTop = new Set(
      [...rows]
        .sort((left, right) => right.probability - left.probability || left.taxonId.localeCompare(right.taxonId))
        .slice(0, 20)
        .map((row) => row.taxonId)
    );
    const baselineTop = new Set(
      [...rows]
        .sort(
          (left, right) =>
            right.baselineProbability - left.baselineProbability || left.taxonId.localeCompare(right.taxonId)
        )
        .slice(0, 20)
        .map((row) => row.taxonId)
    );
    for (const row of actualTaxa) {
      if (modelTop.has(row.taxonId)) recallHits += 1;
      if (baselineTop.has(row.taxonId)) baselineRecallHits += 1;
    }
    recallActual += actualTaxa.length;
  }
  if (!evaluatedWeight) return { metrics: null, calibrationPoints, scoreRows, adminCapTasksByPrevalence };
  const brier = modelLoss / evaluatedWeight;
  const baselineBrier = baselineLoss / evaluatedWeight;
  const ece = eceBins.reduce((sum, bin) => {
    if (!bin.total) return sum;
    return sum + (bin.total / evaluatedWeight) * Math.abs(bin.predicted / bin.total - bin.positives / bin.total);
  }, 0);
  const serializedCalibrationScopeBins = serializeCalibrationScopeBins(calibrationScopeBins);
  const calibrationEce = summarizeCalibrationScopeBins(serializedCalibrationScopeBins);
  const prevalenceMetrics = Object.fromEntries(
    [...prevalenceLosses].map(([group, values]) => [group, {
      brier: values.evaluatedWeight > 0 ? values.modelLoss / values.evaluatedWeight : null,
      baselineBrier: values.evaluatedWeight > 0 ? values.baselineLoss / values.evaluatedWeight : null,
      evaluatedWeight: values.evaluatedWeight
    }])
  );
  let reverseNdcgAt10 = null;
  let baselineReverseNdcgAt10 = null;
  let reverseNdcgLift = null;
  if (evaluationOptions.includeReverseNdcg) {
    const reverseContexts = new Map();
    for (const context of contexts.values()) {
      const gridUnitId = context.grid_r7_unit || context.grid_r6_unit;
      if (!gridUnitId || context.exposure <= 0) continue;
      const key = `${gridUnitId}\u0000${context.season_week}`;
      if (!reverseContexts.has(key)) {
        reverseContexts.set(key, {
          province_unit: context.province_unit,
          city_unit: context.city_unit,
          district_unit: context.district_unit,
          grid_r6_unit: context.grid_r6_unit,
          grid_r7_unit: context.grid_r7_unit || null,
          point_unit: null,
          season_week: context.season_week,
          exposure: 0,
          hits: new Map()
        });
      }
      const reverseContext = reverseContexts.get(key);
      reverseContext.exposure += context.exposure;
      for (const [taxonId, positives] of context.hits) {
        reverseContext.hits.set(taxonId, (reverseContext.hits.get(taxonId) || 0) + Number(positives || 0));
      }
    }
    const scores = [];
    for (const taxon of eligibleTaxa) {
      const candidateMap = new Map();
      const calibrator = typeof evaluationOptions.calibratorForTaxon === "function"
        ? evaluationOptions.calibratorForTaxon(taxon)
        : null;
      for (const context of reverseContexts.values()) {
        const rawScore = evaluationProbability({
          context,
          taxonId: taxon.taxon_id,
          taxonPositiveCount: taxon.positive_count,
          exposures,
          hits,
          supports,
          bandwidthDays,
          options,
          intervalMode: "lower"
        });
        const actualPositive = Math.min(context.exposure, Number(context.hits.get(taxon.taxon_id)) || 0);
        const candidateKey = `${rawScore.deepestUnitId || context.province_unit}\u0000${context.season_week}`;
        if (!candidateMap.has(candidateKey)) {
          candidateMap.set(candidateKey, {
            positives: 0,
            exposure: 0,
            modelRank: calibrateProbability(rawScore.intervalLower, calibrator),
            baselineRank: rawScore.baselineIntervalLower
          });
        }
        const candidate = candidateMap.get(candidateKey);
        candidate.positives += actualPositive;
        candidate.exposure += context.exposure;
      }
      const candidates = [...candidateMap.values()].map((candidate) => ({
        ...candidate,
        relevance: candidate.exposure > 0 ? candidate.positives / candidate.exposure : 0
      }));
      const idealDcg = discountedCumulativeGain(
        [...candidates].sort((left, right) => right.relevance - left.relevance).map((row) => row.relevance)
      );
      if (idealDcg <= 0) continue;
      const modelDcg = discountedCumulativeGain(
        [...candidates].sort((left, right) => right.modelRank - left.modelRank).map((row) => row.relevance)
      );
      const baselineDcg = discountedCumulativeGain(
        [...candidates].sort((left, right) => right.baselineRank - left.baselineRank).map((row) => row.relevance)
      );
      scores.push({ model: modelDcg / idealDcg, baseline: baselineDcg / idealDcg });
    }
    if (scores.length) {
      reverseNdcgAt10 = scores.reduce((sum, row) => sum + row.model, 0) / scores.length;
      baselineReverseNdcgAt10 = scores.reduce((sum, row) => sum + row.baseline, 0) / scores.length;
      reverseNdcgLift = baselineReverseNdcgAt10 > 0
        ? (reverseNdcgAt10 - baselineReverseNdcgAt10) / baselineReverseNdcgAt10
        : null;
    }
  }
  return { metrics: {
    brier,
    baselineBrier,
    brierSkill: baselineBrier > 0 ? 1 - brier / baselineBrier : null,
    ece,
    recallAt20: recallActual ? recallHits / recallActual : null,
    baselineRecallAt20: recallActual ? baselineRecallHits / recallActual : null,
    recallAt20Delta: recallActual ? (recallHits - baselineRecallHits) / recallActual : null,
    recallHits,
    baselineRecallHits,
    recallActual,
    calibrationBins: eceBins,
    calibrationScopeBins: serializedCalibrationScopeBins,
    calibrationEce,
    prevalenceMetrics,
    reverseNdcgAt10,
    baselineReverseNdcgAt10,
    reverseNdcgLift,
    evaluatedWeight,
    evaluatedTaxa: eligibleTaxa.length,
    validationContexts: contexts.size,
    fallbackLevels: Object.fromEntries([...fallbackLevels.entries()].sort()),
    evaluationModel: "hierarchical_spatiotemporal_oof",
    baselineModel: "province_week"
  }, calibrationPoints, scoreRows, adminCapTasksByPrevalence };
}

function evaluatePreparedHoldout(artifact, bandwidthDays, options) {
  return evaluatePreparedHoldoutDetails(artifact, bandwidthDays, options).metrics;
}

function evaluateCachedSpatialRows(scoreRows, calibratorForRow = null) {
  if (!scoreRows?.length) return null;
  const eceBins = emptyEceBins();
  const calibrationScopeBins = { species: new Map(), group: new Map() };
  const prevalenceLosses = new Map(PREVALENCE_GROUPS.map((group) => [group, {
    modelLoss: 0,
    baselineLoss: 0,
    evaluatedWeight: 0
  }]));
  const fallbackLevels = new Map();
  const rowsByContext = new Map();
  const evaluatedTaxa = new Set();
  let modelLoss = 0;
  let baselineLoss = 0;
  let evaluatedWeight = 0;
  for (const row of scoreRows) {
    const calibrator = typeof calibratorForRow === "function" ? calibratorForRow(row) : null;
    const probability = calibrateProbability(row.rawProbability, calibrator);
    row.cachedProbability = probability;
    const actualPositive = Number(row.actualPositive) || 0;
    const total = Number(row.total) || 0;
    const rowModelLoss = actualPositive * (1 - probability) ** 2 + (total - actualPositive) * probability ** 2;
    const rowBaselineLoss =
      actualPositive * (1 - row.baselineProbability) ** 2 +
      (total - actualPositive) * row.baselineProbability ** 2;
    modelLoss += rowModelLoss;
    baselineLoss += rowBaselineLoss;
    evaluatedWeight += total;
    evaluatedTaxa.add(row.taxonId);
    addEceObservation(eceBins, probability, actualPositive, total);
    if (Number(row.positiveCount) >= 30) {
      const scopeType = Number(row.positiveCount) >= 200 ? "species" : "group";
      const scopeId = scopeType === "species" ? row.taxonId : calibrationGroup(row.positiveCount);
      if (!calibrationScopeBins[scopeType].has(scopeId)) {
        calibrationScopeBins[scopeType].set(scopeId, emptyEceBins());
      }
      addEceObservation(calibrationScopeBins[scopeType].get(scopeId), probability, actualPositive, total);
    }
    const prevalence = prevalenceLosses.get(prevalenceGroup(row.positiveCount));
    prevalence.modelLoss += rowModelLoss;
    prevalence.baselineLoss += rowBaselineLoss;
    prevalence.evaluatedWeight += total;
    fallbackLevels.set(row.deepestLevel, (fallbackLevels.get(row.deepestLevel) || 0) + 1);
    if (!rowsByContext.has(row.contextIndex)) rowsByContext.set(row.contextIndex, []);
    rowsByContext.get(row.contextIndex).push(row);
  }
  let recallHits = 0;
  let baselineRecallHits = 0;
  let recallActual = 0;
  for (const rows of rowsByContext.values()) {
    const actualTaxa = rows.filter((row) => Number(row.actualPositive) > 0);
    if (!actualTaxa.length) continue;
    const modelTop = new Set(
      [...rows]
        .sort((left, right) =>
          right.cachedProbability - left.cachedProbability || left.taxonId.localeCompare(right.taxonId)
        )
        .slice(0, 20)
        .map((row) => row.taxonId)
    );
    const baselineTop = new Set(
      [...rows]
        .sort((left, right) =>
          right.baselineProbability - left.baselineProbability || left.taxonId.localeCompare(right.taxonId)
        )
        .slice(0, 20)
        .map((row) => row.taxonId)
    );
    for (const row of actualTaxa) {
      if (modelTop.has(row.taxonId)) recallHits += 1;
      if (baselineTop.has(row.taxonId)) baselineRecallHits += 1;
    }
    recallActual += actualTaxa.length;
  }
  for (const row of scoreRows) delete row.cachedProbability;
  const brier = modelLoss / evaluatedWeight;
  const baselineBrier = baselineLoss / evaluatedWeight;
  const serializedCalibrationScopeBins = serializeCalibrationScopeBins(calibrationScopeBins);
  return {
    brier,
    baselineBrier,
    brierSkill: baselineBrier > 0 ? 1 - brier / baselineBrier : null,
    ece: eceFromBins(eceBins),
    recallAt20: recallActual ? recallHits / recallActual : null,
    baselineRecallAt20: recallActual ? baselineRecallHits / recallActual : null,
    recallAt20Delta: recallActual ? (recallHits - baselineRecallHits) / recallActual : null,
    recallHits,
    baselineRecallHits,
    recallActual,
    calibrationBins: eceBins,
    calibrationScopeBins: serializedCalibrationScopeBins,
    calibrationEce: summarizeCalibrationScopeBins(serializedCalibrationScopeBins),
    prevalenceMetrics: Object.fromEntries(
      [...prevalenceLosses].map(([group, values]) => [group, {
        brier: values.evaluatedWeight > 0 ? values.modelLoss / values.evaluatedWeight : null,
        baselineBrier: values.evaluatedWeight > 0 ? values.baselineLoss / values.evaluatedWeight : null,
        evaluatedWeight: values.evaluatedWeight
      }])
    ),
    reverseNdcgAt10: null,
    baselineReverseNdcgAt10: null,
    reverseNdcgLift: null,
    evaluatedWeight,
    evaluatedTaxa: evaluatedTaxa.size,
    validationContexts: rowsByContext.size,
    fallbackLevels: Object.fromEntries([...fallbackLevels.entries()].sort()),
    evaluationModel: "novel_grid_admin_capped_spatial_oof",
    baselineModel: "province_week"
  };
}

function aggregateHoldoutMetrics(folds) {
  const evaluated = folds.filter((fold) => fold.metrics && Number.isFinite(fold.metrics.evaluatedWeight));
  const totalWeight = evaluated.reduce((sum, fold) => sum + fold.metrics.evaluatedWeight, 0);
  if (!evaluated.length || totalWeight <= 0) return null;
  const brier = evaluated.reduce((sum, fold) => sum + fold.metrics.brier * fold.metrics.evaluatedWeight, 0) / totalWeight;
  const baselineBrier =
    evaluated.reduce((sum, fold) => sum + fold.metrics.baselineBrier * fold.metrics.evaluatedWeight, 0) /
    totalWeight;
  const recallHits = evaluated.reduce((sum, fold) => sum + Number(fold.metrics.recallHits || 0), 0);
  const baselineRecallHits = evaluated.reduce(
    (sum, fold) => sum + Number(fold.metrics.baselineRecallHits || 0),
    0
  );
  const recallActual = evaluated.reduce((sum, fold) => sum + Number(fold.metrics.recallActual || 0), 0);
  const calibrationBins = Array.from({ length: 10 }, () => ({ predicted: 0, positives: 0, total: 0 }));
  const calibrationScopeBins = { species: {}, group: {} };
  const fallbackLevels = {};
  let validationContexts = 0;
  const prevalenceTotals = new Map(PREVALENCE_GROUPS.map((group) => [group, {
    modelLoss: 0,
    baselineLoss: 0,
    evaluatedWeight: 0
  }]));
  for (const fold of evaluated) {
    validationContexts += Number(fold.metrics.validationContexts) || 0;
    for (const [level, count] of Object.entries(fold.metrics.fallbackLevels || {})) {
      fallbackLevels[level] = (fallbackLevels[level] || 0) + (Number(count) || 0);
    }
    for (let index = 0; index < calibrationBins.length; index += 1) {
      const source = fold.metrics.calibrationBins?.[index];
      if (!source) continue;
      calibrationBins[index].predicted += Number(source.predicted) || 0;
      calibrationBins[index].positives += Number(source.positives) || 0;
      calibrationBins[index].total += Number(source.total) || 0;
    }
    for (const scopeType of ["species", "group"]) {
      for (const [scopeId, bins] of Object.entries(fold.metrics.calibrationScopeBins?.[scopeType] || {})) {
        if (!calibrationScopeBins[scopeType][scopeId]) calibrationScopeBins[scopeType][scopeId] = emptyEceBins();
        for (let index = 0; index < 10; index += 1) {
          const source = bins[index];
          if (!source) continue;
          calibrationScopeBins[scopeType][scopeId][index].predicted += Number(source.predicted) || 0;
          calibrationScopeBins[scopeType][scopeId][index].positives += Number(source.positives) || 0;
          calibrationScopeBins[scopeType][scopeId][index].total += Number(source.total) || 0;
        }
      }
    }
    for (const group of PREVALENCE_GROUPS) {
      const source = fold.metrics.prevalenceMetrics?.[group];
      const weight = Number(source?.evaluatedWeight) || 0;
      if (!weight) continue;
      const target = prevalenceTotals.get(group);
      target.modelLoss += Number(source.brier) * weight;
      target.baselineLoss += Number(source.baselineBrier) * weight;
      target.evaluatedWeight += weight;
    }
  }
  const ece = calibrationBins.reduce((sum, bin) => {
    if (!bin.total) return sum;
    return sum + (bin.total / totalWeight) * Math.abs(bin.predicted / bin.total - bin.positives / bin.total);
  }, 0);
  const prevalenceMetrics = Object.fromEntries([...prevalenceTotals].map(([group, values]) => [group, {
    brier: values.evaluatedWeight > 0 ? values.modelLoss / values.evaluatedWeight : null,
    baselineBrier: values.evaluatedWeight > 0 ? values.baselineLoss / values.evaluatedWeight : null,
    evaluatedWeight: values.evaluatedWeight
  }]));
  return {
    brier,
    baselineBrier,
    brierSkill: baselineBrier > 0 ? 1 - brier / baselineBrier : null,
    ece,
    recallAt20: recallActual ? recallHits / recallActual : null,
    baselineRecallAt20: recallActual ? baselineRecallHits / recallActual : null,
    recallAt20Delta: recallActual ? (recallHits - baselineRecallHits) / recallActual : null,
    recallHits,
    baselineRecallHits,
    recallActual,
    calibrationBins,
    calibrationScopeBins,
    calibrationEce: summarizeCalibrationScopeBins(calibrationScopeBins),
    prevalenceMetrics,
    evaluatedWeight: totalWeight,
    evaluatedTaxa: Math.max(...evaluated.map((fold) => Number(fold.metrics.evaluatedTaxa) || 0)),
    validationContexts,
    fallbackLevels
  };
}

function loadSelectedTemporalFold(artifact, validationYear, options, selectFold) {
  const selection = selectFold(artifact, validationYear, options);
  const exposure = (selectionTable) => weeklyArray(
    artifact.prepare(`
      SELECT reports.season_week, SUM(selected.evaluation_weight) AS value
      FROM training_reports reports
      JOIN ${selectionTable} selected USING (report_id)
      GROUP BY reports.season_week
    `).all(),
    "value"
  );
  const hits = (selectionTable) => {
    const result = new Map();
    for (const row of artifact.prepare(`
      SELECT detections.taxon_id, reports.season_week,
             SUM(selected.evaluation_weight) AS value
      FROM training_reports reports
      JOIN ${selectionTable} selected USING (report_id)
      JOIN training_detections detections USING (report_id)
      GROUP BY detections.taxon_id, reports.season_week
    `).all()) {
      if (!result.has(row.taxon_id)) result.set(row.taxon_id, Array(53).fill(0));
      result.get(row.taxon_id)[Number(row.season_week)] = Number(row.value) || 0;
    }
    return result;
  };
  const taxa = artifact.prepare(`
    SELECT detections.taxon_id,
           COUNT(DISTINCT CASE WHEN reports.observer_known = 1 THEN reports.group_key END) AS positive_count
    FROM training_reports reports
    JOIN evaluation_training_reports selected USING (report_id)
    JOIN training_detections detections USING (report_id)
    GROUP BY detections.taxon_id
    ORDER BY detections.taxon_id
  `).all().map((row) => ({
    taxon_id: String(row.taxon_id),
    positive_count: Number(row.positive_count) || 0
  }));
  return {
    validationYear,
    trainingThroughYear: validationYear - 1,
    trainingCount: selection.trainingCount,
    validationCount: selection.validationCount,
    trainingCutoffDate: selection.trainingCutoffDate,
    recentFromDate: selection.recentFromDate,
    weightingPolicy: selection.weightingPolicy,
    trainingExposure: exposure("evaluation_training_reports"),
    validationExposure: exposure("evaluation_validation_reports"),
    trainingHits: hits("evaluation_training_reports"),
    validationHits: hits("evaluation_validation_reports"),
    taxa
  };
}

function loadOuterTrainingTemporalFold(artifact, validationYear, options) {
  return loadSelectedTemporalFold(
    artifact,
    validationYear,
    options,
    selectOuterTemporalFoldReports
  );
}

function fitNestedCalibratorsForCurrentHoldout(artifact, options) {
  artifact.exec(`
    DELETE FROM evaluation_outer_training_reports;
    DELETE FROM evaluation_outer_validation_reports;
    INSERT INTO evaluation_outer_training_reports(report_id, evaluation_weight, local_recent)
    SELECT report_id, evaluation_weight, local_recent FROM evaluation_training_reports;
    INSERT INTO evaluation_outer_validation_reports(report_id, evaluation_weight, local_recent)
    SELECT report_id, evaluation_weight, local_recent FROM evaluation_validation_reports;
  `);
  const availableYears = artifact
    .prepare(
      `SELECT DISTINCT reports.report_year AS year
       FROM training_reports reports
       JOIN evaluation_outer_training_reports selected USING (report_id)
       ORDER BY reports.report_year`
    )
    .all()
    .map((row) => Number(row.year))
    .filter(Number.isFinite);
  const validationYears = availableYears
    .filter((year) => availableYears.some((trainingYear) => trainingYear < year))
    .slice(-3);
  const selectionYears = validationYears.slice(0, -1);
  const calibrationFitYears = validationYears.slice(0, -1);
  const calibrationGuardYear = validationYears.at(-1) || null;
  const fitCalibrationPoints = new Map();
  const guardCalibrationPoints = new Map();
  const calibrationFallbackLevels = {};
  let evaluatedFolds = 0;
  try {
    let outerBandwidthDays = 14;
    let bestBandwidthBrier = Infinity;
    const bandwidthValidation = [];
    const bandwidthFolds = selectionYears.map((validationYear) =>
      loadOuterTrainingTemporalFold(artifact, validationYear, options)
    );
    for (const candidate of options.bandwidthCandidates || [14]) {
      const bandwidthDays = Number(candidate);
      if (!Number.isFinite(bandwidthDays) || bandwidthDays <= 0) continue;
      const metrics = aggregateTemporalFoldMetrics(
        bandwidthFolds.map((fold) => ({
          metrics: evaluateTemporalMetrics({ ...fold, bandwidthDays })
        }))
      );
      bandwidthValidation.push({
        bandwidthDays,
        selectionModel: "outer_training_province_week_cyclic_kernel_oof",
        metrics
      });
      if (metrics && metrics.brier < bestBandwidthBrier) {
        bestBandwidthBrier = metrics.brier;
        outerBandwidthDays = bandwidthDays;
      }
    }

    // Spatial and observer holdouts are outer folds. Hyperparameters must be
    // selected again inside each outer-training partition; inheriting the
    // full-data matrix would leak information from the outer validation set.
    const outerOptions = {
      ...options,
      priorStrengthsByPrevalence: null,
      priorTuningContextSampleModulo: Math.max(
        1,
        Number(options.outerPriorTuningContextSampleModulo) || 20
      ),
      holdoutEvaluation: { ...options.holdoutEvaluation }
    };
    const priorTuning = tunePriorStrengthMatrix(
      artifact,
      selectionYears,
      outerBandwidthDays,
      outerOptions,
      selectOuterTemporalFoldReports
    );
    outerOptions.priorStrengthsByPrevalence = priorTuning.matrix;

    const calibrationContextSampleModulo = Math.max(
      1,
      Number(options.outerCalibrationContextSampleModulo) || DEFAULT_OPTIONS.outerCalibrationContextSampleModulo
    );
    for (const validationYear of validationYears) {
      const selection = selectOuterTemporalFoldReports(artifact, validationYear, outerOptions);
      const details = evaluatePreparedHoldoutDetails(
        artifact,
        outerBandwidthDays,
        outerOptions,
        {
          collectCalibrationPoints: true,
          contextSampleModulo: calibrationContextSampleModulo
        }
      );
      if (selection.trainingCount > 0 && selection.validationCount > 0 && details.metrics) {
        evaluatedFolds += 1;
      }
      for (const [level, count] of Object.entries(details.metrics?.fallbackLevels || {})) {
        calibrationFallbackLevels[level] = (calibrationFallbackLevels[level] || 0) + Number(count || 0);
      }
      mergeCalibrationPointMaps(
        validationYear === calibrationGuardYear ? guardCalibrationPoints : fitCalibrationPoints,
        details.calibrationPoints
      );
    }
    const taxa = artifact
      .prepare(
        `SELECT detections.taxon_id,
                COUNT(DISTINCT CASE WHEN reports.observer_known = 1 THEN reports.group_key END) AS positive_count
         FROM training_reports reports
         JOIN evaluation_outer_training_reports selected USING (report_id)
         JOIN training_detections detections USING (report_id)
         GROUP BY detections.taxon_id
         ORDER BY detections.taxon_id`
      )
      .all()
      .map((row) => ({ taxon_id: String(row.taxon_id), positive_count: Number(row.positive_count) || 0 }));
    const calibrationCandidates = fitHierarchicalTemporalCalibrators(fitCalibrationPoints, taxa);
    const guardedCalibration = guardCalibrationCandidates(
      calibrationCandidates,
      guardCalibrationPoints,
      NESTED_CALIBRATION_GUARD
    );
    const calibrators = guardedCalibration.calibrators;
    const calibratorMap = new Map(
      calibrators.map((calibrator) => [`${calibrator.scope}:${calibrator.scopeId}`, calibrator.fit])
    );
    const positiveCounts = new Map(taxa.map((taxon) => [taxon.taxon_id, taxon.positive_count]));
    return {
      bandwidthDays: outerBandwidthDays,
      priorStrengthsByPrevalence: priorTuning.matrix,
      hasActiveCalibration: guardedCalibration.summary.acceptedCount > 0,
      calibratorForTaxon: (taxon) => {
        const positiveCount = positiveCounts.get(taxon.taxon_id) || 0;
        if (positiveCount >= 200) return calibratorMap.get(`species:${taxon.taxon_id}`) || null;
        const group = calibrationGroup(positiveCount);
        return group ? calibratorMap.get(`group:${group}`) || null : null;
      },
      summary: {
        strategy: "nested_hierarchical_spatiotemporal_oof_within_outer_training",
        calibrationScoreModel: "hierarchical_spatiotemporal_oof",
        weightingPolicy: TEMPORAL_EVALUATION_WEIGHTING_POLICY,
        foldCount: evaluatedFolds,
        validationYears,
        hyperparameterSelectionYears: selectionYears,
        calibrationFitYears,
        calibrationGuardYear,
        calibrationContextSampleModulo,
        calibrationContextSampling: `deterministic_hash_1_in_${calibrationContextSampleModulo}`,
        calibrationFallbackLevels,
        calibrationGuard: guardedCalibration.summary,
        bandwidthDays: outerBandwidthDays,
        bandwidthValidation,
        priorStrengthsByPrevalence: priorTuning.matrix,
        priorTuning,
        calibratorCount: calibrators.length,
        fittedCalibratorCount: calibrators.filter((calibrator) => calibrator.fit.fitted).length
      }
    };
  } finally {
    resetHoldoutTables(artifact);
    artifact.exec(`
      INSERT INTO evaluation_training_reports(report_id, evaluation_weight, local_recent)
      SELECT report_id, evaluation_weight, local_recent FROM evaluation_outer_training_reports;
      INSERT INTO evaluation_validation_reports(report_id, evaluation_weight, local_recent)
      SELECT report_id, evaluation_weight, local_recent FROM evaluation_outer_validation_reports;
    `);
    const restoreMismatchCount = Number(artifact.prepare(`
      SELECT COUNT(*) AS count FROM (
        SELECT report_id, evaluation_weight, local_recent FROM evaluation_outer_training_reports
        EXCEPT
        SELECT report_id, evaluation_weight, local_recent FROM evaluation_training_reports
      )
    `).get().count || 0) + Number(artifact.prepare(`
      SELECT COUNT(*) AS count FROM (
        SELECT report_id, evaluation_weight, local_recent FROM evaluation_training_reports
        EXCEPT
        SELECT report_id, evaluation_weight, local_recent FROM evaluation_outer_training_reports
      )
    `).get().count || 0) + Number(artifact.prepare(`
      SELECT COUNT(*) AS count FROM (
        SELECT report_id, evaluation_weight, local_recent FROM evaluation_outer_validation_reports
        EXCEPT
        SELECT report_id, evaluation_weight, local_recent FROM evaluation_validation_reports
      )
    `).get().count || 0) + Number(artifact.prepare(`
      SELECT COUNT(*) AS count FROM (
        SELECT report_id, evaluation_weight, local_recent FROM evaluation_validation_reports
        EXCEPT
        SELECT report_id, evaluation_weight, local_recent FROM evaluation_outer_validation_reports
      )
    `).get().count || 0);
    if (restoreMismatchCount) {
      throw new PredictionBuildError(
        "OUTER_HOLDOUT_RESTORE_FAILED",
        "嵌套时间调参后未能原样恢复外层留出权重。",
        { restoreMismatchCount }
      );
    }
    artifact.exec(`
      DELETE FROM evaluation_outer_training_reports;
      DELETE FROM evaluation_outer_validation_reports;
    `);
  }
}

function aggregateAdminCapTuning(folds) {
  const totals = new Map();
  for (const fold of folds) {
    for (const [group, candidates] of Object.entries(fold.adminCapTuning?.byPrevalence || {})) {
      if (!totals.has(group)) totals.set(group, new Map());
      const groupTotals = totals.get(group);
      for (const candidate of candidates) {
        if (!groupTotals.has(candidate.id)) {
          groupTotals.set(candidate.id, {
            id: candidate.id,
            caps: candidate.caps,
            modelLoss: 0,
            baselineLoss: 0,
            evaluatedWeight: 0
          });
        }
        const total = groupTotals.get(candidate.id);
        total.modelLoss += Number(candidate.modelLoss) || 0;
        total.baselineLoss += Number(candidate.baselineLoss) || 0;
        total.evaluatedWeight += Number(candidate.evaluatedWeight) || 0;
      }
    }
  }
  if (!totals.size) return null;
  const byPrevalence = {};
  const selectedMatrix = {};
  for (const [group, candidates] of totals) {
    const ranked = [...candidates.values()]
      .map((candidate) => ({
        ...candidate,
        brier: candidate.evaluatedWeight > 0 ? candidate.modelLoss / candidate.evaluatedWeight : null,
        baselineBrier:
          candidate.evaluatedWeight > 0 ? candidate.baselineLoss / candidate.evaluatedWeight : null
      }))
      .filter((candidate) => Number.isFinite(candidate.brier))
      .sort((left, right) => left.brier - right.brier || left.id.localeCompare(right.id));
    byPrevalence[group] = ranked;
    if (ranked[0]) selectedMatrix[group] = ranked[0].caps;
  }
  return {
    status: "development_candidate_selected_not_release_validated",
    objective: "micro_weighted_oof_raw_brier_within_prevalence_group",
    sqlAggregationPolicy: "one_sql_aggregation_per_fold_then_all_candidates_scored_in_memory",
    selectedMatrix,
    byPrevalence
  };
}

function spatialCalibrationScope(row) {
  const positiveCount = Number(row.positiveCount) || 0;
  if (positiveCount >= 200) return `species:${row.taxonId}`;
  const group = calibrationGroup(positiveCount);
  return group ? `group:${group}` : null;
}

function fitSpatialCalibratorMap(trainingRows, targetRows) {
  const targetTaxa = new Map();
  const trainingPoints = new Map();
  for (const row of targetRows) {
    targetTaxa.set(row.taxonId, Math.max(targetTaxa.get(row.taxonId) || 0, Number(row.positiveCount) || 0));
  }
  for (const row of trainingRows) {
    if (!trainingPoints.has(row.taxonId)) trainingPoints.set(row.taxonId, []);
    trainingPoints.get(row.taxonId).push({
      probability: row.rawProbability,
      positives: row.actualPositive,
      total: row.total
    });
  }
  const maps = new Map();
  const groups = new Map();
  for (const [taxonId, positiveCount] of targetTaxa) {
    if (positiveCount >= 200) {
      maps.set(`species:${taxonId}`, fitBetaCalibration(trainingPoints.get(taxonId) || []));
      continue;
    }
    const group = calibrationGroup(positiveCount);
    if (!group) continue;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(taxonId);
  }
  for (const [group, taxonIds] of groups) {
    maps.set(
      `group:${group}`,
      fitBetaCalibration(taxonIds.flatMap((taxonId) => trainingPoints.get(taxonId) || []))
    );
  }
  return maps;
}

function crossFitSpatialCalibrators(folds) {
  const foldMaps = [];
  const scopeStats = new Map();
  for (let heldoutIndex = 0; heldoutIndex < folds.length; heldoutIndex += 1) {
    const trainingRows = folds.flatMap((fold, index) => index === heldoutIndex ? [] : fold.scoreRows || []);
    const targetRows = folds[heldoutIndex].scoreRows || [];
    const calibratorMap = fitSpatialCalibratorMap(trainingRows, targetRows);
    foldMaps.push(calibratorMap);
    for (const row of targetRows) {
      const scope = spatialCalibrationScope(row);
      if (!scope) continue;
      if (!scopeStats.has(scope)) {
        scopeStats.set(scope, {
          rawLoss: 0,
          candidateLoss: 0,
          total: 0,
          rawBins: emptyEceBins(),
          candidateBins: emptyEceBins(),
          fittedApplications: 0
        });
      }
      const stats = scopeStats.get(scope);
      const fit = calibratorMap.get(scope) || null;
      const candidateProbability = calibrateProbability(row.rawProbability, fit);
      const actual = Number(row.actualPositive) || 0;
      const total = Number(row.total) || 0;
      stats.rawLoss += actual * (1 - row.rawProbability) ** 2 + (total - actual) * row.rawProbability ** 2;
      stats.candidateLoss +=
        actual * (1 - candidateProbability) ** 2 + (total - actual) * candidateProbability ** 2;
      stats.total += total;
      if (fit?.fitted) stats.fittedApplications += 1;
      addEceObservation(stats.rawBins, row.rawProbability, actual, total);
      addEceObservation(stats.candidateBins, candidateProbability, actual, total);
    }
  }
  const acceptedScopes = new Set();
  const scopes = [];
  for (const [scope, stats] of scopeStats) {
    const rawBrier = stats.total > 0 ? stats.rawLoss / stats.total : null;
    const candidateBrier = stats.total > 0 ? stats.candidateLoss / stats.total : null;
    const rawEce = eceFromBins(stats.rawBins);
    const candidateEce = eceFromBins(stats.candidateBins);
    const relativeBrierDegradation = rawBrier > 1e-12
      ? (candidateBrier - rawBrier) / rawBrier
      : candidateBrier <= rawBrier + 1e-12 ? 0 : Number.POSITIVE_INFINITY;
    const eceDegradation = candidateEce - rawEce;
    const accepted =
      stats.fittedApplications > 0 &&
      relativeBrierDegradation <= NESTED_CALIBRATION_GUARD.maximumRelativeBrierDegradation &&
      eceDegradation <= NESTED_CALIBRATION_GUARD.maximumEceDegradation;
    if (accepted) acceptedScopes.add(scope);
    scopes.push({
      scope,
      accepted,
      fittedApplications: stats.fittedApplications,
      rawBrier,
      candidateBrier,
      relativeBrierDegradation,
      rawEce,
      candidateEce,
      eceDegradation
    });
  }
  const foldMetrics = folds.map((fold, index) =>
    evaluateCachedSpatialRows(
      fold.scoreRows,
      (row) => {
        const scope = spatialCalibrationScope(row);
        return scope && acceptedScopes.has(scope) ? foldMaps[index].get(scope) || null : null;
      }
    )
  );
  const allRows = folds.flatMap((fold) => fold.scoreRows || []);
  const productionMap = fitSpatialCalibratorMap(allRows, allRows);
  return {
    foldMetrics,
    productionCalibrators: [...productionMap]
      .filter(([scope]) => acceptedScopes.has(scope))
      .map(([scope, fit]) => ({ scope, fit })),
    summary: {
      strategy: "development_spatial_oof_cross_fit_with_scope_guard",
      fitFoldCount: Math.max(0, folds.length - 1),
      heldoutFoldCount: folds.length,
      maximumRelativeBrierDegradation: NESTED_CALIBRATION_GUARD.maximumRelativeBrierDegradation,
      maximumEceDegradation: NESTED_CALIBRATION_GUARD.maximumEceDegradation,
      acceptedCount: acceptedScopes.size,
      rejectedCount: scopes.length - acceptedScopes.size,
      scopes: scopes.sort((left, right) => left.scope.localeCompare(right.scope))
    }
  };
}

async function evaluateSpatialHoldout(artifact, temporal, options) {
  prepareHoldoutTables(artifact);
  const settings = options.holdoutEvaluation;
  const cells = artifact
    .prepare(
      `SELECT grid_r6_unit AS unit_id, COUNT(*) AS checklist_count,
              COUNT(DISTINCT CASE WHEN observer_known = 1 THEN observer_hash END) AS observer_count
       FROM training_reports
       WHERE grid_r6_unit IS NOT NULL
       GROUP BY grid_r6_unit
       ORDER BY grid_r6_unit`
    )
    .all();
  const candidates = cells.filter(
    (row) =>
      Number(row.checklist_count) >= Number(settings.spatialMinimumChecklists) &&
      Number(row.observer_count) >= Number(settings.spatialMinimumObservers)
  );
  const frozenSplit = options.verifiedSpatialSplit || null;
  const anchors = frozenSplit
    ? frozenSplit.panel.anchors.map((anchor) => ({
        ...anchor,
        unit_id: anchor.unitId,
        checklist_count: anchor.checklists,
        observer_count: anchor.observers
      }))
    : [];
  if (!frozenSplit) {
    for (const candidate of [...candidates].sort((left, right) => stableHash(left.unit_id).localeCompare(stableHash(right.unit_id)))) {
      if (anchors.some((anchor) => areAdjacentGridCells(anchor.unit_id, candidate.unit_id))) continue;
      anchors.push(candidate);
      if (anchors.length >= Number(settings.spatialMaximumFolds)) break;
    }
  }
  const evaluationFolds = frozenSplit
    ? frozenSplit.panel.folds.map((fold) => ({
        foldId: String(fold.foldId),
        anchorIds: [...fold.anchorIds].sort(),
        cities: [...(fold.cities || [])].sort()
      }))
    : anchors.map((anchor) => ({ foldId: anchor.unit_id, anchorIds: [anchor.unit_id], cities: [] }));
  const adminCapCandidates = frozenSplit?.panelName === "development"
    ? buildAdminExposureCapCandidates()
    : [];
  const developmentReservedIds = frozenSplit?.panelName === "development"
    ? [...new Set(
        frozenSplit.manifest.sealedRelease.anchors.flatMap((anchor) => anchor.bufferCellIds || [])
      )].sort()
    : [];
  const developmentBuffersByFold = frozenSplit?.panelName === "development"
    ? new Map(evaluationFolds.map((fold) => [
        String(fold.foldId),
        [...new Set(
          anchors
            .filter((anchor) => fold.anchorIds.includes(anchor.unit_id))
            .flatMap((anchor) => anchor.bufferCellIds || [anchor.unit_id])
        )].sort()
      ]))
    : new Map();
  const folds = [];
  for (const evaluationFold of evaluationFolds) {
    const validationAnchors = anchors.filter((anchor) => evaluationFold.anchorIds.includes(anchor.unit_id));
    const excludedIds = frozenSplit
      ? [...new Set(validationAnchors.flatMap((anchor) => anchor.bufferCellIds || [anchor.unit_id]))].sort()
      : cells
          .filter((cell) => evaluationFold.anchorIds.some((anchorId) => areAdjacentGridCells(anchorId, cell.unit_id)))
          .map((cell) => cell.unit_id)
          .sort();
    const reservedIds = developmentReservedIds;
    const diagnostics = populateSpatialHoldoutTables(artifact, {
      validationR6Units: evaluationFold.anchorIds,
      excludedR6Units: excludedIds,
      reservedR6Units: reservedIds
    });
    if (frozenSplit && (!validationAnchors.length || diagnostics.validationReports === 0)) {
      throw new PredictionBuildError("EMPTY_FROZEN_SPATIAL_FOLD", "冻结空间开发折没有可评估的最近五年清单。", {
        panel: frozenSplit.panelName,
        foldId: evaluationFold.foldId,
        anchorIds: evaluationFold.anchorIds
      });
    }
    const nestedCalibration = fitNestedCalibratorsForCurrentHoldout(artifact, options);
    const nestedOptions = {
      ...options,
      priorStrengthsByPrevalence: nestedCalibration.priorStrengthsByPrevalence
    };
    const collectFrozenScoreRows = Boolean(frozenSplit);
    const rawDetails = evaluatePreparedHoldoutDetails(
      artifact,
      nestedCalibration.bandwidthDays,
      nestedOptions,
      {
        collectAdminCapTasks: adminCapCandidates.length > 0,
        collectScoreRows: collectFrozenScoreRows
      }
    );
    const rawMetrics = rawDetails.metrics;
    const foldAdminCapTuning = adminCapCandidates.length
      ? await scoreAdminCapTasks({
          tasksByPrevalence: rawDetails.adminCapTasksByPrevalence || new Map(),
          candidates: adminCapCandidates,
          workers: options.workers,
          chunkRecords: options.workerTaskChunkRecords
        })
      : null;
    const temporalCalibratedMetrics = nestedCalibration.hasActiveCalibration
      ? collectFrozenScoreRows
        ? evaluateCachedSpatialRows(
            rawDetails.scoreRows,
            (row) => nestedCalibration.calibratorForTaxon({ taxon_id: row.taxonId })
          )
        : evaluatePreparedHoldoutDetails(artifact, nestedCalibration.bandwidthDays, nestedOptions, {
            calibratorForTaxon: nestedCalibration.calibratorForTaxon
          }).metrics
      : rawMetrics;
    const strictInnerFolds = [];
    if (options.writeSpatialOofCachePath !== undefined && frozenSplit?.panelName === "development") {
      for (const innerEvaluationFold of evaluationFolds) {
        const innerFoldId = String(innerEvaluationFold.foldId);
        if (innerFoldId === String(evaluationFold.foldId)) continue;
        const innerExcludedIds = [...new Set([
          ...excludedIds,
          ...(developmentBuffersByFold.get(innerFoldId) || [])
        ])].sort();
        const innerDiagnostics = populateSpatialHoldoutTables(artifact, {
          validationR6Units: innerEvaluationFold.anchorIds,
          excludedR6Units: innerExcludedIds,
          reservedR6Units: reservedIds
        });
        if (
          innerDiagnostics.validationReports === 0 ||
          innerDiagnostics.reportOverlap !== 0 ||
          innerDiagnostics.bufferLeakage !== 0 ||
          innerDiagnostics.reservedLeakage !== 0
        ) {
          throw new PredictionBuildError(
            "SPATIAL_OOF_CACHE_INNER_SELECTION_INVALID",
            "严格 outer×inner 空间证据未能保持目标折、双重 buffer 与 sealed reservation 隔离。",
            {
              outerFoldId: String(evaluationFold.foldId),
              innerFoldId,
              diagnostics: innerDiagnostics
            }
          );
        }
        const innerRawDetails = evaluatePreparedHoldoutDetails(
          artifact,
          nestedCalibration.bandwidthDays,
          nestedOptions,
          { collectAdminCapTasks: true, collectScoreRows: true }
        );
        if (!innerRawDetails.metrics || !innerRawDetails.scoreRows?.length) {
          throw new PredictionBuildError(
            "SPATIAL_OOF_CACHE_INNER_FOLD_EMPTY",
            "严格 outer×inner 空间证据没有生成完整评分行。",
            { outerFoldId: String(evaluationFold.foldId), innerFoldId }
          );
        }
        strictInnerFolds.push({
          innerFoldId,
          trainingFoldIds: evaluationFolds
            .map((fold) => String(fold.foldId))
            .filter((foldId) => foldId !== String(evaluationFold.foldId) && foldId !== innerFoldId)
            .sort(),
          evidenceConfiguration: {
            bandwidthDays: nestedCalibration.summary.bandwidthDays,
            calibrationContextSampleModulo: nestedCalibration.summary.calibrationContextSampleModulo,
            calibrationFitYears: nestedCalibration.summary.calibrationFitYears,
            calibrationGuardYear: nestedCalibration.summary.calibrationGuardYear,
            hyperparameterSelectionYears: nestedCalibration.summary.hyperparameterSelectionYears,
            priorStrengthsByPrevalence: nestedCalibration.summary.priorStrengthsByPrevalence,
            validationYears: nestedCalibration.summary.validationYears
          },
          referenceRawMetrics: innerRawDetails.metrics,
          scoreRows: innerRawDetails.scoreRows
        });
      }
    }
    folds.push({
      foldId: evaluationFold.foldId,
      cities: evaluationFold.cities,
      validationR6Units: evaluationFold.anchorIds,
      excludedR6Units: excludedIds,
      reservedR6Units: reservedIds,
      diagnostics,
      nestedCalibration: nestedCalibration.summary,
      adminCapTuning: foldAdminCapTuning,
      rawMetrics,
      temporalCalibratedMetrics,
      metrics: temporalCalibratedMetrics,
      scoreRows: rawDetails.scoreRows,
      innerFolds: strictInnerFolds
    });
  }
  let developmentPoolPositiveCounts = null;
  if (options.writeSpatialOofCachePath !== undefined && frozenSplit?.panelName === "development") {
    developmentPoolPositiveCounts = collectDevelopmentPoolPositiveCounts(
      artifact,
      developmentReservedIds
    );
  }
  resetHoldoutTables(artifact);
  const developmentSpatialCalibration = frozenSplit?.panelName === "development"
    ? crossFitSpatialCalibrators(folds)
    : null;
  let spatialCalibration = null;
  if (developmentSpatialCalibration) {
    for (let index = 0; index < folds.length; index += 1) {
      folds[index].metrics = developmentSpatialCalibration.foldMetrics[index];
    }
    spatialCalibration = {
      ...developmentSpatialCalibration.summary,
      productionCalibrators: developmentSpatialCalibration.productionCalibrators
    };
  } else if (frozenSplit?.panelName === "sealed-release") {
    const parameters = options.verifiedSpatialParameters;
    const calibratorMap = new Map(
      parameters.artifact.calibrators.map((calibrator) => [calibrator.scope, calibrator.fit])
    );
    for (const fold of folds) {
      fold.metrics = evaluateCachedSpatialRows(
        fold.scoreRows,
        (row) => calibratorMap.get(spatialCalibrationScope(row)) || null
      );
    }
    spatialCalibration = {
      strategy: "frozen_development_parameters_applied_once_to_sealed_release",
      fittedOnPanel: "development",
      evaluatedOnPanel: "sealed-release",
      parameterPath: parameters.path,
      parameterFileSha256: parameters.fileSha256,
      developmentReportSha256: parameters.artifact.developmentReportSha256,
      calibratorCount: parameters.artifact.calibrators.length,
      productionCalibrators: parameters.artifact.calibrators
    };
  }
  const metrics = aggregateHoldoutMetrics(folds);
  const rawMetrics = aggregateHoldoutMetrics(
    folds.map((fold) => ({ ...fold, metrics: fold.rawMetrics }))
  );
  const adminCapTuning = aggregateAdminCapTuning(folds);
  let oofCache = null;
  if (options.writeSpatialOofCachePath !== undefined) {
    const expectedFoldCount = Number(frozenSplit?.panel?.folds?.length) || 0;
    if (
      frozenSplit?.panelName !== "development" ||
      expectedFoldCount !== 5 ||
      folds.length !== expectedFoldCount ||
      folds.some((fold) => !fold.rawMetrics || !fold.metrics || !fold.scoreRows?.length) ||
      folds.some((fold) => !Array.isArray(fold.innerFolds) || fold.innerFolds.length !== expectedFoldCount - 1) ||
      !rawMetrics ||
      !metrics
    ) {
      throw new PredictionBuildError(
        "SPATIAL_OOF_CACHE_INCOMPLETE",
        "空间 OOF 缓存要求冻结 development 面板的五折全部成功完成正式评分。",
        {
          expectedFoldCount,
          actualFoldCount: folds.length,
          successfulFoldCount: folds.filter((fold) => fold.rawMetrics && fold.metrics && fold.scoreRows?.length).length
        }
      );
    }
    oofCache = await writeSpatialOofCache({
      cachePath: options.writeSpatialOofCachePath,
      folds: folds.map((fold) => ({
        foldId: fold.foldId,
        scoreRows: fold.scoreRows,
        evidenceConfiguration: {
          bandwidthDays: fold.nestedCalibration.bandwidthDays,
          calibrationContextSampleModulo: fold.nestedCalibration.calibrationContextSampleModulo,
          calibrationFitYears: fold.nestedCalibration.calibrationFitYears,
          calibrationGuardYear: fold.nestedCalibration.calibrationGuardYear,
          hyperparameterSelectionYears: fold.nestedCalibration.hyperparameterSelectionYears,
          priorStrengthsByPrevalence: fold.nestedCalibration.priorStrengthsByPrevalence,
          validationYears: fold.nestedCalibration.validationYears
        },
        referenceRawMetrics: fold.rawMetrics,
        innerFolds: fold.innerFolds
      })),
      verifiedSpatialSplit: frozenSplit,
      sourceSnapshotSha256: options.sourceSnapshotSha256,
      generationImplementationSha256: spatialOofCacheGenerationImplementationSha256(),
      predictionImplementationSha256: options.implementationSha256,
      baseAdminExposureCapsByPrevalence: options.novelGridAdminExposureCapsByPrevalence,
      qualityThresholds: {
        ...options.qualityGate,
        maximumRelativeBrierDegradation: NESTED_CALIBRATION_GUARD.maximumRelativeBrierDegradation,
        maximumEceDegradation: NESTED_CALIBRATION_GUARD.maximumEceDegradation
      },
      evidenceOptions: {
        captureAdminEvidence: true,
        levels: ["province", "city", "district"],
        applyOnlyWithoutSupportedLocalUnit: true,
        trainingDataContract: TRAINING_DATA_CONTRACT,
        releaseEvaluationOccurrencePolicy: RELEASE_EVALUATION_OCCURRENCE_POLICY,
        temporalEvaluationWeightingPolicy: TEMPORAL_EVALUATION_WEIGHTING_POLICY,
        coordinateQcEvaluationScope: COORDINATE_QC_EVALUATION_SCOPE,
        dataCutoffDate: options.dataCutoffDate,
        includeFlaggedCleanReports: options.includeFlaggedCleanReports,
        pointDriftMeters: options.pointDriftMeters,
        recencyHalfLifeYears: options.recencyHalfLifeYears,
        localHistoryYears: options.localHistoryYears,
        bandwidthCandidates: options.bandwidthCandidates,
        priorStrengthMultipliers: options.priorStrengthMultipliers,
        priorStrengths: options.priorStrengths,
        priorTuningContextSampleModulo: options.priorTuningContextSampleModulo,
        outerPriorTuningContextSampleModulo: options.outerPriorTuningContextSampleModulo,
        outerCalibrationContextSampleModulo: options.outerCalibrationContextSampleModulo,
        holdoutEvaluation: options.holdoutEvaluation,
        unitThresholds: options.unitThresholds,
        workerTaskChunkRecords: options.workerTaskChunkRecords
      },
      developmentPoolPositiveCounts
    });
  }
  for (const fold of folds) {
    delete fold.scoreRows;
    delete fold.innerFolds;
  }
  return {
    status: metrics ? "evaluated" : "unavailable",
    split: frozenSplit
      ? `frozen_${frozenSplit.panelName}_h3_r6_block_with_one_ring_buffer`
      : "h3_r6_block_with_one_ring_buffer",
    splitManifest: frozenSplit
      ? {
          path: frozenSplit.manifestPath,
          fileSha256: frozenSplit.fileSha256,
          manifestHash: frozenSplit.manifestHash,
          sourceSnapshotSha256: frozenSplit.manifest.sourceSnapshotSha256,
          panel: frozenSplit.panelName,
          sealedPanelViewed: frozenSplit.panelName === "sealed-release"
        }
      : null,
    candidateBlocks: frozenSplit?.manifest?.candidateSummary?.candidateCount ?? candidates.length,
    foldCount: folds.filter((fold) => fold.metrics).length,
    rawMetrics,
    metrics,
    adminCapTuning,
    spatialCalibration,
    oofCache,
    folds
  };
}

function evaluateObserverHoldout(artifact, temporal, options) {
  prepareHoldoutTables(artifact);
  const settings = options.holdoutEvaluation;
  const observers = artifact
    .prepare(
      `SELECT observer_hash, COUNT(*) AS checklist_count
       FROM training_reports
       WHERE observer_known = 1
       GROUP BY observer_hash
       ORDER BY checklist_count DESC, observer_hash`
    )
    .all();
  const requestedFolds = Math.max(0, Math.floor(Number(settings.observerFoldCount) || 0));
  const assignments = Array.from({ length: Math.min(requestedFolds, observers.length) }, (_, index) => ({
    index,
    reports: 0,
    observers: []
  }));
  for (const observer of observers) {
    const target = assignments.reduce(
      (best, candidate) =>
        !best || candidate.reports < best.reports ||
        (candidate.reports === best.reports && candidate.index < best.index)
          ? candidate
          : best,
      null
    );
    if (!target) break;
    target.observers.push(observer.observer_hash);
    target.reports += Number(observer.checklist_count) || 0;
  }
  const insertObserver = artifact.prepare(
    "INSERT OR IGNORE INTO evaluation_holdout_observers(observer_hash) VALUES (?)"
  );
  const folds = [];
  for (const assignment of assignments.filter((row) => row.observers.length)) {
    resetHoldoutTables(artifact);
    for (const observerHash of assignment.observers) insertObserver.run(observerHash);
    artifact.exec(`
      INSERT INTO evaluation_validation_reports(report_id, evaluation_weight, local_recent)
      SELECT reports.report_id, reports.weight, reports.is_recent
      FROM training_reports reports
      JOIN evaluation_holdout_observers holdout USING (observer_hash)
      WHERE reports.observer_known = 1;

      INSERT INTO evaluation_training_reports(report_id, evaluation_weight, local_recent)
      SELECT reports.report_id, reports.weight, reports.is_recent
      FROM training_reports reports
      WHERE reports.observer_known = 0
         OR NOT EXISTS (
           SELECT 1 FROM evaluation_holdout_observers holdout
           WHERE holdout.observer_hash = reports.observer_hash
         );
    `);
    const nestedCalibration = fitNestedCalibratorsForCurrentHoldout(artifact, options);
    const nestedOptions = {
      ...options,
      priorStrengthsByPrevalence: nestedCalibration.priorStrengthsByPrevalence
    };
    const rawMetrics = evaluatePreparedHoldoutDetails(
      artifact,
      nestedCalibration.bandwidthDays,
      nestedOptions
    ).metrics;
    const metrics = nestedCalibration.hasActiveCalibration
      ? evaluatePreparedHoldoutDetails(artifact, nestedCalibration.bandwidthDays, nestedOptions, {
          calibratorForTaxon: nestedCalibration.calibratorForTaxon
        }).metrics
      : rawMetrics;
    folds.push({
      foldId: `observer-${assignment.index + 1}`,
      validationObservers: assignment.observers.length,
      diagnostics: holdoutSelectionDiagnostics(artifact),
      nestedCalibration: nestedCalibration.summary,
      rawMetrics,
      metrics
    });
  }
  resetHoldoutTables(artifact);
  const metrics = aggregateHoldoutMetrics(folds);
  const rawMetrics = aggregateHoldoutMetrics(
    folds.map((fold) => ({ ...fold, metrics: fold.rawMetrics }))
  );
  return {
    status: metrics ? "evaluated" : "unavailable",
    split: "observer_grouped_balanced_folds",
    knownObservers: observers.length,
    foldCount: folds.filter((fold) => fold.metrics).length,
    rawMetrics,
    metrics,
    folds
  };
}

function evaluateReleaseQuality({ temporal, spatial, observer }, options) {
  const thresholds = { ...options.qualityGate };
  const failures = [];
  const requireMetric = (scope, metrics, name, predicate) => {
    const value = metrics?.[name];
    if (!Number.isFinite(value)) failures.push(`${scope}.${name}.missing`);
    else if (!predicate(value)) failures.push(`${scope}.${name}`);
  };
  const requireCommonMetrics = (scope, evaluation) => {
    requireMetric(
      scope,
      evaluation?.metrics,
      "brierSkill",
      (value) => value > 0 && value >= Number(thresholds.minimumBrierSkill)
    );
    requireMetric(scope, evaluation?.metrics, "ece", (value) => value <= Number(thresholds.maximumEce));
    const calibrationEce = evaluation?.metrics?.calibrationEce;
    if (Number(calibrationEce?.species?.scopeCount || 0) > 0) {
      requireMetric(
        `${scope}.species_calibration`,
        calibrationEce.species,
        "maximumEce",
        (value) => value <= Number(thresholds.maximumSpeciesEce)
      );
    }
    if (Number(calibrationEce?.group?.scopeCount || 0) > 0) {
      requireMetric(
        `${scope}.group_calibration`,
        calibrationEce.group,
        "maximumEce",
        (value) => value <= Number(thresholds.maximumGroupEce)
      );
    }
    requireMetric(
      scope,
      evaluation?.metrics,
      "recallAt20Delta",
      (value) => value >= Number(thresholds.minimumRecallAt20Delta)
    );
  };
  if (Number(temporal.timeFoldCount || 0) < Number(thresholds.minimumTimeFolds || 0)) {
    failures.push("time.fold_count");
  }
  if (Number(temporal.calibrationFoldCount || 0) < Number(thresholds.minimumCalibrationFolds || 0)) {
    failures.push("time.calibration_fold_count");
  }
  if (thresholds.requireFinalHoldout && (!temporal.finalHoldoutYear || !temporal.finalHoldout?.metrics)) {
    failures.push("time.final_holdout.missing");
  }
  requireCommonMetrics("time", temporal);
  requireMetric(
    "time",
    temporal.metrics,
    "reverseNdcgLift",
    (value) => value >= Number(thresholds.minimumReverseNdcgLift)
  );
  if (temporal.finalHoldoutYear) {
    if (!temporal.finalHoldout?.metrics) {
      failures.push("time.final_holdout.missing");
    } else {
      requireCommonMetrics("time.final_holdout", temporal.finalHoldout);
      requireMetric(
        "time.final_holdout",
        temporal.finalHoldout.metrics,
        "reverseNdcgLift",
        (value) => value >= Number(thresholds.minimumReverseNdcgLift)
      );
    }
  }
  if (thresholds.requireSpatialHoldout) {
    if (Number(spatial?.foldCount || 0) < Number(thresholds.minimumSpatialFolds || 0)) {
      failures.push("spatial.fold_count");
    }
    requireCommonMetrics("spatial", spatial);
  }
  if (thresholds.requireObserverHoldout) {
    if (Number(observer?.foldCount || 0) < Number(thresholds.minimumObserverFolds || 0)) {
      failures.push("observer.fold_count");
    }
    requireCommonMetrics("observer", observer);
  }
  return {
    passed: failures.length === 0,
    failures,
    thresholds,
    occurrenceEvaluationPolicy: RELEASE_EVALUATION_OCCURRENCE_POLICY,
    temporalEvaluationWeightingPolicy: TEMPORAL_EVALUATION_WEIGHTING_POLICY,
    coordinateQcEvaluationScope: COORDINATE_QC_EVALUATION_SCOPE,
    time: {
      status: temporal.metrics ? "evaluated" : "unavailable",
      foldCount: Number(temporal.timeFoldCount || 0),
      calibrationFoldCount: Number(temporal.calibrationFoldCount || 0),
      validationYears: temporal.validationYears || (temporal.validationYear ? [temporal.validationYear] : []),
      calibrationYears: temporal.calibrationYears || [],
      finalHoldoutYear: temporal.finalHoldoutYear || null,
      metrics: temporal.metrics || null,
      folds: temporal.folds || [],
      finalHoldout: temporal.finalHoldout || null
    },
    spatial: spatial || { status: "disabled", foldCount: 0, metrics: null, folds: [] },
    observer: observer || { status: "disabled", foldCount: 0, metrics: null, folds: [] }
  };
}

function loadTemporalFold(artifact, validationYear, options) {
  return loadSelectedTemporalFold(
    artifact,
    validationYear,
    options,
    selectTemporalFoldReports
  );
}

function collectTemporalCalibrationPoints(fold, bandwidthDays) {
  const pointsByTaxon = new Map();
  for (const taxon of fold.taxa) {
    if (Number(taxon.positive_count) < 30) continue;
    const hits = fold.trainingHits.get(taxon.taxon_id) || Array(53).fill(0);
    const validation = fold.validationHits.get(taxon.taxon_id) || Array(53).fill(0);
    const points = [];
    for (let week = 1; week <= 52; week += 1) {
      const total = Number(fold.validationExposure[week]) || 0;
      if (total <= 0) continue;
      const exposure = smoothWeekly(fold.trainingExposure, week, bandwidthDays);
      const positive = Math.min(exposure, smoothWeekly(hits, week, bandwidthDays));
      points.push({
        probability: (positive + 1) / (exposure + 2),
        positives: Math.min(total, Number(validation[week]) || 0),
        total
      });
    }
    if (points.length) pointsByTaxon.set(taxon.taxon_id, points);
  }
  return pointsByTaxon;
}

function fitTemporalCalibrators(calibrationFolds, finalTrainingTaxa, bandwidthDays) {
  const pooledPoints = new Map();
  for (const fold of calibrationFolds) {
    for (const [taxonId, points] of collectTemporalCalibrationPoints(fold, bandwidthDays)) {
      if (!pooledPoints.has(taxonId)) pooledPoints.set(taxonId, []);
      pooledPoints.get(taxonId).push(...points);
    }
  }
  const groupEntries = new Map();
  const calibrators = [];
  for (const taxon of finalTrainingTaxa) {
    const positiveCount = Number(taxon.positive_count) || 0;
    if (positiveCount < 30) continue;
    const points = pooledPoints.get(taxon.taxon_id) || [];
    if (positiveCount >= 200) {
      calibrators.push({
        scope: "species",
        scopeId: taxon.taxon_id,
        taxonIds: [taxon.taxon_id],
        points,
        fit: fitBetaCalibration(points)
      });
      continue;
    }
    const group = calibrationGroup(positiveCount);
    if (!groupEntries.has(group)) groupEntries.set(group, { points: [], taxonIds: [] });
    groupEntries.get(group).points.push(...points);
    groupEntries.get(group).taxonIds.push(taxon.taxon_id);
  }
  for (const [group, entry] of groupEntries) {
    calibrators.push({
      scope: "group",
      scopeId: group,
      taxonIds: entry.taxonIds.sort(),
      points: entry.points,
      fit: fitBetaCalibration(entry.points)
    });
  }
  return calibrators;
}

function tuneTemporalModelLegacy(artifact, options) {
  const cutoff = artifact.prepare("SELECT MAX(report_date) AS cutoff FROM training_reports").get().cutoff;
  const cutoffParts = isoDateParts(cutoff);
  const cutoffMonthDay = `${String(cutoffParts.month).padStart(2, "0")}-${String(cutoffParts.day).padStart(2, "0")}`;
  const availableYears = artifact
    .prepare("SELECT DISTINCT report_year AS year FROM training_reports ORDER BY report_year")
    .all()
    .map((row) => Number(row.year))
    .filter(Number.isFinite);
  const validationYears = availableYears
    .filter((year) => availableYears.some((trainingYear) => trainingYear < year))
    .slice(-3);
  if (!validationYears.length) {
    return {
      bandwidthDays: 14,
      validationYear: null,
      validationYears: [],
      calibrationYears: [],
      finalHoldoutYear: null,
      finalHoldout: null,
      folds: [],
      timeFoldCount: 0,
      calibrationFoldCount: 0,
      metrics: null,
      calibrators: []
    };
  }

  const rawFolds = validationYears.map((year) => loadTemporalFold(artifact, year, options));
  const finalFold = rawFolds.at(-1);
  const calibrationFolds = rawFolds.slice(0, -1);
  let bestBandwidth = 14;
  let bestBrier = Infinity;
  if (calibrationFolds.length) {
    for (const bandwidth of options.bandwidthCandidates) {
      const candidateFolds = calibrationFolds.map((fold) => ({
        metrics: evaluateTemporalMetrics({ ...fold, bandwidthDays: bandwidth })
      }));
      const candidateMetrics = aggregateTemporalFoldMetrics(candidateFolds);
      if (candidateMetrics && candidateMetrics.brier < bestBrier) {
        bestBrier = candidateMetrics.brier;
        bestBandwidth = bandwidth;
      }
    }
  }

  const calibrators = fitTemporalCalibrators(calibrationFolds, finalFold.taxa, bestBandwidth);
  const calibratorMap = new Map(
    calibrators.map((calibrator) => [`${calibrator.scope}:${calibrator.scopeId}`, calibrator.fit])
  );
  const finalPositiveCounts = new Map(
    finalFold.taxa.map((taxon) => [taxon.taxon_id, Number(taxon.positive_count) || 0])
  );
  const calibratorForTaxon = (taxon) => {
    const positiveCount = finalPositiveCounts.get(taxon.taxon_id) || 0;
    if (positiveCount >= 200) return calibratorMap.get(`species:${taxon.taxon_id}`) || null;
    const group = calibrationGroup(positiveCount);
    return group ? calibratorMap.get(`group:${group}`) || null : null;
  };

  const folds = rawFolds.map((fold, index) => {
    const final = index === rawFolds.length - 1;
    const rawMetrics = evaluateTemporalMetrics({ ...fold, bandwidthDays: bestBandwidth });
    const metrics = final
      ? evaluateTemporalMetrics({
          ...fold,
          bandwidthDays: bestBandwidth,
          calibratorForTaxon: calibrators.length ? calibratorForTaxon : null
        })
      : rawMetrics;
    return {
      foldId: `year-${fold.validationYear}`,
      role: final ? "final_holdout" : "calibration_oof",
      validationYear: fold.validationYear,
      trainingThroughYear: fold.trainingThroughYear,
      trainingReports: fold.trainingCount,
      validationReports: fold.validationCount,
      partialYear: fold.validationYear === cutoffParts.year && cutoffMonthDay < "12-15",
      validationThroughDate: fold.validationYear === cutoffParts.year ? cutoff : `${fold.validationYear}-12-31`,
      includedInBandwidthTuning: !final,
      includedInCalibrationFit: !final,
      calibrationApplied: final && calibrators.length > 0,
      metrics,
      rawMetrics: final && calibrators.length > 0 ? rawMetrics : null
    };
  });
  const evaluatedFolds = folds.filter((fold) => fold.metrics);
  const finalPublicFold = folds.at(-1);
  const metrics = aggregateTemporalFoldMetrics(evaluatedFolds);
  return {
    bandwidthDays: bestBandwidth,
    validationYear: finalFold.validationYear,
    validationYears,
    calibrationYear: calibrationFolds.at(-1)?.validationYear || null,
    calibrationYears: calibrationFolds.map((fold) => fold.validationYear),
    finalHoldoutYear: finalFold.validationYear,
    finalHoldout: finalPublicFold,
    folds,
    timeFoldCount: evaluatedFolds.length,
    calibrationFoldCount: evaluatedFolds.filter((fold) => fold.role === "calibration_oof").length,
    brier: finalPublicFold?.metrics?.brier ?? null,
    metrics,
    calibrators
  };
}

function populateTemporalFoldSelections(artifact, validationYear, options = {}, outerTrainingOnly = false) {
  prepareHoldoutTables(artifact);
  resetHoldoutTables(artifact);
  const membershipJoin = outerTrainingOnly
    ? "JOIN evaluation_outer_training_reports outer_selected USING (report_id)"
    : "";
  const trainingCutoffDate = `${validationYear}-01-01`;
  const localHistoryYears = Math.max(1, Number(options.localHistoryYears) || 5);
  const recentFromDate = `${validationYear - localHistoryYears}-01-01`;
  const productionCutoffDate = String(
    options.dataCutoffDate ||
    artifact.prepare("SELECT MAX(report_date) AS cutoff FROM training_reports").get().cutoff
  );
  const productionCutoffMs = Date.parse(`${productionCutoffDate}T00:00:00Z`);
  const foldCutoffMs = Date.parse(`${trainingCutoffDate}T00:00:00Z`);
  const halfLifeYears = Math.max(0.001, Number(options.recencyHalfLifeYears) || 3);
  const foldScale = 2 ** (
    (productionCutoffMs - foldCutoffMs) /
    (365.2425 * 86400000 * halfLifeYears)
  );
  if (!Number.isFinite(foldScale) || foldScale <= 0) {
    throw new PredictionBuildError("INVALID_TEMPORAL_WEIGHT", "时间折权重缩放系数无效。", {
      validationYear,
      productionCutoffDate,
      trainingCutoffDate,
      halfLifeYears
    });
  }
  artifact.prepare(`
    INSERT INTO evaluation_training_reports(report_id, evaluation_weight, local_recent)
    SELECT reports.report_id, 1,
           CASE WHEN reports.report_date >= ? THEN 1 ELSE 0 END
    FROM training_reports reports
    ${membershipJoin}
    WHERE reports.report_year < ?
  `).run(recentFromDate, validationYear);
  artifact.prepare(`
    INSERT INTO evaluation_validation_reports(report_id, evaluation_weight, local_recent)
    SELECT reports.report_id, 1, 1
    FROM training_reports reports
    ${membershipJoin}
    WHERE reports.report_year = ?
  `).run(validationYear);
  artifact.exec(`
    INSERT INTO evaluation_group_counts(split, group_key, report_count)
    SELECT 'training', reports.group_key, COUNT(*)
    FROM training_reports reports
    JOIN evaluation_training_reports selected USING (report_id)
    GROUP BY reports.group_key;

    INSERT INTO evaluation_group_counts(split, group_key, report_count)
    SELECT 'validation', reports.group_key, COUNT(*)
    FROM training_reports reports
    JOIN evaluation_validation_reports selected USING (report_id)
    GROUP BY reports.group_key;
  `);
  artifact.prepare(`
    UPDATE evaluation_training_reports
    SET evaluation_weight = (
      SELECT MIN(1.0, reports.base_weight * ?) / counts.report_count
      FROM training_reports reports
      JOIN evaluation_group_counts counts
        ON counts.split = 'training' AND counts.group_key = reports.group_key
      WHERE reports.report_id = evaluation_training_reports.report_id
    )
  `).run(foldScale);
  artifact.exec(`
    UPDATE evaluation_validation_reports
    SET evaluation_weight = (
      SELECT 1.0 / counts.report_count
      FROM training_reports reports
      JOIN evaluation_group_counts counts
        ON counts.split = 'validation' AND counts.group_key = reports.group_key
      WHERE reports.report_id = evaluation_validation_reports.report_id
    );
  `);
  const diagnostics = holdoutSelectionDiagnostics(artifact);
  return {
    validationYear,
    trainingThroughYear: validationYear - 1,
    trainingCount: diagnostics.trainingReports,
    validationCount: diagnostics.validationReports,
    trainingCutoffDate,
    recentFromDate,
    weightingPolicy: TEMPORAL_EVALUATION_WEIGHTING_POLICY,
    diagnostics
  };
}

function selectTemporalFoldReports(artifact, validationYear, options) {
  return populateTemporalFoldSelections(artifact, validationYear, options, false);
}

function selectOuterTemporalFoldReports(artifact, validationYear, options) {
  return populateTemporalFoldSelections(artifact, validationYear, options, true);
}

function temporalTrainingTaxa(artifact, validationYear) {
  return artifact
    .prepare(
      `SELECT detections.taxon_id,
              COUNT(DISTINCT CASE WHEN reports.observer_known = 1 THEN reports.group_key END) AS positive_count
       FROM training_detections detections
       JOIN training_reports reports ON reports.report_id = detections.report_id
       WHERE reports.report_year < ?
       GROUP BY detections.taxon_id
       ORDER BY detections.taxon_id`
    )
    .all(validationYear)
    .map((row) => ({
      taxon_id: String(row.taxon_id),
      positive_count: Number(row.positive_count) || 0
    }));
}

function productionTrainingTaxa(artifact, taxa) {
  const suppressed = new Set(
    artifact
      .prepare("SELECT taxon_id FROM taxa WHERE vagrant_candidate = 1")
      .all()
      .map((row) => String(row.taxon_id))
  );
  return taxa.filter((taxon) => !suppressed.has(String(taxon.taxon_id)));
}

function mergeCalibrationPointMaps(target, source) {
  for (const [taxonId, points] of source || []) {
    if (!target.has(taxonId)) target.set(taxonId, []);
    target.get(taxonId).push(...points);
  }
}

function calibrationPointMetrics(points, parameters = null) {
  const bins = emptyEceBins();
  let loss = 0;
  let totalWeight = 0;
  for (const point of points || []) {
    const total = Number(point.total) || 0;
    if (total <= 0 || !Number.isFinite(Number(point.probability))) continue;
    const positives = Math.min(total, Math.max(0, Number(point.positives) || 0));
    const probability = calibrateProbability(point.probability, parameters);
    loss += positives * (1 - probability) ** 2 + (total - positives) * probability ** 2;
    totalWeight += total;
    addEceObservation(bins, probability, positives, total);
  }
  if (totalWeight <= 0) return null;
  const ece = bins.reduce((sum, bin) => {
    if (!bin.total) return sum;
    return sum + (bin.total / totalWeight) * Math.abs(bin.predicted / bin.total - bin.positives / bin.total);
  }, 0);
  return { brier: loss / totalWeight, ece, totalWeight, pointCount: (points || []).length };
}

function identityCalibrationFit() {
  return { a: 1, b: 1, c: 0, fitted: false, iterations: 0 };
}

function guardCalibrationCandidates(
  calibrators,
  guardPointsByTaxon,
  thresholds = NESTED_CALIBRATION_GUARD
) {
  const guarded = [];
  const summary = {
    maximumRelativeBrierDegradation: Number(thresholds.maximumRelativeBrierDegradation),
    maximumEceDegradation: Number(thresholds.maximumEceDegradation),
    candidateCount: 0,
    acceptedCount: 0,
    rejectedCount: 0,
    insufficientGuardCount: 0,
    identityCount: 0
  };
  for (const calibrator of calibrators || []) {
    summary.candidateCount += 1;
    const guardPoints = (calibrator.taxonIds || []).flatMap(
      (taxonId) => guardPointsByTaxon.get(taxonId) || []
    );
    const rawMetrics = calibrationPointMetrics(guardPoints);
    const candidateMetrics = calibrator.fit?.fitted
      ? calibrationPointMetrics(guardPoints, calibrator.fit)
      : null;
    let status = "accepted";
    let relativeBrierDegradation = null;
    let eceDegradation = null;
    if (!calibrator.fit?.fitted) {
      status = "candidate_not_fitted";
    } else if (!rawMetrics || !candidateMetrics) {
      status = "insufficient_guard_data";
      summary.insufficientGuardCount += 1;
    } else {
      relativeBrierDegradation = rawMetrics.brier > 1e-12
        ? (candidateMetrics.brier - rawMetrics.brier) / rawMetrics.brier
        : candidateMetrics.brier <= rawMetrics.brier + 1e-12
          ? 0
          : Number.POSITIVE_INFINITY;
      eceDegradation = candidateMetrics.ece - rawMetrics.ece;
      if (
        relativeBrierDegradation > Number(thresholds.maximumRelativeBrierDegradation) ||
        eceDegradation > Number(thresholds.maximumEceDegradation)
      ) status = "rejected_by_guard";
    }
    const accepted = status === "accepted";
    if (accepted) summary.acceptedCount += 1;
    else {
      summary.identityCount += 1;
      if (status === "rejected_by_guard") summary.rejectedCount += 1;
    }
    guarded.push({
      ...calibrator,
      fit: accepted ? calibrator.fit : identityCalibrationFit(),
      guard: {
        status,
        accepted,
        rawMetrics,
        candidateMetrics,
        relativeBrierDegradation,
        eceDegradation
      }
    });
  }
  return { calibrators: guarded, summary };
}

function fitHierarchicalTemporalCalibrators(pointsByTaxon, finalTrainingTaxa) {
  const groupEntries = new Map();
  const calibrators = [];
  for (const taxon of finalTrainingTaxa) {
    const positiveCount = Number(taxon.positive_count) || 0;
    if (positiveCount < 30) continue;
    const points = pointsByTaxon.get(taxon.taxon_id) || [];
    if (positiveCount >= 200) {
      calibrators.push({
        scope: "species",
        scopeId: taxon.taxon_id,
        taxonIds: [taxon.taxon_id],
        points,
        fit: fitBetaCalibration(points)
      });
      continue;
    }
    const group = calibrationGroup(positiveCount);
    if (!groupEntries.has(group)) groupEntries.set(group, { points: [], taxonIds: [] });
    groupEntries.get(group).points.push(...points);
    groupEntries.get(group).taxonIds.push(taxon.taxon_id);
  }
  for (const [group, entry] of groupEntries) {
    calibrators.push({
      scope: "group",
      scopeId: group,
      taxonIds: entry.taxonIds.sort(),
      points: entry.points,
      fit: fitBetaCalibration(entry.points)
    });
  }
  return calibrators;
}

function clonePriorStrengthMatrix(matrix) {
  return Object.fromEntries(
    Object.entries(matrix || {}).map(([level, groups]) => [level, { ...(groups || {}) }])
  );
}

function initialPriorStrengthMatrix(options) {
  const matrix = {};
  for (const level of Object.keys(DEFAULT_PRIOR_STRENGTHS)) {
    matrix[level] = {};
    for (const group of PREVALENCE_GROUPS) {
      matrix[level][group] = resolvePriorStrength(
        options.priorStrengths,
        options.priorStrengthsByPrevalence,
        level,
        group === "species_200_plus" ? 200 : group === "group_80_199" ? 80 : group === "group_30_79" ? 30 : 0
      );
    }
  }
  return matrix;
}

function tunePriorStrengthMatrix(
  artifact,
  calibrationYears,
  bandwidthDays,
  options,
  selectFold = selectTemporalFoldReports
) {
  const matrix = initialPriorStrengthMatrix(options);
  const diagnostics = [];
  const maximumFolds = Math.max(1, Number(options.holdoutEvaluation.priorTuningMaximumFolds) || 2);
  const tuningYears = calibrationYears.slice(-maximumFolds);
  if (!tuningYears.length) return { matrix, diagnostics, tuningYears };
  for (const level of Object.keys(DEFAULT_PRIOR_STRENGTHS)) {
    const candidates = [...new Set(options.priorStrengthMultipliers
      .map((multiplier) => Number(options.priorStrengths[level]) * Number(multiplier))
      .filter((value) => Number.isFinite(value) && value > 0))]
      .sort((left, right) => left - right);
    const scores = new Map(PREVALENCE_GROUPS.map((group) => [group, []]));
    const totalsByStrength = new Map(candidates.map((strength) => [
      strength,
      new Map(PREVALENCE_GROUPS.map((group) => [group, { loss: 0, weight: 0 }]))
    ]));
    for (const validationYear of tuningYears) {
      selectFold(artifact, validationYear, options);
      for (const strength of candidates) {
        const trialMatrix = clonePriorStrengthMatrix(matrix);
        for (const group of PREVALENCE_GROUPS) trialMatrix[level][group] = strength;
        const trialOptions = {
          ...options,
          priorStrengthsByPrevalence: trialMatrix,
          holdoutEvaluation: { ...options.holdoutEvaluation, minimumTaxonPositives: 1 }
        };
        const metrics = evaluatePreparedHoldoutDetails(artifact, bandwidthDays, trialOptions, {
          contextSampleModulo: options.priorTuningContextSampleModulo
        }).metrics;
        const totals = totalsByStrength.get(strength);
        for (const group of PREVALENCE_GROUPS) {
          const groupMetrics = metrics?.prevalenceMetrics?.[group];
          const weight = Number(groupMetrics?.evaluatedWeight) || 0;
          if (!weight || !Number.isFinite(Number(groupMetrics.brier))) continue;
          totals.get(group).loss += Number(groupMetrics.brier) * weight;
          totals.get(group).weight += weight;
        }
      }
    }
    for (const strength of candidates) {
      const totals = totalsByStrength.get(strength);
      for (const group of PREVALENCE_GROUPS) {
        const total = totals.get(group);
        scores.get(group).push({
          strength,
          brier: total.weight > 0 ? total.loss / total.weight : null,
          evaluatedWeight: total.weight
        });
      }
    }
    for (const group of PREVALENCE_GROUPS) {
      const eligible = scores.get(group).filter((entry) => Number.isFinite(entry.brier));
      const selected = eligible.sort((left, right) => left.brier - right.brier || left.strength - right.strength)[0];
      if (selected) matrix[level][group] = selected.strength;
      diagnostics.push({
        level,
        prevalenceGroup: group,
        selectedStrength: matrix[level][group],
        candidates: scores.get(group)
      });
    }
  }
  return {
    matrix,
    diagnostics,
    tuningYears,
    contextSampleModulo: options.priorTuningContextSampleModulo,
    contextSampleDescription: `deterministic_hash_1_in_${options.priorTuningContextSampleModulo}`
  };
}

function tuneTemporalModel(artifact, options) {
  const cutoff = artifact.prepare("SELECT MAX(report_date) AS cutoff FROM training_reports").get().cutoff;
  const cutoffParts = isoDateParts(cutoff);
  const cutoffMonthDay = `${String(cutoffParts.month).padStart(2, "0")}-${String(cutoffParts.day).padStart(2, "0")}`;
  const availableYears = artifact
    .prepare("SELECT DISTINCT report_year AS year FROM training_reports ORDER BY report_year")
    .all()
    .map((row) => Number(row.year))
    .filter(Number.isFinite);
  const validationYears = availableYears
    .filter((year) => availableYears.some((trainingYear) => trainingYear < year))
    .slice(-3);
  if (!validationYears.length) {
    return {
      bandwidthDays: 14,
      validationYear: null,
      validationYears: [],
      calibrationYears: [],
      finalHoldoutYear: null,
      finalHoldout: null,
      folds: [],
      timeFoldCount: 0,
      calibrationFoldCount: 0,
      metrics: null,
      calibrators: [],
      evaluationModel: "hierarchical_spatiotemporal_oof",
      baselineModel: "province_week",
      evaluationWeightingPolicy: TEMPORAL_EVALUATION_WEIGHTING_POLICY,
      evaluationOccurrencePolicy: RELEASE_EVALUATION_OCCURRENCE_POLICY
    };
  }

  prepareHoldoutTables(artifact);
  const finalHoldoutYear = validationYears.at(-1);
  const calibrationYears = validationYears.slice(0, -1);
  let bestBandwidth = 14;
  let bestBrier = Infinity;
  const bandwidthValidation = [];
  try {
    if (calibrationYears.length) {
      const bandwidthFolds = calibrationYears.map((validationYear) =>
        loadTemporalFold(artifact, validationYear, options)
      );
      for (const bandwidthDays of options.bandwidthCandidates) {
        const candidateFolds = bandwidthFolds.map((fold) => ({
          metrics: evaluateTemporalMetrics({ ...fold, bandwidthDays })
        }));
        const metrics = aggregateTemporalFoldMetrics(candidateFolds);
        bandwidthValidation.push({
          bandwidthDays,
          selectionModel: "province_week_cyclic_kernel_oof",
          metrics
        });
        if (metrics && metrics.brier < bestBrier) {
          bestBrier = metrics.brier;
          bestBandwidth = bandwidthDays;
        }
      }
    }

    const priorTuning = tunePriorStrengthMatrix(
      artifact,
      calibrationYears,
      bestBandwidth,
      options
    );
    options.priorStrengthsByPrevalence = priorTuning.matrix;

    const pooledCalibrationPoints = new Map();
    for (const validationYear of calibrationYears) {
      selectTemporalFoldReports(artifact, validationYear, options);
      const details = evaluatePreparedHoldoutDetails(artifact, bestBandwidth, options, {
        collectCalibrationPoints: true
      });
      mergeCalibrationPointMaps(pooledCalibrationPoints, details.calibrationPoints);
    }
    const productionCalibrationPoints = new Map();
    mergeCalibrationPointMaps(productionCalibrationPoints, pooledCalibrationPoints);
    const finalTrainingTaxa = temporalTrainingTaxa(artifact, finalHoldoutYear);
    const calibrators = fitHierarchicalTemporalCalibrators(pooledCalibrationPoints, finalTrainingTaxa);
    const calibratorMap = new Map(
      calibrators.map((calibrator) => [`${calibrator.scope}:${calibrator.scopeId}`, calibrator.fit])
    );
    const finalPositiveCounts = new Map(
      finalTrainingTaxa.map((taxon) => [taxon.taxon_id, Number(taxon.positive_count) || 0])
    );
    const calibratorForTaxon = (taxon) => {
      const positiveCount = finalPositiveCounts.get(taxon.taxon_id) || 0;
      if (positiveCount >= 200) return calibratorMap.get(`species:${taxon.taxon_id}`) || null;
      const group = calibrationGroup(positiveCount);
      return group ? calibratorMap.get(`group:${group}`) || null : null;
    };

    const folds = [];
    for (const validationYear of validationYears) {
      const selection = selectTemporalFoldReports(artifact, validationYear, options);
      const final = validationYear === finalHoldoutYear;
      const rawDetails = evaluatePreparedHoldoutDetails(artifact, bestBandwidth, options, {
        includeReverseNdcg: true,
        collectCalibrationPoints: final
      });
      if (final) mergeCalibrationPointMaps(productionCalibrationPoints, rawDetails.calibrationPoints);
      const rawMetrics = rawDetails.metrics;
      const metrics = final && calibrators.length
        ? evaluatePreparedHoldoutDetails(artifact, bestBandwidth, options, {
            calibratorForTaxon,
            includeReverseNdcg: true
          }).metrics
        : rawMetrics;
      folds.push({
        foldId: `year-${validationYear}`,
        role: final ? "final_holdout" : "calibration_oof",
        validationYear,
        trainingThroughYear: selection.trainingThroughYear,
        trainingReports: selection.trainingCount,
        validationReports: selection.validationCount,
        trainingCutoffDate: selection.trainingCutoffDate,
        recentFromDate: selection.recentFromDate,
        weightingPolicy: selection.weightingPolicy,
        diagnostics: selection.diagnostics,
        partialYear: validationYear === cutoffParts.year && cutoffMonthDay < "12-15",
        validationThroughDate: validationYear === cutoffParts.year ? cutoff : `${validationYear}-12-31`,
        includedInBandwidthTuning: !final,
        includedInCalibrationFit: !final,
        calibrationApplied: final && calibrators.length > 0,
        evaluationModel: "hierarchical_spatiotemporal_oof",
        baselineModel: "province_week",
        metrics,
        rawMetrics: final && calibrators.length ? rawMetrics : null
      });
    }
    const evaluatedFolds = folds.filter((fold) => fold.metrics);
    const finalPublicFold = folds.at(-1);
    const metrics = aggregateTemporalFoldMetrics(evaluatedFolds);
    const fullTrainingTaxa = temporalTrainingTaxa(artifact, Math.max(...availableYears) + 1);
    const stableProductionTaxa = productionTrainingTaxa(artifact, fullTrainingTaxa);
    const productionCalibrators = fitHierarchicalTemporalCalibrators(
      productionCalibrationPoints,
      stableProductionTaxa
    );
    return {
      bandwidthDays: bestBandwidth,
      validationYear: finalHoldoutYear,
      validationYears,
      calibrationYear: calibrationYears.at(-1) || null,
      calibrationYears,
      finalHoldoutYear,
      finalHoldout: finalPublicFold,
      folds,
      timeFoldCount: evaluatedFolds.length,
      calibrationFoldCount: evaluatedFolds.filter((fold) => fold.role === "calibration_oof").length,
      brier: finalPublicFold?.metrics?.brier ?? null,
      metrics,
      calibrators,
      productionCalibrators,
      productionCalibration: {
        strategy: "all_years_rolling_oof_after_release_gate",
        validationYears,
        scopePositiveCountsThroughYear: Math.max(...availableYears),
        calibratorCount: productionCalibrators.length,
        globallySuppressedOccurrenceCandidateTaxa: fullTrainingTaxa.length - stableProductionTaxa.length
      },
      priorStrengthsByPrevalence: priorTuning.matrix,
      priorTuning,
      bandwidthValidation,
      evaluationModel: "hierarchical_spatiotemporal_oof",
      baselineModel: "province_week",
      evaluationWeightingPolicy: TEMPORAL_EVALUATION_WEIGHTING_POLICY,
      evaluationOccurrencePolicy: RELEASE_EVALUATION_OCCURRENCE_POLICY
    };
  } finally {
    resetHoldoutTables(artifact);
  }
}

function insertCalibrators(artifact, temporal) {
  const insert = artifact.prepare(
    `INSERT INTO calibration_parameters
       (scope, scope_id, a, b, c, sample_count, positive_count, validation_year, fitted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  artifact.exec("BEGIN");
  try {
    for (const calibrator of temporal.calibrators) {
      const sampleCount = calibrator.points.reduce((sum, point) => sum + Number(point.total), 0);
      const positiveCount = calibrator.points.reduce((sum, point) => sum + Number(point.positives), 0);
      insert.run(
        calibrator.scope,
        calibrator.scopeId,
        calibrator.fit.a,
        calibrator.fit.b,
        calibrator.fit.c,
        sampleCount,
        positiveCount,
        temporal.calibrationYear,
        calibrator.fit.fitted ? 1 : 0
      );
      const updateScope = artifact.prepare("UPDATE taxa SET calibration_scope = ? WHERE taxon_id = ?");
      for (const taxonId of calibrator.taxonIds || []) {
        updateScope.run(
          calibrator.scope === "species" ? "species" : `group:${calibrator.scopeId}`,
          taxonId
        );
      }
    }
    artifact.exec("COMMIT");
  } catch (error) {
    artifact.exec("ROLLBACK");
    throw error;
  }
}

function taxonCandidatesForUnit(artifact, model, unit, globalTaxa) {
  if (["province", "city", "district"].includes(unit.level)) return globalTaxa;
  const path = [];
  let current = unit;
  while (current && current.level !== "province") {
    path.push(current.id);
    current = model.unitCache.get(current.parentId) || null;
    if (!current && unit.parentId) {
      const row = artifact.prepare("SELECT * FROM space_units WHERE id = ?").get(unit.parentId);
      current = row
        ? {
            id: row.id,
            parentId: row.parent_id,
            level: row.level
          }
        : null;
    }
  }
  const candidates = new Set(globalTaxa.slice(0, 160));
  const query = artifact.prepare("SELECT DISTINCT taxon_id FROM taxon_detection WHERE space_unit_id = ?");
  for (const unitId of path) {
    for (const row of query.all(unitId)) candidates.add(row.taxon_id);
  }
  return [...candidates];
}

function rowFromScore(score) {
  return {
    taxonId: score.taxon.taxonId,
    probability:
      score.taxon.positiveCount >= 30 && !score.taxon.vagrantCandidate
        ? score.probability
        : null,
    rankingProbability: score.probability,
    intervalLower: score.intervalLower,
    intervalUpper: score.intervalUpper,
    probabilityLevel: score.probabilityLevel,
    effectiveChecklists: score.effectiveChecklists,
    observerCount: score.observerCount,
    supportYearsJson: JSON.stringify(score.supportYears),
    confidence: score.confidence,
    fallbackLevel: score.unit.level,
    resolvedSpaceUnitId: score.unit.id
  };
}

function materializeLocationPredictions(artifact, options) {
  const model = new PredictionModel({
    database: artifact,
    testOnly: Boolean(options.testOnly),
    builderEvaluation: true
  });
  // Prime the model's unit cache so candidate path construction does not issue
  // repeated lookups and can safely follow mixed grid/administrative parents.
  for (const row of artifact.prepare("SELECT * FROM space_units").all()) {
    model.unitCache.set(row.id, {
      id: row.id,
      level: row.level,
      parentId: row.parent_id,
      supported: Boolean(row.supported),
      observerCount: row.observer_count,
      supportYears: JSON.parse(row.support_years_json || "[]")
    });
  }
  const globalTaxa = artifact
    .prepare("SELECT taxon_id FROM taxa WHERE is_sensitive = 0 ORDER BY positive_count DESC, taxon_id")
    .all()
    .map((row) => row.taxon_id);
  const units = artifact
    .prepare("SELECT id, level, parent_id FROM space_units WHERE supported = 1 ORDER BY level, id")
    .all()
    .map((row) => ({ id: row.id, level: row.level, parentId: row.parent_id }));
  const insert = artifact.prepare(
    `INSERT INTO location_predictions
       (space_unit_id, resolved_space_unit_id, temporal_granularity, season_bucket, taxon_id,
         probability, ranking_score, interval_lower, interval_upper, probability_level,
         effective_checklists, observer_count, support_years_json, confidence, fallback_level)
     VALUES (?, ?, 'week', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertReverseCandidate = artifact.prepare(
    `INSERT INTO reverse_candidates
       (taxon_id, space_unit_id, temporal_granularity, season_start_day, season_end_day,
        peak_day, rank_score, probability, interval_lower, interval_upper,
        probability_level, effective_checklists, observer_count, support_years_json, confidence)
     VALUES (?, ?, 'week', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const reverseLevels = new Set(["province", "city", "district", "grid_r6", "grid_r7"]);
  let inserted = 0;
  let reverseCandidateRows = 0;
  artifact.exec("BEGIN");
  try {
    for (let unitIndex = 0; unitIndex < units.length; unitIndex += 1) {
      const unit = units[unitIndex];
      const reverseEligible = reverseLevels.has(unit.level);
      // Reverse search must not inherit the forward Top-K truncation. Every
      // public taxon is scored for reverse-eligible units before forward rows
      // are sliced; local-only forward units retain the bounded candidate set.
      const candidates = reverseEligible
        ? globalTaxa
        : taxonCandidatesForUnit(artifact, model, unit, globalTaxa);
      const reverseRowsByTaxon = reverseEligible ? new Map() : null;
      for (let week = 1; week <= 52; week += 1) {
        const scored = [];
        for (const taxonId of candidates) {
          try {
            const row = rowFromScore(model.scoreUnitTaxonAtWeek(unit.id, taxonId, week));
            scored.push(row);
            if (reverseRowsByTaxon && row.resolvedSpaceUnitId === unit.id) {
              if (!reverseRowsByTaxon.has(row.taxonId)) reverseRowsByTaxon.set(row.taxonId, []);
              reverseRowsByTaxon.get(row.taxonId).push({
                taxon_id: row.taxonId,
                space_unit_id: unit.id,
                temporal_granularity: "week",
                season_bucket: week,
                probability: row.probability,
                interval_lower: row.intervalLower,
                interval_upper: row.intervalUpper,
                probability_level: row.probabilityLevel,
                effective_checklists: row.effectiveChecklists,
                observer_count: row.observerCount,
                support_years_json: row.supportYearsJson,
                confidence: row.confidence
              });
            }
          } catch (error) {
            if (error.code !== "INSUFFICIENT_DATA") throw error;
          }
        }
        scored.sort(
          (left, right) =>
            right.rankingProbability - left.rankingProbability ||
            right.intervalLower - left.intervalLower ||
            left.taxonId.localeCompare(right.taxonId)
        );
        for (const row of scored.slice(0, options.forwardTopK)) {
          insert.run(
            unit.id,
            row.resolvedSpaceUnitId,
            week,
            row.taxonId,
            row.probability,
            row.rankingProbability,
            row.intervalLower,
            row.intervalUpper,
            row.probabilityLevel,
            row.effectiveChecklists,
            row.observerCount,
            row.supportYearsJson,
            row.confidence,
            row.fallbackLevel
          );
          inserted += 1;
        }
      }
      if (reverseRowsByTaxon) {
        for (const rows of reverseRowsByTaxon.values()) {
          for (const window of seasonalWindows(rows)) {
            const peak = window.peak;
            insertReverseCandidate.run(
              peak.taxon_id,
              peak.space_unit_id,
              (window.firstBucket - 1) * 7 + 1,
              Math.min(365, window.lastBucket * 7),
              weekCenterDay(peak.season_bucket),
              Number(peak.interval_lower),
              peak.probability,
              peak.interval_lower,
              peak.interval_upper,
              peak.probability_level,
              peak.effective_checklists,
              peak.observer_count,
              peak.support_years_json,
              peak.confidence
            );
            reverseCandidateRows += 1;
          }
        }
      }
      if (unit.level === "point" || unit.level === "grid_r7") {
        model.releaseUnitScoreCache(unit.id);
      }
      if (unitIndex > 0 && unitIndex % 100 === 0) {
        emitProgress(options, "forward_materialization_progress", {
          completedUnits: unitIndex,
          totalUnits: units.length,
          insertedRows: inserted,
          reverseCandidateRows
        });
      }
    }
    artifact.exec("COMMIT");
  } catch (error) {
    artifact.exec("ROLLBACK");
    throw error;
  } finally {
    // The shared DatabaseSync belongs to the builder; PredictionModel does not close it.
    model.close();
  }
  return { insertedRows: inserted, reverseCandidateRows, supportedUnits: units.length };
}

function seasonalWindows(rows) {
  if (!rows.length) return [];
  const scores = rows.map((row) => Number(row.interval_lower) || 0).sort((left, right) => left - right);
  const peakScore = scores[scores.length - 1];
  const upperQuartile = scores[Math.floor((scores.length - 1) * 0.75)];
  const threshold = Math.max(peakScore * 0.65, upperQuartile);
  const selectedRows = rows.filter((row) => Number(row.interval_lower) + 1e-12 >= threshold);
  const windows = [];
  let current = null;
  for (const row of selectedRows) {
    if (!current || row.season_bucket !== current.lastBucket + 1) {
      if (current) windows.push(current);
      current = {
        firstBucket: row.season_bucket,
        lastBucket: row.season_bucket,
        peak: row
      };
    } else {
      current.lastBucket = row.season_bucket;
      if (Number(row.interval_lower) > Number(current.peak.interval_lower)) current.peak = row;
    }
  }
  if (current) windows.push(current);
  if (windows.length >= 2 && windows[0].firstBucket === 1 && windows.at(-1).lastBucket === 52) {
    const first = windows.shift();
    const last = windows.pop();
    windows.unshift({
      firstBucket: last.firstBucket,
      lastBucket: first.lastBucket,
      peak:
        Number(last.peak.interval_lower) >= Number(first.peak.interval_lower)
          ? last.peak
          : first.peak
    });
  }
  return windows;
}

function windowsOverlap(left, right) {
  const contains = (window, day) =>
    window.seasonStartDay <= window.seasonEndDay
      ? day >= window.seasonStartDay && day <= window.seasonEndDay
      : day >= window.seasonStartDay || day <= window.seasonEndDay;
  return (
    contains(left, right.seasonStartDay) ||
    contains(left, right.seasonEndDay) ||
    contains(right, left.seasonStartDay) ||
    contains(right, left.seasonEndDay)
  );
}

function seasonalWindowMask(row) {
  const mask = Array(366).fill(false);
  const start = Number(row.season_start_day);
  const end = Number(row.season_end_day);
  for (let day = 1; day <= 365; day += 1) {
    mask[day] = start <= end ? day >= start && day <= end : day >= start || day <= end;
  }
  return mask;
}

function windowsOverlapOrTouch(left, right, maximumGapDays = 7) {
  const leftMask = left._seasonMask || (left._seasonMask = seasonalWindowMask(left));
  const rightMask = right._seasonMask || (right._seasonMask = seasonalWindowMask(right));
  for (let day = 1; day <= 365; day += 1) {
    if (!leftMask[day]) continue;
    for (let offset = -maximumGapDays; offset <= maximumGapDays; offset += 1) {
      const otherDay = ((day - 1 + offset + 365) % 365) + 1;
      if (rightMask[otherDay]) return true;
    }
  }
  return false;
}

function mergedSeasonWindow(rows) {
  const days = new Set();
  for (const row of rows) {
    const mask = row._seasonMask || (row._seasonMask = seasonalWindowMask(row));
    for (let day = 1; day <= 365; day += 1) if (mask[day]) days.add(day);
  }
  const ordered = [...days].sort((left, right) => left - right);
  if (!ordered.length || ordered.length === 365) return { startDay: 1, endDay: 365 };
  let largestGap = -1;
  let gapBeforeIndex = 0;
  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index];
    const next = index === ordered.length - 1 ? ordered[0] + 365 : ordered[index + 1];
    const gap = next - current - 1;
    if (gap > largestGap) {
      largestGap = gap;
      gapBeforeIndex = index;
    }
  }
  const endDay = ordered[gapBeforeIndex];
  const startDay = ordered[(gapBeforeIndex + 1) % ordered.length];
  return { startDay, endDay };
}

function mergedHotspotBoundary(rows) {
  const coordinates = [];
  const seenUnits = new Set();
  for (const row of rows) {
    if (seenUnits.has(row.space_unit_id)) continue;
    seenUnits.add(row.space_unit_id);
    let boundary = null;
    try {
      boundary = row.boundary_json ? JSON.parse(row.boundary_json) : null;
    } catch {
      boundary = null;
    }
    if (Array.isArray(boundary)) {
      for (const pair of boundary) {
        if (Array.isArray(pair) && Number.isFinite(Number(pair[0])) && Number.isFinite(Number(pair[1]))) {
          coordinates.push([Number(pair[0]), Number(pair[1])]);
        }
      }
    } else if (Number.isFinite(Number(row.centroid_longitude)) && Number.isFinite(Number(row.centroid_latitude))) {
      coordinates.push([Number(row.centroid_longitude), Number(row.centroid_latitude)]);
    }
  }
  if (!coordinates.length) return null;
  const longitudes = coordinates.map((pair) => pair[0]);
  const latitudes = coordinates.map((pair) => pair[1]);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  return [
    [minLongitude, minLatitude],
    [maxLongitude, minLatitude],
    [maxLongitude, maxLatitude],
    [minLongitude, maxLatitude],
    [minLongitude, minLatitude]
  ];
}

function buildReverseHotspots(artifact, options) {
  const insertFinal = artifact.prepare(
    `INSERT INTO reverse_hotspots
       (taxon_id, space_unit_id, temporal_granularity, season_start_day, season_end_day,
        peak_day, rank_score, probability, interval_lower, interval_upper,
         probability_level, effective_checklists, observer_count, support_years_json, confidence,
         member_space_unit_ids_json, hotspot_boundary_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  let inserted = 0;
  let mergedComponents = 0;
  const flushTaxon = (rows) => {
    if (!rows.length) return;
    const parents = rows.map((_, index) => index);
    const find = (index) => {
      while (parents[index] !== index) {
        parents[index] = parents[parents[index]];
        index = parents[index];
      }
      return index;
    };
    const union = (left, right) => {
      const leftRoot = find(left);
      const rightRoot = find(right);
      if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
    };
    const byUnit = new Map();
    rows.forEach((row, index) => {
      if (!byUnit.has(row.space_unit_id)) byUnit.set(row.space_unit_id, []);
      byUnit.get(row.space_unit_id).push(index);
    });
    rows.forEach((row, index) => {
      if (!["grid_r6", "grid_r7"].includes(row.level)) return;
      for (const neighborId of neighboringGridCellIds(row.space_unit_id)) {
        for (const otherIndex of byUnit.get(neighborId) || []) {
          if (otherIndex <= index || rows[otherIndex].level !== row.level) continue;
          if (windowsOverlapOrTouch(row, rows[otherIndex])) union(index, otherIndex);
        }
      }
    });
    const components = new Map();
    rows.forEach((row, index) => {
      const root = find(index);
      if (!components.has(root)) components.set(root, []);
      components.get(root).push(row);
    });
    const ranked = [...components.values()]
      .map((componentRows) => {
        const representative = [...componentRows].sort(
          (left, right) => Number(right.rank_score) - Number(left.rank_score) ||
            left.space_unit_id.localeCompare(right.space_unit_id)
        )[0];
        return { componentRows, representative, window: mergedSeasonWindow(componentRows) };
      })
      .sort((left, right) => Number(right.representative.rank_score) - Number(left.representative.rank_score));
    for (const component of ranked.slice(0, options.reverseTopK)) {
      const row = component.representative;
      const memberIds = [...new Set(component.componentRows.map((item) => item.space_unit_id))].sort();
      if (memberIds.length > 1) mergedComponents += 1;
      insertFinal.run(
        row.taxon_id,
        row.space_unit_id,
        row.temporal_granularity,
        component.window.startDay,
        component.window.endDay,
        row.peak_day,
        row.rank_score,
        row.probability,
        row.interval_lower,
        row.interval_upper,
        row.probability_level,
        row.effective_checklists,
        row.observer_count,
        row.support_years_json,
        row.confidence,
        JSON.stringify(memberIds),
        JSON.stringify(mergedHotspotBoundary(component.componentRows))
      );
      inserted += 1;
    }
  };
  let currentTaxon = null;
  let rows = [];
  for (const row of artifact
    .prepare(
      `SELECT candidates.*, units.level, units.boundary_json,
              units.centroid_longitude, units.centroid_latitude
       FROM reverse_candidates candidates
       JOIN space_units units ON units.id = candidates.space_unit_id
       ORDER BY candidates.taxon_id, candidates.space_unit_id, candidates.season_start_day`
    )
    .iterate()) {
    if (currentTaxon !== null && row.taxon_id !== currentTaxon) {
      flushTaxon(rows);
      rows = [];
    }
    currentTaxon = row.taxon_id;
    rows.push(row);
  }
  flushTaxon(rows);
  artifact.exec("DROP TABLE reverse_candidates");
  return { insertedRows: inserted, mergedComponents };
}

function dropTrainingTables(artifact) {
  artifact.exec(`
    DROP TABLE training_detections;
    DROP TABLE training_reports;
    DROP TABLE taxon_catalog;
    DROP TABLE training_taxon_event_summary;
    DROP TABLE occurrence_events;
    PRAGMA optimize;
  `);
}

function validateArtifact(artifact, options = {}) {
  const integrity = artifact.prepare("PRAGMA integrity_check").get().integrity_check;
  if (integrity !== "ok") {
    throw new PredictionBuildError("ARTIFACT_INTEGRITY_FAILED", `模型 SQLite 完整性检查失败：${integrity}`);
  }
  const province = artifact.prepare("SELECT * FROM space_units WHERE id = 'province:zhejiang'").get();
  const taxonCount = Number(artifact.prepare("SELECT COUNT(*) AS count FROM taxa").get().count) || 0;
  const predictionCount = Number(artifact.prepare("SELECT COUNT(*) AS count FROM location_predictions").get().count) || 0;
  const reverseHotspotCount = Number(artifact.prepare("SELECT COUNT(*) AS count FROM reverse_hotspots").get().count) || 0;
  const temporaryTableCount = Number(
    artifact
      .prepare(
        `SELECT COUNT(*) AS count FROM sqlite_master
         WHERE type = 'table' AND name IN (
           'training_reports', 'training_detections', 'taxon_catalog',
           'training_taxon_event_summary', 'occurrence_events', 'reverse_candidates'
         )`
      )
      .get().count
  ) || 0;
  const freePages = Number(artifact.prepare("PRAGMA freelist_count").get().freelist_count) || 0;
  if (!province?.supported || taxonCount === 0 || (options.requireOnlineIndexes && predictionCount === 0)) {
    throw new PredictionBuildError("ARTIFACT_EMPTY", "模型制品缺少省级支持、鸟种或正向预测。", {
      provinceSupported: Boolean(province?.supported),
      taxonCount,
      predictionCount
    });
  }
  if (options.requireOnlineIndexes) {
    const supportedUnitCount = Number(
      artifact.prepare("SELECT COUNT(*) AS count FROM space_units WHERE supported = 1").get().count
    ) || 0;
    const forwardBucketCount = Number(
      artifact.prepare(
        `SELECT COUNT(*) AS count FROM (
           SELECT space_unit_id, season_bucket
           FROM location_predictions
           WHERE temporal_granularity = 'week'
           GROUP BY space_unit_id, season_bucket
         )`
      ).get().count
    ) || 0;
    const publicTaxonCount = Number(
      artifact.prepare("SELECT COUNT(*) AS count FROM taxa WHERE is_sensitive = 0").get().count
    ) || 0;
    const reverseTaxonCount = Number(
      artifact.prepare("SELECT COUNT(DISTINCT taxon_id) AS count FROM reverse_hotspots").get().count
    ) || 0;
    if (
      forwardBucketCount !== supportedUnitCount * 52 ||
      reverseHotspotCount === 0 ||
      reverseTaxonCount !== publicTaxonCount
    ) {
      throw new PredictionBuildError("ONLINE_INDEX_INCOMPLETE", "正式制品的正向预测或反向热点索引不完整。", {
        supportedUnitCount,
        expectedForwardBucketCount: supportedUnitCount * 52,
        forwardBucketCount,
        publicTaxonCount,
        reverseTaxonCount,
        reverseHotspotCount
      });
    }
  }
  if (temporaryTableCount || freePages) {
    throw new PredictionBuildError("ARTIFACT_NOT_SANITIZED", "模型制品仍含临时训练表或空闲页。", {
      temporaryTableCount,
      freePages
    });
  }
  return {
    taxonCount,
    predictionCount,
    reverseHotspotCount,
    freePages,
    materializationProfile: options.materializationProfile || "full"
  };
}

function summarizeCalibrators(calibrators = []) {
  return {
    count: calibrators.length,
    fittedCount: calibrators.filter((item) => item.fit?.fitted).length,
    speciesCount: calibrators.filter((item) => item.scope === "species").length,
    groupCount: calibrators.filter((item) => item.scope === "group").length,
    scopes: calibrators.map((item) => ({
      scope: item.scope,
      scopeId: item.scopeId,
      fitted: Boolean(item.fit?.fitted),
      taxonCount: item.taxonIds?.length || 0,
      sampleWeight: (item.points || []).reduce((sum, point) => sum + Number(point.total || 0), 0),
      positiveWeight: (item.points || []).reduce((sum, point) => sum + Number(point.positives || 0), 0)
    }))
  };
}

function temporalAnalysisSummary(temporal) {
  return {
    bandwidthDays: temporal.bandwidthDays,
    evaluationModel: temporal.evaluationModel,
    baselineModel: temporal.baselineModel,
    evaluationWeightingPolicy: temporal.evaluationWeightingPolicy,
    evaluationOccurrencePolicy: temporal.evaluationOccurrencePolicy,
    validationYears: temporal.validationYears,
    calibrationYears: temporal.calibrationYears,
    finalHoldoutYear: temporal.finalHoldoutYear,
    timeFoldCount: temporal.timeFoldCount,
    calibrationFoldCount: temporal.calibrationFoldCount,
    metrics: temporal.metrics,
    folds: temporal.folds,
    finalHoldout: temporal.finalHoldout,
    bandwidthValidation: temporal.bandwidthValidation,
    priorStrengthsByPrevalence: temporal.priorStrengthsByPrevalence,
    priorTuning: temporal.priorTuning,
    releaseCalibrators: summarizeCalibrators(temporal.calibrators),
    productionCalibrators: summarizeCalibrators(temporal.productionCalibrators)
  };
}

async function buildPredictionArtifact(options = {}) {
  const buildStartedAt = Date.now();
  const resolvedOptions = mergeOptions(options);
  resolvedOptions.implementationSha256 = predictionImplementationSha256();
  if (!resolvedOptions.sourcePath || !resolvedOptions.snapshotPath || !resolvedOptions.outputPath) {
    throw new PredictionBuildError("INVALID_OPTIONS", "必须提供 sourcePath、snapshotPath 和 outputPath。" );
  }
  validateBuildSafetyOptions(resolvedOptions);
  if (!resolvedOptions.coordinateSystemConfirmed) {
    throw new PredictionBuildError(
      "COORDINATE_CONFIRMATION_REQUIRED",
      "必须先抽样复核坐标并传入 coordinateSystemConfirmed=true（CLI: --confirm-coordinate-system bd09）。"
    );
  }
  const outputPath = resolve(resolvedOptions.outputPath);
  if (existsSync(outputPath)) {
    throw new PredictionBuildError("OUTPUT_EXISTS", `模型输出已存在：${outputPath}`);
  }
  if (resolvedOptions.writeSpatialOofCachePath !== undefined) {
    const normalizePath = (path) => {
      const normalized = resolve(path);
      return process.platform === "win32" ? normalized.toLowerCase() : normalized;
    };
    const cachePath = resolve(resolvedOptions.writeSpatialOofCachePath);
    const cachePaths = [cachePath, `${cachePath}.sha256`].map(normalizePath);
    const reportPath = resolve(resolvedOptions.reportPath || `${outputPath}.report.json`);
    const reservedPaths = [
      resolvedOptions.sourcePath,
      resolvedOptions.snapshotPath,
      outputPath,
      `${outputPath}.sha256`,
      `${outputPath}.building-${process.pid}`,
      reportPath,
      `${reportPath}.sha256`,
      resolvedOptions.pointerPath
    ].filter(Boolean).map(normalizePath);
    if (cachePaths.some((path) => reservedPaths.includes(path))) {
      throw new PredictionBuildError(
        "SPATIAL_OOF_CACHE_PATH_CONFLICT",
        "空间 OOF 缓存及其校验文件不得与训练输入、模型、报告或发布指针共用路径。"
      );
    }
    if (existsSync(cachePath) || existsSync(`${cachePath}.sha256`)) {
      throw new PredictionBuildError(
        "SPATIAL_OOF_CACHE_OUTPUT_EXISTS",
        `空间 OOF 缓存输出或其校验文件已存在：${cachePath}`
      );
    }
    resolvedOptions.writeSpatialOofCachePath = cachePath;
  }
  mkdirSync(dirname(outputPath), { recursive: true });
  const snapshot = resolvedOptions.sourceIsSnapshot
    ? { snapshotPath: resolve(resolvedOptions.sourcePath), sha256: sha256File(resolvedOptions.sourcePath) }
    : await createTrainingSnapshot(resolvedOptions);
  resolvedOptions.sourceSnapshotSha256 = snapshot.sha256;
  if (resolvedOptions.spatialSplitManifestPath) {
    resolvedOptions.verifiedSpatialSplit = verifySpatialSplitManifest({
      manifestPath: resolvedOptions.spatialSplitManifestPath,
      sourceSnapshotSha256: snapshot.sha256,
      panelName: resolvedOptions.spatialEvaluationPanel || "development",
      sealedPanelConfirmation: resolvedOptions.sealedSpatialPanelConfirmation || null
    });
  }
  if (
    resolvedOptions.writeSpatialOofCachePath !== undefined &&
    (
      resolvedOptions.verifiedSpatialSplit?.panelName !== "development" ||
      Number(resolvedOptions.verifiedSpatialSplit?.panel?.folds?.length) !== 5
    )
  ) {
    throw new PredictionBuildError(
      "SPATIAL_OOF_CACHE_SPLIT_INVALID",
      "空间 OOF 缓存要求通过校验的冻结 development 五折 split manifest。"
    );
  }
  if (resolvedOptions.spatialParametersPath) {
    if (!resolvedOptions.verifiedSpatialSplit) {
      throw new PredictionBuildError(
        "SPATIAL_SPLIT_REQUIRED",
        "加载冻结空间参数时必须同时提供冻结 spatial split manifest。"
      );
    }
    if (
      resolvedOptions.verifiedSpatialSplit.panelName === "development" &&
      !resolvedOptions.sealedEvaluationReceiptPath
    ) {
      throw new PredictionBuildError(
        "DEVELOPMENT_PARAMETER_LEAKAGE",
        "development 面板禁止加载已拟合空间参数；必须继续使用交叉拟合。"
      );
    }
    resolvedOptions.verifiedSpatialParameters = loadSpatialParameterArtifact(
      resolvedOptions.spatialParametersPath,
      {
        sourceSnapshotSha256: snapshot.sha256,
        spatialSplitManifestHash: resolvedOptions.verifiedSpatialSplit.manifestHash
      }
    );
    resolvedOptions.novelGridAdminExposureCapsByPrevalence =
      resolvedOptions.verifiedSpatialParameters.artifact.adminExposureCapsByPrevalence;
  }
  if (
    resolvedOptions.verifiedSpatialSplit?.panelName === "sealed-release" &&
    !resolvedOptions.verifiedSpatialParameters
  ) {
    throw new PredictionBuildError(
      "SPATIAL_PARAMETERS_REQUIRED",
      "sealed release 五折必须加载已经通过 development 门槛并冻结的空间参数制品。"
    );
  }
  if (resolvedOptions.sealedEvaluationReceiptPath) {
    if (
      resolvedOptions.verifiedSpatialSplit?.panelName !== "development" ||
      !resolvedOptions.verifiedSpatialParameters
    ) {
      throw new PredictionBuildError(
        "FORMAL_BUILD_INPUTS_INVALID",
        "正式 full 构建复用密封收据时，必须以 development 方式校验同一 split manifest，并加载冻结空间参数。"
      );
    }
    if ((resolvedOptions.materializationProfile || "full") !== "full" || resolvedOptions.testOnly) {
      throw new PredictionBuildError(
        "FORMAL_BUILD_REQUIRES_FULL_MATERIALIZATION",
        "密封评估收据只能用于非 testOnly 的完整线上索引物化。"
      );
    }
    resolvedOptions.verifiedSealedEvaluationReceipt = loadSealedEvaluationReceipt(
      resolvedOptions.sealedEvaluationReceiptPath,
      {
        sourceSnapshotSha256: snapshot.sha256,
        spatialSplitManifestHash: resolvedOptions.verifiedSpatialSplit.manifestHash,
        spatialParameterFileSha256: resolvedOptions.verifiedSpatialParameters.fileSha256,
        implementationSha256: resolvedOptions.implementationSha256
      }
    );
  }
  const source = new DatabaseSync(snapshot.snapshotPath, { readOnly: true });
  source.exec("PRAGMA query_only = ON");
  let artifact = null;
  const temporaryOutput = `${outputPath}.building-${process.pid}`;
  safeUnlink(temporaryOutput);
  try {
    assertSourceSchema(source);
    const sourceContract = assertTrainingSourceContract(source);
    emitProgress(resolvedOptions, "quality_gate_started");
    const quality = inspectSnapshotQuality(source, resolvedOptions);
    emitProgress(resolvedOptions, "quality_gate_passed", quality.report);
    resolvedOptions.dataCutoffDate = quality.report.dataCutoffDate;
    artifact = new DatabaseSync(temporaryOutput);
    createArtifactSchema(artifact);
    emitProgress(resolvedOptions, "training_rows_started");
    const training = insertTrainingRows(
      source,
      artifact,
      quality.pointStats,
      quality.report,
      resolvedOptions
    );
    emitProgress(resolvedOptions, "occurrence_event_analysis_started");
    const occurrenceEvents = analyzeOccurrenceEvents(artifact, resolvedOptions);
    emitProgress(resolvedOptions, "occurrence_event_analysis_ready", occurrenceEvents);
    const summaries = aggregateUnitSummaries(artifact, resolvedOptions);
    insertSpaceUnits(artifact, training.registry, summaries);
    insertTaxa(artifact);
    aggregateTrainingStatistics(artifact);
    emitProgress(resolvedOptions, "temporal_validation_started");
    const temporal = tuneTemporalModel(artifact, resolvedOptions);
    const sealedReceipt = resolvedOptions.verifiedSealedEvaluationReceipt || null;
    emitProgress(
      resolvedOptions,
      sealedReceipt ? "sealed_spatial_receipt_loaded" : "spatial_holdout_started",
      sealedReceipt ? { receiptFileSha256: sealedReceipt.fileSha256 } : undefined
    );
    const spatial = resolvedOptions.qualityGate.requireSpatialHoldout
      ? sealedReceipt
        ? structuredClone(sealedReceipt.receipt.spatialEvaluation)
        : await evaluateSpatialHoldout(artifact, temporal, resolvedOptions)
      : null;
    emitProgress(resolvedOptions, "observer_holdout_started");
    const observer = resolvedOptions.qualityGate.requireObserverHoldout
      ? evaluateObserverHoldout(artifact, temporal, resolvedOptions)
      : null;
    const releaseQuality = evaluateReleaseQuality({ temporal, spatial, observer }, resolvedOptions);
    const artifactCalibrators = releaseQuality.passed
      ? temporal.productionCalibrators || temporal.calibrators
      : temporal.calibrators;
    insertCalibrators(artifact, {
      ...temporal,
      calibrators: artifactCalibrators,
      calibrationYear: releaseQuality.passed ? temporal.finalHoldoutYear : temporal.calibrationYear
    });
    const modelVersion =
      resolvedOptions.modelVersion ||
      `zhejiang-${quality.report.dataCutoffDate.replaceAll("-", "")}-${snapshot.sha256.slice(0, 12)}`;
    const coverage = {
      ...quality.report,
      insertedTrainingReports: training.stats.insertedReports,
      duplicateReportsRemoved: training.stats.duplicateReports,
      observerIdCoverage: training.stats.knownObserverCoverage,
      excludedInvalidDetections: training.stats.excludedInvalidDetections,
      storedRedDetectionsExcluded: sourceContract.storedRedCount,
      storedOutsideTypeDetectionsExcluded: sourceContract.storedOutsideCount,
      sourceGeneration: sourceContract.sourceGeneration,
      occurrenceEventCandidates: occurrenceEvents.candidateTaxa,
      supportedUnits: [...summaries.values()].filter((summary) => summary.supported).length
    };
    manifestSet(artifact, "schema_version", SCHEMA_VERSION);
    manifestSet(artifact, "model_version", modelVersion);
    manifestSet(artifact, "implementation_sha256", resolvedOptions.implementationSha256);
    manifestSet(artifact, "built_at", new Date().toISOString());
    manifestSet(artifact, "data_cutoff_date", quality.report.dataCutoffDate);
    manifestSet(artifact, "probability_definition", PROBABILITY_DEFINITION);
    manifestSet(artifact, "source_snapshot_sha256", snapshot.sha256);
    manifestSet(artifact, "training_data_contract", TRAINING_DATA_CONTRACT);
    manifestSet(artifact, "source_contract", sourceContract);
    manifestSet(artifact, "input_features", ["calendar_date", "location"]);
    manifestSet(artifact, "weather_features", {
      championIncluded: false,
      reason: "首版避免未来实际天气不可得造成训练-服务偏移；历史天气仅作后续 challenger 可行性分析。"
    });
    manifestSet(artifact, "source_coordinate_system", "BD-09");
    manifestSet(artifact, "output_coordinate_system", "WGS84");
    manifestSet(artifact, "grid_algorithm", "h3_v4");
    manifestSet(artifact, "grid_resolutions", { grid_r7: 7, grid_r6: 6 });
    manifestSet(artifact, "administrative_coverage_index", "observed_admin_bbox_v1");
    manifestSet(artifact, "temporal_bandwidth_days", temporal.bandwidthDays);
    manifestSet(artifact, "temporal_evaluation_model", temporal.evaluationModel);
    manifestSet(artifact, "temporal_baseline_model", temporal.baselineModel);
    manifestSet(
      artifact,
      "temporal_evaluation_weighting_policy",
      TEMPORAL_EVALUATION_WEIGHTING_POLICY
    );
    manifestSet(
      artifact,
      "release_evaluation_occurrence_policy",
      RELEASE_EVALUATION_OCCURRENCE_POLICY
    );
    manifestSet(artifact, "coordinate_qc_evaluation_scope", COORDINATE_QC_EVALUATION_SCOPE);
    manifestSet(artifact, "temporal_validation_year", temporal.validationYear);
    manifestSet(artifact, "temporal_validation_years", temporal.validationYears);
    manifestSet(artifact, "temporal_calibration_years", temporal.calibrationYears);
    manifestSet(artifact, "temporal_final_holdout_year", temporal.finalHoldoutYear);
    manifestSet(artifact, "temporal_validation_brier", temporal.brier ?? null);
    // Materialization reuses the production runtime against this private
    // in-progress database. Give that temporary database an explicit passing
    // build marker, then overwrite it with the real release decision before
    // the artifact can leave its `.building-*` path.
    manifestSet(artifact, "quality_gate", { passed: true, internalBuild: true });
    manifestSet(artifact, "test_only", Boolean(resolvedOptions.testOnly));
    manifestSet(artifact, "evaluation_workers", resolvedOptions.workers);
    manifestSet(artifact, "worker_task_chunk_records", resolvedOptions.workerTaskChunkRecords);
    manifestSet(
      artifact,
      "novel_grid_admin_exposure_caps_by_prevalence",
      resolvedOptions.novelGridAdminExposureCapsByPrevalence || null
    );
    const novelGridSpatialCalibrators =
      resolvedOptions.verifiedSpatialParameters?.artifact?.calibrators ||
      spatial?.spatialCalibration?.productionCalibrators ||
      [];
    manifestSet(
      artifact,
      "novel_grid_spatial_calibration_enabled",
      novelGridSpatialCalibrators.length > 0
    );
    manifestSet(artifact, "novel_grid_spatial_calibrators", novelGridSpatialCalibrators);
    manifestSet(
      artifact,
      "novel_grid_spatial_parameter_source",
      resolvedOptions.verifiedSpatialParameters
        ? {
            path: resolvedOptions.verifiedSpatialParameters.path,
            fileSha256: resolvedOptions.verifiedSpatialParameters.fileSha256,
            developmentReportSha256:
              resolvedOptions.verifiedSpatialParameters.artifact.developmentReportSha256,
            spatialSplitManifestHash:
              resolvedOptions.verifiedSpatialParameters.artifact.spatialSplitManifestHash
          }
        : null
    );
    manifestSet(
      artifact,
      "sealed_evaluation_receipt",
      resolvedOptions.verifiedSealedEvaluationReceipt
        ? {
            path: resolvedOptions.verifiedSealedEvaluationReceipt.path,
            fileSha256: resolvedOptions.verifiedSealedEvaluationReceipt.fileSha256,
            sealedReportSha256:
              resolvedOptions.verifiedSealedEvaluationReceipt.receipt.sealedReportSha256,
            implementationSha256:
              resolvedOptions.verifiedSealedEvaluationReceipt.receipt.implementationSha256
          }
        : null
    );
    manifestSet(artifact, "prior_strengths", resolvedOptions.priorStrengths);
    manifestSet(
      artifact,
      "prior_strengths_by_prevalence",
      temporal.priorStrengthsByPrevalence || initialPriorStrengthMatrix(resolvedOptions)
    );
    manifestSet(artifact, "prior_strength_tuning", temporal.priorTuning || null);
    manifestSet(artifact, "coverage", coverage);
    manifestSet(artifact, "occurrence_event_policy", occurrenceEvents.definition);
    manifestSet(artifact, "occurrence_event_summary", occurrenceEvents);
    manifestSet(
      artifact,
      "public_training_filter",
      "完整 normal + (保存有效鸟种数 + outside_count = 申报数) 的 flagged；逐条剔除 is_red_species=1 或 source_outside_type=1"
    );
    const materializationProfile = resolvedOptions.materializationProfile || "full";
    manifestSet(artifact, "forward_top_k", resolvedOptions.forwardTopK);
    manifestSet(artifact, "reverse_top_k", resolvedOptions.reverseTopK);
    manifestSet(artifact, "materialization_profile", materializationProfile);
    manifestSet(artifact, "online_indexes_complete", materializationProfile === "full");
    let forward;
    let reverse;
    if (materializationProfile === "full") {
      emitProgress(resolvedOptions, "forward_materialization_started");
      forward = materializeLocationPredictions(artifact, resolvedOptions);
      emitProgress(resolvedOptions, "reverse_index_started");
      reverse = buildReverseHotspots(artifact, resolvedOptions);
    } else {
      forward = { skipped: true, reason: "development_evaluation_only" };
      reverse = { skipped: true, reason: "development_evaluation_only" };
      artifact.exec("DROP TABLE reverse_candidates");
      emitProgress(resolvedOptions, "online_materialization_skipped", {
        reason: "development_evaluation_only"
      });
    }
    const occurrenceCandidateDetails = artifact.prepare(`
      SELECT taxon_id, common_name, scientific_name, positive_count, observer_count,
             raw_positive_reports, effective_positive_units, event_count,
             support_year_count, dominant_event_share, event_dominated,
             single_support_year, vagrant_reason
      FROM taxa
      WHERE vagrant_candidate = 1
      ORDER BY dominant_event_share DESC, raw_positive_reports DESC, taxon_id
    `).all();
    manifestSet(artifact, "quality_gate", releaseQuality);
    manifestSet(
      artifact,
      "calibration_training",
      releaseQuality.passed ? temporal.productionCalibration : {
        strategy: "pre_final_oof_for_unreleased_artifact",
        validationYears: temporal.calibrationYears
      }
    );
    dropTrainingTables(artifact);
    artifact.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    artifact.exec("PRAGMA journal_mode = DELETE");
    // DROP only releases pages; VACUUM rebuilds the database so report ids,
    // observer hashes and point-level training rows cannot survive in freelist pages.
    artifact.exec("VACUUM");
    artifact.exec("PRAGMA optimize");
    const validation = validateArtifact(artifact, {
      requireOnlineIndexes: materializationProfile === "full",
      materializationProfile
    });
    artifact.close();
    artifact = null;
    source.close();
    renameSync(temporaryOutput, outputPath);
    try {
      chmodSync(outputPath, 0o444);
    } catch {
      // Windows ACLs may ignore POSIX mode bits; runtime still opens read-only/query_only.
    }
    const artifactSha256 = sha256File(outputPath);
    writeFileSync(`${outputPath}.sha256`, `${artifactSha256}  ${outputPath.split(/[\\/]/).pop()}\n`, "utf8");
    const reportPath = resolve(resolvedOptions.reportPath || `${outputPath}.report.json`);
    const analysisReport = {
      schemaVersion: 1,
      reportType: "zhejiang_bird_spatiotemporal_model_analysis",
      generatedAt: new Date().toISOString(),
      buildDurationSeconds: (Date.now() - buildStartedAt) / 1000,
      model: {
        modelVersion,
        outputPath,
        artifactSha256,
        implementationSha256: resolvedOptions.implementationSha256,
        sealedEvaluationReceiptSha256:
          resolvedOptions.verifiedSealedEvaluationReceipt?.fileSha256 || null,
        schemaVersion: SCHEMA_VERSION,
        releaseEligible: releaseQuality.passed,
        probabilityDefinition: PROBABILITY_DEFINITION,
        inputFeatures: ["calendar_date", "location"],
        weatherIncluded: false
      },
      source: {
        snapshotPath: snapshot.snapshotPath,
        snapshotSha256: snapshot.sha256,
        snapshotManifestPath: snapshot.manifestPath || null,
        trainingDataContract: TRAINING_DATA_CONTRACT,
        sourceContract,
        dataStartDate: quality.report.dataStartDate,
        dataCutoffDate: quality.report.dataCutoffDate
      },
      dataQuality: coverage,
      occurrenceEvents: {
        ...occurrenceEvents,
        candidates: occurrenceCandidateDetails
      },
      releaseQuality,
      temporal: temporalAnalysisSummary(temporal),
      spatial,
      observer,
      materialization: { forward, reverse, validation },
      hyperparameters: {
        recencyHalfLifeYears: resolvedOptions.recencyHalfLifeYears,
        localHistoryYears: resolvedOptions.localHistoryYears,
        bandwidthCandidates: resolvedOptions.bandwidthCandidates,
        priorTuningContextSampleModulo: resolvedOptions.priorTuningContextSampleModulo,
        outerPriorTuningContextSampleModulo: resolvedOptions.outerPriorTuningContextSampleModulo,
        outerCalibrationContextSampleModulo: resolvedOptions.outerCalibrationContextSampleModulo,
        workers: resolvedOptions.workers,
        workerTaskChunkRecords: resolvedOptions.workerTaskChunkRecords,
        unitThresholds: resolvedOptions.unitThresholds,
        priorStrengths: resolvedOptions.priorStrengths,
        qualityGate: resolvedOptions.qualityGate,
        holdoutEvaluation: resolvedOptions.holdoutEvaluation
      },
      interpretation: {
        probability: PROBABILITY_DEFINITION,
        independentTaxa: true,
        temporalEvaluationWeightingPolicy: TEMPORAL_EVALUATION_WEIGHTING_POLICY,
        releaseEvaluationOccurrencePolicy: RELEASE_EVALUATION_OCCURRENCE_POLICY,
        coordinateQcEvaluationScope: COORDINATE_QC_EVALUATION_SCOPE,
        coordinateQcNote: "点位漂移属于固定快照的目标无关质量过滤，未在每个留出折内重新拟合；不使用鸟种标签。",
        vagrantCandidateLabel: "偶发/追鸟聚集候选",
        vagrantCandidateProbabilitySuppressed: true,
        rareUnder30ProbabilitySuppressed: true,
        weatherNote: "天气不进入首版 champion；历史天气只适合作为后续离线 challenger，并需避免未来实况不可得造成的训练-服务偏移。"
      }
    };
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify(analysisReport, null, 2)}\n`, "utf8");
    const reportSha256 = sha256File(reportPath);
    writeFileSync(`${reportPath}.sha256`, `${reportSha256}  ${reportPath.split(/[\\/]/).pop()}\n`, "utf8");
    const published = resolvedOptions.pointerPath && releaseQuality.passed
      ? publishModelPointer(resolvedOptions.pointerPath, outputPath, {
          modelVersion,
          artifactSha256,
          sourceSnapshotSha256: snapshot.sha256,
          beforePointerCommit: resolvedOptions.beforePointerCommit
        })
      : null;
    if (resolvedOptions.pointerPath && !releaseQuality.passed) {
      emitProgress(resolvedOptions, "publication_blocked", {
        modelVersion,
        failures: releaseQuality.failures
      });
    }
    emitProgress(resolvedOptions, "artifact_ready", {
      outputPath,
      artifactSha256,
      reportPath,
      reportSha256,
      modelVersion,
      ...validation,
      forwardRows: forward.insertedRows,
      reverseRows: reverse.insertedRows
    });
    return {
      outputPath,
      artifactSha256,
      reportPath,
      reportSha256,
      snapshotPath: snapshot.snapshotPath,
      snapshotSha256: snapshot.sha256,
      modelVersion,
      dataCutoffDate: quality.report.dataCutoffDate,
      quality: coverage,
      releaseQuality,
      releaseEligible: releaseQuality.passed,
      temporal,
      occurrenceEvents,
      forward,
      reverse,
      validation,
      published
    };
  } catch (error) {
    if (artifact) artifact.close();
    try {
      source.close();
    } catch {
      // already closed
    }
    safeUnlink(temporaryOutput);
    throw error;
  }
}

function parseCliArguments(argv) {
  const projectRoot = resolve(__dirname, "..");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const options = {
    sourcePath: join(projectRoot, "data", "birdreport-zhejiang.sqlite"),
    snapshotPath: join(projectRoot, "data", "prediction-snapshots", `zhejiang-${timestamp}.sqlite`),
    outputPath: join(projectRoot, "data", "prediction-models", `zhejiang-${timestamp}.sqlite`),
    pointerPath: null,
    coordinateSystemConfirmed: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = () => {
      index += 1;
      if (index >= argv.length) throw new PredictionBuildError("INVALID_OPTIONS", `${argument} 缺少值。`);
      return argv[index];
    };
    if (argument === "--source") options.sourcePath = value();
    else if (argument === "--source-is-snapshot") options.sourceIsSnapshot = true;
    else if (argument === "--snapshot") options.snapshotPath = value();
    else if (argument === "--output") options.outputPath = value();
    else if (argument === "--pointer") options.pointerPath = value();
    else if (argument === "--no-publish") options.pointerPath = null;
    else if (argument === "--model-version") options.modelVersion = value();
    else if (argument === "--spatial-split-manifest") options.spatialSplitManifestPath = value();
    else if (argument === "--spatial-panel") options.spatialEvaluationPanel = value();
    else if (argument === "--spatial-parameters") options.spatialParametersPath = value();
    else if (argument === "--sealed-evaluation-receipt") options.sealedEvaluationReceiptPath = value();
    else if (argument === "--confirm-open-sealed-spatial-panel") options.sealedSpatialPanelConfirmation = value();
    else if (argument === "--write-spatial-oof-cache") options.writeSpatialOofCachePath = value();
    else if (argument === "--forward-top-k") options.forwardTopK = Number(value());
    else if (argument === "--workers") options.workers = Number(value());
    else if (argument === "--evaluation-only") {
      options.testOnly = true;
      options.materializationProfile = "evaluation-only";
      options.pointerPath = null;
    }
    else if (argument === "--confirm-coordinate-system") {
      const coordinateSystem = String(value()).toLowerCase();
      if (coordinateSystem !== "bd09" && coordinateSystem !== "bd-09") {
        throw new PredictionBuildError("INVALID_OPTIONS", "首版源坐标只支持确认 bd09。" );
      }
      options.coordinateSystemConfirmed = true;
    } else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new PredictionBuildError("INVALID_OPTIONS", `未知参数：${argument}`);
  }
  return options;
}

function usage() {
  return `浙江 BirdReport 季节检出率模型构建器

用法：
  node tools/build-zhejiang-prediction-model.js \\
    --source data/birdreport-zhejiang.sqlite \\
    --snapshot data/prediction-snapshots/zhejiang-YYYYMMDD.sqlite \\
    --output data/prediction-models/zhejiang-YYYYMMDD.sqlite \\
    --spatial-split-manifest docs/zhejiang-v1-20260715-spatial-splits.json \\
    --spatial-panel development \\
    --write-spatial-oof-cache data/prediction-models/zhejiang-development-spatial-oof-cache.sqlite \\
    --workers 4 \\
    --evaluation-only \\
    --no-publish \\
    --confirm-coordinate-system bd09

复用已有快照时，把 --source 指向快照并增加 --source-is-snapshot；该模式不会再次复制源库。

构建器使用 SQLite 在线备份固定只读训练截止点；活动爬虫后续新增数据自动留到下一版。
普通报告必须逐份完整；标红报告只纳入可核对完整的未标红鸟种。坐标覆盖不足或未确认坐标系时安全拒绝。`;
}

function cliMetricSummary(metrics) {
  if (!metrics) return null;
  return Object.fromEntries(
    [
      "brier",
      "baselineBrier",
      "brierSkill",
      "ece",
      "recallAt20",
      "baselineRecallAt20",
      "recallAt20Delta",
      "reverseNdcgAt10",
      "baselineReverseNdcgAt10",
      "reverseNdcgLift",
      "evaluatedWeight",
      "evaluatedTaxa"
    ]
      .filter((key) => metrics[key] !== undefined)
      .map((key) => [key, metrics[key]])
  );
}

function cliResultSummary(result) {
  return {
    ok: true,
    outputPath: result.outputPath,
    artifactSha256: result.artifactSha256,
    reportPath: result.reportPath,
    reportSha256: result.reportSha256,
    snapshotPath: result.snapshotPath,
    snapshotSha256: result.snapshotSha256,
    modelVersion: result.modelVersion,
    dataCutoffDate: result.dataCutoffDate,
    releaseEligible: result.releaseEligible,
    releaseFailures: result.releaseQuality?.failures || [],
    evaluation: {
      time: cliMetricSummary(result.releaseQuality?.time?.metrics),
      spatial: cliMetricSummary(result.releaseQuality?.spatial?.metrics),
      observer: cliMetricSummary(result.releaseQuality?.observer?.metrics)
    },
    occurrenceEventCandidates: result.occurrenceEvents?.candidateTaxa ?? null,
    forwardRows: result.forward?.insertedRows ?? null,
    reverseRows: result.reverse?.insertedRows ?? null,
    validation: result.validation,
    published: result.published
  };
}

if (require.main === module) {
  let options;
  try {
    options = parseCliArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${usage()}\n`);
      process.exitCode = 0;
    } else {
      options.onProgress = (event) => process.stdout.write(`${JSON.stringify(event)}\n`);
      buildPredictionArtifact(options)
        .then((result) => process.stdout.write(`${JSON.stringify(cliResultSummary(result), null, 2)}\n`))
        .catch((error) => {
          process.stderr.write(
            `${JSON.stringify({ ok: false, code: error.code || "BUILD_FAILED", message: error.message, details: error.details }, null, 2)}\n`
          );
          process.exitCode = 1;
        });
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${usage()}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_OPTIONS,
  PRODUCTION_QUALITY_GATE,
  PROBABILITY_DEFINITION,
  TRAINING_DATA_CONTRACT,
  PredictionBuildError,
  analyzeOccurrenceEvents,
  assertTrainingSourceContract,
  buildPredictionArtifact,
  cliResultSummary,
  collectDevelopmentPoolPositiveCounts,
  createArtifactSchema,
  createTrainingSnapshot,
  crossFitSpatialCalibrators,
  evaluateCachedSpatialRows,
  evaluateObserverHoldout,
  evaluateReleaseQuality,
  evaluateSpatialHoldout,
  guardCalibrationCandidates,
  inspectSnapshotQuality,
  parseCliArguments,
  predictionImplementationSha256,
  publishModelPointer,
  selectTemporalFoldReports,
  usage,
  validateBuildSafetyOptions
};
