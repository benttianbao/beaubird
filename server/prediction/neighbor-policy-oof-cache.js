"use strict";

const { createHash } = require("node:crypto");
const {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} = require("node:fs");
const { dirname, resolve } = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const { canonicalJson } = require("./spatial-splits");
const { sha256File } = require("./spatial-oof-cache");
const {
  NEIGHBOR_POLICY_DIAGNOSTIC_CONTRACT,
  neighborPolicyDiagnosticContractSha256
} = require("./continuous-habitat-neighbor-policies");

const NEIGHBOR_POLICY_OOF_CACHE_SCHEMA_VERSION = 1;
const NEIGHBOR_POLICY_OOF_CACHE_KIND =
  "zhejiang_development_strict_nested_neighbor_policy_sufficient_statistics_v1";
const NEIGHBOR_POLICY_OOF_CACHE_PANEL = "development";
const EXPECTED_NEIGHBOR_POLICY_CACHE_LAYOUT = Object.freeze({
  outerFoldCount: 5,
  innerFoldCount: 20,
  outerScoreRows: 347436,
  innerScoreRows: 1385452,
  totalScoreRows: 1732888,
  neighborChannelsPerScoreRow: 4,
  neighborDetectionRows: 6931552
});
const NEIGHBOR_POLICY_OOF_CACHE_FILES = Object.freeze([
  "tools/build-zhejiang-prediction-model.js",
  "server/prediction/continuous-habitat.js",
  "server/prediction/continuous-habitat-neighbor-policies.js",
  "server/prediction/neighbor-policy-oof-cache.js",
  "server/prediction/geo.js",
  "server/prediction/habitat-features.js",
  "server/prediction/location-normalization.js",
  "server/prediction/math.js",
  "server/prediction/model.js",
  "server/prediction/spatial-splits.js",
  "server/prediction/spatial-transfer.js",
  "server/prediction/vagrant-events.js"
]);
const CACHE_TABLE_COLUMNS = Object.freeze({
  metadata: Object.freeze(["key", "value"]),
  fold_sets: Object.freeze([
    "set_id",
    "outer_fold_id",
    "inner_fold_id",
    "training_fold_ids_json",
    "context_count",
    "taxon_count",
    "score_count",
    "evidence_configuration_json",
    "reference_raw_metrics_json"
  ]),
  contexts: Object.freeze([
    "set_id",
    "context_index",
    "total",
    "province_exposure",
    "city_exposure",
    "district_exposure",
    "has_supported_local_unit",
    "deepest_level"
  ]),
  taxa: Object.freeze([
    "set_id",
    "taxon_index",
    "taxon_id",
    "positive_count",
    "outer_positive_count",
    "development_positive_count",
    "city_strength",
    "district_strength"
  ]),
  scores: Object.freeze([
    "set_id",
    "context_index",
    "taxon_index",
    "actual_positive",
    "province_detections",
    "city_detections",
    "district_detections",
    "reference_raw_probability",
    "reference_baseline_probability"
  ]),
  neighbor_contexts: Object.freeze([
    "set_id",
    "context_index",
    "policy_id",
    "channel_id",
    "application_order",
    "exposure",
    "neighbor_count",
    "weight_sum",
    "evidence_exposure_cap",
    "evidence_prior_strength"
  ]),
  neighbor_detections: Object.freeze([
    "set_id",
    "context_index",
    "taxon_index",
    "policy_id",
    "channel_id",
    "detections"
  ])
});
const CACHE_METADATA_KEYS = Object.freeze([
  "baseAdminExposureCapsByPrevalence",
  "cacheKind",
  "contractSha256",
  "developmentPoolPositiveCountPolicy",
  "diagnosticOnly",
  "evidenceRowCount",
  "foldCount",
  "generationImplementationSha256",
  "generationOptions",
  "innerFoldCount",
  "innerRowCount",
  "outerRowCount",
  "panel",
  "predictionImplementationSha256",
  "privacyContract",
  "qualityThresholds",
  "schemaVersion",
  "sourceSnapshotSha256",
  "spatialSplitFileSha256",
  "spatialSplitManifestHash"
]);
const PRIVACY_CONTRACT = Object.freeze({
  contextIdentity: "outer_inner_fold_local_dense_ordinal_without_location_mapping",
  publicTaxonId: true,
  reportIds: false,
  observers: false,
  coordinates: false,
  exactSpatialIdentifiers: false,
  neighborIdentifiers: false,
  featureVectors: false,
  names: false
});
const FORBIDDEN_KEYS = Object.freeze([
  "report_id",
  "reportId",
  "observer",
  "observer_id",
  "observerId",
  "longitude",
  "latitude",
  "coordinate",
  "coordinates",
  "h3",
  "h3Index",
  "space_unit_id",
  "spaceUnitId",
  "neighbor_id",
  "neighborId",
  "unitId",
  "cityName",
  "feature_vector",
  "featureVector",
  "location_name",
  "locationName"
]);
const DEEPEST_LEVELS = new Set([
  "province",
  "city",
  "district",
  "habitat_continuous",
  "grid_r6",
  "grid_r7",
  "point"
]);
const DEVELOPMENT_POOL_POSITIVE_COUNT_POLICY =
  "distinct_known_observer_group_key_outside_all_sealed_r6_buffers";

class NeighborPolicyOofCacheError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "NeighborPolicyOofCacheError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function normalizeSha256(value, path) {
  const normalized = String(value || "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new NeighborPolicyOofCacheError(
      "NEIGHBOR_POLICY_OOF_CACHE_SHA_INVALID",
      `${path} 必须是 SHA-256。`
    );
  }
  return normalized;
}

function finiteNumber(value, path, { minimum = -Infinity, maximum = Infinity } = {}) {
  const number = Number(value);
  if (
    !Number.isFinite(number) ||
    number < minimum ||
    number > maximum
  ) {
    throw new NeighborPolicyOofCacheError(
      "NEIGHBOR_POLICY_OOF_CACHE_VALUE_INVALID",
      `${path} 不是允许范围内的有限数。`,
      { path, value }
    );
  }
  return number;
}

function finiteInteger(value, path, options = {}) {
  const number = finiteNumber(value, path, options);
  if (!Number.isInteger(number)) {
    throw new NeighborPolicyOofCacheError(
      "NEIGHBOR_POLICY_OOF_CACHE_VALUE_INVALID",
      `${path} 必须是整数。`
    );
  }
  return number;
}

function assertPrivacySafe(value, path = "value") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertPrivacySafe(entry, `${path}[${index}]`));
    return true;
  }
  if (!value || typeof value !== "object") return true;
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.includes(key) && entry !== false) {
      throw new NeighborPolicyOofCacheError(
        "NEIGHBOR_POLICY_OOF_CACHE_PRIVACY_VIOLATION",
        `${path}.${key} 是诊断缓存禁止字段。`
      );
    }
    assertPrivacySafe(entry, `${path}.${key}`);
  }
  return true;
}

function neighborPolicyOofCacheGenerationImplementationSha256(
  projectRoot = resolve(__dirname, "..", "..")
) {
  const hash = createHash("sha256");
  for (const relativePath of NEIGHBOR_POLICY_OOF_CACHE_FILES) {
    hash.update(relativePath);
    hash.update("\0");
    hash.update(readFileSync(resolve(projectRoot, relativePath)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function expectedPolicyChannels() {
  return new Map(
    NEIGHBOR_POLICY_DIAGNOSTIC_CONTRACT.policies.map((policy) => [
      policy.id,
      new Map(policy.channels.map((channel) => [channel.id, channel]))
    ])
  );
}

function normalizePolicyEvidence(value, path) {
  if (!Array.isArray(value)) {
    throw new NeighborPolicyOofCacheError(
      "NEIGHBOR_POLICY_OOF_CACHE_EVIDENCE_INVALID",
      `${path} 必须是完整候选数组。`
    );
  }
  const expected = expectedPolicyChannels();
  const actualPolicies = new Set();
  const normalized = [];
  for (const policy of value) {
    const policyId = String(policy?.policyId || "");
    if (!expected.has(policyId) || actualPolicies.has(policyId)) {
      throw new NeighborPolicyOofCacheError(
        "NEIGHBOR_POLICY_OOF_CACHE_EVIDENCE_INVALID",
        `${path} 包含未知或重复 policy。`,
        { policyId }
      );
    }
    actualPolicies.add(policyId);
    const expectedChannels = expected.get(policyId);
    if (!Array.isArray(policy.channels)) {
      throw new NeighborPolicyOofCacheError(
        "NEIGHBOR_POLICY_OOF_CACHE_EVIDENCE_INVALID",
        `${path}.${policyId}.channels 非法。`
      );
    }
    const actualChannels = new Set();
    const channels = policy.channels.map((channel) => {
      const channelId = String(channel?.channelId || "");
      const contract = expectedChannels.get(channelId);
      if (!contract || actualChannels.has(channelId)) {
        throw new NeighborPolicyOofCacheError(
          "NEIGHBOR_POLICY_OOF_CACHE_EVIDENCE_INVALID",
          `${path}.${policyId} 包含未知或重复 channel。`,
          { channelId }
        );
      }
      actualChannels.add(channelId);
      const normalizedChannel = {
        channelId,
        applicationOrder: finiteInteger(
          channel.applicationOrder,
          `${path}.${policyId}.${channelId}.applicationOrder`,
          { minimum: 0 }
        ),
        exposure: finiteNumber(
          channel.exposure,
          `${path}.${policyId}.${channelId}.exposure`,
          { minimum: 0 }
        ),
        detections: finiteNumber(
          channel.detections,
          `${path}.${policyId}.${channelId}.detections`,
          { minimum: 0 }
        ),
        neighborCount: finiteInteger(
          channel.neighborCount,
          `${path}.${policyId}.${channelId}.neighborCount`,
          { minimum: 0, maximum: contract.maximumNeighbors }
        ),
        weightSum: finiteNumber(
          channel.weightSum,
          `${path}.${policyId}.${channelId}.weightSum`,
          { minimum: 0, maximum: contract.maximumNeighbors }
        ),
        evidenceExposureCap: finiteNumber(
          channel.evidenceExposureCap,
          `${path}.${policyId}.${channelId}.evidenceExposureCap`,
          { minimum: 0 }
        ),
        evidencePriorStrength: finiteNumber(
          channel.evidencePriorStrength,
          `${path}.${policyId}.${channelId}.evidencePriorStrength`,
          { minimum: 0 }
        )
      };
      if (
        normalizedChannel.applicationOrder !== contract.applicationOrder ||
        normalizedChannel.evidenceExposureCap !== contract.evidenceExposureCap ||
        normalizedChannel.evidencePriorStrength !== contract.evidencePriorStrength ||
        normalizedChannel.detections > normalizedChannel.exposure + 1e-9
      ) {
        throw new NeighborPolicyOofCacheError(
          "NEIGHBOR_POLICY_OOF_CACHE_EVIDENCE_INVALID",
          `${path}.${policyId}.${channelId} 不匹配冻结 channel 契约。`
        );
      }
      return normalizedChannel;
    }).sort((left, right) =>
      left.applicationOrder - right.applicationOrder ||
      left.channelId.localeCompare(right.channelId)
    );
    if (
      channels.length !== expectedChannels.size ||
      [...expectedChannels.keys()].some(
        (channelId) => !actualChannels.has(channelId)
      )
    ) {
      throw new NeighborPolicyOofCacheError(
        "NEIGHBOR_POLICY_OOF_CACHE_EVIDENCE_INVALID",
        `${path}.${policyId} 缺少冻结 channel。`
      );
    }
    normalized.push({ policyId, channels });
  }
  if (
    normalized.length !== expected.size ||
    [...expected.keys()].some((policyId) => !actualPolicies.has(policyId))
  ) {
    throw new NeighborPolicyOofCacheError(
      "NEIGHBOR_POLICY_OOF_CACHE_EVIDENCE_INVALID",
      `${path} 缺少冻结 policy。`
    );
  }
  return normalized.sort(
    (left, right) =>
      [...expected.keys()].indexOf(left.policyId) -
      [...expected.keys()].indexOf(right.policyId)
  );
}

function normalizeAdminEvidence(row, path) {
  const levels = {};
  for (const level of ["province", "city", "district"]) {
    const evidence = row?.adminEvidence?.[level];
    levels[level] = {
      exposure: finiteNumber(
        evidence?.exposure,
        `${path}.adminEvidence.${level}.exposure`,
        { minimum: 0 }
      ),
      detections: finiteNumber(
        evidence?.detections,
        `${path}.adminEvidence.${level}.detections`,
        { minimum: 0 }
      ),
      strength: finiteNumber(
        evidence?.strength,
        `${path}.adminEvidence.${level}.strength`,
        { minimum: 0 }
      )
    };
    if (levels[level].detections > levels[level].exposure + 1e-9) {
      throw new NeighborPolicyOofCacheError(
        "NEIGHBOR_POLICY_OOF_CACHE_EVIDENCE_INVALID",
        `${path}.adminEvidence.${level} detections 超过 exposure。`
      );
    }
  }
  return levels;
}

function normalizeScoreRow(row, path) {
  const contextIndex = finiteInteger(row?.contextIndex, `${path}.contextIndex`, {
    minimum: 0
  });
  const taxonId = String(row?.taxonId || "").trim();
  if (!taxonId || taxonId.includes("\0")) {
    throw new NeighborPolicyOofCacheError(
      "NEIGHBOR_POLICY_OOF_CACHE_VALUE_INVALID",
      `${path}.taxonId 非法。`
    );
  }
  const positiveCount = finiteInteger(
    row.positiveCount,
    `${path}.positiveCount`,
    { minimum: 0 }
  );
  const total = finiteNumber(row.total, `${path}.total`, {
    minimum: Number.MIN_VALUE
  });
  const actualPositive = finiteNumber(
    row.actualPositive,
    `${path}.actualPositive`,
    { minimum: 0, maximum: total }
  );
  const rawProbability = finiteNumber(
    row.rawProbability,
    `${path}.rawProbability`,
    { minimum: 0, maximum: 1 }
  );
  const baselineProbability = finiteNumber(
    row.baselineProbability,
    `${path}.baselineProbability`,
    { minimum: 0, maximum: 1 }
  );
  const deepestLevel = String(row.deepestLevel || "");
  if (!DEEPEST_LEVELS.has(deepestLevel)) {
    throw new NeighborPolicyOofCacheError(
      "NEIGHBOR_POLICY_OOF_CACHE_VALUE_INVALID",
      `${path}.deepestLevel 非法。`
    );
  }
  if (typeof row.hasSupportedLocalUnit !== "boolean") {
    throw new NeighborPolicyOofCacheError(
      "NEIGHBOR_POLICY_OOF_CACHE_VALUE_INVALID",
      `${path}.hasSupportedLocalUnit 必须是布尔值。`
    );
  }
  const adminEvidence = normalizeAdminEvidence(row, path);
  const neighborPolicyEvidence = normalizePolicyEvidence(
    row.neighborPolicyEvidence,
    `${path}.neighborPolicyEvidence`
  );
  const control = neighborPolicyEvidence.find(
    (policy) => policy.policyId === "same_city_exclusive_v1"
  ).channels[0];
  const habitat = row.habitatEvidence;
  for (const [field, left, right] of [
    ["exposure", control.exposure, Number(habitat?.exposure)],
    ["detections", control.detections, Number(habitat?.detections)],
    ["neighborCount", control.neighborCount, Number(habitat?.neighborCount)],
    [
      "strength",
      control.evidencePriorStrength,
      Number(habitat?.strength)
    ]
  ]) {
    if (!Number.isFinite(right) || Math.abs(left - right) > 1e-10) {
      throw new NeighborPolicyOofCacheError(
        "NEIGHBOR_POLICY_OOF_CACHE_CONTROL_MISMATCH",
        `${path} 的 control ${field} 未精确复现当前连续生境证据。`,
        { field, expected: right, actual: left }
      );
    }
  }
  return {
    contextIndex,
    taxonId,
    positiveCount,
    total,
    actualPositive,
    rawProbability,
    baselineProbability,
    deepestLevel,
    hasSupportedLocalUnit: row.hasSupportedLocalUnit,
    adminEvidence,
    neighborPolicyEvidence
  };
}

function sameNumber(left, right) {
  return Math.abs(Number(left) - Number(right)) <= 1e-10;
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

function createCacheSchema(database) {
  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA page_size = 4096;
    CREATE TABLE metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) WITHOUT ROWID;
    CREATE TABLE fold_sets (
      set_id INTEGER PRIMARY KEY,
      outer_fold_id INTEGER NOT NULL CHECK(outer_fold_id BETWEEN 1 AND 5),
      inner_fold_id INTEGER NOT NULL CHECK(inner_fold_id BETWEEN 0 AND 5 AND inner_fold_id <> outer_fold_id),
      training_fold_ids_json TEXT NOT NULL,
      context_count INTEGER NOT NULL CHECK(context_count > 0),
      taxon_count INTEGER NOT NULL CHECK(taxon_count > 0),
      score_count INTEGER NOT NULL CHECK(score_count > 0),
      evidence_configuration_json TEXT NOT NULL,
      reference_raw_metrics_json TEXT,
      UNIQUE (outer_fold_id, inner_fold_id)
    );
    CREATE TABLE contexts (
      set_id INTEGER NOT NULL,
      context_index INTEGER NOT NULL CHECK(context_index >= 0),
      total REAL NOT NULL CHECK(total > 0),
      province_exposure REAL NOT NULL CHECK(province_exposure >= 0),
      city_exposure REAL NOT NULL CHECK(city_exposure >= 0),
      district_exposure REAL NOT NULL CHECK(district_exposure >= 0),
      has_supported_local_unit INTEGER NOT NULL CHECK(has_supported_local_unit IN (0, 1)),
      deepest_level TEXT NOT NULL CHECK(deepest_level IN ('province','city','district','habitat_continuous','grid_r6','grid_r7','point')),
      PRIMARY KEY (set_id, context_index),
      FOREIGN KEY (set_id) REFERENCES fold_sets(set_id)
    ) WITHOUT ROWID;
    CREATE TABLE taxa (
      set_id INTEGER NOT NULL,
      taxon_index INTEGER NOT NULL CHECK(taxon_index >= 0),
      taxon_id TEXT NOT NULL,
      positive_count INTEGER NOT NULL CHECK(positive_count >= 0),
      outer_positive_count INTEGER NOT NULL CHECK(outer_positive_count >= positive_count),
      development_positive_count INTEGER NOT NULL CHECK(development_positive_count >= outer_positive_count),
      city_strength REAL NOT NULL CHECK(city_strength >= 0),
      district_strength REAL NOT NULL CHECK(district_strength >= 0),
      PRIMARY KEY (set_id, taxon_index),
      UNIQUE (set_id, taxon_id),
      FOREIGN KEY (set_id) REFERENCES fold_sets(set_id)
    ) WITHOUT ROWID;
    CREATE TABLE scores (
      set_id INTEGER NOT NULL,
      context_index INTEGER NOT NULL,
      taxon_index INTEGER NOT NULL,
      actual_positive REAL NOT NULL CHECK(actual_positive >= 0),
      province_detections REAL NOT NULL CHECK(province_detections >= 0),
      city_detections REAL NOT NULL CHECK(city_detections >= 0),
      district_detections REAL NOT NULL CHECK(district_detections >= 0),
      reference_raw_probability REAL NOT NULL CHECK(reference_raw_probability BETWEEN 0 AND 1),
      reference_baseline_probability REAL NOT NULL CHECK(reference_baseline_probability BETWEEN 0 AND 1),
      PRIMARY KEY (set_id, context_index, taxon_index),
      FOREIGN KEY (set_id, context_index) REFERENCES contexts(set_id, context_index),
      FOREIGN KEY (set_id, taxon_index) REFERENCES taxa(set_id, taxon_index)
    ) WITHOUT ROWID;
    CREATE TABLE neighbor_contexts (
      set_id INTEGER NOT NULL,
      context_index INTEGER NOT NULL,
      policy_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      application_order INTEGER NOT NULL CHECK(application_order >= 0),
      exposure REAL NOT NULL CHECK(exposure >= 0),
      neighbor_count INTEGER NOT NULL CHECK(neighbor_count BETWEEN 0 AND 24),
      weight_sum REAL NOT NULL CHECK(weight_sum >= 0),
      evidence_exposure_cap REAL NOT NULL CHECK(evidence_exposure_cap >= 0),
      evidence_prior_strength REAL NOT NULL CHECK(evidence_prior_strength > 0),
      PRIMARY KEY (set_id, context_index, policy_id, channel_id),
      UNIQUE (set_id, context_index, policy_id, application_order),
      FOREIGN KEY (set_id, context_index) REFERENCES contexts(set_id, context_index)
    ) WITHOUT ROWID;
    CREATE TABLE neighbor_detections (
      set_id INTEGER NOT NULL,
      context_index INTEGER NOT NULL,
      taxon_index INTEGER NOT NULL,
      policy_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      detections REAL NOT NULL CHECK(detections >= 0),
      PRIMARY KEY (set_id, context_index, taxon_index, policy_id, channel_id),
      FOREIGN KEY (set_id, context_index, taxon_index) REFERENCES scores(set_id, context_index, taxon_index),
      FOREIGN KEY (set_id, context_index, policy_id, channel_id) REFERENCES neighbor_contexts(set_id, context_index, policy_id, channel_id)
    ) WITHOUT ROWID;
  `);
}

function setMetadata(database, key, value) {
  database.prepare("INSERT INTO metadata(key, value) VALUES (?, ?)").run(
    key,
    canonicalJson(value)
  );
}

function normalizeDevelopmentPositiveCounts(value) {
  const entries = value instanceof Map ? [...value.entries()] : Object.entries(value || {});
  const normalized = new Map();
  for (const [taxonId, count] of entries) {
    normalized.set(
      String(taxonId),
      finiteInteger(count, `developmentPoolPositiveCounts.${taxonId}`, {
        minimum: 0
      })
    );
  }
  if (!normalized.size) {
    throw new NeighborPolicyOofCacheError(
      "NEIGHBOR_POLICY_OOF_CACHE_DEVELOPMENT_COUNTS_MISSING",
      "诊断缓存必须绑定 development-pool 正例计数。"
    );
  }
  return normalized;
}

function foldSetsFromFolds(folds) {
  const sortedOuter = [...(folds || [])].sort(
    (left, right) => Number(left.foldId) - Number(right.foldId)
  );
  if (
    sortedOuter.length !== 5 ||
    canonicalJson(sortedOuter.map((fold) => Number(fold.foldId))) !==
      canonicalJson([1, 2, 3, 4, 5])
  ) {
    throw new NeighborPolicyOofCacheError(
      "NEIGHBOR_POLICY_OOF_CACHE_FOLDS_INVALID",
      "诊断缓存必须包含完整 development 五个 outer 折。"
    );
  }
  const sets = [];
  let setId = 1;
  for (const outer of sortedOuter) {
    const outerFoldId = Number(outer.foldId);
    sets.push({
      setId: setId++,
      outerFoldId,
      innerFoldId: 0,
      trainingFoldIds: [1, 2, 3, 4, 5]
        .filter((foldId) => foldId !== outerFoldId)
        .map(String),
      evidenceConfiguration: outer.evidenceConfiguration,
      referenceRawMetrics: outer.referenceRawMetrics,
      scoreRows: outer.scoreRows
    });
    const innerFolds = [...(outer.innerFolds || [])].sort(
      (left, right) => Number(left.innerFoldId) - Number(right.innerFoldId)
    );
    const expectedInner = [1, 2, 3, 4, 5].filter(
      (foldId) => foldId !== outerFoldId
    );
    if (
      canonicalJson(innerFolds.map((fold) => Number(fold.innerFoldId))) !==
      canonicalJson(expectedInner)
    ) {
      throw new NeighborPolicyOofCacheError(
        "NEIGHBOR_POLICY_OOF_CACHE_INNER_FOLDS_INVALID",
        `outer ${outerFoldId} 缺少完整四个 inner 折。`
      );
    }
    for (const inner of innerFolds) {
      sets.push({
        setId: setId++,
        outerFoldId,
        innerFoldId: Number(inner.innerFoldId),
        trainingFoldIds: [...inner.trainingFoldIds].map(String).sort(),
        evidenceConfiguration: inner.evidenceConfiguration,
        referenceRawMetrics: inner.referenceRawMetrics,
        scoreRows: inner.scoreRows
      });
    }
  }
  return sets;
}

function foldSetIdentity({ outerFoldId, innerFoldId = 0 }) {
  const outer = finiteInteger(outerFoldId, "foldSet.outerFoldId", {
    minimum: 1,
    maximum: 5
  });
  const inner = innerFoldId == null
    ? 0
    : finiteInteger(innerFoldId, "foldSet.innerFoldId", {
        minimum: 0,
        maximum: 5
      });
  if (inner === outer) {
    throw new NeighborPolicyOofCacheError(
      "NEIGHBOR_POLICY_OOF_CACHE_FOLD_INVALID",
      "inner fold 不能与 outer fold 相同。",
      { outerFoldId: outer, innerFoldId: inner }
    );
  }
  const innerIds = [1, 2, 3, 4, 5].filter((foldId) => foldId !== outer);
  const innerIndex = inner === 0 ? -1 : innerIds.indexOf(inner);
  if (inner !== 0 && innerIndex < 0) {
    throw new NeighborPolicyOofCacheError(
      "NEIGHBOR_POLICY_OOF_CACHE_FOLD_INVALID",
      "inner fold 不属于冻结的五折集合。",
      { outerFoldId: outer, innerFoldId: inner }
    );
  }
  const setId = inner === 0
    ? (outer - 1) * 5 + 1
    : (outer - 1) * 5 + 2 + innerIndex;
  const expectedTrainingFoldIds = [1, 2, 3, 4, 5]
    .filter((foldId) => foldId !== outer && foldId !== inner)
    .map(String);
  return {
    outerFoldId: outer,
    innerFoldId: inner,
    setId,
    key: `${outer}:${inner}`,
    expectedTrainingFoldIds
  };
}

function expectedFoldSetKeys() {
  const keys = [];
  for (let outerFoldId = 1; outerFoldId <= 5; outerFoldId += 1) {
    keys.push(`${outerFoldId}:0`);
    for (let innerFoldId = 1; innerFoldId <= 5; innerFoldId += 1) {
      if (innerFoldId !== outerFoldId) {
        keys.push(`${outerFoldId}:${innerFoldId}`);
      }
    }
  }
  return keys.sort();
}

function cleanupTemporaryDatabase(path) {
  for (const candidate of [path, `${path}-wal`, `${path}-shm`]) {
    safeUnlink(candidate);
  }
}

function canonicalSha256(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function normalizeStaticMetadata(value, path) {
  assertPrivacySafe(value, path);
  return JSON.parse(canonicalJson(value));
}

function writeNeighborPolicyOofCacheLegacy({
  cachePath,
  folds,
  verifiedSpatialSplit,
  sourceSnapshotSha256,
  generationImplementationSha256,
  predictionImplementationSha256,
  baseAdminExposureCapsByPrevalence,
  qualityThresholds,
  generationOptions,
  developmentPoolPositiveCounts,
  expectedLayout = null
}) {
  if (verifiedSpatialSplit?.panelName !== NEIGHBOR_POLICY_OOF_CACHE_PANEL) {
    throw new NeighborPolicyOofCacheError(
      "NEIGHBOR_POLICY_OOF_CACHE_DEVELOPMENT_ONLY",
      "邻居策略缓存只能写入 development 面板。"
    );
  }
  const snapshotSha256 = normalizeSha256(
    sourceSnapshotSha256,
    "sourceSnapshotSha256"
  );
  if (
    snapshotSha256 !==
    String(verifiedSpatialSplit.manifest?.sourceSnapshotSha256 || "").toLowerCase()
  ) {
    throw new NeighborPolicyOofCacheError(
      "NEIGHBOR_POLICY_OOF_CACHE_SNAPSHOT_MISMATCH",
      "快照与冻结 split 不一致。"
    );
  }
  const currentGenerationSha256 =
    neighborPolicyOofCacheGenerationImplementationSha256();
  if (generationImplementationSha256 !== currentGenerationSha256) {
    throw new NeighborPolicyOofCacheError(
      "NEIGHBOR_POLICY_OOF_CACHE_GENERATOR_MISMATCH",
      "邻居策略缓存生成器哈希不匹配。",
      {
        expected: currentGenerationSha256,
        actual: generationImplementationSha256 || null
      }
    );
  }
  const absolutePath = resolve(cachePath);
  const sidecarPath = `${absolutePath}.sha256`;
  if (existsSync(absolutePath) || existsSync(sidecarPath)) {
    throw new NeighborPolicyOofCacheError(
      "NEIGHBOR_POLICY_OOF_CACHE_OUTPUT_EXISTS",
      "邻居策略缓存或 SHA sidecar 已存在。",
      { cachePath: absolutePath }
    );
  }
  const sets = foldSetsFromFolds(folds);
  const developmentCounts = normalizeDevelopmentPositiveCounts(
    developmentPoolPositiveCounts
  );
  const normalizedBaseCaps = normalizeStaticMetadata(
    baseAdminExposureCapsByPrevalence,
    "baseAdminExposureCapsByPrevalence"
  );
  const normalizedQuality = normalizeStaticMetadata(
    qualityThresholds,
    "qualityThresholds"
  );
  const normalizedGenerationOptions = normalizeStaticMetadata(
    generationOptions,
    "generationOptions"
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
    database.exec(
      "PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF; PRAGMA temp_store = MEMORY; PRAGMA secure_delete = ON;"
    );
    createCacheSchema(database);
    const insertSet = database.prepare(`
      INSERT INTO fold_sets
        (set_id, outer_fold_id, inner_fold_id, training_fold_ids_json,
         context_count, taxon_count, score_count, evidence_configuration_json,
         reference_raw_metrics_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertContext = database.prepare(`
      INSERT INTO contexts
        (set_id, context_index, total, province_exposure, city_exposure,
         district_exposure, has_supported_local_unit, deepest_level)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertTaxon = database.prepare(`
      INSERT INTO taxa
        (set_id, taxon_index, taxon_id, positive_count, outer_positive_count,
         development_positive_count, city_strength, district_strength)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertScore = database.prepare(`
      INSERT INTO scores
        (set_id, context_index, taxon_index, actual_positive,
         province_detections, city_detections, district_detections,
         reference_raw_probability, reference_baseline_probability)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertNeighborContext = database.prepare(`
      INSERT INTO neighbor_contexts
        (set_id, context_index, policy_id, channel_id, application_order,
         exposure, neighbor_count, weight_sum, evidence_exposure_cap,
         evidence_prior_strength)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertNeighborDetection = database.prepare(`
      INSERT INTO neighbor_detections
        (set_id, context_index, taxon_index, policy_id, channel_id, detections)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const outerPositiveCounts = new Map();
    let outerRowCount = 0;
    let innerRowCount = 0;
    let evidenceRowCount = 0;
    database.exec("BEGIN IMMEDIATE");
    for (const set of sets) {
      if (!Array.isArray(set.scoreRows) || !set.scoreRows.length) {
        throw new NeighborPolicyOofCacheError(
          "NEIGHBOR_POLICY_OOF_CACHE_FOLD_EMPTY",
          `fold set ${set.outerFoldId}:${set.innerFoldId} 没有评分行。`
        );
      }
      const rows = set.scoreRows.map((row, index) =>
        normalizeScoreRow(
          row,
          `folds[${set.outerFoldId}:${set.innerFoldId}].scoreRows[${index}]`
        )
      ).sort(
        (left, right) =>
          left.contextIndex - right.contextIndex ||
          left.taxonId.localeCompare(right.taxonId)
      );
      const contexts = new Map();
      const taxa = new Map();
      for (const row of rows) {
        const context = {
          total: row.total,
          provinceExposure: row.adminEvidence.province.exposure,
          cityExposure: row.adminEvidence.city.exposure,
          districtExposure: row.adminEvidence.district.exposure,
          hasSupportedLocalUnit: row.hasSupportedLocalUnit,
          deepestLevel: row.deepestLevel,
          neighborPolicyEvidence: row.neighborPolicyEvidence.map((policy) => ({
            policyId: policy.policyId,
            channels: policy.channels.map((channel) => ({
              ...channel,
              detections: undefined
            }))
          }))
        };
        const priorContext = contexts.get(row.contextIndex);
        if (
          priorContext &&
          canonicalJson(priorContext) !== canonicalJson(context)
        ) {
          throw new NeighborPolicyOofCacheError(
            "NEIGHBOR_POLICY_OOF_CACHE_CONTEXT_INCONSISTENT",
            `匿名 context ${row.contextIndex} 的 taxon-independent 证据不一致。`
          );
        }
        contexts.set(row.contextIndex, context);
        const taxon = {
          positiveCount: row.positiveCount,
          cityStrength: row.adminEvidence.city.strength,
          districtStrength: row.adminEvidence.district.strength
        };
        const priorTaxon = taxa.get(row.taxonId);
        if (
          priorTaxon &&
          canonicalJson(priorTaxon) !== canonicalJson(taxon)
        ) {
          throw new NeighborPolicyOofCacheError(
            "NEIGHBOR_POLICY_OOF_CACHE_TAXON_INCONSISTENT",
            `taxon ${row.taxonId} 的 fold 证据不一致。`
          );
        }
        taxa.set(row.taxonId, taxon);
      }
      const taxonIds = [...taxa.keys()].sort();
      const taxonIndexes = new Map(
        taxonIds.map((taxonId, index) => [taxonId, index])
      );
      insertSet.run(
        set.setId,
        set.outerFoldId,
        set.innerFoldId,
        canonicalJson(set.trainingFoldIds),
        contexts.size,
        taxa.size,
        rows.length,
        canonicalJson(set.evidenceConfiguration || {}),
        set.referenceRawMetrics == null
          ? null
          : canonicalJson(set.referenceRawMetrics)
      );
      for (const [contextIndex, context] of [...contexts.entries()].sort(
        (left, right) => left[0] - right[0]
      )) {
        insertContext.run(
          set.setId,
          contextIndex,
          context.total,
          context.provinceExposure,
          context.cityExposure,
          context.districtExposure,
          context.hasSupportedLocalUnit ? 1 : 0,
          context.deepestLevel
        );
        for (const policy of context.neighborPolicyEvidence) {
          for (const channel of policy.channels) {
            insertNeighborContext.run(
              set.setId,
              contextIndex,
              policy.policyId,
              channel.channelId,
              channel.applicationOrder,
              channel.exposure,
              channel.neighborCount,
              channel.weightSum,
              channel.evidenceExposureCap,
              channel.evidencePriorStrength
            );
          }
        }
      }
      for (const taxonId of taxonIds) {
        const taxon = taxa.get(taxonId);
        const developmentPositiveCount = developmentCounts.get(taxonId);
        if (developmentPositiveCount === undefined) {
          throw new NeighborPolicyOofCacheError(
            "NEIGHBOR_POLICY_OOF_CACHE_DEVELOPMENT_COUNTS_MISSING",
            `development-pool 缺少 taxon ${taxonId}。`
          );
        }
        const outerKey = `${set.outerFoldId}\0${taxonId}`;
        const outerPositiveCount =
          set.innerFoldId === 0
            ? taxon.positiveCount
            : outerPositiveCounts.get(outerKey);
        if (
          outerPositiveCount === undefined ||
          outerPositiveCount < taxon.positiveCount ||
          developmentPositiveCount < outerPositiveCount
        ) {
          throw new NeighborPolicyOofCacheError(
            "NEIGHBOR_POLICY_OOF_CACHE_POSITIVE_COUNTS_INVALID",
            `taxon ${taxonId} 的 inner/outer/development 正例计数不单调。`
          );
        }
        if (set.innerFoldId === 0) {
          outerPositiveCounts.set(outerKey, outerPositiveCount);
        }
        insertTaxon.run(
          set.setId,
          taxonIndexes.get(taxonId),
          taxonId,
          taxon.positiveCount,
          outerPositiveCount,
          developmentPositiveCount,
          taxon.cityStrength,
          taxon.districtStrength
        );
      }
      for (const row of rows) {
        const taxonIndex = taxonIndexes.get(row.taxonId);
        insertScore.run(
          set.setId,
          row.contextIndex,
          taxonIndex,
          row.actualPositive,
          row.adminEvidence.province.detections,
          row.adminEvidence.city.detections,
          row.adminEvidence.district.detections,
          row.rawProbability,
          row.baselineProbability
        );
        for (const policy of row.neighborPolicyEvidence) {
          for (const channel of policy.channels) {
            insertNeighborDetection.run(
              set.setId,
              row.contextIndex,
              taxonIndex,
              policy.policyId,
              channel.channelId,
              channel.detections
            );
            evidenceRowCount += 1;
          }
        }
      }
      if (set.innerFoldId === 0) outerRowCount += rows.length;
      else innerRowCount += rows.length;
    }
    database.exec("COMMIT");
    if (expectedLayout) {
      const actualLayout = {
        outerFoldCount: 5,
        innerFoldCount: 20,
        outerScoreRows: outerRowCount,
        innerScoreRows: innerRowCount,
        totalScoreRows: outerRowCount + innerRowCount,
        neighborChannelsPerScoreRow:
          evidenceRowCount / (outerRowCount + innerRowCount),
        neighborDetectionRows: evidenceRowCount
      };
      if (
        canonicalJson(actualLayout) !== canonicalJson(expectedLayout)
      ) {
        throw new NeighborPolicyOofCacheError(
          "NEIGHBOR_POLICY_OOF_CACHE_LAYOUT_MISMATCH",
          "Neighbor-policy cache row counts do not match the frozen layout.",
          { expectedLayout, actualLayout }
        );
      }
    }
    const metadata = {
      schemaVersion: NEIGHBOR_POLICY_OOF_CACHE_SCHEMA_VERSION,
      cacheKind: NEIGHBOR_POLICY_OOF_CACHE_KIND,
      panel: NEIGHBOR_POLICY_OOF_CACHE_PANEL,
      diagnosticOnly: true,
      sourceSnapshotSha256: snapshotSha256,
      spatialSplitFileSha256: normalizeSha256(
        verifiedSpatialSplit.fileSha256,
        "verifiedSpatialSplit.fileSha256"
      ),
      spatialSplitManifestHash: normalizeSha256(
        verifiedSpatialSplit.manifestHash,
        "verifiedSpatialSplit.manifestHash"
      ),
      contractSha256: neighborPolicyDiagnosticContractSha256(),
      generationImplementationSha256,
      predictionImplementationSha256: normalizeSha256(
        predictionImplementationSha256,
        "predictionImplementationSha256"
      ),
      baseAdminExposureCapsByPrevalence: normalizedBaseCaps,
      qualityThresholds: normalizedQuality,
      generationOptions: normalizedGenerationOptions,
      developmentPoolPositiveCountPolicy:
        DEVELOPMENT_POOL_POSITIVE_COUNT_POLICY,
      foldCount: 5,
      innerFoldCount: 20,
      outerRowCount,
      innerRowCount,
      evidenceRowCount,
      privacyContract: PRIVACY_CONTRACT
    };
    for (const key of CACHE_METADATA_KEYS) setMetadata(database, key, metadata[key]);
    database.exec("VACUUM");
    const quickCheck = database.prepare("PRAGMA quick_check").get().quick_check;
    const foreignKeyFailures = database
      .prepare("PRAGMA foreign_key_check")
      .all();
    const freePages =
      Number(database.prepare("PRAGMA freelist_count").get().freelist_count) ||
      0;
    if (
      quickCheck !== "ok" ||
      foreignKeyFailures.length !== 0 ||
      freePages !== 0
    ) {
      throw new NeighborPolicyOofCacheError(
        "NEIGHBOR_POLICY_OOF_CACHE_INTEGRITY_FAILED",
        "邻居策略缓存完整性校验失败。",
        { quickCheck, foreignKeyFailures, freePages }
      );
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
      sidecarPath,
      fileSha256,
      schemaVersion: NEIGHBOR_POLICY_OOF_CACHE_SCHEMA_VERSION,
      cacheKind: NEIGHBOR_POLICY_OOF_CACHE_KIND,
      panel: NEIGHBOR_POLICY_OOF_CACHE_PANEL,
      foldCount: 5,
      innerFoldCount: 20,
      outerRowCount,
      innerRowCount,
      evidenceRowCount,
      bytes: statSync(absolutePath).size,
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

function createNeighborPolicyOofCacheWriter({
  cachePath,
  verifiedSpatialSplit,
  sourceSnapshotSha256,
  generationImplementationSha256,
  predictionImplementationSha256,
  baseAdminExposureCapsByPrevalence,
  qualityThresholds,
  generationOptions,
  developmentPoolPositiveCounts,
  expectedLayout = null,
  onFoldSetCommitted = null
}) {
  if (verifiedSpatialSplit?.panelName !== NEIGHBOR_POLICY_OOF_CACHE_PANEL) {
    throw new NeighborPolicyOofCacheError(
      "NEIGHBOR_POLICY_OOF_CACHE_DEVELOPMENT_ONLY",
      "邻居策略缓存只能写入 development 面板。"
    );
  }
  const snapshotSha256 = normalizeSha256(
    sourceSnapshotSha256,
    "sourceSnapshotSha256"
  );
  if (
    snapshotSha256 !==
    String(
      verifiedSpatialSplit.manifest?.sourceSnapshotSha256 || ""
    ).toLowerCase()
  ) {
    throw new NeighborPolicyOofCacheError(
      "NEIGHBOR_POLICY_OOF_CACHE_SNAPSHOT_MISMATCH",
      "快照与冻结 split 不一致。"
    );
  }
  const currentGenerationSha256 =
    neighborPolicyOofCacheGenerationImplementationSha256();
  if (generationImplementationSha256 !== currentGenerationSha256) {
    throw new NeighborPolicyOofCacheError(
      "NEIGHBOR_POLICY_OOF_CACHE_GENERATOR_MISMATCH",
      "邻居策略缓存生成器哈希不匹配。",
      {
        expected: currentGenerationSha256,
        actual: generationImplementationSha256 || null
      }
    );
  }
  const absolutePath = resolve(cachePath);
  const sidecarPath = `${absolutePath}.sha256`;
  if (existsSync(absolutePath) || existsSync(sidecarPath)) {
    throw new NeighborPolicyOofCacheError(
      "NEIGHBOR_POLICY_OOF_CACHE_OUTPUT_EXISTS",
      "邻居策略缓存或 SHA sidecar 已存在。",
      { cachePath: absolutePath }
    );
  }
  const developmentCounts = normalizeDevelopmentPositiveCounts(
    developmentPoolPositiveCounts
  );
  const normalizedBaseCaps = normalizeStaticMetadata(
    baseAdminExposureCapsByPrevalence,
    "baseAdminExposureCapsByPrevalence"
  );
  const normalizedQuality = normalizeStaticMetadata(
    qualityThresholds,
    "qualityThresholds"
  );
  const normalizedGenerationOptions = normalizeStaticMetadata(
    generationOptions,
    "generationOptions"
  );
  mkdirSync(dirname(absolutePath), { recursive: true });
  const temporaryPath = `${absolutePath}.building-stream-v1`;
  const checkpointPath = `${temporaryPath}.checkpoint.json`;
  const temporarySidecar = `${sidecarPath}.building-stream-v1`;
  const checkpointIdentity = {
    schemaVersion: 1,
    kind: "zhejiang_neighbor_policy_oof_stream_checkpoint_v1",
    sourceSnapshotSha256: snapshotSha256,
    spatialSplitFileSha256: normalizeSha256(
      verifiedSpatialSplit.fileSha256,
      "verifiedSpatialSplit.fileSha256"
    ),
    spatialSplitManifestHash: normalizeSha256(
      verifiedSpatialSplit.manifestHash,
      "verifiedSpatialSplit.manifestHash"
    ),
    contractSha256: neighborPolicyDiagnosticContractSha256(),
    generationImplementationSha256,
    predictionImplementationSha256: normalizeSha256(
      predictionImplementationSha256,
      "predictionImplementationSha256"
    ),
    baseAdminExposureCapsByPrevalence: normalizedBaseCaps,
    qualityThresholds: normalizedQuality,
    generationOptions: normalizedGenerationOptions,
    expectedLayout,
    developmentPositiveCountsSha256: canonicalSha256(
      Object.fromEntries([...developmentCounts.entries()].sort())
    )
  };
  const resumeExisting = existsSync(temporaryPath);
  if (resumeExisting !== existsSync(checkpointPath)) {
    throw new NeighborPolicyOofCacheError(
      "NEIGHBOR_POLICY_OOF_CACHE_CHECKPOINT_INCOMPLETE",
      "流式缓存数据库与 checkpoint sidecar 不完整。",
      { temporaryPath, checkpointPath }
    );
  }
  if (resumeExisting) {
    let priorIdentity;
    try {
      priorIdentity = JSON.parse(readFileSync(checkpointPath, "utf8"));
    } catch {
      throw new NeighborPolicyOofCacheError(
        "NEIGHBOR_POLICY_OOF_CACHE_CHECKPOINT_INVALID",
        "流式缓存 checkpoint 无法解析。",
        { checkpointPath }
      );
    }
    if (canonicalJson(priorIdentity) !== canonicalJson(checkpointIdentity)) {
      throw new NeighborPolicyOofCacheError(
        "NEIGHBOR_POLICY_OOF_CACHE_CHECKPOINT_MISMATCH",
        "流式缓存 checkpoint 与当前冻结输入或实现不一致。",
        { checkpointPath }
      );
    }
  } else {
    cleanupTemporaryDatabase(temporaryPath);
    writeFileSync(
      checkpointPath,
      `${canonicalJson(checkpointIdentity)}\n`,
      "utf8"
    );
  }
  safeUnlink(temporarySidecar);

  let database = null;
  let publishedCache = false;
  let publishedSidecar = false;
  let terminalState = null;
  const committedSets = new Set();
  const committedSetSummaries = new Map();
  const outerPositiveCounts = new Map();
  let outerRowCount = 0;
  let innerRowCount = 0;
  let evidenceRowCount = 0;

  const ensureOpen = () => {
    if (!database || terminalState) {
      throw new NeighborPolicyOofCacheError(
        "NEIGHBOR_POLICY_OOF_CACHE_WRITER_CLOSED",
        "邻居策略缓存 writer 已关闭。",
        { terminalState }
      );
    }
  };

  const abort = ({ preserveCheckpoint = false } = {}) => {
    if (terminalState === "aborted" || terminalState === "paused") return;
    if (database) {
      try {
        database.close();
      } catch {
        // already closed
      }
      database = null;
    }
    safeUnlink(temporarySidecar);
    if (preserveCheckpoint && !publishedCache && !publishedSidecar) {
      terminalState = "paused";
      return;
    }
    cleanupTemporaryDatabase(temporaryPath);
    safeUnlink(checkpointPath);
    if (publishedSidecar) safeUnlink(sidecarPath);
    if (publishedCache) safeUnlink(absolutePath);
    terminalState = "aborted";
  };

  try {
    database = new DatabaseSync(temporaryPath);
    database.exec(
      "PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA temp_store = FILE; PRAGMA secure_delete = ON;"
    );
    if (resumeExisting) {
      validateSchema(database);
      const quickCheck = database.prepare("PRAGMA quick_check").get().quick_check;
      const foreignKeyFailures = database
        .prepare("PRAGMA foreign_key_check")
        .all();
      if (quickCheck !== "ok" || foreignKeyFailures.length !== 0) {
        throw new NeighborPolicyOofCacheError(
          "NEIGHBOR_POLICY_OOF_CACHE_CHECKPOINT_INVALID",
          "流式缓存 checkpoint 数据库完整性校验失败。",
          { quickCheck, foreignKeyFailures }
        );
      }
      database.exec("DELETE FROM metadata");
      for (const row of database.prepare(`
        SELECT set_id, outer_fold_id, inner_fold_id,
               training_fold_ids_json, score_count,
               evidence_configuration_json, reference_raw_metrics_json
        FROM fold_sets
        ORDER BY set_id
      `).all()) {
        const identity = foldSetIdentity({
          outerFoldId: row.outer_fold_id,
          innerFoldId: row.inner_fold_id
        });
        if (Number(row.set_id) !== identity.setId) {
          throw new NeighborPolicyOofCacheError(
            "NEIGHBOR_POLICY_OOF_CACHE_CHECKPOINT_INVALID",
            "流式缓存 checkpoint 的 set_id 排序不正确。"
          );
        }
        const summary = {
          setId: identity.setId,
          outerFoldId: String(identity.outerFoldId),
          innerFoldId:
            identity.innerFoldId === 0
              ? null
              : String(identity.innerFoldId),
          trainingFoldIds: JSON.parse(row.training_fold_ids_json).map(String),
          evidenceConfiguration: JSON.parse(
            row.evidence_configuration_json
          ),
          referenceRawMetrics:
            row.reference_raw_metrics_json == null
              ? null
              : JSON.parse(row.reference_raw_metrics_json),
          scoreCount: Number(row.score_count)
        };
        committedSets.add(identity.key);
        committedSetSummaries.set(identity.key, summary);
      }
      const rowCounts = database.prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN inner_fold_id = 0 THEN score_count ELSE 0 END), 0) AS outer_rows,
          COALESCE(SUM(CASE WHEN inner_fold_id <> 0 THEN score_count ELSE 0 END), 0) AS inner_rows
        FROM fold_sets
      `).get();
      outerRowCount = Number(rowCounts.outer_rows) || 0;
      innerRowCount = Number(rowCounts.inner_rows) || 0;
      evidenceRowCount = Number(
        database.prepare(
          "SELECT COUNT(*) AS count FROM neighbor_detections"
        ).get().count
      ) || 0;
      for (const row of database.prepare(`
        SELECT folds.outer_fold_id, taxa.taxon_id, taxa.positive_count
        FROM taxa
        JOIN fold_sets folds USING (set_id)
        WHERE folds.inner_fold_id = 0
        ORDER BY folds.outer_fold_id, taxa.taxon_id
      `).all()) {
        outerPositiveCounts.set(
          `${row.outer_fold_id}\0${row.taxon_id}`,
          Number(row.positive_count)
        );
      }
    } else {
      createCacheSchema(database);
    }
    const insertSet = database.prepare(`
      INSERT INTO fold_sets
        (set_id, outer_fold_id, inner_fold_id, training_fold_ids_json,
         context_count, taxon_count, score_count, evidence_configuration_json,
         reference_raw_metrics_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertContext = database.prepare(`
      INSERT INTO contexts
        (set_id, context_index, total, province_exposure, city_exposure,
         district_exposure, has_supported_local_unit, deepest_level)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertTaxon = database.prepare(`
      INSERT INTO taxa
        (set_id, taxon_index, taxon_id, positive_count, outer_positive_count,
         development_positive_count, city_strength, district_strength)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertScore = database.prepare(`
      INSERT INTO scores
        (set_id, context_index, taxon_index, actual_positive,
         province_detections, city_detections, district_detections,
         reference_raw_probability, reference_baseline_probability)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertNeighborContext = database.prepare(`
      INSERT INTO neighbor_contexts
        (set_id, context_index, policy_id, channel_id, application_order,
         exposure, neighbor_count, weight_sum, evidence_exposure_cap,
         evidence_prior_strength)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertNeighborDetection = database.prepare(`
      INSERT INTO neighbor_detections
        (set_id, context_index, taxon_index, policy_id, channel_id, detections)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const appendFoldSet = (set) => {
      ensureOpen();
      const identity = foldSetIdentity(set);
      if (set.setId != null && Number(set.setId) !== identity.setId) {
        throw new NeighborPolicyOofCacheError(
          "NEIGHBOR_POLICY_OOF_CACHE_SET_ID_INVALID",
          "fold set_id 与冻结排序不一致。",
          { expected: identity.setId, actual: set.setId }
        );
      }
      if (committedSets.has(identity.key)) {
        throw new NeighborPolicyOofCacheError(
          "NEIGHBOR_POLICY_OOF_CACHE_FOLD_DUPLICATE",
          `fold set ${identity.key} 已写入。`
        );
      }
      const trainingFoldIds = [...(set.trainingFoldIds || [])]
        .map(String)
        .sort();
      if (
        canonicalJson(trainingFoldIds) !==
        canonicalJson(identity.expectedTrainingFoldIds)
      ) {
        throw new NeighborPolicyOofCacheError(
          "NEIGHBOR_POLICY_OOF_CACHE_TRAINING_FOLDS_INVALID",
          `fold set ${identity.key} 的训练折集合不正确。`,
          {
            expected: identity.expectedTrainingFoldIds,
            actual: trainingFoldIds
          }
        );
      }
      if (!Array.isArray(set.scoreRows) || !set.scoreRows.length) {
        throw new NeighborPolicyOofCacheError(
          "NEIGHBOR_POLICY_OOF_CACHE_FOLD_EMPTY",
          `fold set ${identity.key} 没有评分行。`
        );
      }
      const evidenceConfiguration = normalizeStaticMetadata(
        set.evidenceConfiguration || {},
        `folds[${identity.key}].evidenceConfiguration`
      );
      const referenceRawMetrics = set.referenceRawMetrics == null
        ? null
        : normalizeStaticMetadata(
            set.referenceRawMetrics,
            `folds[${identity.key}].referenceRawMetrics`
          );
      const rows = set.scoreRows.map((row, index) =>
        normalizeScoreRow(
          row,
          `folds[${identity.key}].scoreRows[${index}]`
        )
      ).sort(
        (left, right) =>
          left.contextIndex - right.contextIndex ||
          left.taxonId.localeCompare(right.taxonId)
      );
      const contexts = new Map();
      const taxa = new Map();
      for (const row of rows) {
        const context = {
          total: row.total,
          provinceExposure: row.adminEvidence.province.exposure,
          cityExposure: row.adminEvidence.city.exposure,
          districtExposure: row.adminEvidence.district.exposure,
          hasSupportedLocalUnit: row.hasSupportedLocalUnit,
          deepestLevel: row.deepestLevel,
          neighborPolicyEvidence: row.neighborPolicyEvidence.map(
            (policy) => ({
              policyId: policy.policyId,
              channels: policy.channels.map((channel) => ({
                ...channel,
                detections: undefined
              }))
            })
          )
        };
        const priorContext = contexts.get(row.contextIndex);
        if (
          priorContext &&
          canonicalJson(priorContext) !== canonicalJson(context)
        ) {
          throw new NeighborPolicyOofCacheError(
            "NEIGHBOR_POLICY_OOF_CACHE_CONTEXT_INCONSISTENT",
            `匿名 context ${row.contextIndex} 的 taxon-independent 证据不一致。`
          );
        }
        contexts.set(row.contextIndex, context);
        const taxon = {
          positiveCount: row.positiveCount,
          cityStrength: row.adminEvidence.city.strength,
          districtStrength: row.adminEvidence.district.strength
        };
        const priorTaxon = taxa.get(row.taxonId);
        if (
          priorTaxon &&
          canonicalJson(priorTaxon) !== canonicalJson(taxon)
        ) {
          throw new NeighborPolicyOofCacheError(
            "NEIGHBOR_POLICY_OOF_CACHE_TAXON_INCONSISTENT",
            `taxon ${row.taxonId} 的 fold 证据不一致。`
          );
        }
        taxa.set(row.taxonId, taxon);
      }
      const taxonIds = [...taxa.keys()].sort();
      const taxonIndexes = new Map(
        taxonIds.map((taxonId, index) => [taxonId, index])
      );
      let setEvidenceRowCount = 0;
      database.exec("BEGIN IMMEDIATE");
      try {
        insertSet.run(
          identity.setId,
          identity.outerFoldId,
          identity.innerFoldId,
          canonicalJson(trainingFoldIds),
          contexts.size,
          taxa.size,
          rows.length,
          canonicalJson(evidenceConfiguration),
          referenceRawMetrics == null
            ? null
            : canonicalJson(referenceRawMetrics)
        );
        for (const [contextIndex, context] of [...contexts.entries()].sort(
          (left, right) => left[0] - right[0]
        )) {
          insertContext.run(
            identity.setId,
            contextIndex,
            context.total,
            context.provinceExposure,
            context.cityExposure,
            context.districtExposure,
            context.hasSupportedLocalUnit ? 1 : 0,
            context.deepestLevel
          );
          for (const policy of context.neighborPolicyEvidence) {
            for (const channel of policy.channels) {
              insertNeighborContext.run(
                identity.setId,
                contextIndex,
                policy.policyId,
                channel.channelId,
                channel.applicationOrder,
                channel.exposure,
                channel.neighborCount,
                channel.weightSum,
                channel.evidenceExposureCap,
                channel.evidencePriorStrength
              );
            }
          }
        }
        for (const taxonId of taxonIds) {
          const taxon = taxa.get(taxonId);
          const developmentPositiveCount = developmentCounts.get(taxonId);
          if (developmentPositiveCount === undefined) {
            throw new NeighborPolicyOofCacheError(
              "NEIGHBOR_POLICY_OOF_CACHE_DEVELOPMENT_COUNTS_MISSING",
              `development-pool 缺少 taxon ${taxonId}。`
            );
          }
          const outerKey = `${identity.outerFoldId}\0${taxonId}`;
          const outerPositiveCount = identity.innerFoldId === 0
            ? taxon.positiveCount
            : outerPositiveCounts.get(outerKey);
          if (
            outerPositiveCount === undefined ||
            outerPositiveCount < taxon.positiveCount ||
            developmentPositiveCount < outerPositiveCount
          ) {
            throw new NeighborPolicyOofCacheError(
              "NEIGHBOR_POLICY_OOF_CACHE_POSITIVE_COUNTS_INVALID",
              `taxon ${taxonId} 的 inner/outer/development 正例计数不单调。`
            );
          }
          insertTaxon.run(
            identity.setId,
            taxonIndexes.get(taxonId),
            taxonId,
            taxon.positiveCount,
            outerPositiveCount,
            developmentPositiveCount,
            taxon.cityStrength,
            taxon.districtStrength
          );
        }
        for (const row of rows) {
          const taxonIndex = taxonIndexes.get(row.taxonId);
          insertScore.run(
            identity.setId,
            row.contextIndex,
            taxonIndex,
            row.actualPositive,
            row.adminEvidence.province.detections,
            row.adminEvidence.city.detections,
            row.adminEvidence.district.detections,
            row.rawProbability,
            row.baselineProbability
          );
          for (const policy of row.neighborPolicyEvidence) {
            for (const channel of policy.channels) {
              insertNeighborDetection.run(
                identity.setId,
                row.contextIndex,
                taxonIndex,
                policy.policyId,
                channel.channelId,
                channel.detections
              );
              setEvidenceRowCount += 1;
            }
          }
        }
        database.exec("COMMIT");
      } catch (error) {
        try {
          database.exec("ROLLBACK");
        } catch {
          // transaction already closed
        }
        throw error;
      }
      if (identity.innerFoldId === 0) {
        for (const taxonId of taxonIds) {
          outerPositiveCounts.set(
            `${identity.outerFoldId}\0${taxonId}`,
            taxa.get(taxonId).positiveCount
          );
        }
        outerRowCount += rows.length;
      } else {
        innerRowCount += rows.length;
      }
      evidenceRowCount += setEvidenceRowCount;
      committedSets.add(identity.key);
      const result = {
        setId: identity.setId,
        outerFoldId: String(identity.outerFoldId),
        innerFoldId:
          identity.innerFoldId === 0
            ? null
            : String(identity.innerFoldId),
        scoreCount: rows.length,
        evidenceRowCount: setEvidenceRowCount,
        committedSetCount: committedSets.size
      };
      committedSetSummaries.set(identity.key, {
        ...result,
        trainingFoldIds,
        evidenceConfiguration,
        referenceRawMetrics
      });
      if (typeof onFoldSetCommitted === "function") {
        onFoldSetCommitted(result);
      }
      return result;
    };

    const finalize = () => {
      ensureOpen();
      const actualSetKeys = [...committedSets].sort();
      if (
        canonicalJson(actualSetKeys) !==
        canonicalJson(expectedFoldSetKeys())
      ) {
        throw new NeighborPolicyOofCacheError(
          "NEIGHBOR_POLICY_OOF_CACHE_FOLDS_INVALID",
          "流式缓存必须提交完整的 5 个 outer fold 与 20 个 inner fold。",
          { expected: expectedFoldSetKeys(), actual: actualSetKeys }
        );
      }
      if (expectedLayout) {
        const actualLayout = {
          outerFoldCount: 5,
          innerFoldCount: 20,
          outerScoreRows: outerRowCount,
          innerScoreRows: innerRowCount,
          totalScoreRows: outerRowCount + innerRowCount,
          neighborChannelsPerScoreRow:
            evidenceRowCount / (outerRowCount + innerRowCount),
          neighborDetectionRows: evidenceRowCount
        };
        if (canonicalJson(actualLayout) !== canonicalJson(expectedLayout)) {
          throw new NeighborPolicyOofCacheError(
            "NEIGHBOR_POLICY_OOF_CACHE_LAYOUT_MISMATCH",
            "Neighbor-policy cache row counts do not match the frozen layout.",
            { expectedLayout, actualLayout }
          );
        }
      }
      const metadata = {
        schemaVersion: NEIGHBOR_POLICY_OOF_CACHE_SCHEMA_VERSION,
        cacheKind: NEIGHBOR_POLICY_OOF_CACHE_KIND,
        panel: NEIGHBOR_POLICY_OOF_CACHE_PANEL,
        diagnosticOnly: true,
        sourceSnapshotSha256: snapshotSha256,
        spatialSplitFileSha256: normalizeSha256(
          verifiedSpatialSplit.fileSha256,
          "verifiedSpatialSplit.fileSha256"
        ),
        spatialSplitManifestHash: normalizeSha256(
          verifiedSpatialSplit.manifestHash,
          "verifiedSpatialSplit.manifestHash"
        ),
        contractSha256: neighborPolicyDiagnosticContractSha256(),
        generationImplementationSha256,
        predictionImplementationSha256: normalizeSha256(
          predictionImplementationSha256,
          "predictionImplementationSha256"
        ),
        baseAdminExposureCapsByPrevalence: normalizedBaseCaps,
        qualityThresholds: normalizedQuality,
        generationOptions: normalizedGenerationOptions,
        developmentPoolPositiveCountPolicy:
          DEVELOPMENT_POOL_POSITIVE_COUNT_POLICY,
        foldCount: 5,
        innerFoldCount: 20,
        outerRowCount,
        innerRowCount,
        evidenceRowCount,
        privacyContract: PRIVACY_CONTRACT
      };
      database.exec("BEGIN IMMEDIATE");
      try {
        for (const key of CACHE_METADATA_KEYS) {
          setMetadata(database, key, metadata[key]);
        }
        database.exec("COMMIT");
      } catch (error) {
        try {
          database.exec("ROLLBACK");
        } catch {
          // transaction already closed
        }
        throw error;
      }
      database.exec("PRAGMA wal_checkpoint(TRUNCATE)");
      database.exec("PRAGMA journal_mode = DELETE");
      database.exec("VACUUM");
      const quickCheck = database.prepare("PRAGMA quick_check").get().quick_check;
      const foreignKeyFailures = database
        .prepare("PRAGMA foreign_key_check")
        .all();
      const freePages = Number(
        database.prepare("PRAGMA freelist_count").get().freelist_count
      ) || 0;
      if (
        quickCheck !== "ok" ||
        foreignKeyFailures.length !== 0 ||
        freePages !== 0
      ) {
        throw new NeighborPolicyOofCacheError(
          "NEIGHBOR_POLICY_OOF_CACHE_INTEGRITY_FAILED",
          "邻居策略缓存完整性校验失败。",
          { quickCheck, foreignKeyFailures, freePages }
        );
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
      safeUnlink(checkpointPath);
      terminalState = "finalized";
      return {
        path: absolutePath,
        sidecarPath,
        fileSha256,
        schemaVersion: NEIGHBOR_POLICY_OOF_CACHE_SCHEMA_VERSION,
        cacheKind: NEIGHBOR_POLICY_OOF_CACHE_KIND,
        panel: NEIGHBOR_POLICY_OOF_CACHE_PANEL,
        foldCount: 5,
        innerFoldCount: 20,
        outerRowCount,
        innerRowCount,
        evidenceRowCount,
        bytes: statSync(absolutePath).size,
        diagnosticOnly: true
      };
    };

    return {
      path: absolutePath,
      temporaryPath,
      checkpointPath,
      resumed: resumeExisting,
      appendFoldSet,
      finalize,
      abort,
      hasFoldSet(fold) {
        return committedSets.has(foldSetIdentity(fold).key);
      },
      foldSetSummary(fold) {
        const summary = committedSetSummaries.get(
          foldSetIdentity(fold).key
        );
        return summary == null
          ? null
          : JSON.parse(canonicalJson(summary));
      },
      stats() {
        return {
          terminalState,
          resumed: resumeExisting,
          committedSetCount: committedSets.size,
          outerRowCount,
          innerRowCount,
          evidenceRowCount
        };
      }
    };
  } catch (error) {
    abort();
    throw error;
  }
}

function writeNeighborPolicyOofCache(options) {
  const writer = createNeighborPolicyOofCacheWriter(options);
  try {
    for (const set of foldSetsFromFolds(options.folds)) {
      writer.appendFoldSet(set);
    }
    return writer.finalize();
  } catch (error) {
    writer.abort();
    throw error;
  }
}

function parseMetadata(database) {
  const rows = database
    .prepare("SELECT key, value FROM metadata ORDER BY key")
    .all();
  if (
    canonicalJson(rows.map((row) => row.key)) !==
    canonicalJson([...CACHE_METADATA_KEYS].sort())
  ) {
    throw new NeighborPolicyOofCacheError(
      "NEIGHBOR_POLICY_OOF_CACHE_METADATA_INVALID",
      "metadata 字段不匹配严格白名单。"
    );
  }
  return Object.fromEntries(
    rows.map((row) => {
      try {
        return [row.key, JSON.parse(row.value)];
      } catch {
        throw new NeighborPolicyOofCacheError(
          "NEIGHBOR_POLICY_OOF_CACHE_METADATA_INVALID",
          `metadata.${row.key} 不是合法 JSON。`
        );
      }
    })
  );
}

function validateSchema(database) {
  const tables = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    )
    .all()
    .map((row) => String(row.name));
  const expectedTables = Object.keys(CACHE_TABLE_COLUMNS).sort();
  if (canonicalJson(tables) !== canonicalJson(expectedTables)) {
    throw new NeighborPolicyOofCacheError(
      "NEIGHBOR_POLICY_OOF_CACHE_SCHEMA_INVALID",
      "缓存表不匹配严格白名单。",
      { expectedTables, tables }
    );
  }
  for (const [table, expectedColumns] of Object.entries(CACHE_TABLE_COLUMNS)) {
    const actualColumns = database
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .map((row) => String(row.name));
    if (canonicalJson(actualColumns) !== canonicalJson(expectedColumns)) {
      throw new NeighborPolicyOofCacheError(
        "NEIGHBOR_POLICY_OOF_CACHE_SCHEMA_INVALID",
        `${table} 列不匹配严格白名单。`,
        { expectedColumns, actualColumns }
      );
    }
  }
}

function validateMetadata(metadata, {
  verifiedSpatialSplit,
  sourceSnapshotSha256,
  generationImplementationSha256
}) {
  assertPrivacySafe(metadata.generationOptions, "metadata.generationOptions");
  const mismatches = [];
  if (metadata.schemaVersion !== NEIGHBOR_POLICY_OOF_CACHE_SCHEMA_VERSION) {
    mismatches.push("schemaVersion");
  }
  if (metadata.cacheKind !== NEIGHBOR_POLICY_OOF_CACHE_KIND) {
    mismatches.push("cacheKind");
  }
  if (metadata.panel !== NEIGHBOR_POLICY_OOF_CACHE_PANEL) mismatches.push("panel");
  if (metadata.diagnosticOnly !== true) mismatches.push("diagnosticOnly");
  if (
    metadata.sourceSnapshotSha256 !==
    String(sourceSnapshotSha256 || "").toLowerCase()
  ) {
    mismatches.push("sourceSnapshotSha256");
  }
  if (
    metadata.spatialSplitFileSha256 !== verifiedSpatialSplit.fileSha256
  ) {
    mismatches.push("spatialSplitFileSha256");
  }
  if (
    metadata.spatialSplitManifestHash !== verifiedSpatialSplit.manifestHash
  ) {
    mismatches.push("spatialSplitManifestHash");
  }
  if (
    metadata.contractSha256 !== neighborPolicyDiagnosticContractSha256()
  ) {
    mismatches.push("contractSha256");
  }
  if (
    metadata.generationImplementationSha256 !==
    generationImplementationSha256
  ) {
    mismatches.push("generationImplementationSha256");
  }
  if (
    canonicalJson(metadata.privacyContract) !==
    canonicalJson(PRIVACY_CONTRACT)
  ) {
    mismatches.push("privacyContract");
  }
  for (const [path, value] of [
    ["foldCount", metadata.foldCount],
    ["innerFoldCount", metadata.innerFoldCount],
    ["outerRowCount", metadata.outerRowCount],
    ["innerRowCount", metadata.innerRowCount],
    ["evidenceRowCount", metadata.evidenceRowCount]
  ]) {
    finiteInteger(value, `metadata.${path}`, { minimum: 1 });
  }
  if (metadata.foldCount !== 5 || metadata.innerFoldCount !== 20) {
    mismatches.push("foldCounts");
  }
  if (mismatches.length) {
    throw new NeighborPolicyOofCacheError(
      "NEIGHBOR_POLICY_OOF_CACHE_BINDING_MISMATCH",
      "邻居策略缓存绑定校验失败。",
      { mismatches }
    );
  }
}

function validateNeighborPolicyCachePreregistration(
  preregistration,
  {
    sourceSnapshotSha256,
    verifiedSpatialSplit,
    habitatFeatureSet,
    predictionImplementationSha256,
    qualityThresholds,
    modelOutputPath,
    cacheOutputPath,
    modelVersion
  }
) {
  const failures = [];
  if (preregistration?.schemaVersion !== 1) failures.push("schemaVersion");
  if (
    preregistration?.kind !==
    "zhejiang_neighbor_policy_oof_cache_v9_preregistration"
  ) {
    failures.push("kind");
  }
  if (
    preregistration?.status !==
    "frozen_before_single_long_development_cache_build" ||
    preregistration?.diagnosticOnly !== true
  ) {
    failures.push("status");
  }
  if (
    preregistration?.implementation?.predictionImplementationSha256 !==
    predictionImplementationSha256
  ) {
    failures.push("implementation.predictionImplementationSha256");
  }
  if (
    preregistration?.implementation
      ?.cacheGenerationImplementationSha256 !==
    neighborPolicyOofCacheGenerationImplementationSha256()
  ) {
    failures.push("implementation.cacheGenerationImplementationSha256");
  }
  if (
    preregistration?.contract?.sha256 !==
      neighborPolicyDiagnosticContractSha256() ||
    canonicalJson(preregistration?.contract?.value) !==
      canonicalJson(NEIGHBOR_POLICY_DIAGNOSTIC_CONTRACT)
  ) {
    failures.push("contract");
  }
  if (
    preregistration?.inputs?.sourceSnapshotSha256 !==
      String(sourceSnapshotSha256 || "").toLowerCase() ||
    preregistration?.inputs?.spatialSplitFileSha256 !==
      verifiedSpatialSplit?.fileSha256 ||
    preregistration?.inputs?.spatialSplitManifestHash !==
      verifiedSpatialSplit?.manifestHash
  ) {
    failures.push("inputs.spatial");
  }
  if (
    preregistration?.inputs?.featureFileSha256 !==
      habitatFeatureSet?.fileSha256 ||
    preregistration?.inputs?.featureSetSha256 !==
      habitatFeatureSet?.featureSetSha256 ||
    preregistration?.inputs?.tileManifestSha256 !==
      habitatFeatureSet?.tileManifestSha256 ||
    preregistration?.inputs?.featureGenerationImplementationSha256 !==
      habitatFeatureSet?.generationImplementationSha256
  ) {
    failures.push("inputs.habitatFeatures");
  }
  if (
    canonicalJson(preregistration?.expectedLayout) !==
    canonicalJson(EXPECTED_NEIGHBOR_POLICY_CACHE_LAYOUT)
  ) {
    failures.push("expectedLayout");
  }
  if (
    resolve(preregistration?.outputs?.modelPath || "") !==
      resolve(modelOutputPath) ||
    resolve(preregistration?.outputs?.cachePath || "") !==
      resolve(cacheOutputPath) ||
    preregistration?.outputs?.modelVersion !== modelVersion
  ) {
    failures.push("outputs");
  }
  if (
    preregistration?.outputs?.modelMustNotExistBeforeRun !== true ||
    preregistration?.outputs?.cacheMustNotExistBeforeRun !== true
  ) {
    failures.push("outputs.mustNotExist");
  }
  if (
    canonicalJson(preregistration?.qualityThresholds) !==
    canonicalJson(qualityThresholds)
  ) {
    failures.push("qualityThresholds");
  }
  if (
    canonicalJson(preregistration?.privacyContract) !==
    canonicalJson(PRIVACY_CONTRACT)
  ) {
    failures.push("privacyContract");
  }
  if (
    preregistration?.stopPolicy?.sealedForbidden !== true ||
    preregistration?.stopPolicy?.defaultModelOverwriteForbidden !== true ||
    preregistration?.stopPolicy?.referenceMaterializationForbidden !== true ||
    preregistration?.stopPolicy?.singleLongRunRequiresExplicitApproval !== true
  ) {
    failures.push("stopPolicy");
  }
  if (failures.length) {
    throw new NeighborPolicyOofCacheError(
      "NEIGHBOR_POLICY_OOF_CACHE_PREREGISTRATION_MISMATCH",
      "邻居策略缓存构建与冻结预登记不一致。",
      { failures }
    );
  }
  return true;
}

function loadFoldRows(database, setId) {
  const rows = database.prepare(`
    SELECT scores.set_id, scores.context_index, taxa.taxon_index, taxa.taxon_id,
           taxa.positive_count, taxa.outer_positive_count,
           taxa.development_positive_count, contexts.total,
           scores.actual_positive, scores.reference_raw_probability,
           scores.reference_baseline_probability, contexts.deepest_level,
           contexts.has_supported_local_unit, contexts.province_exposure,
           scores.province_detections, contexts.city_exposure,
           scores.city_detections, taxa.city_strength,
           contexts.district_exposure, scores.district_detections,
           taxa.district_strength
    FROM scores
    JOIN contexts USING (set_id, context_index)
    JOIN taxa USING (set_id, taxon_index)
    WHERE scores.set_id = ?
    ORDER BY scores.context_index, taxa.taxon_id
  `).all(setId).map((row) => ({
    contextIndex: Number(row.context_index),
    taxonId: String(row.taxon_id),
    positiveCount: Number(row.positive_count),
    outerPositiveCount: Number(row.outer_positive_count),
    developmentPositiveCount: Number(row.development_positive_count),
    total: Number(row.total),
    actualPositive: Number(row.actual_positive),
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
    districtStrength: Number(row.district_strength),
    neighborPolicyEvidence: []
  }));
  const rowByKey = new Map(
    rows.map((row) => [
      `${row.contextIndex}\0${row.taxonId}`,
      row
    ])
  );
  for (const evidence of database.prepare(`
    SELECT detections.context_index, taxa.taxon_id,
           detections.policy_id, detections.channel_id, detections.detections,
           contexts.application_order, contexts.exposure,
           contexts.neighbor_count, contexts.weight_sum,
           contexts.evidence_exposure_cap, contexts.evidence_prior_strength
    FROM neighbor_detections detections
    JOIN neighbor_contexts contexts
      USING (set_id, context_index, policy_id, channel_id)
    JOIN taxa USING (set_id, taxon_index)
    WHERE detections.set_id = ?
    ORDER BY detections.context_index, taxa.taxon_id,
             contexts.application_order, detections.policy_id,
             detections.channel_id
  `).iterate(setId)) {
    const row = rowByKey.get(
      `${evidence.context_index}\0${evidence.taxon_id}`
    );
    let policy = row.neighborPolicyEvidence.find(
      (item) => item.policyId === evidence.policy_id
    );
    if (!policy) {
      policy = { policyId: String(evidence.policy_id), channels: [] };
      row.neighborPolicyEvidence.push(policy);
    }
    policy.channels.push({
      channelId: String(evidence.channel_id),
      applicationOrder: Number(evidence.application_order),
      exposure: Number(evidence.exposure),
      detections: Number(evidence.detections),
      neighborCount: Number(evidence.neighbor_count),
      weightSum: Number(evidence.weight_sum),
      evidenceExposureCap: Number(evidence.evidence_exposure_cap),
      evidencePriorStrength: Number(evidence.evidence_prior_strength)
    });
  }
  const policyOrder = new Map(
    NEIGHBOR_POLICY_DIAGNOSTIC_CONTRACT.policies.map((policy, index) => [
      policy.id,
      index
    ])
  );
  for (const row of rows) {
    row.neighborPolicyEvidence.sort(
      (left, right) =>
        policyOrder.get(left.policyId) - policyOrder.get(right.policyId)
    );
    for (const policy of row.neighborPolicyEvidence) {
      policy.channels.sort(
        (left, right) =>
          left.applicationOrder - right.applicationOrder ||
          left.channelId.localeCompare(right.channelId)
      );
    }
  }
  return rows;
}

function openNeighborPolicyOofCache({
  cachePath,
  verifiedSpatialSplit,
  sourceSnapshotSha256,
  generationImplementationSha256 =
    neighborPolicyOofCacheGenerationImplementationSha256()
}) {
  if (verifiedSpatialSplit?.panelName !== NEIGHBOR_POLICY_OOF_CACHE_PANEL) {
    throw new NeighborPolicyOofCacheError(
      "NEIGHBOR_POLICY_OOF_CACHE_DEVELOPMENT_ONLY",
      "邻居策略缓存只能在 development split 下读取。"
    );
  }
  const absolutePath = resolve(cachePath);
  const sidecarPath = `${absolutePath}.sha256`;
  if (!existsSync(absolutePath) || !existsSync(sidecarPath)) {
    throw new NeighborPolicyOofCacheError(
      "NEIGHBOR_POLICY_OOF_CACHE_MISSING",
      "邻居策略缓存或 SHA sidecar 不存在。"
    );
  }
  const expectedFileSha256 = String(
    readFileSync(sidecarPath, "utf8")
  ).trim().split(/\s+/)[0]?.toLowerCase();
  const fileSha256 = sha256File(absolutePath);
  if (
    !/^[0-9a-f]{64}$/.test(expectedFileSha256 || "") ||
    expectedFileSha256 !== fileSha256
  ) {
    throw new NeighborPolicyOofCacheError(
      "NEIGHBOR_POLICY_OOF_CACHE_FILE_HASH_MISMATCH",
      "邻居策略缓存文件哈希校验失败。"
    );
  }
  const database = new DatabaseSync(absolutePath, { readOnly: true });
  try {
    database.exec("PRAGMA query_only = ON; PRAGMA foreign_keys = ON;");
    validateSchema(database);
    const metadata = parseMetadata(database);
    validateMetadata(metadata, {
      verifiedSpatialSplit,
      sourceSnapshotSha256,
      generationImplementationSha256
    });
    const quickCheck = database.prepare("PRAGMA quick_check").get().quick_check;
    const foreignKeyFailures = database.prepare("PRAGMA foreign_key_check").all();
    if (quickCheck !== "ok" || foreignKeyFailures.length !== 0) {
      throw new NeighborPolicyOofCacheError(
        "NEIGHBOR_POLICY_OOF_CACHE_INTEGRITY_FAILED",
        "邻居策略缓存读取完整性校验失败。"
      );
    }
    const foldSets = database.prepare(`
      SELECT * FROM fold_sets ORDER BY outer_fold_id, inner_fold_id
    `).all().map((row) => ({
      setId: Number(row.set_id),
      outerFoldId: String(row.outer_fold_id),
      innerFoldId:
        Number(row.inner_fold_id) === 0
          ? null
          : String(row.inner_fold_id),
      trainingFoldIds: JSON.parse(row.training_fold_ids_json).map(String),
      contextCount: Number(row.context_count),
      taxonCount: Number(row.taxon_count),
      scoreCount: Number(row.score_count),
      evidenceConfiguration: JSON.parse(row.evidence_configuration_json),
      referenceRawMetrics:
        row.reference_raw_metrics_json == null
          ? null
          : JSON.parse(row.reference_raw_metrics_json)
    }));
    return {
      path: absolutePath,
      sidecarPath,
      fileSha256,
      metadata,
      foldSets,
      readFold({
        outerFoldId,
        innerFoldId = null
      }) {
        const fold = foldSets.find(
          (item) =>
            item.outerFoldId === String(outerFoldId) &&
            item.innerFoldId ===
              (innerFoldId == null ? null : String(innerFoldId))
        );
        if (!fold) {
          throw new NeighborPolicyOofCacheError(
            "NEIGHBOR_POLICY_OOF_CACHE_FOLD_UNKNOWN",
            `未知 fold ${outerFoldId}:${innerFoldId ?? "outer"}。`
          );
        }
        return {
          ...fold,
          scoreRows: loadFoldRows(database, fold.setId)
        };
      },
      close() {
        database.close();
      }
    };
  } catch (error) {
    database.close();
    throw error;
  }
}

module.exports = {
  CACHE_METADATA_KEYS,
  CACHE_TABLE_COLUMNS,
  DEVELOPMENT_POOL_POSITIVE_COUNT_POLICY,
  EXPECTED_NEIGHBOR_POLICY_CACHE_LAYOUT,
  NEIGHBOR_POLICY_OOF_CACHE_FILES,
  NEIGHBOR_POLICY_OOF_CACHE_KIND,
  NEIGHBOR_POLICY_OOF_CACHE_PANEL,
  NEIGHBOR_POLICY_OOF_CACHE_SCHEMA_VERSION,
  NeighborPolicyOofCacheError,
  PRIVACY_CONTRACT,
  assertPrivacySafe,
  createNeighborPolicyOofCacheWriter,
  neighborPolicyOofCacheGenerationImplementationSha256,
  openNeighborPolicyOofCache,
  validateNeighborPolicyCachePreregistration,
  writeNeighborPolicyOofCache
};
