"use strict";

const { createHash } = require("node:crypto");

const {
  RANKING_REFERENCE_CONTRACT,
  RANKING_REFERENCE_CONTRACT_SHA256
} = require("./ranking-reference");
const { canonicalJson } = require("./spatial-splits");

const RANKING_REFERENCE_BINDING_SCHEMA_VERSION = 1;
const RANKING_REFERENCE_BINDING_KIND = "zhejiang_development_ranking_reference_parameters_v1";
const RANKING_REFERENCE_OUTPUT_MEANING =
  "complete_checklist_observed_frequency_reference_range_not_absolute_presence_probability";

function clamp(value, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

function prevalenceReferenceGroup(positiveCount) {
  const count = Number(positiveCount) || 0;
  if (count < 30) return "under_30";
  if (count < 80) return "30_79";
  if (count < 200) return "80_199";
  return "200_plus";
}

function referenceScopes(taxonId, positiveCount) {
  const group = `group:${prevalenceReferenceGroup(positiveCount)}`;
  return Number(positiveCount) >= 200
    ? [`species:${String(taxonId)}`, group, "global"]
    : [group, "global"];
}

function parameterScopeValid(scope) {
  return scope === "global" ||
    /^group:(under_30|30_79|80_199|200_plus)$/.test(scope) ||
    /^species:[^:]+$/.test(scope);
}

function normalizeParameter(parameter) {
  const scope = String(parameter?.scope || "");
  const halfWidth = Number(parameter?.halfWidth);
  const rowCount = Number(parameter?.rowCount);
  const totalWeight = Number(parameter?.totalWeight);
  const calibrationFoldCount = Number(parameter?.calibrationFoldCount);
  const foldQuantiles = Array.isArray(parameter?.foldQuantiles)
    ? parameter.foldQuantiles.map((fold) => ({
        foldId: String(fold?.foldId || ""),
        halfWidth: Number(fold?.halfWidth),
        rowCount: Number(fold?.rowCount),
        totalWeight: Number(fold?.totalWeight)
      })).sort((left, right) => left.foldId.localeCompare(right.foldId))
    : [];
  const foldIds = foldQuantiles.map((fold) => fold.foldId);
  if (
    !parameterScopeValid(scope) ||
    !Number.isFinite(halfWidth) || halfWidth < 0 || halfWidth > 1 ||
    !Number.isInteger(rowCount) || rowCount < RANKING_REFERENCE_CONTRACT.minimumCalibrationRows ||
    !Number.isFinite(totalWeight) || totalWeight < RANKING_REFERENCE_CONTRACT.minimumCalibrationWeight ||
    !Number.isInteger(calibrationFoldCount) ||
    calibrationFoldCount < RANKING_REFERENCE_CONTRACT.minimumCalibrationFolds ||
    foldQuantiles.length !== calibrationFoldCount ||
    new Set(foldIds).size !== foldIds.length ||
    foldQuantiles.some((fold) =>
      !fold.foldId || !Number.isFinite(fold.halfWidth) || fold.halfWidth < 0 || fold.halfWidth > 1 ||
      !Number.isInteger(fold.rowCount) || fold.rowCount < 1 ||
      !Number.isFinite(fold.totalWeight) || fold.totalWeight <= 0
    )
  ) {
    throw new TypeError(`无效的参考范围参数：${scope || "<empty>"}`);
  }
  if (Math.abs(Math.max(...foldQuantiles.map((fold) => fold.halfWidth)) - halfWidth) > 1e-12) {
    throw new TypeError(`参考范围参数未采用最保守 outer fold：${scope}`);
  }
  return { scope, halfWidth, rowCount, totalWeight, calibrationFoldCount, foldQuantiles };
}

function normalizeParameters(parameters) {
  if (!Array.isArray(parameters) || !parameters.length) {
    throw new TypeError("参考范围参数不能为空。");
  }
  const normalized = parameters.map(normalizeParameter)
    .sort((left, right) => left.scope.localeCompare(right.scope));
  const scopes = normalized.map((parameter) => parameter.scope);
  if (new Set(scopes).size !== scopes.length) throw new TypeError("参考范围参数作用域重复。");
  if (!scopes.includes("global")) throw new TypeError("参考范围参数缺少 global 回退。");
  return normalized;
}

function parameterSetSha256(parameters) {
  return createHash("sha256").update(canonicalJson(normalizeParameters(parameters))).digest("hex");
}

function reportBinding(report, {
  reportPath,
  reportSha256,
  scorerImplementationSha256,
  sourceSnapshotSha256,
  spatialSplitFileSha256,
  spatialSplitManifestHash
}) {
  const reference = report?.rankingReference;
  const failures = [];
  if (Number(report?.schemaVersion) !== 5) failures.push("report.schemaVersion");
  if (report?.reportType !== "zhejiang_development_spatial_oof_candidate_diagnostic") {
    failures.push("report.reportType");
  }
  if (report?.diagnosticOnly !== true) failures.push("report.diagnosticOnly");
  if (report?.freezeEligible !== false) failures.push("report.freezeEligible");
  if (report?.sealedPanelViewed !== false) failures.push("report.sealedPanelViewed");
  if (reference?.developmentDiagnosticOnly !== true) failures.push("reference.developmentDiagnosticOnly");
  if (reference?.freezeEligible !== false) failures.push("reference.freezeEligible");
  if (reference?.formalProbabilityGateUnchanged !== true) failures.push("reference.formalProbabilityGateUnchanged");
  if (reference?.passed !== true || reference?.failures?.length) failures.push("reference.passed");
  if (reference?.contractId !== RANKING_REFERENCE_CONTRACT.id) failures.push("reference.contractId");
  if (reference?.contractSha256 !== RANKING_REFERENCE_CONTRACT_SHA256) failures.push("reference.contractSha256");
  if (canonicalJson(reference?.contract) !== canonicalJson(RANKING_REFERENCE_CONTRACT)) {
    failures.push("reference.contract");
  }
  if (report?.scoring?.scorerImplementationSha256 !== scorerImplementationSha256) {
    failures.push("scoring.scorerImplementationSha256");
  }
  if (report?.cache?.sourceSnapshotSha256 !== sourceSnapshotSha256) failures.push("cache.sourceSnapshotSha256");
  if (report?.cache?.spatialSplitFileSha256 !== spatialSplitFileSha256) {
    failures.push("cache.spatialSplitFileSha256");
  }
  if (report?.cache?.spatialSplitManifestHash !== spatialSplitManifestHash) {
    failures.push("cache.spatialSplitManifestHash");
  }
  if (reference?.retention?.cachedCandidateRetention !== 1) failures.push("reference.cachedCandidateRetention");
  if (reference?.retention?.thresholdFilteringApplied !== false) failures.push("reference.thresholdFilteringApplied");
  if (Number(reference?.crossFitting?.fitFoldCount) !== 4) failures.push("reference.fitFoldCount");
  if (Number(reference?.crossFitting?.heldoutFoldCount) !== 5) failures.push("reference.heldoutFoldCount");
  let parameters = [];
  try {
    parameters = normalizeParameters(reference?.productionParameters);
  } catch (error) {
    failures.push(`reference.productionParameters:${error.message}`);
  }
  if (failures.length) {
    const error = new TypeError("参考范围 development 报告绑定失败。");
    error.details = { failures };
    throw error;
  }
  const parametersSha256 = parameterSetSha256(parameters);
  return {
    schemaVersion: RANKING_REFERENCE_BINDING_SCHEMA_VERSION,
    kind: RANKING_REFERENCE_BINDING_KIND,
    reportPath,
    reportSha256,
    scorerImplementationSha256,
    sourceSnapshotSha256,
    spatialSplitFileSha256,
    spatialSplitManifestHash,
    contractId: RANKING_REFERENCE_CONTRACT.id,
    contractSha256: RANKING_REFERENCE_CONTRACT_SHA256,
    outputMeaning: RANKING_REFERENCE_OUTPUT_MEANING,
    parametersSha256,
    parameterCount: parameters.length,
    diagnosticOnly: true,
    freezeEligible: false,
    sealedPanelViewed: false,
    parameters
  };
}

function parameterMap(parameters) {
  if (parameters instanceof Map) return parameters;
  return new Map(normalizeParameters(parameters).map((parameter) => [parameter.scope, parameter]));
}

function referenceRange(probability, taxonId, positiveCount, parameters) {
  const center = clamp(probability);
  const byScope = parameterMap(parameters);
  const scopes = referenceScopes(taxonId, positiveCount);
  const available = scopes.map((scope) => byScope.get(scope)).filter(Boolean);
  if (!available.length) throw new TypeError(`鸟种 ${taxonId} 没有可用参考范围参数。`);
  const halfWidth = Math.max(...available.map((parameter) => Number(parameter.halfWidth)));
  const lower = clamp(center - halfWidth);
  const upper = clamp(center + halfWidth);
  const width = upper - lower;
  return {
    lower,
    upper,
    width,
    sourceScopes: available.map((parameter) => parameter.scope),
    confidence: width <= RANKING_REFERENCE_CONTRACT.confidenceMaximumWidth.high
      ? "high"
      : width <= RANKING_REFERENCE_CONTRACT.confidenceMaximumWidth.medium
        ? "medium"
        : "low"
  };
}

function manifestSummary(binding) {
  if (!binding) return null;
  const { parameters, ...summary } = binding;
  return summary;
}

module.exports = {
  RANKING_REFERENCE_BINDING_KIND,
  RANKING_REFERENCE_BINDING_SCHEMA_VERSION,
  RANKING_REFERENCE_OUTPUT_MEANING,
  manifestSummary,
  normalizeParameters,
  parameterMap,
  parameterSetSha256,
  prevalenceReferenceGroup,
  referenceRange,
  referenceScopes,
  reportBinding
};
