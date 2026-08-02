"use strict";

const assert = require("node:assert/strict");
const {
  chmodSync,
  mkdtempSync,
  rmdirSync,
  unlinkSync,
  writeFileSync
} = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");
const { gridDisk, latLngToCell } = require("h3-js");

const {
  CONTINUOUS_HABITAT_FEATURE_CONTRACT,
  WORLDCOVER_CLASS_CODES
} = require("../server/prediction/habitat-features");
const {
  buildMultiscaleSpatialFeatureProfiles
} = require("../server/prediction/multiscale-spatial-features");
const {
  NEIGHBOR_POLICY_OOF_CACHE_KIND
} = require("../server/prediction/neighbor-policy-oof-cache");
const {
  SPATIAL_FEATURE_DIAGNOSTIC_CACHE_KIND,
  assertPrivacySafe,
  openSpatialFeatureDiagnosticCache,
  spatialFeatureDiagnosticCacheGenerationImplementationSha256,
  writeSpatialFeatureDiagnosticCache
} = require("../server/prediction/spatial-feature-diagnostic-cache");
const { sha256File } = require("../server/prediction/spatial-oof-cache");
const {
  DEFAULT_OPTIONS,
  parseCliArguments,
  validateBuildSafetyOptions
} = require("./build-zhejiang-prediction-model");

function syntheticFeatureSet() {
  const center = latLngToCell(30.27, 120.15, 6);
  const indexes = gridDisk(center, 18).sort();
  const cells = indexes.map((h3Index, index) => {
    const fractions = Object.fromEntries(
      WORLDCOVER_CLASS_CODES.map((code) => [String(code), 0])
    );
    fractions[
      String(
        WORLDCOVER_CLASS_CODES[
          index % WORLDCOVER_CLASS_CODES.length
        ]
      )
    ] += 0.65;
    fractions[
      String(
        WORLDCOVER_CLASS_CODES[
          (index * 5 + 1) % WORLDCOVER_CLASS_CODES.length
        ]
      )
    ] += 0.35;
    return {
      h3Index,
      coverage: 1,
      classFractions: fractions
    };
  });
  return {
    contract: CONTINUOUS_HABITAT_FEATURE_CONTRACT,
    featureSetSha256: "a".repeat(64),
    cells,
    cellsByH3: new Map(
      cells.map((cell) => [cell.h3Index, cell])
    )
  };
}

function foldIdentities() {
  const folds = [];
  let setId = 1;
  for (let outerFoldId = 1; outerFoldId <= 5; outerFoldId += 1) {
    folds.push({
      setId: setId++,
      outerFoldId,
      innerFoldId: 0
    });
    for (let innerFoldId = 1; innerFoldId <= 5; innerFoldId += 1) {
      if (innerFoldId === outerFoldId) continue;
      folds.push({
        setId: setId++,
        outerFoldId,
        innerFoldId
      });
    }
  }
  return folds;
}

function createCompanion(path) {
  const database = new DatabaseSync(path);
  database.exec(`
    CREATE TABLE metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) WITHOUT ROWID;
    CREATE TABLE fold_sets (
      set_id INTEGER PRIMARY KEY,
      outer_fold_id INTEGER NOT NULL,
      inner_fold_id INTEGER NOT NULL,
      context_count INTEGER NOT NULL,
      score_count INTEGER NOT NULL
    );
  `);
  const insertMetadata = database.prepare(
    "INSERT INTO metadata(key, value) VALUES (?, ?)"
  );
  for (const [key, value] of Object.entries({
    cacheKind: NEIGHBOR_POLICY_OOF_CACHE_KIND,
    panel: "development",
    sourceSnapshotSha256: "d".repeat(64),
    spatialSplitFileSha256: "b".repeat(64),
    spatialSplitManifestHash: "c".repeat(64)
  })) {
    insertMetadata.run(key, JSON.stringify(value));
  }
  const insert = database.prepare(`
    INSERT INTO fold_sets(
      set_id, outer_fold_id, inner_fold_id, context_count, score_count
    ) VALUES (?, ?, ?, 1, 2)
  `);
  for (const fold of foldIdentities()) {
    insert.run(
      fold.setId,
      fold.outerFoldId,
      fold.innerFoldId
    );
  }
  database.close();
  const fileSha256 = sha256File(path);
  writeFileSync(
    `${path}.sha256`,
    `${fileSha256}  ${path.split(/[\\/]/).pop()}\n`,
    "utf8"
  );
}

function verifiedSplit() {
  return {
    panelName: "development",
    fileSha256: "b".repeat(64),
    manifestHash: "c".repeat(64),
    manifest: {
      sourceSnapshotSha256: "d".repeat(64)
    }
  };
}

function cleanup(paths, directory) {
  for (const path of paths) {
    try {
      chmodSync(path, 0o666);
    } catch {
      // File may already be absent.
    }
    try {
      unlinkSync(path);
    } catch {
      // File may already be absent.
    }
  }
  rmdirSync(directory);
}

test("feature diagnostic cache binds profiles to companion ordinals", () => {
  const directory = mkdtempSync(
    join(tmpdir(), "beaubird-spatial-feature-cache-")
  );
  const companionPath = join(directory, "neighbor.sqlite");
  const cachePath = join(directory, "features.sqlite");
  createCompanion(companionPath);
  const featureSet = syntheticFeatureSet();
  const profileModel =
    buildMultiscaleSpatialFeatureProfiles(featureSet);
  const profileIds = profileModel.profiles.map(
    (profile) => profile.profileId
  );
  const folds = foldIdentities().map((fold, index) => ({
    outerFoldId: String(fold.outerFoldId),
    innerFoldId:
      fold.innerFoldId === 0 ? null : String(fold.innerFoldId),
    scoreCount: 2,
    contexts: [
      {
        contextIndex: 0,
        profileId: profileIds[index % profileIds.length],
        seasonWeek: index % 53
      }
    ]
  }));
  const layout = {
    foldSetCount: 25,
    outerFoldCount: 5,
    innerFoldCount: 20,
    outerContextRows: 5,
    innerContextRows: 20,
    totalContextRows: 25
  };
  const summary = writeSpatialFeatureDiagnosticCache({
    cachePath,
    companionNeighborCachePath: companionPath,
    foldSets: folds,
    profileModel,
    verifiedSpatialSplit: verifiedSplit(),
    sourceSnapshotSha256: "d".repeat(64),
    sourceFeatureFileSha256: "e".repeat(64),
    sourceFeatureSetSha256: featureSet.featureSetSha256,
    generationImplementationSha256:
      spatialFeatureDiagnosticCacheGenerationImplementationSha256(),
    predictionImplementationSha256: "f".repeat(64),
    expectedLayout: layout
  });
  assert.equal(
    summary.cacheKind,
    SPATIAL_FEATURE_DIAGNOSTIC_CACHE_KIND
  );
  assert.equal(summary.totalContextRows, 25);
  assert.match(summary.fileSha256, /^[0-9a-f]{64}$/);
  const opened = openSpatialFeatureDiagnosticCache({
    cachePath,
    companionNeighborCachePath: companionPath,
    verifiedSpatialSplit: verifiedSplit(),
    sourceSnapshotSha256: "d".repeat(64),
    sourceFeatureFileSha256: "e".repeat(64),
    sourceFeatureSetSha256: featureSet.featureSetSha256,
    expectedLayout: layout
  });
  assert.equal(opened.foldSets.length, 25);
  assert.equal(
    opened.metadata.profileModelSha256,
    profileModel.profileModelSha256
  );
  assert.deepEqual(
    opened.readFoldContexts({
      outerFoldId: "1",
      innerFoldId: null
    }),
    [
      {
        contextIndex: 0,
        seasonWeek: 0,
        profileId: folds[0].contexts[0].profileId,
        profileIndex: 0
      }
    ]
  );
  opened.close();
  cleanup(
    [
      cachePath,
      `${cachePath}.sha256`,
      companionPath,
      `${companionPath}.sha256`
    ],
    directory
  );
});

test("feature diagnostic privacy rejects exact spatial identity", () => {
  assert.throws(
    () => assertPrivacySafe({ h3Index: "8630..." }),
    (error) =>
      error.code ===
      "SPATIAL_FEATURE_DIAGNOSTIC_CACHE_PRIVACY_VIOLATION"
  );
  assert.equal(
    assertPrivacySafe({
      contextIndex: 0,
      profileId: "profile_01",
      seasonWeek: 12
    }),
    true
  );
});

test("build safety accepts exactly one frozen neighbor companion source", () => {
  const safe = {
    ...DEFAULT_OPTIONS,
    sourcePath: "snapshot.sqlite",
    snapshotPath: "snapshot.sqlite",
    sourceIsSnapshot: true,
    outputPath: "model.sqlite",
    testOnly: true,
    materializationProfile: "evaluation-only",
    pointerPath: null,
    workers: 4,
    habitatFeaturesPath: "features.json",
    habitatModel: "zhejiang_worldcover_hellinger_kernel_v1",
    spatialSplitManifestPath: "split.json",
    spatialEvaluationPanel: "development",
    writeNeighborPolicyOofCachePath: "neighbor.sqlite",
    neighborPolicyPreregistrationPath: "neighbor-prereg.json",
    writeSpatialFeatureDiagnosticCachePath: "features.sqlite",
    spatialFeaturePreregistrationPath: "feature-prereg.json"
  };
  assert.doesNotThrow(() => validateBuildSafetyOptions(safe));
  assert.doesNotThrow(() =>
    validateBuildSafetyOptions({
      ...safe,
      writeNeighborPolicyOofCachePath: undefined,
      neighborPolicyPreregistrationPath: undefined,
      companionNeighborPolicyOofCachePath:
        "neighbor-v9-r2.sqlite"
    })
  );
  assert.throws(
    () =>
      validateBuildSafetyOptions({
        ...safe,
        writeNeighborPolicyOofCachePath: undefined,
        neighborPolicyPreregistrationPath: undefined
      }),
    (error) =>
      error.code ===
        "SPATIAL_FEATURE_DIAGNOSTIC_CACHE_BUILD_FORBIDDEN" &&
      error.details.failures.includes(
        "companionNeighborPolicyOofCachePath.exactly_one_source_required"
      )
  );
  assert.throws(
    () =>
      validateBuildSafetyOptions({
        ...safe,
        companionNeighborPolicyOofCachePath:
          "neighbor-v9-r2.sqlite"
      }),
    (error) =>
      error.code ===
        "SPATIAL_FEATURE_DIAGNOSTIC_CACHE_BUILD_FORBIDDEN" &&
      error.details.failures.includes(
        "companionNeighborPolicyOofCachePath.exactly_one_source_required"
      )
  );
});

test("CLI parses read-only companion, feature cache and preregistration paths", () => {
  const options = parseCliArguments([
    "--companion-neighbor-policy-oof-cache",
    "neighbor-v9-r2.sqlite",
    "--write-spatial-feature-diagnostic-cache",
    "features.sqlite",
    "--spatial-feature-preregistration",
    "feature-prereg.json"
  ]);
  assert.equal(
    options.writeSpatialFeatureDiagnosticCachePath,
    "features.sqlite"
  );
  assert.equal(
    options.spatialFeaturePreregistrationPath,
    "feature-prereg.json"
  );
  assert.equal(
    options.companionNeighborPolicyOofCachePath,
    "neighbor-v9-r2.sqlite"
  );
});
