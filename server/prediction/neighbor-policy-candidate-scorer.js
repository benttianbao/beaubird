"use strict";

const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const { prevalenceGroup } = require("./model");
const {
  NEIGHBOR_POLICY_DIAGNOSTIC_CONTRACT
} = require("./continuous-habitat-neighbor-policies");
const {
  EXPECTED_NEIGHBOR_POLICY_CACHE_LAYOUT
} = require("./neighbor-policy-oof-cache");
const { canonicalJson } = require("./spatial-splits");
const {
  buildSpatialErrorAudit,
  compactMetrics,
  evaluateCandidateRows,
  spatialQualityFailures
} = require("./spatial-candidate-scorer");

const NEIGHBOR_POLICY_CANDIDATE_SCORER_SCHEMA_VERSION = 1;
const NEIGHBOR_POLICY_CANDIDATE_SCORER_FILES = Object.freeze([
  "server/prediction/neighbor-policy-candidate-scorer.js",
  "tools/score-zhejiang-neighbor-policy-oof-cache.js"
]);

class NeighborPolicyCandidateScorerError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "NeighborPolicyCandidateScorerError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function neighborPolicyCandidateScorerImplementationSha256(
  projectRoot = resolve(__dirname, "..", "..")
) {
  const hash = createHash("sha256");
  for (const relativePath of NEIGHBOR_POLICY_CANDIDATE_SCORER_FILES) {
    hash.update(relativePath);
    hash.update("\0");
    hash.update(readFileSync(resolve(projectRoot, relativePath)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function cappedEvidence(exposure, detections, cap) {
  const rawExposure = Math.max(0, Number(exposure) || 0);
  const rawDetections = clamp(Number(detections) || 0, 0, rawExposure);
  if (cap === null || rawExposure <= Number(cap)) {
    return [rawExposure, rawDetections];
  }
  if (Number(cap) === 0 || rawExposure === 0) return [0, 0];
  return [
    Number(cap),
    (rawDetections / rawExposure) * Number(cap)
  ];
}

function applyChild(alpha, beta, {
  exposure,
  detections,
  strength,
  cap
}) {
  const [effectiveExposure, effectiveDetections] = cappedEvidence(
    exposure,
    detections,
    cap
  );
  if (effectiveExposure <= 0) return [alpha, beta];
  const parentProbability = alpha / (alpha + beta);
  return [
    parentProbability * Number(strength) + effectiveDetections,
    (1 - parentProbability) * Number(strength) +
      Math.max(0, effectiveExposure - effectiveDetections)
  ];
}

function policyContract(policyId) {
  const policy = NEIGHBOR_POLICY_DIAGNOSTIC_CONTRACT.policies.find(
    (candidate) => candidate.id === String(policyId)
  );
  if (!policy) {
    throw new NeighborPolicyCandidateScorerError(
      "NEIGHBOR_POLICY_CANDIDATE_UNKNOWN",
      `未知邻居策略：${policyId}`
    );
  }
  return policy;
}

function probabilityFromNeighborPolicyEvidence(
  row,
  baseAdminExposureCapsByPrevalence,
  policyId
) {
  const contract = policyContract(policyId);
  if (row.hasSupportedLocalUnit) return Number(row.rawProbability);
  const caps =
    baseAdminExposureCapsByPrevalence?.[
      prevalenceGroup(row.positiveCount)
    ] || { city: null, district: null };
  let alpha = 1 + Math.max(0, Number(row.provinceDetections) || 0);
  let beta =
    1 +
    Math.max(
      0,
      (Number(row.provinceExposure) || 0) -
        (Number(row.provinceDetections) || 0)
    );
  [alpha, beta] = applyChild(alpha, beta, {
    exposure: row.cityExposure,
    detections: row.cityDetections,
    strength: row.cityStrength,
    cap: caps.city ?? null
  });
  [alpha, beta] = applyChild(alpha, beta, {
    exposure: row.districtExposure,
    detections: row.districtDetections,
    strength: row.districtStrength,
    cap: caps.district ?? null
  });
  const evidence = row.neighborPolicyEvidence?.find(
    (candidate) => candidate.policyId === contract.id
  );
  if (!evidence || evidence.channels.length !== contract.channels.length) {
    throw new NeighborPolicyCandidateScorerError(
      "NEIGHBOR_POLICY_CANDIDATE_EVIDENCE_MISSING",
      `评分行缺少 ${contract.id} 的完整 channel 证据。`
    );
  }
  const channels = [...evidence.channels].sort(
    (left, right) =>
      left.applicationOrder - right.applicationOrder ||
      left.channelId.localeCompare(right.channelId)
  );
  for (let index = 0; index < contract.channels.length; index += 1) {
    const channel = channels[index];
    const expected = contract.channels[index];
    if (
      channel.channelId !== expected.id ||
      channel.applicationOrder !== expected.applicationOrder ||
      Number(channel.evidenceExposureCap) !==
        expected.evidenceExposureCap ||
      Number(channel.evidencePriorStrength) !==
        expected.evidencePriorStrength
    ) {
      throw new NeighborPolicyCandidateScorerError(
        "NEIGHBOR_POLICY_CANDIDATE_EVIDENCE_MISMATCH",
        `${contract.id}.${expected.id} 不匹配冻结契约。`
      );
    }
    [alpha, beta] = applyChild(alpha, beta, {
      exposure: channel.exposure,
      detections: channel.detections,
      strength: channel.evidencePriorStrength,
      cap: channel.evidenceExposureCap
    });
  }
  return alpha / (alpha + beta);
}

function entriesForPolicy(evidenceSets, baseCaps, policyId) {
  return evidenceSets.flatMap((evidence) =>
    evidence.scoreRows.map((row) => ({
      foldId: String(evidence.innerFoldId ?? evidence.outerFoldId),
      row,
      probability: probabilityFromNeighborPolicyEvidence(
        row,
        baseCaps,
        policyId
      )
    }))
  );
}

function relativeBrierDegradation(baselineBrier, candidateBrier) {
  if (
    !Number.isFinite(baselineBrier) ||
    !Number.isFinite(candidateBrier)
  ) {
    return Number.POSITIVE_INFINITY;
  }
  if (baselineBrier > 1e-12) {
    return (candidateBrier - baselineBrier) / baselineBrier;
  }
  return candidateBrier <= baselineBrier + 1e-12
    ? 0
    : Number.POSITIVE_INFINITY;
}

function evaluateNeighborPolicies(evidenceSets, baseCaps) {
  return NEIGHBOR_POLICY_DIAGNOSTIC_CONTRACT.policies.map((policy) => {
    const entries = entriesForPolicy(
      evidenceSets,
      baseCaps,
      policy.id
    );
    const metrics = evaluateCandidateRows(entries);
    const folds = evidenceSets.map((evidence) => {
      const foldId = String(
        evidence.innerFoldId ?? evidence.outerFoldId
      );
      const foldEntries = entries.filter(
        (entry) => entry.foldId === foldId
      );
      return {
        foldId,
        metrics: evaluateCandidateRows(foldEntries)
      };
    });
    return {
      policy,
      metrics,
      folds,
      failures: spatialQualityFailures(metrics)
    };
  });
}

function selectRobustNeighborPolicy(evaluations) {
  const selection =
    NEIGHBOR_POLICY_DIAGNOSTIC_CONTRACT.selectionPolicy;
  const baseline = evaluations.find(
    (evaluation) =>
      evaluation.policy.id === selection.currentPolicyId
  );
  if (!baseline) {
    throw new NeighborPolicyCandidateScorerError(
      "NEIGHBOR_POLICY_CONTROL_MISSING",
      "候选评估缺少当前 control。"
    );
  }
  const baselineFolds = new Map(
    baseline.folds.map((fold) => [fold.foldId, fold.metrics])
  );
  const candidates = evaluations.map((evaluation) => {
    const foldGuards = evaluation.folds.map((fold) => {
      const baselineMetrics = baselineFolds.get(fold.foldId);
      const brierDegradation = relativeBrierDegradation(
        baselineMetrics?.brier,
        fold.metrics?.brier
      );
      const eceDegradation =
        Number(fold.metrics?.ece) - Number(baselineMetrics?.ece);
      return {
        foldId: fold.foldId,
        brierDegradation,
        eceDegradation,
        accepted:
          brierDegradation <=
            selection.maximumRelativeBrierDegradation &&
          eceDegradation <= selection.maximumEceDegradation
      };
    });
    const pooledBrierDegradation = relativeBrierDegradation(
      baseline.metrics?.brier,
      evaluation.metrics?.brier
    );
    const pooledEceDegradation =
      Number(evaluation.metrics?.ece) -
      Number(baseline.metrics?.ece);
    const accepted =
      foldGuards.every((fold) => fold.accepted) &&
      pooledBrierDegradation <=
        selection.maximumRelativeBrierDegradation &&
      pooledEceDegradation <= selection.maximumEceDegradation;
    const foldSpeciesEces = evaluation.folds.map((fold) => {
      const value = Number(
        fold.metrics?.calibrationEce?.species?.maximumEce
      );
      return Number.isFinite(value)
        ? value
        : Number.POSITIVE_INFINITY;
    });
    return {
      ...evaluation,
      guard: {
        accepted,
        pooledBrierDegradation,
        pooledEceDegradation,
        folds: foldGuards
      },
      worstFoldSpeciesEce: Math.max(...foldSpeciesEces)
    };
  });
  const eligible = candidates.filter(
    (candidate) => candidate.guard.accepted
  );
  const selected = [...(eligible.length ? eligible : candidates)].sort(
    (left, right) =>
      left.worstFoldSpeciesEce - right.worstFoldSpeciesEce ||
      Number(
        left.metrics?.calibrationEce?.species?.maximumEce ??
          Number.POSITIVE_INFINITY
      ) -
        Number(
          right.metrics?.calibrationEce?.species?.maximumEce ??
            Number.POSITIVE_INFINITY
        ) ||
      Number(left.metrics?.brier ?? Number.POSITIVE_INFINITY) -
        Number(right.metrics?.brier ?? Number.POSITIVE_INFINITY) ||
      Number(left.metrics?.ece ?? Number.POSITIVE_INFINITY) -
        Number(right.metrics?.ece ?? Number.POSITIVE_INFINITY) ||
      left.policy.id.localeCompare(right.policy.id)
  )[0];
  return { selected, candidates };
}

function selectionSummary(selection) {
  return {
    selectedPolicyId: selection.selected.policy.id,
    eligiblePolicyCount: selection.candidates.filter(
      (candidate) => candidate.guard.accepted
    ).length,
    candidates: selection.candidates.map((candidate) => ({
      policyId: candidate.policy.id,
      role: candidate.policy.role,
      guard: candidate.guard,
      worstFoldSpeciesEce: candidate.worstFoldSpeciesEce,
      metrics: compactMetrics(candidate.metrics),
      failures: candidate.failures
    }))
  };
}

function buildNeighborPolicyCandidateReport(cache) {
  const baseCaps =
    cache.metadata.baseAdminExposureCapsByPrevalence;
  const outerSelections = [];
  const nestedEntries = [];
  const outerEvidenceSets = [];
  let checkedRows = 0;
  let maximumControlDifference = 0;
  for (const outerFoldId of ["1", "2", "3", "4", "5"]) {
    const innerEvidenceSets = ["1", "2", "3", "4", "5"]
      .filter((innerFoldId) => innerFoldId !== outerFoldId)
      .map((innerFoldId) =>
        cache.readFold({ outerFoldId, innerFoldId })
      );
    const innerEvaluations = evaluateNeighborPolicies(
      innerEvidenceSets,
      baseCaps
    );
    const innerSelection =
      selectRobustNeighborPolicy(innerEvaluations);
    const outerEvidence = cache.readFold({ outerFoldId });
    outerEvidenceSets.push(outerEvidence);
    const selectedPolicyId = innerSelection.selected.policy.id;
    const outerEntries = entriesForPolicy(
      [outerEvidence],
      baseCaps,
      selectedPolicyId
    );
    const outerMetrics = evaluateCandidateRows(outerEntries);
    nestedEntries.push(...outerEntries);
    outerSelections.push({
      heldoutFoldId: outerFoldId,
      innerFoldIds: innerEvidenceSets.map(
        (fold) => fold.innerFoldId
      ),
      selection: selectionSummary(innerSelection),
      outerMetrics: compactMetrics(outerMetrics),
      outerFailures: spatialQualityFailures(outerMetrics)
    });
    for (const evidence of [...innerEvidenceSets, outerEvidence]) {
      for (const row of evidence.scoreRows) {
        const reproduced = probabilityFromNeighborPolicyEvidence(
          row,
          baseCaps,
          "same_city_exclusive_v1"
        );
        maximumControlDifference = Math.max(
          maximumControlDifference,
          Math.abs(reproduced - Number(row.rawProbability))
        );
        checkedRows += 1;
      }
    }
  }
  if (maximumControlDifference > 1e-12) {
    throw new NeighborPolicyCandidateScorerError(
      "NEIGHBOR_POLICY_CONTROL_REPRODUCTION_FAILED",
      "control 无法逐行复现缓存 reference_raw_probability。",
      { checkedRows, maximumControlDifference }
    );
  }
  const nestedMetrics = evaluateCandidateRows(nestedEntries);
  const outerEvaluations = evaluateNeighborPolicies(
    outerEvidenceSets,
    baseCaps
  );
  const productionSelection =
    selectRobustNeighborPolicy(outerEvaluations);
  const productionEntries = entriesForPolicy(
    outerEvidenceSets,
    baseCaps,
    productionSelection.selected.policy.id
  );
  const productionMetrics = evaluateCandidateRows(productionEntries);
  const nestedFailures = spatialQualityFailures(nestedMetrics);
  const productionFailures = spatialQualityFailures(productionMetrics);
  const selectedPolicyIsChallenger =
    productionSelection.selected.policy.role === "challenger";
  const runtimeIntegrationEligible =
    selectedPolicyIsChallenger &&
    nestedFailures.length === 0 &&
    productionFailures.length === 0;
  return {
    schemaVersion: NEIGHBOR_POLICY_CANDIDATE_SCORER_SCHEMA_VERSION,
    reportType:
      "zhejiang_continuous_habitat_neighbor_policy_diagnostic",
    diagnosticOnly: true,
    freezeEligible: false,
    runtimeIntegrationEligible,
    sealedPanelViewed: false,
    defaultModelModified: false,
    scorerImplementationSha256:
      neighborPolicyCandidateScorerImplementationSha256(),
    cache: {
      fileSha256: cache.fileSha256,
      sourceSnapshotSha256: cache.metadata.sourceSnapshotSha256,
      spatialSplitFileSha256:
        cache.metadata.spatialSplitFileSha256,
      spatialSplitManifestHash:
        cache.metadata.spatialSplitManifestHash,
      contractSha256: cache.metadata.contractSha256,
      generationImplementationSha256:
        cache.metadata.generationImplementationSha256,
      predictionImplementationSha256:
        cache.metadata.predictionImplementationSha256,
      outerRowCount: cache.metadata.outerRowCount,
      innerRowCount: cache.metadata.innerRowCount,
      evidenceRowCount: cache.metadata.evidenceRowCount
    },
    controlReproduction: {
      policyId: "same_city_exclusive_v1",
      checkedRows,
      maximumAbsoluteDifference: maximumControlDifference,
      tolerance: 1e-12,
      passed: true
    },
    contract: NEIGHBOR_POLICY_DIAGNOSTIC_CONTRACT,
    qualityThresholds: cache.metadata.qualityThresholds,
    nestedSelection: {
      folds: outerSelections,
      metrics: compactMetrics(nestedMetrics),
      failures: nestedFailures,
      spatialErrorAudit: buildSpatialErrorAudit(nestedEntries)
    },
    exploratoryProductionSelection: {
      developmentOnly: true,
      mustNotFreeze: true,
      selectedPolicyIsChallenger,
      selection: selectionSummary(productionSelection),
      metrics: compactMetrics(productionMetrics),
      failures: productionFailures,
      spatialErrorAudit: buildSpatialErrorAudit(productionEntries)
    },
    recommendation: {
      runtimeIntegrationEligible,
      nextAction: runtimeIntegrationEligible
        ? "preregister_selected_neighbor_policy_runtime_integration_and_full_development_revalidation"
        : "stop_neighbor_policy_path_and_prepare_frozen_feature_contract_diagnostic",
      qualityGatesUnchanged: true,
      fullDevelopmentRevalidationRequired: true,
      referenceMaterializationForbidden: true,
      sealedForbidden: true
    },
    limitations: [
      "development_spatial_neighbor_policy_diagnostic_only",
      "does_not_evaluate_time_observer_or_reverse_ndcg_gates",
      "passing_only_allows_preregistered_runtime_integration_and_full_development_revalidation",
      "does_not_allow_reference_materialization_or_sealed_access"
    ]
  };
}

function normalizedPath(path) {
  const absolutePath = resolve(path);
  return process.platform === "win32"
    ? absolutePath.toLowerCase()
    : absolutePath;
}

function validateNeighborPolicyScoringPreregistration(
  preregistration,
  {
    cache,
    cachePath,
    outputPath
  }
) {
  const failures = [];
  if (preregistration?.schemaVersion !== 1) {
    failures.push("schemaVersion");
  }
  if (
    preregistration?.kind !==
    "zhejiang_neighbor_policy_oof_cache_v9_preregistration"
  ) {
    failures.push("kind");
  }
  if (
    preregistration?.status !==
    "frozen_before_single_long_development_cache_build"
  ) {
    failures.push("status");
  }
  if (
    preregistration?.implementation?.scorerImplementationSha256 !==
    neighborPolicyCandidateScorerImplementationSha256()
  ) {
    failures.push("implementation.scorerImplementationSha256");
  }
  if (
    preregistration?.implementation
      ?.cacheGenerationImplementationSha256 !==
      cache?.metadata?.generationImplementationSha256 ||
    preregistration?.implementation?.predictionImplementationSha256 !==
      cache?.metadata?.predictionImplementationSha256
  ) {
    failures.push("implementation.cache");
  }
  if (
    preregistration?.contract?.sha256 !==
      cache?.metadata?.contractSha256 ||
    canonicalJson(preregistration?.contract?.value) !==
      canonicalJson(NEIGHBOR_POLICY_DIAGNOSTIC_CONTRACT)
  ) {
    failures.push("contract");
  }
  if (
    preregistration?.inputs?.sourceSnapshotSha256 !==
      cache?.metadata?.sourceSnapshotSha256 ||
    preregistration?.inputs?.spatialSplitFileSha256 !==
      cache?.metadata?.spatialSplitFileSha256 ||
    preregistration?.inputs?.spatialSplitManifestHash !==
      cache?.metadata?.spatialSplitManifestHash
  ) {
    failures.push("inputs.spatial");
  }
  const actualLayout = {
    outerFoldCount: Number(cache?.metadata?.foldCount),
    innerFoldCount: Number(cache?.metadata?.innerFoldCount),
    outerScoreRows: Number(cache?.metadata?.outerRowCount),
    innerScoreRows: Number(cache?.metadata?.innerRowCount),
    totalScoreRows:
      Number(cache?.metadata?.outerRowCount) +
      Number(cache?.metadata?.innerRowCount),
    neighborChannelsPerScoreRow:
      Number(cache?.metadata?.evidenceRowCount) /
      (
        Number(cache?.metadata?.outerRowCount) +
        Number(cache?.metadata?.innerRowCount)
      ),
    neighborDetectionRows:
      Number(cache?.metadata?.evidenceRowCount)
  };
  if (
    canonicalJson(preregistration?.expectedLayout) !==
      canonicalJson(EXPECTED_NEIGHBOR_POLICY_CACHE_LAYOUT) ||
    canonicalJson(actualLayout) !==
      canonicalJson(EXPECTED_NEIGHBOR_POLICY_CACHE_LAYOUT)
  ) {
    failures.push("expectedLayout");
  }
  if (
    normalizedPath(preregistration?.outputs?.cachePath || "") !==
      normalizedPath(cachePath) ||
    normalizedPath(preregistration?.scoring?.outputPath || "") !==
      normalizedPath(outputPath)
  ) {
    failures.push("paths");
  }
  if (
    preregistration?.scoring?.schemaVersion !==
      NEIGHBOR_POLICY_CANDIDATE_SCORER_SCHEMA_VERSION ||
    preregistration?.scoring?.diagnosticOnly !== true ||
    preregistration?.scoring?.freezeEligible !== false ||
    preregistration?.scoring?.outputMustNotExistBeforeRun !== true
  ) {
    failures.push("scoring");
  }
  if (
    preregistration?.stopPolicy?.sealedForbidden !== true ||
    preregistration?.stopPolicy?.defaultModelOverwriteForbidden !== true ||
    preregistration?.stopPolicy?.referenceMaterializationForbidden !== true
  ) {
    failures.push("stopPolicy");
  }
  if (failures.length) {
    throw new NeighborPolicyCandidateScorerError(
      "NEIGHBOR_POLICY_SCORING_PREREGISTRATION_MISMATCH",
      "Neighbor-policy scoring does not match the frozen preregistration.",
      { failures }
    );
  }
  return true;
}

module.exports = {
  NEIGHBOR_POLICY_CANDIDATE_SCORER_FILES,
  NEIGHBOR_POLICY_CANDIDATE_SCORER_SCHEMA_VERSION,
  NeighborPolicyCandidateScorerError,
  buildNeighborPolicyCandidateReport,
  evaluateNeighborPolicies,
  neighborPolicyCandidateScorerImplementationSha256,
  probabilityFromNeighborPolicyEvidence,
  selectRobustNeighborPolicy,
  validateNeighborPolicyScoringPreregistration
};
