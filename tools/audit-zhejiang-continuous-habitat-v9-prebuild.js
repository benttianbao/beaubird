"use strict";

const {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} = require("node:fs");
const { dirname, resolve } = require("node:path");

const {
  loadSpatialOofCache,
  sha256File,
  spatialOofCacheGenerationImplementationSha256
} = require("../server/prediction/spatial-oof-cache");
const { verifySpatialSplitManifest } = require("../server/prediction/spatial-transfer");
const {
  ContinuousHabitatPrebuildError,
  buildContinuousHabitatPrebuildReport,
  validatePrebuildPreregistration
} = require("../server/prediction/continuous-habitat-prebuild");

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = () => {
      index += 1;
      if (index >= argv.length) {
        throw new ContinuousHabitatPrebuildError(
          "CONTINUOUS_HABITAT_PREBUILD_OPTIONS_INVALID",
          `${argument} 缺少值。`
        );
      }
      return argv[index];
    };
    if (argument === "--cache") options.cachePath = value();
    else if (argument === "--snapshot") options.snapshotPath = value();
    else if (argument === "--spatial-split-manifest") {
      options.spatialSplitManifestPath = value();
    } else if (argument === "--preregistration") {
      options.preregistrationPath = value();
    } else if (argument === "--output") options.outputPath = value();
    else if (argument === "--help" || argument === "-h") options.help = true;
    else {
      throw new ContinuousHabitatPrebuildError(
        "CONTINUOUS_HABITAT_PREBUILD_OPTIONS_INVALID",
        `未知参数：${argument}。诊断器不接受自由候选、sealed 或发布参数。`
      );
    }
  }
  return options;
}

function usage() {
  return `浙江 continuous habitat v9 构建前诊断

用法：
  node tools/audit-zhejiang-continuous-habitat-v9-prebuild.js --cache <v8-cache> --snapshot <snapshot> --spatial-split-manifest <split> --preregistration <v9-preregistration> --output <diagnostic.json>

只读复算冻结的 cap×prior 候选；不生成模型、不冻结参数、不访问 sealed。`;
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
  const missing = [
    "cachePath",
    "snapshotPath",
    "spatialSplitManifestPath",
    "preregistrationPath",
    "outputPath"
  ].filter((key) => !options[key]);
  if (missing.length) {
    throw new ContinuousHabitatPrebuildError(
      "CONTINUOUS_HABITAT_PREBUILD_OPTIONS_INVALID",
      "必须提供 cache、snapshot、split、preregistration 和 output。",
      { missing }
    );
  }
  const paths = Object.fromEntries(
    Object.entries(options)
      .filter(([key]) => key.endsWith("Path"))
      .map(([key, value]) => [key, resolve(value)])
  );
  const normalized = Object.fromEntries(
    Object.entries(paths).map(([key, path]) => [
      key,
      process.platform === "win32" ? path.toLowerCase() : path
    ])
  );
  const inputs = [
    normalized.cachePath,
    normalized.snapshotPath,
    normalized.spatialSplitManifestPath,
    normalized.preregistrationPath
  ];
  if (inputs.includes(normalized.outputPath)) {
    throw new ContinuousHabitatPrebuildError(
      "CONTINUOUS_HABITAT_PREBUILD_PATH_CONFLICT",
      "诊断输出不得覆盖输入。"
    );
  }
  if (existsSync(paths.outputPath) || existsSync(`${paths.outputPath}.sha256`)) {
    throw new ContinuousHabitatPrebuildError(
      "CONTINUOUS_HABITAT_PREBUILD_OUTPUT_EXISTS",
      "诊断输出或其 SHA sidecar 已存在。",
      { outputPath: paths.outputPath }
    );
  }
  return paths;
}

function run(options) {
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
    generationImplementationSha256:
      spatialOofCacheGenerationImplementationSha256()
  });
  const preregistration = JSON.parse(
    readFileSync(paths.preregistrationPath, "utf8")
  );
  validatePrebuildPreregistration(preregistration, {
    cache,
    outputPath: paths.outputPath
  });
  const report = buildContinuousHabitatPrebuildReport(cache);
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
      longBuildEligible: report.longBuildEligible,
      sealedPanelViewed: false,
      recommendation: report.recommendation
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
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${usage()}\n`);
    } else {
      const result = run(options);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    }
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify(
        {
          ok: false,
          code: error.code || "CONTINUOUS_HABITAT_PREBUILD_FAILED",
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

module.exports = { assertOptions, parseArguments, run, usage };
