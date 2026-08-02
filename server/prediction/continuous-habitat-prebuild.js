"use strict";

const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const { canonicalJson } = require("./spatial-splits");
const {
  PRODUCTION_SPATIAL_QUALITY_THRESHOLDS,
  SPATIAL_CALIBRATION_GUARD,
  buildSpatialErrorAudit,
  compactMetrics,
  evaluateCandidateRows,
  spatialQualityFailures
} = require("./spatial-candidate-scorer");

const CONTINUOUS_HABITAT_PREBUILD_SCHEMA_VERSION = 1;
const CONTINUOUS_HABITAT_PREBUILD_FILES = Object.freeze([
  "server/prediction/continuous-habitat-prebuild.js",
  "tools/audit-zhejiang-continuous-habitat-v9-prebuild.js"
]);

const HABITAT_EVIDENCE_CAPS = Object.freeze([5, 10, 20, 40]);
const HABITAT_EVIDENCE_PRIOR_STRENGTHS = Object.freeze([10, 30, 60]);
const CURRENT_HABITAT_EVIDENCE_CANDIDATE_ID = "cap=10,prior=30";
const HABITAT_EVIDENCE_CANDIDATES = Object.freeze(
  HABITAT_EVIDENCE_CAPS.flatMap((exposureCap) =>
    HABITAT_EVIDENCE_PRIOR_STRENGTHS.map((priorStrength) =>
      Object.freeze({
        id: `cap=${exposureCap},prior=${priorStrength}`,
        exposureCap,
        priorStrength
      })
    )
  )
);

const HABITAT_EVIDENCE_SELECTION_POLICY = Object.freeze({
  id: "strict_inner_robust_habitat_evidence_grid_v1",
  selectionEvidence: "four_inner_oof_folds_for_each_outer_fold",
  validationEvidence: "one_untouched_outer_fold",
  requireEveryInnerFoldGuard: true,
  maximumRelativeBrierDegradation:
    SPATIAL_CALIBRATION_GUARD.maximumRelativeBrierDegradation,
  maximumEceDegradation: SPATIAL_CALIBRATION_GUARD.maximumEceDegradation,
  objectiveOrder: Object.freeze([
    "minimum_worst_inner_fold_species_ece",
    "minimum_pooled_inner_species_ece",
    "minimum_pooled_inner_brier",
    "minimum_pooled_inner_ece",
    "candidate_id"
  ]),
  currentCandidateId: CURRENT_HABITAT_EVIDENCE_CANDIDATE_ID,
  productionSelection:
    "development_outer_oof_exploratory_only_never_freeze_without_new_strict_cache"
});

const V9_NEIGHBOR_POLICY_CANDIDATES = Object.freeze([
  Object.freeze({
    id: "same_city_exclusive_v1",
    role: "control",
    maximumDistance: 0.35,
    kernelBandwidth: 0.18,
    maximumNeighbors: 24,
    minimumSameCityNeighbors: 8,
    rule:
      "when_same_city_candidates_at_least_8_use_only_same_city_otherwise_use_zhejiang"
  }),
  Object.freeze({
    id: "same_city_min8_fill_zhejiang_v1",
    role: "challenger",
    maximumDistance: 0.35,
    kernelBandwidth: 0.18,
    maximumNeighbors: 24,
    minimumSameCityNeighbors: 8,
    rule:
      "reserve_up_to_8_nearest_same_city_then_fill_remaining_slots_from_nearest_zhejiang_candidates"
  }),
  Object.freeze({
    id: "dual_channel_same_city_zhejiang_v1",
    role: "challenger",
    maximumDistance: 0.35,
    kernelBandwidth: 0.18,
    maximumNeighborsPerChannel: 24,
    minimumSameCityNeighbors: 8,
    rule:
      "aggregate_same_city_and_zhejiang_similarity_as_separate_regularized_evidence_channels"
  })
]);

const V9_FEATURE_CONTRACT_CANDIDATES = Object.freeze([
  Object.freeze({
    id: "worldcover_five_group_r6_v2",
    role: "control",
    source: "ESA WorldCover 2021 v200",
    dimensions: Object.freeze([
      "forest",
      "open",
      "cropland",
      "urban",
      "water_wetland"
    ]),
    spatialScales: Object.freeze(["target_r6"])
  }),
  Object.freeze({
    id: "worldcover_eleven_class_r6_v3",
    role: "challenger",
    source: "ESA WorldCover 2021 v200",
    dimensions: Object.freeze([
      "tree_cover_10",
      "shrubland_20",
      "grassland_30",
      "cropland_40",
      "built_up_50",
      "bare_sparse_60",
      "snow_ice_70",
      "permanent_water_80",
      "herbaceous_wetland_90",
      "mangroves_95",
      "moss_lichen_100"
    ]),
    spatialScales: Object.freeze(["target_r6"])
  }),
  Object.freeze({
    id: "worldcover_eleven_class_multiscale_v3",
    role: "challenger",
    source: "ESA WorldCover 2021 v200",
    dimensions: Object.freeze([
      "eleven_class_target_fraction",
      "ring1_mean_fraction",
      "ring1_fraction_variance",
      "landscape_entropy",
      "water_land_edge_fraction"
    ]),
    spatialScales: Object.freeze(["target_r6", "h3_ring_1"]),
    noExternalRasterDependency: true
  })
]);

const V9_STRUCTURAL_CANDIDATE_PLAN = Object.freeze({
  id: "zhejiang_continuous_habitat_v9_structural_candidates_v1",
  executionOrder: Object.freeze([
    "existing_cache_habitat_evidence_grid",
    "neighbor_policy_ablation_with_current_five_group_features",
    "feature_contract_ablation_with_selected_neighbor_policy",
    "combine_only_individually_beneficial_candidates"
  ]),
  neighborPolicies: V9_NEIGHBOR_POLICY_CANDIDATES,
  featureContracts: V9_FEATURE_CONTRACT_CANDIDATES,
  forbiddenShortcuts: Object.freeze([
    "quality_gate_relaxation",
    "taxon_removal",
    "sealed_panel_access",
    "hard_district_habitat_virtual_units",
    "unregistered_free_parameter_search",
    "full_reference_materialization_before_all_development_gates_pass"
  ])
});

const PREBUILD_PRIVACY_CONTRACT = Object.freeze({
  allowedIdentity: Object.freeze([
    "anonymous_outer_fold_id",
    "anonymous_inner_fold_id",
    "public_taxon_id"
  ]),
  forbiddenKeys: Object.freeze([
    "report_id",
    "reportId",
    "observer",
    "observer_id",
    "observerId",
    "longitude",
    "latitude",
    "coordinate",
    "coordinates",
    "h3",
    "h3Index",
    "space_unit_id",
    "spaceUnitId",
    "neighbor_id",
    "neighborId",
    "feature_vector",
    "featureVector",
    "location_name",
    "locationName"
  ])
});

class ContinuousHabitatPrebuildError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "ContinuousHabitatPrebuildError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

function continuousHabitatPrebuildImplementationSha256(
  projectRoot = resolve(__dirname, "..", "..")
) {
  const hash = createHash("sha256");
  for (const relativePath of CONTINUOUS_HABITAT_PREBUILD_FILES) {
    hash.update(relativePath);
    hash.update("\0");
    hash.update(readFileSync(resolve(projectRoot, relativePath)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function habitatEvidenceCandidateSetProjection() {
  return {
    candidates: HABITAT_EVIDENCE_CANDIDATES.map((candidate) => ({ ...candidate })),
    selectionPolicy: JSON.parse(canonicalJson(HABITAT_EVIDENCE_SELECTION_POLICY))
  };
}

function habitatEvidenceCandidateSetSha256() {
  return sha256Text(canonicalJson(habitatEvidenceCandidateSetProjection()));
}

function structuralCandidatePlanSha256() {
  return sha256Text(canonicalJson(V9_STRUCTURAL_CANDIDATE_PLAN));
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
  return [Number(cap), (rawDetections / rawExposure) * Number(cap)];
}

function applyChild(alpha, beta, exposure, detections, strength, cap) {
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

function prevalenceGroup(positiveCount) {
  const count = Number(positiveCount) || 0;
  if (count < 30) return "rare_under_30";
  if (count < 80) return "group_30_79";
  if (count < 200) return "group_80_199";
  return "species_200_plus";
}

function baseCapsForRow(row, baseCaps) {
  return baseCaps?.[prevalenceGroup(row.positiveCount)] || {
    city: null,
    district: null
  };
}

function probabilityFromHabitatEvidenceCandidate(row, baseCaps, candidate) {
  const frozenCandidate = HABITAT_EVIDENCE_CANDIDATES.find(
    (item) => item.id === candidate?.id
  );
  if (
    !frozenCandidate ||
    Number(candidate.exposureCap) !== frozenCandidate.exposureCap ||
    Number(candidate.priorStrength) !== frozenCandidate.priorStrength
  ) {
    throw new ContinuousHabitatPrebuildError(
      "CONTINUOUS_HABITAT_PREBUILD_CANDIDATE_INVALID",
      "生境证据候选不属于冻结网格。",
      { candidate: candidate || null }
    );
  }
  if (row.hasSupportedLocalUnit) return Number(row.rawProbability);
  const caps = baseCapsForRow(row, baseCaps);
  let alpha = 1 + Math.max(0, Number(row.provinceDetections) || 0);
  let beta =
    1 +
    Math.max(
      0,
      (Number(row.provinceExposure) || 0) -
        (Number(row.provinceDetections) || 0)
    );
  [alpha, beta] = applyChild(
    alpha,
    beta,
    row.cityExposure,
    row.cityDetections,
    row.cityStrength,
    caps.city
  );
  [alpha, beta] = applyChild(
    alpha,
    beta,
    row.districtExposure,
    row.districtDetections,
    row.districtStrength,
    caps.district
  );
  [alpha, beta] = applyChild(
    alpha,
    beta,
    row.habitatExposure,
    row.habitatDetections,
    frozenCandidate.priorStrength,
    frozenCandidate.exposureCap
  );
  return alpha / (alpha + beta);
}

function candidateById(candidateId) {
  const candidate = HABITAT_EVIDENCE_CANDIDATES.find(
    (item) => item.id === String(candidateId)
  );
  if (!candidate) {
    throw new ContinuousHabitatPrebuildError(
      "CONTINUOUS_HABITAT_PREBUILD_CANDIDATE_UNKNOWN",
      `未知生境证据候选：${candidateId}`
    );
  }
  return candidate;
}

function entriesForEvidence(evidenceSets, baseCaps, candidate) {
  return evidenceSets.flatMap((evidence) =>
    evidence.scoreRows.map((row) => ({
      foldId: String(evidence.innerFoldId ?? evidence.foldId),
      row,
      probability: probabilityFromHabitatEvidenceCandidate(
        row,
        baseCaps,
        candidate
      )
    }))
  );
}

function relativeBrierDegradation(baselineBrier, candidateBrier) {
  if (!Number.isFinite(baselineBrier) || !Number.isFinite(candidateBrier)) {
    return Number.POSITIVE_INFINITY;
  }
  if (baselineBrier > 1e-12) {
    return (candidateBrier - baselineBrier) / baselineBrier;
  }
  return candidateBrier <= baselineBrier + 1e-12
    ? 0
    : Number.POSITIVE_INFINITY;
}

function metricCore(metrics) {
  return {
    brier: metrics?.brier ?? null,
    brierSkill: metrics?.brierSkill ?? null,
    ece: metrics?.ece ?? null,
    recallAt20Delta: metrics?.recallAt20Delta ?? null,
    maximumSpeciesEce:
      metrics?.calibrationEce?.species?.maximumEce ?? null,
    maximumGroupEce: metrics?.calibrationEce?.group?.maximumEce ?? null
  };
}

function evaluateCandidateSet(evidenceSets, baseCaps) {
  return HABITAT_EVIDENCE_CANDIDATES.map((candidate) => {
    const entries = entriesForEvidence(evidenceSets, baseCaps, candidate);
    const metrics = evaluateCandidateRows(entries);
    const folds = evidenceSets.map((evidence) => {
      const foldId = String(evidence.innerFoldId ?? evidence.foldId);
      const foldMetrics = evaluateCandidateRows(
        entries.filter((entry) => entry.foldId === foldId)
      );
      return { foldId, metrics: foldMetrics };
    });
    return {
      candidate,
      metrics,
      folds,
      failures: spatialQualityFailures(metrics)
    };
  });
}

function selectRobustCandidate(evaluations) {
  const baseline = evaluations.find(
    (evaluation) =>
      evaluation.candidate.id === CURRENT_HABITAT_EVIDENCE_CANDIDATE_ID
  );
  if (!baseline) {
    throw new ContinuousHabitatPrebuildError(
      "CONTINUOUS_HABITAT_PREBUILD_BASELINE_MISSING",
      "候选评估缺少当前 cap=10,prior=30 基线。"
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
            HABITAT_EVIDENCE_SELECTION_POLICY.maximumRelativeBrierDegradation &&
          eceDegradation <=
            HABITAT_EVIDENCE_SELECTION_POLICY.maximumEceDegradation
      };
    });
    const pooledBrierDegradation = relativeBrierDegradation(
      baseline.metrics?.brier,
      evaluation.metrics?.brier
    );
    const pooledEceDegradation =
      Number(evaluation.metrics?.ece) - Number(baseline.metrics?.ece);
    const accepted =
      foldGuards.every((fold) => fold.accepted) &&
      pooledBrierDegradation <=
        HABITAT_EVIDENCE_SELECTION_POLICY.maximumRelativeBrierDegradation &&
      pooledEceDegradation <=
        HABITAT_EVIDENCE_SELECTION_POLICY.maximumEceDegradation;
    return {
      ...evaluation,
      guard: {
        accepted,
        pooledBrierDegradation,
        pooledEceDegradation,
        folds: foldGuards
      },
      worstFoldSpeciesEce: Math.max(
        ...evaluation.folds.map((fold) => {
          const value = Number(
            fold.metrics?.calibrationEce?.species?.maximumEce
          );
          return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
        })
      )
    };
  });
  const eligible = candidates.filter((candidate) => candidate.guard.accepted);
  const selected = [...(eligible.length ? eligible : candidates)].sort(
    (left, right) =>
      left.worstFoldSpeciesEce - right.worstFoldSpeciesEce ||
      Number(left.metrics?.calibrationEce?.species?.maximumEce ?? Infinity) -
        Number(right.metrics?.calibrationEce?.species?.maximumEce ?? Infinity) ||
      Number(left.metrics?.brier ?? Infinity) -
        Number(right.metrics?.brier ?? Infinity) ||
      Number(left.metrics?.ece ?? Infinity) -
        Number(right.metrics?.ece ?? Infinity) ||
      left.candidate.id.localeCompare(right.candidate.id)
  )[0];
  return { selected, candidates };
}

function candidateSelectionSummary(selection) {
  return {
    selectedCandidateId: selection.selected.candidate.id,
    selectedCandidate: { ...selection.selected.candidate },
    eligibleCandidateCount: selection.candidates.filter(
      (candidate) => candidate.guard.accepted
    ).length,
    candidates: selection.candidates.map((candidate) => ({
      candidateId: candidate.candidate.id,
      guard: candidate.guard,
      worstFoldSpeciesEce: candidate.worstFoldSpeciesEce,
      metrics: metricCore(candidate.metrics),
      failures: candidate.failures
    }))
  };
}

function verifyCurrentCandidateReproduction(cache) {
  const current = candidateById(CURRENT_HABITAT_EVIDENCE_CANDIDATE_ID);
  const baseCaps = cache.metadata.baseAdminExposureCapsByPrevalence;
  let checkedOuterRows = 0;
  let checkedInnerRows = 0;
  let maximumAbsoluteDifference = 0;
  const checkRows = (rows, kind) => {
    for (const row of rows) {
      const reproduced = probabilityFromHabitatEvidenceCandidate(
        row,
        baseCaps,
        current
      );
      const difference = Math.abs(reproduced - Number(row.rawProbability));
      maximumAbsoluteDifference = Math.max(maximumAbsoluteDifference, difference);
      if (kind === "outer") checkedOuterRows += 1;
      else checkedInnerRows += 1;
    }
  };
  for (const fold of cache.folds) {
    checkRows(fold.scoreRows, "outer");
    for (const innerFold of fold.innerFolds) {
      checkRows(innerFold.scoreRows, "inner");
    }
  }
  return {
    candidateId: current.id,
    checkedOuterRows,
    checkedInnerRows,
    maximumAbsoluteDifference,
    tolerance: 1e-12,
    passed: maximumAbsoluteDifference <= 1e-12
  };
}

function contextSaturationSummary(cache, exposureCap) {
  return cache.folds.map((fold) => {
    const contexts = new Map();
    for (const row of fold.scoreRows) {
      if (!contexts.has(row.contextIndex)) {
        contexts.set(row.contextIndex, {
          exposure: Number(row.habitatExposure) || 0,
          neighborCount: Number(row.habitatNeighborCount) || 0
        });
      }
    }
    const values = [...contexts.values()];
    const saturated = values.filter(
      (context) => context.exposure >= Number(exposureCap)
    ).length;
    return {
      foldId: String(fold.foldId),
      contextCount: values.length,
      saturatedContextCount: saturated,
      saturationShare: values.length ? saturated / values.length : null,
      minimumNeighborCount: values.length
        ? Math.min(...values.map((context) => context.neighborCount))
        : 0,
      meanNeighborCount: values.length
        ? values.reduce((sum, context) => sum + context.neighborCount, 0) /
          values.length
        : 0,
      maximumNeighborCount: values.length
        ? Math.max(...values.map((context) => context.neighborCount))
        : 0
    };
  });
}

function assertPrebuildReportPrivacy(value, path = "report") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertPrebuildReportPrivacy(entry, `${path}[${index}]`)
    );
    return true;
  }
  if (!value || typeof value !== "object") return true;
  for (const [key, entry] of Object.entries(value)) {
    if (PREBUILD_PRIVACY_CONTRACT.forbiddenKeys.includes(key)) {
      throw new ContinuousHabitatPrebuildError(
        "CONTINUOUS_HABITAT_PREBUILD_PRIVACY_VIOLATION",
        `构建前诊断包含禁止字段：${path}.${key}`
      );
    }
    assertPrebuildReportPrivacy(entry, `${path}.${key}`);
  }
  return true;
}

function assertDevelopmentCache(cache) {
  const failures = [];
  if (cache?.metadata?.panel !== "development") failures.push("panel");
  if (cache?.metadata?.diagnosticOnly !== true) failures.push("diagnosticOnly");
  if (Number(cache?.metadata?.foldCount) !== 5) failures.push("foldCount");
  if (Number(cache?.metadata?.innerFoldCount) !== 20) failures.push("innerFoldCount");
  if (!Array.isArray(cache?.folds) || cache.folds.length !== 5) {
    failures.push("folds");
  }
  if (
    cache?.metadata?.evidenceOptions?.continuousHabitatKernel?.id !==
    "zhejiang_worldcover_hellinger_kernel_v1"
  ) {
    failures.push("continuousHabitatKernel");
  }
  if (failures.length) {
    throw new ContinuousHabitatPrebuildError(
      "CONTINUOUS_HABITAT_PREBUILD_CACHE_INVALID",
      "构建前诊断只接受完整 v8 development 连续生境缓存。",
      { failures }
    );
  }
}

function buildContinuousHabitatPrebuildReport(cache) {
  assertDevelopmentCache(cache);
  const reproduction = verifyCurrentCandidateReproduction(cache);
  if (!reproduction.passed) {
    throw new ContinuousHabitatPrebuildError(
      "CONTINUOUS_HABITAT_PREBUILD_REFERENCE_MISMATCH",
      "当前 cap=10,prior=30 不能复现缓存 rawProbability。",
      reproduction
    );
  }
  const baseCaps = cache.metadata.baseAdminExposureCapsByPrevalence;
  const outerSelections = [];
  const nestedEntries = [];
  for (const outerFold of cache.folds) {
    const innerEvaluations = evaluateCandidateSet(
      outerFold.innerFolds,
      baseCaps
    );
    const innerSelection = selectRobustCandidate(innerEvaluations);
    const selectedCandidate = innerSelection.selected.candidate;
    const outerEntries = entriesForEvidence(
      [outerFold],
      baseCaps,
      selectedCandidate
    );
    nestedEntries.push(...outerEntries);
    const outerMetrics = evaluateCandidateRows(outerEntries);
    outerSelections.push({
      heldoutFoldId: String(outerFold.foldId),
      innerFoldIds: outerFold.innerFolds
        .map((fold) => String(fold.innerFoldId))
        .sort(),
      selection: candidateSelectionSummary(innerSelection),
      outerMetrics: compactMetrics(outerMetrics),
      outerFailures: spatialQualityFailures(outerMetrics)
    });
  }
  const nestedMetrics = evaluateCandidateRows(nestedEntries);
  const nestedAudit = buildSpatialErrorAudit(nestedEntries);
  const outerCandidateEvaluations = evaluateCandidateSet(
    cache.folds,
    baseCaps
  );
  const productionSelection = selectRobustCandidate(
    outerCandidateEvaluations
  );
  const productionCandidate = productionSelection.selected.candidate;
  const productionEntries = entriesForEvidence(
    cache.folds,
    baseCaps,
    productionCandidate
  );
  const productionMetrics = evaluateCandidateRows(productionEntries);
  const productionAudit = buildSpatialErrorAudit(productionEntries);
  const nestedFailures = spatialQualityFailures(nestedMetrics);
  const productionFailures = spatialQualityFailures(productionMetrics);
  const longBuildEligible =
    nestedFailures.length === 0 &&
    productionFailures.length === 0 &&
    Number(nestedAudit.maximumObservedEce) <=
      PRODUCTION_SPATIAL_QUALITY_THRESHOLDS.maximumSpeciesEce &&
    Number(productionAudit.maximumObservedEce) <=
      PRODUCTION_SPATIAL_QUALITY_THRESHOLDS.maximumSpeciesEce;
  const report = {
    schemaVersion: CONTINUOUS_HABITAT_PREBUILD_SCHEMA_VERSION,
    reportType: "zhejiang_continuous_habitat_v9_prebuild_diagnostic",
    diagnosticOnly: true,
    freezeEligible: false,
    longBuildEligible,
    sealedPanelViewed: false,
    defaultModelModified: false,
    implementationSha256:
      continuousHabitatPrebuildImplementationSha256(),
    cache: {
      fileSha256: cache.fileSha256,
      sourceSnapshotSha256: cache.metadata.sourceSnapshotSha256,
      spatialSplitFileSha256: cache.metadata.spatialSplitFileSha256,
      spatialSplitManifestHash: cache.metadata.spatialSplitManifestHash,
      generationImplementationSha256:
        cache.metadata.generationImplementationSha256,
      predictionImplementationSha256AtGeneration:
        cache.metadata.predictionImplementationSha256,
      outerFoldCount: cache.folds.length,
      outerRowCount: cache.metadata.outerRowCount,
      innerFoldCount: cache.metadata.innerFoldCount,
      innerRowCount: cache.metadata.innerRowCount
    },
    candidateSet: {
      sha256: habitatEvidenceCandidateSetSha256(),
      ...habitatEvidenceCandidateSetProjection()
    },
    structuralCandidatePlan: {
      sha256: structuralCandidatePlanSha256(),
      ...JSON.parse(canonicalJson(V9_STRUCTURAL_CANDIDATE_PLAN))
    },
    qualityThresholds: PRODUCTION_SPATIAL_QUALITY_THRESHOLDS,
    referenceReproduction: reproduction,
    nestedSelection: {
      strategy: HABITAT_EVIDENCE_SELECTION_POLICY.id,
      heldoutOuterFoldCount: outerSelections.length,
      folds: outerSelections,
      metrics: compactMetrics(nestedMetrics),
      failures: nestedFailures,
      spatialErrorAudit: nestedAudit
    },
    exploratoryProductionSelection: {
      developmentOnly: true,
      mustNotFreeze: true,
      selection: candidateSelectionSummary(productionSelection),
      metrics: compactMetrics(productionMetrics),
      failures: productionFailures,
      spatialErrorAudit: productionAudit,
      capSaturation: contextSaturationSummary(
        cache,
        productionCandidate.exposureCap
      )
    },
    privacy: PREBUILD_PRIVACY_CONTRACT,
    recommendation: {
      longBuildEligible,
      nextAction: longBuildEligible
        ? "preregister_runtime_integration_then_regenerate_new_strict_cache"
        : "keep_long_build_paused_prepare_neighbor_policy_diagnostic_cache",
      fixedQualityGatesUnchanged: true,
      referenceMaterializationForbidden: true,
      sealedForbidden: true
    },
    limitations: [
      "development_only_repeated_research_not_release_evidence",
      "existing_cache_can_change_habitat_cap_and_prior_but_cannot_change_neighbors_or_features",
      "neighbor_and_feature_candidates_require_a_new_privacy_safe_diagnostic_cache",
      "no_result_may_relax_quality_gates_remove_taxa_or_open_sealed"
    ]
  };
  assertPrebuildReportPrivacy(report);
  return report;
}

function validatePrebuildPreregistration(preregistration, {
  cache,
  outputPath
}) {
  const failures = [];
  if (preregistration?.schemaVersion !== 1) failures.push("schemaVersion");
  if (
    preregistration?.kind !==
    "zhejiang_continuous_habitat_v9_prebuild_preregistration"
  ) {
    failures.push("kind");
  }
  if (
    preregistration?.implementationSha256 !==
    continuousHabitatPrebuildImplementationSha256()
  ) {
    failures.push("implementationSha256");
  }
  if (
    preregistration?.candidateSet?.sha256 !==
      habitatEvidenceCandidateSetSha256() ||
    canonicalJson(preregistration?.candidateSet?.candidates) !==
      canonicalJson(HABITAT_EVIDENCE_CANDIDATES) ||
    canonicalJson(preregistration?.candidateSet?.selectionPolicy) !==
      canonicalJson(HABITAT_EVIDENCE_SELECTION_POLICY)
  ) {
    failures.push("candidateSet");
  }
  if (
    preregistration?.structuralCandidatePlan?.sha256 !==
      structuralCandidatePlanSha256() ||
    canonicalJson(preregistration?.structuralCandidatePlan?.plan) !==
      canonicalJson(V9_STRUCTURAL_CANDIDATE_PLAN)
  ) {
    failures.push("structuralCandidatePlan");
  }
  if (
    preregistration?.inputs?.cacheFileSha256 !== cache.fileSha256 ||
    preregistration?.inputs?.sourceSnapshotSha256 !==
      cache.metadata.sourceSnapshotSha256 ||
    preregistration?.inputs?.spatialSplitFileSha256 !==
      cache.metadata.spatialSplitFileSha256 ||
    preregistration?.inputs?.spatialSplitManifestHash !==
      cache.metadata.spatialSplitManifestHash
  ) {
    failures.push("inputs");
  }
  if (
    resolve(preregistration?.diagnostic?.outputPath || "") !==
    resolve(outputPath)
  ) {
    failures.push("diagnostic.outputPath");
  }
  if (
    canonicalJson(preregistration?.qualityThresholds) !==
    canonicalJson(PRODUCTION_SPATIAL_QUALITY_THRESHOLDS)
  ) {
    failures.push("qualityThresholds");
  }
  if (
    preregistration?.stopPolicy?.sealedForbidden !== true ||
    preregistration?.stopPolicy?.defaultModelOverwriteForbidden !== true ||
    preregistration?.stopPolicy?.longBuildRequiresDiagnosticPass !== true
  ) {
    failures.push("stopPolicy");
  }
  if (failures.length) {
    throw new ContinuousHabitatPrebuildError(
      "CONTINUOUS_HABITAT_PREBUILD_PREREGISTRATION_MISMATCH",
      "v9 构建前诊断与冻结预登记不一致。",
      { failures }
    );
  }
  return true;
}

module.exports = {
  CONTINUOUS_HABITAT_PREBUILD_FILES,
  CONTINUOUS_HABITAT_PREBUILD_SCHEMA_VERSION,
  CURRENT_HABITAT_EVIDENCE_CANDIDATE_ID,
  HABITAT_EVIDENCE_CANDIDATES,
  HABITAT_EVIDENCE_SELECTION_POLICY,
  PREBUILD_PRIVACY_CONTRACT,
  V9_FEATURE_CONTRACT_CANDIDATES,
  V9_NEIGHBOR_POLICY_CANDIDATES,
  V9_STRUCTURAL_CANDIDATE_PLAN,
  ContinuousHabitatPrebuildError,
  assertPrebuildReportPrivacy,
  buildContinuousHabitatPrebuildReport,
  continuousHabitatPrebuildImplementationSha256,
  habitatEvidenceCandidateSetProjection,
  habitatEvidenceCandidateSetSha256,
  probabilityFromHabitatEvidenceCandidate,
  selectRobustCandidate,
  structuralCandidatePlanSha256,
  validatePrebuildPreregistration,
  verifyCurrentCandidateReproduction
};
