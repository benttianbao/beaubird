"use strict";

const { createHash } = require("node:crypto");
const { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } = require("node:fs");
const { dirname, resolve } = require("node:path");
const { loadSpatialParameterArtifact } = require("./spatial-parameters");
const { verifySpatialSplitManifest } = require("./spatial-transfer");

const SEALED_EVALUATION_RECEIPT_SCHEMA_VERSION = 1;
const SEALED_EVALUATION_RECEIPT_TYPE = "zhejiang_sealed_spatial_evaluation_v1";

class SealedEvaluationReceiptError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "SealedEvaluationReceiptError";
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

function validHash(value) {
  return /^[a-f0-9]{64}$/.test(String(value || ""));
}

function validateSealedEvaluationReceipt(receipt, expected = {}) {
  if (
    !receipt ||
    typeof receipt !== "object" ||
    Number(receipt.schemaVersion) !== SEALED_EVALUATION_RECEIPT_SCHEMA_VERSION ||
    receipt.receiptType !== SEALED_EVALUATION_RECEIPT_TYPE
  ) {
    throw new SealedEvaluationReceiptError("INVALID_SEALED_RECEIPT", "密封评估收据版本无效。");
  }
  for (const key of [
    "sourceSnapshotSha256",
    "spatialSplitManifestHash",
    "spatialParameterFileSha256",
    "sealedReportSha256",
    "implementationSha256"
  ]) {
    if (!validHash(receipt[key])) {
      throw new SealedEvaluationReceiptError("INVALID_SEALED_RECEIPT", `密封评估收据缺少 ${key}。`);
    }
  }
  const spatial = receipt.spatialEvaluation;
  if (
    receipt.sealedPanelViewed !== true ||
    spatial?.splitManifest?.panel !== "sealed-release" ||
    spatial?.splitManifest?.sealedPanelViewed !== true ||
    spatial?.splitManifest?.manifestHash !== receipt.spatialSplitManifestHash ||
    Number(spatial?.foldCount) !== 5 ||
    !Number.isFinite(Number(spatial?.metrics?.brierSkill)) ||
    !Number.isFinite(Number(spatial?.metrics?.ece))
  ) {
    throw new SealedEvaluationReceiptError(
      "INVALID_SEALED_RECEIPT",
      "密封评估收据不包含完整、已查看且可评分的 sealed release 五折。"
    );
  }
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (expectedValue == null) continue;
    if (String(receipt[key]).toLowerCase() !== String(expectedValue).toLowerCase()) {
      throw new SealedEvaluationReceiptError(
        "SEALED_RECEIPT_MISMATCH",
        `密封评估收据与当前 ${key} 不一致。`,
        { key, expected: expectedValue, actual: receipt[key] }
      );
    }
  }
  return receipt;
}

function loadSealedEvaluationReceipt(path, expected = {}) {
  const resolvedPath = resolve(path);
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(resolvedPath, "utf8"));
  } catch (error) {
    throw new SealedEvaluationReceiptError(
      "SEALED_RECEIPT_UNREADABLE",
      `无法读取密封评估收据：${error.message}`,
      { path: resolvedPath }
    );
  }
  return {
    path: resolvedPath,
    fileSha256: sha256File(resolvedPath),
    receipt: validateSealedEvaluationReceipt(receipt, expected)
  };
}

function freezeSealedEvaluationReceipt({ reportPath, parameterPath, splitManifestPath, outputPath }) {
  const resolvedReportPath = resolve(reportPath);
  const resolvedOutputPath = resolve(outputPath);
  if (existsSync(resolvedOutputPath)) {
    throw new SealedEvaluationReceiptError("SEALED_RECEIPT_EXISTS", `密封评估收据已存在：${resolvedOutputPath}`);
  }
  const reportBuffer = readFileSync(resolvedReportPath);
  const report = JSON.parse(reportBuffer.toString("utf8"));
  const sourceSnapshotSha256 = String(report.source?.snapshotSha256 || "").toLowerCase();
  const parameters = loadSpatialParameterArtifact(parameterPath, { sourceSnapshotSha256 });
  const split = verifySpatialSplitManifest({
    manifestPath: splitManifestPath,
    sourceSnapshotSha256,
    panelName: "sealed-release",
    sealedPanelConfirmation: parameters.artifact.spatialSplitManifestHash
  });
  const spatial = report.spatial || report.releaseQuality?.spatial;
  const implementationSha256 = String(report.model?.implementationSha256 || "").toLowerCase();
  if (
    report.releaseQuality?.passed !== true ||
    (report.releaseQuality?.failures || []).length !== 0 ||
    !validHash(implementationSha256)
  ) {
    throw new SealedEvaluationReceiptError(
      "SEALED_RELEASE_GATE_FAILED",
      "密封构建未通过全部发布门槛，或缺少实现代码哈希，拒绝生成收据。",
      { failures: report.releaseQuality?.failures || [] }
    );
  }
  if (
    spatial?.splitManifest?.panel !== "sealed-release" ||
    spatial?.splitManifest?.sealedPanelViewed !== true ||
    spatial?.splitManifest?.manifestHash !== split.manifestHash ||
    spatial?.spatialCalibration?.parameterFileSha256 !== parameters.fileSha256
  ) {
    throw new SealedEvaluationReceiptError(
      "INVALID_SEALED_REPORT",
      "密封报告与当前 split manifest 或冻结空间参数不一致。"
    );
  }
  const receipt = validateSealedEvaluationReceipt({
    schemaVersion: SEALED_EVALUATION_RECEIPT_SCHEMA_VERSION,
    receiptType: SEALED_EVALUATION_RECEIPT_TYPE,
    sourceSnapshotSha256,
    spatialSplitManifestHash: split.manifestHash,
    spatialSplitFileSha256: split.fileSha256,
    spatialParameterFileSha256: parameters.fileSha256,
    spatialParameterDevelopmentReportSha256: parameters.artifact.developmentReportSha256,
    sealedReportSha256: sha256Buffer(reportBuffer),
    sealedModelSha256: String(report.model?.artifactSha256 || ""),
    implementationSha256,
    sealedPanelViewed: true,
    spatialEvaluation: spatial
  });
  const temporaryPath = `${resolvedOutputPath}.tmp-${process.pid}`;
  writeFileSync(temporaryPath, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
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
  return { path: resolvedOutputPath, fileSha256, receipt };
}

module.exports = {
  SEALED_EVALUATION_RECEIPT_SCHEMA_VERSION,
  SEALED_EVALUATION_RECEIPT_TYPE,
  SealedEvaluationReceiptError,
  freezeSealedEvaluationReceipt,
  loadSealedEvaluationReceipt,
  validateSealedEvaluationReceipt
};
