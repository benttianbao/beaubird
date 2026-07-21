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
const { dirname, resolve } = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const { canonicalJson } = require("./spatial-splits");
const {
  FROZEN_NOVEL_GRID_ADMIN_EXPOSURE_CAPS_V1,
  buildAdminExposureCapCandidates
} = require("./spatial-transfer");

const SPATIAL_OOF_CACHE_SCHEMA_VERSION = 2;
const SPATIAL_OOF_CACHE_KIND = "zhejiang_development_strict_nested_spatial_oof_sufficient_statistics";
const SPATIAL_OOF_CACHE_PANEL = "development";
const DEVELOPMENT_POOL_POSITIVE_COUNT_POLICY =
  "distinct_known_observer_group_key_outside_all_sealed_r6_buffers";
const OUTER_TRAINING_POSITIVE_COUNT_POLICY =
  "distinct_known_observer_group_key_outside_outer_and_all_sealed_r6_buffers";
const INNER_TRAINING_POSITIVE_COUNT_POLICY =
  "distinct_known_observer_group_key_outside_outer_inner_and_all_sealed_r6_buffers";
const SPATIAL_OOF_CACHE_FOLD_IDS = Object.freeze([1, 2, 3, 4, 5]);
const SPATIAL_OOF_CACHE_DEEPEST_LEVELS = Object.freeze([
  "province",
  "city",
  "district",
  "grid_r6",
  "grid_r7",
  "point"
]);
const SPATIAL_OOF_CACHE_GENERATION_FILES = Object.freeze([
  "tools/build-zhejiang-prediction-model.js",
  "server/prediction/geo.js",
  "server/prediction/math.js",
  "server/prediction/model.js",
  "server/prediction/spatial-oof-cache.js",
  "server/prediction/spatial-splits.js",
  "server/prediction/spatial-transfer.js",
  "server/prediction/vagrant-events.js"
]);

const SOURCE_ROW_KEYS = Object.freeze([
  "actualPositive",
  "adminEvidence",
  "baselineProbability",
  "contextIndex",
  "deepestLevel",
  "hasSupportedLocalUnit",
  "positiveCount",
  "rawProbability",
  "taxonId",
  "total"
]);
const ADMIN_EVIDENCE_LEVEL_KEYS = Object.freeze(["city", "district", "province"]);
const ADMIN_EVIDENCE_VALUE_KEYS = Object.freeze(["detections", "exposure", "strength"]);
const FOLD_EVIDENCE_CONFIGURATION_KEYS = Object.freeze([
  "bandwidthDays",
  "calibrationContextSampleModulo",
  "calibrationFitYears",
  "calibrationGuardYear",
  "hyperparameterSelectionYears",
  "priorStrengthsByPrevalence",
  "validationYears"
]);
const EVIDENCE_OPTIONS_KEYS = Object.freeze([
  "applyOnlyWithoutSupportedLocalUnit",
  "bandwidthCandidates",
  "captureAdminEvidence",
  "coordinateQcEvaluationScope",
  "dataCutoffDate",
  "holdoutEvaluation",
  "includeFlaggedCleanReports",
  "levels",
  "localHistoryYears",
  "outerCalibrationContextSampleModulo",
  "outerPriorTuningContextSampleModulo",
  "pointDriftMeters",
  "priorStrengthMultipliers",
  "priorStrengths",
  "priorTuningContextSampleModulo",
  "recencyHalfLifeYears",
  "releaseEvaluationOccurrencePolicy",
  "temporalEvaluationWeightingPolicy",
  "trainingDataContract",
  "unitThresholds",
  "workerTaskChunkRecords"
]);
const BASE_ADMIN_CAP_GROUP_KEYS = Object.freeze([
  "group_30_79",
  "group_80_199",
  "species_200_plus"
]);
const ADMIN_CAP_KEYS = Object.freeze(["city", "district"]);
const QUALITY_THRESHOLD_KEYS = Object.freeze([
  "maximumEce",
  "maximumEceDegradation",
  "maximumGroupEce",
  "maximumRelativeBrierDegradation",
  "maximumSpeciesEce",
  "minimumBrierSkill",
  "minimumCalibrationFolds",
  "minimumObserverFolds",
  "minimumRecallAt20Delta",
  "minimumReverseNdcgLift",
  "minimumSpatialFolds",
  "minimumTimeFolds",
  "requireFinalHoldout",
  "requireObserverHoldout",
  "requireSpatialHoldout"
]);
const HOLDOUT_EVALUATION_KEYS = Object.freeze([
  "minimumTaxonPositives",
  "observerFoldCount",
  "priorTuningMaximumFolds",
  "spatialMaximumFolds",
  "spatialMinimumChecklists",
  "spatialMinimumObservers"
]);
const UNIT_LEVEL_KEYS = Object.freeze([
  "city",
  "district",
  "grid_r6",
  "grid_r7",
  "point",
  "province"
]);
const UNIT_THRESHOLD_KEYS = Object.freeze(["checklists", "observers"]);
const PRIOR_LEVEL_KEYS = Object.freeze(["city", "district", "grid_r6", "grid_r7", "point"]);
const PREVALENCE_GROUP_KEYS = Object.freeze([
  "group_30_79",
  "group_80_199",
  "rare_under_30",
  "species_200_plus"
]);
const PRIVACY_CONTRACT_KEYS = Object.freeze([
  "contextIdentity",
  "coordinates",
  "exactSpatialIdentifiers",
  "names",
  "observers",
  "reportIds"
]);
const EVIDENCE_POLICY_VALUES = Object.freeze({
  coordinateQcEvaluationScope: "fixed_snapshot_coordinate_qc_target_independent_not_refit_per_fold",
  releaseEvaluationOccurrencePolicy: "raw_detections_all_taxa_without_full_data_event_filter",
  temporalEvaluationWeightingPolicy: "fold_cutoff_half_life_training_and_group_capped_unweighted_validation",
  trainingDataContract: "beaubird-unified-quality-filter-v2"
});
const FROZEN_QUALITY_THRESHOLDS = Object.freeze({
  maximumEce: 0.1,
  maximumEceDegradation: 0.01,
  maximumGroupEce: 0.1,
  maximumRelativeBrierDegradation: 0.01,
  maximumSpeciesEce: 0.05,
  minimumBrierSkill: 0,
  minimumCalibrationFolds: 2,
  minimumObserverFolds: 3,
  minimumRecallAt20Delta: -0.02,
  minimumReverseNdcgLift: 0.05,
  minimumSpatialFolds: 3,
  minimumTimeFolds: 3,
  requireFinalHoldout: true,
  requireObserverHoldout: true,
  requireSpatialHoldout: true
});
const FROZEN_WORKER_TASK_CHUNK_RECORDS = 4096;
const CACHE_TABLE_COLUMNS = Object.freeze({
  contexts: Object.freeze([
    "fold_id",
    "context_index",
    "total",
    "province_exposure",
    "city_exposure",
    "district_exposure",
    "has_supported_local_unit",
    "deepest_level"
  ]),
  folds: Object.freeze([
    "fold_id",
    "context_count",
    "taxon_count",
    "score_count",
    "evidence_configuration_json",
    "reference_raw_metrics_json"
  ]),
  inner_contexts: Object.freeze([
    "outer_fold_id",
    "inner_fold_id",
    "context_index",
    "total",
    "province_exposure",
    "city_exposure",
    "district_exposure",
    "has_supported_local_unit",
    "deepest_level"
  ]),
  inner_folds: Object.freeze([
    "outer_fold_id",
    "inner_fold_id",
    "training_fold_ids_json",
    "context_count",
    "taxon_count",
    "score_count",
    "evidence_configuration_json",
    "reference_raw_metrics_json"
  ]),
  inner_scores: Object.freeze([
    "outer_fold_id",
    "inner_fold_id",
    "context_index",
    "taxon_index",
    "actual_positive",
    "province_detections",
    "city_detections",
    "district_detections",
    "reference_raw_probability",
    "reference_baseline_probability"
  ]),
  inner_taxa: Object.freeze([
    "outer_fold_id",
    "inner_fold_id",
    "taxon_index",
    "taxon_id",
    "positive_count",
    "outer_positive_count",
    "development_positive_count",
    "city_strength",
    "district_strength"
  ]),
  metadata: Object.freeze(["key", "value"]),
  scores: Object.freeze([
    "fold_id",
    "context_index",
    "taxon_index",
    "actual_positive",
    "province_detections",
    "city_detections",
    "district_detections",
    "reference_raw_probability",
    "reference_baseline_probability"
  ]),
  taxa: Object.freeze([
    "fold_id",
    "taxon_index",
    "taxon_id",
    "positive_count",
    "development_positive_count",
    "city_strength",
    "district_strength"
  ])
});
const CACHE_METADATA_KEYS = Object.freeze([
  "baseAdminExposureCapsByPrevalence",
  "cacheKind",
  "candidateSetSha256",
  "developmentPoolPositiveCountPolicy",
  "diagnosticOnly",
  "evidenceContractSha256",
  "evidenceOptions",
  "foldCount",
  "generationImplementationSha256",
  "innerFoldCount",
  "innerRowCount",
  "innerTrainingPositiveCountPolicy",
  "outerRowCount",
  "outerTrainingPositiveCountPolicy",
  "panel",
  "payloadSha256",
  "predictionImplementationSha256",
  "privacyContract",
  "qualityThresholds",
  "rowCount",
  "schemaVersion",
  "sourceSnapshotSha256",
  "spatialSplitFileSha256",
  "spatialSplitManifestHash"
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const SPATIAL_OOF_CACHE_EVIDENCE_CONTRACT_SHA256 = sha256(Buffer.from(canonicalJson({
  schemaVersion: SPATIAL_OOF_CACHE_SCHEMA_VERSION,
  kind: SPATIAL_OOF_CACHE_KIND,
  panel: SPATIAL_OOF_CACHE_PANEL,
  folds: SPATIAL_OOF_CACHE_FOLD_IDS,
  tables: CACHE_TABLE_COLUMNS,
  sourceRowKeys: SOURCE_ROW_KEYS,
  adminEvidenceLevels: ADMIN_EVIDENCE_LEVEL_KEYS,
  adminEvidenceValueKeys: ADMIN_EVIDENCE_VALUE_KEYS,
  foldEvidenceConfigurationKeys: FOLD_EVIDENCE_CONFIGURATION_KEYS,
  evidenceOptionsKeys: EVIDENCE_OPTIONS_KEYS,
  contextIdentity: "outer_inner_fold_local_dense_ordinal_without_location_mapping",
  candidateEvidence: "uncapped_province_city_district_float64_sufficient_statistics",
  developmentPoolPositiveCountPolicy: DEVELOPMENT_POOL_POSITIVE_COUNT_POLICY,
  outerTrainingPositiveCountPolicy: OUTER_TRAINING_POSITIVE_COUNT_POLICY,
  innerTrainingPositiveCountPolicy: INNER_TRAINING_POSITIVE_COUNT_POLICY,
  nestedEvidence: "five_outer_folds_each_with_four_inner_heldout_folds_trained_without_outer_inner_or_sealed_buffers"
}), "utf8"));

class SpatialOofCacheError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "SpatialOofCacheError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function sha256File(path) {
  const hash = createHash("sha256");
  const descriptor = openSync(path, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    while (true) {
      const bytesRead = readSync(descriptor, buffer, 0, buffer.length, null);
      if (!bytesRead) break;
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    closeSync(descriptor);
  }
  return hash.digest("hex");
}

function spatialOofCacheGenerationImplementationSha256(projectRoot = resolve(__dirname, "..", "..")) {
  const hash = createHash("sha256");
  for (const relativePath of SPATIAL_OOF_CACHE_GENERATION_FILES) {
    const normalized = relativePath.replaceAll("\\", "/");
    hash.update(`${normalized}\0`, "utf8");
    hash.update(readFileSync(resolve(projectRoot, relativePath)));
    hash.update("\0", "utf8");
  }
  return hash.digest("hex");
}

function candidateSetSha256() {
  return sha256(Buffer.from(canonicalJson(buildAdminExposureCapCandidates()), "utf8"));
}

function sortedKeys(value) {
  return Object.keys(value || {}).sort();
}

function sameStringArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function assertExactKeys(value, expected, code, path) {
  const actual = sortedKeys(value);
  if (!value || typeof value !== "object" || Array.isArray(value) || !sameStringArray(actual, expected)) {
    throw new SpatialOofCacheError(code, `${path} 字段不符合 OOF 隐私白名单。`, {
      path,
      expected,
      actual
    });
  }
}

function finiteNumber(value, path, { minimum = -Infinity, maximum = Infinity } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_VALUE_INVALID", `${path} 必须是范围内有限数值。`, {
      path,
      value,
      minimum,
      maximum
    });
  }
  return number;
}

function finiteInteger(value, path, { minimum = -Infinity, maximum = Infinity } = {}) {
  const number = finiteNumber(value, path, { minimum, maximum });
  if (!Number.isInteger(number)) {
    throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_VALUE_INVALID", `${path} 必须是整数。`, {
      path,
      value
    });
  }
  return number;
}

function normalizeSha256(value, path, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  const normalized = String(value || "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_VALUE_INVALID", `${path} 必须是 SHA-256。`);
  }
  return normalized;
}

function normalizeMachineIdentifier(value, path) {
  const identifier = String(value || "");
  if (!/^[A-Za-z0-9._:-]{1,160}$/.test(identifier)) {
    throw new SpatialOofCacheError(
      "SPATIAL_OOF_CACHE_PRIVACY_VIOLATION",
      `${path} 只能保存非描述性的机器标识。`
    );
  }
  return identifier;
}

function normalizeNumericArray(value, path, { integer = false } = {}) {
  if (!Array.isArray(value) || !value.length) {
    throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_VALUE_INVALID", `${path} 必须是非空数组。`);
  }
  return value.map((item, index) => integer
    ? finiteInteger(item, `${path}[${index}]`, { minimum: 0 })
    : finiteNumber(item, `${path}[${index}]`, { minimum: 0 }));
}

function normalizeYearArray(value, path) {
  const years = normalizeNumericArray(value, path, { integer: true });
  if (
    years.some((year) => year < 2000 || year > 2100) ||
    years.some((year, index) => index > 0 && year <= years[index - 1])
  ) {
    throw new SpatialOofCacheError(
      "SPATIAL_OOF_CACHE_VALUE_INVALID",
      `${path} 必须是严格递增的合理年份数组。`
    );
  }
  return years;
}

function normalizePriorStrengthsByPrevalence(value, path) {
  assertExactKeys(value, PRIOR_LEVEL_KEYS, "SPATIAL_OOF_CACHE_PRIVACY_VIOLATION", path);
  return Object.fromEntries(PRIOR_LEVEL_KEYS.map((level) => {
    assertExactKeys(
      value[level],
      PREVALENCE_GROUP_KEYS,
      "SPATIAL_OOF_CACHE_PRIVACY_VIOLATION",
      `${path}.${level}`
    );
    return [level, Object.fromEntries(PREVALENCE_GROUP_KEYS.map((group) => [
      group,
      finiteNumber(value[level][group], `${path}.${level}.${group}`, { minimum: 0 })
    ]))];
  }));
}

function normalizePriorStrengths(value, path) {
  assertExactKeys(value, PRIOR_LEVEL_KEYS, "SPATIAL_OOF_CACHE_PRIVACY_VIOLATION", path);
  return Object.fromEntries(PRIOR_LEVEL_KEYS.map((level) => [
    level,
    finiteNumber(value[level], `${path}.${level}`, { minimum: 0 })
  ]));
}

function normalizeFoldEvidenceConfiguration(value, path) {
  assertExactKeys(value, FOLD_EVIDENCE_CONFIGURATION_KEYS, "SPATIAL_OOF_CACHE_PRIVACY_VIOLATION", path);
  return {
    bandwidthDays: finiteInteger(value.bandwidthDays, `${path}.bandwidthDays`, { minimum: 1 }),
    calibrationContextSampleModulo: finiteInteger(
      value.calibrationContextSampleModulo,
      `${path}.calibrationContextSampleModulo`,
      { minimum: 1 }
    ),
    calibrationFitYears: normalizeYearArray(value.calibrationFitYears, `${path}.calibrationFitYears`),
    calibrationGuardYear: finiteInteger(value.calibrationGuardYear, `${path}.calibrationGuardYear`, {
      minimum: 2000,
      maximum: 2100
    }),
    hyperparameterSelectionYears: normalizeYearArray(
      value.hyperparameterSelectionYears,
      `${path}.hyperparameterSelectionYears`
    ),
    priorStrengthsByPrevalence: normalizePriorStrengthsByPrevalence(
      value.priorStrengthsByPrevalence,
      `${path}.priorStrengthsByPrevalence`
    ),
    validationYears: normalizeYearArray(value.validationYears, `${path}.validationYears`)
  };
}

function normalizeBaseAdminExposureCaps(value) {
  assertExactKeys(
    value,
    BASE_ADMIN_CAP_GROUP_KEYS,
    "SPATIAL_OOF_CACHE_PRIVACY_VIOLATION",
    "baseAdminExposureCapsByPrevalence"
  );
  const candidates = new Set(buildAdminExposureCapCandidates().map((candidate) => canonicalJson(candidate.caps)));
  const normalized = Object.fromEntries(BASE_ADMIN_CAP_GROUP_KEYS.map((group) => {
    const path = `baseAdminExposureCapsByPrevalence.${group}`;
    assertExactKeys(value[group], ADMIN_CAP_KEYS, "SPATIAL_OOF_CACHE_PRIVACY_VIOLATION", path);
    const caps = Object.fromEntries(ADMIN_CAP_KEYS.map((level) => [
      level,
      value[group][level] === null
        ? null
        : finiteNumber(value[group][level], `${path}.${level}`, { minimum: 0 })
    ]));
    if (!candidates.has(canonicalJson(caps))) {
      throw new SpatialOofCacheError(
        "SPATIAL_OOF_CACHE_VALUE_INVALID",
        `${path} 必须来自固定 25 组候选。`
      );
    }
    return [group, caps];
  }));
  if (canonicalJson(normalized) !== canonicalJson(FROZEN_NOVEL_GRID_ADMIN_EXPOSURE_CAPS_V1)) {
    throw new SpatialOofCacheError(
      "SPATIAL_OOF_CACHE_VALUE_INVALID",
      "baseAdminExposureCapsByPrevalence 必须匹配冻结 development 基础上限。"
    );
  }
  return normalized;
}

function normalizeQualityThresholds(value) {
  assertExactKeys(
    value,
    QUALITY_THRESHOLD_KEYS,
    "SPATIAL_OOF_CACHE_PRIVACY_VIOLATION",
    "qualityThresholds"
  );
  const normalized = Object.fromEntries(QUALITY_THRESHOLD_KEYS.map((key) => {
    if (key.startsWith("require")) {
      if (typeof value[key] !== "boolean") {
        throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_VALUE_INVALID", `qualityThresholds.${key} 必须是布尔值。`);
      }
      return [key, value[key]];
    }
    return [key, finiteNumber(value[key], `qualityThresholds.${key}`)];
  }));
  if (canonicalJson(normalized) !== canonicalJson(FROZEN_QUALITY_THRESHOLDS)) {
    throw new SpatialOofCacheError(
      "SPATIAL_OOF_CACHE_VALUE_INVALID",
      "qualityThresholds 必须匹配未放宽的冻结生产门槛与校准保护门。"
    );
  }
  return normalized;
}

function normalizeEvidenceOptions(value) {
  assertExactKeys(value, EVIDENCE_OPTIONS_KEYS, "SPATIAL_OOF_CACHE_PRIVACY_VIOLATION", "evidenceOptions");
  for (const key of ["applyOnlyWithoutSupportedLocalUnit", "captureAdminEvidence", "includeFlaggedCleanReports"]) {
    if (typeof value[key] !== "boolean") {
      throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_VALUE_INVALID", `evidenceOptions.${key} 必须是布尔值。`);
    }
  }
  if (value.applyOnlyWithoutSupportedLocalUnit !== true || value.captureAdminEvidence !== true) {
    throw new SpatialOofCacheError(
      "SPATIAL_OOF_CACHE_VALUE_INVALID",
      "OOF 缓存必须保存仅用于无本地支持单元的未封顶行政证据。"
    );
  }
  if (canonicalJson(value.levels) !== canonicalJson(["province", "city", "district"])) {
    throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_VALUE_INVALID", "evidenceOptions.levels 必须固定为省、市、区县。" );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value.dataCutoffDate || ""))) {
    throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_VALUE_INVALID", "evidenceOptions.dataCutoffDate 非法。" );
  }
  for (const [key, expected] of Object.entries(EVIDENCE_POLICY_VALUES)) {
    if (value[key] !== expected) {
      throw new SpatialOofCacheError(
        "SPATIAL_OOF_CACHE_PRIVACY_VIOLATION",
        `evidenceOptions.${key} 必须匹配固定证据契约。`
      );
    }
  }
  assertExactKeys(
    value.holdoutEvaluation,
    HOLDOUT_EVALUATION_KEYS,
    "SPATIAL_OOF_CACHE_PRIVACY_VIOLATION",
    "evidenceOptions.holdoutEvaluation"
  );
  const holdoutEvaluation = Object.fromEntries(HOLDOUT_EVALUATION_KEYS.map((key) => [
    key,
    finiteInteger(value.holdoutEvaluation[key], `evidenceOptions.holdoutEvaluation.${key}`, { minimum: 1 })
  ]));
  assertExactKeys(
    value.unitThresholds,
    UNIT_LEVEL_KEYS,
    "SPATIAL_OOF_CACHE_PRIVACY_VIOLATION",
    "evidenceOptions.unitThresholds"
  );
  const unitThresholds = Object.fromEntries(UNIT_LEVEL_KEYS.map((level) => {
    assertExactKeys(
      value.unitThresholds[level],
      UNIT_THRESHOLD_KEYS,
      "SPATIAL_OOF_CACHE_PRIVACY_VIOLATION",
      `evidenceOptions.unitThresholds.${level}`
    );
    return [level, Object.fromEntries(UNIT_THRESHOLD_KEYS.map((key) => [
      key,
      finiteInteger(value.unitThresholds[level][key], `evidenceOptions.unitThresholds.${level}.${key}`, {
        minimum: 1
      })
    ]))];
  }));
  return {
    applyOnlyWithoutSupportedLocalUnit: true,
    bandwidthCandidates: normalizeNumericArray(value.bandwidthCandidates, "evidenceOptions.bandwidthCandidates", {
      integer: true
    }),
    captureAdminEvidence: true,
    coordinateQcEvaluationScope: EVIDENCE_POLICY_VALUES.coordinateQcEvaluationScope,
    dataCutoffDate: String(value.dataCutoffDate),
    holdoutEvaluation,
    includeFlaggedCleanReports: value.includeFlaggedCleanReports,
    levels: ["province", "city", "district"],
    localHistoryYears: finiteNumber(value.localHistoryYears, "evidenceOptions.localHistoryYears", { minimum: 0 }),
    outerCalibrationContextSampleModulo: finiteInteger(
      value.outerCalibrationContextSampleModulo,
      "evidenceOptions.outerCalibrationContextSampleModulo",
      { minimum: 1 }
    ),
    outerPriorTuningContextSampleModulo: finiteInteger(
      value.outerPriorTuningContextSampleModulo,
      "evidenceOptions.outerPriorTuningContextSampleModulo",
      { minimum: 1 }
    ),
    pointDriftMeters: finiteNumber(value.pointDriftMeters, "evidenceOptions.pointDriftMeters", { minimum: 0 }),
    priorStrengthMultipliers: normalizeNumericArray(
      value.priorStrengthMultipliers,
      "evidenceOptions.priorStrengthMultipliers"
    ),
    priorStrengths: normalizePriorStrengths(value.priorStrengths, "evidenceOptions.priorStrengths"),
    priorTuningContextSampleModulo: finiteInteger(
      value.priorTuningContextSampleModulo,
      "evidenceOptions.priorTuningContextSampleModulo",
      { minimum: 1 }
    ),
    recencyHalfLifeYears: finiteNumber(value.recencyHalfLifeYears, "evidenceOptions.recencyHalfLifeYears", {
      minimum: Number.MIN_VALUE
    }),
    releaseEvaluationOccurrencePolicy: EVIDENCE_POLICY_VALUES.releaseEvaluationOccurrencePolicy,
    temporalEvaluationWeightingPolicy: EVIDENCE_POLICY_VALUES.temporalEvaluationWeightingPolicy,
    trainingDataContract: EVIDENCE_POLICY_VALUES.trainingDataContract,
    unitThresholds,
    workerTaskChunkRecords: (() => {
      const records = finiteInteger(
        value.workerTaskChunkRecords,
        "evidenceOptions.workerTaskChunkRecords",
        { minimum: 1 }
      );
      if (records !== FROZEN_WORKER_TASK_CHUNK_RECORDS) {
        throw new SpatialOofCacheError(
          "SPATIAL_OOF_CACHE_VALUE_INVALID",
          `evidenceOptions.workerTaskChunkRecords 必须固定为 ${FROZEN_WORKER_TASK_CHUNK_RECORDS}。`
        );
      }
      return records;
    })()
  };
}

function normalizePrivacyContract(value) {
  assertExactKeys(value, PRIVACY_CONTRACT_KEYS, "SPATIAL_OOF_CACHE_PRIVACY_VIOLATION", "privacyContract");
  const expected = {
    contextIdentity: "outer_inner_fold_local_dense_ordinal_without_location_mapping",
    reportIds: false,
    observers: false,
    coordinates: false,
    exactSpatialIdentifiers: false,
    names: false
  };
  if (canonicalJson(value) !== canonicalJson(expected)) {
    throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_PRIVACY_VIOLATION", "privacyContract 不匹配。" );
  }
  return expected;
}

function normalizeTaxonId(value) {
  const taxonId = String(value || "");
  if (!/^[A-Za-z0-9._:-]{1,64}$/.test(taxonId)) {
    throw new SpatialOofCacheError(
      "SPATIAL_OOF_CACHE_TAXON_INVALID",
      "缓存只允许公共、非描述性的 taxon_id。",
      { taxonId }
    );
  }
  return taxonId;
}

function normalizeDevelopmentPoolPositiveCounts(value) {
  const entries = value instanceof Map
    ? [...value.entries()]
    : value && typeof value === "object" && !Array.isArray(value)
      ? Object.entries(value)
      : null;
  if (!entries?.length) {
    throw new SpatialOofCacheError(
      "SPATIAL_OOF_CACHE_VALUE_INVALID",
      "缓存必须绑定排除 sealed 保留单元后的 development-pool positive_count。"
    );
  }
  const result = new Map();
  for (const [rawTaxonId, rawPositiveCount] of entries) {
    const taxonId = normalizeTaxonId(rawTaxonId);
    if (result.has(taxonId)) {
      throw new SpatialOofCacheError(
        "SPATIAL_OOF_CACHE_VALUE_INVALID",
        `development-pool positive_count 重复：${taxonId}`,
      );
    }
    result.set(
      taxonId,
      finiteInteger(rawPositiveCount, `developmentPoolPositiveCounts.${taxonId}`, { minimum: 0 })
    );
  }
  return result;
}

function normalizeAdminEvidence(value, path) {
  assertExactKeys(value, ADMIN_EVIDENCE_LEVEL_KEYS, "SPATIAL_OOF_CACHE_PRIVACY_VIOLATION", path);
  const result = {};
  for (const level of ADMIN_EVIDENCE_LEVEL_KEYS) {
    assertExactKeys(
      value[level],
      ADMIN_EVIDENCE_VALUE_KEYS,
      "SPATIAL_OOF_CACHE_PRIVACY_VIOLATION",
      `${path}.${level}`
    );
    const exposure = finiteNumber(value[level].exposure, `${path}.${level}.exposure`, { minimum: 0 });
    const detections = finiteNumber(value[level].detections, `${path}.${level}.detections`, {
      minimum: 0,
      maximum: exposure
    });
    const strength = finiteNumber(value[level].strength, `${path}.${level}.strength`, { minimum: 0 });
    result[level] = { exposure, detections, strength };
  }
  return result;
}

function normalizeSourceRow(row, foldId, rowIndex, pathPrefix = `folds[${foldId}]`) {
  const path = `${pathPrefix}.scoreRows[${rowIndex}]`;
  assertExactKeys(row, SOURCE_ROW_KEYS, "SPATIAL_OOF_CACHE_PRIVACY_VIOLATION", path);
  const contextIndex = finiteNumber(row.contextIndex, `${path}.contextIndex`, { minimum: 0 });
  if (!Number.isInteger(contextIndex)) {
    throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_VALUE_INVALID", `${path}.contextIndex 必须是整数。`);
  }
  const positiveCount = finiteNumber(row.positiveCount, `${path}.positiveCount`, { minimum: 0 });
  if (!Number.isInteger(positiveCount)) {
    throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_VALUE_INVALID", `${path}.positiveCount 必须是整数。`);
  }
  const total = finiteNumber(row.total, `${path}.total`, { minimum: Number.MIN_VALUE });
  const actualPositive = finiteNumber(row.actualPositive, `${path}.actualPositive`, {
    minimum: 0,
    maximum: total
  });
  const rawProbability = finiteNumber(row.rawProbability, `${path}.rawProbability`, {
    minimum: 0,
    maximum: 1
  });
  const baselineProbability = finiteNumber(row.baselineProbability, `${path}.baselineProbability`, {
    minimum: 0,
    maximum: 1
  });
  const deepestLevel = String(row.deepestLevel || "");
  if (!SPATIAL_OOF_CACHE_DEEPEST_LEVELS.includes(deepestLevel)) {
    throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_VALUE_INVALID", `${path}.deepestLevel 非法。`, {
      deepestLevel
    });
  }
  if (typeof row.hasSupportedLocalUnit !== "boolean") {
    throw new SpatialOofCacheError(
      "SPATIAL_OOF_CACHE_VALUE_INVALID",
      `${path}.hasSupportedLocalUnit 必须是布尔值。`
    );
  }
  return {
    contextIndex,
    taxonId: normalizeTaxonId(row.taxonId),
    positiveCount,
    actualPositive,
    total,
    rawProbability,
    baselineProbability,
    deepestLevel,
    hasSupportedLocalUnit: row.hasSupportedLocalUnit,
    adminEvidence: normalizeAdminEvidence(row.adminEvidence, `${path}.adminEvidence`)
  };
}

function comparableNumber(left, right) {
  return Math.abs(Number(left) - Number(right)) <= 1e-12 * Math.max(1, Math.abs(Number(left)), Math.abs(Number(right)));
}

function normalizeEvidenceSet({
  scoreRows,
  path,
  foldId,
  evidenceConfiguration,
  developmentPositiveCounts,
  outerPositiveCounts = null
}) {
  if (!Array.isArray(scoreRows) || !scoreRows.length) {
    throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_FOLD_EMPTY", `${path} 没有 scoreRows。`);
  }
  const normalizedRows = scoreRows.map((row, index) =>
    normalizeSourceRow(row, foldId, index, path)
  ).sort(
    (left, right) => left.contextIndex - right.contextIndex || left.taxonId.localeCompare(right.taxonId)
  );
  const normalizedEvidenceConfiguration = normalizeFoldEvidenceConfiguration(
    evidenceConfiguration,
    `${path}.evidenceConfiguration`
  );
  const contexts = new Map();
  const taxa = new Map();
  for (const row of normalizedRows) {
    const context = {
      total: row.total,
      provinceExposure: row.adminEvidence.province.exposure,
      cityExposure: row.adminEvidence.city.exposure,
      districtExposure: row.adminEvidence.district.exposure,
      hasSupportedLocalUnit: row.hasSupportedLocalUnit,
      deepestLevel: row.deepestLevel
    };
    const priorContext = contexts.get(row.contextIndex);
    if (priorContext) {
      for (const key of ["total", "provinceExposure", "cityExposure", "districtExposure"]) {
        if (!comparableNumber(priorContext[key], context[key])) {
          throw new SpatialOofCacheError(
            "SPATIAL_OOF_CACHE_CONTEXT_INCONSISTENT",
            `${path} context ${row.contextIndex} 的 ${key} 不一致。`
          );
        }
      }
      if (
        priorContext.hasSupportedLocalUnit !== context.hasSupportedLocalUnit ||
        priorContext.deepestLevel !== context.deepestLevel
      ) {
        throw new SpatialOofCacheError(
          "SPATIAL_OOF_CACHE_CONTEXT_INCONSISTENT",
          `${path} context ${row.contextIndex} 的层级信息不一致。`
        );
      }
    } else {
      contexts.set(row.contextIndex, context);
    }
    const outerPositiveCount = outerPositiveCounts instanceof Map
      ? outerPositiveCounts.get(row.taxonId)
      : row.positiveCount;
    const developmentPositiveCount = developmentPositiveCounts.get(row.taxonId);
    if (
      outerPositiveCount === undefined ||
      developmentPositiveCount === undefined ||
      row.positiveCount > outerPositiveCount ||
      outerPositiveCount > developmentPositiveCount
    ) {
      throw new SpatialOofCacheError(
        "SPATIAL_OOF_CACHE_VALUE_INVALID",
        `${path} taxon ${row.taxonId} 的三折、四折或 development positive_count 不一致。`,
        { positiveCount: row.positiveCount, outerPositiveCount, developmentPositiveCount }
      );
    }
    const taxon = {
      positiveCount: row.positiveCount,
      outerPositiveCount,
      developmentPositiveCount,
      cityStrength: row.adminEvidence.city.strength,
      districtStrength: row.adminEvidence.district.strength
    };
    const priorTaxon = taxa.get(row.taxonId);
    if (priorTaxon) {
      for (const key of [
        "positiveCount",
        "outerPositiveCount",
        "developmentPositiveCount",
        "cityStrength",
        "districtStrength"
      ]) {
        if (!comparableNumber(priorTaxon[key], taxon[key])) {
          throw new SpatialOofCacheError(
            "SPATIAL_OOF_CACHE_TAXON_INCONSISTENT",
            `${path} taxon ${row.taxonId} 的 ${key} 不一致。`
          );
        }
      }
    } else {
      taxa.set(row.taxonId, taxon);
    }
  }
  const contextIds = [...contexts.keys()].sort((left, right) => left - right);
  if (contextIds.some((value, index) => value !== index)) {
    throw new SpatialOofCacheError(
      "SPATIAL_OOF_CACHE_CONTEXT_ORDINALS_INVALID",
      `${path} contextIndex 必须从 0 开始连续。`,
      { contextIds }
    );
  }
  const taxonIds = [...taxa.keys()].sort();
  if (normalizedRows.length !== contextIds.length * taxonIds.length) {
    throw new SpatialOofCacheError(
      "SPATIAL_OOF_CACHE_ROSTER_INCOMPLETE",
      `${path} 每个 context 必须包含完整 taxon roster。`,
      { rows: normalizedRows.length, contexts: contextIds.length, taxa: taxonIds.length }
    );
  }
  return {
    normalizedRows,
    normalizedEvidenceConfiguration,
    contexts,
    taxa,
    contextIds,
    taxonIds,
    taxonIndexes: new Map(taxonIds.map((taxonId, index) => [taxonId, index]))
  };
}

function metricProjection(metrics, path = "referenceRawMetrics") {
  if (!metrics) return null;
  const keys = [
    "brier",
    "baselineBrier",
    "brierSkill",
    "ece",
    "recallAt20",
    "baselineRecallAt20",
    "recallAt20Delta",
    "recallHits",
    "baselineRecallHits",
    "recallActual",
    "evaluatedWeight",
    "evaluatedTaxa",
    "validationContexts"
  ];
  const projection = Object.fromEntries(keys.filter((key) => metrics[key] !== undefined).map((key) => [
    key,
    finiteNumber(metrics[key], `${path}.${key}`)
  ]));
  const scopeProjection = (scope, scopePath) => {
    if (!scope) return null;
    const scopeCount = finiteInteger(scope.scopeCount, `${scopePath}.scopeCount`, { minimum: 0 });
    const maximumEce = scope.maximumEce === null
      ? null
      : finiteNumber(scope.maximumEce, `${scopePath}.maximumEce`, { minimum: 0, maximum: 1 });
    const worstScopeId = scope.worstScopeId === null
      ? null
      : normalizeMachineIdentifier(scope.worstScopeId, `${scopePath}.worstScopeId`);
    return { scopeCount, maximumEce, worstScopeId };
  };
  projection.calibrationEce = {
    species: scopeProjection(metrics.calibrationEce?.species, `${path}.calibrationEce.species`),
    group: scopeProjection(metrics.calibrationEce?.group, `${path}.calibrationEce.group`)
  };
  return projection;
}

function createCacheSchema(database) {
  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA page_size = 4096;
    CREATE TABLE metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) WITHOUT ROWID;
    CREATE TABLE folds (
      fold_id INTEGER PRIMARY KEY CHECK(fold_id BETWEEN 1 AND 5),
      context_count INTEGER NOT NULL CHECK(context_count > 0),
      taxon_count INTEGER NOT NULL CHECK(taxon_count > 0),
      score_count INTEGER NOT NULL CHECK(score_count > 0),
      evidence_configuration_json TEXT NOT NULL,
      reference_raw_metrics_json TEXT
    );
    CREATE TABLE inner_folds (
      outer_fold_id INTEGER NOT NULL CHECK(outer_fold_id BETWEEN 1 AND 5),
      inner_fold_id INTEGER NOT NULL CHECK(inner_fold_id BETWEEN 1 AND 5 AND inner_fold_id <> outer_fold_id),
      training_fold_ids_json TEXT NOT NULL,
      context_count INTEGER NOT NULL CHECK(context_count > 0),
      taxon_count INTEGER NOT NULL CHECK(taxon_count > 0),
      score_count INTEGER NOT NULL CHECK(score_count > 0),
      evidence_configuration_json TEXT NOT NULL,
      reference_raw_metrics_json TEXT,
      PRIMARY KEY (outer_fold_id, inner_fold_id),
      FOREIGN KEY (outer_fold_id) REFERENCES folds(fold_id)
    ) WITHOUT ROWID;
    CREATE TABLE contexts (
      fold_id INTEGER NOT NULL,
      context_index INTEGER NOT NULL CHECK(context_index >= 0),
      total REAL NOT NULL CHECK(total > 0),
      province_exposure REAL NOT NULL CHECK(province_exposure >= 0),
      city_exposure REAL NOT NULL CHECK(city_exposure >= 0),
      district_exposure REAL NOT NULL CHECK(district_exposure >= 0),
      has_supported_local_unit INTEGER NOT NULL CHECK(has_supported_local_unit IN (0, 1)),
      deepest_level TEXT NOT NULL CHECK(deepest_level IN ('province','city','district','grid_r6','grid_r7','point')),
      PRIMARY KEY (fold_id, context_index),
      FOREIGN KEY (fold_id) REFERENCES folds(fold_id)
    ) WITHOUT ROWID;
    CREATE TABLE inner_contexts (
      outer_fold_id INTEGER NOT NULL,
      inner_fold_id INTEGER NOT NULL,
      context_index INTEGER NOT NULL CHECK(context_index >= 0),
      total REAL NOT NULL CHECK(total > 0),
      province_exposure REAL NOT NULL CHECK(province_exposure >= 0),
      city_exposure REAL NOT NULL CHECK(city_exposure >= 0),
      district_exposure REAL NOT NULL CHECK(district_exposure >= 0),
      has_supported_local_unit INTEGER NOT NULL CHECK(has_supported_local_unit IN (0, 1)),
      deepest_level TEXT NOT NULL CHECK(deepest_level IN ('province','city','district','grid_r6','grid_r7','point')),
      PRIMARY KEY (outer_fold_id, inner_fold_id, context_index),
      FOREIGN KEY (outer_fold_id, inner_fold_id) REFERENCES inner_folds(outer_fold_id, inner_fold_id)
    ) WITHOUT ROWID;
    CREATE TABLE taxa (
      fold_id INTEGER NOT NULL,
      taxon_index INTEGER NOT NULL CHECK(taxon_index >= 0),
      taxon_id TEXT NOT NULL,
      positive_count INTEGER NOT NULL CHECK(positive_count >= 0),
      development_positive_count INTEGER NOT NULL CHECK(development_positive_count >= positive_count),
      city_strength REAL NOT NULL CHECK(city_strength >= 0),
      district_strength REAL NOT NULL CHECK(district_strength >= 0),
      PRIMARY KEY (fold_id, taxon_index),
      UNIQUE (fold_id, taxon_id),
      FOREIGN KEY (fold_id) REFERENCES folds(fold_id)
    ) WITHOUT ROWID;
    CREATE TABLE inner_taxa (
      outer_fold_id INTEGER NOT NULL,
      inner_fold_id INTEGER NOT NULL,
      taxon_index INTEGER NOT NULL CHECK(taxon_index >= 0),
      taxon_id TEXT NOT NULL,
      positive_count INTEGER NOT NULL CHECK(positive_count >= 0),
      outer_positive_count INTEGER NOT NULL CHECK(outer_positive_count >= positive_count),
      development_positive_count INTEGER NOT NULL CHECK(development_positive_count >= outer_positive_count),
      city_strength REAL NOT NULL CHECK(city_strength >= 0),
      district_strength REAL NOT NULL CHECK(district_strength >= 0),
      PRIMARY KEY (outer_fold_id, inner_fold_id, taxon_index),
      UNIQUE (outer_fold_id, inner_fold_id, taxon_id),
      FOREIGN KEY (outer_fold_id, inner_fold_id) REFERENCES inner_folds(outer_fold_id, inner_fold_id)
    ) WITHOUT ROWID;
    CREATE TABLE scores (
      fold_id INTEGER NOT NULL,
      context_index INTEGER NOT NULL,
      taxon_index INTEGER NOT NULL,
      actual_positive REAL NOT NULL CHECK(actual_positive >= 0),
      province_detections REAL NOT NULL CHECK(province_detections >= 0),
      city_detections REAL NOT NULL CHECK(city_detections >= 0),
      district_detections REAL NOT NULL CHECK(district_detections >= 0),
      reference_raw_probability REAL NOT NULL CHECK(reference_raw_probability BETWEEN 0 AND 1),
      reference_baseline_probability REAL NOT NULL CHECK(reference_baseline_probability BETWEEN 0 AND 1),
      PRIMARY KEY (fold_id, context_index, taxon_index),
      FOREIGN KEY (fold_id, context_index) REFERENCES contexts(fold_id, context_index),
      FOREIGN KEY (fold_id, taxon_index) REFERENCES taxa(fold_id, taxon_index)
    ) WITHOUT ROWID;
    CREATE TABLE inner_scores (
      outer_fold_id INTEGER NOT NULL,
      inner_fold_id INTEGER NOT NULL,
      context_index INTEGER NOT NULL,
      taxon_index INTEGER NOT NULL,
      actual_positive REAL NOT NULL CHECK(actual_positive >= 0),
      province_detections REAL NOT NULL CHECK(province_detections >= 0),
      city_detections REAL NOT NULL CHECK(city_detections >= 0),
      district_detections REAL NOT NULL CHECK(district_detections >= 0),
      reference_raw_probability REAL NOT NULL CHECK(reference_raw_probability BETWEEN 0 AND 1),
      reference_baseline_probability REAL NOT NULL CHECK(reference_baseline_probability BETWEEN 0 AND 1),
      PRIMARY KEY (outer_fold_id, inner_fold_id, context_index, taxon_index),
      FOREIGN KEY (outer_fold_id, inner_fold_id, context_index)
        REFERENCES inner_contexts(outer_fold_id, inner_fold_id, context_index),
      FOREIGN KEY (outer_fold_id, inner_fold_id, taxon_index)
        REFERENCES inner_taxa(outer_fold_id, inner_fold_id, taxon_index)
    ) WITHOUT ROWID;
  `);
}

function logicalPayloadSha256(database) {
  const hash = createHash("sha256");
  const addRows = (tag, sql) => {
    for (const row of database.prepare(sql).iterate()) {
      hash.update(`${tag}\0${canonicalJson(Object.values(row))}\n`, "utf8");
    }
  };
  addRows("metadata", `SELECT key, value FROM metadata WHERE key <> 'payloadSha256' ORDER BY key`);
  addRows("fold", `SELECT fold_id, context_count, taxon_count, score_count, evidence_configuration_json,
                           reference_raw_metrics_json
                    FROM folds ORDER BY fold_id`);
  addRows("inner_fold", `SELECT outer_fold_id, inner_fold_id, training_fold_ids_json, context_count,
                                 taxon_count, score_count, evidence_configuration_json, reference_raw_metrics_json
                          FROM inner_folds ORDER BY outer_fold_id, inner_fold_id`);
  addRows("context", `SELECT fold_id, context_index, total, province_exposure, city_exposure,
                              district_exposure, has_supported_local_unit, deepest_level
                       FROM contexts ORDER BY fold_id, context_index`);
  addRows("inner_context", `SELECT outer_fold_id, inner_fold_id, context_index, total, province_exposure,
                                    city_exposure, district_exposure, has_supported_local_unit, deepest_level
                             FROM inner_contexts ORDER BY outer_fold_id, inner_fold_id, context_index`);
  addRows("taxon", `SELECT fold_id, taxon_index, taxon_id, positive_count, development_positive_count,
                            city_strength, district_strength
                     FROM taxa ORDER BY fold_id, taxon_index`);
  addRows("inner_taxon", `SELECT outer_fold_id, inner_fold_id, taxon_index, taxon_id, positive_count,
                                  outer_positive_count, development_positive_count, city_strength, district_strength
                           FROM inner_taxa ORDER BY outer_fold_id, inner_fold_id, taxon_index`);
  addRows("score", `SELECT fold_id, context_index, taxon_index, actual_positive, province_detections,
                            city_detections, district_detections, reference_raw_probability,
                            reference_baseline_probability
                     FROM scores ORDER BY fold_id, context_index, taxon_index`);
  addRows("inner_score", `SELECT outer_fold_id, inner_fold_id, context_index, taxon_index, actual_positive,
                                  province_detections, city_detections, district_detections,
                                  reference_raw_probability, reference_baseline_probability
                           FROM inner_scores ORDER BY outer_fold_id, inner_fold_id, context_index, taxon_index`);
  return hash.digest("hex");
}

function setMetadata(database, key, value) {
  database.prepare("INSERT INTO metadata(key, value) VALUES (?, ?)").run(key, JSON.stringify(value));
}

function cacheSchemaObjects(database) {
  return database
    .prepare(`
      SELECT type, name, tbl_name, sql
      FROM sqlite_schema
      ORDER BY type, name
    `)
    .all();
}

let expectedCacheSchemaObjects = null;

function getExpectedCacheSchemaObjects() {
  if (expectedCacheSchemaObjects) return expectedCacheSchemaObjects;
  const expectedDatabase = new DatabaseSync(":memory:");
  try {
    createCacheSchema(expectedDatabase);
    expectedCacheSchemaObjects = cacheSchemaObjects(expectedDatabase);
    return expectedCacheSchemaObjects;
  } finally {
    expectedDatabase.close();
  }
}

function safeUnlink(path) {
  if (!path || !existsSync(path)) return;
  try {
    chmodSync(path, 0o666);
  } catch {
    // Windows ACLs may ignore POSIX mode bits.
  }
  unlinkSync(path);
}

function writeSpatialOofCache({
  cachePath,
  folds,
  verifiedSpatialSplit,
  sourceSnapshotSha256,
  generationImplementationSha256,
  predictionImplementationSha256,
  baseAdminExposureCapsByPrevalence,
  qualityThresholds,
  evidenceOptions,
  developmentPoolPositiveCounts
}) {
  if (verifiedSpatialSplit?.panelName !== SPATIAL_OOF_CACHE_PANEL) {
    throw new SpatialOofCacheError(
      "SPATIAL_OOF_CACHE_DEVELOPMENT_ONLY",
      "OOF 充分统计缓存只能写入 development 面板。"
    );
  }
  const expectedFoldIds = (verifiedSpatialSplit.panel?.folds || [])
    .map((fold) => Number(fold.foldId))
    .sort((left, right) => left - right);
  if (!sameStringArray(expectedFoldIds.map(String), SPATIAL_OOF_CACHE_FOLD_IDS.map(String))) {
    throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_FOLDS_INVALID", "development split 必须恰好包含五折。", {
      expectedFoldIds
    });
  }
  const actualSnapshotSha256 = normalizeSha256(sourceSnapshotSha256, "sourceSnapshotSha256");
  if (
    actualSnapshotSha256 !== String(verifiedSpatialSplit.manifest?.sourceSnapshotSha256 || "").toLowerCase()
  ) {
    throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_SNAPSHOT_MISMATCH", "缓存快照与冻结 split 不匹配。");
  }
  const currentGenerationSha256 = spatialOofCacheGenerationImplementationSha256();
  if (generationImplementationSha256 !== currentGenerationSha256) {
    throw new SpatialOofCacheError(
      "SPATIAL_OOF_CACHE_GENERATOR_MISMATCH",
      "缓存证据生成器哈希与当前实现不匹配。",
      { expected: currentGenerationSha256, actual: generationImplementationSha256 || null }
    );
  }
  const absolutePath = resolve(cachePath);
  const sidecarPath = `${absolutePath}.sha256`;
  if (existsSync(absolutePath) || existsSync(sidecarPath)) {
    throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_OUTPUT_EXISTS", "OOF 缓存或其 SHA sidecar 已存在。", {
      cachePath: absolutePath
    });
  }
  if (!Array.isArray(folds) || folds.length !== SPATIAL_OOF_CACHE_FOLD_IDS.length) {
    throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_FOLDS_INVALID", "OOF 缓存必须一次写入完整五折。");
  }
  const normalizedSplitFileSha256 = normalizeSha256(
    verifiedSpatialSplit.fileSha256,
    "verifiedSpatialSplit.fileSha256"
  );
  const normalizedSplitManifestHash = normalizeSha256(
    verifiedSpatialSplit.manifestHash,
    "verifiedSpatialSplit.manifestHash"
  );
  const normalizedPredictionImplementationSha256 = normalizeSha256(
    predictionImplementationSha256,
    "predictionImplementationSha256"
  );
  const normalizedBaseAdminExposureCaps = normalizeBaseAdminExposureCaps(baseAdminExposureCapsByPrevalence);
  const normalizedQualityThresholds = normalizeQualityThresholds(qualityThresholds);
  const normalizedEvidenceOptions = normalizeEvidenceOptions(evidenceOptions);
  const normalizedDevelopmentPoolPositiveCounts = normalizeDevelopmentPoolPositiveCounts(
    developmentPoolPositiveCounts
  );

  mkdirSync(dirname(absolutePath), { recursive: true });
  const temporaryPath = `${absolutePath}.building-${process.pid}`;
  const temporarySidecar = `${sidecarPath}.building-${process.pid}`;
  safeUnlink(temporaryPath);
  safeUnlink(temporarySidecar);
  let database = null;
  let publishedCache = false;
  let publishedSidecar = false;
  try {
    database = new DatabaseSync(temporaryPath);
    database.exec(`
      PRAGMA journal_mode = OFF;
      PRAGMA synchronous = OFF;
      PRAGMA temp_store = MEMORY;
      PRAGMA secure_delete = ON;
    `);
    createCacheSchema(database);
    const insertFold = database.prepare(`
      INSERT INTO folds
        (fold_id, context_count, taxon_count, score_count, evidence_configuration_json,
         reference_raw_metrics_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertContext = database.prepare(`
      INSERT INTO contexts
        (fold_id, context_index, total, province_exposure, city_exposure, district_exposure,
         has_supported_local_unit, deepest_level)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertTaxon = database.prepare(`
      INSERT INTO taxa
        (fold_id, taxon_index, taxon_id, positive_count, development_positive_count,
         city_strength, district_strength)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertScore = database.prepare(`
      INSERT INTO scores
        (fold_id, context_index, taxon_index, actual_positive, province_detections,
         city_detections, district_detections, reference_raw_probability,
         reference_baseline_probability)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertInnerFold = database.prepare(`
      INSERT INTO inner_folds
        (outer_fold_id, inner_fold_id, training_fold_ids_json, context_count, taxon_count,
         score_count, evidence_configuration_json, reference_raw_metrics_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertInnerContext = database.prepare(`
      INSERT INTO inner_contexts
        (outer_fold_id, inner_fold_id, context_index, total, province_exposure, city_exposure,
         district_exposure, has_supported_local_unit, deepest_level)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertInnerTaxon = database.prepare(`
      INSERT INTO inner_taxa
        (outer_fold_id, inner_fold_id, taxon_index, taxon_id, positive_count, outer_positive_count,
         development_positive_count, city_strength, district_strength)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertInnerScore = database.prepare(`
      INSERT INTO inner_scores
        (outer_fold_id, inner_fold_id, context_index, taxon_index, actual_positive,
         province_detections, city_detections, district_detections, reference_raw_probability,
         reference_baseline_probability)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let totalRows = 0;
    let totalInnerRows = 0;
    let totalInnerFolds = 0;
    const seenFoldIds = [];
    database.exec("BEGIN IMMEDIATE");
    for (const fold of [...folds].sort((left, right) => Number(left.foldId) - Number(right.foldId))) {
      const foldId = Number(fold.foldId);
      if (!SPATIAL_OOF_CACHE_FOLD_IDS.includes(foldId) || seenFoldIds.includes(foldId)) {
        throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_FOLDS_INVALID", "折号必须恰为 1..5 且不可重复。", {
          foldId
        });
      }
      seenFoldIds.push(foldId);
      if (!Array.isArray(fold.scoreRows) || !fold.scoreRows.length) {
        throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_FOLD_EMPTY", `第 ${foldId} 折没有 scoreRows。`);
      }
      const normalizedRows = fold.scoreRows.map((row, index) => normalizeSourceRow(row, foldId, index));
      const normalizedEvidenceConfiguration = normalizeFoldEvidenceConfiguration(
        fold.evidenceConfiguration,
        `folds[${foldId}].evidenceConfiguration`
      );
      normalizedRows.sort(
        (left, right) => left.contextIndex - right.contextIndex || left.taxonId.localeCompare(right.taxonId)
      );
      const contexts = new Map();
      const taxa = new Map();
      for (const row of normalizedRows) {
        const context = {
          total: row.total,
          provinceExposure: row.adminEvidence.province.exposure,
          cityExposure: row.adminEvidence.city.exposure,
          districtExposure: row.adminEvidence.district.exposure,
          hasSupportedLocalUnit: row.hasSupportedLocalUnit,
          deepestLevel: row.deepestLevel
        };
        const priorContext = contexts.get(row.contextIndex);
        if (priorContext) {
          for (const key of ["total", "provinceExposure", "cityExposure", "districtExposure"]) {
            if (!comparableNumber(priorContext[key], context[key])) {
              throw new SpatialOofCacheError(
                "SPATIAL_OOF_CACHE_CONTEXT_INCONSISTENT",
                `第 ${foldId} 折 context ${row.contextIndex} 的 ${key} 不一致。`
              );
            }
          }
          if (
            priorContext.hasSupportedLocalUnit !== context.hasSupportedLocalUnit ||
            priorContext.deepestLevel !== context.deepestLevel
          ) {
            throw new SpatialOofCacheError(
              "SPATIAL_OOF_CACHE_CONTEXT_INCONSISTENT",
              `第 ${foldId} 折 context ${row.contextIndex} 的层级信息不一致。`
            );
          }
        } else {
          contexts.set(row.contextIndex, context);
        }
        const taxon = {
          positiveCount: row.positiveCount,
          developmentPositiveCount: normalizedDevelopmentPoolPositiveCounts.get(row.taxonId),
          cityStrength: row.adminEvidence.city.strength,
          districtStrength: row.adminEvidence.district.strength
        };
        if (
          taxon.developmentPositiveCount === undefined ||
          taxon.developmentPositiveCount < taxon.positiveCount
        ) {
          throw new SpatialOofCacheError(
            "SPATIAL_OOF_CACHE_VALUE_INVALID",
            `第 ${foldId} 折 taxon ${row.taxonId} 缺少一致的 development-pool positive_count。`
          );
        }
        const priorTaxon = taxa.get(row.taxonId);
        if (priorTaxon) {
          for (const key of [
            "positiveCount",
            "developmentPositiveCount",
            "cityStrength",
            "districtStrength"
          ]) {
            if (!comparableNumber(priorTaxon[key], taxon[key])) {
              throw new SpatialOofCacheError(
                "SPATIAL_OOF_CACHE_TAXON_INCONSISTENT",
                `第 ${foldId} 折 taxon ${row.taxonId} 的 ${key} 不一致。`
              );
            }
          }
        } else {
          taxa.set(row.taxonId, taxon);
        }
      }
      const contextIds = [...contexts.keys()].sort((left, right) => left - right);
      if (contextIds.some((value, index) => value !== index)) {
        throw new SpatialOofCacheError(
          "SPATIAL_OOF_CACHE_CONTEXT_ORDINALS_INVALID",
          `第 ${foldId} 折 contextIndex 必须从 0 开始连续。`,
          { contextIds }
        );
      }
      const taxonIds = [...taxa.keys()].sort();
      if (normalizedRows.length !== contextIds.length * taxonIds.length) {
        throw new SpatialOofCacheError(
          "SPATIAL_OOF_CACHE_ROSTER_INCOMPLETE",
          `第 ${foldId} 折每个 context 必须包含完整 taxon roster。`,
          {
            rows: normalizedRows.length,
            contexts: contextIds.length,
            taxa: taxonIds.length
          }
        );
      }
      const taxonIndexes = new Map(taxonIds.map((taxonId, index) => [taxonId, index]));
      insertFold.run(
        foldId,
        contextIds.length,
        taxonIds.length,
        normalizedRows.length,
        JSON.stringify(normalizedEvidenceConfiguration),
        JSON.stringify(metricProjection(
          fold.referenceRawMetrics || fold.rawMetrics || null,
          `folds[${foldId}].referenceRawMetrics`
        ))
      );
      for (const contextIndex of contextIds) {
        const context = contexts.get(contextIndex);
        insertContext.run(
          foldId,
          contextIndex,
          context.total,
          context.provinceExposure,
          context.cityExposure,
          context.districtExposure,
          context.hasSupportedLocalUnit ? 1 : 0,
          context.deepestLevel
        );
      }
      for (const [taxonIndex, taxonId] of taxonIds.entries()) {
        const taxon = taxa.get(taxonId);
        insertTaxon.run(
          foldId,
          taxonIndex,
          taxonId,
          taxon.positiveCount,
          taxon.developmentPositiveCount,
          taxon.cityStrength,
          taxon.districtStrength
        );
      }
      for (const row of normalizedRows) {
        insertScore.run(
          foldId,
          row.contextIndex,
          taxonIndexes.get(row.taxonId),
          row.actualPositive,
          row.adminEvidence.province.detections,
          row.adminEvidence.city.detections,
          row.adminEvidence.district.detections,
          row.rawProbability,
          row.baselineProbability
        );
      }
      totalRows += normalizedRows.length;

      const expectedInnerFoldIds = SPATIAL_OOF_CACHE_FOLD_IDS
        .filter((candidateFoldId) => candidateFoldId !== foldId);
      if (!Array.isArray(fold.innerFolds) || fold.innerFolds.length !== expectedInnerFoldIds.length) {
        throw new SpatialOofCacheError(
          "SPATIAL_OOF_CACHE_INNER_FOLDS_INVALID",
          `第 ${foldId} 个 outer 折必须包含其余四个严格 inner heldout 折。`
        );
      }
      const seenInnerFoldIds = [];
      const outerPositiveCounts = new Map(
        [...taxa].map(([taxonId, taxon]) => [taxonId, taxon.positiveCount])
      );
      for (const innerFold of [...fold.innerFolds].sort(
        (left, right) => Number(left.innerFoldId ?? left.foldId) - Number(right.innerFoldId ?? right.foldId)
      )) {
        const innerFoldId = Number(innerFold.innerFoldId ?? innerFold.foldId);
        if (
          innerFoldId === foldId ||
          !expectedInnerFoldIds.includes(innerFoldId) ||
          seenInnerFoldIds.includes(innerFoldId)
        ) {
          throw new SpatialOofCacheError(
            "SPATIAL_OOF_CACHE_INNER_FOLDS_INVALID",
            `outer ${foldId} 的 inner 折号必须恰为其余四折且不可重复。`,
            { innerFoldId }
          );
        }
        seenInnerFoldIds.push(innerFoldId);
        const expectedTrainingFoldIds = SPATIAL_OOF_CACHE_FOLD_IDS
          .filter((candidateFoldId) => candidateFoldId !== foldId && candidateFoldId !== innerFoldId);
        const trainingFoldIds = Array.isArray(innerFold.trainingFoldIds)
          ? innerFold.trainingFoldIds.map(Number).sort((left, right) => left - right)
          : [];
        if (!sameStringArray(trainingFoldIds.map(String), expectedTrainingFoldIds.map(String))) {
          throw new SpatialOofCacheError(
            "SPATIAL_OOF_CACHE_INNER_FOLDS_INVALID",
            `outer ${foldId} / inner ${innerFoldId} 必须只使用其余三折训练。`,
            { expectedTrainingFoldIds, actualTrainingFoldIds: trainingFoldIds }
          );
        }
        const path = `folds[${foldId}].innerFolds[${innerFoldId}]`;
        const prepared = normalizeEvidenceSet({
          scoreRows: innerFold.scoreRows,
          path,
          foldId: innerFoldId,
          evidenceConfiguration: innerFold.evidenceConfiguration,
          developmentPositiveCounts: normalizedDevelopmentPoolPositiveCounts,
          outerPositiveCounts
        });
        insertInnerFold.run(
          foldId,
          innerFoldId,
          JSON.stringify(trainingFoldIds),
          prepared.contextIds.length,
          prepared.taxonIds.length,
          prepared.normalizedRows.length,
          JSON.stringify(prepared.normalizedEvidenceConfiguration),
          JSON.stringify(metricProjection(
            innerFold.referenceRawMetrics || innerFold.rawMetrics || null,
            `${path}.referenceRawMetrics`
          ))
        );
        for (const contextIndex of prepared.contextIds) {
          const context = prepared.contexts.get(contextIndex);
          insertInnerContext.run(
            foldId,
            innerFoldId,
            contextIndex,
            context.total,
            context.provinceExposure,
            context.cityExposure,
            context.districtExposure,
            context.hasSupportedLocalUnit ? 1 : 0,
            context.deepestLevel
          );
        }
        for (const [taxonIndex, taxonId] of prepared.taxonIds.entries()) {
          const taxon = prepared.taxa.get(taxonId);
          insertInnerTaxon.run(
            foldId,
            innerFoldId,
            taxonIndex,
            taxonId,
            taxon.positiveCount,
            taxon.outerPositiveCount,
            taxon.developmentPositiveCount,
            taxon.cityStrength,
            taxon.districtStrength
          );
        }
        for (const row of prepared.normalizedRows) {
          insertInnerScore.run(
            foldId,
            innerFoldId,
            row.contextIndex,
            prepared.taxonIndexes.get(row.taxonId),
            row.actualPositive,
            row.adminEvidence.province.detections,
            row.adminEvidence.city.detections,
            row.adminEvidence.district.detections,
            row.rawProbability,
            row.baselineProbability
          );
        }
        totalInnerRows += prepared.normalizedRows.length;
        totalInnerFolds += 1;
      }
      if (!sameStringArray(seenInnerFoldIds.map(String), expectedInnerFoldIds.map(String))) {
        throw new SpatialOofCacheError(
          "SPATIAL_OOF_CACHE_INNER_FOLDS_INVALID",
          `outer ${foldId} 的 inner 折不完整。`,
          { expectedInnerFoldIds, seenInnerFoldIds }
        );
      }
    }
    if (!sameStringArray(seenFoldIds.map(String), SPATIAL_OOF_CACHE_FOLD_IDS.map(String))) {
      throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_FOLDS_INVALID", "OOF 缓存折号不完整。", {
        seenFoldIds
      });
    }
    if (totalInnerFolds !== SPATIAL_OOF_CACHE_FOLD_IDS.length * (SPATIAL_OOF_CACHE_FOLD_IDS.length - 1)) {
      throw new SpatialOofCacheError(
        "SPATIAL_OOF_CACHE_INNER_FOLDS_INVALID",
        "严格 nested OOF 缓存必须包含完整 20 个 outer×inner 折。",
        { totalInnerFolds }
      );
    }
    database.exec("COMMIT");

    const baseMetadata = {
      schemaVersion: SPATIAL_OOF_CACHE_SCHEMA_VERSION,
      cacheKind: SPATIAL_OOF_CACHE_KIND,
      panel: SPATIAL_OOF_CACHE_PANEL,
      sourceSnapshotSha256: actualSnapshotSha256,
      spatialSplitFileSha256: normalizedSplitFileSha256,
      spatialSplitManifestHash: normalizedSplitManifestHash,
      evidenceContractSha256: SPATIAL_OOF_CACHE_EVIDENCE_CONTRACT_SHA256,
      generationImplementationSha256,
      predictionImplementationSha256: normalizedPredictionImplementationSha256,
      candidateSetSha256: candidateSetSha256(),
      developmentPoolPositiveCountPolicy: DEVELOPMENT_POOL_POSITIVE_COUNT_POLICY,
      outerTrainingPositiveCountPolicy: OUTER_TRAINING_POSITIVE_COUNT_POLICY,
      innerTrainingPositiveCountPolicy: INNER_TRAINING_POSITIVE_COUNT_POLICY,
      baseAdminExposureCapsByPrevalence: normalizedBaseAdminExposureCaps,
      qualityThresholds: normalizedQualityThresholds,
      evidenceOptions: normalizedEvidenceOptions,
      foldCount: SPATIAL_OOF_CACHE_FOLD_IDS.length,
      innerFoldCount: totalInnerFolds,
      outerRowCount: totalRows,
      innerRowCount: totalInnerRows,
      rowCount: totalRows + totalInnerRows,
      privacyContract: normalizePrivacyContract({
        contextIdentity: "outer_inner_fold_local_dense_ordinal_without_location_mapping",
        reportIds: false,
        observers: false,
        coordinates: false,
        exactSpatialIdentifiers: false,
        names: false
      }),
      diagnosticOnly: true
    };
    for (const key of CACHE_METADATA_KEYS.filter((key) => key !== "payloadSha256")) {
      setMetadata(database, key, baseMetadata[key]);
    }
    setMetadata(database, "payloadSha256", logicalPayloadSha256(database));
    database.exec("VACUUM;");
    const quickCheck = database.prepare("PRAGMA quick_check").get().quick_check;
    const freePages = Number(database.prepare("PRAGMA freelist_count").get().freelist_count) || 0;
    if (quickCheck !== "ok" || freePages !== 0) {
      throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_INTEGRITY_FAILED", "OOF 缓存完整性或清理校验失败。", {
        quickCheck,
        freePages
      });
    }
    database.close();
    database = null;
    const fileSha256 = sha256File(temporaryPath);
    writeFileSync(
      temporarySidecar,
      `${fileSha256}  ${absolutePath.split(/[\\/]/).pop()}\n`,
      "utf8"
    );
    renameSync(temporaryPath, absolutePath);
    publishedCache = true;
    renameSync(temporarySidecar, sidecarPath);
    publishedSidecar = true;
    try {
      chmodSync(absolutePath, 0o444);
    } catch {
      // Windows ACLs may ignore POSIX mode bits.
    }
    return {
      path: absolutePath,
      fileSha256,
      sidecarPath,
      schemaVersion: SPATIAL_OOF_CACHE_SCHEMA_VERSION,
      panel: SPATIAL_OOF_CACHE_PANEL,
      foldCount: SPATIAL_OOF_CACHE_FOLD_IDS.length,
      innerFoldCount: totalInnerFolds,
      outerRowCount: totalRows,
      innerRowCount: totalInnerRows,
      rowCount: totalRows + totalInnerRows,
      bytes: statSync(absolutePath).size,
      evidenceContractSha256: SPATIAL_OOF_CACHE_EVIDENCE_CONTRACT_SHA256,
      generationImplementationSha256,
      diagnosticOnly: true
    };
  } catch (error) {
    if (database) {
      try {
        database.close();
      } catch {
        // already closed
      }
    }
    safeUnlink(temporaryPath);
    safeUnlink(temporarySidecar);
    if (publishedSidecar) safeUnlink(sidecarPath);
    if (publishedCache) safeUnlink(absolutePath);
    throw error;
  }
}

function parseMetadata(database) {
  const rows = database.prepare("SELECT key, value FROM metadata ORDER BY key").all();
  const actualKeys = rows.map((row) => row.key);
  if (!sameStringArray(actualKeys, [...CACHE_METADATA_KEYS].sort())) {
    throw new SpatialOofCacheError(
      "SPATIAL_OOF_CACHE_METADATA_INVALID",
      "OOF 缓存 metadata 不符合严格白名单。",
      { expected: [...CACHE_METADATA_KEYS].sort(), actual: actualKeys }
    );
  }
  return Object.fromEntries(rows.map((row) => {
    try {
      return [row.key, JSON.parse(row.value)];
    } catch {
      throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_METADATA_INVALID", `metadata.${row.key} 不是合法 JSON。`);
    }
  }));
}

function assertCanonicalNormalization(actual, normalized, path) {
  if (canonicalJson(actual) !== canonicalJson(normalized)) {
    throw new SpatialOofCacheError(
      "SPATIAL_OOF_CACHE_METADATA_INVALID",
      `${path} 不符合严格类型与字段白名单。`
    );
  }
}

function validateMetadataShape(metadata) {
  for (const key of [
    "candidateSetSha256",
    "evidenceContractSha256",
    "generationImplementationSha256",
    "payloadSha256",
    "predictionImplementationSha256",
    "sourceSnapshotSha256",
    "spatialSplitFileSha256",
    "spatialSplitManifestHash"
  ]) normalizeSha256(metadata[key], `metadata.${key}`);
  finiteInteger(metadata.schemaVersion, "metadata.schemaVersion", { minimum: 1 });
  finiteInteger(metadata.foldCount, "metadata.foldCount", { minimum: 1 });
  finiteInteger(metadata.innerFoldCount, "metadata.innerFoldCount", { minimum: 1 });
  finiteInteger(metadata.outerRowCount, "metadata.outerRowCount", { minimum: 1 });
  finiteInteger(metadata.innerRowCount, "metadata.innerRowCount", { minimum: 1 });
  finiteInteger(metadata.rowCount, "metadata.rowCount", { minimum: 1 });
  if (typeof metadata.diagnosticOnly !== "boolean") {
    throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_METADATA_INVALID", "metadata.diagnosticOnly 必须是布尔值。" );
  }
  if (metadata.developmentPoolPositiveCountPolicy !== DEVELOPMENT_POOL_POSITIVE_COUNT_POLICY) {
    throw new SpatialOofCacheError(
      "SPATIAL_OOF_CACHE_METADATA_INVALID",
      "metadata.developmentPoolPositiveCountPolicy 不匹配。"
    );
  }
  if (metadata.outerTrainingPositiveCountPolicy !== OUTER_TRAINING_POSITIVE_COUNT_POLICY) {
    throw new SpatialOofCacheError(
      "SPATIAL_OOF_CACHE_METADATA_INVALID",
      "metadata.outerTrainingPositiveCountPolicy 不匹配。"
    );
  }
  if (metadata.innerTrainingPositiveCountPolicy !== INNER_TRAINING_POSITIVE_COUNT_POLICY) {
    throw new SpatialOofCacheError(
      "SPATIAL_OOF_CACHE_METADATA_INVALID",
      "metadata.innerTrainingPositiveCountPolicy 不匹配。"
    );
  }
  assertCanonicalNormalization(
    metadata.baseAdminExposureCapsByPrevalence,
    normalizeBaseAdminExposureCaps(metadata.baseAdminExposureCapsByPrevalence),
    "metadata.baseAdminExposureCapsByPrevalence"
  );
  assertCanonicalNormalization(
    metadata.qualityThresholds,
    normalizeQualityThresholds(metadata.qualityThresholds),
    "metadata.qualityThresholds"
  );
  assertCanonicalNormalization(
    metadata.evidenceOptions,
    normalizeEvidenceOptions(metadata.evidenceOptions),
    "metadata.evidenceOptions"
  );
  assertCanonicalNormalization(
    metadata.privacyContract,
    normalizePrivacyContract(metadata.privacyContract),
    "metadata.privacyContract"
  );
}

function parseWhitelistedJson(value, path) {
  try {
    return JSON.parse(value);
  } catch {
    throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_METADATA_INVALID", `${path} 不是合法 JSON。`);
  }
}

function validateSchema(database) {
  const schemaObjects = cacheSchemaObjects(database);
  const expectedSchemaObjects = getExpectedCacheSchemaObjects();
  if (canonicalJson(schemaObjects) !== canonicalJson(expectedSchemaObjects)) {
    throw new SpatialOofCacheError(
      "SPATIAL_OOF_CACHE_SCHEMA_INVALID",
      "OOF 缓存 DDL 必须精确匹配固定表、约束和 WITHOUT ROWID 契约。",
      {
        expectedObjects: expectedSchemaObjects.map(({ type, name, tbl_name }) => ({ type, name, tbl_name })),
        actualObjects: schemaObjects.map(({ type, name, tbl_name }) => ({ type, name, tbl_name }))
      }
    );
  }
  const tables = schemaObjects.filter((row) => row.type === "table").map((row) => row.name).sort();
  const expectedTables = Object.keys(CACHE_TABLE_COLUMNS).sort();
  if (!sameStringArray(tables, expectedTables)) {
    throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_SCHEMA_INVALID", "OOF 缓存表不符合严格白名单。", {
      expectedTables,
      tables
    });
  }
  for (const table of expectedTables) {
    const columns = database.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name);
    if (!sameStringArray(columns, CACHE_TABLE_COLUMNS[table])) {
      throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_SCHEMA_INVALID", `${table} 列不符合严格白名单。`, {
        expected: CACHE_TABLE_COLUMNS[table],
        actual: columns
      });
    }
  }
}

function validateCacheContents(database, metadata, expectedFoldIds) {
  const quickCheck = database.prepare("PRAGMA quick_check").get().quick_check;
  const foreignKeyRows = database.prepare("PRAGMA foreign_key_check").all();
  const freePages = Number(database.prepare("PRAGMA freelist_count").get().freelist_count) || 0;
  if (quickCheck !== "ok" || foreignKeyRows.length || freePages !== 0) {
    throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_INTEGRITY_FAILED", "OOF 缓存 SQLite 完整性校验失败。", {
      quickCheck,
      foreignKeyViolationCount: foreignKeyRows.length,
      freePages
    });
  }
  const foldRows = database.prepare("SELECT * FROM folds ORDER BY fold_id").all();
  const actualFoldIds = foldRows.map((row) => Number(row.fold_id));
  if (!sameStringArray(actualFoldIds.map(String), expectedFoldIds.map(String))) {
    throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_FOLDS_INVALID", "OOF 缓存必须包含完整 development 五折。", {
      expectedFoldIds,
      actualFoldIds
    });
  }
  let totalRows = 0;
  for (const fold of foldRows) {
    const foldId = Number(fold.fold_id);
    const evidenceConfiguration = parseWhitelistedJson(
      fold.evidence_configuration_json,
      `folds[${foldId}].evidenceConfiguration`
    );
    assertCanonicalNormalization(
      evidenceConfiguration,
      normalizeFoldEvidenceConfiguration(evidenceConfiguration, `folds[${foldId}].evidenceConfiguration`),
      `folds[${foldId}].evidenceConfiguration`
    );
    const referenceRawMetrics = parseWhitelistedJson(
      fold.reference_raw_metrics_json,
      `folds[${foldId}].referenceRawMetrics`
    );
    assertCanonicalNormalization(
      referenceRawMetrics,
      metricProjection(referenceRawMetrics, `folds[${foldId}].referenceRawMetrics`),
      `folds[${foldId}].referenceRawMetrics`
    );
    const counts = database.prepare(`
      SELECT COUNT(*) AS score_count,
             COUNT(DISTINCT context_index) AS context_count,
             COUNT(DISTINCT taxon_index) AS taxon_count
      FROM scores WHERE fold_id = ?
    `).get(foldId);
    if (
      Number(counts.score_count) !== Number(fold.score_count) ||
      Number(counts.context_count) !== Number(fold.context_count) ||
      Number(counts.taxon_count) !== Number(fold.taxon_count) ||
      Number(counts.score_count) !== Number(fold.context_count) * Number(fold.taxon_count)
    ) {
      throw new SpatialOofCacheError(
        "SPATIAL_OOF_CACHE_ROSTER_INCOMPLETE",
        `第 ${foldId} 折的 context×taxon roster 不完整。`,
        { fold, counts }
      );
    }
    const roster = database.prepare(`
      SELECT MIN(count) AS minimum_count, MAX(count) AS maximum_count
      FROM (SELECT context_index, COUNT(*) AS count FROM scores WHERE fold_id=? GROUP BY context_index)
    `).get(foldId);
    if (
      Number(roster.minimum_count) !== Number(fold.taxon_count) ||
      Number(roster.maximum_count) !== Number(fold.taxon_count)
    ) {
      throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_ROSTER_INCOMPLETE", `第 ${foldId} 折 roster 不一致。`);
    }
    totalRows += Number(counts.score_count);
  }
  let totalInnerRows = 0;
  const innerFoldRows = database.prepare(
    "SELECT * FROM inner_folds ORDER BY outer_fold_id, inner_fold_id"
  ).all();
  const expectedInnerFoldCount = expectedFoldIds.length * (expectedFoldIds.length - 1);
  if (innerFoldRows.length !== expectedInnerFoldCount) {
    throw new SpatialOofCacheError(
      "SPATIAL_OOF_CACHE_INNER_FOLDS_INVALID",
      "OOF 缓存必须包含完整 20 个 outer×inner 折。",
      { expectedInnerFoldCount, actualInnerFoldCount: innerFoldRows.length }
    );
  }
  for (const innerFold of innerFoldRows) {
    const outerFoldId = Number(innerFold.outer_fold_id);
    const innerFoldId = Number(innerFold.inner_fold_id);
    const expectedTrainingFoldIds = expectedFoldIds
      .filter((foldId) => foldId !== outerFoldId && foldId !== innerFoldId);
    const trainingFoldIds = parseWhitelistedJson(
      innerFold.training_fold_ids_json,
      `innerFolds[${outerFoldId}:${innerFoldId}].trainingFoldIds`
    );
    if (
      !Array.isArray(trainingFoldIds) ||
      !sameStringArray(trainingFoldIds.map(String), expectedTrainingFoldIds.map(String))
    ) {
      throw new SpatialOofCacheError(
        "SPATIAL_OOF_CACHE_INNER_FOLDS_INVALID",
        `outer ${outerFoldId} / inner ${innerFoldId} 的三折训练来源不匹配。`,
        { expectedTrainingFoldIds, trainingFoldIds }
      );
    }
    const path = `innerFolds[${outerFoldId}:${innerFoldId}]`;
    const evidenceConfiguration = parseWhitelistedJson(
      innerFold.evidence_configuration_json,
      `${path}.evidenceConfiguration`
    );
    assertCanonicalNormalization(
      evidenceConfiguration,
      normalizeFoldEvidenceConfiguration(evidenceConfiguration, `${path}.evidenceConfiguration`),
      `${path}.evidenceConfiguration`
    );
    const referenceRawMetrics = parseWhitelistedJson(
      innerFold.reference_raw_metrics_json,
      `${path}.referenceRawMetrics`
    );
    assertCanonicalNormalization(
      referenceRawMetrics,
      metricProjection(referenceRawMetrics, `${path}.referenceRawMetrics`),
      `${path}.referenceRawMetrics`
    );
    const counts = database.prepare(`
      SELECT COUNT(*) AS score_count,
             COUNT(DISTINCT context_index) AS context_count,
             COUNT(DISTINCT taxon_index) AS taxon_count
      FROM inner_scores WHERE outer_fold_id = ? AND inner_fold_id = ?
    `).get(outerFoldId, innerFoldId);
    if (
      Number(counts.score_count) !== Number(innerFold.score_count) ||
      Number(counts.context_count) !== Number(innerFold.context_count) ||
      Number(counts.taxon_count) !== Number(innerFold.taxon_count) ||
      Number(counts.score_count) !== Number(innerFold.context_count) * Number(innerFold.taxon_count)
    ) {
      throw new SpatialOofCacheError(
        "SPATIAL_OOF_CACHE_ROSTER_INCOMPLETE",
        `${path} 的 context×taxon roster 不完整。`,
        { innerFold, counts }
      );
    }
    const roster = database.prepare(`
      SELECT MIN(count) AS minimum_count, MAX(count) AS maximum_count
      FROM (
        SELECT context_index, COUNT(*) AS count
        FROM inner_scores
        WHERE outer_fold_id=? AND inner_fold_id=?
        GROUP BY context_index
      )
    `).get(outerFoldId, innerFoldId);
    if (
      Number(roster.minimum_count) !== Number(innerFold.taxon_count) ||
      Number(roster.maximum_count) !== Number(innerFold.taxon_count)
    ) {
      throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_ROSTER_INCOMPLETE", `${path} roster 不一致。`);
    }
    totalInnerRows += Number(counts.score_count);
  }
  const invalidScores = Number(database.prepare(`
    SELECT COUNT(*) AS count
    FROM scores scores
    JOIN contexts contexts USING (fold_id, context_index)
    JOIN taxa taxa USING (fold_id, taxon_index)
    WHERE scores.actual_positive < 0 OR scores.actual_positive > contexts.total
       OR scores.province_detections < 0 OR scores.province_detections > contexts.province_exposure
       OR scores.city_detections < 0 OR scores.city_detections > contexts.city_exposure
       OR scores.district_detections < 0 OR scores.district_detections > contexts.district_exposure
       OR scores.reference_raw_probability < 0 OR scores.reference_raw_probability > 1
       OR scores.reference_baseline_probability < 0 OR scores.reference_baseline_probability > 1
       OR taxa.positive_count < 0 OR taxa.development_positive_count < taxa.positive_count
       OR taxa.city_strength < 0 OR taxa.district_strength < 0
  `).get().count) || 0;
  if (invalidScores) {
    throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_VALUE_INVALID", "OOF 缓存含越界数值。", {
      invalidScores
    });
  }
  const invalidInnerScores = Number(database.prepare(`
    SELECT COUNT(*) AS count
    FROM inner_scores scores
    JOIN inner_contexts contexts USING (outer_fold_id, inner_fold_id, context_index)
    JOIN inner_taxa taxa USING (outer_fold_id, inner_fold_id, taxon_index)
    WHERE scores.actual_positive < 0 OR scores.actual_positive > contexts.total
       OR scores.province_detections < 0 OR scores.province_detections > contexts.province_exposure
       OR scores.city_detections < 0 OR scores.city_detections > contexts.city_exposure
       OR scores.district_detections < 0 OR scores.district_detections > contexts.district_exposure
       OR scores.reference_raw_probability < 0 OR scores.reference_raw_probability > 1
       OR scores.reference_baseline_probability < 0 OR scores.reference_baseline_probability > 1
       OR taxa.positive_count < 0 OR taxa.outer_positive_count < taxa.positive_count
       OR taxa.development_positive_count < taxa.outer_positive_count
       OR taxa.city_strength < 0 OR taxa.district_strength < 0
  `).get().count) || 0;
  if (invalidInnerScores) {
    throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_VALUE_INVALID", "OOF 缓存含越界 inner 数值。", {
      invalidInnerScores
    });
  }
  if (
    Number(metadata.outerRowCount) !== totalRows ||
    Number(metadata.innerRowCount) !== totalInnerRows ||
    Number(metadata.rowCount) !== totalRows + totalInnerRows ||
    Number(metadata.foldCount) !== foldRows.length ||
    Number(metadata.innerFoldCount) !== innerFoldRows.length
  ) {
    throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_COUNTS_MISMATCH", "OOF 缓存 metadata 计数不匹配。", {
      metadataRowCount: metadata.rowCount,
      actualRowCount: totalRows + totalInnerRows,
      totalRows,
      totalInnerRows
    });
  }
  const payloadSha256 = logicalPayloadSha256(database);
  if (payloadSha256 !== metadata.payloadSha256) {
    throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_PAYLOAD_MISMATCH", "OOF 缓存逻辑内容摘要不匹配。", {
      expected: metadata.payloadSha256,
      actual: payloadSha256
    });
  }
}

function loadSpatialOofCache({
  cachePath,
  verifiedSpatialSplit,
  sourceSnapshotSha256,
  generationImplementationSha256 = spatialOofCacheGenerationImplementationSha256()
}) {
  if (verifiedSpatialSplit?.panelName !== SPATIAL_OOF_CACHE_PANEL) {
    throw new SpatialOofCacheError(
      "SPATIAL_OOF_CACHE_DEVELOPMENT_ONLY",
      "OOF 缓存只能在 development split 下读取。"
    );
  }
  const absolutePath = resolve(cachePath);
  const sidecarPath = `${absolutePath}.sha256`;
  if (!existsSync(absolutePath) || !existsSync(sidecarPath)) {
    throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_MISSING", "OOF 缓存或其 SHA sidecar 不存在。", {
      cachePath: absolutePath
    });
  }
  const expectedFileSha256 = String(readFileSync(sidecarPath, "utf8")).trim().split(/\s+/)[0]?.toLowerCase();
  const fileSha256 = sha256File(absolutePath);
  if (!/^[0-9a-f]{64}$/.test(expectedFileSha256 || "") || expectedFileSha256 !== fileSha256) {
    throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_FILE_HASH_MISMATCH", "OOF 缓存文件 SHA-256 校验失败。", {
      expectedFileSha256,
      actualFileSha256: fileSha256
    });
  }
  const database = new DatabaseSync(absolutePath, { readOnly: true });
  try {
    database.exec("PRAGMA query_only = ON; PRAGMA foreign_keys = ON;");
    validateSchema(database);
    const metadata = parseMetadata(database);
    validateMetadataShape(metadata);
    const expectedSnapshot = String(sourceSnapshotSha256 || "").toLowerCase();
    const expectedFoldIds = (verifiedSpatialSplit.panel?.folds || [])
      .map((fold) => Number(fold.foldId))
      .sort((left, right) => left - right);
    const mismatches = [];
    if (metadata.schemaVersion !== SPATIAL_OOF_CACHE_SCHEMA_VERSION) mismatches.push("schemaVersion");
    if (metadata.cacheKind !== SPATIAL_OOF_CACHE_KIND) mismatches.push("cacheKind");
    if (metadata.panel !== SPATIAL_OOF_CACHE_PANEL) mismatches.push("panel");
    if (metadata.diagnosticOnly !== true) mismatches.push("diagnosticOnly");
    if (metadata.sourceSnapshotSha256 !== expectedSnapshot) mismatches.push("sourceSnapshotSha256");
    if (metadata.spatialSplitFileSha256 !== verifiedSpatialSplit.fileSha256) mismatches.push("spatialSplitFileSha256");
    if (metadata.spatialSplitManifestHash !== verifiedSpatialSplit.manifestHash) {
      mismatches.push("spatialSplitManifestHash");
    }
    if (metadata.evidenceContractSha256 !== SPATIAL_OOF_CACHE_EVIDENCE_CONTRACT_SHA256) {
      mismatches.push("evidenceContractSha256");
    }
    if (metadata.generationImplementationSha256 !== generationImplementationSha256) {
      mismatches.push("generationImplementationSha256");
    }
    if (metadata.candidateSetSha256 !== candidateSetSha256()) mismatches.push("candidateSetSha256");
    if (mismatches.length) {
      throw new SpatialOofCacheError("SPATIAL_OOF_CACHE_BINDING_MISMATCH", "OOF 缓存绑定校验失败。", {
        mismatches
      });
    }
    validateCacheContents(database, metadata, expectedFoldIds);
    const foldMetadata = new Map(
      database.prepare("SELECT * FROM folds ORDER BY fold_id").all().map((row) => [Number(row.fold_id), row])
    );
    const folds = SPATIAL_OOF_CACHE_FOLD_IDS.map((foldId) => ({
      foldId: String(foldId),
      referenceRawMetrics: (() => {
        const value = foldMetadata.get(foldId).reference_raw_metrics_json;
        return value == null ? null : JSON.parse(value);
      })(),
      evidenceConfiguration: JSON.parse(foldMetadata.get(foldId).evidence_configuration_json),
      scoreRows: [],
      innerFolds: []
    }));
    const foldById = new Map(folds.map((fold) => [Number(fold.foldId), fold]));
    for (const row of database.prepare(
      "SELECT * FROM inner_folds ORDER BY outer_fold_id, inner_fold_id"
    ).all()) {
      foldById.get(Number(row.outer_fold_id)).innerFolds.push({
        innerFoldId: String(row.inner_fold_id),
        trainingFoldIds: JSON.parse(row.training_fold_ids_json).map(String),
        referenceRawMetrics: row.reference_raw_metrics_json == null
          ? null
          : JSON.parse(row.reference_raw_metrics_json),
        evidenceConfiguration: JSON.parse(row.evidence_configuration_json),
        scoreRows: []
      });
    }
    const innerFoldById = new Map(folds.flatMap((fold) =>
      fold.innerFolds.map((innerFold) => [
        `${fold.foldId}\0${innerFold.innerFoldId}`,
        innerFold
      ])
    ));
    for (const row of database.prepare(`
      SELECT scores.fold_id, scores.context_index, taxa.taxon_id, taxa.positive_count,
             taxa.development_positive_count,
             scores.actual_positive, contexts.total,
             scores.reference_raw_probability, scores.reference_baseline_probability,
             contexts.deepest_level, contexts.has_supported_local_unit,
             contexts.province_exposure, scores.province_detections,
             contexts.city_exposure, scores.city_detections, taxa.city_strength,
             contexts.district_exposure, scores.district_detections, taxa.district_strength
      FROM scores
      JOIN contexts USING (fold_id, context_index)
      JOIN taxa USING (fold_id, taxon_index)
      ORDER BY scores.fold_id, scores.context_index, taxa.taxon_id
    `).iterate()) {
      foldById.get(Number(row.fold_id)).scoreRows.push({
        contextIndex: Number(row.context_index),
        taxonId: String(row.taxon_id),
        positiveCount: Number(row.positive_count),
        developmentPositiveCount: Number(row.development_positive_count),
        actualPositive: Number(row.actual_positive),
        total: Number(row.total),
        rawProbability: Number(row.reference_raw_probability),
        baselineProbability: Number(row.reference_baseline_probability),
        deepestLevel: String(row.deepest_level),
        hasSupportedLocalUnit: Boolean(row.has_supported_local_unit),
        provinceExposure: Number(row.province_exposure),
        provinceDetections: Number(row.province_detections),
        cityExposure: Number(row.city_exposure),
        cityDetections: Number(row.city_detections),
        cityStrength: Number(row.city_strength),
        districtExposure: Number(row.district_exposure),
        districtDetections: Number(row.district_detections),
        districtStrength: Number(row.district_strength)
      });
    }
    for (const row of database.prepare(`
      SELECT scores.outer_fold_id, scores.inner_fold_id, scores.context_index,
             taxa.taxon_id, taxa.positive_count, taxa.outer_positive_count,
             taxa.development_positive_count,
             scores.actual_positive, contexts.total,
             scores.reference_raw_probability, scores.reference_baseline_probability,
             contexts.deepest_level, contexts.has_supported_local_unit,
             contexts.province_exposure, scores.province_detections,
             contexts.city_exposure, scores.city_detections, taxa.city_strength,
             contexts.district_exposure, scores.district_detections, taxa.district_strength
      FROM inner_scores scores
      JOIN inner_contexts contexts USING (outer_fold_id, inner_fold_id, context_index)
      JOIN inner_taxa taxa USING (outer_fold_id, inner_fold_id, taxon_index)
      ORDER BY scores.outer_fold_id, scores.inner_fold_id, scores.context_index, taxa.taxon_id
    `).iterate()) {
      innerFoldById.get(`${row.outer_fold_id}\0${row.inner_fold_id}`).scoreRows.push({
        contextIndex: Number(row.context_index),
        taxonId: String(row.taxon_id),
        positiveCount: Number(row.positive_count),
        outerPositiveCount: Number(row.outer_positive_count),
        developmentPositiveCount: Number(row.development_positive_count),
        actualPositive: Number(row.actual_positive),
        total: Number(row.total),
        rawProbability: Number(row.reference_raw_probability),
        baselineProbability: Number(row.reference_baseline_probability),
        deepestLevel: String(row.deepest_level),
        hasSupportedLocalUnit: Boolean(row.has_supported_local_unit),
        provinceExposure: Number(row.province_exposure),
        provinceDetections: Number(row.province_detections),
        cityExposure: Number(row.city_exposure),
        cityDetections: Number(row.city_detections),
        cityStrength: Number(row.city_strength),
        districtExposure: Number(row.district_exposure),
        districtDetections: Number(row.district_detections),
        districtStrength: Number(row.district_strength)
      });
    }
    return {
      path: absolutePath,
      fileSha256,
      sidecarPath,
      metadata,
      folds
    };
  } finally {
    database.close();
  }
}

module.exports = {
  CACHE_METADATA_KEYS,
  CACHE_TABLE_COLUMNS,
  DEVELOPMENT_POOL_POSITIVE_COUNT_POLICY,
  INNER_TRAINING_POSITIVE_COUNT_POLICY,
  OUTER_TRAINING_POSITIVE_COUNT_POLICY,
  SPATIAL_OOF_CACHE_EVIDENCE_CONTRACT_SHA256,
  SPATIAL_OOF_CACHE_FOLD_IDS,
  SPATIAL_OOF_CACHE_GENERATION_FILES,
  SPATIAL_OOF_CACHE_KIND,
  SPATIAL_OOF_CACHE_SCHEMA_VERSION,
  SpatialOofCacheError,
  candidateSetSha256,
  loadSpatialOofCache,
  sha256File,
  spatialOofCacheGenerationImplementationSha256,
  writeSpatialOofCache
};
