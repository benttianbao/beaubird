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
  NEIGHBOR_POLICY_DIAGNOSTIC_CONTRACT,
  assertStructuralCandidateAlignment,
  neighborPolicyDiagnosticContractSha256
} = require("../server/prediction/continuous-habitat-neighbor-policies");
const {
  EXPECTED_NEIGHBOR_POLICY_CACHE_LAYOUT,
  PRIVACY_CONTRACT,
  assertPrivacySafe,
  neighborPolicyOofCacheGenerationImplementationSha256,
  validateNeighborPolicyCachePreregistration
} = require("../server/prediction/neighbor-policy-oof-cache");
const {
  neighborPolicyCandidateScorerImplementationSha256
} = require("../server/prediction/neighbor-policy-candidate-scorer");
const { sha256File } = require("../server/prediction/spatial-oof-cache");
const {
  verifySpatialSplitManifest
} = require("../server/prediction/spatial-transfer");
const {
  DEFAULT_OPTIONS,
  PRODUCTION_QUALITY_GATE,
  parseCliArguments: parseBuildArguments,
  predictionImplementationSha256,
  validateBuildSafetyOptions
} = require("./build-zhejiang-prediction-model");
const {
  parseArguments: parseScoringArguments
} = require("./score-zhejiang-neighbor-policy-oof-cache");

const PREFLIGHT_SCHEMA_VERSION = 1;
const PREFLIGHT_KIND =
  "zhejiang_neighbor_policy_oof_cache_v9_preflight";

class NeighborPolicyPreflightError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "NeighborPolicyPreflightError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function preflightImplementationSha256(
  projectRoot = resolve(__dirname, "..")
) {
  const relativePath =
    "tools/preflight-zhejiang-neighbor-policy-oof-cache.js";
  return createHash("sha256")
    .update(relativePath)
    .update("\0")
    .update(readFileSync(resolve(projectRoot, relativePath)))
    .update("\0")
    .digest("hex");
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = () => {
      index += 1;
      if (index >= argv.length) {
        throw new NeighborPolicyPreflightError(
          "NEIGHBOR_POLICY_PREFLIGHT_OPTIONS_INVALID",
          `${argument} is missing a value.`
        );
      }
      return argv[index];
    };
    if (argument === "--snapshot") options.snapshotPath = value();
    else if (argument === "--features") options.featurePath = value();
    else if (argument === "--spatial-split-manifest") {
      options.spatialSplitManifestPath = value();
    } else if (argument === "--preregistration") {
      options.preregistrationPath = value();
    } else if (argument === "--default-model") {
      options.defaultModelPath = value();
    } else if (argument === "--output") options.outputPath = value();
    else if (argument === "--help" || argument === "-h") options.help = true;
    else {
      throw new NeighborPolicyPreflightError(
        "NEIGHBOR_POLICY_PREFLIGHT_OPTIONS_INVALID",
        `Unknown argument: ${argument}.`
      );
    }
  }
  return options;
}

function usage() {
  return "Usage: node tools/preflight-zhejiang-neighbor-policy-oof-cache.js --snapshot <snapshot.sqlite> --features <features.json> --spatial-split-manifest <split.json> --preregistration <preregistration.json> --default-model <default.sqlite> --output <preflight.json>";
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
    "preregistrationPath",
    "defaultModelPath",
    "outputPath"
  ].filter((key) => !options[key]);
  if (missing.length) {
    throw new NeighborPolicyPreflightError(
      "NEIGHBOR_POLICY_PREFLIGHT_OPTIONS_INVALID",
      "snapshot, features, split, preregistration, default model, and output are required.",
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
    paths.preregistrationPath,
    paths.defaultModelPath
  ].map(normalizedPath);
  if (inputs.includes(normalizedPath(paths.outputPath))) {
    throw new NeighborPolicyPreflightError(
      "NEIGHBOR_POLICY_PREFLIGHT_PATH_CONFLICT",
      "The preflight output must not overwrite an input."
    );
  }
  if (
    existsSync(paths.outputPath) ||
    existsSync(`${paths.outputPath}.sha256`)
  ) {
    throw new NeighborPolicyPreflightError(
      "NEIGHBOR_POLICY_PREFLIGHT_OUTPUT_EXISTS",
      "The preflight output or SHA sidecar already exists.",
      { outputPath: paths.outputPath }
    );
  }
  return paths;
}

function frozenQualityThresholds() {
  return {
    ...PRODUCTION_QUALITY_GATE,
    maximumRelativeBrierDegradation: 0.01,
    maximumEceDegradation: 0.01
  };
}

function commandArguments(
  command,
  expectedTool,
  { nodeMaxOldSpaceSizeMb = null } = {}
) {
  const text = String(command || "");
  if (!text || /[\r\n]/.test(text)) {
    throw new NeighborPolicyPreflightError(
      "NEIGHBOR_POLICY_PREFLIGHT_COMMAND_INVALID",
      "Frozen commands must each occupy exactly one line."
    );
  }
  const tokens = text.trim().split(/\s+/);
  const expectedNodeOptions = nodeMaxOldSpaceSizeMb == null
    ? []
    : [`--max-old-space-size=${Number(nodeMaxOldSpaceSizeMb)}`];
  const toolIndex = 1 + expectedNodeOptions.length;
  if (
    tokens[0] !== "node" ||
    JSON.stringify(tokens.slice(1, toolIndex)) !==
      JSON.stringify(expectedNodeOptions) ||
    tokens[toolIndex]?.replaceAll("\\", "/") !== expectedTool
  ) {
    throw new NeighborPolicyPreflightError(
      "NEIGHBOR_POLICY_PREFLIGHT_COMMAND_INVALID",
      `Frozen command must invoke ${expectedTool} with the preregistered Node runtime options.`
    );
  }
  return tokens.slice(toolIndex + 1);
}

function assertFrozenCommands(preregistration) {
  const buildOptions = parseBuildArguments(
    commandArguments(
      preregistration?.commands?.cacheBuild,
      "tools/build-zhejiang-prediction-model.js",
      {
        nodeMaxOldSpaceSizeMb:
          preregistration?.runtime?.nodeMaxOldSpaceSizeMb ?? null
      }
    )
  );
  validateBuildSafetyOptions({
    ...DEFAULT_OPTIONS,
    ...buildOptions,
    continuousHabitatKernel:
      DEFAULT_OPTIONS.continuousHabitatKernel,
    neighborPolicyDiagnosticContract:
      NEIGHBOR_POLICY_DIAGNOSTIC_CONTRACT,
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
  const expectedBuildPaths = {
    sourcePath: preregistration.inputs.sourceSnapshotPath,
    snapshotPath: preregistration.inputs.sourceSnapshotPath,
    outputPath: preregistration.outputs.modelPath,
    spatialSplitManifestPath:
      preregistration.inputs.spatialSplitPath,
    habitatFeaturesPath:
      preregistration.inputs.featurePath,
    writeNeighborPolicyOofCachePath:
      preregistration.outputs.cachePath,
    neighborPolicyPreregistrationPath:
      preregistration.preregistrationPath
  };
  const buildPathMismatches = Object.entries(expectedBuildPaths)
    .filter(
      ([key, expected]) =>
        normalizedPath(buildOptions[key] || "") !==
        normalizedPath(expected || "")
    )
    .map(([key]) => key);
  const buildValueMismatches = [];
  if (
    buildOptions.modelVersion !==
    preregistration.outputs.modelVersion
  ) {
    buildValueMismatches.push("modelVersion");
  }
  if (
    buildOptions.habitatModel !==
    DEFAULT_OPTIONS.continuousHabitatKernel.id
  ) {
    buildValueMismatches.push("habitatModel");
  }
  if (buildPathMismatches.length || buildValueMismatches.length) {
    throw new NeighborPolicyPreflightError(
      "NEIGHBOR_POLICY_PREFLIGHT_COMMAND_INVALID",
      "The frozen build command does not match the preregistered paths and model identity.",
      {
        pathMismatches: buildPathMismatches,
        valueMismatches: buildValueMismatches
      }
    );
  }
  if (buildOptions.coordinateSystemConfirmed !== true) {
    throw new NeighborPolicyPreflightError(
      "NEIGHBOR_POLICY_PREFLIGHT_COMMAND_INVALID",
      "The frozen cache command must confirm BD-09 coordinates."
    );
  }
  if (
    preregistration?.runtime &&
    (
      !Number.isInteger(
        Number(preregistration.runtime.nodeMaxOldSpaceSizeMb)
      ) ||
      Number(preregistration.runtime.nodeMaxOldSpaceSizeMb) < 4096 ||
      Number(preregistration.runtime.nodeMaxOldSpaceSizeMb) > 16384 ||
      Number(preregistration.runtime.workers) !==
        Number(buildOptions.workers)
    )
  ) {
    throw new NeighborPolicyPreflightError(
      "NEIGHBOR_POLICY_PREFLIGHT_RUNTIME_INVALID",
      "The preregistered Node heap limit or worker count is invalid.",
      { runtime: preregistration.runtime }
    );
  }
  const scoringOptions = parseScoringArguments(
    commandArguments(
      preregistration?.commands?.candidateScoring,
      "tools/score-zhejiang-neighbor-policy-oof-cache.js"
    )
  );
  const expectedScoringPaths = {
    cachePath: preregistration.outputs.cachePath,
    snapshotPath: preregistration.inputs.sourceSnapshotPath,
    spatialSplitManifestPath:
      preregistration.inputs.spatialSplitPath,
    preregistrationPath:
      preregistration.preregistrationPath,
    outputPath: preregistration.scoring.outputPath
  };
  const mismatches = Object.entries(expectedScoringPaths)
    .filter(
      ([key, expected]) =>
        normalizedPath(scoringOptions[key] || "") !==
        normalizedPath(expected || "")
    )
    .map(([key]) => key);
  if (mismatches.length) {
    throw new NeighborPolicyPreflightError(
      "NEIGHBOR_POLICY_PREFLIGHT_COMMAND_INVALID",
      "The frozen scoring command does not match the preregistered paths.",
      { mismatches }
    );
  }
  return { buildOptions, scoringOptions };
}

function outputTargets(preregistration) {
  return [
    preregistration.outputs.modelPath,
    `${preregistration.outputs.modelPath}.sha256`,
    preregistration.outputs.buildReportPath,
    `${preregistration.outputs.buildReportPath}.sha256`,
    preregistration.outputs.cachePath,
    `${preregistration.outputs.cachePath}.sha256`,
    preregistration.scoring.outputPath,
    `${preregistration.scoring.outputPath}.sha256`,
    preregistration.outputs.stdoutPath,
    preregistration.outputs.stderrPath
  ].map((path) => resolve(path));
}

function run(options) {
  const paths = assertOptions(options);
  const preregistration = JSON.parse(
    readFileSync(paths.preregistrationPath, "utf8")
  );
  if (
    normalizedPath(preregistration.preregistrationPath || "") !==
    normalizedPath(paths.preregistrationPath)
  ) {
    throw new NeighborPolicyPreflightError(
      "NEIGHBOR_POLICY_PREFLIGHT_PREREGISTRATION_PATH_MISMATCH",
      "The preregistration does not bind its own path."
    );
  }
  if (
    normalizedPath(preregistration.preflight?.outputPath || "") !==
    normalizedPath(paths.outputPath) ||
    preregistration.preflight?.implementationSha256 !==
      preflightImplementationSha256()
  ) {
    throw new NeighborPolicyPreflightError(
      "NEIGHBOR_POLICY_PREFLIGHT_BINDING_MISMATCH",
      "The preregistered preflight path or implementation hash drifted."
    );
  }
  const sourceSnapshotSha256 = sha256File(paths.snapshotPath);
  const verifiedSpatialSplit = verifySpatialSplitManifest({
    manifestPath: paths.spatialSplitManifestPath,
    sourceSnapshotSha256,
    panelName: "development",
    sealedPanelConfirmation: null
  });
  const habitatFeatureSet = loadHabitatFeatureSet(paths.featurePath, {
    expectedSnapshotSha256: sourceSnapshotSha256,
    expectedContractId: CONTINUOUS_HABITAT_FEATURE_CONTRACT.id
  });
  validateNeighborPolicyCachePreregistration(preregistration, {
    sourceSnapshotSha256,
    verifiedSpatialSplit,
    habitatFeatureSet,
    predictionImplementationSha256:
      predictionImplementationSha256(),
    qualityThresholds: frozenQualityThresholds(),
    modelOutputPath: preregistration.outputs.modelPath,
    cacheOutputPath: preregistration.outputs.cachePath,
    modelVersion: preregistration.outputs.modelVersion
  });
  if (
    preregistration.implementation.scorerImplementationSha256 !==
      neighborPolicyCandidateScorerImplementationSha256()
  ) {
    throw new NeighborPolicyPreflightError(
      "NEIGHBOR_POLICY_PREFLIGHT_SCORER_MISMATCH",
      "The candidate scorer implementation hash drifted."
    );
  }
  assertStructuralCandidateAlignment();
  assertPrivacySafe(preregistration, "preregistration");
  const frozenCommands = assertFrozenCommands(preregistration);
  const auditPath = resolve(
    preregistration.inputs.targetIndependentAuditPath
  );
  const auditSha256 = sha256File(auditPath);
  const audit = JSON.parse(readFileSync(auditPath, "utf8"));
  if (
    auditSha256 !==
      preregistration.inputs.targetIndependentAuditSha256 ||
    JSON.stringify(audit.sourceCardinality) !==
      JSON.stringify(preregistration.inputs.sourceCardinality) ||
    audit.coverage?.missingObservedH3R6Count !== 0 ||
    audit.targetIndependence?.sealedLabelsRead !== false
  ) {
    throw new NeighborPolicyPreflightError(
      "NEIGHBOR_POLICY_PREFLIGHT_AUDIT_MISMATCH",
      "The target-independent source audit does not match the frozen preregistration."
    );
  }
  const defaultModelSha256 = sha256File(paths.defaultModelPath);
  if (
    normalizedPath(preregistration.protectedState.defaultModelPath) !==
      normalizedPath(paths.defaultModelPath) ||
    preregistration.protectedState.defaultModelSha256 !==
      defaultModelSha256
  ) {
    throw new NeighborPolicyPreflightError(
      "NEIGHBOR_POLICY_PREFLIGHT_DEFAULT_MODEL_MISMATCH",
      "The protected default model changed."
    );
  }
  const targets = outputTargets(preregistration);
  const existingTargets = targets.filter(existsSync);
  if (existingTargets.length) {
    throw new NeighborPolicyPreflightError(
      "NEIGHBOR_POLICY_PREFLIGHT_TARGET_EXISTS",
      "A frozen build, log, cache, or scoring target already exists.",
      { existingTargets }
    );
  }
  const report = {
    schemaVersion: PREFLIGHT_SCHEMA_VERSION,
    kind: PREFLIGHT_KIND,
    readyForExplicitApproval: true,
    longBuildStarted: false,
    diagnosticOnly: true,
    sealedPanelViewed: false,
    defaultModelModified: false,
    preregistration: {
      path: preregistration.preregistrationPath,
      fileSha256: sha256File(paths.preregistrationPath)
    },
    implementation: {
      preflightImplementationSha256:
        preflightImplementationSha256(),
      predictionImplementationSha256:
        predictionImplementationSha256(),
      cacheGenerationImplementationSha256:
        neighborPolicyOofCacheGenerationImplementationSha256(),
      scorerImplementationSha256:
        neighborPolicyCandidateScorerImplementationSha256(),
      contractSha256:
        neighborPolicyDiagnosticContractSha256()
    },
    inputs: {
      sourceSnapshotSha256,
      spatialSplitFileSha256: verifiedSpatialSplit.fileSha256,
      spatialSplitManifestHash: verifiedSpatialSplit.manifestHash,
      featureFileSha256: habitatFeatureSet.fileSha256,
      featureSetSha256: habitatFeatureSet.featureSetSha256,
      tileManifestSha256:
        habitatFeatureSet.tileManifestSha256,
      featureGenerationImplementationSha256:
        habitatFeatureSet.generationImplementationSha256,
      targetIndependentAuditSha256: auditSha256
    },
    expectedLayout: EXPECTED_NEIGHBOR_POLICY_CACHE_LAYOUT,
    qualityThresholds: frozenQualityThresholds(),
    privacyContract: PRIVACY_CONTRACT,
    checks: {
      frozenDevelopmentSplit: true,
      sourceAndFeatureBindingsMatch: true,
      sourceCardinalityMatches: true,
      executablePoliciesAligned: true,
      buildCommandSafetyValidated: true,
      scoringCommandSafetyValidated: true,
      allOutputTargetsAbsent: true,
      defaultModelHashPreserved: true,
      sealedLabelsRead: false,
      duplicateProcessCheck:
        "required_immediately_before_explicitly_approved_launch"
    },
    frozenCommands: {
      cacheBuild: preregistration.commands.cacheBuild,
      candidateScoring:
        preregistration.commands.candidateScoring,
      buildWorkers: frozenCommands.buildOptions.workers,
      nodeMaxOldSpaceSizeMb:
        preregistration.runtime?.nodeMaxOldSpaceSizeMb ?? null
    },
    nextAction:
      "wait_for_explicit_approval_before_single_long_development_cache_build"
  };
  assertPrivacySafe(report, "report");
  const temporaryOutput = `${paths.outputPath}.building-${process.pid}`;
  const sidecarPath = `${paths.outputPath}.sha256`;
  const temporarySidecar = `${sidecarPath}.building-${process.pid}`;
  mkdirSync(dirname(paths.outputPath), { recursive: true });
  safeUnlink(temporaryOutput);
  safeUnlink(temporarySidecar);
  let publishedOutput = false;
  let publishedSidecar = false;
  try {
    writeFileSync(
      temporaryOutput,
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8"
    );
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
      readyForExplicitApproval: true,
      longBuildStarted: false,
      sealedPanelViewed: false,
      defaultModelModified: false
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
          code: error.code || "NEIGHBOR_POLICY_PREFLIGHT_FAILED",
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
  NeighborPolicyPreflightError,
  PREFLIGHT_KIND,
  PREFLIGHT_SCHEMA_VERSION,
  assertFrozenCommands,
  assertOptions,
  parseArguments,
  preflightImplementationSha256,
  run,
  usage
};
