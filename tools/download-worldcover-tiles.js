"use strict";

const { createHash } = require("node:crypto");
const {
  createWriteStream,
  existsSync,
  mkdirSync,
  openSync,
  closeSync,
  readSync,
  renameSync,
  statSync,
  unlinkSync
} = require("node:fs");
const { pipeline } = require("node:stream/promises");
const { Readable } = require("node:stream");
const { dirname, resolve } = require("node:path");

const {
  TILE_FILE_PREFIX,
  TILE_FILE_SUFFIX,
  TILE_SOURCE_PREFIX
} = require("./build-zhejiang-habitat-features");

class WorldCoverDownloadError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "WorldCoverDownloadError";
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

function normalizeTileId(value) {
  const tileId = String(value || "").toUpperCase();
  if (!/^[NS]\d{2}[EW]\d{3}$/.test(tileId)) {
    throw new WorldCoverDownloadError(
      "WORLDCOVER_TILE_ID_INVALID",
      `WorldCover tile ID 非法：${value}`
    );
  }
  return tileId;
}

function tileFileName(tileId) {
  return `${TILE_FILE_PREFIX}${normalizeTileId(tileId)}${TILE_FILE_SUFFIX}`;
}

async function downloadTile(tileId, outputDirectory) {
  const normalizedTileId = normalizeTileId(tileId);
  const fileName = tileFileName(normalizedTileId);
  const outputPath = resolve(outputDirectory, fileName);
  const temporaryPath = `${outputPath}.downloading`;
  if (existsSync(outputPath)) {
    return {
      tileId: normalizedTileId,
      outputPath,
      skipped: true,
      fileSize: statSync(outputPath).size,
      fileSha256: sha256File(outputPath)
    };
  }
  if (existsSync(temporaryPath)) {
    throw new WorldCoverDownloadError(
      "WORLDCOVER_TEMPORARY_OUTPUT_EXISTS",
      `临时下载文件已存在，拒绝静默覆盖：${temporaryPath}`
    );
  }
  mkdirSync(dirname(outputPath), { recursive: true });
  const sourceUrl = `${TILE_SOURCE_PREFIX}${fileName}`;
  let response;
  try {
    response = await fetch(sourceUrl);
  } catch (error) {
    throw new WorldCoverDownloadError(
      "WORLDCOVER_DOWNLOAD_FAILED",
      `无法连接 ESA WorldCover：${error.message}`,
      { tileId: normalizedTileId, sourceUrl }
    );
  }
  if (!response.ok || !response.body) {
    throw new WorldCoverDownloadError(
      "WORLDCOVER_DOWNLOAD_FAILED",
      `ESA WorldCover 返回 HTTP ${response.status}。`,
      { tileId: normalizedTileId, sourceUrl }
    );
  }
  try {
    await pipeline(
      Readable.fromWeb(response.body),
      createWriteStream(temporaryPath, { flags: "wx" })
    );
    renameSync(temporaryPath, outputPath);
  } catch (error) {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    throw new WorldCoverDownloadError(
      "WORLDCOVER_DOWNLOAD_FAILED",
      `写入 WorldCover tile 失败：${error.message}`,
      { tileId: normalizedTileId, sourceUrl, outputPath }
    );
  }
  return {
    tileId: normalizedTileId,
    sourceUrl,
    outputPath,
    skipped: false,
    fileSize: statSync(outputPath).size,
    fileSha256: sha256File(outputPath)
  };
}

function parseCliArguments(argv) {
  const options = { tileIds: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = () => {
      index += 1;
      if (index >= argv.length) {
        throw new WorldCoverDownloadError("INVALID_OPTIONS", `${argument} 缺少值。`);
      }
      return argv[index];
    };
    if (argument === "--tiles") {
      options.tileIds.push(...value().split(",").map((entry) => entry.trim()).filter(Boolean));
    } else if (argument === "--output") {
      options.outputDirectory = value();
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new WorldCoverDownloadError("INVALID_OPTIONS", `未知参数：${argument}`);
    }
  }
  return options;
}

function usage() {
  return "node tools/download-worldcover-tiles.js --tiles N24E117,N24E120,N27E117,N27E120,N30E117,N30E120 --output data/prediction-features/worldcover-2021-v200";
}

async function downloadTiles({ tileIds, outputDirectory }) {
  if (!Array.isArray(tileIds) || !tileIds.length || !outputDirectory) {
    throw new WorldCoverDownloadError(
      "INVALID_OPTIONS",
      "必须提供至少一个 tile ID 和输出目录。"
    );
  }
  const normalizedTileIds = [...new Set(tileIds.map(normalizeTileId))].sort();
  const results = [];
  for (const tileId of normalizedTileIds) {
    results.push(await downloadTile(tileId, outputDirectory));
  }
  return results;
}

if (require.main === module) {
  const options = parseCliArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
  } else {
    downloadTiles(options)
      .then((tiles) => process.stdout.write(`${JSON.stringify({ ok: true, tiles }, null, 2)}\n`))
      .catch((error) => {
        process.stderr.write(`${JSON.stringify({
          ok: false,
          code: error.code || "WORLDCOVER_DOWNLOAD_FAILED",
          message: error.message,
          details: error.details
        }, null, 2)}\n`);
        process.exitCode = 1;
      });
  }
}

module.exports = {
  WorldCoverDownloadError,
  downloadTile,
  downloadTiles,
  normalizeTileId,
  parseCliArguments,
  sha256File,
  tileFileName,
  usage
};
