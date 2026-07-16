"use strict";

const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const { calibrateProbability, fitBetaCalibration } = require("./math");
const { PREVALENCE_GROUPS, prevalenceGroup } = require("./model");
const { canonicalJson } = require("./spatial-splits");
const { buildAdminExposureCapCandidates } = require("./spatial-transfer");
const {
  DEFAULT_ADMIN_CAP_CHUNK_RECORDS,
  scoreAdminCapTasks
} = require("./spatial-transfer-worker");
const {
  DEVELOPMENT_POOL_POSITIVE_COUNT_POLICY,
  candidateSetSha256
} = require("./spatial-oof-cache");

const SPATIAL_CANDIDATE_SCORER_SCHEMA_VERSION = 1;
const SPATIAL_CANDIDATE_SCORER_FILES = Object.freeze([
  "server/prediction/math.js",
  "server/prediction/model.js",
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
const DEFAULT_CALIBRATOR_FAMILIES = Object.freeze([
  Object.freeze({ id: "identity", type: "identity", ridge: 0 }),
  Object.freeze({ id: "intercept_ridge_0.1", type: "intercept", ridge: 0.1 }),
  Object.freeze({ id: "temperature_ridge_0.1", type: "temperature", ridge: 0.1 }),
  Object.freeze({ id: "beta_ridge_0.001_current", type: "beta", ridge: 1e-3 }),
  Object.freeze({ id: "beta_ridge_0.1", type: "beta", ridge: 0.1 }),
  Object.freeze({ id: "beta_ridge_1", type: "beta", ridge: 1 })
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

function fitCalibrationFamily(points, family) {
  if (family.type === "identity") return { a: 1, b: 1, c: 0, fitted: false, iterations: 0 };
  if (family.type === "intercept") return fitInterceptCalibration(points, family.ridge);
  if (family.type === "temperature") return fitTemperatureCalibration(points, family.ridge);
  if (family.type === "beta") return fitBetaCalibration(points, { ridge: family.ridge });
  throw new SpatialCandidateScorerError("SPATIAL_CALIBRATOR_FAMILY_INVALID", "未知空间校准器族。", {
    family
  });
}

function calibrationGroup(positiveCount) {
  const count = Number(positiveCount) || 0;
  if (count < 30) return null;
  if (count < 60) return "positive_30_59";
  if (count < 120) return "positive_60_119";
  if (count < 200) return "positive_120_199";
  return null;
}

function calibrationScope(row) {
  if (Number(row.positiveCount) >= 200) return `species:${row.taxonId}`;
  const group = calibrationGroup(row.positiveCount);
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

async function selectSpeciesCaps({ trainingRows, targetTaxa, candidates, workers, baseCaps }) {
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
  const result = tasks.size
    ? await scoreAdminCapTasks({
        tasksByPrevalence: tasks,
        candidates,
        workers,
        chunkRecords: DEFAULT_ADMIN_CAP_CHUNK_RECORDS
      })
    : null;
  const selected = new Map();
  const details = [];
  const fallbackCaps = baseCaps.species_200_plus;
  for (const taxonId of [...targetTaxonSet].sort()) {
    const ranking = result?.byPrevalence?.[taxonId] || [];
    const winner = ranking[0] || {
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
      topCandidates: ranking.slice(0, 3).map((candidate) => ({
        id: candidate.id,
        caps: candidate.caps,
        brier: candidate.brier
      })),
      usedBaseFallback: !ranking.length
    });
  }
  return {
    selected,
    details,
    workerCount: result?.workerCount || 0,
    taskCount: result?.taskCount || 0
  };
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
  }
  return { checkedRows, checkedFolds };
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
  const production = await selectSpeciesCaps({
    trainingRows: allRows,
    targetTaxa: productionTaxa,
    candidates,
    workers,
    baseCaps
  });
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
    const trainingFolds = cache.folds.filter((fold) => fold !== targetFold);
    const selection = await selectSpeciesCaps({
      trainingRows: trainingFolds.flatMap((fold) => fold.scoreRows),
      targetTaxa,
      candidates,
      workers,
      baseCaps
    });
    heldout.push({
      foldId: String(targetFold.foldId),
      trainingFoldIds: trainingFolds.map((fold) => String(fold.foldId)).sort(),
      ...selection
    });
  }
  return { production, heldout, productionPositiveCounts };
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
  const candidates = buildAdminExposureCapCandidates();
  validateScoringCache(cache, candidates);
  const baseCaps = cache.metadata.baseAdminExposureCapsByPrevalence;
  validateBaseCaps(baseCaps, candidates);
  const checkedReference = assertReferenceEvidence(cache, baseCaps);
  const capPlans = await buildCapSelectionPlans(cache, candidates, Number(workers), baseCaps);
  const familyResults = calibratorFamilies.map((family) =>
    scoreCalibrationFamily({ cache, capPlans, baseCaps, family })
  );
  const recommended = recommendedFamily(familyResults);
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
      foldCount: cache.folds.length,
      rowCount: checkedReference.checkedRows,
      referenceMetricFoldCount: checkedReference.checkedFolds
    },
    scoring: {
      scorerImplementationSha256: spatialCandidateScorerImplementationSha256(),
      candidateSetSha256: candidateSetSha256(),
      candidateCount: candidates.length,
      candidateSource: "buildAdminExposureCapCandidates",
      capSelection: "four_development_folds_fit_one_fold_validate_then_all_five_fit_production_candidate",
      fitFoldCount: 4,
      heldoutFoldCount: 5,
      workers: Number(workers),
      chunkRecords: DEFAULT_ADMIN_CAP_CHUNK_RECORDS,
      deterministicReductionPolicy: "fixed_record_chunks_merged_by_job_id",
      qualityThresholds: PRODUCTION_SPATIAL_QUALITY_THRESHOLDS,
      calibrationGuard: SPATIAL_CALIBRATION_GUARD
    },
    speciesCapTuning: {
      strategy: "cross_fitted_species_specific_admin_cap_brier_selection",
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
    calibratorFamilies: familyResults.map((result) => ({
      family: result.family,
      guard: result.guard,
      rawMetrics: result.rawMetrics,
      metrics: result.compactMetrics,
      foldMetrics: result.foldMetrics,
      failures: result.failures,
      productionCalibrators: result.productionCalibrators
    })),
    recommendation: recommended
      ? {
          familyId: recommended.family.id,
          failures: recommended.failures,
          metrics: recommended.compactMetrics,
          developmentDiagnosticOnly: true,
          productionCalibrators: recommended.productionCalibrators
        }
      : null,
    limitations: [
      "cache_does_not_evaluate_reverse_ndcg",
      "species_specific_caps_are_not_supported_by_current_runtime_or_frozen_parameter_schema",
      "scope_guard_and_family_recommendation_are_selected_on_the_same_development_oof_and_are_not_unbiased_release_metrics",
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
  SpatialCandidateScorerError,
  baselineProbabilityFromAdminEvidence,
  candidateCapsForRow,
  compactMetrics,
  evaluateCandidateRows,
  fitCalibrationFamily,
  probabilityFromAdminEvidence,
  scoreSpatialOofCandidates,
  spatialCandidateScorerImplementationSha256,
  spatialQualityFailures
};
