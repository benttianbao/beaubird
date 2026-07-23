"use strict";

const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const { calibrateProbability, fitBetaCalibration } = require("./math");
const { PREVALENCE_GROUPS, prevalenceGroup } = require("./model");
const {
  RANKING_REFERENCE_CONTRACT,
  evaluateRankingReference
} = require("./ranking-reference");
const { canonicalJson } = require("./spatial-splits");
const { buildAdminExposureCapCandidates } = require("./spatial-transfer");
const {
  DEFAULT_ADMIN_CAP_CHUNK_RECORDS,
  scoreAdminCapTasks
} = require("./spatial-transfer-worker");
const {
  DEVELOPMENT_POOL_POSITIVE_COUNT_POLICY,
  INNER_TRAINING_POSITIVE_COUNT_POLICY,
  OUTER_TRAINING_POSITIVE_COUNT_POLICY,
  candidateSetSha256
} = require("./spatial-oof-cache");

const SPATIAL_CANDIDATE_SCORER_SCHEMA_VERSION = 6;
const SPATIAL_CANDIDATE_SCORER_FILES = Object.freeze([
  "server/prediction/habitat-features.js",
  "server/prediction/math.js",
  "server/prediction/model.js",
  "server/prediction/ranking-reference.js",
  "server/prediction/spatial-candidate-scorer.js",
  "server/prediction/spatial-oof-cache.js",
  "server/prediction/spatial-transfer.js",
  "server/prediction/spatial-transfer-worker.js",
  "tools/score-zhejiang-spatial-oof-cache.js"
]);
const PRODUCTION_SPATIAL_QUALITY_THRESHOLDS = Object.freeze({
  minimumBrierSkill: 0,
  maximumEce: 0.1,
  maximumSpeciesEce: 0.05,
  maximumGroupEce: 0.1,
  minimumRecallAt20Delta: -0.02
});
const SPATIAL_CALIBRATION_GUARD = Object.freeze({
  maximumRelativeBrierDegradation: 0.01,
  maximumEceDegradation: 0.01
});
const STABLE_CAP_SELECTION_POLICY = Object.freeze({
  strategy: "strict_nested_near_optimal_0.1pct_minimax_regret_5pct_fallback_v2",
  maximumRelativePooledBrierRegret: 0.001,
  maximumFoldRelativeBrierRegret: 0.05
});
const ROBUST_SCOPE_SELECTION_POLICY = Object.freeze({
  strategy: "strict_nested_every_fold_guard_minimax_ece_v2",
  requireEveryFoldGuard: true,
  requireWorstFoldEceNonDegradation: true
});
const SPATIAL_ERROR_AUDIT_CONTRACT = Object.freeze({
  id: "zhejiang_spatial_species_error_audit_v1",
  maximumSpeciesEce: PRODUCTION_SPATIAL_QUALITY_THRESHOLDS.maximumSpeciesEce,
  minimumMaterialSignedBias: 0.01,
  probabilityBinCount: 10,
  scopeEligibility: "outer_training_positive_count_200_plus",
  directionDefinition: "predicted_rate_minus_observed_rate",
  privacy: "anonymous_fold_and_public_taxon_id_only_no_location_identity"
});
const NESTED_SCOPE_ADAPTIVE_STRATEGY_ID = "strict_nested_scope_adaptive_fixed_v2";
const DEFAULT_CALIBRATOR_FAMILIES = Object.freeze([
  Object.freeze({ id: "identity", type: "identity", ridge: 0, shrinkage: 0 }),
  Object.freeze({ id: "intercept_ridge_0.1_shrink_0.25", type: "intercept", ridge: 0.1, shrinkage: 0.25 }),
  Object.freeze({ id: "intercept_ridge_0.1_shrink_0.5", type: "intercept", ridge: 0.1, shrinkage: 0.5 }),
  Object.freeze({ id: "intercept_ridge_0.1_shrink_0.75", type: "intercept", ridge: 0.1, shrinkage: 0.75 }),
  Object.freeze({ id: "intercept_ridge_0.1", type: "intercept", ridge: 0.1, shrinkage: 1 }),
  Object.freeze({ id: "temperature_ridge_0.1_shrink_0.25", type: "temperature", ridge: 0.1, shrinkage: 0.25 }),
  Object.freeze({ id: "temperature_ridge_0.1_shrink_0.5", type: "temperature", ridge: 0.1, shrinkage: 0.5 }),
  Object.freeze({ id: "temperature_ridge_0.1_shrink_0.75", type: "temperature", ridge: 0.1, shrinkage: 0.75 }),
  Object.freeze({ id: "temperature_ridge_0.1", type: "temperature", ridge: 0.1, shrinkage: 1 }),
  Object.freeze({ id: "beta_ridge_1_shrink_0.25", type: "beta", ridge: 1, shrinkage: 0.25 }),
  Object.freeze({ id: "beta_ridge_1_shrink_0.5", type: "beta", ridge: 1, shrinkage: 0.5 }),
  Object.freeze({ id: "beta_ridge_1_shrink_0.75", type: "beta", ridge: 1, shrinkage: 0.75 }),
  Object.freeze({ id: "beta_ridge_1", type: "beta", ridge: 1, shrinkage: 1 })
]);

class SpatialCandidateScorerError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "SpatialCandidateScorerError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function spatialCandidateScorerImplementationSha256(projectRoot = resolve(__dirname, "..", "..")) {
  const hash = createHash("sha256");
  for (const relativePath of SPATIAL_CANDIDATE_SCORER_FILES) {
    const normalized = relativePath.replaceAll("\\", "/");
    hash.update(`${normalized}\0`, "utf8");
    hash.update(readFileSync(resolve(projectRoot, relativePath)));
    hash.update("\0", "utf8");
  }
  return hash.digest("hex");
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function logistic(value) {
  if (value >= 0) {
    const inverse = Math.exp(-value);
    return 1 / (1 + inverse);
  }
  const exponential = Math.exp(value);
  return exponential / (1 + exponential);
}

function logit(probability) {
  const p = clamp(Number(probability) || 0, 1e-9, 1 - 1e-9);
  return Math.log(p) - Math.log(1 - p);
}

function usableCalibrationPoints(points) {
  return (points || []).filter((point) =>
    Number.isFinite(Number(point.probability)) &&
    Number(point.total) > 0 &&
    Number(point.positives) >= 0 &&
    Number(point.positives) <= Number(point.total)
  );
}

function fitInterceptCalibration(points, ridge = 0.1) {
  const usable = usableCalibrationPoints(points);
  if (usable.length < 3) return { a: 1, b: 1, c: 0, fitted: false, iterations: 0 };
  let intercept = 0;
  let iterations = 0;
  for (; iterations < 80; iterations += 1) {
    let gradient = -ridge * intercept;
    let information = ridge;
    for (const point of usable) {
      const total = Number(point.total);
      const positives = Number(point.positives);
      const fitted = logistic(logit(point.probability) + intercept);
      gradient += positives - total * fitted;
      information += Math.max(1e-12, total * fitted * (1 - fitted));
    }
    const delta = clamp(gradient / information, -2, 2);
    intercept = clamp(intercept + delta, -12, 12);
    if (Math.abs(delta) < 1e-8) break;
  }
  return { a: 1, b: 1, c: intercept, fitted: true, iterations };
}

function fitTemperatureCalibration(points, ridge = 0.1) {
  const usable = usableCalibrationPoints(points);
  if (usable.length < 3) return { a: 1, b: 1, c: 0, fitted: false, iterations: 0 };
  let scale = 1;
  let iterations = 0;
  for (; iterations < 80; iterations += 1) {
    let gradient = -ridge * (scale - 1);
    let information = ridge;
    for (const point of usable) {
      const total = Number(point.total);
      const positives = Number(point.positives);
      const feature = logit(point.probability);
      const fitted = logistic(scale * feature);
      gradient += feature * (positives - total * fitted);
      information += Math.max(1e-12, total * fitted * (1 - fitted) * feature * feature);
    }
    const delta = clamp(gradient / information, -1, 1);
    scale = clamp(scale + delta, 0.05, 20);
    if (Math.abs(delta) < 1e-8) break;
  }
  return { a: scale, b: scale, c: 0, fitted: true, iterations };
}

function shrinkCalibrationFit(fit, shrinkage = 1) {
  const amount = clamp(Number(shrinkage), 0, 1);
  if (!fit?.fitted || amount <= 0) {
    return { a: 1, b: 1, c: 0, fitted: false, iterations: Number(fit?.iterations) || 0, shrinkage: amount };
  }
  return {
    a: 1 + amount * (Number(fit.a) - 1),
    b: 1 + amount * (Number(fit.b) - 1),
    c: amount * Number(fit.c),
    fitted: true,
    iterations: Number(fit.iterations) || 0,
    shrinkage: amount
  };
}

function fitCalibrationFamily(points, family) {
  if (family.type === "identity") return { a: 1, b: 1, c: 0, fitted: false, iterations: 0, shrinkage: 0 };
  let fit;
  if (family.type === "intercept") fit = fitInterceptCalibration(points, family.ridge);
  else if (family.type === "temperature") fit = fitTemperatureCalibration(points, family.ridge);
  else if (family.type === "beta") fit = fitBetaCalibration(points, { ridge: family.ridge });
  else {
    throw new SpatialCandidateScorerError("SPATIAL_CALIBRATOR_FAMILY_INVALID", "未知空间校准器族。", {
      family
    });
  }
  return shrinkCalibrationFit(fit, family.shrinkage ?? 1);
}

function calibrationGroup(positiveCount) {
  const count = Number(positiveCount) || 0;
  if (count < 30) return null;
  if (count < 60) return "positive_30_59";
  if (count < 120) return "positive_60_119";
  if (count < 200) return "positive_120_199";
  return null;
}

function calibrationScope(row, positiveCount = row.positiveCount) {
  if (Number(positiveCount) >= 200) return `species:${row.taxonId}`;
  const group = calibrationGroup(positiveCount);
  return group ? `group:${group}` : null;
}

function cappedEvidence(exposure, detections, cap) {
  const rawExposure = Math.max(0, Number(exposure) || 0);
  const rawDetections = clamp(Number(detections) || 0, 0, rawExposure);
  if (cap === null || rawExposure <= cap) return [rawExposure, rawDetections];
  if (cap === 0 || rawExposure === 0) return [0, 0];
  return [cap, (rawDetections / rawExposure) * cap];
}

function applyChild(alpha, beta, exposure, detections, strength, cap) {
  const [effectiveExposure, effectiveDetections] = cappedEvidence(exposure, detections, cap);
  if (effectiveExposure <= 0) return [alpha, beta];
  const parentProbability = alpha / (alpha + beta);
  return [
    parentProbability * strength + effectiveDetections,
    (1 - parentProbability) * strength + Math.max(0, effectiveExposure - effectiveDetections)
  ];
}

function probabilityFromAdminEvidence(row, caps) {
  if (row.hasSupportedLocalUnit) return Number(row.rawProbability);
  let alpha = 1 + Math.max(0, Number(row.provinceDetections) || 0);
  let beta = 1 + Math.max(0, (Number(row.provinceExposure) || 0) - (Number(row.provinceDetections) || 0));
  [alpha, beta] = applyChild(
    alpha,
    beta,
    row.cityExposure,
    row.cityDetections,
    row.cityStrength,
    caps?.city ?? null
  );
  [alpha, beta] = applyChild(
    alpha,
    beta,
    row.districtExposure,
    row.districtDetections,
    row.districtStrength,
    caps?.district ?? null
  );
  return alpha / (alpha + beta);
}

function baselineProbabilityFromAdminEvidence(row) {
  const exposure = Math.max(0, Number(row.provinceExposure) || 0);
  const detections = clamp(Number(row.provinceDetections) || 0, 0, exposure);
  return (1 + detections) / (2 + exposure);
}

function candidateIdForCaps(caps) {
  const label = (value) => value === null ? "infinite" : String(value);
  return `city=${label(caps?.city)},district=${label(caps?.district)}`;
}

function validateBaseCaps(baseCaps, candidates) {
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  for (const group of ["group_30_79", "group_80_199", "species_200_plus"]) {
    const caps = baseCaps?.[group];
    if (!caps || !candidateIds.has(candidateIdForCaps(caps))) {
      throw new SpatialCandidateScorerError(
        "SPATIAL_BASE_CAPS_INVALID",
        "缓存中的基础行政迁移上限不属于冻结的 25 组候选。",
        { group, caps: caps || null }
      );
    }
  }
}

function baseCapsForRow(row, baseCaps) {
  return baseCaps?.[prevalenceGroup(row.positiveCount)] || { city: null, district: null };
}

function candidateCapsForRow(row, speciesCaps, baseCaps) {
  return speciesCaps.get(String(row.taxonId)) || baseCapsForRow(row, baseCaps);
}

function taskValuesForRow(row) {
  return [
    Number(row.actualPositive),
    Number(row.total),
    Number(row.provinceExposure),
    Number(row.provinceDetections),
    Number(row.cityExposure),
    Number(row.cityDetections),
    Number(row.cityStrength),
    Number(row.districtExposure),
    Number(row.districtDetections),
    Number(row.districtStrength)
  ];
}

function capFoldKey(foldIds) {
  return [...foldIds].map(String).sort().join(",");
}

function combinations(values, size, start = 0, prefix = [], output = []) {
  if (prefix.length === size) {
    output.push(prefix);
    return output;
  }
  for (let index = start; index <= values.length - (size - prefix.length); index += 1) {
    combinations(values, size, index + 1, [...prefix, values[index]], output);
  }
  return output;
}

function targetPositiveCountsForRows(rows, countKey = "positiveCount") {
  const counts = new Map();
  for (const row of rows) {
    counts.set(String(row.taxonId), Math.max(
      counts.get(String(row.taxonId)) || 0,
      Number(row[countKey]) || 0
    ));
  }
  return counts;
}

function targetTaxaAtLeast200(rows, countKey = "positiveCount") {
  return [...targetPositiveCountsForRows(rows, countKey)]
    .filter(([, count]) => count >= 200)
    .map(([taxonId]) => taxonId)
    .sort();
}

async function scoreSpeciesCapRows({ trainingRows, targetTaxa, candidates, workers }) {
  const targetTaxonSet = new Set(targetTaxa);
  const tasks = new Map([...targetTaxonSet].sort().map((taxonId) => [taxonId, []]));
  for (const row of trainingRows) {
    const taxonId = String(row.taxonId);
    if (!targetTaxonSet.has(taxonId) || row.hasSupportedLocalUnit) continue;
    tasks.get(taxonId).push(...taskValuesForRow(row));
  }
  for (const [taxonId, values] of [...tasks]) {
    if (!values.length) tasks.delete(taxonId);
  }
  return tasks.size
    ? await scoreAdminCapTasks({
        tasksByPrevalence: tasks,
        candidates,
        workers,
        chunkRecords: DEFAULT_ADMIN_CAP_CHUNK_RECORDS
      })
    : null;
}

async function buildCapScoreIndex(cache, candidates, workers, productionTaxa) {
  const foldIds = cache.folds.map((fold) => String(fold.foldId)).sort();
  const foldsById = new Map(cache.folds.map((fold) => [String(fold.foldId), fold]));
  const requestedSubsets = [
    ...combinations(foldIds, 1),
    ...combinations(foldIds, 3),
    ...combinations(foldIds, 4),
    foldIds
  ];
  const scores = new Map();
  for (const subset of requestedSubsets) {
    const key = capFoldKey(subset);
    if (scores.has(key)) continue;
    const trainingRows = subset.flatMap((foldId) => foldsById.get(foldId)?.scoreRows || []);
    scores.set(key, await scoreSpeciesCapRows({
      trainingRows,
      targetTaxa: productionTaxa,
      candidates,
      workers
    }));
  }
  return { foldIds, foldsById, scores };
}

function relativeBrierRegret(candidateBrier, bestBrier) {
  if (!Number.isFinite(candidateBrier) || !Number.isFinite(bestBrier)) return Number.POSITIVE_INFINITY;
  if (bestBrier > 1e-12) return Math.max(0, (candidateBrier - bestBrier) / bestBrier);
  return candidateBrier <= bestBrier + 1e-12 ? 0 : Number.POSITIVE_INFINITY;
}

function stableCapWinner(ranking, perFoldRankings) {
  if (!ranking?.length) return null;
  const best = ranking[0];
  const eligible = ranking.filter((candidate) =>
    relativeBrierRegret(candidate.brier, best.brier) <=
      STABLE_CAP_SELECTION_POLICY.maximumRelativePooledBrierRegret + 1e-12
  );
  const foldMaps = perFoldRankings.map((foldRanking) => new Map(
    (foldRanking || []).map((candidate) => [candidate.id, candidate])
  ));
  const scored = eligible.map((candidate) => {
    const regrets = foldMaps.map((foldMap) => {
      const foldCandidate = foldMap.get(candidate.id);
      const foldBest = [...foldMap.values()].sort(
        (left, right) => left.brier - right.brier || left.id.localeCompare(right.id)
      )[0];
      return relativeBrierRegret(foldCandidate?.brier, foldBest?.brier);
    });
    return {
      ...candidate,
      pooledRelativeBrierRegret: relativeBrierRegret(candidate.brier, best.brier),
      maximumFoldRelativeBrierRegret: Math.max(...regrets),
      meanFoldRelativeBrierRegret: regrets.reduce((sum, value) => sum + value, 0) / Math.max(1, regrets.length),
      equivalentCandidateCount: eligible.length
    };
  }).sort((left, right) =>
    left.maximumFoldRelativeBrierRegret - right.maximumFoldRelativeBrierRegret ||
    left.meanFoldRelativeBrierRegret - right.meanFoldRelativeBrierRegret ||
    left.brier - right.brier ||
    left.id.localeCompare(right.id)
  );
  return scored[0] || best;
}

function selectSpeciesCapsFromResults({
  pooledResult,
  perFoldResults,
  trainingFoldIds,
  targetTaxa,
  baseCaps
}) {
  const targetTaxonSet = new Set(targetTaxa);
  const selected = new Map();
  const details = [];
  const fallbackCaps = baseCaps.species_200_plus;
  for (const taxonId of [...targetTaxonSet].sort()) {
    const ranking = pooledResult?.byPrevalence?.[taxonId] || [];
    let winner = stableCapWinner(
      ranking,
      perFoldResults.map((result) => result?.byPrevalence?.[taxonId] || [])
    );
    const usedInstabilityFallback = Boolean(
      winner &&
      (!Number.isFinite(winner.maximumFoldRelativeBrierRegret) ||
        winner.maximumFoldRelativeBrierRegret > STABLE_CAP_SELECTION_POLICY.maximumFoldRelativeBrierRegret)
    );
    if (usedInstabilityFallback) {
      const fallbackCandidate = ranking.find((candidate) => candidate.id === candidateIdForCaps(fallbackCaps));
      if (fallbackCandidate) {
        const fallbackWinner = stableCapWinner(
          [fallbackCandidate],
          perFoldResults.map((result) => result?.byPrevalence?.[taxonId] || [])
        );
        winner = {
          ...fallbackWinner,
          pooledRelativeBrierRegret: relativeBrierRegret(fallbackCandidate.brier, ranking[0]?.brier)
        };
      } else {
        winner = null;
      }
    }
    winner ||= {
      id: candidateIdForCaps(fallbackCaps),
      caps: fallbackCaps,
      brier: null,
      baselineBrier: null,
      evaluatedWeight: 0
    };
    selected.set(taxonId, winner.caps);
    details.push({
      taxonId,
      selectedCandidateId: winner.id,
      caps: winner.caps,
      brier: winner.brier,
      baselineBrier: winner.baselineBrier,
      evaluatedWeight: winner.evaluatedWeight,
      pooledRelativeBrierRegret: winner.pooledRelativeBrierRegret ?? null,
      maximumFoldRelativeBrierRegret: winner.maximumFoldRelativeBrierRegret ?? null,
      meanFoldRelativeBrierRegret: winner.meanFoldRelativeBrierRegret ?? null,
      equivalentCandidateCount: winner.equivalentCandidateCount ?? 1,
      topCandidates: ranking.slice(0, 3).map((candidate) => ({
        id: candidate.id,
        caps: candidate.caps,
        brier: candidate.brier
      })),
      usedBaseFallback: !ranking.length || usedInstabilityFallback,
      usedInstabilityFallback
    });
  }
  return {
    selected,
    details,
    workerCount: pooledResult?.workerCount || 0,
    taskCount: pooledResult?.taskCount || 0,
    trainingFoldIds: [...trainingFoldIds].map(String).sort(),
    strategy: STABLE_CAP_SELECTION_POLICY.strategy
  };
}

function selectSpeciesCapsFromIndex({ capScoreIndex, trainingFoldIds, targetTaxa, baseCaps }) {
  return selectSpeciesCapsFromResults({
    pooledResult: capScoreIndex.scores.get(capFoldKey(trainingFoldIds)),
    perFoldResults: trainingFoldIds.map((foldId) => capScoreIndex.scores.get(capFoldKey([foldId]))),
    trainingFoldIds,
    targetTaxa,
    baseCaps
  });
}

function emptyEceBins() {
  return Array.from({ length: 10 }, () => ({ predicted: 0, positives: 0, total: 0 }));
}

function addEceObservation(bins, probability, positives, total) {
  const index = Math.min(9, Math.floor(clamp(Number(probability), 0, 0.999999999) * 10));
  bins[index].predicted += Number(probability) * Number(total);
  bins[index].positives += Number(positives);
  bins[index].total += Number(total);
}

function eceFromBins(bins) {
  const total = bins.reduce((sum, bin) => sum + Number(bin.total || 0), 0);
  if (total <= 0) return null;
  return bins.reduce((sum, bin) => {
    if (!bin.total) return sum;
    return sum + (bin.total / total) * Math.abs(bin.predicted / bin.total - bin.positives / bin.total);
  }, 0);
}

function summarizeScopeBins(scopeBins) {
  const scopes = [...scopeBins].map(([scopeId, bins]) => ({ scopeId, ece: eceFromBins(bins) }))
    .filter((row) => Number.isFinite(row.ece))
    .sort((left, right) => right.ece - left.ece || left.scopeId.localeCompare(right.scopeId));
  return {
    scopeCount: scopes.length,
    maximumEce: scopes[0]?.ece ?? null,
    worstScopeId: scopes[0]?.scopeId ?? null,
    scopes
  };
}

function spatialAuditDirection(signedBias) {
  const minimum = SPATIAL_ERROR_AUDIT_CONTRACT.minimumMaterialSignedBias;
  if (signedBias > minimum) return "overprediction";
  if (signedBias < -minimum) return "underprediction";
  return "near_calibrated";
}

function summarizeSpatialAuditAccumulator(accumulator, pooledTotal = accumulator.total) {
  if (!accumulator || accumulator.total <= 0) return null;
  const predictedRate = accumulator.predicted / accumulator.total;
  const observedRate = accumulator.positives / accumulator.total;
  const signedBias = predictedRate - observedRate;
  const bins = accumulator.bins.map((bin, index) => {
    if (bin.total <= 0) return null;
    const binPredictedRate = bin.predicted / bin.total;
    const binObservedRate = bin.positives / bin.total;
    const binSignedBias = binPredictedRate - binObservedRate;
    return {
      index,
      lowerBound: index / 10,
      upperBound: (index + 1) / 10,
      evaluatedWeight: bin.total,
      weightShare: bin.total / accumulator.total,
      predictedRate: binPredictedRate,
      observedRate: binObservedRate,
      signedBias: binSignedBias,
      absoluteGap: Math.abs(binSignedBias),
      eceContribution: Math.abs(bin.predicted - bin.positives) / pooledTotal,
      direction: spatialAuditDirection(binSignedBias)
    };
  }).filter(Boolean);
  return {
    rowCount: accumulator.rowCount,
    evaluatedWeight: accumulator.total,
    predictedRate,
    observedRate,
    signedBias,
    absoluteBias: Math.abs(signedBias),
    ece: eceFromBins(accumulator.bins),
    direction: spatialAuditDirection(signedBias),
    populatedBinCount: bins.length,
    bins
  };
}

function spatialAuditClassification(summary, folds) {
  const foldDirections = new Set(folds
    .map((fold) => fold.direction)
    .filter((direction) => direction !== "near_calibrated"));
  const binDirections = new Set(summary.bins
    .map((bin) => bin.direction)
    .filter((direction) => direction !== "near_calibrated"));
  if (foldDirections.has("overprediction") && foldDirections.has("underprediction")) {
    return {
      classification: "mixed_by_spatial_fold",
      recommendedNextStep: "add_stable_spatial_habitat_features"
    };
  }
  if (binDirections.has("overprediction") && binDirections.has("underprediction")) {
    return {
      classification: "mixed_by_probability_bin",
      recommendedNextStep: "add_stable_spatial_habitat_features"
    };
  }
  if (foldDirections.size === 1 && foldDirections.has("overprediction")) {
    return {
      classification: "consistent_overprediction",
      recommendedNextStep: "regularized_monotone_calibration"
    };
  }
  if (foldDirections.size === 1 && foldDirections.has("underprediction")) {
    return {
      classification: "consistent_underprediction",
      recommendedNextStep: "regularized_monotone_calibration"
    };
  }
  return {
    classification: "diffuse_miscalibration",
    recommendedNextStep: "inspect_fold_support_then_add_spatial_features"
  };
}

function buildSpatialErrorAudit(entries, {
  maximumSpeciesEce = SPATIAL_ERROR_AUDIT_CONTRACT.maximumSpeciesEce
} = {}) {
  const byTaxon = new Map();
  for (const entry of entries || []) {
    const row = entry.row || entry;
    if (Number(row.positiveCount) < 200) continue;
    const total = Number(row.total);
    const positives = Number(row.actualPositive);
    const probability = Number(entry.probability ?? row.probability ?? row.rawProbability);
    if (
      !Number.isFinite(total) || total <= 0 ||
      !Number.isFinite(positives) || positives < 0 || positives > total ||
      !Number.isFinite(probability) || probability < 0 || probability > 1
    ) {
      throw new SpatialCandidateScorerError(
        "SPATIAL_ERROR_AUDIT_ROW_INVALID",
        "空间逐鸟误差审计遇到非法 OOF 行。"
      );
    }
    const taxonId = String(row.taxonId);
    const foldId = String(entry.foldId ?? row.foldId);
    if (!byTaxon.has(taxonId)) {
      byTaxon.set(taxonId, {
        taxonId,
        rowCount: 0,
        total: 0,
        positives: 0,
        predicted: 0,
        bins: emptyEceBins(),
        folds: new Map()
      });
    }
    const taxon = byTaxon.get(taxonId);
    if (!taxon.folds.has(foldId)) {
      taxon.folds.set(foldId, {
        foldId,
        rowCount: 0,
        total: 0,
        positives: 0,
        predicted: 0,
        bins: emptyEceBins()
      });
    }
    for (const accumulator of [taxon, taxon.folds.get(foldId)]) {
      accumulator.rowCount += 1;
      accumulator.total += total;
      accumulator.positives += positives;
      accumulator.predicted += probability * total;
      addEceObservation(accumulator.bins, probability, positives, total);
    }
  }
  const allSpecies = [...byTaxon.values()].map((taxon) => {
    const summary = summarizeSpatialAuditAccumulator(taxon);
    const folds = [...taxon.folds.values()]
      .sort((left, right) => left.foldId.localeCompare(right.foldId))
      .map((fold) => ({
        foldId: fold.foldId,
        ...summarizeSpatialAuditAccumulator(fold, taxon.total),
        bins: undefined
      }));
    const dominantBin = [...summary.bins]
      .sort((left, right) =>
        right.eceContribution - left.eceContribution ||
        left.index - right.index
      )[0] || null;
    return {
      taxonId: taxon.taxonId,
      ...summary,
      bins: summary.bins,
      folds,
      dominantBin,
      ...spatialAuditClassification(summary, folds)
    };
  }).sort((left, right) => right.ece - left.ece || left.taxonId.localeCompare(right.taxonId));
  const overThreshold = allSpecies.filter((species) => species.ece > maximumSpeciesEce);
  const classificationCounts = {};
  for (const species of overThreshold) {
    classificationCounts[species.classification] =
      (classificationCounts[species.classification] || 0) + 1;
  }
  return {
    contract: SPATIAL_ERROR_AUDIT_CONTRACT,
    maximumSpeciesEce,
    auditedScopeCount: allSpecies.length,
    overThresholdCount: overThreshold.length,
    underOrAtThresholdCount: allSpecies.length - overThreshold.length,
    worstTaxonId: allSpecies[0]?.taxonId ?? null,
    maximumObservedEce: allSpecies[0]?.ece ?? null,
    classificationCounts: Object.fromEntries(Object.entries(classificationCounts).sort()),
    species: overThreshold
  };
}

function evaluateCandidateRows(entries) {
  if (!Array.isArray(entries) || !entries.length) return null;
  const calibrationBins = emptyEceBins();
  const calibrationScopeBins = { species: new Map(), group: new Map() };
  const prevalenceLosses = new Map(PREVALENCE_GROUPS.map((group) => [group, {
    modelLoss: 0,
    baselineLoss: 0,
    evaluatedWeight: 0
  }]));
  const contexts = new Map();
  const evaluatedTaxa = new Set();
  const fallbackLevels = new Map();
  let modelLoss = 0;
  let baselineLoss = 0;
  let evaluatedWeight = 0;
  for (const entry of entries) {
    const row = entry.row || entry;
    const probability = Number(entry.probability ?? row.probability ?? row.rawProbability);
    const actual = Number(row.actualPositive) || 0;
    const total = Number(row.total) || 0;
    const baselineProbability = Number(row.baselineProbability);
    const rowModelLoss = actual * (1 - probability) ** 2 + (total - actual) * probability ** 2;
    const rowBaselineLoss =
      actual * (1 - baselineProbability) ** 2 + (total - actual) * baselineProbability ** 2;
    modelLoss += rowModelLoss;
    baselineLoss += rowBaselineLoss;
    evaluatedWeight += total;
    evaluatedTaxa.add(String(row.taxonId));
    addEceObservation(calibrationBins, probability, actual, total);
    if (Number(row.positiveCount) >= 30) {
      const type = Number(row.positiveCount) >= 200 ? "species" : "group";
      const scopeId = type === "species" ? String(row.taxonId) : calibrationGroup(row.positiveCount);
      if (scopeId) {
        if (!calibrationScopeBins[type].has(scopeId)) calibrationScopeBins[type].set(scopeId, emptyEceBins());
        addEceObservation(calibrationScopeBins[type].get(scopeId), probability, actual, total);
      }
    }
    const prevalence = prevalenceLosses.get(prevalenceGroup(row.positiveCount));
    prevalence.modelLoss += rowModelLoss;
    prevalence.baselineLoss += rowBaselineLoss;
    prevalence.evaluatedWeight += total;
    fallbackLevels.set(row.deepestLevel, (fallbackLevels.get(row.deepestLevel) || 0) + 1);
    const contextKey = `${entry.foldId ?? row.foldId}\0${row.contextIndex}`;
    if (!contexts.has(contextKey)) contexts.set(contextKey, []);
    contexts.get(contextKey).push({
      taxonId: String(row.taxonId),
      actualPositive: actual,
      probability,
      baselineProbability
    });
  }
  if (evaluatedWeight <= 0) return null;
  let recallHits = 0;
  let baselineRecallHits = 0;
  let recallActual = 0;
  for (const rows of contexts.values()) {
    const actualTaxa = rows.filter((row) => row.actualPositive > 0);
    if (!actualTaxa.length) continue;
    const modelTop = new Set([...rows]
      .sort((left, right) => right.probability - left.probability || left.taxonId.localeCompare(right.taxonId))
      .slice(0, 20)
      .map((row) => row.taxonId));
    const baselineTop = new Set([...rows]
      .sort((left, right) =>
        right.baselineProbability - left.baselineProbability || left.taxonId.localeCompare(right.taxonId)
      )
      .slice(0, 20)
      .map((row) => row.taxonId));
    for (const row of actualTaxa) {
      if (modelTop.has(row.taxonId)) recallHits += 1;
      if (baselineTop.has(row.taxonId)) baselineRecallHits += 1;
    }
    recallActual += actualTaxa.length;
  }
  const brier = modelLoss / evaluatedWeight;
  const baselineBrier = baselineLoss / evaluatedWeight;
  return {
    brier,
    baselineBrier,
    brierSkill: baselineBrier > 0 ? 1 - brier / baselineBrier : null,
    ece: eceFromBins(calibrationBins),
    recallAt20: recallActual ? recallHits / recallActual : null,
    baselineRecallAt20: recallActual ? baselineRecallHits / recallActual : null,
    recallAt20Delta: recallActual ? (recallHits - baselineRecallHits) / recallActual : null,
    recallHits,
    baselineRecallHits,
    recallActual,
    calibrationBins,
    calibrationEce: {
      species: summarizeScopeBins(calibrationScopeBins.species),
      group: summarizeScopeBins(calibrationScopeBins.group)
    },
    prevalenceMetrics: Object.fromEntries([...prevalenceLosses].map(([group, values]) => [group, {
      brier: values.evaluatedWeight > 0 ? values.modelLoss / values.evaluatedWeight : null,
      baselineBrier: values.evaluatedWeight > 0 ? values.baselineLoss / values.evaluatedWeight : null,
      evaluatedWeight: values.evaluatedWeight
    }])),
    evaluatedWeight,
    evaluatedTaxa: evaluatedTaxa.size,
    validationContexts: contexts.size,
    fallbackLevels: Object.fromEntries([...fallbackLevels].sort())
  };
}

function fitCalibratorMap({
  trainingRows,
  targetRows,
  targetPositiveCounts = null,
  speciesCaps,
  baseCaps,
  family
}) {
  const targetTaxa = new Map();
  if (targetPositiveCounts instanceof Map) {
    for (const [taxonId, positiveCount] of targetPositiveCounts) {
      targetTaxa.set(String(taxonId), Number(positiveCount) || 0);
    }
  } else {
    for (const row of targetRows) {
      targetTaxa.set(String(row.taxonId), Math.max(
        targetTaxa.get(String(row.taxonId)) || 0,
        Number(row.positiveCount) || 0
      ));
    }
  }
  const trainingPoints = new Map();
  for (const row of trainingRows) {
    const taxonId = String(row.taxonId);
    if (!targetTaxa.has(taxonId)) continue;
    if (!trainingPoints.has(taxonId)) trainingPoints.set(taxonId, []);
    trainingPoints.get(taxonId).push({
      probability: probabilityFromAdminEvidence(row, candidateCapsForRow(row, speciesCaps, baseCaps)),
      positives: row.actualPositive,
      total: row.total
    });
  }
  const maps = new Map();
  const groups = new Map();
  for (const [taxonId, positiveCount] of targetTaxa) {
    if (positiveCount >= 200) {
      maps.set(`species:${taxonId}`, fitCalibrationFamily(trainingPoints.get(taxonId) || [], family));
      continue;
    }
    const group = calibrationGroup(positiveCount);
    if (!group) continue;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(taxonId);
  }
  for (const [group, taxonIds] of groups) {
    maps.set(
      `group:${group}`,
      fitCalibrationFamily(taxonIds.flatMap((taxonId) => trainingPoints.get(taxonId) || []), family)
    );
  }
  return maps;
}

function guardFamilyEntries(entries, family) {
  const statsByScope = new Map();
  for (const entry of entries) {
    const scope = entry.scope;
    if (!scope) continue;
    if (!statsByScope.has(scope)) {
      statsByScope.set(scope, {
        rawLoss: 0,
        candidateLoss: 0,
        total: 0,
        rawBins: emptyEceBins(),
        candidateBins: emptyEceBins(),
        fittedApplications: 0
      });
    }
    const stats = statsByScope.get(scope);
    const actual = Number(entry.row.actualPositive) || 0;
    const total = Number(entry.row.total) || 0;
    stats.rawLoss += actual * (1 - entry.rawProbability) ** 2 + (total - actual) * entry.rawProbability ** 2;
    stats.candidateLoss +=
      actual * (1 - entry.candidateProbability) ** 2 + (total - actual) * entry.candidateProbability ** 2;
    stats.total += total;
    if (entry.fit?.fitted) stats.fittedApplications += 1;
    addEceObservation(stats.rawBins, entry.rawProbability, actual, total);
    addEceObservation(stats.candidateBins, entry.candidateProbability, actual, total);
  }
  const acceptedScopes = new Set();
  const scopes = [];
  for (const [scope, stats] of statsByScope) {
    const rawBrier = stats.total > 0 ? stats.rawLoss / stats.total : null;
    const candidateBrier = stats.total > 0 ? stats.candidateLoss / stats.total : null;
    const rawEce = eceFromBins(stats.rawBins);
    const candidateEce = eceFromBins(stats.candidateBins);
    const relativeBrierDegradation = rawBrier > 1e-12
      ? (candidateBrier - rawBrier) / rawBrier
      : candidateBrier <= rawBrier + 1e-12 ? 0 : Number.POSITIVE_INFINITY;
    const eceDegradation = candidateEce - rawEce;
    const accepted =
      family.type !== "identity" &&
      stats.fittedApplications > 0 &&
      relativeBrierDegradation <= SPATIAL_CALIBRATION_GUARD.maximumRelativeBrierDegradation &&
      eceDegradation <= SPATIAL_CALIBRATION_GUARD.maximumEceDegradation;
    if (accepted) acceptedScopes.add(scope);
    scopes.push({
      scope,
      accepted,
      fittedApplications: stats.fittedApplications,
      rawBrier,
      candidateBrier,
      relativeBrierDegradation,
      rawEce,
      candidateEce,
      eceDegradation
    });
  }
  scopes.sort((left, right) => left.scope.localeCompare(right.scope));
  return { acceptedScopes, scopes };
}

function relativeBrierDegradation(rawBrier, candidateBrier) {
  if (rawBrier > 1e-12) return (candidateBrier - rawBrier) / rawBrier;
  return candidateBrier <= rawBrier + 1e-12 ? 0 : Number.POSITIVE_INFINITY;
}

function spatialQualityFailures(metrics) {
  const failures = [];
  if (!Number.isFinite(metrics?.brierSkill) || metrics.brierSkill <= PRODUCTION_SPATIAL_QUALITY_THRESHOLDS.minimumBrierSkill) {
    failures.push("spatial.brierSkill");
  }
  if (!Number.isFinite(metrics?.ece) || metrics.ece > PRODUCTION_SPATIAL_QUALITY_THRESHOLDS.maximumEce) {
    failures.push("spatial.ece");
  }
  if (
    Number(metrics?.calibrationEce?.species?.scopeCount || 0) > 0 &&
    (!Number.isFinite(metrics.calibrationEce.species.maximumEce) ||
      metrics.calibrationEce.species.maximumEce > PRODUCTION_SPATIAL_QUALITY_THRESHOLDS.maximumSpeciesEce)
  ) failures.push("spatial.species_calibration.maximumEce");
  if (
    Number(metrics?.calibrationEce?.group?.scopeCount || 0) > 0 &&
    (!Number.isFinite(metrics.calibrationEce.group.maximumEce) ||
      metrics.calibrationEce.group.maximumEce > PRODUCTION_SPATIAL_QUALITY_THRESHOLDS.maximumGroupEce)
  ) failures.push("spatial.group_calibration.maximumEce");
  if (
    !Number.isFinite(metrics?.recallAt20Delta) ||
    metrics.recallAt20Delta < PRODUCTION_SPATIAL_QUALITY_THRESHOLDS.minimumRecallAt20Delta
  ) failures.push("spatial.recallAt20Delta");
  return failures;
}

function compactMetrics(metrics) {
  if (!metrics) return null;
  return {
    brier: metrics.brier,
    baselineBrier: metrics.baselineBrier,
    brierSkill: metrics.brierSkill,
    ece: metrics.ece,
    recallAt20: metrics.recallAt20,
    baselineRecallAt20: metrics.baselineRecallAt20,
    recallAt20Delta: metrics.recallAt20Delta,
    recallHits: metrics.recallHits,
    baselineRecallHits: metrics.baselineRecallHits,
    recallActual: metrics.recallActual,
    calibrationEce: {
      species: {
        scopeCount: metrics.calibrationEce.species.scopeCount,
        maximumEce: metrics.calibrationEce.species.maximumEce,
        worstScopeId: metrics.calibrationEce.species.worstScopeId,
        worstScopes: metrics.calibrationEce.species.scopes.slice(0, 30)
      },
      group: {
        scopeCount: metrics.calibrationEce.group.scopeCount,
        maximumEce: metrics.calibrationEce.group.maximumEce,
        worstScopeId: metrics.calibrationEce.group.worstScopeId,
        worstScopes: metrics.calibrationEce.group.scopes.slice(0, 30)
      }
    },
    prevalenceMetrics: metrics.prevalenceMetrics,
    evaluatedWeight: metrics.evaluatedWeight,
    evaluatedTaxa: metrics.evaluatedTaxa,
    validationContexts: metrics.validationContexts,
    fallbackLevels: metrics.fallbackLevels
  };
}

function metricValuesMatch(left, right) {
  if (left === null || right === null) return left === right;
  if (!Number.isFinite(Number(left)) || !Number.isFinite(Number(right))) return false;
  return Math.abs(Number(left) - Number(right)) <=
    1e-10 * Math.max(1, Math.abs(Number(left)), Math.abs(Number(right)));
}

function assertReferenceMetrics(fold, actualMetrics) {
  const reference = fold.referenceRawMetrics;
  if (!reference || !actualMetrics) {
    throw new SpatialCandidateScorerError(
      "SPATIAL_OOF_REFERENCE_METRICS_MISSING",
      `第 ${fold.foldId} 折缺少可重算的 reference raw metrics。`
    );
  }
  const keys = [
    "brier",
    "baselineBrier",
    "brierSkill",
    "ece",
    "recallAt20",
    "baselineRecallAt20",
    "recallAt20Delta",
    "recallHits",
    "baselineRecallHits",
    "recallActual",
    "evaluatedWeight",
    "evaluatedTaxa",
    "validationContexts"
  ];
  const mismatches = [];
  for (const key of keys) {
    if (!metricValuesMatch(actualMetrics[key], reference[key])) mismatches.push(key);
  }
  for (const type of ["species", "group"]) {
    const actualScope = actualMetrics.calibrationEce?.[type] || null;
    const referenceScope = reference.calibrationEce?.[type] || null;
    if (!actualScope || !referenceScope) {
      if (actualScope !== referenceScope) mismatches.push(`calibrationEce.${type}`);
      continue;
    }
    if (!metricValuesMatch(actualScope.scopeCount, referenceScope.scopeCount)) {
      mismatches.push(`calibrationEce.${type}.scopeCount`);
    }
    if (!metricValuesMatch(actualScope.maximumEce, referenceScope.maximumEce)) {
      mismatches.push(`calibrationEce.${type}.maximumEce`);
    }
    if ((actualScope.worstScopeId ?? null) !== (referenceScope.worstScopeId ?? null)) {
      mismatches.push(`calibrationEce.${type}.worstScopeId`);
    }
  }
  if (mismatches.length) {
    throw new SpatialCandidateScorerError(
      "SPATIAL_OOF_REFERENCE_METRICS_MISMATCH",
      `第 ${fold.foldId} 折逐行重算结果与缓存 reference raw metrics 不一致。`,
      { foldId: String(fold.foldId), mismatches }
    );
  }
}

function assertReferenceEvidence(cache, baseCaps) {
  let checkedRows = 0;
  let checkedInnerRows = 0;
  let checkedFolds = 0;
  for (const fold of cache.folds) {
    const entries = [];
    for (const row of fold.scoreRows) {
      const baseline = baselineProbabilityFromAdminEvidence(row);
      if (Math.abs(baseline - Number(row.baselineProbability)) > 1e-10) {
        throw new SpatialCandidateScorerError(
          "SPATIAL_OOF_REFERENCE_MISMATCH",
          "缓存省级证据无法重建 reference baseline probability。",
          { foldId: fold.foldId, contextIndex: row.contextIndex, taxonId: row.taxonId }
        );
      }
      if (!row.hasSupportedLocalUnit) {
        const raw = probabilityFromAdminEvidence(row, baseCapsForRow(row, baseCaps));
        if (Math.abs(raw - Number(row.rawProbability)) > 1e-10) {
          throw new SpatialCandidateScorerError(
            "SPATIAL_OOF_REFERENCE_MISMATCH",
            "缓存行政证据无法重建 reference raw probability。",
            { foldId: fold.foldId, contextIndex: row.contextIndex, taxonId: row.taxonId }
          );
        }
      }
      entries.push({ foldId: String(fold.foldId), row, probability: Number(row.rawProbability) });
      checkedRows += 1;
    }
    assertReferenceMetrics(fold, evaluateCandidateRows(entries));
    checkedFolds += 1;
    for (const innerFold of fold.innerFolds || []) {
      for (const row of innerFold.scoreRows || []) {
        const baseline = baselineProbabilityFromAdminEvidence(row);
        const raw = probabilityFromAdminEvidence(row, baseCapsForRow(row, baseCaps));
        if (
          Math.abs(baseline - Number(row.baselineProbability)) > 1e-10 ||
          (!row.hasSupportedLocalUnit && Math.abs(raw - Number(row.rawProbability)) > 1e-10)
        ) {
          throw new SpatialCandidateScorerError(
            "SPATIAL_OOF_INNER_REFERENCE_MISMATCH",
            "严格内层缓存证据无法重建 reference probability。",
            {
              outerFoldId: String(fold.foldId),
              innerFoldId: String(innerFold.innerFoldId),
              contextIndex: row.contextIndex,
              taxonId: row.taxonId
            }
          );
        }
        checkedInnerRows += 1;
      }
    }
  }
  return { checkedRows, checkedInnerRows, checkedFolds };
}

function validateScoringCache(cache, candidates) {
  if (cache?.metadata?.panel !== "development" || cache?.metadata?.diagnosticOnly !== true) {
    throw new SpatialCandidateScorerError(
      "SPATIAL_OOF_CACHE_DEVELOPMENT_ONLY",
      "候选评分只接受 development diagnostic OOF 缓存。"
    );
  }
  if (cache.metadata.candidateSetSha256 !== candidateSetSha256()) {
    throw new SpatialCandidateScorerError("SPATIAL_CAP_CANDIDATES_MISMATCH", "缓存绑定的 25 组候选与当前实现不匹配。");
  }
  if (cache.metadata.developmentPoolPositiveCountPolicy !== DEVELOPMENT_POOL_POSITIVE_COUNT_POLICY) {
    throw new SpatialCandidateScorerError(
      "SPATIAL_OOF_DEVELOPMENT_COUNT_POLICY_MISMATCH",
      "缓存 development-pool positive_count 契约不匹配。"
    );
  }
  if (cache.metadata.outerTrainingPositiveCountPolicy !== OUTER_TRAINING_POSITIVE_COUNT_POLICY) {
    throw new SpatialCandidateScorerError(
      "SPATIAL_OOF_OUTER_COUNT_POLICY_MISMATCH",
      "缓存 outer-training positive_count 契约不匹配。"
    );
  }
  if (cache.metadata.innerTrainingPositiveCountPolicy !== INNER_TRAINING_POSITIVE_COUNT_POLICY) {
    throw new SpatialCandidateScorerError(
      "SPATIAL_OOF_INNER_COUNT_POLICY_MISMATCH",
      "缓存 inner-training positive_count 契约不匹配。"
    );
  }
  if (!Array.isArray(cache.folds) || cache.folds.length !== 5) {
    throw new SpatialCandidateScorerError("SPATIAL_OOF_FOLDS_INVALID", "候选评分必须使用完整五折。" );
  }
  const foldIds = cache.folds.map((fold) => String(fold.foldId)).sort();
  if (canonicalJson(foldIds) !== canonicalJson(["1", "2", "3", "4", "5"])) {
    throw new SpatialCandidateScorerError("SPATIAL_OOF_FOLDS_INVALID", "候选评分折号必须恰为 1..5。", {
      foldIds
    });
  }
  if (candidates.length !== 25 || new Set(candidates.map((candidate) => candidate.id)).size !== 25) {
    throw new SpatialCandidateScorerError("SPATIAL_CAP_CANDIDATES_MISMATCH", "候选集合必须恰为已定义的 25 组。" );
  }
  for (const fold of cache.folds) {
    if (!Array.isArray(fold.scoreRows) || !fold.scoreRows.length) {
      throw new SpatialCandidateScorerError("SPATIAL_OOF_FOLD_EMPTY", `第 ${fold.foldId} 折为空。`);
    }
    for (const row of fold.scoreRows) {
      if (
        !Number.isInteger(Number(row.developmentPositiveCount)) ||
        Number(row.developmentPositiveCount) < Number(row.positiveCount)
      ) {
        throw new SpatialCandidateScorerError(
          "SPATIAL_OOF_DEVELOPMENT_POSITIVE_COUNT_INVALID",
          `第 ${fold.foldId} 折 taxon ${row.taxonId} 的 development-pool positive_count 非法。`
        );
      }
    }
    const outerFoldId = String(fold.foldId);
    const expectedInnerFoldIds = foldIds.filter((foldId) => foldId !== outerFoldId);
    if (!Array.isArray(fold.innerFolds) || fold.innerFolds.length !== 4) {
      throw new SpatialCandidateScorerError(
        "SPATIAL_OOF_INNER_FOLDS_INVALID",
        `第 ${outerFoldId} 外层折必须包含四个严格内层折。`
      );
    }
    const actualInnerFoldIds = fold.innerFolds.map((innerFold) => String(innerFold.innerFoldId)).sort();
    if (canonicalJson(actualInnerFoldIds) !== canonicalJson(expectedInnerFoldIds)) {
      throw new SpatialCandidateScorerError(
        "SPATIAL_OOF_INNER_FOLDS_INVALID",
        `第 ${outerFoldId} 外层折的内层折编号不完整。`,
        { expectedInnerFoldIds, actualInnerFoldIds }
      );
    }
    for (const innerFold of fold.innerFolds) {
      const innerFoldId = String(innerFold.innerFoldId);
      const expectedTrainingFoldIds = foldIds
        .filter((foldId) => foldId !== outerFoldId && foldId !== innerFoldId)
        .sort();
      const actualTrainingFoldIds = [...(innerFold.trainingFoldIds || [])].map(String).sort();
      if (canonicalJson(actualTrainingFoldIds) !== canonicalJson(expectedTrainingFoldIds)) {
        throw new SpatialCandidateScorerError(
          "SPATIAL_OOF_INNER_TRAINING_FOLDS_INVALID",
          `外层折 ${outerFoldId}、内层折 ${innerFoldId} 的训练折编号不符合严格嵌套契约。`,
          { expectedTrainingFoldIds, actualTrainingFoldIds }
        );
      }
      if (!Array.isArray(innerFold.scoreRows) || !innerFold.scoreRows.length) {
        throw new SpatialCandidateScorerError(
          "SPATIAL_OOF_INNER_FOLD_EMPTY",
          `外层折 ${outerFoldId}、内层折 ${innerFoldId} 为空。`
        );
      }
      for (const row of innerFold.scoreRows) {
        if (
          !Number.isInteger(Number(row.positiveCount)) ||
          !Number.isInteger(Number(row.outerPositiveCount)) ||
          !Number.isInteger(Number(row.developmentPositiveCount)) ||
          Number(row.positiveCount) > Number(row.outerPositiveCount) ||
          Number(row.outerPositiveCount) > Number(row.developmentPositiveCount)
        ) {
          throw new SpatialCandidateScorerError(
            "SPATIAL_OOF_INNER_POSITIVE_COUNT_INVALID",
            `外层折 ${outerFoldId}、内层折 ${innerFoldId}、taxon ${row.taxonId} 的正例计数关系非法。`
          );
        }
      }
    }
  }
}

async function buildCapSelectionPlans(cache, candidates, workers, baseCaps) {
  const allRows = cache.folds.flatMap((fold) => fold.scoreRows);
  const productionPositiveCounts = new Map();
  for (const row of allRows) {
    const taxonId = String(row.taxonId);
    const developmentPositiveCount = Number(row.developmentPositiveCount);
    const prior = productionPositiveCounts.get(taxonId);
    if (prior !== undefined && prior !== developmentPositiveCount) {
      throw new SpatialCandidateScorerError(
        "SPATIAL_OOF_DEVELOPMENT_POSITIVE_COUNT_INVALID",
        `taxon ${taxonId} 的 development-pool positive_count 在折间不一致。`
      );
    }
    productionPositiveCounts.set(taxonId, developmentPositiveCount);
  }
  const productionTaxa = [...productionPositiveCounts]
    .filter(([, count]) => count >= 200)
    .map(([taxonId]) => taxonId)
    .sort();
  const foldIds = cache.folds.map((fold) => String(fold.foldId)).sort();
  const scoreEvidenceSets = async (evidenceSets, targetTaxa, trainingFoldIds) => {
    const pooledResult = await scoreSpeciesCapRows({
      trainingRows: evidenceSets.flatMap((fold) => fold.scoreRows || []),
      targetTaxa,
      candidates,
      workers
    });
    const perFoldResults = [];
    for (const fold of evidenceSets) {
      perFoldResults.push(await scoreSpeciesCapRows({
        trainingRows: fold.scoreRows || [],
        targetTaxa,
        candidates,
        workers
      }));
    }
    return selectSpeciesCapsFromResults({
      pooledResult,
      perFoldResults,
      trainingFoldIds,
      targetTaxa,
      baseCaps
    });
  };
  const production = await scoreEvidenceSets(cache.folds, productionTaxa, foldIds);
  const heldout = [];
  for (const targetFold of cache.folds) {
    const targetPositiveCounts = new Map();
    for (const row of targetFold.scoreRows) {
      targetPositiveCounts.set(String(row.taxonId), Math.max(
        targetPositiveCounts.get(String(row.taxonId)) || 0,
        Number(row.positiveCount) || 0
      ));
    }
    const targetTaxa = [...targetPositiveCounts]
      .filter(([, count]) => count >= 200)
      .map(([taxonId]) => taxonId)
      .sort();
    const trainingFoldIds = foldIds.filter((foldId) => foldId !== String(targetFold.foldId));
    const selection = await scoreEvidenceSets(targetFold.innerFolds, targetTaxa, trainingFoldIds);
    heldout.push({
      foldId: String(targetFold.foldId),
      trainingFoldIds,
      evidenceFoldIds: targetFold.innerFolds.map((fold) => String(fold.innerFoldId)).sort(),
      ...selection
    });
  }
  return { production, heldout, productionPositiveCounts, foldIds };
}

function speciesCapReport(plans) {
  const heldoutByTaxon = new Map();
  for (const plan of plans.heldout) {
    for (const detail of plan.details) {
      if (!heldoutByTaxon.has(detail.taxonId)) heldoutByTaxon.set(detail.taxonId, []);
      heldoutByTaxon.get(detail.taxonId).push({
        heldoutFoldId: plan.foldId,
        trainingFoldIds: plan.trainingFoldIds,
        selectedCandidateId: detail.selectedCandidateId,
        caps: detail.caps,
        brier: detail.brier,
        usedBaseFallback: detail.usedBaseFallback
      });
    }
  }
  return plans.production.details.map((detail) => {
    const crossFit = (heldoutByTaxon.get(detail.taxonId) || [])
      .sort((left, right) => left.heldoutFoldId.localeCompare(right.heldoutFoldId));
    return {
      taxonId: detail.taxonId,
      developmentPositiveCount: plans.productionPositiveCounts.get(detail.taxonId),
      selectedCandidateId: detail.selectedCandidateId,
      caps: detail.caps,
      brier: detail.brier,
      topCandidates: detail.topCandidates,
      crossFit,
      crossFitSelectionAgreement: crossFit.length
        ? crossFit.filter((item) => item.selectedCandidateId === detail.selectedCandidateId).length / crossFit.length
        : null
    };
  });
}

function scoreCalibrationFamily({ cache, capPlans, baseCaps, family }) {
  const heldoutEntries = [];
  for (const targetFold of cache.folds) {
    const plan = capPlans.heldout.find((item) => item.foldId === String(targetFold.foldId));
    const trainingRows = cache.folds
      .filter((fold) => fold !== targetFold)
      .flatMap((fold) => fold.scoreRows);
    const calibrators = fitCalibratorMap({
      trainingRows,
      targetRows: targetFold.scoreRows,
      speciesCaps: plan.selected,
      baseCaps,
      family
    });
    for (const row of targetFold.scoreRows) {
      const rawProbability = probabilityFromAdminEvidence(
        row,
        candidateCapsForRow(row, plan.selected, baseCaps)
      );
      const scope = calibrationScope(row);
      const fit = scope ? calibrators.get(scope) || null : null;
      const candidateProbability = fit?.fitted ? calibrateProbability(rawProbability, fit) : rawProbability;
      heldoutEntries.push({
        foldId: String(targetFold.foldId),
        row,
        scope,
        fit,
        rawProbability,
        candidateProbability
      });
    }
  }
  const scopeGuard = guardFamilyEntries(heldoutEntries, family);
  const scopeGuardEntries = heldoutEntries.map((entry) => ({
    foldId: entry.foldId,
    row: entry.row,
    probability: entry.scope && scopeGuard.acceptedScopes.has(entry.scope)
      ? entry.candidateProbability
      : entry.rawProbability
  }));
  const rawEntries = heldoutEntries.map((entry) => ({
    foldId: entry.foldId,
    row: entry.row,
    probability: entry.rawProbability
  }));
  const rawMetrics = evaluateCandidateRows(rawEntries);
  const scopeGuardMetrics = evaluateCandidateRows(scopeGuardEntries);
  const overallRelativeBrierDegradation = relativeBrierDegradation(
    rawMetrics.brier,
    scopeGuardMetrics.brier
  );
  const overallEceDegradation = scopeGuardMetrics.ece - rawMetrics.ece;
  const overallAccepted =
    overallRelativeBrierDegradation <= SPATIAL_CALIBRATION_GUARD.maximumRelativeBrierDegradation &&
    overallEceDegradation <= SPATIAL_CALIBRATION_GUARD.maximumEceDegradation;
  const effectiveAcceptedScopes = overallAccepted ? scopeGuard.acceptedScopes : new Set();
  const finalEntries = overallAccepted ? scopeGuardEntries : rawEntries;
  const metrics = overallAccepted ? scopeGuardMetrics : rawMetrics;
  const foldMetrics = cache.folds.map((fold) => ({
    foldId: String(fold.foldId),
    metrics: compactMetrics(evaluateCandidateRows(finalEntries.filter((entry) => entry.foldId === String(fold.foldId))))
  }));
  const allRows = cache.folds.flatMap((fold) => fold.scoreRows);
  const productionCalibrators = fitCalibratorMap({
    trainingRows: allRows,
    targetRows: allRows,
    targetPositiveCounts: capPlans.productionPositiveCounts,
    speciesCaps: capPlans.production.selected,
    baseCaps,
    family
  });
  return {
    family,
    guard: {
      fitFoldCount: 4,
      heldoutFoldCount: 5,
      ...SPATIAL_CALIBRATION_GUARD,
      acceptedCount: effectiveAcceptedScopes.size,
      rejectedCount: scopeGuard.scopes.length - effectiveAcceptedScopes.size,
      overall: {
        accepted: overallAccepted,
        rawBrier: rawMetrics.brier,
        candidateBrier: scopeGuardMetrics.brier,
        relativeBrierDegradation: overallRelativeBrierDegradation,
        rawEce: rawMetrics.ece,
        candidateEce: scopeGuardMetrics.ece,
        eceDegradation: overallEceDegradation
      },
      scopes: scopeGuard.scopes.map((scope) => ({
        ...scope,
        scopeGuardAccepted: scope.accepted,
        accepted: overallAccepted && scope.accepted,
        rejectedByOverallGuard: !overallAccepted && scope.accepted
      }))
    },
    rawMetrics: compactMetrics(rawMetrics),
    metrics,
    compactMetrics: compactMetrics(metrics),
    foldMetrics,
    failures: spatialQualityFailures(metrics),
    productionCalibrators: [...productionCalibrators]
      .filter(([scope, fit]) => effectiveAcceptedScopes.has(scope) && fit?.fitted)
      .map(([scope, fit]) => ({ scope, family: family.id, fit }))
      .sort((left, right) => left.scope.localeCompare(right.scope))
  };
}

function capPolicyReport(plan) {
  return {
    strategy: STABLE_CAP_SELECTION_POLICY.strategy,
    maximumRelativePooledBrierRegret: STABLE_CAP_SELECTION_POLICY.maximumRelativePooledBrierRegret,
    maximumFoldRelativeBrierRegret: STABLE_CAP_SELECTION_POLICY.maximumFoldRelativeBrierRegret,
    trainingFoldIds: [...(plan.trainingFoldIds || [])].map(String).sort(),
    speciesCaps: plan.details.map((detail) => ({
      taxonId: detail.taxonId,
      selectedCandidateId: detail.selectedCandidateId,
      caps: detail.caps,
      brier: detail.brier,
      pooledRelativeBrierRegret: detail.pooledRelativeBrierRegret,
      maximumFoldRelativeBrierRegret: detail.maximumFoldRelativeBrierRegret,
      meanFoldRelativeBrierRegret: detail.meanFoldRelativeBrierRegret,
      equivalentCandidateCount: detail.equivalentCandidateCount,
      usedBaseFallback: detail.usedBaseFallback,
      usedInstabilityFallback: detail.usedInstabilityFallback
    }))
  };
}

function foldRows(capPlans, foldIds) {
  return foldIds.flatMap((foldId) => capPlans.capScoreIndex.foldsById.get(String(foldId))?.scoreRows || []);
}

function targetTaxaForFold(targetFold, targetPositiveCounts = null) {
  if (!(targetPositiveCounts instanceof Map)) return targetTaxaAtLeast200(targetFold.scoreRows);
  return [...new Set(targetFold.scoreRows.map((row) => String(row.taxonId)))]
    .filter((taxonId) => Number(targetPositiveCounts.get(taxonId)) >= 200)
    .sort();
}

function capPlanForTargetFold(capPlans, trainingFoldIds, targetFold, baseCaps, targetPositiveCounts = null) {
  return selectSpeciesCapsFromIndex({
    capScoreIndex: capPlans.capScoreIndex,
    trainingFoldIds,
    targetTaxa: targetTaxaForFold(targetFold, targetPositiveCounts),
    baseCaps
  });
}

function calibrationEntriesForFold({
  trainingRows,
  targetFold,
  targetCapPlan,
  targetPositiveCounts = null,
  baseCaps,
  family
}) {
  const calibrators = fitCalibratorMap({
    trainingRows,
    targetRows: targetFold.scoreRows,
    targetPositiveCounts,
    speciesCaps: targetCapPlan.selected,
    baseCaps,
    family
  });
  return targetFold.scoreRows.map((row) => {
    const rawProbability = probabilityFromAdminEvidence(
      row,
      candidateCapsForRow(row, targetCapPlan.selected, baseCaps)
    );
    const scope = calibrationScope(
      row,
      targetPositiveCounts instanceof Map
        ? targetPositiveCounts.get(String(row.taxonId))
        : row.positiveCount
    );
    const fit = scope ? calibrators.get(scope) || null : null;
    return {
      foldId: String(targetFold.foldId),
      row,
      scope,
      fit,
      rawProbability,
      candidateProbability: fit?.fitted ? calibrateProbability(rawProbability, fit) : rawProbability
    };
  });
}

function crossFittedFamilyEntries({
  cache,
  selectionFoldIds,
  capPlans,
  baseCaps,
  family,
  targetPositiveCounts = null
}) {
  const entries = [];
  for (const heldoutFoldId of [...selectionFoldIds].map(String).sort()) {
    const trainingFoldIds = selectionFoldIds
      .map(String)
      .filter((foldId) => foldId !== heldoutFoldId)
      .sort();
    const targetFold = capPlans.capScoreIndex.foldsById.get(heldoutFoldId);
    const targetCapPlan = capPlanForTargetFold(
      capPlans,
      trainingFoldIds,
      targetFold,
      baseCaps,
      targetPositiveCounts
    );
    entries.push(...calibrationEntriesForFold({
      trainingRows: foldRows(capPlans, trainingFoldIds),
      targetFold,
      targetCapPlan,
      targetPositiveCounts,
      baseCaps,
      family
    }));
  }
  return entries;
}

function identityFamily(families) {
  return families.find((family) => family.type === "identity");
}

function validateFixedCalibratorFamilies(families) {
  if (!Array.isArray(families) || canonicalJson(families) !== canonicalJson(DEFAULT_CALIBRATOR_FAMILIES)) {
    throw new SpatialCandidateScorerError(
      "SPATIAL_CALIBRATOR_BATCH_NOT_FIXED",
      "development 离线评分只允许预登记的固定校准器候选批次。",
      {
        expectedFamilies: DEFAULT_CALIBRATOR_FAMILIES,
        actualFamilies: families
      }
    );
  }
  return DEFAULT_CALIBRATOR_FAMILIES;
}

function innerFoldProvenance(selectionFoldIds, allFoldIds) {
  return [...selectionFoldIds].map(String).sort().map((heldoutFoldId) => ({
    heldoutFoldId,
    trainingFoldIds: selectionFoldIds
      .map(String)
      .filter((foldId) => foldId !== heldoutFoldId)
      .sort(),
    cachedEvidenceTrainingFoldIds: allFoldIds
      .map(String)
      .filter((foldId) => foldId !== heldoutFoldId)
      .sort()
  }));
}

function selectScopeFamilies({ rawEntries, entriesByFamily, families }) {
  const identity = identityFamily(families);
  const rawGuard = guardFamilyEntries(
    rawEntries.map((entry) => ({ ...entry, fit: null, candidateProbability: entry.rawProbability })),
    identity
  );
  const rawScopes = new Map(rawGuard.scopes.map((scope) => [scope.scope, scope]));
  const guardedFamilies = families
    .filter((family) => family.type !== "identity")
    .map((family) => ({
      family,
      guard: guardFamilyEntries(entriesByFamily.get(family.id) || [], family)
    }));
  const scopeNames = [...new Set([
    ...rawScopes.keys(),
    ...guardedFamilies.flatMap(({ guard }) => guard.scopes.map((scope) => scope.scope))
  ])].sort();
  let scopeSelections = scopeNames.map((scope) => {
    const raw = rawScopes.get(scope) || null;
    const candidates = guardedFamilies
      .map(({ family, guard }) => ({ family, stats: guard.scopes.find((entry) => entry.scope === scope) }))
      .filter(({ stats }) => stats?.accepted)
      .sort((left, right) =>
        left.stats.candidateEce - right.stats.candidateEce ||
        left.stats.candidateBrier - right.stats.candidateBrier ||
        (left.family.shrinkage ?? 1) - (right.family.shrinkage ?? 1) ||
        left.family.id.localeCompare(right.family.id)
      );
    const winner = candidates[0] || null;
    return {
      scope,
      familyId: winner?.family.id || identity.id,
      family: winner?.family || identity,
      accepted: Boolean(winner),
      innerGuard: winner?.stats || {
        rawBrier: raw?.rawBrier ?? null,
        candidateBrier: raw?.rawBrier ?? null,
        relativeBrierDegradation: 0,
        rawEce: raw?.rawEce ?? null,
        candidateEce: raw?.rawEce ?? null,
        eceDegradation: 0,
        fittedApplications: 0
      }
    };
  });
  const selectionsByScope = new Map(scopeSelections.map((selection) => [selection.scope, selection]));
  const selectedEntries = rawEntries.map((entry, index) => {
    const selection = entry.scope ? selectionsByScope.get(entry.scope) : null;
    const selected = selection?.accepted
      ? entriesByFamily.get(selection.familyId)?.[index] || entry
      : entry;
    return { foldId: entry.foldId, row: entry.row, probability: selected.candidateProbability ?? entry.rawProbability };
  });
  const rawMetrics = evaluateCandidateRows(rawEntries.map((entry) => ({
    foldId: entry.foldId,
    row: entry.row,
    probability: entry.rawProbability
  })));
  const candidateMetrics = evaluateCandidateRows(selectedEntries);
  const relativeBrier = relativeBrierDegradation(rawMetrics.brier, candidateMetrics.brier);
  const eceDegradation = candidateMetrics.ece - rawMetrics.ece;
  const overallAccepted =
    relativeBrier <= SPATIAL_CALIBRATION_GUARD.maximumRelativeBrierDegradation &&
    eceDegradation <= SPATIAL_CALIBRATION_GUARD.maximumEceDegradation;
  if (!overallAccepted) {
    scopeSelections = scopeSelections.map((selection) => ({
      ...selection,
      familyId: identity.id,
      family: identity,
      accepted: false,
      rejectedByOverallGuard: selection.accepted
    }));
  }
  return {
    scopeSelections,
    overallGuard: {
      accepted: overallAccepted,
      ...SPATIAL_CALIBRATION_GUARD,
      rawBrier: rawMetrics.brier,
      candidateBrier: candidateMetrics.brier,
      relativeBrierDegradation: relativeBrier,
      rawEce: rawMetrics.ece,
      candidateEce: candidateMetrics.ece,
      eceDegradation
    },
    rawMetrics,
    metrics: overallAccepted ? candidateMetrics : rawMetrics
  };
}

function buildSelectionForFoldSet({
  cache,
  selectionFoldIds,
  capPlans,
  baseCaps,
  families,
  targetPositiveCounts = null
}) {
  const entriesByFamily = new Map();
  for (const family of families.filter((entry) => entry.type !== "identity")) {
    entriesByFamily.set(family.id, crossFittedFamilyEntries({
      cache,
      selectionFoldIds,
      capPlans,
      baseCaps,
      family,
      targetPositiveCounts
    }));
  }
  const firstEntries = entriesByFamily.values().next().value || [];
  const rawEntries = firstEntries.map((entry) => ({ ...entry, candidateProbability: entry.rawProbability }));
  return {
    ...selectScopeFamilies({ rawEntries, entriesByFamily, families }),
    innerFolds: innerFoldProvenance(selectionFoldIds, capPlans.capScoreIndex.foldIds),
    entriesByFamily,
    rawEntries
  };
}

function fitSelectedFamilies({
  trainingRows,
  targetRows,
  targetPositiveCounts = null,
  speciesCaps,
  baseCaps,
  scopeSelections,
  families
}) {
  const familyById = new Map(families.map((family) => [family.id, family]));
  const selectedFamilyIds = [...new Set(
    scopeSelections.filter((selection) => selection.accepted).map((selection) => selection.familyId)
  )].sort();
  return new Map(selectedFamilyIds.map((familyId) => [
    familyId,
    fitCalibratorMap({
      trainingRows,
      targetRows,
      targetPositiveCounts,
      speciesCaps,
      baseCaps,
      family: familyById.get(familyId)
    })
  ]));
}

function applySelectedFamilies({
  targetFold,
  capPlan,
  baseCaps,
  selection,
  fittedByFamily,
  targetPositiveCounts = null
}) {
  const selectionsByScope = new Map(selection.scopeSelections.map((scope) => [scope.scope, scope]));
  const entries = targetFold.scoreRows.map((row) => {
    const rawProbability = probabilityFromAdminEvidence(
      row,
      candidateCapsForRow(row, capPlan.selected, baseCaps)
    );
    const scope = calibrationScope(
      row,
      targetPositiveCounts instanceof Map
        ? targetPositiveCounts.get(String(row.taxonId))
        : row.positiveCount
    );
    const selected = scope ? selectionsByScope.get(scope) || null : null;
    const fit = selected?.accepted
      ? fittedByFamily.get(selected.familyId)?.get(scope) || null
      : null;
    return {
      foldId: String(targetFold.foldId),
      row,
      probability: fit?.fitted ? calibrateProbability(rawProbability, fit) : rawProbability
    };
  });
  const reportedSelections = selection.scopeSelections.map((scope) => ({
    ...scope,
    fit: scope.accepted ? fittedByFamily.get(scope.familyId)?.get(scope.scope) || null : null
  }));
  return { entries, scopeSelections: reportedSelections };
}

function canonicalSha256(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function fixedCandidateManifest(families, candidates) {
  const manifest = {
    selectionStrategy: NESTED_SCOPE_ADAPTIVE_STRATEGY_ID,
    capCandidateSetSha256: candidateSetSha256(),
    capCandidateCount: candidates.length,
    capPolicy: STABLE_CAP_SELECTION_POLICY,
    calibratorFamilies: families,
    calibrationGuard: SPATIAL_CALIBRATION_GUARD,
    robustScopeSelectionPolicy: ROBUST_SCOPE_SELECTION_POLICY,
    rankingReferenceContract: RANKING_REFERENCE_CONTRACT
  };
  return { ...manifest, sha256: canonicalSha256(manifest) };
}

function countMapFromRows(rows, field) {
  const counts = new Map();
  for (const row of rows) {
    const taxonId = String(row.taxonId);
    const value = Number(row[field]);
    if (!Number.isFinite(value)) continue;
    counts.set(taxonId, Math.max(counts.get(taxonId) ?? 0, value));
  }
  return counts;
}

function evidenceId(evidence) {
  return String(evidence.innerFoldId ?? evidence.foldId);
}

function strictEvidenceProvenance(evidenceSets) {
  const ids = evidenceSets.map(evidenceId).sort();
  return [...evidenceSets]
    .sort((left, right) => evidenceId(left).localeCompare(evidenceId(right)))
    .map((evidence) => ({
      heldoutFoldId: evidenceId(evidence),
      trainingFoldIds: Array.isArray(evidence.trainingFoldIds)
        ? [...evidence.trainingFoldIds].map(String).sort()
        : ids.filter((foldId) => foldId !== evidenceId(evidence))
    }));
}

function rawCalibrationEntries({ evidenceSets, capPlan, targetPositiveCounts, baseCaps }) {
  return evidenceSets.flatMap((evidence) => evidence.scoreRows.map((row) => {
    const rawProbability = probabilityFromAdminEvidence(
      row,
      candidateCapsForRow(row, capPlan.selected, baseCaps)
    );
    return {
      foldId: evidenceId(evidence),
      row,
      scope: calibrationScope(row, targetPositiveCounts.get(String(row.taxonId))),
      fit: null,
      rawProbability,
      candidateProbability: rawProbability
    };
  }));
}

function strictCrossFittedFamilyEntries({
  evidenceSets,
  capPlan,
  targetPositiveCounts,
  baseCaps,
  family
}) {
  const entries = [];
  for (const heldoutEvidence of evidenceSets) {
    const trainingRows = evidenceSets
      .filter((evidence) => evidence !== heldoutEvidence)
      .flatMap((evidence) => evidence.scoreRows);
    const calibrators = fitCalibratorMap({
      trainingRows,
      targetRows: heldoutEvidence.scoreRows,
      targetPositiveCounts,
      speciesCaps: capPlan.selected,
      baseCaps,
      family
    });
    for (const row of heldoutEvidence.scoreRows) {
      const rawProbability = probabilityFromAdminEvidence(
        row,
        candidateCapsForRow(row, capPlan.selected, baseCaps)
      );
      const scope = calibrationScope(row, targetPositiveCounts.get(String(row.taxonId)));
      const fit = scope ? calibrators.get(scope) || null : null;
      entries.push({
        foldId: evidenceId(heldoutEvidence),
        row,
        scope,
        fit,
        rawProbability,
        candidateProbability: fit?.fitted ? calibrateProbability(rawProbability, fit) : rawProbability
      });
    }
  }
  return entries;
}

function guardScopesByName(entries, family) {
  return new Map(guardFamilyEntries(entries, family).scopes.map((scope) => [scope.scope, scope]));
}

function overallGuardForSelectedEntries(rawEntries, selectedEntries, foldIds) {
  const rawMetrics = evaluateCandidateRows(rawEntries.map((entry) => ({
    foldId: entry.foldId,
    row: entry.row,
    probability: entry.rawProbability
  })));
  const candidateMetrics = evaluateCandidateRows(selectedEntries.map((entry) => ({
    foldId: entry.foldId,
    row: entry.row,
    probability: entry.candidateProbability
  })));
  const pooled = {
    rawBrier: rawMetrics.brier,
    candidateBrier: candidateMetrics.brier,
    relativeBrierDegradation: relativeBrierDegradation(rawMetrics.brier, candidateMetrics.brier),
    rawEce: rawMetrics.ece,
    candidateEce: candidateMetrics.ece,
    eceDegradation: candidateMetrics.ece - rawMetrics.ece
  };
  pooled.accepted =
    pooled.relativeBrierDegradation <= SPATIAL_CALIBRATION_GUARD.maximumRelativeBrierDegradation &&
    pooled.eceDegradation <= SPATIAL_CALIBRATION_GUARD.maximumEceDegradation;
  const folds = foldIds.map((foldId) => {
    const rawFoldMetrics = evaluateCandidateRows(rawEntries
      .filter((entry) => entry.foldId === foldId)
      .map((entry) => ({ foldId, row: entry.row, probability: entry.rawProbability })));
    const candidateFoldMetrics = evaluateCandidateRows(selectedEntries
      .filter((entry) => entry.foldId === foldId)
      .map((entry) => ({ foldId, row: entry.row, probability: entry.candidateProbability })));
    const result = {
      heldoutFoldId: foldId,
      rawBrier: rawFoldMetrics.brier,
      candidateBrier: candidateFoldMetrics.brier,
      relativeBrierDegradation: relativeBrierDegradation(rawFoldMetrics.brier, candidateFoldMetrics.brier),
      rawEce: rawFoldMetrics.ece,
      candidateEce: candidateFoldMetrics.ece,
      eceDegradation: candidateFoldMetrics.ece - rawFoldMetrics.ece
    };
    result.accepted =
      result.relativeBrierDegradation <= SPATIAL_CALIBRATION_GUARD.maximumRelativeBrierDegradation &&
      result.eceDegradation <= SPATIAL_CALIBRATION_GUARD.maximumEceDegradation;
    return result;
  });
  return {
    accepted: pooled.accepted && folds.every((fold) => fold.accepted),
    ...SPATIAL_CALIBRATION_GUARD,
    robustScopeSelectionPolicy: ROBUST_SCOPE_SELECTION_POLICY,
    pooled,
    folds
  };
}

function selectStrictScopeFamilies({ rawEntries, entriesByFamily, families, foldIds }) {
  const identity = identityFamily(families);
  const rawPooledByScope = guardScopesByName(rawEntries, identity);
  const rawFoldByScope = new Map(foldIds.map((foldId) => [
    foldId,
    guardScopesByName(rawEntries.filter((entry) => entry.foldId === foldId), identity)
  ]));
  const candidatePooledByFamily = new Map();
  const candidateFoldByFamily = new Map();
  for (const family of families.filter((entry) => entry.type !== "identity")) {
    const familyEntries = entriesByFamily.get(family.id) || [];
    candidatePooledByFamily.set(family.id, guardScopesByName(familyEntries, family));
    candidateFoldByFamily.set(family.id, new Map(foldIds.map((foldId) => [
      foldId,
      guardScopesByName(familyEntries.filter((entry) => entry.foldId === foldId), family)
    ])));
  }
  let scopeSelections = [...rawPooledByScope.keys()].sort().map((scope) => {
    const rawPooled = rawPooledByScope.get(scope);
    const rawFoldStats = foldIds
      .map((foldId) => ({ heldoutFoldId: foldId, stats: rawFoldByScope.get(foldId).get(scope) || null }))
      .filter(({ stats }) => stats);
    const rawWorstFoldEce = Math.max(...rawFoldStats.map(({ stats }) => stats.rawEce));
    const candidates = families
      .filter((family) => family.type !== "identity")
      .map((family) => {
        const pooled = candidatePooledByFamily.get(family.id).get(scope) || null;
        const foldGuards = rawFoldStats.map(({ heldoutFoldId }) => ({
          heldoutFoldId,
          ...(candidateFoldByFamily.get(family.id).get(heldoutFoldId).get(scope) || {})
        }));
        const worstFoldEce = foldGuards.length
          ? Math.max(...foldGuards.map((guard) => Number(guard.candidateEce)))
          : Number.POSITIVE_INFINITY;
        const maximumFoldRelativeBrierDegradation = foldGuards.length
          ? Math.max(...foldGuards.map((guard) => Number(guard.relativeBrierDegradation)))
          : Number.POSITIVE_INFINITY;
        const eligible = Boolean(
          pooled?.accepted &&
          foldGuards.length === rawFoldStats.length &&
          foldGuards.every((guard) => guard.accepted) &&
          Number.isFinite(worstFoldEce) &&
          worstFoldEce <= rawWorstFoldEce + 1e-12
        );
        return {
          family,
          pooled,
          foldGuards,
          rawWorstFoldEce,
          worstFoldEce,
          maximumFoldRelativeBrierDegradation,
          eligible
        };
      })
      .filter((candidate) => candidate.eligible)
      .sort((left, right) =>
        left.worstFoldEce - right.worstFoldEce ||
        left.pooled.candidateEce - right.pooled.candidateEce ||
        left.maximumFoldRelativeBrierDegradation - right.maximumFoldRelativeBrierDegradation ||
        (left.family.shrinkage ?? 1) - (right.family.shrinkage ?? 1) ||
        left.family.id.localeCompare(right.family.id)
      );
    const winner = candidates[0] || null;
    return {
      scope,
      familyId: winner?.family.id || identity.id,
      family: winner?.family || identity,
      accepted: Boolean(winner),
      innerGuard: winner?.pooled || {
        rawBrier: rawPooled.rawBrier,
        candidateBrier: rawPooled.rawBrier,
        relativeBrierDegradation: 0,
        rawEce: rawPooled.rawEce,
        candidateEce: rawPooled.rawEce,
        eceDegradation: 0,
        fittedApplications: 0
      },
      foldGuards: winner?.foldGuards || [],
      rawWorstFoldEce,
      worstFoldEce: winner?.worstFoldEce ?? rawWorstFoldEce,
      maximumFoldRelativeBrierDegradation: winner?.maximumFoldRelativeBrierDegradation ?? 0
    };
  });
  const entriesByScope = new Map(scopeSelections.map((selection) => [selection.scope, selection]));
  let selectedEntries = rawEntries.map((entry, index) => {
    const selection = entry.scope ? entriesByScope.get(entry.scope) : null;
    const selected = selection?.accepted
      ? entriesByFamily.get(selection.familyId)?.[index] || entry
      : entry;
    return { ...entry, candidateProbability: selected.candidateProbability ?? entry.rawProbability };
  });
  let overallGuard = overallGuardForSelectedEntries(rawEntries, selectedEntries, foldIds);
  if (!overallGuard.accepted) {
    scopeSelections = scopeSelections.map((selection) => ({
      ...selection,
      familyId: identity.id,
      family: identity,
      accepted: false,
      rejectedByOverallGuard: selection.accepted
    }));
    selectedEntries = rawEntries;
    overallGuard = { ...overallGuard, appliedIdentityFallback: true };
  } else {
    overallGuard = { ...overallGuard, appliedIdentityFallback: false };
  }
  return { scopeSelections, overallGuard, rawEntries, selectedEntries };
}

function buildStrictSelection({ evidenceSets, capPlan, targetPositiveCounts, baseCaps, families }) {
  const foldIds = evidenceSets.map(evidenceId).sort();
  const rawEntries = rawCalibrationEntries({ evidenceSets, capPlan, targetPositiveCounts, baseCaps });
  const entriesByFamily = new Map();
  for (const family of families.filter((entry) => entry.type !== "identity")) {
    entriesByFamily.set(family.id, strictCrossFittedFamilyEntries({
      evidenceSets,
      capPlan,
      targetPositiveCounts,
      baseCaps,
      family
    }));
  }
  return {
    ...selectStrictScopeFamilies({ rawEntries, entriesByFamily, families, foldIds }),
    innerFolds: strictEvidenceProvenance(evidenceSets)
  };
}

function buildNestedScopeAdaptiveSelection({ cache, capPlans, baseCaps, families, candidateManifest }) {
  const foldIds = [...capPlans.foldIds];
  const foldsById = new Map(cache.folds.map((fold) => [String(fold.foldId), fold]));
  const foldReports = [];
  const heldoutEntries = [];
  for (const heldoutFoldId of foldIds) {
    const trainingFoldIds = foldIds.filter((foldId) => foldId !== heldoutFoldId);
    const targetFold = foldsById.get(heldoutFoldId);
    const capPlan = capPlans.heldout.find((plan) => plan.foldId === heldoutFoldId);
    const targetPositiveCounts = countMapFromRows(targetFold.scoreRows, "positiveCount");
    const selection = buildStrictSelection({
      evidenceSets: targetFold.innerFolds,
      capPlan,
      targetPositiveCounts,
      baseCaps,
      families
    });
    const fittedByFamily = fitSelectedFamilies({
      trainingRows: targetFold.innerFolds.flatMap((fold) => fold.scoreRows),
      targetRows: targetFold.scoreRows,
      targetPositiveCounts,
      speciesCaps: capPlan.selected,
      baseCaps,
      scopeSelections: selection.scopeSelections,
      families
    });
    const applied = applySelectedFamilies({
      targetFold,
      capPlan,
      baseCaps,
      selection,
      fittedByFamily,
      targetPositiveCounts
    });
    const metrics = evaluateCandidateRows(applied.entries);
    heldoutEntries.push(...applied.entries);
    const selectionRecord = {
      heldoutFoldId,
      trainingFoldIds,
      innerFolds: selection.innerFolds,
      cachedEvidenceRebuiltForInnerFolds: true,
      capPolicy: capPolicyReport(capPlan),
      scopeSelections: applied.scopeSelections,
      overallGuard: selection.overallGuard
    };
    foldReports.push({
      ...selectionRecord,
      selectionSha256: canonicalSha256(selectionRecord),
      metrics: compactMetrics(metrics),
      validationSha256: canonicalSha256(compactMetrics(metrics))
    });
  }

  const productionSelection = buildStrictSelection({
    evidenceSets: cache.folds,
    capPlan: capPlans.production,
    targetPositiveCounts: capPlans.productionPositiveCounts,
    baseCaps,
    families
  });
  const allRows = cache.folds.flatMap((fold) => fold.scoreRows);
  const productionFitted = fitSelectedFamilies({
    trainingRows: allRows,
    targetRows: allRows,
    targetPositiveCounts: capPlans.productionPositiveCounts,
    speciesCaps: capPlans.production.selected,
    baseCaps,
    scopeSelections: productionSelection.scopeSelections,
    families
  });
  const productionScopeSelections = productionSelection.scopeSelections.map((scope) => ({
    ...scope,
    fit: scope.accepted ? productionFitted.get(scope.familyId)?.get(scope.scope) || null : null
  }));
  const productionCalibrators = productionScopeSelections
    .filter((scope) => scope.accepted && scope.fit?.fitted)
    .map((scope) => ({ scope: scope.scope, family: scope.familyId, fit: scope.fit }));
  const metrics = evaluateCandidateRows(heldoutEntries);
  const spatialErrorAudit = buildSpatialErrorAudit(heldoutEntries);
  const rankingReference = evaluateRankingReference(heldoutEntries);
  const productionRecord = {
    trainingFoldIds: foldIds,
    innerFolds: productionSelection.innerFolds,
    cachedEvidenceRebuiltForInnerFolds: true,
    capPolicy: capPolicyReport(capPlans.production),
    scopeSelections: productionScopeSelections,
    overallGuard: productionSelection.overallGuard,
    productionCalibrators
  };
  return {
    strategy: NESTED_SCOPE_ADAPTIVE_STRATEGY_ID,
    fitFoldCount: 4,
    heldoutFoldCount: 5,
    fixedCandidateSetSha256: candidateManifest.sha256,
    folds: foldReports,
    production: {
      ...productionRecord,
      selectionSha256: canonicalSha256(productionRecord)
    },
    metrics,
    compactMetrics: compactMetrics(metrics),
    failures: spatialQualityFailures(metrics),
    spatialErrorAudit,
    rankingReference,
    productionCalibrators
  };
}

function recommendedFamily(families) {
  return [...families].sort((left, right) =>
    left.failures.length - right.failures.length ||
    (left.metrics.calibrationEce.species.maximumEce ?? Infinity) -
      (right.metrics.calibrationEce.species.maximumEce ?? Infinity) ||
    left.metrics.brier - right.metrics.brier ||
    left.metrics.ece - right.metrics.ece ||
    right.metrics.recallAt20Delta - left.metrics.recallAt20Delta ||
    Number(left.family.type !== "identity") - Number(right.family.type !== "identity") ||
    left.family.id.localeCompare(right.family.id)
  )[0] || null;
}

async function scoreSpatialOofCandidates(cache, {
  workers = 1,
  calibratorFamilies = DEFAULT_CALIBRATOR_FAMILIES,
  generatedAt = new Date().toISOString()
} = {}) {
  if (!Number.isInteger(Number(workers)) || Number(workers) < 1 || Number(workers) > 32) {
    throw new SpatialCandidateScorerError("SPATIAL_SCORER_WORKERS_INVALID", "workers 必须是 1..32 的整数。" );
  }
  calibratorFamilies = validateFixedCalibratorFamilies(calibratorFamilies);
  const candidates = buildAdminExposureCapCandidates();
  validateScoringCache(cache, candidates);
  const baseCaps = cache.metadata.baseAdminExposureCapsByPrevalence;
  validateBaseCaps(baseCaps, candidates);
  const checkedReference = assertReferenceEvidence(cache, baseCaps);
  const candidateManifest = fixedCandidateManifest(calibratorFamilies, candidates);
  const capPlans = await buildCapSelectionPlans(cache, candidates, Number(workers), baseCaps);
  const familyResults = calibratorFamilies.map((family) =>
    scoreCalibrationFamily({ cache, capPlans, baseCaps, family })
  );
  const exploratoryRecommended = recommendedFamily(familyResults);
  const crossFittedSelection = buildNestedScopeAdaptiveSelection({
    cache,
    capPlans,
    baseCaps,
    families: calibratorFamilies,
    candidateManifest
  });
  return {
    schemaVersion: SPATIAL_CANDIDATE_SCORER_SCHEMA_VERSION,
    reportType: "zhejiang_development_spatial_oof_candidate_diagnostic",
    generatedAt,
    diagnosticOnly: true,
    freezeEligible: false,
    sealedPanelViewed: false,
    cache: {
      fileSha256: cache.fileSha256 || null,
      sourceSnapshotSha256: cache.metadata.sourceSnapshotSha256,
      spatialSplitFileSha256: cache.metadata.spatialSplitFileSha256,
      spatialSplitManifestHash: cache.metadata.spatialSplitManifestHash,
      evidenceContractSha256: cache.metadata.evidenceContractSha256,
      generationImplementationSha256: cache.metadata.generationImplementationSha256,
      predictionImplementationSha256AtGeneration: cache.metadata.predictionImplementationSha256,
      developmentPoolPositiveCountPolicy: cache.metadata.developmentPoolPositiveCountPolicy,
      outerTrainingPositiveCountPolicy: cache.metadata.outerTrainingPositiveCountPolicy,
      innerTrainingPositiveCountPolicy: cache.metadata.innerTrainingPositiveCountPolicy,
      foldCount: cache.folds.length,
      rowCount: checkedReference.checkedRows,
      innerFoldCount: cache.folds.reduce((sum, fold) => sum + fold.innerFolds.length, 0),
      innerRowCount: checkedReference.checkedInnerRows,
      referenceMetricFoldCount: checkedReference.checkedFolds
    },
    scoring: {
      scorerImplementationSha256: spatialCandidateScorerImplementationSha256(),
      candidateSetSha256: candidateSetSha256(),
      candidateCount: candidates.length,
      candidateSource: "buildAdminExposureCapCandidates",
      calibratorCandidateCount: calibratorFamilies.length,
      fixedCandidateSetSha256: crossFittedSelection.fixedCandidateSetSha256,
      fixedCandidateManifest: candidateManifest,
      capSelection: STABLE_CAP_SELECTION_POLICY,
      robustScopeSelection: ROBUST_SCOPE_SELECTION_POLICY,
      calibrationSelection: "strict_three_inner_folds_fit_one_inner_fold_select_then_all_four_inner_folds_fit_one_outer_fold_validate",
      scopeEligibilitySource: "outer_training_positive_count_for_outer_validation_and_development_pool_positive_count_for_production",
      nestedFitFoldCount: 3,
      nestedHeldoutFoldCount: 4,
      fitFoldCount: 4,
      heldoutFoldCount: 5,
      workers: Number(workers),
      chunkRecords: DEFAULT_ADMIN_CAP_CHUNK_RECORDS,
      deterministicReductionPolicy: "fixed_record_chunks_merged_by_job_id",
      qualityThresholds: PRODUCTION_SPATIAL_QUALITY_THRESHOLDS,
      calibrationGuard: SPATIAL_CALIBRATION_GUARD
    },
    speciesCapTuning: {
      strategy: STABLE_CAP_SELECTION_POLICY.strategy,
      appliesTo: "development_pool_positive_count_200_plus",
      runtimeCompatible: false,
      freezeEligible: false,
      productionCandidateCount: capPlans.production.details.length,
      workerTaskCount: {
        production: capPlans.production.taskCount,
        heldout: Object.fromEntries(capPlans.heldout.map((plan) => [plan.foldId, plan.taskCount]))
      },
      species: speciesCapReport(capPlans)
    },
    crossFittedSelection: {
      strategy: crossFittedSelection.strategy,
      fitFoldCount: crossFittedSelection.fitFoldCount,
      heldoutFoldCount: crossFittedSelection.heldoutFoldCount,
      fixedCandidateSetSha256: crossFittedSelection.fixedCandidateSetSha256,
      folds: crossFittedSelection.folds,
      production: crossFittedSelection.production
    },
    spatialErrorAudit: crossFittedSelection.spatialErrorAudit,
    rankingReference: crossFittedSelection.rankingReference,
    calibratorFamilies: familyResults.map((result) => ({
      family: result.family,
      guard: result.guard,
      rawMetrics: result.rawMetrics,
      metrics: result.compactMetrics,
      foldMetrics: result.foldMetrics,
      failures: result.failures,
      productionCalibrators: result.productionCalibrators
    })),
    exploratoryFamilyRecommendation: exploratoryRecommended
      ? { familyId: exploratoryRecommended.family.id, failures: exploratoryRecommended.failures }
      : null,
    recommendation: {
      familyId: NESTED_SCOPE_ADAPTIVE_STRATEGY_ID,
      failures: crossFittedSelection.failures,
      metrics: crossFittedSelection.compactMetrics,
      developmentDiagnosticOnly: true,
      productionCalibrators: crossFittedSelection.productionCalibrators
    },
    limitations: [
      "cache_does_not_evaluate_reverse_ndcg",
      "species_specific_caps_are_not_supported_by_current_runtime_or_frozen_parameter_schema",
      "standalone_family_tables_are_exploratory_same_oof_and_not_used_for_the_cross_fitted_recommendation",
      "cross_fitted_selection_is_still_repeated_development_research_and_not_a_release_metric",
      "strict_inner_evidence_excludes_outer_inner_and_all_sealed_r6_buffers",
      "strict_inner_scope_eligibility_uses_outer_training_positive_count_not_inner_training_positive_count",
      "sealed_excluded_development_pool_positive_count_defines_the_complete_production_cap_roster",
      "development_pool_species_that_never_reach_200_in_an_outer_fold_have_no_species_scope_calibration_guard",
      "result_must_not_freeze_parameters_or_open_sealed",
      "full_development_build_must_recompute_all_release_quality_gates_after_runtime_integration"
    ]
  };
}

module.exports = {
  DEFAULT_CALIBRATOR_FAMILIES,
  PRODUCTION_SPATIAL_QUALITY_THRESHOLDS,
  SPATIAL_CALIBRATION_GUARD,
  SPATIAL_CANDIDATE_SCORER_FILES,
  SPATIAL_CANDIDATE_SCORER_SCHEMA_VERSION,
  SPATIAL_ERROR_AUDIT_CONTRACT,
  SpatialCandidateScorerError,
  baselineProbabilityFromAdminEvidence,
  buildSpatialErrorAudit,
  candidateCapsForRow,
  compactMetrics,
  evaluateCandidateRows,
  fitCalibrationFamily,
  probabilityFromAdminEvidence,
  scoreSpatialOofCandidates,
  spatialCandidateScorerImplementationSha256,
  spatialQualityFailures
};
