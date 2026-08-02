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
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} = require("node:fs");
const { spawnSync } = require("node:child_process");
const { basename, dirname, join, resolve } = require("node:path");
const { cellToBoundary } = require("h3-js");

const {
  CONTINUOUS_HABITAT_FEATURE_CONTRACT,
  loadHabitatFeatureSet
} = require("../server/prediction/habitat-features");
const {
  validateCatalog
} = require("./download-copernicus-dem-terrain-v11");
const {
  TERRAIN_FEATURE_CONTRACT,
  TERRAIN_FEATURE_KIND,
  TERRAIN_FEATURE_SCHEMA_VERSION,
  normalizationForCells,
  validateTerrainFeatureSet
} = require("../server/prediction/terrain-features");
const { canonicalJson } = require("../server/prediction/spatial-splits");

const TERRAIN_TILE_MANIFEST_SCHEMA_VERSION = 1;
const TERRAIN_TILE_FILE_PREFIX = "Copernicus_DSM_10_";
const TERRAIN_TILE_FILE_SUFFIX = "_DEM.tif";
const TERRAIN_FEATURE_GENERATION_FILES = Object.freeze([
  "server/prediction/habitat-features.js",
  "server/prediction/spatial-splits.js",
  "server/prediction/terrain-features.js",
  "tools/build-zhejiang-terrain-features.js",
  "tools/copernicus-dem-h3-sampler.py"
]);

class TerrainFeatureBuildError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "TerrainFeatureBuildError";
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
      const bytesRead = readSync(
        descriptor,
        buffer,
        0,
        buffer.length,
        null
      );
      if (!bytesRead) break;
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    closeSync(descriptor);
  }
  return hash.digest("hex");
}

function canonicalSha256(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
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

function terrainFeatureGenerationImplementationSha256(
  projectRoot = resolve(__dirname, "..")
) {
  const hash = createHash("sha256");
  for (const relativePath of TERRAIN_FEATURE_GENERATION_FILES) {
    const normalized = relativePath.replaceAll("\\", "/");
    hash.update(`${normalized}\0`, "utf8");
    hash.update(readFileSync(resolve(projectRoot, relativePath)));
    hash.update("\0", "utf8");
  }
  return hash.digest("hex");
}

function terrainTileId(latitude, longitude) {
  const south = Math.floor(Number(latitude));
  const west = Math.floor(Number(longitude));
  return `${south >= 0 ? "N" : "S"}${String(Math.abs(south)).padStart(
    2,
    "0"
  )}_00_${west >= 0 ? "E" : "W"}${String(Math.abs(west)).padStart(
    3,
    "0"
  )}_00`;
}

function terrainTileBounds(tileId) {
  const match = /^([NS])(\d{2})_00_([EW])(\d{3})_00$/.exec(
    String(tileId)
  );
  if (!match) {
    throw new TerrainFeatureBuildError(
      "TERRAIN_TILE_ID_INVALID",
      `Copernicus DEM geocell 非法：${tileId}`
    );
  }
  const south = Number(match[2]) * (match[1] === "S" ? -1 : 1);
  const west = Number(match[4]) * (match[3] === "W" ? -1 : 1);
  return { south, west, north: south + 1, east: west + 1 };
}

function terrainTileFileName(tileId) {
  terrainTileBounds(tileId);
  return `${TERRAIN_TILE_FILE_PREFIX}${tileId}${TERRAIN_TILE_FILE_SUFFIX}`;
}

function boundarySummary(h3Index) {
  const boundary = cellToBoundary(h3Index).map(
    ([latitude, longitude]) => [Number(longitude), Number(latitude)]
  );
  const longitudes = boundary.map(([longitude]) => longitude);
  const latitudes = boundary.map(([, latitude]) => latitude);
  return {
    h3Index,
    boundary,
    minLongitude: Math.min(...longitudes),
    minLatitude: Math.min(...latitudes),
    maxLongitude: Math.max(...longitudes),
    maxLatitude: Math.max(...latitudes)
  };
}

function requiredTerrainTileIds(cells) {
  const ids = new Set();
  for (const cell of cells) {
    const minimumSouth = Math.floor(cell.minLatitude);
    const maximumSouth = Math.floor(
      cell.maxLatitude - Number.EPSILON
    );
    const minimumWest = Math.floor(cell.minLongitude);
    const maximumWest = Math.floor(
      cell.maxLongitude - Number.EPSILON
    );
    for (
      let south = minimumSouth;
      south <= maximumSouth;
      south += 1
    ) {
      for (
        let west = minimumWest;
        west <= maximumWest;
        west += 1
      ) {
        ids.add(terrainTileId(south, west));
      }
    }
  }
  return [...ids].sort();
}

function recursiveFiles(root) {
  const pending = [resolve(root)];
  const files = [];
  while (pending.length) {
    const directory = pending.pop();
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) pending.push(path);
      else if (entry.isFile()) files.push(path);
    }
  }
  return files.sort();
}

function buildTerrainTileManifest(
  tileDirectory,
  tileIds,
  sourceCatalog = null
) {
  const directory = resolve(tileDirectory);
  if (!existsSync(directory)) {
    throw new TerrainFeatureBuildError(
      "TERRAIN_TILE_DIRECTORY_MISSING",
      `Copernicus DEM 缓存目录不存在：${directory}`
    );
  }
  const pathByName = new Map();
  for (const path of recursiveFiles(directory)) {
    const name = basename(path);
    if (pathByName.has(name)) {
      throw new TerrainFeatureBuildError(
        "TERRAIN_TILE_DUPLICATE",
        `Copernicus DEM 缓存中存在重复文件名：${name}`
      );
    }
    pathByName.set(name, path);
  }
  if (!sourceCatalog) {
    throw new TerrainFeatureBuildError(
      "TERRAIN_SOURCE_CATALOG_REQUIRED",
      "A validated CDSE source catalog is required."
    );
  }
  validateCatalog(sourceCatalog, tileIds);
  const sourceByTileId = new Map(
    sourceCatalog.products.map((item) => [
      item.tileId,
      item
    ])
  );
  const tiles = tileIds.map((tileId) => {
    const fileName = terrainTileFileName(tileId);
    const source = sourceByTileId.get(tileId);
    if (
      source?.sourceStatus ===
      "not_published_by_source"
    ) {
      return {
        tileId,
        fileName,
        status: "not_published_by_source"
      };
    }
    const path = pathByName.get(fileName);
    if (!path) {
      return {
        tileId,
        fileName,
        status: "not_present_in_local_cache"
      };
    }
    return {
      tileId,
      fileName,
      status: "available",
      bytes: statSync(path).size,
      sha256: sha256File(path)
    };
  });
  const publicManifest = {
    schemaVersion: TERRAIN_TILE_MANIFEST_SCHEMA_VERSION,
    kind: "copernicus_dem_glo30_dged_2024_1_tile_manifest",
    sourceDatasetId: TERRAIN_FEATURE_CONTRACT.sourceDatasetId,
    sourceDatasetRelease:
      TERRAIN_FEATURE_CONTRACT.sourceDatasetRelease,
    sourceNotice: TERRAIN_FEATURE_CONTRACT.sourceNotice,
    sourceCatalogManifestSha256:
      sourceCatalog.manifestSha256,
    tiles
  };
  return {
    ...publicManifest,
    sha256: canonicalSha256(publicManifest),
    tiles: tiles.map((tile) => ({
      ...tile,
      ...(tile.status === "available"
        ? {
            path: pathByName.get(tile.fileName),
            ...terrainTileBounds(tile.tileId)
          }
        : {})
    }))
  };
}

function sampleTerrain({
  cells,
  tileManifest,
  pythonPath = "python"
}) {
  const availableTiles = tileManifest.tiles.filter(
    (tile) => tile.status === "available"
  );
  if (!availableTiles.length) {
    throw new TerrainFeatureBuildError(
      "TERRAIN_TILES_MISSING",
      "本地缓存没有任何可用 Copernicus DEM tile。"
    );
  }
  const samplerPath = resolve(
    __dirname,
    "copernicus-dem-h3-sampler.py"
  );
  const child = spawnSync(pythonPath, [samplerPath], {
    input: JSON.stringify({
      stridePosts:
        TERRAIN_FEATURE_CONTRACT.sampling.stridePosts,
      offsetPosts:
        TERRAIN_FEATURE_CONTRACT.sampling.offsetPosts,
      sourceTilePosts: TERRAIN_FEATURE_CONTRACT.sourceTilePosts,
      cells,
      tiles: availableTiles.map((tile) => ({
        tileId: tile.tileId,
        path: tile.path,
        south: tile.south,
        west: tile.west,
        north: tile.north,
        east: tile.east
      }))
    }),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true
  });
  if (child.error || child.status !== 0) {
    throw new TerrainFeatureBuildError(
      "TERRAIN_SAMPLER_FAILED",
      `Copernicus DEM 抽样失败：${
        child.error?.message ||
        child.stderr?.trim() ||
        `exit ${child.status}`
      }`
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(child.stdout);
  } catch (error) {
    throw new TerrainFeatureBuildError(
      "TERRAIN_SAMPLER_OUTPUT_INVALID",
      `无法解析地形抽样结果：${error.message}`
    );
  }
  if (
    parsed?.ok !== true ||
    !Array.isArray(parsed.cells) ||
    parsed.cells.length !== cells.length
  ) {
    throw new TerrainFeatureBuildError(
      "TERRAIN_SAMPLER_OUTPUT_INVALID",
      "地形抽样结果没有覆盖冻结 H3 r6 目录。"
    );
  }
  return parsed.cells;
}

function stableNumber(value) {
  return Number(Number(value).toFixed(12));
}

function featureCells(sampledCells) {
  const minimum = TERRAIN_FEATURE_CONTRACT.minimumAvailableSampleCount;
  return sampledCells.map((cell) => {
    const elevationSampleCount = Number(cell.elevationSampleCount);
    const slopeSampleCount = Number(cell.slopeSampleCount);
    const available =
      Number.isInteger(elevationSampleCount) &&
      Number.isInteger(slopeSampleCount) &&
      elevationSampleCount >= minimum &&
      slopeSampleCount >= minimum;
    if (!available) {
      return {
        h3Index: String(cell.h3Index).toLowerCase(),
        available: false,
        elevationSampleCount:
          Number.isInteger(elevationSampleCount)
            ? elevationSampleCount
            : 0,
        slopeSampleCount:
          Number.isInteger(slopeSampleCount) ? slopeSampleCount : 0,
        meanElevationMeters: null,
        elevationStdDevMeters: null,
        meanSlopeDegrees: null
      };
    }
    const meanElevation =
      Number(cell.elevationSum) / elevationSampleCount;
    const variance = Math.max(
      0,
      Number(cell.elevationSumSquares) / elevationSampleCount -
        meanElevation * meanElevation
    );
    return {
      h3Index: String(cell.h3Index).toLowerCase(),
      available: true,
      elevationSampleCount,
      slopeSampleCount,
      meanElevationMeters: stableNumber(meanElevation),
      elevationStdDevMeters: stableNumber(Math.sqrt(variance)),
      meanSlopeDegrees: stableNumber(
        Number(cell.slopeSum) / slopeSampleCount
      )
    };
  }).sort((left, right) => left.h3Index.localeCompare(right.h3Index));
}

function parseCliArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = () => {
      index += 1;
      if (index >= argv.length) {
        throw new TerrainFeatureBuildError(
          "INVALID_OPTIONS",
          `${argument} 缺少值。`
        );
      }
      return argv[index];
    };
    if (argument === "--snapshot") options.snapshotPath = value();
    else if (argument === "--expected-snapshot-sha256") {
      options.expectedSnapshotSha256 = value();
    } else if (argument === "--cell-catalog") {
      options.cellCatalogPath = value();
    } else if (argument === "--tiles") {
      options.tileDirectory = value();
    } else if (argument === "--source-catalog") {
      options.sourceCatalogPath = value();
    } else if (argument === "--output") options.outputPath = value();
    else if (argument === "--python") options.pythonPath = value();
    else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new TerrainFeatureBuildError(
        "INVALID_OPTIONS",
        `未知参数：${argument}`
      );
    }
  }
  return options;
}

function usage() {
  return "node tools/build-zhejiang-terrain-features.js --snapshot data/prediction-snapshots/zhejiang-v1-20260715.sqlite --expected-snapshot-sha256 92602be9b9c3aeb3d7c6cf966c459710a5a9bf6bc078e604a3805ab05fc0b16a --cell-catalog data/prediction-features/zhejiang-v1-20260715-worldcover-h3-r6-continuous-v2.json --tiles data/prediction-features/copernicus-dem-glo-30-dged-2024_1 --source-catalog data/prediction-features/copernicus-dem-glo-30-dged-2024_1/catalog-v11.json --output data/prediction-features/zhejiang-v1-20260715-terrain-h3-r6-v1.json";
}

function buildTerrainFeatures(options) {
  if (
    !options.snapshotPath ||
    !options.expectedSnapshotSha256 ||
    !options.cellCatalogPath ||
    !options.tileDirectory ||
    !options.sourceCatalogPath ||
    !options.outputPath
  ) {
    throw new TerrainFeatureBuildError(
      "INVALID_OPTIONS",
      "必须提供 snapshot、expected-snapshot-sha256、cell-catalog、tiles 和 output。"
    );
  }
  const snapshotPath = resolve(options.snapshotPath);
  const outputPath = resolve(options.outputPath);
  const manifestPath = `${outputPath}.tiles.json`;
  const reservedPaths = [
    outputPath,
    `${outputPath}.sha256`,
    manifestPath,
    `${manifestPath}.sha256`
  ];
  if (reservedPaths.some(existsSync)) {
    throw new TerrainFeatureBuildError(
      "OUTPUT_EXISTS",
      "地形特征、tile manifest 或 SHA sidecar 已存在，拒绝覆盖。"
    );
  }
  const snapshotSha256 = sha256File(snapshotPath);
  if (
    snapshotSha256 !==
    String(options.expectedSnapshotSha256).toLowerCase()
  ) {
    throw new TerrainFeatureBuildError(
      "SNAPSHOT_SHA_MISMATCH",
      "训练快照 SHA-256 不匹配。",
      {
        expected: options.expectedSnapshotSha256,
        actual: snapshotSha256
      }
    );
  }
  const cellCatalogPath = resolve(options.cellCatalogPath);
  const cellCatalogFileSha256 = sha256File(cellCatalogPath);
  const cellCatalog = loadHabitatFeatureSet(cellCatalogPath, {
    expectedSnapshotSha256: snapshotSha256,
    expectedContractId: CONTINUOUS_HABITAT_FEATURE_CONTRACT.id
  });
  const cells = cellCatalog.cells.map((cell) =>
    boundarySummary(cell.h3Index)
  );
  const tileManifest = buildTerrainTileManifest(
    options.tileDirectory,
    requiredTerrainTileIds(cells),
    JSON.parse(
      readFileSync(
        resolve(options.sourceCatalogPath),
        "utf8"
      )
    )
  );
  const missingTiles = tileManifest.tiles.filter(
    (tile) =>
      tile.status === "not_present_in_local_cache"
  );
  if (missingTiles.length) {
    throw new TerrainFeatureBuildError(
      "TERRAIN_TILES_INCOMPLETE",
      "地形特征生成必须先冻结并校验全部所需 Copernicus DEM tile。",
      {
        requiredTileCount: tileManifest.tiles.length,
        sourcePublishedTileCount:
          tileManifest.tiles.filter(
            (tile) =>
              tile.status !==
              "not_published_by_source"
          ).length,
        availableTileCount:
          tileManifest.tiles.filter(
            (tile) => tile.status === "available"
          ).length,
        sourceUnavailableTileIds:
          tileManifest.tiles
            .filter(
              (tile) =>
                tile.status ===
                "not_published_by_source"
            )
            .map((tile) => tile.tileId),
        missingTileIds: missingTiles.map(
          (tile) => tile.tileId
        )
      }
    );
  }
  const sampled = sampleTerrain({
    cells,
    tileManifest,
    pythonPath: options.pythonPath || "python"
  });
  const cellsWithFeatures = featureCells(sampled);
  const normalization = normalizationForCells(cellsWithFeatures);
  const validated = validateTerrainFeatureSet(
    {
      schemaVersion: TERRAIN_FEATURE_SCHEMA_VERSION,
      kind: TERRAIN_FEATURE_KIND,
      contract: TERRAIN_FEATURE_CONTRACT,
      snapshotSha256,
      cellCatalogFileSha256,
      cellCatalogFeatureSetSha256:
        cellCatalog.featureSetSha256,
      tileManifestSha256: tileManifest.sha256,
      generationImplementationSha256:
        terrainFeatureGenerationImplementationSha256(),
      normalization,
      cells: cellsWithFeatures
    },
    {
      expectedSnapshotSha256: snapshotSha256,
      expectedCellCatalogFileSha256: cellCatalogFileSha256,
      expectedCellCatalogFeatureSetSha256:
        cellCatalog.featureSetSha256,
      requiredH3Indexes: cellCatalog.cellsByH3.keys()
    }
  );
  const payload = {
    schemaVersion: validated.schemaVersion,
    kind: validated.kind,
    contract: validated.contract,
    snapshotSha256: validated.snapshotSha256,
    cellCatalogFileSha256:
      validated.cellCatalogFileSha256,
    cellCatalogFeatureSetSha256:
      validated.cellCatalogFeatureSetSha256,
    tileManifestSha256: validated.tileManifestSha256,
    generationImplementationSha256:
      validated.generationImplementationSha256,
    featureSetSha256: validated.featureSetSha256,
    normalization: validated.normalization,
    cells: validated.cells
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  const outputSidecarPath = `${outputPath}.sha256`;
  const manifestSidecarPath = `${manifestPath}.sha256`;
  const temporaryPaths = {
    output: `${outputPath}.building-${process.pid}`,
    outputSidecar:
      `${outputSidecarPath}.building-${process.pid}`,
    manifest: `${manifestPath}.building-${process.pid}`,
    manifestSidecar:
      `${manifestSidecarPath}.building-${process.pid}`
  };
  for (const path of Object.values(temporaryPaths)) {
    safeUnlink(path);
  }
  writeFileSync(
    temporaryPaths.manifest,
    `${JSON.stringify(
      {
        schemaVersion: tileManifest.schemaVersion,
        kind: tileManifest.kind,
        sourceDatasetId: tileManifest.sourceDatasetId,
        sourceDatasetRelease:
          tileManifest.sourceDatasetRelease,
        sourceNotice: tileManifest.sourceNotice,
        sourceCatalogManifestSha256:
          tileManifest.sourceCatalogManifestSha256,
        tiles: tileManifest.tiles.map(
          ({
            path,
            south,
            west,
            north,
            east,
            ...tile
          }) => tile
        ),
        manifestSha256: tileManifest.sha256
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  const manifestFileSha256 = sha256File(
    temporaryPaths.manifest
  );
  writeFileSync(
    temporaryPaths.manifestSidecar,
    `${manifestFileSha256}  ${basename(manifestPath)}\n`,
    "utf8"
  );
  writeFileSync(
    temporaryPaths.output,
    `${JSON.stringify(payload)}\n`,
    "utf8"
  );
  const fileSha256 = sha256File(temporaryPaths.output);
  writeFileSync(
    temporaryPaths.outputSidecar,
    `${fileSha256}  ${basename(outputPath)}\n`,
    "utf8"
  );
  const publications = [
    [temporaryPaths.manifest, manifestPath],
    [temporaryPaths.manifestSidecar, manifestSidecarPath],
    [temporaryPaths.output, outputPath],
    [temporaryPaths.outputSidecar, outputSidecarPath]
  ];
  const published = [];
  try {
    for (const [temporary, target] of publications) {
      renameSync(temporary, target);
      published.push(target);
    }
  } catch (error) {
    for (const path of Object.values(temporaryPaths)) {
      safeUnlink(path);
    }
    for (const path of published.reverse()) {
      safeUnlink(path);
    }
    throw error;
  }
  return {
    outputPath,
    fileSha256,
    featureSetSha256: validated.featureSetSha256,
    generationImplementationSha256:
      validated.generationImplementationSha256,
    snapshotSha256,
    cellCatalogFileSha256,
    cellCatalogFeatureSetSha256:
      cellCatalog.featureSetSha256,
    tileManifestPath: manifestPath,
    tileManifestSha256: tileManifest.sha256,
    tileCount: tileManifest.tiles.length,
    availableTileCount: tileManifest.tiles.filter(
      (tile) => tile.status === "available"
    ).length,
    sourceUnavailableTileCount:
      tileManifest.tiles.filter(
        (tile) =>
          tile.status === "not_published_by_source"
      ).length,
    ...validated.summary
  };
}

if (require.main === module) {
  try {
    const options = parseCliArguments(process.argv.slice(2));
    if (options.help) process.stdout.write(`${usage()}\n`);
    else {
      process.stdout.write(
        `${JSON.stringify(
          { ok: true, ...buildTerrainFeatures(options) },
          null,
          2
        )}\n`
      );
    }
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify(
        {
          ok: false,
          code: error.code || "TERRAIN_FEATURE_BUILD_FAILED",
          message: error.message,
          details: error.details
        },
        null,
        2
      )}\n`
    );
    process.exitCode = 1;
  }
}

module.exports = {
  TERRAIN_FEATURE_GENERATION_FILES,
  TERRAIN_TILE_FILE_PREFIX,
  TERRAIN_TILE_FILE_SUFFIX,
  TERRAIN_TILE_MANIFEST_SCHEMA_VERSION,
  TerrainFeatureBuildError,
  boundarySummary,
  buildTerrainFeatures,
  buildTerrainTileManifest,
  featureCells,
  parseCliArguments,
  requiredTerrainTileIds,
  sampleTerrain,
  terrainFeatureGenerationImplementationSha256,
  terrainTileBounds,
  terrainTileFileName,
  terrainTileId,
  usage
};
