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
  SpatialLandcoverBasisError,
  buildLandcoverBasis,
  buildSpatialLandcoverBasisReport,
  validatePreregistration
} = require("../server/prediction/spatial-landcover-basis-candidate");
const {
  sha256File
} = require("../server/prediction/spatial-oof-cache");
const {
  verifySpatialSplitManifest
} = require("../server/prediction/spatial-transfer");

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = () => {
      index += 1;
      if (index >= argv.length) {
        throw new SpatialLandcoverBasisError(
          "SPATIAL_LANDCOVER_BASIS_OPTIONS_INVALID",
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
    } else if (argument === "--output") {
      options.outputPath = value();
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new SpatialLandcoverBasisError(
        "SPATIAL_LANDCOVER_BASIS_OPTIONS_INVALID",
        `未知参数：${argument}。`
      );
    }
  }
  return options;
}

function usage() {
  return "用法：node tools/score-zhejiang-spatial-landcover-basis.js --neighbor-cache <v9-r2.sqlite> --feature-cache <v10.sqlite> --v10-report <v10.report.json> --v11-report <v11.json> --snapshot <snapshot.sqlite> --features <features.json> --spatial-split-manifest <split.json> --preregistration <v12.json> --output <diagnostic.json>";
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
    "outputPath"
  ];
  const missing = required.filter((key) => !options[key]);
  if (missing.length) {
    throw new SpatialLandcoverBasisError(
      "SPATIAL_LANDCOVER_BASIS_OPTIONS_INVALID",
      "v12 诊断缺少必需路径。",
      { missing }
    );
  }
  const paths = Object.fromEntries(
    required.map((key) => [key, resolve(options[key])])
  );
  const inputs = new Set(
    required
      .filter((key) => key !== "outputPath")
      .map((key) => paths[key])
  );
  if (
    inputs.has(paths.outputPath) ||
    existsSync(paths.outputPath) ||
    existsSync(`${paths.outputPath}.sha256`)
  ) {
    throw new SpatialLandcoverBasisError(
      "SPATIAL_LANDCOVER_BASIS_OUTPUT_EXISTS",
      "v12 输出不得覆盖输入或已有诊断。"
    );
  }
  return paths;
}

function run(options) {
  const paths = assertOptions(options);
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
  const preregistration = JSON.parse(
    readFileSync(paths.preregistrationPath, "utf8")
  );
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
      outputPath: paths.outputPath
    });
    const v10Report = JSON.parse(
      readFileSync(paths.v10ReportPath, "utf8")
    );
    const v11Report = JSON.parse(
      readFileSync(paths.v11ReportPath, "utf8")
    );
    const report = buildSpatialLandcoverBasisReport({
      neighborCache,
      featureCache,
      v10Report,
      v11Report
    });
    const temporaryOutput =
      `${paths.outputPath}.building-${process.pid}`;
    const sidecarPath = `${paths.outputPath}.sha256`;
    const temporarySidecar =
      `${sidecarPath}.building-${process.pid}`;
    safeUnlink(temporaryOutput);
    safeUnlink(temporarySidecar);
    mkdirSync(dirname(paths.outputPath), { recursive: true });
    let outputPublished = false;
    let sidecarPublished = false;
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
      outputPublished = true;
      renameSync(temporarySidecar, sidecarPath);
      sidecarPublished = true;
      return {
        ok: true,
        outputPath: paths.outputPath,
        sidecarPath,
        reportSha256,
        diagnosticOnly: true,
        sealedPanelViewed: false,
        runtimeIntegrationEligible:
          report.runtimeIntegrationEligible,
        recommendation: report.recommendation
      };
    } catch (error) {
      safeUnlink(temporaryOutput);
      safeUnlink(temporarySidecar);
      if (sidecarPublished) safeUnlink(sidecarPath);
      if (outputPublished) safeUnlink(paths.outputPath);
      throw error;
    }
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
          "SPATIAL_LANDCOVER_BASIS_FAILED",
        message: error.message,
        details: error.details
      }, null, 2)}\n`
    );
    process.exitCode = 1;
  }
}

module.exports = {
  assertOptions,
  parseArguments,
  run,
  usage
};
