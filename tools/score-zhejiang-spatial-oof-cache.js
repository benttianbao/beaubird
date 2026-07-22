"use strict";

const { chmodSync, existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync } = require("node:fs");
const { dirname, resolve } = require("node:path");

const {
  loadSpatialOofCache,
  sha256File,
  spatialOofCacheGenerationImplementationSha256
} = require("../server/prediction/spatial-oof-cache");
const {
  SpatialCandidateScorerError,
  scoreSpatialOofCandidates
} = require("../server/prediction/spatial-candidate-scorer");
const { verifySpatialSplitManifest } = require("../server/prediction/spatial-transfer");

function parseArguments(argv) {
  const options = { workers: 1 };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = () => {
      index += 1;
      if (index >= argv.length) {
        throw new SpatialCandidateScorerError("SPATIAL_SCORER_OPTIONS_INVALID", `${argument} 缺少值。`);
      }
      return argv[index];
    };
    if (argument === "--cache") options.cachePath = value();
    else if (argument === "--snapshot") options.snapshotPath = value();
    else if (argument === "--spatial-split-manifest") options.spatialSplitManifestPath = value();
    else if (argument === "--output") options.outputPath = value();
    else if (argument === "--workers") options.workers = Number(value());
    else if (argument === "--help" || argument === "-h") options.help = true;
    else {
      throw new SpatialCandidateScorerError(
        "SPATIAL_SCORER_OPTIONS_INVALID",
        `未知参数：${argument}。评分器不接受自由 cap、参数冻结或 sealed 选项。`
      );
    }
  }
  return options;
}

function usage() {
  return `浙江 development 空间 OOF 候选评分器

用法：
  node tools/score-zhejiang-spatial-oof-cache.js \\
    --cache data/prediction-models/development-cache/zhejiang-spatial-oof.sqlite \\
    --snapshot data/prediction-snapshots/zhejiang-v1-20260715.sqlite \\
    --spatial-split-manifest docs/zhejiang-v1-20260715-spatial-splits.json \\
    --output data/prediction-models/development-cache/zhejiang-spatial-candidates.json \\
    --workers 4

只接受完整 development 五折缓存。候选固定为代码中定义的 25 组；输出仅供 development 诊断，不能冻结参数或打开 sealed。`;
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

function assertOptions(options) {
  const missing = ["cachePath", "snapshotPath", "spatialSplitManifestPath", "outputPath"]
    .filter((key) => !options[key]);
  if (missing.length) {
    throw new SpatialCandidateScorerError(
      "SPATIAL_SCORER_OPTIONS_INVALID",
      "必须提供 cache、snapshot、spatial split manifest 和 output。",
      { missing }
    );
  }
  if (!Number.isInteger(Number(options.workers)) || Number(options.workers) < 1 || Number(options.workers) > 32) {
    throw new SpatialCandidateScorerError("SPATIAL_SCORER_WORKERS_INVALID", "workers 必须是 1..32 的整数。" );
  }
  const paths = {
    cachePath: resolve(options.cachePath),
    snapshotPath: resolve(options.snapshotPath),
    spatialSplitManifestPath: resolve(options.spatialSplitManifestPath),
    outputPath: resolve(options.outputPath)
  };
  const normalized = Object.fromEntries(Object.entries(paths).map(([key, path]) => [
    key,
    process.platform === "win32" ? path.toLowerCase() : path
  ]));
  if (
    normalized.outputPath === normalized.cachePath ||
    normalized.outputPath === normalized.snapshotPath ||
    normalized.outputPath === normalized.spatialSplitManifestPath
  ) {
    throw new SpatialCandidateScorerError(
      "SPATIAL_SCORER_PATH_CONFLICT",
      "评分输出不得覆盖缓存、快照或 split。"
    );
  }
  if (existsSync(paths.outputPath) || existsSync(`${paths.outputPath}.sha256`)) {
    throw new SpatialCandidateScorerError("SPATIAL_SCORER_OUTPUT_EXISTS", "评分输出或其 SHA sidecar 已存在。", {
      outputPath: paths.outputPath
    });
  }
  return paths;
}

async function run(options) {
  const paths = assertOptions(options);
  const sourceSnapshotSha256 = sha256File(paths.snapshotPath);
  const verifiedSpatialSplit = verifySpatialSplitManifest({
    manifestPath: paths.spatialSplitManifestPath,
    sourceSnapshotSha256,
    panelName: "development",
    sealedPanelConfirmation: null
  });
  const cache = loadSpatialOofCache({
    cachePath: paths.cachePath,
    verifiedSpatialSplit,
    sourceSnapshotSha256,
    generationImplementationSha256: spatialOofCacheGenerationImplementationSha256()
  });
  const report = await scoreSpatialOofCandidates(cache, { workers: Number(options.workers) });
  const temporaryOutput = `${paths.outputPath}.building-${process.pid}`;
  const sidecarPath = `${paths.outputPath}.sha256`;
  const temporarySidecar = `${sidecarPath}.building-${process.pid}`;
  mkdirSync(dirname(paths.outputPath), { recursive: true });
  safeUnlink(temporaryOutput);
  safeUnlink(temporarySidecar);
  let publishedOutput = false;
  let publishedSidecar = false;
  try {
    writeFileSync(temporaryOutput, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    const reportSha256 = sha256File(temporaryOutput);
    writeFileSync(
      temporarySidecar,
      `${reportSha256}  ${paths.outputPath.split(/[\\/]/).pop()}\n`,
      "utf8"
    );
    renameSync(temporaryOutput, paths.outputPath);
    publishedOutput = true;
    renameSync(temporarySidecar, sidecarPath);
    publishedSidecar = true;
    return {
      ok: true,
      outputPath: paths.outputPath,
      reportSha256,
      sidecarPath,
      diagnosticOnly: true,
      freezeEligible: false,
      sealedPanelViewed: false,
      rankingReference: report.rankingReference
        ? {
            passed: report.rankingReference.passed,
            failures: report.rankingReference.failures,
            formalProbabilityGateUnchanged: report.rankingReference.formalProbabilityGateUnchanged
          }
        : null,
      recommendation: report.recommendation
        ? { familyId: report.recommendation.familyId, failures: report.recommendation.failures }
        : null
    };
  } catch (error) {
    safeUnlink(temporaryOutput);
    safeUnlink(temporarySidecar);
    if (publishedSidecar) safeUnlink(sidecarPath);
    if (publishedOutput) safeUnlink(paths.outputPath);
    throw error;
  }
}

if (require.main === module) {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${usage()}\n`);
    } else {
      run(options)
        .then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
        .catch((error) => {
          process.stderr.write(`${JSON.stringify({
            ok: false,
            code: error.code || "SPATIAL_SCORER_FAILED",
            message: error.message,
            details: error.details
          }, null, 2)}\n`);
          process.exitCode = 1;
        });
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${usage()}\n`);
    process.exitCode = 1;
  }
}

module.exports = { assertOptions, parseArguments, run, usage };
