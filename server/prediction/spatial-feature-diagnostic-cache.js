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
  MULTISCALE_SPATIAL_FEATURE_CONTRACT,
  MULTISCALE_SPATIAL_FEATURE_MINIMUM_PUBLIC_CELLS,
  MULTISCALE_SPATIAL_FEATURE_NAMES,
  multiscaleSpatialFeatureContractSha256,
  multiscaleSpatialFeatureGenerationImplementationSha256,
  serializableMultiscaleSpatialFeatureProfiles
} = require("./multiscale-spatial-features");
const {
  NEIGHBOR_POLICY_OOF_CACHE_KIND
} = require("./neighbor-policy-oof-cache");

const SPATIAL_FEATURE_DIAGNOSTIC_CACHE_SCHEMA_VERSION = 1;
const SPATIAL_FEATURE_DIAGNOSTIC_CACHE_KIND =
  "zhejiang_development_multiscale_spatial_feature_diagnostic_contexts_v1";
const SPATIAL_FEATURE_DIAGNOSTIC_CACHE_PANEL = "development";
const EXPECTED_SPATIAL_FEATURE_DIAGNOSTIC_CACHE_LAYOUT = Object.freeze({
  foldSetCount: 25,
  outerFoldCount: 5,
  innerFoldCount: 20,
  outerContextRows: 727,
  innerContextRows: 2908,
  totalContextRows: 3635
});
const FROZEN_SPATIAL_FEATURE_DIAGNOSTIC_IMPLEMENTATION_BINDINGS =
  Object.freeze([
    Object.freeze({
      modelVersion:
        "zhejiang-v1-20260715-development-multiscale-spatial-feature-v10",
      generationImplementationSha256:
        "3b22953053024a5b6cedac61c91a0cf5f4442f7d87149bb0c08a65926ac5823c",
      predictionImplementationSha256:
        "621c1e8288329c6988adb013253ae9bf42a06b2043aba92114047d5912d7cc74"
    })
  ]);
const SPATIAL_FEATURE_DIAGNOSTIC_CACHE_FILES = Object.freeze([
  "tools/build-zhejiang-prediction-model.js",
  "server/prediction/habitat-features.js",
  "server/prediction/multiscale-spatial-features.js",
  "server/prediction/neighbor-policy-oof-cache.js",
  "server/prediction/spatial-feature-diagnostic-cache.js",
  "server/prediction/spatial-splits.js"
]);
const CACHE_TABLE_COLUMNS = Object.freeze({
  metadata: Object.freeze(["key", "value"]),
  profiles: Object.freeze([
    "profile_index",
    "profile_id",
    "public_cell_count",
    "standardized_centroid_json"
  ]),
  fold_sets: Object.freeze([
    "set_id",
    "outer_fold_id",
    "inner_fold_id",
    "context_count",
    "companion_score_count"
  ]),
  contexts: Object.freeze([
    "set_id",
    "context_index",
    "profile_index",
    "season_week"
  ])
});
const CACHE_METADATA_KEYS = Object.freeze([
  "cacheKind",
  "companionCacheFileSha256",
  "companionCacheKind",
  "contractSha256",
  "diagnosticOnly",
  "featureNames",
  "foldSetCount",
  "generationImplementationSha256",
  "innerContextRows",
  "innerFoldCount",
  "normalization",
  "outerContextRows",
  "outerFoldCount",
  "panel",
  "predictionImplementationSha256",
  "privacyContract",
  "profileCount",
  "profileModelSha256",
  "publicCellCount",
  "schemaVersion",
  "sourceFeatureFileSha256",
  "sourceFeatureSetSha256",
  "sourceSnapshotSha256",
  "spatialSplitFileSha256",
  "spatialSplitManifestHash",
  "totalContextRows"
]);
const PRIVACY_CONTRACT = Object.freeze({
  contextIdentity:
    "companion_neighbor_cache_fold_set_and_dense_ordinal_without_location_mapping",
  seasonWeek: true,
  profileId:
    "target_independent_public_worldcover_profile_with_minimum_support",
  minimumPublicCellsPerProfile:
    MULTISCALE_SPATIAL_FEATURE_MINIMUM_PUBLIC_CELLS,
  reportIds: false,
  publicTaxonIds: false,
  observers: false,
  coordinates: false,
  exactSpatialIdentifiers: false,
  neighborIdentifiers: false,
  exactPerContextFeatureVectors: false,
  names: false
});
const FORBIDDEN_KEYS = Object.freeze([
  "report_id",
  "reportId",
  "taxon_id",
  "taxonId",
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
  "location_name",
  "locationName",
  "feature_vector",
  "featureVector"
]);

class SpatialFeatureDiagnosticCacheError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "SpatialFeatureDiagnosticCacheError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function normalizeSha256(value, path) {
  const normalized = String(value || "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new SpatialFeatureDiagnosticCacheError(
      "SPATIAL_FEATURE_DIAGNOSTIC_CACHE_SHA_INVALID",
      `${path} 必须是 SHA-256。`,
      { path, value }
    );
  }
  return normalized;
}

function finiteInteger(value, path, { minimum = -Infinity, maximum = Infinity } = {}) {
  const number = Number(value);
  if (
    !Number.isInteger(number) ||
    number < minimum ||
    number > maximum
  ) {
    throw new SpatialFeatureDiagnosticCacheError(
      "SPATIAL_FEATURE_DIAGNOSTIC_CACHE_VALUE_INVALID",
      `${path} 不是允许范围内的整数。`,
      { path, value }
    );
  }
  return number;
}

function assertPrivacySafe(value, path = "value") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertPrivacySafe(entry, `${path}[${index}]`)
    );
    return true;
  }
  if (!value || typeof value !== "object") return true;
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.includes(key) && entry !== false) {
      throw new SpatialFeatureDiagnosticCacheError(
        "SPATIAL_FEATURE_DIAGNOSTIC_CACHE_PRIVACY_VIOLATION",
        `特征诊断缓存禁止字段：${path}.${key}`,
        { path: `${path}.${key}` }
      );
    }
    assertPrivacySafe(entry, `${path}.${key}`);
  }
  return true;
}

function spatialFeatureDiagnosticCacheGenerationImplementationSha256(
  projectRoot = resolve(__dirname, "..", "..")
) {
  const hash = createHash("sha256");
  for (const relativePath of [...SPATIAL_FEATURE_DIAGNOSTIC_CACHE_FILES].sort()) {
    hash.update(relativePath, "utf8");
    hash.update("\0", "utf8");
    hash.update(readFileSync(resolve(projectRoot, relativePath)));
    hash.update("\0", "utf8");
  }
  return hash.digest("hex");
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

function cleanupTemporaryDatabase(path) {
  for (const candidate of [path, `${path}-wal`, `${path}-shm`]) {
    safeUnlink(candidate);
  }
}

function foldSetIdentity({ outerFoldId, innerFoldId = null }) {
  const outer = finiteInteger(outerFoldId, "foldSet.outerFoldId", {
    minimum: 1,
    maximum: 5
  });
  const inner = innerFoldId == null
    ? 0
    : finiteInteger(innerFoldId, "foldSet.innerFoldId", {
        minimum: 1,
        maximum: 5
      });
  if (inner === outer) {
    throw new SpatialFeatureDiagnosticCacheError(
      "SPATIAL_FEATURE_DIAGNOSTIC_CACHE_FOLD_INVALID",
      "inner fold 不能与 outer fold 相同。"
    );
  }
  const innerIds = [1, 2, 3, 4, 5].filter((foldId) => foldId !== outer);
  const innerIndex = inner === 0 ? -1 : innerIds.indexOf(inner);
  if (inner !== 0 && innerIndex < 0) {
    throw new SpatialFeatureDiagnosticCacheError(
      "SPATIAL_FEATURE_DIAGNOSTIC_CACHE_FOLD_INVALID",
      "inner fold 不属于冻结的五折集合。"
    );
  }
  return {
    outerFoldId: outer,
    innerFoldId: inner,
    setId:
      inner === 0
        ? (outer - 1) * 5 + 1
        : (outer - 1) * 5 + 2 + innerIndex,
    key: `${outer}:${inner}`
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

function createCacheSchema(database) {
  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA page_size = 4096;
    CREATE TABLE metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) WITHOUT ROWID;
    CREATE TABLE profiles (
      profile_index INTEGER PRIMARY KEY CHECK(profile_index >= 0),
      profile_id TEXT NOT NULL UNIQUE,
      public_cell_count INTEGER NOT NULL CHECK(public_cell_count >= ${MULTISCALE_SPATIAL_FEATURE_MINIMUM_PUBLIC_CELLS}),
      standardized_centroid_json TEXT NOT NULL
    );
    CREATE TABLE fold_sets (
      set_id INTEGER PRIMARY KEY,
      outer_fold_id INTEGER NOT NULL CHECK(outer_fold_id BETWEEN 1 AND 5),
      inner_fold_id INTEGER NOT NULL CHECK(inner_fold_id BETWEEN 0 AND 5 AND inner_fold_id <> outer_fold_id),
      context_count INTEGER NOT NULL CHECK(context_count > 0),
      companion_score_count INTEGER NOT NULL CHECK(companion_score_count > 0),
      UNIQUE (outer_fold_id, inner_fold_id)
    );
    CREATE TABLE contexts (
      set_id INTEGER NOT NULL,
      context_index INTEGER NOT NULL CHECK(context_index >= 0),
      profile_index INTEGER NOT NULL,
      season_week INTEGER NOT NULL CHECK(season_week BETWEEN 0 AND 52),
      PRIMARY KEY (set_id, context_index),
      FOREIGN KEY (set_id) REFERENCES fold_sets(set_id),
      FOREIGN KEY (profile_index) REFERENCES profiles(profile_index)
    ) WITHOUT ROWID;
  `);
}

function setMetadata(database, key, value) {
  database
    .prepare("INSERT INTO metadata(key, value) VALUES (?, ?)")
    .run(key, canonicalJson(value));
}

function schemaObjects(database) {
  return database.prepare(`
    SELECT type, name, tbl_name, sql
    FROM sqlite_master
    WHERE name NOT LIKE 'sqlite_%'
    ORDER BY type, name
  `).all();
}

function expectedSchemaObjects() {
  const database = new DatabaseSync(":memory:");
  createCacheSchema(database);
  const objects = schemaObjects(database);
  database.close();
  return objects;
}

function validateSchema(database) {
  if (
    canonicalJson(schemaObjects(database)) !==
    canonicalJson(expectedSchemaObjects())
  ) {
    throw new SpatialFeatureDiagnosticCacheError(
      "SPATIAL_FEATURE_DIAGNOSTIC_CACHE_SCHEMA_MISMATCH",
      "特征诊断缓存 schema 与冻结定义不一致。"
    );
  }
  for (const [table, expected] of Object.entries(CACHE_TABLE_COLUMNS)) {
    const actual = database
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .map((row) => row.name);
    if (canonicalJson(actual) !== canonicalJson(expected)) {
      throw new SpatialFeatureDiagnosticCacheError(
        "SPATIAL_FEATURE_DIAGNOSTIC_CACHE_SCHEMA_MISMATCH",
        `${table} 列与冻结定义不一致。`,
        { table, expected, actual }
      );
    }
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
    throw new SpatialFeatureDiagnosticCacheError(
      "SPATIAL_FEATURE_DIAGNOSTIC_CACHE_METADATA_MISMATCH",
      "特征诊断缓存 metadata 键集合不匹配。"
    );
  }
  return Object.fromEntries(
    rows.map((row) => [row.key, JSON.parse(row.value)])
  );
}

function readCompanionNeighborCache(
  cachePath,
  {
    sourceSnapshotSha256 = null,
    verifiedSpatialSplit = null,
    expectedLayout =
      EXPECTED_SPATIAL_FEATURE_DIAGNOSTIC_CACHE_LAYOUT
  } = {}
) {
  const absolutePath = resolve(cachePath);
  const sidecarPath = `${absolutePath}.sha256`;
  if (!existsSync(absolutePath) || !existsSync(sidecarPath)) {
    throw new SpatialFeatureDiagnosticCacheError(
      "SPATIAL_FEATURE_DIAGNOSTIC_COMPANION_MISSING",
      "配套邻居策略缓存或 SHA sidecar 不存在。",
      { cachePath: absolutePath }
    );
  }
  const expectedSha256 = String(readFileSync(sidecarPath, "utf8"))
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase();
  const fileSha256 = sha256File(absolutePath);
  if (
    !/^[0-9a-f]{64}$/.test(expectedSha256 || "") ||
    expectedSha256 !== fileSha256
  ) {
    throw new SpatialFeatureDiagnosticCacheError(
      "SPATIAL_FEATURE_DIAGNOSTIC_COMPANION_HASH_MISMATCH",
      "配套邻居策略缓存 SHA 校验失败。"
    );
  }
  const database = new DatabaseSync(absolutePath, { readOnly: true });
  try {
    database.exec("PRAGMA query_only = ON; PRAGMA foreign_keys = ON;");
    const quickCheck = database.prepare("PRAGMA quick_check").get().quick_check;
    const foreignKeyFailures = database
      .prepare("PRAGMA foreign_key_check")
      .all();
    const freePages = Number(
      database.prepare("PRAGMA freelist_count").get().freelist_count
    ) || 0;
    const metadata = Object.fromEntries(
      database
        .prepare("SELECT key, value FROM metadata ORDER BY key")
        .all()
        .map((row) => [row.key, JSON.parse(row.value)])
    );
    const cacheKind = metadata.cacheKind;
    if (
      quickCheck !== "ok" ||
      foreignKeyFailures.length !== 0 ||
      freePages !== 0 ||
      cacheKind !== NEIGHBOR_POLICY_OOF_CACHE_KIND
    ) {
      throw new SpatialFeatureDiagnosticCacheError(
        "SPATIAL_FEATURE_DIAGNOSTIC_COMPANION_INVALID",
        "配套文件不是完整的冻结邻居策略缓存。"
      );
    }
    const foldSets = database.prepare(`
      SELECT set_id, outer_fold_id, inner_fold_id, context_count, score_count
      FROM fold_sets
      ORDER BY set_id
    `).all().map((row) => ({
      setId: Number(row.set_id),
      outerFoldId: Number(row.outer_fold_id),
      innerFoldId: Number(row.inner_fold_id),
      contextCount: Number(row.context_count),
      scoreCount: Number(row.score_count)
    }));
    const actualLayout = {
      foldSetCount: foldSets.length,
      outerFoldCount: foldSets.filter(
        (fold) => fold.innerFoldId === 0
      ).length,
      innerFoldCount: foldSets.filter(
        (fold) => fold.innerFoldId !== 0
      ).length,
      outerContextRows: foldSets
        .filter((fold) => fold.innerFoldId === 0)
        .reduce((sum, fold) => sum + fold.contextCount, 0),
      innerContextRows: foldSets
        .filter((fold) => fold.innerFoldId !== 0)
        .reduce((sum, fold) => sum + fold.contextCount, 0),
      totalContextRows: foldSets.reduce(
        (sum, fold) => sum + fold.contextCount,
        0
      )
    };
    const bindingMismatches = [];
    if (
      metadata.panel !== SPATIAL_FEATURE_DIAGNOSTIC_CACHE_PANEL
    ) {
      bindingMismatches.push("panel");
    }
    if (
      sourceSnapshotSha256 != null &&
      metadata.sourceSnapshotSha256 !==
        normalizeSha256(
          sourceSnapshotSha256,
          "sourceSnapshotSha256"
        )
    ) {
      bindingMismatches.push("sourceSnapshotSha256");
    }
    if (
      verifiedSpatialSplit &&
      metadata.spatialSplitFileSha256 !==
        normalizeSha256(
          verifiedSpatialSplit.fileSha256,
          "verifiedSpatialSplit.fileSha256"
        )
    ) {
      bindingMismatches.push("spatialSplitFileSha256");
    }
    if (
      verifiedSpatialSplit &&
      metadata.spatialSplitManifestHash !==
        normalizeSha256(
          verifiedSpatialSplit.manifestHash,
          "verifiedSpatialSplit.manifestHash"
        )
    ) {
      bindingMismatches.push("spatialSplitManifestHash");
    }
    if (
      canonicalJson(actualLayout) !==
      canonicalJson(expectedLayout)
    ) {
      bindingMismatches.push("foldLayout");
    }
    let companionFoldIdentities = [];
    try {
      companionFoldIdentities = foldSets.map((fold) => {
        const identity = foldSetIdentity({
          outerFoldId: fold.outerFoldId,
          innerFoldId:
            fold.innerFoldId === 0 ? null : fold.innerFoldId
        });
        return {
          setId: fold.setId,
          expectedSetId: identity.setId,
          key: identity.key
        };
      });
    } catch {
      companionFoldIdentities = [];
    }
    if (
      companionFoldIdentities.length !== foldSets.length ||
      companionFoldIdentities.some(
        (identity) => identity.setId !== identity.expectedSetId
      ) ||
      canonicalJson(
        companionFoldIdentities.map((identity) => identity.key).sort()
      ) !== canonicalJson(expectedFoldSetKeys()) ||
      foldSets.some((fold) => fold.scoreCount <= 0)
    ) {
      bindingMismatches.push("foldIdentity");
    }
    if (bindingMismatches.length) {
      throw new SpatialFeatureDiagnosticCacheError(
        "SPATIAL_FEATURE_DIAGNOSTIC_COMPANION_BINDING_MISMATCH",
        "Companion neighbor cache does not match the frozen development inputs.",
        { mismatches: bindingMismatches, actualLayout }
      );
    }
    return {
      path: absolutePath,
      sidecarPath,
      fileSha256,
      cacheKind,
      metadata,
      layout: actualLayout,
      foldSets
    };
  } finally {
    database.close();
  }
}

function normalizeProfileModel(profileModel, sourceFeatureSetSha256) {
  const serialized =
    serializableMultiscaleSpatialFeatureProfiles(profileModel);
  if (
    serialized.contractSha256 !==
      multiscaleSpatialFeatureContractSha256() ||
    serialized.sourceFeatureSetSha256 !==
      normalizeSha256(sourceFeatureSetSha256, "sourceFeatureSetSha256") ||
    canonicalJson(serialized.normalization.featureNames) !==
      canonicalJson(MULTISCALE_SPATIAL_FEATURE_NAMES) ||
    serialized.profiles.some(
      (profile) =>
        Number(profile.publicCellCount) <
          MULTISCALE_SPATIAL_FEATURE_MINIMUM_PUBLIC_CELLS ||
        !Array.isArray(profile.standardizedCentroid) ||
        profile.standardizedCentroid.length !==
          MULTISCALE_SPATIAL_FEATURE_NAMES.length ||
        profile.standardizedCentroid.some(
          (value) => !Number.isFinite(Number(value))
        )
    )
  ) {
    throw new SpatialFeatureDiagnosticCacheError(
      "SPATIAL_FEATURE_DIAGNOSTIC_PROFILE_MODEL_INVALID",
      "多尺度空间特征原型模型与冻结契约不一致。"
    );
  }
  return serialized;
}

function normalizeFoldSets(foldSets, profileModel, companion) {
  const profileIndexById = new Map(
    profileModel.profiles.map((profile, index) => [
      profile.profileId,
      index
    ])
  );
  const companionByKey = new Map(
    companion.foldSets.map((fold) => [
      `${fold.outerFoldId}:${fold.innerFoldId}`,
      fold
    ])
  );
  const normalized = (foldSets || []).map((fold) => {
    const identity = foldSetIdentity(fold);
    const companionFold = companionByKey.get(identity.key);
    if (
      !companionFold ||
      companionFold.setId !== identity.setId
    ) {
      throw new SpatialFeatureDiagnosticCacheError(
        "SPATIAL_FEATURE_DIAGNOSTIC_COMPANION_LAYOUT_MISMATCH",
        "特征上下文 fold 与配套邻居缓存不一致。",
        { fold: identity.key }
      );
    }
    const contexts = [...(fold.contexts || [])]
      .map((context) => {
        assertPrivacySafe(context, `foldSets.${identity.key}.contexts`);
        const contextIndex = finiteInteger(
          context.contextIndex,
          `foldSets.${identity.key}.contextIndex`,
          { minimum: 0 }
        );
        const profileIndex = profileIndexById.get(String(context.profileId));
        if (profileIndex == null) {
          throw new SpatialFeatureDiagnosticCacheError(
            "SPATIAL_FEATURE_DIAGNOSTIC_PROFILE_UNKNOWN",
            "上下文引用了未知的空间特征原型。",
            { fold: identity.key, contextIndex, profileId: context.profileId }
          );
        }
        return {
          contextIndex,
          profileIndex,
          seasonWeek: finiteInteger(
            context.seasonWeek,
            `foldSets.${identity.key}.seasonWeek`,
            { minimum: 0, maximum: 52 }
          )
        };
      })
      .sort((left, right) => left.contextIndex - right.contextIndex);
    const scoreCount = finiteInteger(
      fold.scoreCount,
      `foldSets.${identity.key}.scoreCount`,
      { minimum: 1 }
    );
    if (
      !contexts.length ||
      contexts.length !== companionFold.contextCount ||
      scoreCount !== companionFold.scoreCount ||
      contexts.some((context, index) => context.contextIndex !== index)
    ) {
      throw new SpatialFeatureDiagnosticCacheError(
        "SPATIAL_FEATURE_DIAGNOSTIC_CONTEXT_LAYOUT_MISMATCH",
        "特征上下文必须与配套缓存使用完全相同的连续 context_index。",
        {
          fold: identity.key,
          expected: companionFold.contextCount,
          actual: contexts.length,
          expectedScoreCount: companionFold.scoreCount,
          actualScoreCount: scoreCount
        }
      );
    }
    return {
      ...identity,
      contexts,
      companionScoreCount: scoreCount
    };
  }).sort((left, right) => left.setId - right.setId);
  if (
    canonicalJson(normalized.map((fold) => fold.key).sort()) !==
    canonicalJson(expectedFoldSetKeys())
  ) {
    throw new SpatialFeatureDiagnosticCacheError(
      "SPATIAL_FEATURE_DIAGNOSTIC_FOLDS_INCOMPLETE",
      "特征诊断缓存必须包含完整的 5 outer × 4 inner 折集合。"
    );
  }
  return normalized;
}

function layoutForFoldSets(foldSets) {
  const outer = foldSets.filter((fold) => fold.innerFoldId === 0);
  const inner = foldSets.filter((fold) => fold.innerFoldId !== 0);
  return {
    foldSetCount: foldSets.length,
    outerFoldCount: outer.length,
    innerFoldCount: inner.length,
    outerContextRows: outer.reduce(
      (sum, fold) => sum + fold.contexts.length,
      0
    ),
    innerContextRows: inner.reduce(
      (sum, fold) => sum + fold.contexts.length,
      0
    ),
    totalContextRows: foldSets.reduce(
      (sum, fold) => sum + fold.contexts.length,
      0
    )
  };
}

function writeSpatialFeatureDiagnosticCache({
  cachePath,
  companionNeighborCachePath,
  foldSets,
  profileModel,
  verifiedSpatialSplit,
  sourceSnapshotSha256,
  sourceFeatureFileSha256,
  sourceFeatureSetSha256,
  generationImplementationSha256,
  predictionImplementationSha256,
  expectedLayout = EXPECTED_SPATIAL_FEATURE_DIAGNOSTIC_CACHE_LAYOUT
}) {
  if (
    verifiedSpatialSplit?.panelName !==
      SPATIAL_FEATURE_DIAGNOSTIC_CACHE_PANEL
  ) {
    throw new SpatialFeatureDiagnosticCacheError(
      "SPATIAL_FEATURE_DIAGNOSTIC_DEVELOPMENT_ONLY",
      "多尺度空间特征诊断缓存只能写入 development 面板。"
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
    throw new SpatialFeatureDiagnosticCacheError(
      "SPATIAL_FEATURE_DIAGNOSTIC_SNAPSHOT_MISMATCH",
      "快照与冻结 split 不一致。"
    );
  }
  const currentGenerationSha256 =
    spatialFeatureDiagnosticCacheGenerationImplementationSha256();
  if (generationImplementationSha256 !== currentGenerationSha256) {
    throw new SpatialFeatureDiagnosticCacheError(
      "SPATIAL_FEATURE_DIAGNOSTIC_GENERATOR_MISMATCH",
      "特征诊断缓存生成器哈希不匹配。",
      {
        expected: currentGenerationSha256,
        actual: generationImplementationSha256 || null
      }
    );
  }
  const absolutePath = resolve(cachePath);
  const sidecarPath = `${absolutePath}.sha256`;
  if (existsSync(absolutePath) || existsSync(sidecarPath)) {
    throw new SpatialFeatureDiagnosticCacheError(
      "SPATIAL_FEATURE_DIAGNOSTIC_OUTPUT_EXISTS",
      "特征诊断缓存或 SHA sidecar 已存在。",
      { cachePath: absolutePath }
    );
  }
  const companion = readCompanionNeighborCache(
    companionNeighborCachePath,
    {
      sourceSnapshotSha256: snapshotSha256,
      verifiedSpatialSplit,
      expectedLayout
    }
  );
  const normalizedProfileModel = normalizeProfileModel(
    profileModel,
    sourceFeatureSetSha256
  );
  const normalizedFoldSets = normalizeFoldSets(
    foldSets,
    normalizedProfileModel,
    companion
  );
  const actualLayout = layoutForFoldSets(normalizedFoldSets);
  if (
    expectedLayout &&
    canonicalJson(actualLayout) !== canonicalJson(expectedLayout)
  ) {
    throw new SpatialFeatureDiagnosticCacheError(
      "SPATIAL_FEATURE_DIAGNOSTIC_LAYOUT_MISMATCH",
      "特征诊断缓存行数与冻结布局不一致。",
      { expectedLayout, actualLayout }
    );
  }
  const metadata = {
    schemaVersion: SPATIAL_FEATURE_DIAGNOSTIC_CACHE_SCHEMA_VERSION,
    cacheKind: SPATIAL_FEATURE_DIAGNOSTIC_CACHE_KIND,
    panel: SPATIAL_FEATURE_DIAGNOSTIC_CACHE_PANEL,
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
    sourceFeatureFileSha256: normalizeSha256(
      sourceFeatureFileSha256,
      "sourceFeatureFileSha256"
    ),
    sourceFeatureSetSha256: normalizeSha256(
      sourceFeatureSetSha256,
      "sourceFeatureSetSha256"
    ),
    contractSha256: multiscaleSpatialFeatureContractSha256(),
    generationImplementationSha256,
    predictionImplementationSha256: normalizeSha256(
      predictionImplementationSha256,
      "predictionImplementationSha256"
    ),
    companionCacheKind: companion.cacheKind,
    companionCacheFileSha256: companion.fileSha256,
    profileModelSha256: normalizedProfileModel.profileModelSha256,
    publicCellCount: normalizedProfileModel.publicCellCount,
    profileCount: normalizedProfileModel.profiles.length,
    featureNames: normalizedProfileModel.normalization.featureNames,
    normalization: normalizedProfileModel.normalization,
    ...actualLayout,
    privacyContract: PRIVACY_CONTRACT
  };
  assertPrivacySafe(metadata, "metadata");
  mkdirSync(dirname(absolutePath), { recursive: true });
  const temporaryPath = `${absolutePath}.building-${process.pid}`;
  const temporarySidecar = `${sidecarPath}.building-${process.pid}`;
  cleanupTemporaryDatabase(temporaryPath);
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
    const insertProfile = database.prepare(`
      INSERT INTO profiles(
        profile_index, profile_id, public_cell_count,
        standardized_centroid_json
      ) VALUES (?, ?, ?, ?)
    `);
    const insertFold = database.prepare(`
      INSERT INTO fold_sets(
        set_id, outer_fold_id, inner_fold_id, context_count,
        companion_score_count
      ) VALUES (?, ?, ?, ?, ?)
    `);
    const insertContext = database.prepare(`
      INSERT INTO contexts(
        set_id, context_index, profile_index, season_week
      ) VALUES (?, ?, ?, ?)
    `);
    database.exec("BEGIN IMMEDIATE");
    try {
      for (const key of CACHE_METADATA_KEYS) {
        setMetadata(database, key, metadata[key]);
      }
      normalizedProfileModel.profiles.forEach((profile, index) => {
        insertProfile.run(
          index,
          profile.profileId,
          profile.publicCellCount,
          canonicalJson(profile.standardizedCentroid)
        );
      });
      for (const fold of normalizedFoldSets) {
        insertFold.run(
          fold.setId,
          fold.outerFoldId,
          fold.innerFoldId,
          fold.contexts.length,
          fold.companionScoreCount
        );
        for (const context of fold.contexts) {
          insertContext.run(
            fold.setId,
            context.contextIndex,
            context.profileIndex,
            context.seasonWeek
          );
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
    validateSchema(database);
    const quickCheck = database.prepare("PRAGMA quick_check").get().quick_check;
    const foreignKeyFailures = database
      .prepare("PRAGMA foreign_key_check")
      .all();
    if (quickCheck !== "ok" || foreignKeyFailures.length !== 0) {
      throw new SpatialFeatureDiagnosticCacheError(
        "SPATIAL_FEATURE_DIAGNOSTIC_INTEGRITY_FAILED",
        "特征诊断缓存完整性校验失败。",
        { quickCheck, foreignKeyFailures }
      );
    }
    database.exec("VACUUM");
    const freePages = Number(
      database.prepare("PRAGMA freelist_count").get().freelist_count
    ) || 0;
    if (freePages !== 0) {
      throw new SpatialFeatureDiagnosticCacheError(
        "SPATIAL_FEATURE_DIAGNOSTIC_INTEGRITY_FAILED",
        "特征诊断缓存存在未回收页。",
        { freePages }
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
      schemaVersion: SPATIAL_FEATURE_DIAGNOSTIC_CACHE_SCHEMA_VERSION,
      cacheKind: SPATIAL_FEATURE_DIAGNOSTIC_CACHE_KIND,
      panel: SPATIAL_FEATURE_DIAGNOSTIC_CACHE_PANEL,
      profileModelSha256: normalizedProfileModel.profileModelSha256,
      companionCacheFileSha256: companion.fileSha256,
      ...actualLayout,
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
    cleanupTemporaryDatabase(temporaryPath);
    safeUnlink(temporarySidecar);
    if (publishedSidecar) safeUnlink(sidecarPath);
    if (publishedCache) safeUnlink(absolutePath);
    throw error;
  }
}

function validateMetadata(metadata, {
  verifiedSpatialSplit,
  sourceSnapshotSha256,
  sourceFeatureFileSha256,
  sourceFeatureSetSha256,
  companion
}) {
  const expected = {
    schemaVersion: SPATIAL_FEATURE_DIAGNOSTIC_CACHE_SCHEMA_VERSION,
    cacheKind: SPATIAL_FEATURE_DIAGNOSTIC_CACHE_KIND,
    panel: SPATIAL_FEATURE_DIAGNOSTIC_CACHE_PANEL,
    diagnosticOnly: true,
    sourceSnapshotSha256: normalizeSha256(
      sourceSnapshotSha256,
      "sourceSnapshotSha256"
    ),
    spatialSplitFileSha256: normalizeSha256(
      verifiedSpatialSplit.fileSha256,
      "verifiedSpatialSplit.fileSha256"
    ),
    spatialSplitManifestHash: normalizeSha256(
      verifiedSpatialSplit.manifestHash,
      "verifiedSpatialSplit.manifestHash"
    ),
    sourceFeatureFileSha256: normalizeSha256(
      sourceFeatureFileSha256,
      "sourceFeatureFileSha256"
    ),
    sourceFeatureSetSha256: normalizeSha256(
      sourceFeatureSetSha256,
      "sourceFeatureSetSha256"
    ),
    contractSha256: multiscaleSpatialFeatureContractSha256(),
    companionCacheKind: companion.cacheKind,
    companionCacheFileSha256: companion.fileSha256,
    privacyContract: PRIVACY_CONTRACT
  };
  const mismatches = Object.entries(expected)
    .filter(
      ([key, value]) =>
        canonicalJson(metadata[key]) !== canonicalJson(value)
    )
    .map(([key]) => key);
  const currentGenerationImplementationSha256 =
    spatialFeatureDiagnosticCacheGenerationImplementationSha256();
  const currentImplementation =
    metadata.generationImplementationSha256 ===
    currentGenerationImplementationSha256;
  const frozenImplementation =
    FROZEN_SPATIAL_FEATURE_DIAGNOSTIC_IMPLEMENTATION_BINDINGS.some(
      (binding) =>
        metadata.generationImplementationSha256 ===
          binding.generationImplementationSha256 &&
        metadata.predictionImplementationSha256 ===
          binding.predictionImplementationSha256
    );
  if (!currentImplementation && !frozenImplementation) {
    mismatches.push("generationImplementationSha256");
  }
  if (mismatches.length) {
    throw new SpatialFeatureDiagnosticCacheError(
      "SPATIAL_FEATURE_DIAGNOSTIC_METADATA_MISMATCH",
      "特征诊断缓存绑定信息不匹配。",
      { mismatches }
    );
  }
}

function openSpatialFeatureDiagnosticCache({
  cachePath,
  companionNeighborCachePath,
  verifiedSpatialSplit,
  sourceSnapshotSha256,
  sourceFeatureFileSha256,
  sourceFeatureSetSha256,
  expectedLayout =
    EXPECTED_SPATIAL_FEATURE_DIAGNOSTIC_CACHE_LAYOUT
}) {
  if (
    verifiedSpatialSplit?.panelName !==
      SPATIAL_FEATURE_DIAGNOSTIC_CACHE_PANEL
  ) {
    throw new SpatialFeatureDiagnosticCacheError(
      "SPATIAL_FEATURE_DIAGNOSTIC_DEVELOPMENT_ONLY",
      "特征诊断缓存只能在 development split 下读取。"
    );
  }
  const absolutePath = resolve(cachePath);
  const sidecarPath = `${absolutePath}.sha256`;
  if (!existsSync(absolutePath) || !existsSync(sidecarPath)) {
    throw new SpatialFeatureDiagnosticCacheError(
      "SPATIAL_FEATURE_DIAGNOSTIC_CACHE_MISSING",
      "特征诊断缓存或 SHA sidecar 不存在。"
    );
  }
  const expectedSha256 = String(readFileSync(sidecarPath, "utf8"))
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase();
  const fileSha256 = sha256File(absolutePath);
  if (
    !/^[0-9a-f]{64}$/.test(expectedSha256 || "") ||
    expectedSha256 !== fileSha256
  ) {
    throw new SpatialFeatureDiagnosticCacheError(
      "SPATIAL_FEATURE_DIAGNOSTIC_FILE_HASH_MISMATCH",
      "特征诊断缓存 SHA 校验失败。"
    );
  }
  const companion = readCompanionNeighborCache(
    companionNeighborCachePath,
    {
      sourceSnapshotSha256,
      verifiedSpatialSplit,
      expectedLayout
    }
  );
  const database = new DatabaseSync(absolutePath, { readOnly: true });
  try {
    database.exec("PRAGMA query_only = ON; PRAGMA foreign_keys = ON;");
    validateSchema(database);
    const metadata = parseMetadata(database);
    validateMetadata(metadata, {
      verifiedSpatialSplit,
      sourceSnapshotSha256,
      sourceFeatureFileSha256,
      sourceFeatureSetSha256,
      companion
    });
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
      throw new SpatialFeatureDiagnosticCacheError(
        "SPATIAL_FEATURE_DIAGNOSTIC_INTEGRITY_FAILED",
        "特征诊断缓存读取完整性校验失败。",
        { quickCheck, foreignKeyFailures, freePages }
      );
    }
    const profiles = database.prepare(`
      SELECT profile_index, profile_id, public_cell_count,
             standardized_centroid_json
      FROM profiles
      ORDER BY profile_index
    `).all().map((row) => ({
      profileIndex: Number(row.profile_index),
      profileId: row.profile_id,
      publicCellCount: Number(row.public_cell_count),
      standardizedCentroid: JSON.parse(
        row.standardized_centroid_json
      )
    }));
    const foldSets = database.prepare(`
      SELECT set_id, outer_fold_id, inner_fold_id, context_count,
             companion_score_count
      FROM fold_sets
      ORDER BY set_id
    `).all().map((row) => ({
      setId: Number(row.set_id),
      outerFoldId: String(row.outer_fold_id),
      innerFoldId:
        Number(row.inner_fold_id) === 0
          ? null
          : String(row.inner_fold_id),
      contextCount: Number(row.context_count),
      companionScoreCount: Number(row.companion_score_count)
    }));
    const companionBySetId = new Map(
      companion.foldSets.map((fold) => [fold.setId, fold])
    );
    const foldMismatches = foldSets
      .filter((fold) => {
        const companionFold = companionBySetId.get(fold.setId);
        const storedContextCount = Number(
          database.prepare(
            "SELECT COUNT(*) AS count FROM contexts WHERE set_id = ?"
          ).get(fold.setId).count
        );
        return (
          !companionFold ||
          Number(fold.outerFoldId) !== companionFold.outerFoldId ||
          Number(fold.innerFoldId || 0) !==
            companionFold.innerFoldId ||
          fold.contextCount !== companionFold.contextCount ||
          fold.companionScoreCount !== companionFold.scoreCount ||
          storedContextCount !== fold.contextCount
        );
      })
      .map((fold) => fold.setId);
    const actualLayout = {
      foldSetCount: foldSets.length,
      outerFoldCount: foldSets.filter(
        (fold) => fold.innerFoldId == null
      ).length,
      innerFoldCount: foldSets.filter(
        (fold) => fold.innerFoldId != null
      ).length,
      outerContextRows: foldSets
        .filter((fold) => fold.innerFoldId == null)
        .reduce((sum, fold) => sum + fold.contextCount, 0),
      innerContextRows: foldSets
        .filter((fold) => fold.innerFoldId != null)
        .reduce((sum, fold) => sum + fold.contextCount, 0),
      totalContextRows: foldSets.reduce(
        (sum, fold) => sum + fold.contextCount,
        0
      )
    };
    const metadataLayout = Object.fromEntries(
      Object.keys(
        EXPECTED_SPATIAL_FEATURE_DIAGNOSTIC_CACHE_LAYOUT
      ).map((key) => [key, metadata[key]])
    );
    if (
      foldMismatches.length ||
      canonicalJson(actualLayout) !== canonicalJson(metadataLayout) ||
      profiles.length !== Number(metadata.profileCount) ||
      profiles.reduce(
        (sum, profile) => sum + profile.publicCellCount,
        0
      ) !== Number(metadata.publicCellCount) ||
      profiles.some(
        (profile) =>
          profile.publicCellCount <
            MULTISCALE_SPATIAL_FEATURE_MINIMUM_PUBLIC_CELLS ||
          profile.standardizedCentroid.length !==
            MULTISCALE_SPATIAL_FEATURE_NAMES.length ||
          profile.standardizedCentroid.some(
            (value) => !Number.isFinite(Number(value))
          )
      ) ||
      canonicalJson(metadata.featureNames) !==
        canonicalJson(MULTISCALE_SPATIAL_FEATURE_NAMES) ||
      canonicalJson(metadata.normalization?.featureNames) !==
        canonicalJson(MULTISCALE_SPATIAL_FEATURE_NAMES)
    ) {
      throw new SpatialFeatureDiagnosticCacheError(
        "SPATIAL_FEATURE_DIAGNOSTIC_CONTENT_MISMATCH",
        "特征诊断缓存内容、元数据与配套邻居缓存不一致。",
        { foldMismatches, actualLayout, metadataLayout }
      );
    }
    return {
      path: absolutePath,
      sidecarPath,
      fileSha256,
      metadata,
      profiles,
      foldSets,
      readFoldContexts({ outerFoldId, innerFoldId = null }) {
        const identity = foldSetIdentity({ outerFoldId, innerFoldId });
        const fold = foldSets.find(
          (entry) => entry.setId === identity.setId
        );
        if (!fold) {
          throw new SpatialFeatureDiagnosticCacheError(
            "SPATIAL_FEATURE_DIAGNOSTIC_FOLD_UNKNOWN",
            `未知 fold ${identity.key}。`
          );
        }
        return database.prepare(`
          SELECT contexts.context_index, contexts.season_week,
                 profiles.profile_id, profiles.profile_index
          FROM contexts
          JOIN profiles USING (profile_index)
          WHERE contexts.set_id = ?
          ORDER BY contexts.context_index
        `).all(identity.setId).map((row) => ({
          contextIndex: Number(row.context_index),
          seasonWeek: Number(row.season_week),
          profileId: row.profile_id,
          profileIndex: Number(row.profile_index)
        }));
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

function validateSpatialFeatureDiagnosticPreregistration(
  preregistration,
  {
    sourceSnapshotSha256,
    verifiedSpatialSplit,
    habitatFeatureSet,
    profileModel,
    predictionImplementationSha256,
    cacheGenerationImplementationSha256 =
      spatialFeatureDiagnosticCacheGenerationImplementationSha256(),
    modelOutputPath,
    companionNeighborCachePath,
    companionMode,
    featureCacheOutputPath,
    modelVersion
  }
) {
  const failures = [];
  const same = (left, right) =>
    canonicalJson(left) === canonicalJson(right);
  const serializedProfiles =
    serializableMultiscaleSpatialFeatureProfiles(profileModel);
  const normalizedCompanionMode = String(companionMode || "");
  let companionFileSha256 = null;
  if (normalizedCompanionMode === "existing_read_only") {
    companionFileSha256 = readCompanionNeighborCache(
      companionNeighborCachePath,
      {
        sourceSnapshotSha256,
        verifiedSpatialSplit
      }
    ).fileSha256;
  } else if (normalizedCompanionMode !== "same_run_output") {
    failures.push("companion.mode");
  }
  const expectedCompanion = {
    mode: normalizedCompanionMode,
    cacheKind: NEIGHBOR_POLICY_OOF_CACHE_KIND,
    fileSha256: companionFileSha256,
    immutableReadOnly:
      normalizedCompanionMode === "existing_read_only"
  };
  const expectedProfile = {
    profileModelSha256: serializedProfiles.profileModelSha256,
    publicCellCount: serializedProfiles.publicCellCount,
    featureCount: serializedProfiles.summary.featureCount,
    requestedProfileCount:
      serializedProfiles.summary.requestedProfileCount,
    retainedProfileCount:
      serializedProfiles.summary.retainedProfileCount,
    minimumPublicCellCount:
      serializedProfiles.summary.minimumPublicCellCount,
    maximumPublicCellCount:
      serializedProfiles.summary.maximumPublicCellCount
  };
  if (
    preregistration?.schemaVersion !== 1 ||
    preregistration?.kind !==
      "zhejiang_multiscale_spatial_feature_diagnostic_preregistration_v1"
  ) failures.push("schema");
  if (
    preregistration?.contract?.sha256 !==
      multiscaleSpatialFeatureContractSha256() ||
    !same(
      preregistration?.contract?.value,
      MULTISCALE_SPATIAL_FEATURE_CONTRACT
    )
  ) failures.push("contract");
  if (
    !same(
      preregistration?.expectedLayout,
      EXPECTED_SPATIAL_FEATURE_DIAGNOSTIC_CACHE_LAYOUT
    )
  ) failures.push("expectedLayout");
  if (!same(preregistration?.privacyContract, PRIVACY_CONTRACT)) {
    failures.push("privacyContract");
  }
  if (!same(preregistration?.profileModel, expectedProfile)) {
    failures.push("profileModel");
  }
  const preregisteredCompanion = {
    mode: preregistration?.companion?.mode,
    cacheKind: preregistration?.companion?.cacheKind,
    fileSha256: preregistration?.companion?.fileSha256,
    immutableReadOnly:
      preregistration?.companion?.immutableReadOnly
  };
  if (
    !same(preregisteredCompanion, expectedCompanion) ||
    resolve(preregistration?.companion?.path || "") !==
      resolve(companionNeighborCachePath)
  ) {
    failures.push("companion");
  }
  const inputChecks = {
    sourceSnapshotSha256: normalizeSha256(
      sourceSnapshotSha256,
      "sourceSnapshotSha256"
    ),
    spatialSplitFileSha256: normalizeSha256(
      verifiedSpatialSplit.fileSha256,
      "verifiedSpatialSplit.fileSha256"
    ),
    spatialSplitManifestHash: normalizeSha256(
      verifiedSpatialSplit.manifestHash,
      "verifiedSpatialSplit.manifestHash"
    ),
    featureFileSha256: normalizeSha256(
      habitatFeatureSet.fileSha256,
      "habitatFeatureSet.fileSha256"
    ),
    featureSetSha256: normalizeSha256(
      habitatFeatureSet.featureSetSha256,
      "habitatFeatureSet.featureSetSha256"
    ),
    featureGenerationImplementationSha256: normalizeSha256(
      habitatFeatureSet.generationImplementationSha256,
      "habitatFeatureSet.generationImplementationSha256"
    ),
    tileManifestSha256: normalizeSha256(
      habitatFeatureSet.tileManifestSha256,
      "habitatFeatureSet.tileManifestSha256"
    )
  };
  for (const [key, expected] of Object.entries(inputChecks)) {
    if (preregistration?.inputs?.[key] !== expected) {
      failures.push(`inputs.${key}`);
    }
  }
  const implementationChecks = {
    predictionImplementationSha256: normalizeSha256(
      predictionImplementationSha256,
      "predictionImplementationSha256"
    ),
    multiscaleFeatureGenerationImplementationSha256:
      multiscaleSpatialFeatureGenerationImplementationSha256(),
    cacheGenerationImplementationSha256:
      normalizeSha256(
        cacheGenerationImplementationSha256,
        "cacheGenerationImplementationSha256"
      )
  };
  for (const [key, expected] of Object.entries(implementationChecks)) {
    if (preregistration?.implementation?.[key] !== expected) {
      failures.push(`implementation.${key}`);
    }
  }
  const pathChecks = {
    modelPath: resolve(modelOutputPath),
    featureCachePath: resolve(featureCacheOutputPath)
  };
  for (const [key, expected] of Object.entries(pathChecks)) {
    if (resolve(preregistration?.outputs?.[key] || "") !== expected) {
      failures.push(`outputs.${key}`);
    }
  }
  if (preregistration?.modelVersion !== String(modelVersion || "")) {
    failures.push("modelVersion");
  }
  for (const [key, expected] of Object.entries({
    developmentOnly: true,
    diagnosticOnly: true,
    qualityThresholdsChanged: false,
    sealedDataRead: false,
    defaultModelModified: false,
    referenceMaterializationForbidden: true
  })) {
    if (preregistration?.changeControl?.[key] !== expected) {
      failures.push(`changeControl.${key}`);
    }
  }
  try {
    assertPrivacySafe(preregistration, "preregistration");
  } catch {
    failures.push("privacy");
  }
  if (failures.length) {
    throw new SpatialFeatureDiagnosticCacheError(
      "SPATIAL_FEATURE_DIAGNOSTIC_PREREGISTRATION_MISMATCH",
      "多尺度空间特征诊断预登记与冻结输入或实现不一致。",
      { failures: [...new Set(failures)].sort() }
    );
  }
  return true;
}

module.exports = {
  CACHE_METADATA_KEYS,
  CACHE_TABLE_COLUMNS,
  EXPECTED_SPATIAL_FEATURE_DIAGNOSTIC_CACHE_LAYOUT,
  FROZEN_SPATIAL_FEATURE_DIAGNOSTIC_IMPLEMENTATION_BINDINGS,
  PRIVACY_CONTRACT,
  SPATIAL_FEATURE_DIAGNOSTIC_CACHE_FILES,
  SPATIAL_FEATURE_DIAGNOSTIC_CACHE_KIND,
  SPATIAL_FEATURE_DIAGNOSTIC_CACHE_PANEL,
  SPATIAL_FEATURE_DIAGNOSTIC_CACHE_SCHEMA_VERSION,
  SpatialFeatureDiagnosticCacheError,
  assertPrivacySafe,
  openSpatialFeatureDiagnosticCache,
  spatialFeatureDiagnosticCacheGenerationImplementationSha256,
  validateSpatialFeatureDiagnosticPreregistration,
  writeSpatialFeatureDiagnosticCache
};
