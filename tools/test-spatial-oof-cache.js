"use strict";

const assert = require("node:assert/strict");
const {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  unlinkSync,
  writeFileSync
} = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");

const {
  DEVELOPMENT_POOL_POSITIVE_COUNT_POLICY,
  SpatialOofCacheError,
  loadSpatialOofCache,
  sha256File,
  spatialOofCacheGenerationImplementationSha256,
  writeSpatialOofCache
} = require("../server/prediction/spatial-oof-cache");
const {
  baselineProbabilityFromAdminEvidence,
  evaluateCandidateRows,
  probabilityFromAdminEvidence
} = require("../server/prediction/spatial-candidate-scorer");
const { FROZEN_NOVEL_GRID_ADMIN_EXPOSURE_CAPS_V1 } = require("../server/prediction/spatial-transfer");
const { prevalenceGroup } = require("../server/prediction/model");
const { LOCATION_NORMALIZATION_VERSION } = require("../server/prediction/location-normalization");

const SNAPSHOT_SHA = "a".repeat(64);
const SPLIT_SHA = "b".repeat(64);
const MANIFEST_SHA = "c".repeat(64);

function testDirectory(name) {
  return mkdtempSync(join(tmpdir(), `beaubird-${name}-`));
}

function cleanupDirectory(directory) {
  if (!existsSync(directory)) return;
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    try {
      chmodSync(path, 0o666);
    } catch {
      // Windows ACLs may ignore POSIX mode bits.
    }
    unlinkSync(path);
  }
  rmdirSync(directory);
}

function verifiedSplit(panelName = "development") {
  return {
    panelName,
    fileSha256: SPLIT_SHA,
    manifestHash: MANIFEST_SHA,
    manifest: { sourceSnapshotSha256: SNAPSHOT_SHA },
    panel: {
      folds: Array.from({ length: 5 }, (_, index) => ({ foldId: index + 1 }))
    }
  };
}

function scoreRow({ foldId, contextIndex, taxonId, positiveCount, taxonIndex }) {
  const total = 10 + contextIndex;
  const adminEvidence = {
    province: {
      exposure: 100 + contextIndex * 10,
      detections: 5 + taxonIndex * 3 + contextIndex,
      strength: 0
    },
    city: {
      exposure: 300 + contextIndex * 20,
      detections: 20 + taxonIndex * 30 + contextIndex,
      strength: positiveCount >= 200 ? 24 : 30
    },
    district: {
      exposure: 120 + contextIndex * 10,
      detections: 8 + taxonIndex * 10 + contextIndex,
      strength: positiveCount >= 200 ? 18 : 22
    }
  };
  const flat = {
    contextIndex,
    taxonId,
    positiveCount,
    actualPositive: Math.min(total, (foldId + contextIndex + taxonIndex) % 5),
    total,
    rawProbability: 0,
    baselineProbability: 0,
    deepestLevel: "district",
    hasSupportedLocalUnit: false,
    provinceExposure: adminEvidence.province.exposure,
    provinceDetections: adminEvidence.province.detections,
    cityExposure: adminEvidence.city.exposure,
    cityDetections: adminEvidence.city.detections,
    cityStrength: adminEvidence.city.strength,
    districtExposure: adminEvidence.district.exposure,
    districtDetections: adminEvidence.district.detections,
    districtStrength: adminEvidence.district.strength
  };
  const caps = FROZEN_NOVEL_GRID_ADMIN_EXPOSURE_CAPS_V1[prevalenceGroup(positiveCount)];
  flat.rawProbability = probabilityFromAdminEvidence(flat, caps);
  flat.baselineProbability = baselineProbabilityFromAdminEvidence(flat);
  return {
    contextIndex,
    taxonId,
    positiveCount,
    actualPositive: flat.actualPositive,
    total,
    rawProbability: flat.rawProbability,
    baselineProbability: flat.baselineProbability,
    deepestLevel: "district",
    hasSupportedLocalUnit: false,
    adminEvidence
  };
}

function fixtureFolds() {
  const taxa = [
    { taxonId: "common-a", positiveCount: 300 },
    { taxonId: "group-b", positiveCount: 100 },
    { taxonId: "group-c", positiveCount: 50 }
  ];
  const priorStrengthsByPrevalence = Object.fromEntries(
    ["city", "district", "grid_r6", "grid_r7", "point"].map((level, levelIndex) => [
      level,
      Object.fromEntries(
        ["rare_under_30", "group_30_79", "group_80_199", "species_200_plus"]
          .map((group, groupIndex) => [group, 8 + levelIndex * 3 + groupIndex])
      )
    ])
  );
  const folds = Array.from({ length: 5 }, (_, foldIndex) => {
    const scoreRows = Array.from({ length: 2 }, (_, contextIndex) =>
      taxa.map((taxon, taxonIndex) => scoreRow({
        foldId: foldIndex + 1,
        contextIndex,
        taxonId: taxon.taxonId,
        positiveCount: taxon.positiveCount,
        taxonIndex
      }))
    ).flat();
    return {
      foldId: String(foldIndex + 1),
      evidenceConfiguration: {
        bandwidthDays: 14,
        calibrationContextSampleModulo: 10,
        calibrationFitYears: [2023, 2024],
        calibrationGuardYear: 2025,
        hyperparameterSelectionYears: [2023, 2024],
        priorStrengthsByPrevalence,
        validationYears: [2023, 2024, 2025]
      },
      referenceRawMetrics: evaluateCandidateRows(scoreRows.map((row) => ({
        foldId: String(foldIndex + 1),
        row,
        probability: row.rawProbability
      }))),
      scoreRows
    };
  });
  for (const outerFold of folds) {
    const outerFoldId = Number(outerFold.foldId);
    outerFold.innerFolds = folds
      .filter((candidate) => candidate !== outerFold)
      .map((innerTarget) => {
        const innerFoldId = Number(innerTarget.foldId);
        const innerRows = Array.from({ length: 2 }, (_, contextIndex) =>
          taxa.map((taxon, taxonIndex) => scoreRow({
            foldId: outerFoldId * 10 + innerFoldId,
            contextIndex,
            taxonId: taxon.taxonId,
            positiveCount: Math.max(0, taxon.positiveCount - 10),
            taxonIndex
          }))
        ).flat();
        return {
          innerFoldId: String(innerFoldId),
          trainingFoldIds: folds
            .map((fold) => Number(fold.foldId))
            .filter((foldId) => foldId !== outerFoldId && foldId !== innerFoldId),
          evidenceConfiguration: structuredClone(outerFold.evidenceConfiguration),
          referenceRawMetrics: evaluateCandidateRows(innerRows.map((row) => ({
            foldId: `${outerFoldId}:${innerFoldId}`,
            row,
            probability: row.rawProbability
          }))),
          scoreRows: innerRows
        };
      });
  }
  return folds;
}

function fixtureEvidenceOptions() {
  return {
    applyOnlyWithoutSupportedLocalUnit: true,
    bandwidthCandidates: [7, 14, 21, 28],
    captureAdminEvidence: true,
    coordinateQcEvaluationScope: "fixed_snapshot_coordinate_qc_target_independent_not_refit_per_fold",
    dataCutoffDate: "2026-07-15",
    holdoutEvaluation: {
      minimumTaxonPositives: 30,
      observerFoldCount: 3,
      priorTuningMaximumFolds: 2,
      spatialMaximumFolds: 3,
      spatialMinimumChecklists: 30,
      spatialMinimumObservers: 10
    },
    includeFlaggedCleanReports: true,
    levels: ["province", "city", "district"],
    localHistoryYears: 5,
    locationAliasMapSha256: "e".repeat(64),
    locationNormalizationAuditSha256: "f".repeat(64),
    locationNormalizationVersion: LOCATION_NORMALIZATION_VERSION,
    outerCalibrationContextSampleModulo: 10,
    outerPriorTuningContextSampleModulo: 20,
    pointDriftMeters: 2000,
    priorStrengthMultipliers: [0.5, 1, 2],
    priorStrengths: { city: 24, district: 18, grid_r6: 14, grid_r7: 10, point: 8 },
    priorTuningContextSampleModulo: 10,
    recencyHalfLifeYears: 3,
    releaseEvaluationOccurrencePolicy: "raw_detections_all_taxa_without_full_data_event_filter",
    temporalEvaluationWeightingPolicy: "fold_cutoff_half_life_training_and_group_capped_unweighted_validation",
    trainingDataContract: "beaubird-unified-quality-filter-v2",
    unitThresholds: {
      province: { checklists: 1, observers: 1 },
      city: { checklists: 10, observers: 3 },
      district: { checklists: 10, observers: 3 },
      grid_r6: { checklists: 20, observers: 5 },
      grid_r7: { checklists: 30, observers: 10 },
      point: { checklists: 50, observers: 15 }
    },
    workerTaskChunkRecords: 4096
  };
}

function writeFixture(cachePath, overrides = {}) {
  return writeSpatialOofCache({
    cachePath,
    folds: fixtureFolds(),
    verifiedSpatialSplit: verifiedSplit(),
    sourceSnapshotSha256: SNAPSHOT_SHA,
    generationImplementationSha256: spatialOofCacheGenerationImplementationSha256(),
    predictionImplementationSha256: "d".repeat(64),
    baseAdminExposureCapsByPrevalence: FROZEN_NOVEL_GRID_ADMIN_EXPOSURE_CAPS_V1,
    qualityThresholds: {
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
      minimumReverseNdcgLift: 0.05,
      maximumRelativeBrierDegradation: 0.01,
      maximumEceDegradation: 0.01
    },
    evidenceOptions: fixtureEvidenceOptions(),
    developmentPoolPositiveCounts: new Map([
      ["common-a", 320],
      ["group-b", 120],
      ["group-c", 70]
    ]),
    ...overrides
  });
}

test("development OOF 缓存规范化往返且不含身份或精确空间字段", () => {
  const directory = testDirectory("spatial-oof-roundtrip");
  try {
    const cachePath = join(directory, "cache.sqlite");
    const written = writeFixture(cachePath);
    assert.equal(written.foldCount, 5);
    assert.equal(written.innerFoldCount, 20);
    assert.equal(written.outerRowCount, 30);
    assert.equal(written.innerRowCount, 120);
    assert.equal(written.rowCount, 150);
    assert.equal(written.diagnosticOnly, true);
    assert.equal(existsSync(`${cachePath}.sha256`), true);
    const loaded = loadSpatialOofCache({
      cachePath,
      verifiedSpatialSplit: verifiedSplit(),
      sourceSnapshotSha256: SNAPSHOT_SHA
    });
    assert.equal(loaded.metadata.panel, "development");
    assert.equal(loaded.metadata.schemaVersion, 3);
    assert.equal(loaded.metadata.evidenceOptions.locationNormalizationVersion, LOCATION_NORMALIZATION_VERSION);
    assert.equal(loaded.metadata.evidenceOptions.locationAliasMapSha256, "e".repeat(64));
    assert.equal(loaded.metadata.evidenceOptions.locationNormalizationAuditSha256, "f".repeat(64));
    assert.equal(
      loaded.metadata.developmentPoolPositiveCountPolicy,
      DEVELOPMENT_POOL_POSITIVE_COUNT_POLICY
    );
    assert.equal(loaded.metadata.outerRowCount, 30);
    assert.equal(loaded.metadata.innerRowCount, 120);
    assert.equal(loaded.metadata.rowCount, 150);
    assert.deepEqual(loaded.folds.map((fold) => fold.foldId), ["1", "2", "3", "4", "5"]);
    assert.equal(loaded.folds.every((fold) => fold.scoreRows.length === 6), true);
    assert.equal(loaded.folds.every((fold) => fold.innerFolds.length === 4), true);
    for (const fold of loaded.folds) {
      for (const innerFold of fold.innerFolds) {
        assert.equal(innerFold.innerFoldId === fold.foldId, false);
        assert.deepEqual(
          innerFold.trainingFoldIds,
          ["1", "2", "3", "4", "5"].filter(
            (foldId) => foldId !== fold.foldId && foldId !== innerFold.innerFoldId
          )
        );
        assert.equal(innerFold.scoreRows.length, 6);
        assert.equal(innerFold.scoreRows.every((row) => row.positiveCount <= row.outerPositiveCount), true);
      }
    }
    assert.equal(
      loaded.folds[0].scoreRows.find((row) => row.taxonId === "common-a").developmentPositiveCount,
      320
    );
    const database = new DatabaseSync(cachePath, { readOnly: true });
    assert.equal(database.prepare("PRAGMA quick_check").get().quick_check, "ok");
    assert.equal(Number(database.prepare("PRAGMA freelist_count").get().freelist_count), 0);
    const schema = database.prepare("SELECT sql FROM sqlite_schema WHERE sql IS NOT NULL").all()
      .map((row) => row.sql).join("\n").toLowerCase();
    database.close();
    for (const forbidden of [
      "report_id",
      "observer_hash",
      "longitude",
      "latitude",
      "city_unit",
      "district_unit",
      "grid_r6_unit",
      "grid_r7_unit",
      "point_unit"
    ]) assert.equal(schema.includes(forbidden), false, forbidden);
  } finally {
    cleanupDirectory(directory);
  }
});

test("sealed 面板在创建缓存文件前 fail closed", () => {
  const directory = testDirectory("spatial-oof-sealed");
  try {
    const cachePath = join(directory, "cache.sqlite");
    assert.throws(
      () => writeFixture(cachePath, { verifiedSpatialSplit: verifiedSplit("sealed-release") }),
      (error) => error instanceof SpatialOofCacheError && error.code === "SPATIAL_OOF_CACHE_DEVELOPMENT_ONLY"
    );
    assert.equal(existsSync(cachePath), false);
    assert.equal(existsSync(`${cachePath}.sha256`), false);
  } finally {
    cleanupDirectory(directory);
  }
});

test("缓存 writer 拒绝 scoreRows 隐私白名单之外的字段", () => {
  const directory = testDirectory("spatial-oof-privacy");
  try {
    const cachePath = join(directory, "cache.sqlite");
    const folds = fixtureFolds();
    folds[0].scoreRows[0].reportId = "private-report";
    assert.throws(
      () => writeFixture(cachePath, { folds }),
      (error) => error instanceof SpatialOofCacheError && error.code === "SPATIAL_OOF_CACHE_PRIVACY_VIOLATION"
    );
    assert.equal(existsSync(cachePath), false);
  } finally {
    cleanupDirectory(directory);
  }
});

test("cache v3 拒绝 inner scoreRows 私密字段和不完整 outer×inner 折", () => {
  const directory = testDirectory("spatial-oof-inner-contract");
  try {
    const privatePath = join(directory, "private.sqlite");
    const privateFolds = fixtureFolds();
    privateFolds[0].innerFolds[0].scoreRows[0].observerHash = "private-observer";
    assert.throws(
      () => writeFixture(privatePath, { folds: privateFolds }),
      (error) => error instanceof SpatialOofCacheError && error.code === "SPATIAL_OOF_CACHE_PRIVACY_VIOLATION"
    );
    assert.equal(existsSync(privatePath), false);

    const incompletePath = join(directory, "incomplete.sqlite");
    const incompleteFolds = fixtureFolds();
    incompleteFolds[0].innerFolds.pop();
    assert.throws(
      () => writeFixture(incompletePath, { folds: incompleteFolds }),
      (error) => error instanceof SpatialOofCacheError && error.code === "SPATIAL_OOF_CACHE_INNER_FOLDS_INVALID"
    );
    assert.equal(existsSync(incompletePath), false);

    const leakedTrainingPath = join(directory, "leaked-training.sqlite");
    const leakedTrainingFolds = fixtureFolds();
    leakedTrainingFolds[0].innerFolds[0].trainingFoldIds.push(Number(leakedTrainingFolds[0].foldId));
    assert.throws(
      () => writeFixture(leakedTrainingPath, { folds: leakedTrainingFolds }),
      (error) => error instanceof SpatialOofCacheError && error.code === "SPATIAL_OOF_CACHE_INNER_FOLDS_INVALID"
    );
    assert.equal(existsSync(leakedTrainingPath), false);
  } finally {
    cleanupDirectory(directory);
  }
});

test("缓存 writer 深层拒绝身份字段、放宽门槛与非固定分块", () => {
  const directory = testDirectory("spatial-oof-deep-privacy");
  try {
    const cases = [
      {
        evidenceOptions: {
          ...fixtureEvidenceOptions(),
          holdoutEvaluation: {
            ...fixtureEvidenceOptions().holdoutEvaluation,
            reportId: "private-report"
          }
        }
      },
      {
        evidenceOptions: {
          ...fixtureEvidenceOptions(),
          trainingDataContract: "private-report-123"
        }
      },
      {
        qualityThresholds: {
          maximumEce: 0.1,
          maximumEceDegradation: 0.01,
          maximumGroupEce: 0.1,
          maximumRelativeBrierDegradation: 0.01,
          maximumSpeciesEce: 0.9,
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
        }
      },
      {
        evidenceOptions: {
          ...fixtureEvidenceOptions(),
          workerTaskChunkRecords: 4097
        }
      }
    ];
    for (const [index, overrides] of cases.entries()) {
      const cachePath = join(directory, `cache-${index}.sqlite`);
      assert.throws(
        () => writeFixture(cachePath, overrides),
        (error) => error instanceof SpatialOofCacheError
      );
      assert.equal(existsSync(cachePath), false);
      assert.equal(existsSync(`${cachePath}.sha256`), false);
    }
  } finally {
    cleanupDirectory(directory);
  }
});

test("即使重写文件 sidecar，未知表仍被严格 schema 白名单拒绝", () => {
  const directory = testDirectory("spatial-oof-schema-tamper");
  try {
    const cachePath = join(directory, "cache.sqlite");
    writeFixture(cachePath);
    try {
      chmodSync(cachePath, 0o666);
    } catch {
      // Windows ACLs may ignore POSIX mode bits.
    }
    const database = new DatabaseSync(cachePath);
    database.exec("CREATE TABLE leaked(report_id TEXT)");
    database.close();
    const fileSha256 = sha256File(cachePath);
    writeFileSync(`${cachePath}.sha256`, `${fileSha256}  cache.sqlite\n`, "utf8");
    assert.throws(
      () => loadSpatialOofCache({
        cachePath,
        verifiedSpatialSplit: verifiedSplit(),
        sourceSnapshotSha256: SNAPSHOT_SHA
      }),
      (error) => error instanceof SpatialOofCacheError && error.code === "SPATIAL_OOF_CACHE_SCHEMA_INVALID"
    );
  } finally {
    cleanupDirectory(directory);
  }
});

test("即使重写文件 sidecar，VIEW 与嵌套 metadata 篡改仍被拒绝", () => {
  const directory = testDirectory("spatial-oof-deep-tamper");
  try {
    const viewPath = join(directory, "view.sqlite");
    writeFixture(viewPath);
    try {
      chmodSync(viewPath, 0o666);
    } catch {
      // Windows ACLs may ignore POSIX mode bits.
    }
    let database = new DatabaseSync(viewPath);
    database.exec("CREATE VIEW leaked_identity AS SELECT 'private-report' AS observer_id");
    database.close();
    writeFileSync(`${viewPath}.sha256`, `${sha256File(viewPath)}  view.sqlite\n`, "utf8");
    assert.throws(
      () => loadSpatialOofCache({
        cachePath: viewPath,
        verifiedSpatialSplit: verifiedSplit(),
        sourceSnapshotSha256: SNAPSHOT_SHA
      }),
      (error) => error instanceof SpatialOofCacheError && error.code === "SPATIAL_OOF_CACHE_SCHEMA_INVALID"
    );

    const metadataPath = join(directory, "metadata.sqlite");
    writeFixture(metadataPath);
    try {
      chmodSync(metadataPath, 0o666);
    } catch {
      // Windows ACLs may ignore POSIX mode bits.
    }
    database = new DatabaseSync(metadataPath);
    const evidenceOptions = JSON.parse(
      database.prepare("SELECT value FROM metadata WHERE key='evidenceOptions'").get().value
    );
    evidenceOptions.trainingDataContract = "private-report-123";
    database.prepare("UPDATE metadata SET value=? WHERE key='evidenceOptions'")
      .run(JSON.stringify(evidenceOptions));
    database.close();
    writeFileSync(`${metadataPath}.sha256`, `${sha256File(metadataPath)}  metadata.sqlite\n`, "utf8");
    assert.throws(
      () => loadSpatialOofCache({
        cachePath: metadataPath,
        verifiedSpatialSplit: verifiedSplit(),
        sourceSnapshotSha256: SNAPSHOT_SHA
      }),
      (error) => error instanceof SpatialOofCacheError && error.code === "SPATIAL_OOF_CACHE_PRIVACY_VIOLATION"
    );

  } finally {
    cleanupDirectory(directory);
  }
});

test("sqlite_stat1 与含私密残留的 freelist 即使重写 sidecar 也被拒绝", () => {
  const directory = testDirectory("spatial-oof-hidden-storage");
  try {
    const statPath = join(directory, "stat.sqlite");
    writeFixture(statPath);
    try {
      chmodSync(statPath, 0o666);
    } catch {
      // Windows ACLs may ignore POSIX mode bits.
    }
    let database = new DatabaseSync(statPath);
    database.exec("ANALYZE");
    database.prepare("UPDATE sqlite_stat1 SET stat=?").run("private-report");
    database.close();
    writeFileSync(`${statPath}.sha256`, `${sha256File(statPath)}  stat.sqlite\n`, "utf8");
    assert.throws(
      () => loadSpatialOofCache({
        cachePath: statPath,
        verifiedSpatialSplit: verifiedSplit(),
        sourceSnapshotSha256: SNAPSHOT_SHA
      }),
      (error) => error instanceof SpatialOofCacheError && error.code === "SPATIAL_OOF_CACHE_SCHEMA_INVALID"
    );

    const freelistPath = join(directory, "freelist.sqlite");
    writeFixture(freelistPath);
    try {
      chmodSync(freelistPath, 0o666);
    } catch {
      // Windows ACLs may ignore POSIX mode bits.
    }
    database = new DatabaseSync(freelistPath);
    database.exec("PRAGMA secure_delete = OFF; CREATE TABLE private_temp(secret TEXT)");
    database.prepare("INSERT INTO private_temp(secret) VALUES (?)").run("private-report".repeat(10_000));
    database.exec("DROP TABLE private_temp");
    assert.ok(Number(database.prepare("PRAGMA freelist_count").get().freelist_count) > 0);
    database.close();
    writeFileSync(`${freelistPath}.sha256`, `${sha256File(freelistPath)}  freelist.sqlite\n`, "utf8");
    assert.throws(
      () => loadSpatialOofCache({
        cachePath: freelistPath,
        verifiedSpatialSplit: verifiedSplit(),
        sourceSnapshotSha256: SNAPSHOT_SHA
      }),
      (error) => error instanceof SpatialOofCacheError && error.code === "SPATIAL_OOF_CACHE_INTEGRITY_FAILED"
    );
  } finally {
    cleanupDirectory(directory);
  }
});

test("缓存绑定拒绝错快照且 writer 拒绝缺折", () => {
  const directory = testDirectory("spatial-oof-binding");
  try {
    const cachePath = join(directory, "cache.sqlite");
    writeFixture(cachePath);
    assert.throws(
      () => loadSpatialOofCache({
        cachePath,
        verifiedSpatialSplit: verifiedSplit(),
        sourceSnapshotSha256: "e".repeat(64)
      }),
      (error) =>
        error instanceof SpatialOofCacheError &&
        error.code === "SPATIAL_OOF_CACHE_BINDING_MISMATCH" &&
        error.details.mismatches.includes("sourceSnapshotSha256")
    );
    const oldVersionPath = join(directory, "cache-v2.sqlite");
    writeFixture(oldVersionPath);
    try {
      chmodSync(oldVersionPath, 0o666);
    } catch {
      // Windows ACLs may ignore POSIX mode bits.
    }
    const oldVersion = new DatabaseSync(oldVersionPath);
    oldVersion.prepare("UPDATE metadata SET value='2' WHERE key='schemaVersion'").run();
    oldVersion.prepare("UPDATE metadata SET value=? WHERE key='cacheKind'")
      .run(JSON.stringify("zhejiang_development_strict_nested_spatial_oof_sufficient_statistics"));
    oldVersion.close();
    writeFileSync(`${oldVersionPath}.sha256`, `${sha256File(oldVersionPath)}  cache-v2.sqlite\n`, "utf8");
    assert.throws(
      () => loadSpatialOofCache({
        cachePath: oldVersionPath,
        verifiedSpatialSplit: verifiedSplit(),
        sourceSnapshotSha256: SNAPSHOT_SHA
      }),
      (error) =>
        error instanceof SpatialOofCacheError &&
        error.code === "SPATIAL_OOF_CACHE_BINDING_MISMATCH" &&
        error.details.mismatches.includes("schemaVersion") &&
        error.details.mismatches.includes("cacheKind")
    );
    const incompletePath = join(directory, "incomplete.sqlite");
    assert.throws(
      () => writeFixture(incompletePath, { folds: fixtureFolds().slice(0, 4) }),
      (error) => error instanceof SpatialOofCacheError && error.code === "SPATIAL_OOF_CACHE_FOLDS_INVALID"
    );
    assert.equal(existsSync(incompletePath), false);
  } finally {
    cleanupDirectory(directory);
  }
});
