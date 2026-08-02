"use strict";

const { createHash } = require("node:crypto");
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
  CONTINUOUS_HABITAT_FEATURE_CONTRACT,
  loadHabitatFeatureSet
} = require("../server/prediction/habitat-features");
const {
  buildMultiscaleSpatialFeatureProfiles,
  multiscaleSpatialFeatureContractSha256,
  multiscaleSpatialFeatureGenerationImplementationSha256
} = require("../server/prediction/multiscale-spatial-features");
const {
  spatialFeatureDiagnosticCacheGenerationImplementationSha256,
  validateSpatialFeatureDiagnosticPreregistration
} = require("../server/prediction/spatial-feature-diagnostic-cache");
const { sha256File } = require("../server/prediction/spatial-oof-cache");
const {
  verifySpatialSplitManifest
} = require("../server/prediction/spatial-transfer");
const { canonicalJson } = require("../server/prediction/spatial-splits");
const {
  DEFAULT_OPTIONS,
  PRODUCTION_QUALITY_GATE,
  parseCliArguments: parseBuildArguments,
  predictionImplementationSha256,
  validateBuildSafetyOptions
} = require("./build-zhejiang-prediction-model");

const PREFLIGHT_FILES = Object.freeze([
  "tools/preflight-zhejiang-spatial-feature-diagnostic-cache.js",
  "tools/build-zhejiang-prediction-model.js",
  "server/prediction/multiscale-spatial-features.js",
  "server/prediction/spatial-feature-diagnostic-cache.js"
]);

class SpatialFeaturePreflightError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "SpatialFeaturePreflightError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function preflightImplementationSha256(
  projectRoot = resolve(__dirname, "..")
) {
  const hash = createHash("sha256");
  for (const relativePath of [...PREFLIGHT_FILES].sort()) {
    hash.update(relativePath, "utf8");
    hash.update("\0", "utf8");
    hash.update(readFileSync(resolve(projectRoot, relativePath)));
    hash.update("\0", "utf8");
  }
  return hash.digest("hex");
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = () => {
      index += 1;
      if (index >= argv.length) {
        throw new SpatialFeaturePreflightError(
          "SPATIAL_FEATURE_PREFLIGHT_OPTIONS_INVALID",
          `${argument} 缺少值。`
        );
      }
      return argv[index];
    };
    if (argument === "--snapshot") options.snapshotPath = value();
    else if (argument === "--features") options.featurePath = value();
    else if (argument === "--spatial-split-manifest") {
      options.spatialSplitManifestPath = value();
    } else if (argument === "--companion-neighbor-cache") {
      options.companionNeighborCachePath = value();
    } else if (argument === "--feature-preregistration") {
      options.featurePreregistrationPath = value();
    } else if (argument === "--default-model") {
      options.defaultModelPath = value();
    } else if (argument === "--output") options.outputPath = value();
    else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new SpatialFeaturePreflightError(
        "SPATIAL_FEATURE_PREFLIGHT_OPTIONS_INVALID",
        `未知参数：${argument}`
      );
    }
  }
  return options;
}

function usage() {
  return "用法：node tools/preflight-zhejiang-spatial-feature-diagnostic-cache.js --snapshot <snapshot.sqlite> --features <features.json> --spatial-split-manifest <split.json> --companion-neighbor-cache <neighbor.sqlite> --feature-preregistration <feature.json> --default-model <default.sqlite> --output <preflight.json>";
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

function normalizedPath(path) {
  const absolutePath = resolve(path);
  return process.platform === "win32"
    ? absolutePath.toLowerCase()
    : absolutePath;
}

function assertOptions(options) {
  const missing = [
    "snapshotPath",
    "featurePath",
    "spatialSplitManifestPath",
    "companionNeighborCachePath",
    "featurePreregistrationPath",
    "defaultModelPath",
    "outputPath"
  ].filter((key) => !options[key]);
  if (missing.length) {
    throw new SpatialFeaturePreflightError(
      "SPATIAL_FEATURE_PREFLIGHT_OPTIONS_INVALID",
      "预检缺少必需路径。",
      { missing }
    );
  }
  const paths = Object.fromEntries(
    Object.entries(options)
      .filter(([key]) => key.endsWith("Path"))
      .map(([key, value]) => [key, resolve(value)])
  );
  const inputs = [
    paths.snapshotPath,
    paths.featurePath,
    paths.spatialSplitManifestPath,
    paths.companionNeighborCachePath,
    `${paths.companionNeighborCachePath}.sha256`,
    paths.featurePreregistrationPath,
    paths.defaultModelPath
  ].map(normalizedPath);
  if (inputs.includes(normalizedPath(paths.outputPath))) {
    throw new SpatialFeaturePreflightError(
      "SPATIAL_FEATURE_PREFLIGHT_PATH_CONFLICT",
      "预检输出不得覆盖输入。"
    );
  }
  if (
    existsSync(paths.outputPath) ||
    existsSync(`${paths.outputPath}.sha256`)
  ) {
    throw new SpatialFeaturePreflightError(
      "SPATIAL_FEATURE_PREFLIGHT_OUTPUT_EXISTS",
      "预检输出或 SHA sidecar 已存在。"
    );
  }
  return paths;
}

function commandArguments(
  command,
  expectedTool,
  { nodeMaxOldSpaceSizeMb = null } = {}
) {
  const text = String(command || "");
  if (!text || /[\r\n]/.test(text)) {
    throw new SpatialFeaturePreflightError(
      "SPATIAL_FEATURE_PREFLIGHT_COMMAND_INVALID",
      "冻结命令必须独占一行。"
    );
  }
  const tokens = text.trim().split(/\s+/);
  const expectedNodeOptions =
    nodeMaxOldSpaceSizeMb == null
      ? []
      : [`--max-old-space-size=${Number(nodeMaxOldSpaceSizeMb)}`];
  const toolIndex = 1 + expectedNodeOptions.length;
  if (
    tokens[0] !== "node" ||
    canonicalJson(tokens.slice(1, toolIndex)) !==
      canonicalJson(expectedNodeOptions) ||
    tokens[toolIndex]?.replaceAll("\\", "/") !== expectedTool
  ) {
    throw new SpatialFeaturePreflightError(
      "SPATIAL_FEATURE_PREFLIGHT_COMMAND_INVALID",
      `冻结命令必须调用 ${expectedTool}。`
    );
  }
  return tokens.slice(toolIndex + 1);
}

function assertFrozenBuildCommand(preregistration) {
  const buildOptions = parseBuildArguments(
    commandArguments(
      preregistration?.commands?.cacheBuild,
      "tools/build-zhejiang-prediction-model.js",
      {
        nodeMaxOldSpaceSizeMb:
          preregistration?.runtime?.nodeMaxOldSpaceSizeMb
      }
    )
  );
  validateBuildSafetyOptions({
    ...DEFAULT_OPTIONS,
    ...buildOptions,
    continuousHabitatKernel:
      DEFAULT_OPTIONS.continuousHabitatKernel,
    neighborPolicyDiagnosticContract:
      DEFAULT_OPTIONS.neighborPolicyDiagnosticContract,
    multiscaleSpatialFeatureContract:
      DEFAULT_OPTIONS.multiscaleSpatialFeatureContract,
    qualityGate: PRODUCTION_QUALITY_GATE,
    holdoutEvaluation: DEFAULT_OPTIONS.holdoutEvaluation,
    unitThresholds: DEFAULT_OPTIONS.unitThresholds,
    bandwidthCandidates: DEFAULT_OPTIONS.bandwidthCandidates,
    priorStrengthMultipliers:
      DEFAULT_OPTIONS.priorStrengthMultipliers,
    priorStrengths: DEFAULT_OPTIONS.priorStrengths,
    novelGridAdminExposureCapsByPrevalence:
      DEFAULT_OPTIONS.novelGridAdminExposureCapsByPrevalence
  });
  const expectedPaths = {
    sourcePath: preregistration.inputs.sourceSnapshotPath,
    snapshotPath: preregistration.inputs.sourceSnapshotPath,
    outputPath: preregistration.outputs.modelPath,
    spatialSplitManifestPath:
      preregistration.inputs.spatialSplitPath,
    habitatFeaturesPath: preregistration.inputs.featurePath,
    companionNeighborPolicyOofCachePath:
      preregistration.companion.path,
    writeSpatialFeatureDiagnosticCachePath:
      preregistration.outputs.featureCachePath,
    spatialFeaturePreregistrationPath:
      preregistration.preregistrationPath
  };
  const pathMismatches = Object.entries(expectedPaths)
    .filter(
      ([key, expected]) =>
        normalizedPath(buildOptions[key] || "") !==
        normalizedPath(expected || "")
    )
    .map(([key]) => key);
  const valueMismatches = [];
  if (buildOptions.modelVersion !== preregistration.modelVersion) {
    valueMismatches.push("modelVersion");
  }
  if (buildOptions.workers !== preregistration.runtime.workers) {
    valueMismatches.push("workers");
  }
  if (
    buildOptions.habitatModel !==
    DEFAULT_OPTIONS.continuousHabitatKernel.id
  ) {
    valueMismatches.push("habitatModel");
  }
  if (
    preregistration?.companion?.mode !==
      "existing_read_only" ||
    preregistration?.companion?.immutableReadOnly !== true
  ) {
    valueMismatches.push("companion.mode");
  }
  if (pathMismatches.length || valueMismatches.length) {
    throw new SpatialFeaturePreflightError(
      "SPATIAL_FEATURE_PREFLIGHT_COMMAND_INVALID",
      "冻结构建命令与特征预登记不一致。",
      { pathMismatches, valueMismatches }
    );
  }
  return buildOptions;
}

function outputTargets(preregistration) {
  return [
    preregistration.outputs.modelPath,
    `${preregistration.outputs.modelPath}.sha256`,
    preregistration.outputs.buildReportPath,
    `${preregistration.outputs.buildReportPath}.sha256`,
    preregistration.outputs.featureCachePath,
    `${preregistration.outputs.featureCachePath}.sha256`,
    preregistration.outputs.stdoutPath,
    preregistration.outputs.stderrPath
  ].map((path) => resolve(path));
}

function run(options) {
  const paths = assertOptions(options);
  const preregistration = JSON.parse(
    readFileSync(paths.featurePreregistrationPath, "utf8")
  );
  const snapshotSha256 = sha256File(paths.snapshotPath);
  const featureSet = loadHabitatFeatureSet(paths.featurePath, {
    expectedSnapshotSha256: snapshotSha256,
    expectedContractId: CONTINUOUS_HABITAT_FEATURE_CONTRACT.id
  });
  const verifiedSpatialSplit = verifySpatialSplitManifest({
    manifestPath: paths.spatialSplitManifestPath,
    sourceSnapshotSha256: snapshotSha256,
    panelName: "development"
  });
  const profileModel =
    buildMultiscaleSpatialFeatureProfiles(featureSet);
  const implementationSha256 = predictionImplementationSha256();
  validateSpatialFeatureDiagnosticPreregistration(
    preregistration,
    {
      sourceSnapshotSha256: snapshotSha256,
      verifiedSpatialSplit,
      habitatFeatureSet: featureSet,
      profileModel,
      predictionImplementationSha256: implementationSha256,
      modelOutputPath: preregistration.outputs.modelPath,
      companionNeighborCachePath:
        paths.companionNeighborCachePath,
      companionMode: "existing_read_only",
      featureCacheOutputPath:
        preregistration.outputs.featureCachePath,
      modelVersion: preregistration.modelVersion
    }
  );
  assertFrozenBuildCommand(preregistration);
  const defaultModelSha256 = sha256File(paths.defaultModelPath);
  if (
    defaultModelSha256 !==
    preregistration.protectedState.defaultModelSha256
  ) {
    throw new SpatialFeaturePreflightError(
      "SPATIAL_FEATURE_PREFLIGHT_DEFAULT_MODEL_MISMATCH",
      "默认模型 SHA 与冻结保护状态不一致。"
    );
  }
  const existingTargets = outputTargets(preregistration).filter(
    existsSync
  );
  if (existingTargets.length) {
    throw new SpatialFeaturePreflightError(
      "SPATIAL_FEATURE_PREFLIGHT_OUTPUT_EXISTS",
      "冻结构建目标已存在，禁止覆盖。",
      { existingTargets }
    );
  }
  const report = {
    schemaVersion: 1,
    kind: "zhejiang_multiscale_spatial_feature_preflight_v1",
    ok: true,
    diagnosticOnly: true,
    sealedPanelViewed: false,
    snapshotSha256,
    spatialSplitFileSha256: verifiedSpatialSplit.fileSha256,
    spatialSplitManifestHash:
      verifiedSpatialSplit.manifestHash,
    featureFileSha256: featureSet.fileSha256,
    featureSetSha256: featureSet.featureSetSha256,
    multiscaleFeatureContractSha256:
      multiscaleSpatialFeatureContractSha256(),
    multiscaleFeatureGenerationImplementationSha256:
      multiscaleSpatialFeatureGenerationImplementationSha256(),
    profileModelSha256: profileModel.profileModelSha256,
    profileSummary: profileModel.summary,
    companionNeighborCacheSha256:
      sha256File(paths.companionNeighborCachePath),
    cacheGenerationImplementationSha256:
      spatialFeatureDiagnosticCacheGenerationImplementationSha256(),
    predictionImplementationSha256: implementationSha256,
    preflightImplementationSha256:
      preflightImplementationSha256(),
    defaultModelSha256,
    outputsAbsent: true,
    commandSha256: createHash("sha256")
      .update(preregistration.commands.cacheBuild, "utf8")
      .digest("hex")
  };
  const temporaryPath = `${paths.outputPath}.building-${process.pid}`;
  const sidecarPath = `${paths.outputPath}.sha256`;
  const temporarySidecar = `${sidecarPath}.building-${process.pid}`;
  safeUnlink(temporaryPath);
  safeUnlink(temporarySidecar);
  mkdirSync(dirname(paths.outputPath), { recursive: true });
  writeFileSync(
    temporaryPath,
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );
  const fileSha256 = sha256File(temporaryPath);
  writeFileSync(
    temporarySidecar,
    `${fileSha256}  ${paths.outputPath.split(/[\\/]/).pop()}\n`,
    "utf8"
  );
  renameSync(temporaryPath, paths.outputPath);
  renameSync(temporarySidecar, sidecarPath);
  return {
    ...report,
    path: paths.outputPath,
    sidecarPath,
    fileSha256
  };
}

if (require.main === module) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${usage()}\n`);
    } else {
      process.stdout.write(`${JSON.stringify(run(options), null, 2)}\n`);
    }
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({
        ok: false,
        code: error.code || "SPATIAL_FEATURE_PREFLIGHT_FAILED",
        message: error.message,
        details: error.details
      }, null, 2)}\n`
    );
    process.exitCode = 1;
  }
}

module.exports = {
  SpatialFeaturePreflightError,
  assertFrozenBuildCommand,
  parseArguments,
  preflightImplementationSha256,
  run,
  usage
};
