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
  openNeighborPolicyOofCache
} = require("../server/prediction/neighbor-policy-oof-cache");
const {
  openSpatialFeatureDiagnosticCache
} = require("../server/prediction/spatial-feature-diagnostic-cache");
const {
  SpatialProfileCalibrationError,
  buildSpatialProfileCalibrationReport,
  validateSpatialProfileCalibrationPreregistration
} = require("../server/prediction/spatial-profile-calibration-candidate");
const {
  CONTINUOUS_HABITAT_FEATURE_CONTRACT,
  loadHabitatFeatureSet
} = require("../server/prediction/habitat-features");
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
        throw new SpatialProfileCalibrationError(
          "SPATIAL_PROFILE_OPTIONS_INVALID",
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
      throw new SpatialProfileCalibrationError(
        "SPATIAL_PROFILE_OPTIONS_INVALID",
        `未知参数：${argument}。sealed、发布和自由调参选项均被禁止。`
      );
    }
  }
  return options;
}

function usage() {
  return "用法：node tools/score-zhejiang-spatial-profile-calibration.js --neighbor-cache <v9-r2.sqlite> --feature-cache <v10.sqlite> --v10-report <v10.report.json> --snapshot <snapshot.sqlite> --features <features.json> --spatial-split-manifest <split.json> --preregistration <v11.json> --output <diagnostic.json>";
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
    "snapshotPath",
    "featuresPath",
    "spatialSplitManifestPath",
    "preregistrationPath",
    "outputPath"
  ];
  const missing = required.filter((key) => !options[key]);
  if (missing.length) {
    throw new SpatialProfileCalibrationError(
      "SPATIAL_PROFILE_OPTIONS_INVALID",
      "v11 诊断缺少必需输入。",
      { missing }
    );
  }
  const paths = Object.fromEntries(
    required.map((key) => [key, resolve(options[key])])
  );
  const outputKey = process.platform === "win32"
    ? paths.outputPath.toLowerCase()
    : paths.outputPath;
  const inputKeys = required
    .filter((key) => key !== "outputPath")
    .map((key) =>
      process.platform === "win32"
        ? paths[key].toLowerCase()
        : paths[key]
    );
  if (inputKeys.includes(outputKey)) {
    throw new SpatialProfileCalibrationError(
      "SPATIAL_PROFILE_PATH_CONFLICT",
      "v11 诊断输出不得覆盖任何输入。"
    );
  }
  if (
    existsSync(paths.outputPath) ||
    existsSync(`${paths.outputPath}.sha256`)
  ) {
    throw new SpatialProfileCalibrationError(
      "SPATIAL_PROFILE_OUTPUT_EXISTS",
      "v11 诊断输出或 SHA sidecar 已存在。"
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
    validateSpatialProfileCalibrationPreregistration(
      preregistration,
      {
        neighborCacheSha256: neighborCache.fileSha256,
        neighborCacheGenerationImplementationSha256:
          neighborCache.metadata.generationImplementationSha256,
        featureCacheSha256: featureCache.fileSha256,
        v10ReportSha256,
        outputPath: paths.outputPath
      }
    );
    const v10Report = JSON.parse(
      readFileSync(paths.v10ReportPath, "utf8")
    );
    if (
      v10Report?.releaseQuality?.passed !== false ||
      canonicalFailure(v10Report) !==
        "spatial.species_calibration.maximumEce"
    ) {
      throw new SpatialProfileCalibrationError(
        "SPATIAL_PROFILE_V10_NO_GO_MISMATCH",
        "v10 正式 No-Go 状态与 v11 冻结前提不一致。"
      );
    }
    const report = buildSpatialProfileCalibrationReport({
      neighborCache,
      featureCache,
      v10Report
    });
    const temporaryOutput =
      `${paths.outputPath}.building-${process.pid}`;
    const sidecarPath = `${paths.outputPath}.sha256`;
    const temporarySidecar =
      `${sidecarPath}.building-${process.pid}`;
    mkdirSync(dirname(paths.outputPath), { recursive: true });
    safeUnlink(temporaryOutput);
    safeUnlink(temporarySidecar);
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

function canonicalFailure(report) {
  return [...(report?.releaseQuality?.failures || [])]
    .sort()
    .join(",");
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
          "SPATIAL_PROFILE_CALIBRATION_FAILED",
        message: error.message,
        details: error.details
      }, null, 2)}\n`
    );
    process.exitCode = 1;
  }
}

module.exports = {
  assertOptions,
  canonicalFailure,
  parseArguments,
  run,
  usage
};
