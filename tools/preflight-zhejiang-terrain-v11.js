"use strict";

const {
  existsSync,
  readFileSync,
  statSync,
  statfsSync
} = require("node:fs");
const { totalmem } = require("node:os");
const { resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const {
  buildTerrainTileManifest
} = require("./build-zhejiang-terrain-features");
const {
  validateCatalog
} = require("./download-copernicus-dem-terrain-v11");
const {
  loadHabitatFeatureSet
} = require("../server/prediction/habitat-features");
const {
  loadTerrainFeatureSet
} = require("../server/prediction/terrain-features");
const {
  TERRAIN_PREREGISTRATION_FROZEN_STATE,
  terrainOofScorerImplementationSha256,
  validateOofDecision,
  validatePreregistration
} = require("../server/prediction/terrain-preregistration");
const {
  generationImplementationSha256:
    terrainOofCacheGenerationImplementationSha256,
  openTerrainOofCache
} = require("../server/prediction/terrain-oof-cache");
const {
  predictionImplementationSha256
} = require("./build-zhejiang-prediction-model");
const {
  sha256File
} = require("../server/prediction/spatial-oof-cache");

const PROJECT_ROOT = resolve(__dirname, "..");
const paths = Object.freeze({
  snapshot:
    "data/prediction-snapshots/zhejiang-v1-20260715.sqlite",
  spatialSplit:
    "docs/zhejiang-v1-20260715-spatial-splits.json",
  worldCover:
    "data/prediction-features/zhejiang-v1-20260715-worldcover-h3-r6-continuous-v2.json",
  defaultModel:
    "data/prediction-models/zhejiang-v1-20260715.sqlite",
  v10Report:
    "data/prediction-models/zhejiang-v1-20260715-development-multiscale-spatial-feature-v10.sqlite.report.json",
  historicalV11:
    "data/prediction-models/development-cache/zhejiang-v1-20260715-spatial-profile-calibration-v11.json",
  historicalV12:
    "data/prediction-models/development-cache/zhejiang-v1-20260715-spatial-landcover-basis-v12.json",
  preregistration:
    "docs/zhejiang-v1-20260715-terrain-v11-preregistration.json",
  demDirectory:
    "data/prediction-features/copernicus-dem-glo-30-dged-2024_1",
  demSourceCatalog:
    "data/prediction-features/copernicus-dem-glo-30-dged-2024_1/catalog-v11.json",
  terrainFeature:
    "data/prediction-features/zhejiang-v1-20260715-terrain-h3-r6-v1.json",
  terrainTileManifest:
    "data/prediction-features/zhejiang-v1-20260715-terrain-h3-r6-v1.json.tiles.json",
  oofCache:
    "data/prediction-models/development-cache/zhejiang-v1-20260715-terrain-oof-v11.sqlite",
  oofEvaluationArtifact:
    "data/prediction-models/development-cache/zhejiang-v1-20260715-terrain-oof-v11-evaluation.sqlite",
  oofDecision:
    "data/prediction-models/development-cache/zhejiang-v1-20260715-terrain-oof-v11.decision.json",
  fullCandidate:
    "data/prediction-models/zhejiang-v1-20260715-development-terrain-v11.sqlite"
});
const expectedHashes = Object.freeze({
  snapshot:
    "92602be9b9c3aeb3d7c6cf966c459710a5a9bf6bc078e604a3805ab05fc0b16a",
  spatialSplit:
    "7deafec542c95b1463c92fe6948831247666a22923921b22890bb24adac9accc",
  worldCover:
    "085b134fc86124213c7abf8f0d813ef25489de1754c908ff98e384a1b189d451",
  defaultModel:
    "c4d8f759cdb9275b9d9171877d80b339e8796342dd262b380cf99360108ac582",
  v10Report:
    "f05a353ecdd5350fff15975ab9f894c1e07ed7c8a5e9f3c99c46faeb4c137b33",
  historicalV11:
    "d222fafb6749da4b22fc1aa31ceee2e827444ea6cba7a83742b842ff5e926c92",
  historicalV12:
    "31dd781b928179a3c4136afc62c6096c2bbc19f4bcdeb0d1130e42c2800679a0",
  demSourceCatalog:
    "5b860b28e73730a5cf192b4fbf971454ffc491ed3feed0a409ff0674b37c9375"
});

function absolute(relativePath) {
  return resolve(PROJECT_ROOT, relativePath);
}

function outputCollisionPaths(relativePath) {
  const base = absolute(relativePath);
  return [
    base,
    `${base}.sha256`,
    `${base}.report.json`,
    `${base}.report.json.sha256`
  ];
}

function commandLines() {
  return {
    featureGeneration:
      "node tools/build-zhejiang-terrain-features.js --snapshot data/prediction-snapshots/zhejiang-v1-20260715.sqlite --expected-snapshot-sha256 92602be9b9c3aeb3d7c6cf966c459710a5a9bf6bc078e604a3805ab05fc0b16a --cell-catalog data/prediction-features/zhejiang-v1-20260715-worldcover-h3-r6-continuous-v2.json --tiles data/prediction-features/copernicus-dem-glo-30-dged-2024_1 --source-catalog data/prediction-features/copernicus-dem-glo-30-dged-2024_1/catalog-v11.json --output data/prediction-features/zhejiang-v1-20260715-terrain-h3-r6-v1.json",
    freezePreregistration:
      "node tools/finalize-zhejiang-terrain-v11-preregistration.js --preregistration docs/zhejiang-v1-20260715-terrain-v11-preregistration.json --terrain-features data/prediction-features/zhejiang-v1-20260715-terrain-h3-r6-v1.json --tile-manifest data/prediction-features/zhejiang-v1-20260715-terrain-h3-r6-v1.json.tiles.json --source-catalog data/prediction-features/copernicus-dem-glo-30-dged-2024_1/catalog-v11.json --dem-directory data/prediction-features/copernicus-dem-glo-30-dged-2024_1 --confirm-approved-download yes",
    preflight:
      "node tools/preflight-zhejiang-terrain-v11.js",
    oofDiagnosticBuild:
      "node --max-old-space-size=6144 tools/build-zhejiang-prediction-model.js --source data/prediction-snapshots/zhejiang-v1-20260715.sqlite --source-is-snapshot --snapshot data/prediction-snapshots/zhejiang-v1-20260715.sqlite --output data/prediction-models/development-cache/zhejiang-v1-20260715-terrain-oof-v11-evaluation.sqlite --model-version zhejiang-v1-20260715-development-terrain-v11-oof-evaluation --spatial-split-manifest docs/zhejiang-v1-20260715-spatial-splits.json --spatial-panel development --habitat-features data/prediction-features/zhejiang-v1-20260715-worldcover-h3-r6-continuous-v2.json --habitat-model zhejiang_worldcover_hellinger_kernel_v1 --terrain-features data/prediction-features/zhejiang-v1-20260715-terrain-h3-r6-v1.json --terrain-model zhejiang_worldcover_terrain_neighbor_kernel_v11 --write-terrain-oof-cache data/prediction-models/development-cache/zhejiang-v1-20260715-terrain-oof-v11.sqlite --terrain-preregistration docs/zhejiang-v1-20260715-terrain-v11-preregistration.json --terrain-control-report data/prediction-models/zhejiang-v1-20260715-development-multiscale-spatial-feature-v10.sqlite.report.json --workers 4 --evaluation-only --no-publish --confirm-coordinate-system bd09",
    oofDecision:
      "node tools/score-zhejiang-terrain-oof-v11.js --cache data/prediction-models/development-cache/zhejiang-v1-20260715-terrain-oof-v11.sqlite --snapshot data/prediction-snapshots/zhejiang-v1-20260715.sqlite --spatial-split-manifest docs/zhejiang-v1-20260715-spatial-splits.json --terrain-features data/prediction-features/zhejiang-v1-20260715-terrain-h3-r6-v1.json --preregistration docs/zhejiang-v1-20260715-terrain-v11-preregistration.json --v10-report data/prediction-models/zhejiang-v1-20260715-development-multiscale-spatial-feature-v10.sqlite.report.json --output data/prediction-models/development-cache/zhejiang-v1-20260715-terrain-oof-v11.decision.json",
    fullSqliteBuild:
      "node --max-old-space-size=6144 tools/build-zhejiang-prediction-model.js --source data/prediction-snapshots/zhejiang-v1-20260715.sqlite --source-is-snapshot --snapshot data/prediction-snapshots/zhejiang-v1-20260715.sqlite --output data/prediction-models/zhejiang-v1-20260715-development-terrain-v11.sqlite --model-version zhejiang-v1-20260715-development-terrain-v11 --spatial-split-manifest docs/zhejiang-v1-20260715-spatial-splits.json --spatial-panel development --habitat-features data/prediction-features/zhejiang-v1-20260715-worldcover-h3-r6-continuous-v2.json --habitat-model zhejiang_worldcover_hellinger_kernel_v1 --terrain-features data/prediction-features/zhejiang-v1-20260715-terrain-h3-r6-v1.json --terrain-model zhejiang_worldcover_terrain_neighbor_kernel_v11 --terrain-preregistration docs/zhejiang-v1-20260715-terrain-v11-preregistration.json --terrain-control-report data/prediction-models/zhejiang-v1-20260715-development-multiscale-spatial-feature-v10.sqlite.report.json --terrain-oof-cache data/prediction-models/development-cache/zhejiang-v1-20260715-terrain-oof-v11.sqlite --terrain-oof-decision data/prediction-models/development-cache/zhejiang-v1-20260715-terrain-oof-v11.decision.json --workers 4 --test-only --no-publish --confirm-coordinate-system bd09"
  };
}

function run() {
  const staticFailures = [];
  const blockers = [];
  const inputChecks = {};
  for (const [key, expectedSha256] of Object.entries(
    expectedHashes
  )) {
    const path = absolute(paths[key]);
    if (!existsSync(path)) {
      inputChecks[key] = {
        path: paths[key],
        exists: false,
        passed: false
      };
      staticFailures.push(`${key}.missing`);
      continue;
    }
    const actualSha256 = sha256File(path);
    inputChecks[key] = {
      path: paths[key],
      exists: true,
      bytes: statSync(path).size,
      expectedSha256,
      actualSha256,
      passed: actualSha256 === expectedSha256
    };
    if (actualSha256 !== expectedSha256) {
      staticFailures.push(`${key}.sha256`);
    }
  }
  let preregistration = null;
  let preregistrationStatus = null;
  try {
    preregistration = JSON.parse(
      readFileSync(
        absolute(paths.preregistration),
        "utf8"
      )
    );
    preregistrationStatus =
      validatePreregistration(preregistration);
  } catch (error) {
    staticFailures.push(
      `preregistration:${error.code || error.message}`
    );
  }
  const pythonDependency = spawnSync(
    "python",
    [
      "-c",
      "import json,numpy,PIL; print(json.dumps({'numpy':numpy.__version__,'pillow':PIL.__version__}))"
    ],
    {
      encoding: "utf8",
      windowsHide: true
    }
  );
  const dependencies = {
    node: {
      version: process.version,
      passed: Number(process.versions.node.split(".")[0]) >= 24
    },
    python: {
      passed:
        pythonDependency.status === 0 &&
        !pythonDependency.error,
      details:
        pythonDependency.status === 0
          ? JSON.parse(pythonDependency.stdout)
          : {
              status: pythonDependency.status,
              error:
                pythonDependency.error?.message ||
                pythonDependency.stderr?.trim()
            }
    }
  };
  if (!dependencies.node.passed) {
    staticFailures.push("dependencies.node");
  }
  if (!dependencies.python.passed) {
    staticFailures.push("dependencies.python");
  }
  let worldCoverFeatureSet = null;
  try {
    worldCoverFeatureSet = loadHabitatFeatureSet(
      absolute(paths.worldCover),
      {
        expectedSnapshotSha256:
          expectedHashes.snapshot
      }
    );
  } catch (error) {
    staticFailures.push(
      `worldCover.contract:${error.code || error.message}`
    );
  }
  let dem = {
    directory: paths.demDirectory,
    sourceCatalog: paths.demSourceCatalog,
    exists: existsSync(absolute(paths.demDirectory)),
    sourceCatalogExists: existsSync(
      absolute(paths.demSourceCatalog)
    ),
    requiredTileCount:
      preregistration?.demSource?.requiredTileIds?.length ||
      27,
    sourcePublishedTileCount: 0,
    sourceUnavailableTileCount: 0,
    sourceUnavailableTileIds: [],
    availableTileCount: 0,
    missingPublishedTileCount: 0,
    availableBytes: 0
  };
  if (
    dem.exists &&
    dem.sourceCatalogExists &&
    preregistration
  ) {
    try {
      const sourceCatalog = validateCatalog(
        JSON.parse(
          readFileSync(
            absolute(paths.demSourceCatalog),
            "utf8"
          )
        ),
        preregistration.demSource.requiredTileIds
      );
      const manifest = buildTerrainTileManifest(
        absolute(paths.demDirectory),
        preregistration.demSource.requiredTileIds,
        sourceCatalog
      );
      const available = manifest.tiles.filter(
        (tile) => tile.status === "available"
      );
      const unavailable = manifest.tiles.filter(
        (tile) =>
          tile.status === "not_published_by_source"
      );
      const missingPublished = manifest.tiles.filter(
        (tile) =>
          tile.status === "not_present_in_local_cache"
      );
      dem = {
        ...dem,
        sourceCatalogFileSha256:
          expectedHashes.demSourceCatalog,
        sourceCatalogManifestSha256:
          sourceCatalog.manifestSha256,
        sourcePublishedTileCount:
          sourceCatalog.availableTileCount,
        sourceUnavailableTileCount:
          unavailable.length,
        sourceUnavailableTileIds:
          unavailable.map((tile) => tile.tileId),
        sourcePublishedDemBytes:
          sourceCatalog.totalDemBytes,
        availableTileCount: available.length,
        missingPublishedTileCount:
          missingPublished.length,
        availableBytes: available.reduce(
          (sum, tile) => sum + Number(tile.bytes || 0),
          0
        ),
        manifestSha256:
          missingPublished.length === 0
            ? manifest.sha256
            : null
      };
    } catch (error) {
      blockers.push(
        `dem_scan:${error.code || error.message}`
      );
    }
  }
  if (dem.missingPublishedTileCount > 0) {
    blockers.push(
      `dem_source_published_files_missing:${dem.missingPublishedTileCount}`
    );
  }
  let terrainFeature = {
    path: paths.terrainFeature,
    exists: existsSync(absolute(paths.terrainFeature)),
    valid: false
  };
  if (terrainFeature.exists) {
    try {
      const featureSet = loadTerrainFeatureSet(
        absolute(paths.terrainFeature),
        {
          expectedSnapshotSha256:
            expectedHashes.snapshot,
          expectedCellCatalogFileSha256:
            expectedHashes.worldCover,
          expectedCellCatalogFeatureSetSha256:
            preregistration.frozenInputs.worldCover
              .featureSetSha256,
          requiredH3Indexes:
            worldCoverFeatureSet?.cellsByH3.keys()
        }
      );
      terrainFeature = {
        ...terrainFeature,
        valid: true,
        fileSha256: featureSet.fileSha256,
        featureSetSha256:
          featureSet.featureSetSha256,
        tileManifestSha256:
          featureSet.tileManifestSha256,
        ...featureSet.summary
      };
      preregistrationStatus =
        validatePreregistration(preregistration, {
          requireFrozen: true,
          terrainFeatureSet: featureSet,
          preregistrationFileSha256: sha256File(
            absolute(paths.preregistration)
          ),
          controlReportFileSha256:
            expectedHashes.v10Report,
          implementation: {
            predictionImplementationSha256:
              predictionImplementationSha256(),
            terrainOofCacheGenerationImplementationSha256:
              terrainOofCacheGenerationImplementationSha256(),
            terrainOofScorerImplementationSha256:
              terrainOofScorerImplementationSha256()
          }
        });
    } catch (error) {
      blockers.push(
        `terrain_feature_or_frozen_preregistration:${error.code || error.message}`
      );
    }
  } else {
    blockers.push(
      "terrain_feature_generation_pending_source_published_dem_files"
    );
  }
  if (
    preregistration?.state !==
    TERRAIN_PREREGISTRATION_FROZEN_STATE
  ) {
    blockers.push(
      "preregistration_dem_and_feature_sha_binding_pending"
    );
  }
  const oofOutputs = [
    ...outputCollisionPaths(paths.oofCache),
    ...outputCollisionPaths(
      paths.oofEvaluationArtifact
    ),
    ...outputCollisionPaths(paths.oofDecision)
  ];
  const oofOutputCollisions = [
    ...new Set(oofOutputs)
  ].filter(existsSync);
  const fullOutputCollisions = outputCollisionPaths(
    paths.fullCandidate
  ).filter(existsSync);
  if (fullOutputCollisions.length) {
    blockers.push(
      "full_candidate_output_collision_requires_manual_review"
    );
  }
  let oofDecision = {
    path: paths.oofDecision,
    exists: existsSync(absolute(paths.oofDecision)),
    goForFullSqliteBuild: false
  };
  if (oofDecision.exists && terrainFeature.valid) {
    let terrainOofCache = null;
    try {
      terrainOofCache = openTerrainOofCache({
        cachePath: absolute(paths.oofCache),
        expectedSnapshotSha256:
          expectedHashes.snapshot,
        expectedSpatialSplitFileSha256:
          expectedHashes.spatialSplit,
        expectedTerrainFeatureFileSha256:
          terrainFeature.fileSha256
      });
      const decision = JSON.parse(
        readFileSync(
          absolute(paths.oofDecision),
          "utf8"
        )
      );
      validateOofDecision(decision, {
        cacheFileSha256:
          terrainOofCache.fileSha256,
        snapshotSha256: expectedHashes.snapshot,
        spatialSplitFileSha256:
          expectedHashes.spatialSplit,
        terrainFeatureFileSha256:
          terrainFeature.fileSha256,
        terrainFeatureSetSha256:
          terrainFeature.featureSetSha256,
        preregistrationFileSha256: sha256File(
          absolute(paths.preregistration)
        ),
        controlReportFileSha256:
          expectedHashes.v10Report,
        predictionImplementationSha256:
          predictionImplementationSha256(),
        terrainOofCacheGenerationImplementationSha256:
          terrainOofCacheGenerationImplementationSha256(),
        terrainOofScorerImplementationSha256:
          terrainOofScorerImplementationSha256()
      });
      oofDecision = {
        ...oofDecision,
        valid: true,
        goForFullSqliteBuild: true,
        fileSha256: sha256File(
          absolute(paths.oofDecision)
        )
      };
    } catch (error) {
      oofDecision = {
        ...oofDecision,
        valid: false,
        error: error.code || error.message
      };
    } finally {
      terrainOofCache?.close();
    }
  }
  if (
    oofOutputCollisions.length &&
    oofDecision.valid !== true
  ) {
    blockers.push(
      "oof_output_collision_requires_manual_review"
    );
  }
  const readyForFeatureGeneration =
    staticFailures.length === 0 &&
    dem.sourceCatalogManifestSha256 &&
    dem.missingPublishedTileCount === 0 &&
    dem.availableTileCount ===
      dem.sourcePublishedTileCount &&
    !terrainFeature.exists;
  const readyForOofDiagnosticBuild =
    staticFailures.length === 0 &&
    terrainFeature.valid &&
    preregistrationStatus?.readyForOof === true &&
    oofOutputCollisions.length === 0;
  const readyForFullSqliteBuild =
    staticFailures.length === 0 &&
    preregistrationStatus?.readyForOof === true &&
    terrainFeature.valid &&
    oofDecision.goForFullSqliteBuild === true &&
    fullOutputCollisions.length === 0;
  const disk = statfsSync(PROJECT_ROOT);
  return {
    ok:
      staticFailures.length === 0 &&
      blockers.length === 0,
    phase: "build_preparation_read_only_preflight",
    currentDecision: readyForFullSqliteBuild
      ? "ready_for_full_sqlite_build_pending_explicit_approval"
      : readyForOofDiagnosticBuild
        ? "ready_for_oof_diagnostic_build_pending_explicit_approval"
        : "not_ready_to_build",
    noLongBuildStarted: true,
    noDownloadPerformed: true,
    sealedPanelViewed: false,
    defaultModelModified: false,
    staticFailures,
    blockers: [...new Set(blockers)],
    inputChecks,
    preregistration: {
      path: paths.preregistration,
      state: preregistration?.state || null,
      validStaticContract:
        Boolean(preregistrationStatus),
      readyForOof:
        preregistrationStatus?.readyForOof ||
        false
    },
    dependencies,
    dem,
    terrainFeature,
    outputs: {
      oofOutputCollisions,
      fullOutputCollisions
    },
    readiness: {
      buildPreparationPassed:
        staticFailures.length === 0,
      readyForManualDemPlacement:
        staticFailures.length === 0 &&
        dem.sourceCatalogManifestSha256 &&
        dem.missingPublishedTileCount > 0,
      readyForFeatureGeneration,
      readyForOofDiagnosticBuild,
      readyForFullSqliteBuild
    },
    resourceEnvelope: {
      historicalV10BuildDurationSeconds: 18500.505,
      featureGenerationEstimatedElapsed:
        "30-90 minutes after all 26 source-published tiles are local",
      oofDiagnosticEstimatedElapsed:
        "6-9 hours for fresh 5 outer + 20 inner",
      fullSqliteEstimatedElapsedAfterOofGo:
        "2-4 hours for full materialization and fresh outer evaluation",
      demNativeDownloadEstimatedBytes: {
        minimum: 1349347272,
        maximum: 1349347272
      },
      demProductPackageBytes: 2862657712,
      oofCacheEstimatedBytes: {
        minimum: 100000000,
        maximum: 250000000
      },
      fullSqliteEstimatedBytes: {
        minimum: 225000000,
        maximum: 300000000
      },
      peakRssUpperBoundBytes: 8589934592,
      nodeOldSpaceLimitBytes: 6442450944,
      recommendedTemporaryFreeSpaceBytes: 5368709120,
      currentFreeSpaceBytes:
        Number(disk.bavail) * Number(disk.bsize),
      systemMemoryBytes: totalmem()
    },
    commands: commandLines(),
    nextRequiredAuthority:
      readyForFullSqliteBuild
        ? "explicit_approval_for_full_sqlite_build"
        : readyForOofDiagnosticBuild
          ? "explicit_approval_for_long_oof_diagnostic_build"
          : readyForFeatureGeneration
            ? "none_for_feature_generation_and_preregistration_freeze"
            : dem.missingPublishedTileCount > 0
              ? "manual_placement_of_26_source_published_dem_geotiffs"
              : "resolve_preflight_blockers"
  };
}

if (require.main === module) {
  try {
    process.stdout.write(
      `${JSON.stringify(run(), null, 2)}\n`
    );
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({
        ok: false,
        code:
          error.code ||
          "TERRAIN_V11_PREFLIGHT_FAILED",
        message: error.message,
        details: error.details
      }, null, 2)}\n`
    );
    process.exitCode = 1;
  }
}

module.exports = {
  commandLines,
  expectedHashes,
  paths,
  run
};
