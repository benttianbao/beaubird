"use strict";

const { createHash } = require("node:crypto");
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { dirname, resolve } = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const { generateSpatialSplitManifest } = require("../server/prediction/spatial-splits");

const DEFAULT_VIEWED_ANCHORS = Object.freeze([
  "grid_r6:86309bc97ffffff",
  "grid_r6:86309aa57ffffff",
  "grid_r6:86309a9afffffff"
]);

function sha256Text(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function manifestValue(database, key) {
  const row = database.prepare("SELECT value FROM manifest WHERE key = ?").get(key);
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

function sidecarSha256(snapshotPath) {
  const sidecarPath = `${snapshotPath}.sha256`;
  if (!existsSync(sidecarPath)) throw new Error(`训练快照缺少 SHA-256 旁车：${sidecarPath}`);
  const match = readFileSync(sidecarPath, "utf8").match(/^([0-9a-f]{64})(?:\s|$)/i);
  if (!match) throw new Error(`训练快照 SHA-256 旁车格式无效：${sidecarPath}`);
  return match[1].toLowerCase();
}

function parseArguments(argv) {
  const projectRoot = resolve(__dirname, "..");
  const options = {
    modelPath: resolve(projectRoot, "data", "prediction-models", "zhejiang-v1-20260715.sqlite"),
    snapshotPath: resolve(projectRoot, "data", "prediction-snapshots", "zhejiang-v1-20260715.sqlite"),
    outputPath: resolve(projectRoot, "docs", "zhejiang-v1-20260715-spatial-splits.json"),
    viewedAnchorIds: [...DEFAULT_VIEWED_ANCHORS]
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`${argument} 缺少值。`);
      return argv[index];
    };
    if (argument === "--model") options.modelPath = resolve(value());
    else if (argument === "--snapshot") options.snapshotPath = resolve(value());
    else if (argument === "--output") options.outputPath = resolve(value());
    else if (argument === "--viewed") {
      options.viewedAnchorIds = value().split(",").map((entry) => entry.trim()).filter(Boolean);
    } else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new Error(`未知参数：${argument}`);
  }
  return options;
}

function usage() {
  return `生成浙江 H3 r6 开发/封存空间切分清单

用法：
  node tools/generate-zhejiang-spatial-splits.js \\
    --model data/prediction-models/zhejiang-v1-20260715.sqlite \\
    --snapshot data/prediction-snapshots/zhejiang-v1-20260715.sqlite \\
    --output docs/zhejiang-v1-20260715-spatial-splits.json

脚本仅读取模型 manifest 与 space_units，不读取任何鸟种命中或评估结果。`;
}

function generateFromArtifact(options) {
  if (existsSync(options.outputPath)) throw new Error(`输出已存在，拒绝覆盖冻结清单：${options.outputPath}`);
  const snapshotSha256 = sidecarSha256(options.snapshotPath);
  const database = new DatabaseSync(options.modelPath, { readOnly: true });
  try {
    database.exec("PRAGMA query_only = ON");
    const artifactSnapshotSha256 = String(manifestValue(database, "source_snapshot_sha256") || "").toLowerCase();
    if (artifactSnapshotSha256 !== snapshotSha256) {
      throw new Error(
        `模型与训练快照 SHA-256 不一致：model=${artifactSnapshotSha256 || "<missing>"}, snapshot=${snapshotSha256}`
      );
    }
    const candidates = database
      .prepare(
        `SELECT id AS unit_id, city_name, checklist_count, observer_count,
                centroid_longitude, centroid_latitude
         FROM space_units
         WHERE level = 'grid_r6' AND checklist_count >= 30 AND observer_count >= 10
         ORDER BY id`
      )
      .all();
    const manifest = generateSpatialSplitManifest({
      candidates,
      viewedAnchorIds: options.viewedAnchorIds,
      snapshotSha256
    });
    const output = `${JSON.stringify(manifest, null, 2)}\n`;
    mkdirSync(dirname(options.outputPath), { recursive: true });
    writeFileSync(options.outputPath, output, { encoding: "utf8", flag: "wx" });
    writeFileSync(
      `${options.outputPath}.sha256`,
      `${sha256Text(output)}  ${options.outputPath.split(/[\\/]/).pop()}\n`,
      { encoding: "utf8", flag: "wx" }
    );
    return {
      outputPath: options.outputPath,
      outputSha256: sha256Text(output),
      snapshotSha256,
      candidateCount: candidates.length,
      developmentAnchors: manifest.development.anchorCount,
      sealedReleaseAnchors: manifest.sealedRelease.anchorCount,
      sealedReleaseFolds: manifest.sealedRelease.folds.length,
      manifestHash: manifest.manifestHash
    };
  } finally {
    database.close();
  }
}

if (require.main === module) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) process.stdout.write(`${usage()}\n`);
    else process.stdout.write(`${JSON.stringify({ ok: true, ...generateFromArtifact(options) }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ ok: false, code: error.code || "SPATIAL_SPLIT_FAILED", message: error.message }, null, 2)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_VIEWED_ANCHORS,
  generateFromArtifact,
  manifestValue,
  parseArguments,
  sidecarSha256,
  usage
};
