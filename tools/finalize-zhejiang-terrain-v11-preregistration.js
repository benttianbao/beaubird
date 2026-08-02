"use strict";

const {
  chmodSync,
  existsSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} = require("node:fs");
const { basename, resolve } = require("node:path");

const {
  loadTerrainFeatureSet
} = require("../server/prediction/terrain-features");
const {
  loadHabitatFeatureSet
} = require("../server/prediction/habitat-features");
const {
  buildTerrainTileManifest
} = require("./build-zhejiang-terrain-features");
const {
  validateCatalog
} = require("./download-copernicus-dem-terrain-v11");
const {
  canonicalJson
} = require("../server/prediction/spatial-splits");
const {
  TERRAIN_PREREGISTRATION_FROZEN_STATE,
  TERRAIN_PREREGISTRATION_PENDING_STATE,
  terrainOofScorerImplementationSha256,
  validatePreregistration
} = require("../server/prediction/terrain-preregistration");
const {
  generationImplementationSha256:
    terrainOofCacheGenerationImplementationSha256
} = require("../server/prediction/terrain-oof-cache");
const {
  sha256File
} = require("../server/prediction/spatial-oof-cache");
const {
  predictionImplementationSha256
} = require("./build-zhejiang-prediction-model");

class TerrainPreregistrationFinalizeError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "TerrainPreregistrationFinalizeError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = () => {
      index += 1;
      if (index >= argv.length) {
        throw new TerrainPreregistrationFinalizeError(
          "TERRAIN_PREREGISTRATION_FINALIZE_OPTIONS_INVALID",
          `${argument} 缺少值。`
        );
      }
      return argv[index];
    };
    if (argument === "--preregistration") {
      options.preregistrationPath = value();
    } else if (argument === "--terrain-features") {
      options.terrainFeaturesPath = value();
    } else if (argument === "--tile-manifest") {
      options.tileManifestPath = value();
    } else if (argument === "--source-catalog") {
      options.sourceCatalogPath = value();
    } else if (argument === "--dem-directory") {
      options.demDirectory = value();
    } else if (
      argument === "--confirm-approved-download"
    ) {
      options.confirmApprovedDownload = value();
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new TerrainPreregistrationFinalizeError(
        "TERRAIN_PREREGISTRATION_FINALIZE_OPTIONS_INVALID",
        `未知参数：${argument}`
      );
    }
  }
  return options;
}

function usage() {
  return "node tools/finalize-zhejiang-terrain-v11-preregistration.js --preregistration docs/zhejiang-v1-20260715-terrain-v11-preregistration.json --terrain-features data/prediction-features/zhejiang-v1-20260715-terrain-h3-r6-v1.json --tile-manifest data/prediction-features/zhejiang-v1-20260715-terrain-h3-r6-v1.json.tiles.json --source-catalog data/prediction-features/copernicus-dem-glo-30-dged-2024_1/catalog-v11.json --dem-directory data/prediction-features/copernicus-dem-glo-30-dged-2024_1 --confirm-approved-download yes";
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

function run(options) {
  if (
    !options.preregistrationPath ||
    !options.terrainFeaturesPath ||
    !options.tileManifestPath ||
    !options.sourceCatalogPath ||
    !options.demDirectory ||
    options.confirmApprovedDownload !== "yes"
  ) {
    throw new TerrainPreregistrationFinalizeError(
      "TERRAIN_PREREGISTRATION_FINALIZE_OPTIONS_INVALID",
      "冻结预登记需要三个输入路径和 --confirm-approved-download yes。"
    );
  }
  const preregistrationPath = resolve(
    options.preregistrationPath
  );
  const terrainFeaturesPath = resolve(
    options.terrainFeaturesPath
  );
  const tileManifestPath = resolve(
    options.tileManifestPath
  );
  const sourceCatalogPath = resolve(
    options.sourceCatalogPath
  );
  const demDirectory = resolve(options.demDirectory);
  const originalPreregistrationText = readFileSync(
    preregistrationPath,
    "utf8"
  );
  const preregistration = JSON.parse(
    originalPreregistrationText
  );
  validatePreregistration(preregistration);
  if (
    preregistration.state !==
    TERRAIN_PREREGISTRATION_PENDING_STATE
  ) {
    throw new TerrainPreregistrationFinalizeError(
      "TERRAIN_PREREGISTRATION_STATE_INVALID",
      "只允许从待 DEM 绑定状态冻结一次预登记。"
    );
  }
  const worldCoverFeatureSet = loadHabitatFeatureSet(
    resolve(
      preregistration.frozenInputs.worldCover.path
    ),
    {
      expectedSnapshotSha256:
        preregistration.frozenInputs.snapshot.sha256
    }
  );
  const expectedTileIds = [
    ...preregistration.demSource.requiredTileIds
  ].sort();
  const sourceCatalog = validateCatalog(
    JSON.parse(readFileSync(sourceCatalogPath, "utf8")),
    expectedTileIds
  );
  const featureSet = loadTerrainFeatureSet(
    terrainFeaturesPath,
    {
      expectedSnapshotSha256:
        preregistration.frozenInputs.snapshot.sha256,
      expectedCellCatalogFileSha256:
        preregistration.frozenInputs.worldCover.sha256,
      expectedCellCatalogFeatureSetSha256:
        preregistration.frozenInputs.worldCover
          .featureSetSha256,
      requiredH3Indexes:
        worldCoverFeatureSet.cellsByH3.keys()
    }
  );
  const tileManifest = JSON.parse(
    readFileSync(tileManifestPath, "utf8")
  );
  const tiles = [...(tileManifest.tiles || [])].sort(
    (left, right) =>
      String(left.tileId).localeCompare(
        String(right.tileId)
      )
  );
  const rebuiltManifest = buildTerrainTileManifest(
    demDirectory,
    expectedTileIds,
    sourceCatalog
  );
  const rebuiltPublicManifest = {
    schemaVersion: rebuiltManifest.schemaVersion,
    kind: rebuiltManifest.kind,
    sourceDatasetId: rebuiltManifest.sourceDatasetId,
    sourceDatasetRelease:
      rebuiltManifest.sourceDatasetRelease,
    sourceNotice: rebuiltManifest.sourceNotice,
    sourceCatalogManifestSha256:
      rebuiltManifest.sourceCatalogManifestSha256,
    tiles: rebuiltManifest.tiles.map(
      ({
        path,
        south,
        west,
        north,
        east,
        ...tile
      }) => tile
    ),
    manifestSha256: rebuiltManifest.sha256
  };
  if (
    JSON.stringify(tiles.map((tile) => tile.tileId)) !==
      JSON.stringify(expectedTileIds) ||
    tiles.some(
      (tile) =>
        tile.status === "available"
          ? (
              !/^[a-f0-9]{64}$/.test(
                String(tile.sha256 || "")
              ) ||
              !Number.isInteger(Number(tile.bytes)) ||
              Number(tile.bytes) <= 0
            )
          : tile.status !==
            "not_published_by_source"
    ) ||
    tileManifest.manifestSha256 !==
      featureSet.tileManifestSha256 ||
    canonicalJson(tileManifest) !==
      canonicalJson(rebuiltPublicManifest) ||
    sourceCatalog.manifestSha256 !==
      preregistration.demSource
        .sourceCatalogManifestSha256 ||
    sha256File(sourceCatalogPath) !==
      preregistration.demSource
        .sourceCatalogFileSha256
  ) {
    throw new TerrainPreregistrationFinalizeError(
      "TERRAIN_TILE_MANIFEST_INVALID",
      "DEM tile manifest 未完整绑定 27 个已下载文件及 SHA。"
    );
  }
  const frozen = {
    ...preregistration,
    state: TERRAIN_PREREGISTRATION_FROZEN_STATE,
    frozenAt: new Date().toISOString(),
    demSource: {
      ...preregistration.demSource,
      downloadApproved: true,
      downloadPerformed: true,
      resolvedFiles: tiles
        .filter((tile) => tile.status === "available")
        .map((tile) => ({
          tileId: tile.tileId,
          fileName: tile.fileName,
          bytes: Number(tile.bytes),
          sha256: tile.sha256
        })),
      sourceUnavailableTiles: tiles
        .filter(
          (tile) =>
            tile.status === "not_published_by_source"
        )
        .map((tile) => ({
          tileId: tile.tileId,
          status: tile.status
        })),
      sourceCatalogFileSha256:
        sha256File(sourceCatalogPath),
      tileManifestFile: basename(tileManifestPath),
      tileManifestFileSha256:
        sha256File(tileManifestPath),
      tileManifestSha256:
        featureSet.tileManifestSha256
    },
    terrainFeatureContract: {
      ...preregistration.terrainFeatureContract,
      fileSha256: featureSet.fileSha256,
      featureSetSha256:
        featureSet.featureSetSha256,
      generationImplementationSha256:
        featureSet.generationImplementationSha256,
      cellCatalogFileSha256:
        featureSet.cellCatalogFileSha256,
      cellCatalogFeatureSetSha256:
        featureSet.cellCatalogFeatureSetSha256
    },
    implementation: {
      ...preregistration.implementation,
      predictionImplementationSha256:
        predictionImplementationSha256(),
      terrainOofCacheGenerationImplementationSha256:
        terrainOofCacheGenerationImplementationSha256(),
      terrainOofScorerImplementationSha256:
        terrainOofScorerImplementationSha256()
    },
    phaseGate: {
      ...preregistration.phaseGate,
      current:
        "oof_diagnostic_ready_awaiting_explicit_approval"
    }
  };
  validatePreregistration(frozen, {
    requireFrozen: true,
    terrainFeatureSet: featureSet,
    implementation: frozen.implementation
  });
  const temporaryPath =
    `${preregistrationPath}.building-${process.pid}`;
  const sidecarPath = `${preregistrationPath}.sha256`;
  const temporarySidecar =
    `${sidecarPath}.building-${process.pid}`;
  safeUnlink(temporaryPath);
  safeUnlink(temporarySidecar);
  try {
    writeFileSync(
      temporaryPath,
      `${JSON.stringify(frozen, null, 2)}\n`,
      "utf8"
    );
    const fileSha256 = sha256File(temporaryPath);
    writeFileSync(
      temporarySidecar,
      `${fileSha256}  ${basename(preregistrationPath)}\n`,
      "utf8"
    );
    let preregistrationPublished = false;
    let sidecarPublished = false;
    try {
      renameSync(temporaryPath, preregistrationPath);
      preregistrationPublished = true;
      renameSync(temporarySidecar, sidecarPath);
      sidecarPublished = true;
    } catch (error) {
      if (sidecarPublished) safeUnlink(sidecarPath);
      if (preregistrationPublished) {
        writeFileSync(
          preregistrationPath,
          originalPreregistrationText,
          "utf8"
        );
      }
      throw error;
    }
    return {
      ok: true,
      preregistrationPath,
      fileSha256,
      state: frozen.state,
      tileCount: tiles.length,
      terrainFeatureFileSha256:
        featureSet.fileSha256,
      terrainFeatureSetSha256:
        featureSet.featureSetSha256
    };
  } catch (error) {
    safeUnlink(temporaryPath);
    safeUnlink(temporarySidecar);
    throw error;
  }
}

if (require.main === module) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${usage()}\n`);
    } else {
      process.stdout.write(
        `${JSON.stringify(run(options), null, 2)}\n`
      );
    }
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({
        ok: false,
        code:
          error.code ||
          "TERRAIN_PREREGISTRATION_FINALIZE_FAILED",
        message: error.message,
        details: error.details
      }, null, 2)}\n`
    );
    process.exitCode = 1;
  }
}

module.exports = {
  TerrainPreregistrationFinalizeError,
  parseArguments,
  run,
  usage
};
