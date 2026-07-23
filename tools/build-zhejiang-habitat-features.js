"use strict";

const { createHash } = require("node:crypto");
const {
  existsSync,
  mkdirSync,
  openSync,
  closeSync,
  readFileSync,
  readSync,
  statSync,
  writeFileSync
} = require("node:fs");
const { dirname, join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");
const {
  cellToBoundary,
  gridDisk,
  polygonToCells
} = require("h3-js");

const {
  ZHEJIANG_COVERAGE_POLYGONS,
  bd09ToWgs84,
  gridCell,
  isWithinZhejiang
} = require("../server/prediction/geo");
const {
  CONTINUOUS_HABITAT_FEATURE_CONTRACT,
  CONTINUOUS_HABITAT_FEATURE_KIND,
  CONTINUOUS_HABITAT_FEATURE_SCHEMA_VERSION,
  HABITAT_FEATURE_CONTRACT,
  HABITAT_FEATURE_KIND,
  HABITAT_FEATURE_SCHEMA_VERSION,
  WORLDCOVER_CLASS_CODES,
  validateHabitatFeatureSet
} = require("../server/prediction/habitat-features");
const { canonicalJson } = require("../server/prediction/spatial-splits");

const TILE_MANIFEST_SCHEMA_VERSION = 1;
const TILE_FILE_PREFIX = "ESA_WorldCover_10m_2021_v200_";
const TILE_FILE_SUFFIX = "_Map.tif";
const TILE_SOURCE_PREFIX =
  "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/";
const HABITAT_FEATURE_GENERATION_FILES = Object.freeze([
  "server/prediction/geo.js",
  "server/prediction/habitat-features.js",
  "server/prediction/spatial-splits.js",
  "tools/build-zhejiang-habitat-features.js",
  "tools/worldcover-h3-sampler.py"
]);

class HabitatFeatureBuildError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "HabitatFeatureBuildError";
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

function canonicalSha256(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function habitatFeatureGenerationImplementationSha256(projectRoot = resolve(__dirname, "..")) {
  const hash = createHash("sha256");
  for (const relativePath of HABITAT_FEATURE_GENERATION_FILES) {
    const normalized = relativePath.replaceAll("\\", "/");
    hash.update(`${normalized}\0`, "utf8");
    hash.update(readFileSync(resolve(projectRoot, relativePath)));
    hash.update("\0", "utf8");
  }
  return hash.digest("hex");
}

function tileId(latitude, longitude) {
  const south = Math.floor(Number(latitude) / 3) * 3;
  const west = Math.floor(Number(longitude) / 3) * 3;
  const latitudePrefix = south >= 0 ? "N" : "S";
  const longitudePrefix = west >= 0 ? "E" : "W";
  return `${latitudePrefix}${String(Math.abs(south)).padStart(2, "0")}${longitudePrefix}${String(Math.abs(west)).padStart(3, "0")}`;
}

function tileBounds(id) {
  const match = /^([NS])(\d{2})([EW])(\d{3})$/.exec(String(id));
  if (!match) {
    throw new HabitatFeatureBuildError("WORLDCOVER_TILE_ID_INVALID", `WorldCover tile ID 非法：${id}`);
  }
  const south = Number(match[2]) * (match[1] === "S" ? -1 : 1);
  const west = Number(match[4]) * (match[3] === "W" ? -1 : 1);
  return {
    south,
    west,
    north: south + HABITAT_FEATURE_CONTRACT.sourceTileDegrees,
    east: west + HABITAT_FEATURE_CONTRACT.sourceTileDegrees
  };
}

function boundarySummary(h3Index) {
  const boundary = cellToBoundary(h3Index).map(([latitude, longitude]) => [
    Number(longitude),
    Number(latitude)
  ]);
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

function collectSnapshotH3Cells(snapshotPath) {
  const database = new DatabaseSync(snapshotPath, { readOnly: true });
  try {
    database.exec("PRAGMA query_only = ON");
    const table = database.prepare(
      "SELECT COUNT(*) count FROM sqlite_schema WHERE type='table' AND name='reports'"
    ).get();
    if (Number(table?.count) !== 1) {
      throw new HabitatFeatureBuildError(
        "SNAPSHOT_SCHEMA_INVALID",
        "训练快照缺少 reports 表。"
      );
    }
    const cells = new Set();
    for (const row of database.prepare(
      `SELECT longitude, latitude
       FROM reports
       WHERE longitude IS NOT NULL AND latitude IS NOT NULL
       ORDER BY report_id`
    ).iterate()) {
      const coordinate = bd09ToWgs84(row.longitude, row.latitude);
      if (
        !coordinate.valid ||
        coordinate.swapped ||
        !isWithinZhejiang(coordinate.longitude, coordinate.latitude)
      ) continue;
      cells.add(gridCell(coordinate.longitude, coordinate.latitude, "grid_r6").h3Index);
    }
    if (!cells.size) {
      throw new HabitatFeatureBuildError(
        "SNAPSHOT_COORDINATES_MISSING",
        "训练快照没有可生成生境特征的浙江坐标。"
      );
    }
    return [...cells].sort().map(boundarySummary);
  } finally {
    database.close();
  }
}

function collectZhejiangCoverageH3Cells(snapshotPath) {
  const cells = new Set();
  for (const polygon of ZHEJIANG_COVERAGE_POLYGONS) {
    const latitudeLongitudePolygon = polygon.map(([longitude, latitude]) => [
      latitude,
      longitude
    ]);
    for (const h3Index of polygonToCells(
      latitudeLongitudePolygon,
      CONTINUOUS_HABITAT_FEATURE_CONTRACT.h3Resolution
    )) {
      for (const neighbor of gridDisk(h3Index, 1)) cells.add(neighbor);
    }
  }
  const snapshotCells = collectSnapshotH3Cells(snapshotPath);
  const snapshotIndexes = new Set(snapshotCells.map((cell) => cell.h3Index));
  for (const cell of snapshotCells) cells.add(cell.h3Index);
  if (!cells.size) {
    throw new HabitatFeatureBuildError(
      "ZHEJIANG_COVERAGE_CELLS_MISSING",
      "浙江连续生境覆盖没有生成 H3 r6 单元。"
    );
  }
  return [...cells]
    .sort()
    .map(boundarySummary)
    .filter((cell) =>
      snapshotIndexes.has(cell.h3Index) ||
      (
        cell.minLongitude >= 117 &&
        cell.maxLongitude <= 123 &&
        cell.minLatitude >= 24 &&
        cell.maxLatitude <= 33
      )
    );
}

function requiredTileIds(cells) {
  const ids = new Set();
  for (const cell of cells) {
    const minSouth = Math.floor(cell.minLatitude / 3) * 3;
    const maxSouth = Math.floor((cell.maxLatitude - Number.EPSILON) / 3) * 3;
    const minWest = Math.floor(cell.minLongitude / 3) * 3;
    const maxWest = Math.floor((cell.maxLongitude - Number.EPSILON) / 3) * 3;
    for (let south = minSouth; south <= maxSouth; south += 3) {
      for (let west = minWest; west <= maxWest; west += 3) {
        ids.add(tileId(south, west));
      }
    }
  }
  return [...ids].sort();
}

function buildTileManifest(
  tileDirectory,
  ids,
  featureContract = HABITAT_FEATURE_CONTRACT
) {
  const tiles = ids.map((id) => {
    const fileName = `${TILE_FILE_PREFIX}${id}${TILE_FILE_SUFFIX}`;
    const path = resolve(tileDirectory, fileName);
    if (!existsSync(path)) {
      throw new HabitatFeatureBuildError(
        "WORLDCOVER_TILE_MISSING",
        `缺少 WorldCover tile：${fileName}`,
        { tileId: id, path, sourceUrl: `${TILE_SOURCE_PREFIX}${fileName}` }
      );
    }
    return {
      tileId: id,
      fileName,
      fileSha256: sha256File(path),
      fileSize: statSync(path).size,
      sourceUrl: `${TILE_SOURCE_PREFIX}${fileName}`,
      ...tileBounds(id),
      path
    };
  });
  const publicManifest = {
    schemaVersion: TILE_MANIFEST_SCHEMA_VERSION,
    dataset: featureContract.sourceDataset,
    datasetVersion: featureContract.sourceDatasetVersion,
    sourceLicense: featureContract.sourceLicense,
    tiles: tiles.map(({ path, ...tile }) => tile)
  };
  return {
    tiles,
    publicManifest,
    sha256: canonicalSha256(publicManifest)
  };
}

function sampleWorldCover({
  cells,
  tileManifest,
  pythonPath,
  samplingContract = HABITAT_FEATURE_CONTRACT
}) {
  const samplerPath = resolve(__dirname, "worldcover-h3-sampler.py");
  const result = spawnSync(pythonPath, [samplerPath], {
    input: JSON.stringify({
      sourceTilePixels: samplingContract.sourceTilePixels,
      sampleStridePixels: samplingContract.sampleStridePixels,
      samplePixelOffset: samplingContract.samplePixelOffset,
      cells,
      tiles: tileManifest.tiles
    }),
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true
  });
  if (result.error || result.status !== 0) {
    throw new HabitatFeatureBuildError(
      "WORLDCOVER_SAMPLER_FAILED",
      `WorldCover 抽样失败：${result.error?.message || String(result.stderr || "").trim()}`,
      { status: result.status }
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (error) {
    throw new HabitatFeatureBuildError(
      "WORLDCOVER_SAMPLER_OUTPUT_INVALID",
      `WorldCover 抽样输出不是合法 JSON：${error.message}`
    );
  }
  if (parsed?.ok !== true || !Array.isArray(parsed.cells) || parsed.cells.length !== cells.length) {
    throw new HabitatFeatureBuildError(
      "WORLDCOVER_SAMPLER_OUTPUT_INVALID",
      "WorldCover 抽样未返回完整 H3 r6 结果。"
    );
  }
  return parsed.cells;
}

function buildFeatureCells(sampledCells, {
  dropBelowMinimumCoverage = false,
  requiredH3Indexes = []
} = {}) {
  const required = new Set([...requiredH3Indexes].map((h3Index) => String(h3Index)));
  const output = [];
  for (const cell of sampledCells) {
    const sampleCount = Number(cell.sampleCount);
    const validSampleCount = Number(cell.validSampleCount);
    const coverage = sampleCount > 0 ? validSampleCount / sampleCount : 0;
    if (
      !Number.isInteger(sampleCount) ||
      !Number.isInteger(validSampleCount) ||
      sampleCount <= 0 ||
      validSampleCount < 0 ||
      validSampleCount > sampleCount
    ) {
      throw new HabitatFeatureBuildError(
        "WORLDCOVER_SAMPLE_COUNTS_INVALID",
        "WorldCover 抽样计数非法。",
        { h3Index: cell.h3Index, sampleCount, validSampleCount }
      );
    }
    if (
      validSampleCount <= 0 ||
      coverage < CONTINUOUS_HABITAT_FEATURE_CONTRACT.minimumCellCoverage
    ) {
      if (dropBelowMinimumCoverage && !required.has(String(cell.h3Index))) continue;
      throw new HabitatFeatureBuildError(
        "WORLDCOVER_SAMPLE_COVERAGE_INCOMPLETE",
        "WorldCover 抽样有效分类覆盖低于固定门槛。",
        {
          h3Index: cell.h3Index,
          sampleCount,
          validSampleCount,
          coverage,
          minimumCoverage: CONTINUOUS_HABITAT_FEATURE_CONTRACT.minimumCellCoverage,
          requiredSnapshotCell: required.has(String(cell.h3Index))
        }
      );
    }
    const classFractions = Object.fromEntries(WORLDCOVER_CLASS_CODES.map((code) => [
      String(code),
      Number(cell.classCounts?.[String(code)] || 0) / validSampleCount
    ]));
    output.push({
      h3Index: String(cell.h3Index),
      coverage,
      classFractions
    });
  }
  return output;
}

function parseCliArguments(argv) {
  const options = { pythonPath: "python", coverage: "snapshot" };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = () => {
      index += 1;
      if (index >= argv.length) {
        throw new HabitatFeatureBuildError("INVALID_OPTIONS", `${argument} 缺少值。`);
      }
      return argv[index];
    };
    if (argument === "--snapshot") options.snapshotPath = value();
    else if (argument === "--expected-snapshot-sha256") options.expectedSnapshotSha256 = value();
    else if (argument === "--tiles") options.tileDirectory = value();
    else if (argument === "--output") options.outputPath = value();
    else if (argument === "--python") options.pythonPath = value();
    else if (argument === "--coverage") options.coverage = value();
    else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new HabitatFeatureBuildError("INVALID_OPTIONS", `未知参数：${argument}`);
  }
  return options;
}

function usage() {
  return `浙江 WorldCover H3 r6 生境特征生成器

用法：
  node tools/build-zhejiang-habitat-features.js --snapshot data/prediction-snapshots/zhejiang-v1-20260715.sqlite --expected-snapshot-sha256 92602be9... --tiles data/prediction-features/worldcover-2021-v200 --output data/prediction-features/zhejiang-v1-20260715-worldcover-h3-r6-v1.json

连续 v2 全省覆盖增加：
  --coverage zhejiang

输入 GeoTIFF 必须是官方 ESA WorldCover 2021 v200 3×3 度 Map COG；工具不联网，只读取本地 tile。`;
}

function buildHabitatFeatures(options) {
  if (!options.snapshotPath || !options.expectedSnapshotSha256 || !options.tileDirectory || !options.outputPath) {
    throw new HabitatFeatureBuildError(
      "INVALID_OPTIONS",
      "必须提供 snapshot、expected-snapshot-sha256、tiles 和 output。"
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
    throw new HabitatFeatureBuildError(
      "OUTPUT_EXISTS",
      "生境特征输出、tile manifest 或 sidecar 已存在，拒绝覆盖。"
    );
  }
  const snapshotSha256 = sha256File(snapshotPath);
  if (snapshotSha256 !== String(options.expectedSnapshotSha256).toLowerCase()) {
    throw new HabitatFeatureBuildError(
      "SNAPSHOT_SHA_MISMATCH",
      "训练快照 SHA-256 不匹配。",
      { expected: options.expectedSnapshotSha256, actual: snapshotSha256 }
    );
  }
  const coverage = String(options.coverage || "snapshot");
  if (!["snapshot", "zhejiang"].includes(coverage)) {
    throw new HabitatFeatureBuildError(
      "INVALID_OPTIONS",
      "coverage 只能是 snapshot 或 zhejiang。",
      { coverage }
    );
  }
  const featureDescriptor = coverage === "zhejiang"
    ? {
        schemaVersion: CONTINUOUS_HABITAT_FEATURE_SCHEMA_VERSION,
        kind: CONTINUOUS_HABITAT_FEATURE_KIND,
        contract: CONTINUOUS_HABITAT_FEATURE_CONTRACT
      }
    : {
        schemaVersion: HABITAT_FEATURE_SCHEMA_VERSION,
        kind: HABITAT_FEATURE_KIND,
        contract: HABITAT_FEATURE_CONTRACT
      };
  const snapshotCells = collectSnapshotH3Cells(snapshotPath);
  const cells = coverage === "zhejiang"
    ? collectZhejiangCoverageH3Cells(snapshotPath)
    : snapshotCells;
  const tileManifest = buildTileManifest(
    resolve(options.tileDirectory),
    requiredTileIds(cells),
    featureDescriptor.contract
  );
  const sampledCells = sampleWorldCover({
    cells,
    tileManifest,
    pythonPath: options.pythonPath || "python",
    samplingContract: featureDescriptor.contract
  });
  const validated = validateHabitatFeatureSet({
    schemaVersion: featureDescriptor.schemaVersion,
    kind: featureDescriptor.kind,
    contract: featureDescriptor.contract,
    snapshotSha256,
    tileManifestSha256: tileManifest.sha256,
    generationImplementationSha256: habitatFeatureGenerationImplementationSha256(),
    cells: buildFeatureCells(sampledCells, {
      dropBelowMinimumCoverage: coverage === "zhejiang",
      requiredH3Indexes: snapshotCells.map((cell) => cell.h3Index)
    })
  }, {
    expectedSnapshotSha256: snapshotSha256,
    expectedContractId: featureDescriptor.contract.id,
    requiredH3Indexes: snapshotCells.map((cell) => cell.h3Index)
  });
  const payload = {
    schemaVersion: validated.schemaVersion,
    kind: validated.kind,
    contract: validated.contract,
    snapshotSha256: validated.snapshotSha256,
    tileManifestSha256: validated.tileManifestSha256,
    generationImplementationSha256: validated.generationImplementationSha256,
    featureSetSha256: validated.featureSetSha256,
    cells: validated.cells
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify({
    ...tileManifest.publicManifest,
    manifestSha256: tileManifest.sha256
  }, null, 2)}\n`, "utf8");
  const manifestFileSha256 = sha256File(manifestPath);
  writeFileSync(`${manifestPath}.sha256`, `${manifestFileSha256}  ${manifestPath.split(/[\\/]/).pop()}\n`, "utf8");
  writeFileSync(outputPath, `${JSON.stringify(payload)}\n`, "utf8");
  const fileSha256 = sha256File(outputPath);
  writeFileSync(`${outputPath}.sha256`, `${fileSha256}  ${outputPath.split(/[\\/]/).pop()}\n`, "utf8");
  return {
    outputPath,
    fileSha256,
    featureSetSha256: validated.featureSetSha256,
    generationImplementationSha256: validated.generationImplementationSha256,
    snapshotSha256,
    coverage,
    featureContractId: featureDescriptor.contract.id,
    tileManifestPath: manifestPath,
    tileManifestSha256: tileManifest.sha256,
    cellCount: validated.summary.cellCount,
    clusterCounts: validated.summary.clusterCounts,
    minimumCoverage: validated.summary.minimumCoverage,
    meanCoverage: validated.summary.meanCoverage
  };
}

if (require.main === module) {
  try {
    const options = parseCliArguments(process.argv.slice(2));
    if (options.help) process.stdout.write(`${usage()}\n`);
    else process.stdout.write(`${JSON.stringify({ ok: true, ...buildHabitatFeatures(options) }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      ok: false,
      code: error.code || "HABITAT_FEATURE_BUILD_FAILED",
      message: error.message,
      details: error.details
    }, null, 2)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  HabitatFeatureBuildError,
  HABITAT_FEATURE_GENERATION_FILES,
  TILE_FILE_PREFIX,
  TILE_FILE_SUFFIX,
  TILE_SOURCE_PREFIX,
  boundarySummary,
  buildFeatureCells,
  buildHabitatFeatures,
  buildTileManifest,
  collectSnapshotH3Cells,
  collectZhejiangCoverageH3Cells,
  habitatFeatureGenerationImplementationSha256,
  parseCliArguments,
  requiredTileIds,
  sampleWorldCover,
  tileBounds,
  tileId,
  usage
};
