"use strict";

const { createHash } = require("node:crypto");
const {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} = require("node:fs");
const { basename, dirname, resolve } = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const { canonicalJson } = require("./spatial-splits");
const {
  TERRAIN_FEATURE_CONTRACT
} = require("./terrain-features");
const {
  TERRAIN_SPATIAL_EVIDENCE_CONTRACT,
  terrainSpatialEvidenceContractSha256
} = require("./terrain-spatial-evidence");

const TERRAIN_OOF_CACHE_SCHEMA_VERSION = 1;
const TERRAIN_OOF_CACHE_KIND =
  "zhejiang_development_terrain_v11_nested_oof_sufficient_statistics_v1";
const TERRAIN_OOF_CACHE_PANEL = "development";
const EXPECTED_TERRAIN_OOF_LAYOUT = Object.freeze({
  foldSetCount: 25,
  outerFoldCount: 5,
  innerFoldCount: 20
});
const TERRAIN_OOF_CACHE_GENERATION_FILES = Object.freeze([
  "tools/build-zhejiang-prediction-model.js",
  "server/prediction/continuous-habitat.js",
  "server/prediction/habitat-features.js",
  "server/prediction/model.js",
  "server/prediction/spatial-splits.js",
  "server/prediction/spatial-transfer.js",
  "server/prediction/terrain-features.js",
  "server/prediction/terrain-oof-cache.js",
  "server/prediction/terrain-spatial-evidence.js"
]);
const TERRAIN_OOF_PRIVACY_CONTRACT = Object.freeze({
  reportIds: false,
  observers: false,
  coordinates: false,
  exactSpatialIdentifiers: false,
  neighborIdentifiers: false,
  terrainFeatureVectors: false,
  names: false,
  publicTaxonIds:
    "retained_only_for_calibration_scope_and_recall_reconstruction",
  contextIdentity:
    "dense_fold_local_ordinal_without_location_mapping",
  storedEvidence:
    "aggregate_control_and_candidate_exposure_detection_strength_neighbor_count_only"
});

class TerrainOofCacheError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "TerrainOofCacheError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function sha256File(path) {
  return createHash("sha256")
    .update(readFileSync(path))
    .digest("hex");
}

function generationImplementationSha256(
  projectRoot = resolve(__dirname, "..", "..")
) {
  const hash = createHash("sha256");
  for (const relativePath of [
    ...TERRAIN_OOF_CACHE_GENERATION_FILES
  ].sort()) {
    hash.update(relativePath, "utf8");
    hash.update("\0", "utf8");
    hash.update(readFileSync(resolve(projectRoot, relativePath)));
    hash.update("\0", "utf8");
  }
  return hash.digest("hex");
}

function normalizeSha256(value, path) {
  const normalized = String(value || "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new TerrainOofCacheError(
      "TERRAIN_OOF_SHA_INVALID",
      `${path} 必须是 SHA-256。`
    );
  }
  return normalized;
}

function finite(value, path, {
  minimum = -Infinity,
  maximum = Infinity,
  integer = false
} = {}) {
  const number = Number(value);
  if (
    !Number.isFinite(number) ||
    number < minimum ||
    number > maximum ||
    (integer && !Number.isInteger(number))
  ) {
    throw new TerrainOofCacheError(
      "TERRAIN_OOF_VALUE_INVALID",
      `${path} 不是允许范围内的有限数值。`,
      { path, value }
    );
  }
  return number;
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

function normalizedEvidence(value, path) {
  return {
    exposure: finite(value?.exposure, `${path}.exposure`, {
      minimum: 0
    }),
    detections: finite(
      value?.detections,
      `${path}.detections`,
      { minimum: 0 }
    ),
    strength: finite(value?.strength, `${path}.strength`, {
      minimum: 0
    }),
    neighborCount: finite(
      value?.neighborCount,
      `${path}.neighborCount`,
      { minimum: 0, integer: true }
    )
  };
}

function normalizeScoreRow(row, index) {
  const taxonId = String(row?.taxonId || "");
  const deepestLevel = String(row?.deepestLevel || "");
  if (!taxonId || !deepestLevel) {
    throw new TerrainOofCacheError(
      "TERRAIN_OOF_ROW_INVALID",
      `scoreRows[${index}] 缺少 taxonId 或 deepestLevel。`
    );
  }
  const total = finite(row.total, `scoreRows[${index}].total`, {
    minimum: Number.MIN_VALUE
  });
  const actualPositive = finite(
    row.actualPositive,
    `scoreRows[${index}].actualPositive`,
    { minimum: 0, maximum: total }
  );
  return {
    contextIndex: finite(
      row.contextIndex,
      `scoreRows[${index}].contextIndex`,
      { minimum: 0, integer: true }
    ),
    taxonId,
    positiveCount: finite(
      row.positiveCount,
      `scoreRows[${index}].positiveCount`,
      { minimum: 0, integer: true }
    ),
    actualPositive,
    total,
    baselineProbability: finite(
      row.baselineProbability,
      `scoreRows[${index}].baselineProbability`,
      { minimum: 0, maximum: 1 }
    ),
    candidateRawProbability: finite(
      row.rawProbability,
      `scoreRows[${index}].rawProbability`,
      { minimum: 0, maximum: 1 }
    ),
    controlRawProbability: finite(
      row.terrainControlProbability,
      `scoreRows[${index}].terrainControlProbability`,
      { minimum: 0, maximum: 1 }
    ),
    deepestLevel,
    candidateEvidence: normalizedEvidence(
      row.habitatEvidence,
      `scoreRows[${index}].habitatEvidence`
    ),
    controlEvidence: normalizedEvidence(
      row.terrainControlHabitatEvidence,
      `scoreRows[${index}].terrainControlHabitatEvidence`
    )
  };
}

function foldSetsFromFolds(folds) {
  const outerFolds = [...(folds || [])].sort(
    (left, right) => Number(left.foldId) - Number(right.foldId)
  );
  if (
    canonicalJson(outerFolds.map((fold) => Number(fold.foldId))) !==
    canonicalJson([1, 2, 3, 4, 5])
  ) {
    throw new TerrainOofCacheError(
      "TERRAIN_OOF_FOLDS_INCOMPLETE",
      "地形 OOF 缓存必须包含完整的 5 个 development outer 折。"
    );
  }
  const sets = [];
  let setId = 1;
  for (const outer of outerFolds) {
    const outerFoldId = Number(outer.foldId);
    sets.push({
      setId: setId++,
      outerFoldId,
      innerFoldId: 0,
      trainingFoldIds: [1, 2, 3, 4, 5]
        .filter((foldId) => foldId !== outerFoldId),
      evidenceConfiguration: outer.evidenceConfiguration,
      scoreRows: outer.scoreRows
    });
    const innerFolds = [...(outer.innerFolds || [])].sort(
      (left, right) =>
        Number(left.innerFoldId) -
        Number(right.innerFoldId)
    );
    const expectedInnerIds = [1, 2, 3, 4, 5].filter(
      (foldId) => foldId !== outerFoldId
    );
    if (
      canonicalJson(
        innerFolds.map((fold) => Number(fold.innerFoldId))
      ) !== canonicalJson(expectedInnerIds)
    ) {
      throw new TerrainOofCacheError(
        "TERRAIN_OOF_INNER_FOLDS_INCOMPLETE",
        `outer ${outerFoldId} 缺少完整的 4 个 inner 折。`
      );
    }
    for (const inner of innerFolds) {
      sets.push({
        setId: setId++,
        outerFoldId,
        innerFoldId: Number(inner.innerFoldId),
        trainingFoldIds: [...inner.trainingFoldIds]
          .map(Number)
          .sort((left, right) => left - right),
        evidenceConfiguration: inner.evidenceConfiguration,
        scoreRows: inner.scoreRows
      });
    }
  }
  return sets;
}

function createSchema(database) {
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
      inner_fold_id INTEGER NOT NULL CHECK(inner_fold_id BETWEEN 0 AND 5),
      training_fold_ids_json TEXT NOT NULL,
      evidence_configuration_json TEXT NOT NULL,
      score_count INTEGER NOT NULL CHECK(score_count > 0),
      UNIQUE(outer_fold_id, inner_fold_id),
      CHECK(inner_fold_id <> outer_fold_id)
    );
    CREATE TABLE taxa (
      set_id INTEGER NOT NULL REFERENCES fold_sets(set_id),
      taxon_index INTEGER NOT NULL CHECK(taxon_index >= 0),
      taxon_id TEXT NOT NULL,
      positive_count INTEGER NOT NULL CHECK(positive_count >= 0),
      PRIMARY KEY(set_id, taxon_index),
      UNIQUE(set_id, taxon_id)
    ) WITHOUT ROWID;
    CREATE TABLE scores (
      set_id INTEGER NOT NULL,
      context_index INTEGER NOT NULL CHECK(context_index >= 0),
      taxon_index INTEGER NOT NULL,
      actual_positive REAL NOT NULL CHECK(actual_positive >= 0),
      total REAL NOT NULL CHECK(total > 0),
      baseline_probability REAL NOT NULL CHECK(baseline_probability BETWEEN 0 AND 1),
      candidate_raw_probability REAL NOT NULL CHECK(candidate_raw_probability BETWEEN 0 AND 1),
      control_raw_probability REAL NOT NULL CHECK(control_raw_probability BETWEEN 0 AND 1),
      deepest_level TEXT NOT NULL,
      candidate_exposure REAL NOT NULL CHECK(candidate_exposure >= 0),
      candidate_detections REAL NOT NULL CHECK(candidate_detections >= 0),
      candidate_strength REAL NOT NULL CHECK(candidate_strength >= 0),
      candidate_neighbor_count INTEGER NOT NULL CHECK(candidate_neighbor_count >= 0),
      control_exposure REAL NOT NULL CHECK(control_exposure >= 0),
      control_detections REAL NOT NULL CHECK(control_detections >= 0),
      control_strength REAL NOT NULL CHECK(control_strength >= 0),
      control_neighbor_count INTEGER NOT NULL CHECK(control_neighbor_count >= 0),
      PRIMARY KEY(set_id, context_index, taxon_index),
      FOREIGN KEY(set_id, taxon_index)
        REFERENCES taxa(set_id, taxon_index)
    ) WITHOUT ROWID;
  `);
}

function writeTerrainOofCache({
  cachePath,
  folds,
  verifiedSpatialSplit,
  sourceSnapshotSha256,
  habitatFeatures,
  terrainFeatures,
  preregistrationFileSha256,
  controlReportFileSha256,
  generationImplementationSha256: suppliedGenerationSha256,
  predictionImplementationSha256,
  qualityThresholds
}) {
  if (
    verifiedSpatialSplit?.panelName !==
    TERRAIN_OOF_CACHE_PANEL
  ) {
    throw new TerrainOofCacheError(
      "TERRAIN_OOF_DEVELOPMENT_ONLY",
      "地形 OOF 缓存只能写入 development 面板。"
    );
  }
  const currentGenerationSha256 =
    generationImplementationSha256();
  if (
    suppliedGenerationSha256 !==
    currentGenerationSha256
  ) {
    throw new TerrainOofCacheError(
      "TERRAIN_OOF_GENERATOR_MISMATCH",
      "地形 OOF 缓存生成器 SHA 不匹配。"
    );
  }
  const snapshotSha256 = normalizeSha256(
    sourceSnapshotSha256,
    "sourceSnapshotSha256"
  );
  if (
    snapshotSha256 !==
    String(
      verifiedSpatialSplit.manifest
        ?.sourceSnapshotSha256 || ""
    ).toLowerCase()
  ) {
    throw new TerrainOofCacheError(
      "TERRAIN_OOF_SNAPSHOT_MISMATCH",
      "快照与冻结空间 split 不一致。"
    );
  }
  if (
    terrainFeatures?.contractId !==
      TERRAIN_FEATURE_CONTRACT.id ||
    terrainFeatures?.cellCatalogFileSha256 !==
      habitatFeatures?.fileSha256 ||
    terrainFeatures
      ?.cellCatalogFeatureSetSha256 !==
      habitatFeatures?.featureSetSha256
  ) {
    throw new TerrainOofCacheError(
      "TERRAIN_OOF_FEATURE_BINDING_INVALID",
      "地形特征未绑定到同一份冻结 WorldCover H3 r6 目录。"
    );
  }
  const absolutePath = resolve(cachePath);
  const sidecarPath = `${absolutePath}.sha256`;
  if (existsSync(absolutePath) || existsSync(sidecarPath)) {
    throw new TerrainOofCacheError(
      "TERRAIN_OOF_OUTPUT_EXISTS",
      "地形 OOF 缓存或 SHA sidecar 已存在。",
      { cachePath: absolutePath }
    );
  }
  const sets = foldSetsFromFolds(folds);
  const temporaryPath =
    `${absolutePath}.building-${process.pid}`;
  const temporarySidecar =
    `${sidecarPath}.building-${process.pid}`;
  safeUnlink(temporaryPath);
  safeUnlink(temporarySidecar);
  mkdirSync(dirname(absolutePath), { recursive: true });
  const database = new DatabaseSync(temporaryPath);
  let databaseClosed = false;
  try {
    createSchema(database);
    const metadata = {
      schemaVersion: TERRAIN_OOF_CACHE_SCHEMA_VERSION,
      cacheKind: TERRAIN_OOF_CACHE_KIND,
      panel: TERRAIN_OOF_CACHE_PANEL,
      diagnosticOnly: true,
      publishEligible: false,
      sealedPanelViewed: false,
      sourceSnapshotSha256: snapshotSha256,
      spatialSplitFileSha256:
        verifiedSpatialSplit.fileSha256,
      spatialSplitManifestHash:
        verifiedSpatialSplit.manifestHash,
      habitatFeatureFileSha256:
        habitatFeatures.fileSha256,
      habitatFeatureSetSha256:
        habitatFeatures.featureSetSha256,
      terrainFeatureFileSha256:
        terrainFeatures.fileSha256,
      terrainFeatureSetSha256:
        terrainFeatures.featureSetSha256,
      terrainTileManifestSha256:
        terrainFeatures.tileManifestSha256,
      terrainFeatureContractId:
        TERRAIN_FEATURE_CONTRACT.id,
      terrainSpatialEvidenceContract:
        TERRAIN_SPATIAL_EVIDENCE_CONTRACT,
      terrainSpatialEvidenceContractSha256:
        terrainSpatialEvidenceContractSha256(),
      preregistrationFileSha256: normalizeSha256(
        preregistrationFileSha256,
        "preregistrationFileSha256"
      ),
      controlReportFileSha256: normalizeSha256(
        controlReportFileSha256,
        "controlReportFileSha256"
      ),
      generationImplementationSha256:
        currentGenerationSha256,
      predictionImplementationSha256:
        normalizeSha256(
          predictionImplementationSha256,
          "predictionImplementationSha256"
        ),
      qualityThresholds,
      privacyContract: TERRAIN_OOF_PRIVACY_CONTRACT,
      ...EXPECTED_TERRAIN_OOF_LAYOUT,
      scoreCount: sets.reduce(
        (sum, set) => sum + set.scoreRows.length,
        0
      )
    };
    const insertMetadata = database.prepare(
      "INSERT INTO metadata(key, value) VALUES (?, ?)"
    );
    const insertFold = database.prepare(`
      INSERT INTO fold_sets
        (set_id, outer_fold_id, inner_fold_id,
         training_fold_ids_json,
         evidence_configuration_json, score_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertTaxon = database.prepare(`
      INSERT INTO taxa
        (set_id, taxon_index, taxon_id, positive_count)
      VALUES (?, ?, ?, ?)
    `);
    const insertScore = database.prepare(`
      INSERT INTO scores
        (set_id, context_index, taxon_index,
         actual_positive, total, baseline_probability,
         candidate_raw_probability,
         control_raw_probability, deepest_level,
         candidate_exposure, candidate_detections,
         candidate_strength, candidate_neighbor_count,
         control_exposure, control_detections,
         control_strength, control_neighbor_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    database.exec("BEGIN");
    try {
      for (const [key, value] of Object.entries(metadata).sort()) {
        insertMetadata.run(key, canonicalJson(value));
      }
      for (const set of sets) {
        const rows = set.scoreRows.map(normalizeScoreRow);
        if (!rows.length) {
          throw new TerrainOofCacheError(
            "TERRAIN_OOF_SET_EMPTY",
            `fold set ${set.setId} 没有评分行。`
          );
        }
        insertFold.run(
          set.setId,
          set.outerFoldId,
          set.innerFoldId,
          canonicalJson(set.trainingFoldIds),
          canonicalJson(set.evidenceConfiguration),
          rows.length
        );
        const taxa = [
          ...new Map(
            rows.map((row) => [
              row.taxonId,
              row.positiveCount
            ])
          )
        ].sort((left, right) =>
          left[0].localeCompare(right[0])
        );
        const taxonIndex = new Map();
        taxa.forEach(([taxonId, positiveCount], index) => {
          taxonIndex.set(taxonId, index);
          insertTaxon.run(
            set.setId,
            index,
            taxonId,
            positiveCount
          );
        });
        for (const row of rows) {
          insertScore.run(
            set.setId,
            row.contextIndex,
            taxonIndex.get(row.taxonId),
            row.actualPositive,
            row.total,
            row.baselineProbability,
            row.candidateRawProbability,
            row.controlRawProbability,
            row.deepestLevel,
            row.candidateEvidence.exposure,
            row.candidateEvidence.detections,
            row.candidateEvidence.strength,
            row.candidateEvidence.neighborCount,
            row.controlEvidence.exposure,
            row.controlEvidence.detections,
            row.controlEvidence.strength,
            row.controlEvidence.neighborCount
          );
        }
      }
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
    const integrity = database.prepare(
      "PRAGMA integrity_check"
    ).get().integrity_check;
    const foldSetCount = Number(
      database.prepare(
        "SELECT COUNT(*) AS count FROM fold_sets"
      ).get().count
    );
    const innerFoldCount = Number(
      database.prepare(
        "SELECT COUNT(*) AS count FROM fold_sets WHERE inner_fold_id <> 0"
      ).get().count
    );
    if (
      integrity !== "ok" ||
      foldSetCount !==
        EXPECTED_TERRAIN_OOF_LAYOUT.foldSetCount ||
      innerFoldCount !==
        EXPECTED_TERRAIN_OOF_LAYOUT.innerFoldCount
    ) {
      throw new TerrainOofCacheError(
        "TERRAIN_OOF_LAYOUT_INVALID",
        "地形 OOF 缓存未包含完整的 5 outer + 20 inner。",
        { integrity, foldSetCount, innerFoldCount }
      );
    }
    database.exec("PRAGMA optimize");
    database.close();
    databaseClosed = true;
    const fileSha256 = sha256File(temporaryPath);
    writeFileSync(
      temporarySidecar,
      `${fileSha256}  ${basename(absolutePath)}\n`,
      "utf8"
    );
    let outputPublished = false;
    let sidecarPublished = false;
    try {
      renameSync(temporaryPath, absolutePath);
      outputPublished = true;
      renameSync(temporarySidecar, sidecarPath);
      sidecarPublished = true;
    } catch (error) {
      if (sidecarPublished) safeUnlink(sidecarPath);
      if (outputPublished) safeUnlink(absolutePath);
      throw error;
    }
    try {
      chmodSync(absolutePath, 0o444);
      chmodSync(sidecarPath, 0o444);
    } catch {
      // Windows ACLs may ignore POSIX mode bits.
    }
    return {
      cachePath: absolutePath,
      sidecarPath,
      fileSha256,
      foldSetCount,
      outerFoldCount:
        EXPECTED_TERRAIN_OOF_LAYOUT.outerFoldCount,
      innerFoldCount,
      scoreCount: metadata.scoreCount,
      diagnosticOnly: true,
      sealedPanelViewed: false,
      publishEligible: false
    };
  } catch (error) {
    if (!databaseClosed) {
      try {
        database.close();
      } catch {
        // Preserve the original failure.
      }
    }
    safeUnlink(temporaryPath);
    safeUnlink(temporarySidecar);
    throw error;
  }
}

function openTerrainOofCache({
  cachePath,
  expectedSnapshotSha256 = null,
  expectedSpatialSplitFileSha256 = null,
  expectedTerrainFeatureFileSha256 = null
}) {
  const absolutePath = resolve(cachePath);
  const fileSha256 = sha256File(absolutePath);
  const sidecar = readFileSync(
    `${absolutePath}.sha256`,
    "utf8"
  ).trim().split(/\s+/)[0]?.toLowerCase();
  if (sidecar !== fileSha256) {
    throw new TerrainOofCacheError(
      "TERRAIN_OOF_FILE_SHA_MISMATCH",
      "地形 OOF 缓存 SHA sidecar 不匹配。"
    );
  }
  const database = new DatabaseSync(absolutePath, {
    readOnly: true
  });
  database.exec("PRAGMA query_only = ON");
  try {
    const metadata = Object.fromEntries(
      database.prepare(
        "SELECT key, value FROM metadata ORDER BY key"
      ).all().map((row) => [row.key, JSON.parse(row.value)])
    );
    const mismatches = [];
    if (metadata.cacheKind !== TERRAIN_OOF_CACHE_KIND) {
      mismatches.push("cacheKind");
    }
    if (
      metadata.foldSetCount !==
      EXPECTED_TERRAIN_OOF_LAYOUT.foldSetCount
    ) mismatches.push("foldSetCount");
    if (
      expectedSnapshotSha256 &&
      metadata.sourceSnapshotSha256 !==
        String(expectedSnapshotSha256).toLowerCase()
    ) mismatches.push("sourceSnapshotSha256");
    if (
      expectedSpatialSplitFileSha256 &&
      metadata.spatialSplitFileSha256 !==
        String(expectedSpatialSplitFileSha256).toLowerCase()
    ) mismatches.push("spatialSplitFileSha256");
    if (
      expectedTerrainFeatureFileSha256 &&
      metadata.terrainFeatureFileSha256 !==
        String(
          expectedTerrainFeatureFileSha256
        ).toLowerCase()
    ) mismatches.push("terrainFeatureFileSha256");
    if (mismatches.length) {
      throw new TerrainOofCacheError(
        "TERRAIN_OOF_BINDING_MISMATCH",
        "地形 OOF 缓存绑定不匹配。",
        { mismatches }
      );
    }
    return {
      path: absolutePath,
      fileSha256,
      metadata,
      database,
      close: () => database.close()
    };
  } catch (error) {
    database.close();
    throw error;
  }
}

function readTerrainOofRows(cache, {
  outerOnly = false,
  channel = "candidate"
} = {}) {
  if (!["candidate", "control"].includes(channel)) {
    throw new TerrainOofCacheError(
      "TERRAIN_OOF_CHANNEL_INVALID",
      "channel 必须是 candidate 或 control。"
    );
  }
  const probabilityColumn =
    channel === "candidate"
      ? "candidate_raw_probability"
      : "control_raw_probability";
  const rows = cache.database.prepare(`
    SELECT fold_sets.outer_fold_id,
           fold_sets.inner_fold_id,
           scores.context_index, taxa.taxon_id,
           taxa.positive_count, scores.actual_positive,
           scores.total, scores.baseline_probability,
           scores.${probabilityColumn} AS raw_probability,
           scores.deepest_level
    FROM scores
    JOIN fold_sets USING (set_id)
    JOIN taxa USING (set_id, taxon_index)
    ${outerOnly ? "WHERE fold_sets.inner_fold_id = 0" : ""}
    ORDER BY fold_sets.outer_fold_id,
             fold_sets.inner_fold_id,
             scores.context_index, taxa.taxon_id
  `).all();
  return rows.map((row) => ({
    outerFoldId: Number(row.outer_fold_id),
    innerFoldId: Number(row.inner_fold_id),
    contextIndex: Number(row.context_index),
    taxonId: String(row.taxon_id),
    positiveCount: Number(row.positive_count),
    actualPositive: Number(row.actual_positive),
    total: Number(row.total),
    baselineProbability: Number(row.baseline_probability),
    rawProbability: Number(row.raw_probability),
    deepestLevel: String(row.deepest_level)
  }));
}

module.exports = {
  EXPECTED_TERRAIN_OOF_LAYOUT,
  TERRAIN_OOF_CACHE_GENERATION_FILES,
  TERRAIN_OOF_CACHE_KIND,
  TERRAIN_OOF_CACHE_PANEL,
  TERRAIN_OOF_CACHE_SCHEMA_VERSION,
  TERRAIN_OOF_PRIVACY_CONTRACT,
  TerrainOofCacheError,
  generationImplementationSha256,
  openTerrainOofCache,
  readTerrainOofRows,
  writeTerrainOofCache
};
