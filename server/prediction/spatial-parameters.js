"use strict";

const { createHash } = require("node:crypto");
const { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } = require("node:fs");
const { dirname, resolve } = require("node:path");
const {
  FROZEN_NOVEL_GRID_ADMIN_EXPOSURE_CAPS_V1,
  verifySpatialSplitManifest
} = require("./spatial-transfer");

const SPATIAL_PARAMETER_SCHEMA_VERSION = 1;
const SPATIAL_PARAMETER_SET = "zhejiang_novel_grid_transfer_v1";

class SpatialParameterError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "SpatialParameterError";
    this.code = code;
    this.details = details;
  }
}

function sha256Buffer(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256File(path) {
  return sha256Buffer(readFileSync(path));
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sameJson(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function validateCalibrators(calibrators) {
  if (!Array.isArray(calibrators) || !calibrators.length) {
    throw new SpatialParameterError(
      "SPATIAL_CALIBRATORS_MISSING",
      "development 报告没有可冻结的空间校准参数。"
    );
  }
  const seen = new Set();
  return calibrators.map((calibrator) => {
    const scope = String(calibrator?.scope || "");
    const fit = calibrator?.fit || {};
    if (
      !/^(species:[^:]+|group:positive_(30_59|60_119|120_199))$/.test(scope) ||
      !fit.fitted ||
      ![fit.a, fit.b, fit.c].every((value) => Number.isFinite(Number(value))) ||
      seen.has(scope)
    ) {
      throw new SpatialParameterError(
        "INVALID_SPATIAL_CALIBRATOR",
        `无效或重复的空间校准参数：${scope || "<empty>"}`
      );
    }
    seen.add(scope);
    return {
      scope,
      fit: {
        a: Number(fit.a),
        b: Number(fit.b),
        c: Number(fit.c),
        fitted: true,
        iterations: Number(fit.iterations) || 0
      }
    };
  }).sort((left, right) => left.scope.localeCompare(right.scope));
}

function validateSpatialParameterArtifact(artifact, expected = {}) {
  if (!artifact || typeof artifact !== "object") {
    throw new SpatialParameterError("INVALID_SPATIAL_PARAMETERS", "空间参数制品不是 JSON 对象。");
  }
  if (
    Number(artifact.schemaVersion) !== SPATIAL_PARAMETER_SCHEMA_VERSION ||
    artifact.parameterSet !== SPATIAL_PARAMETER_SET
  ) {
    throw new SpatialParameterError("INVALID_SPATIAL_PARAMETERS", "空间参数制品版本不受支持。");
  }
  if (!/^[a-f0-9]{64}$/.test(String(artifact.sourceSnapshotSha256 || ""))) {
    throw new SpatialParameterError("INVALID_SPATIAL_PARAMETERS", "空间参数缺少有效快照 SHA-256。");
  }
  if (!/^[a-f0-9]{64}$/.test(String(artifact.spatialSplitManifestHash || ""))) {
    throw new SpatialParameterError("INVALID_SPATIAL_PARAMETERS", "空间参数缺少有效 split manifest hash。");
  }
  if (!sameJson(artifact.adminExposureCapsByPrevalence, FROZEN_NOVEL_GRID_ADMIN_EXPOSURE_CAPS_V1)) {
    throw new SpatialParameterError("SPATIAL_CAPS_CHANGED", "空间参数中的行政层暴露上限不是冻结的 v1 矩阵。");
  }
  const calibrators = validateCalibrators(artifact.calibrators);
  if (
    expected.sourceSnapshotSha256 &&
    String(expected.sourceSnapshotSha256).toLowerCase() !== String(artifact.sourceSnapshotSha256).toLowerCase()
  ) {
    throw new SpatialParameterError("SPATIAL_SNAPSHOT_MISMATCH", "空间参数与当前训练快照不一致。");
  }
  if (
    expected.spatialSplitManifestHash &&
    String(expected.spatialSplitManifestHash).toLowerCase() !==
      String(artifact.spatialSplitManifestHash).toLowerCase()
  ) {
    throw new SpatialParameterError("SPATIAL_SPLIT_MISMATCH", "空间参数与当前冻结 split manifest 不一致。");
  }
  return {
    ...artifact,
    adminExposureCapsByPrevalence: FROZEN_NOVEL_GRID_ADMIN_EXPOSURE_CAPS_V1,
    calibrators
  };
}

function loadSpatialParameterArtifact(path, expected = {}) {
  const resolvedPath = resolve(path);
  let artifact;
  try {
    artifact = JSON.parse(readFileSync(resolvedPath, "utf8"));
  } catch (error) {
    throw new SpatialParameterError(
      "SPATIAL_PARAMETERS_UNREADABLE",
      `无法读取空间参数制品：${error.message}`,
      { path: resolvedPath }
    );
  }
  return {
    path: resolvedPath,
    fileSha256: sha256File(resolvedPath),
    artifact: validateSpatialParameterArtifact(artifact, expected)
  };
}

function freezeSpatialParametersFromDevelopmentReport({ reportPath, splitManifestPath, outputPath }) {
  const resolvedReportPath = resolve(reportPath);
  const resolvedOutputPath = resolve(outputPath);
  if (existsSync(resolvedOutputPath)) {
    throw new SpatialParameterError("SPATIAL_PARAMETERS_EXIST", `空间参数输出已存在：${resolvedOutputPath}`);
  }
  const reportBuffer = readFileSync(resolvedReportPath);
  const report = JSON.parse(reportBuffer.toString("utf8"));
  const sourceSnapshotSha256 = String(report.source?.snapshotSha256 || "").toLowerCase();
  const split = verifySpatialSplitManifest({
    manifestPath: splitManifestPath,
    sourceSnapshotSha256,
    panelName: "development"
  });
  const spatial = report.spatial || report.releaseQuality?.spatial;
  const failures = (report.releaseQuality?.failures || []).filter((failure) =>
    String(failure).startsWith("spatial.")
  );
  if (
    spatial?.splitManifest?.panel !== "development" ||
    spatial?.splitManifest?.sealedPanelViewed !== false ||
    spatial?.splitManifest?.manifestHash !== split.manifestHash ||
    Number(spatial?.foldCount) !== Number(split.panel.folds.length)
  ) {
    throw new SpatialParameterError(
      "INVALID_DEVELOPMENT_REPORT",
      "报告不是与当前冻结清单匹配、且未查看 sealed 面板的完整 development 五折。"
    );
  }
  if (failures.length) {
    throw new SpatialParameterError(
      "DEVELOPMENT_SPATIAL_GATE_FAILED",
      "development 空间质量门槛未全部通过，拒绝冻结参数。",
      { failures }
    );
  }
  const selectedCaps = spatial.adminCapTuning?.selectedMatrix || null;
  if (!sameJson(selectedCaps, FROZEN_NOVEL_GRID_ADMIN_EXPOSURE_CAPS_V1)) {
    throw new SpatialParameterError(
      "SPATIAL_CAPS_CHANGED",
      "development 报告选择的行政层暴露上限与冻结 v1 矩阵不一致。"
    );
  }
  const calibrators = validateCalibrators(spatial.spatialCalibration?.productionCalibrators);
  const artifact = validateSpatialParameterArtifact({
    schemaVersion: SPATIAL_PARAMETER_SCHEMA_VERSION,
    parameterSet: SPATIAL_PARAMETER_SET,
    sourceSnapshotSha256,
    spatialSplitManifestHash: split.manifestHash,
    spatialSplitFileSha256: split.fileSha256,
    developmentReportSha256: sha256Buffer(reportBuffer),
    developmentModelSha256: String(report.model?.artifactSha256 || ""),
    developmentFoldCount: Number(spatial.foldCount),
    adminExposureCapsByPrevalence: FROZEN_NOVEL_GRID_ADMIN_EXPOSURE_CAPS_V1,
    calibrationStrategy: String(spatial.spatialCalibration?.strategy || ""),
    calibrationGuard: {
      maximumRelativeBrierDegradation: Number(
        spatial.spatialCalibration?.maximumRelativeBrierDegradation
      ),
      maximumEceDegradation: Number(spatial.spatialCalibration?.maximumEceDegradation)
    },
    calibrators,
    developmentMetrics: spatial.metrics,
    sealedPanelViewed: false
  });
  const temporaryPath = `${resolvedOutputPath}.tmp-${process.pid}`;
  writeFileSync(temporaryPath, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  try {
    renameSync(temporaryPath, resolvedOutputPath);
  } catch (error) {
    try {
      unlinkSync(temporaryPath);
    } catch {
      // Preserve the rename error.
    }
    throw error;
  }
  const fileSha256 = sha256File(resolvedOutputPath);
  writeFileSync(
    `${resolvedOutputPath}.sha256`,
    `${fileSha256}  ${resolvedOutputPath.slice(dirname(resolvedOutputPath).length + 1)}\n`,
    { encoding: "utf8", flag: "wx" }
  );
  return { path: resolvedOutputPath, fileSha256, artifact };
}

module.exports = {
  SPATIAL_PARAMETER_SCHEMA_VERSION,
  SPATIAL_PARAMETER_SET,
  SpatialParameterError,
  freezeSpatialParametersFromDevelopmentReport,
  loadSpatialParameterArtifact,
  validateSpatialParameterArtifact
};
