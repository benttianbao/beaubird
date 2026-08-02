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
  openNeighborPolicyOofCache
} = require("../server/prediction/neighbor-policy-oof-cache");
const {
  openSpatialFeatureDiagnosticCache
} = require("../server/prediction/spatial-feature-diagnostic-cache");
const {
  SPATIAL_LANDCOVER_BASIS_CONTRACT,
  SpatialLandcoverBasisError,
  buildLandcoverBasis,
  implementationSha256,
  validatePreregistration
} = require("../server/prediction/spatial-landcover-basis-candidate");
const {
  sha256File
} = require("../server/prediction/spatial-oof-cache");
const { canonicalJson } = require("../server/prediction/spatial-splits");
const {
  verifySpatialSplitManifest
} = require("../server/prediction/spatial-transfer");

const DEFAULT_MODEL_SHA256 =
  "c4d8f759cdb9275b9d9171877d80b339e8796342dd262b380cf99360108ac582";
const PREFLIGHT_FILES = Object.freeze([
  "tools/preflight-zhejiang-spatial-landcover-basis.js",
  "server/prediction/spatial-landcover-basis-candidate.js",
  "tools/score-zhejiang-spatial-landcover-basis.js"
]);

class SpatialLandcoverBasisPreflightError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "SpatialLandcoverBasisPreflightError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function preflightImplementationSha256(
  projectRoot = resolve(__dirname, "..")
) {
  const hash = createHash("sha256");
  for (const relativePath of [...PREFLIGHT_FILES].sort()) {
    hash.update(relativePath);
    hash.update("\0");
    hash.update(readFileSync(resolve(projectRoot, relativePath)));
    hash.update("\0");
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
        throw new SpatialLandcoverBasisPreflightError(
          "SPATIAL_LANDCOVER_BASIS_PREFLIGHT_OPTIONS_INVALID",
          `${argument} 缺少值。`
        );
      }
      return argv[index];
    };
    if (argument === "--neighbor-cache") {
      options.neighborCachePath = value();
    } else if (argument === "--feature-cache") {
      options.featureCachePath = value();
    } else if (argument === "--v10-report") {
      options.v10ReportPath = value();
    } else if (argument === "--v11-report") {
      options.v11ReportPath = value();
    } else if (argument === "--snapshot") {
      options.snapshotPath = value();
    } else if (argument === "--features") {
      options.featuresPath = value();
    } else if (argument === "--spatial-split-manifest") {
      options.spatialSplitManifestPath = value();
    } else if (argument === "--preregistration") {
      options.preregistrationPath = value();
    } else if (argument === "--default-model") {
      options.defaultModelPath = value();
    } else if (argument === "--output") {
      options.outputPath = value();
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new SpatialLandcoverBasisPreflightError(
        "SPATIAL_LANDCOVER_BASIS_PREFLIGHT_OPTIONS_INVALID",
        `未知参数：${argument}。`
      );
    }
  }
  return options;
}

function usage() {
  return "用法：node tools/preflight-zhejiang-spatial-landcover-basis.js --neighbor-cache <v9-r2.sqlite> --feature-cache <v10.sqlite> --v10-report <v10.report.json> --v11-report <v11.json> --snapshot <snapshot.sqlite> --features <features.json> --spatial-split-manifest <split.json> --preregistration <v12.json> --default-model <default.sqlite> --output <preflight.json>";
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
  const required = [
    "neighborCachePath",
    "featureCachePath",
    "v10ReportPath",
    "v11ReportPath",
    "snapshotPath",
    "featuresPath",
    "spatialSplitManifestPath",
    "preregistrationPath",
    "defaultModelPath",
    "outputPath"
  ];
  const missing = required.filter((key) => !options[key]);
  if (missing.length) {
    throw new SpatialLandcoverBasisPreflightError(
      "SPATIAL_LANDCOVER_BASIS_PREFLIGHT_OPTIONS_INVALID",
      "v12 预检缺少必需路径。",
      { missing }
    );
  }
  return Object.fromEntries(
    required.map((key) => [key, resolve(options[key])])
  );
}

function expectedScoringCommand(preregistration) {
  return [
    "node tools/score-zhejiang-spatial-landcover-basis.js",
    `--neighbor-cache ${preregistration.inputs.neighborCachePath}`,
    `--feature-cache ${preregistration.inputs.featureCachePath}`,
    `--v10-report ${preregistration.inputs.v10ReportPath}`,
    `--v11-report ${preregistration.inputs.v11ReportPath}`,
    `--snapshot ${preregistration.inputs.sourceSnapshotPath}`,
    `--features ${preregistration.inputs.featurePath}`,
    `--spatial-split-manifest ${preregistration.inputs.spatialSplitPath}`,
    `--preregistration ${preregistration.preregistrationPath}`,
    `--output ${preregistration.outputs.diagnosticPath}`
  ].join(" ");
}

function assertFrozenCommand(preregistration) {
  const expected = expectedScoringCommand(preregistration);
  if (preregistration?.commands?.candidateScoring !== expected) {
    throw new SpatialLandcoverBasisPreflightError(
      "SPATIAL_LANDCOVER_BASIS_COMMAND_MISMATCH",
      "v12 唯一候选评分命令与冻结路径不一致。",
      {
        expected,
        actual: preregistration?.commands?.candidateScoring
      }
    );
  }
  return expected;
}

function run(options) {
  const paths = assertOptions(options);
  if (
    existsSync(paths.outputPath) ||
    existsSync(`${paths.outputPath}.sha256`)
  ) {
    throw new SpatialLandcoverBasisPreflightError(
      "SPATIAL_LANDCOVER_BASIS_PREFLIGHT_OUTPUT_EXISTS",
      "v12 预检输出或 sidecar 已存在。"
    );
  }
  const preregistration = JSON.parse(
    readFileSync(paths.preregistrationPath, "utf8")
  );
  const diagnosticPath = resolve(
    preregistration?.outputs?.diagnosticPath || ""
  );
  if (
    existsSync(diagnosticPath) ||
    existsSync(`${diagnosticPath}.sha256`)
  ) {
    throw new SpatialLandcoverBasisPreflightError(
      "SPATIAL_LANDCOVER_BASIS_DIAGNOSTIC_OUTPUT_EXISTS",
      "v12 候选诊断已存在，禁止覆盖。"
    );
  }
  const sourceSnapshotSha256 = sha256File(
    paths.snapshotPath
  );
  const verifiedSpatialSplit = verifySpatialSplitManifest({
    manifestPath: paths.spatialSplitManifestPath,
    sourceSnapshotSha256,
    panelName: "development",
    sealedPanelConfirmation: null
  });
  const featureSet = loadHabitatFeatureSet(paths.featuresPath, {
    expectedSnapshotSha256: sourceSnapshotSha256,
    expectedContractId: CONTINUOUS_HABITAT_FEATURE_CONTRACT.id
  });
  const neighborCache = openNeighborPolicyOofCache({
    cachePath: paths.neighborCachePath,
    verifiedSpatialSplit,
    sourceSnapshotSha256,
    generationImplementationSha256:
      preregistration.inputs
        .neighborCacheGenerationImplementationSha256
  });
  const featureCache = openSpatialFeatureDiagnosticCache({
    cachePath: paths.featureCachePath,
    companionNeighborCachePath: paths.neighborCachePath,
    verifiedSpatialSplit,
    sourceSnapshotSha256,
    sourceFeatureFileSha256: featureSet.fileSha256,
    sourceFeatureSetSha256: featureSet.featureSetSha256
  });
  try {
    const v10ReportSha256 = sha256File(paths.v10ReportPath);
    const v11ReportSha256 = sha256File(paths.v11ReportPath);
    const basis = buildLandcoverBasis(featureCache);
    validatePreregistration(preregistration, {
      neighborCacheSha256: neighborCache.fileSha256,
      neighborCacheGenerationImplementationSha256:
        neighborCache.metadata.generationImplementationSha256,
      featureCacheSha256: featureCache.fileSha256,
      v10ReportSha256,
      v11ReportSha256,
      basisModelSha256: basis.basisModelSha256,
      outputPath: diagnosticPath
    });
    if (
      preregistration.implementation
        .preflightImplementationSha256 !==
      preflightImplementationSha256()
    ) {
      throw new SpatialLandcoverBasisPreflightError(
        "SPATIAL_LANDCOVER_BASIS_PREFLIGHT_IMPLEMENTATION_MISMATCH",
        "v12 预检实现哈希不匹配。"
      );
    }
    const v10Report = JSON.parse(
      readFileSync(paths.v10ReportPath, "utf8")
    );
    const v11Report = JSON.parse(
      readFileSync(paths.v11ReportPath, "utf8")
    );
    if (
      v10Report?.releaseQuality?.passed !== false ||
      canonicalJson(v10Report.releaseQuality.failures) !==
        canonicalJson([
          "spatial.species_calibration.maximumEce"
        ]) ||
      v11Report?.runtimeIntegrationEligible !== false ||
      v11Report?.recommendation?.nextAction !==
        "stop_profile_calibration_path_and_reassess_feature_resolution"
    ) {
      throw new SpatialLandcoverBasisPreflightError(
        "SPATIAL_LANDCOVER_BASIS_PRIOR_NO_GO_MISMATCH",
        "v10/v11 No-Go 前提不匹配。"
      );
    }
    const defaultModelSha256 = sha256File(
      paths.defaultModelPath
    );
    if (defaultModelSha256 !== DEFAULT_MODEL_SHA256) {
      throw new SpatialLandcoverBasisPreflightError(
        "SPATIAL_LANDCOVER_BASIS_DEFAULT_MODEL_CHANGED",
        "默认离线模型 SHA 已改变。"
      );
    }
    const command = assertFrozenCommand(preregistration);
    const report = {
      schemaVersion: 1,
      kind:
        "zhejiang_spatial_landcover_basis_v12_preflight",
      ok: true,
      developmentOnly: true,
      diagnosticOnly: true,
      sealedPanelViewed: false,
      sourceSnapshotSha256,
      spatialSplitFileSha256:
        verifiedSpatialSplit.fileSha256,
      spatialSplitManifestHash:
        verifiedSpatialSplit.manifestHash,
      featureFileSha256: featureSet.fileSha256,
      featureSetSha256: featureSet.featureSetSha256,
      neighborCacheSha256: neighborCache.fileSha256,
      neighborCacheGenerationImplementationSha256:
        neighborCache.metadata.generationImplementationSha256,
      featureCacheSha256: featureCache.fileSha256,
      v10ReportSha256,
      v11ReportSha256,
      v11RuntimeIntegrationEligible: false,
      contractSha256: createHash("sha256")
        .update(
          canonicalJson(
            SPATIAL_LANDCOVER_BASIS_CONTRACT
          )
        )
        .digest("hex"),
      basisModelSha256: basis.basisModelSha256,
      scorerImplementationSha256: implementationSha256(),
      preflightImplementationSha256:
        preflightImplementationSha256(),
      defaultModelSha256,
      outputsAbsent: true,
      commandSha256: createHash("sha256")
        .update(command, "utf8")
        .digest("hex")
    };
    const temporaryPath =
      `${paths.outputPath}.building-${process.pid}`;
    const sidecarPath = `${paths.outputPath}.sha256`;
    const temporarySidecar =
      `${sidecarPath}.building-${process.pid}`;
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
  } finally {
    featureCache.close();
    neighborCache.close();
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
          "SPATIAL_LANDCOVER_BASIS_PREFLIGHT_FAILED",
        message: error.message,
        details: error.details
      }, null, 2)}\n`
    );
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_MODEL_SHA256,
  PREFLIGHT_FILES,
  SpatialLandcoverBasisPreflightError,
  assertFrozenCommand,
  expectedScoringCommand,
  parseArguments,
  preflightImplementationSha256,
  run,
  usage
};
