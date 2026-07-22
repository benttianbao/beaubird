"use strict";

const { createHash } = require("node:crypto");

const { canonicalJson } = require("./spatial-splits");

const RANKING_REFERENCE_SCHEMA_VERSION = 3;
const RANKING_REFERENCE_CONTRACT = Object.freeze({
  id: "zhejiang_ranking_reference_cross_fitted_residual_v3",
  outputMeaning: "complete_checklist_observed_frequency_reference_range_not_absolute_presence_probability",
  nominalCoverage: 0.9,
  minimumCalibrationRows: 3,
  minimumCalibrationWeight: 30,
  minimumCalibrationFolds: 2,
  foldAggregation: "maximum_outer_fold_weighted_quantile",
  hierarchicalHalfWidthFloor: "maximum_of_specific_prevalence_group_and_global",
  lowProbabilityCutoff: 0.03,
  confidenceMaximumWidth: Object.freeze({ high: 0.1, medium: 0.25 }),
  thresholds: Object.freeze({
    minimumRecallAt20Delta: 0,
    minimumNdcgAt20Delta: 0,
    minimumOverallCoverage: 0.9,
    minimumWorstSpeciesCoverage: 0.8,
    maximumMeanWidth: 0.35,
    minimumCachedCandidateRetention: 1
  })
});
const RANKING_REFERENCE_CONTRACT_SHA256 = createHash("sha256")
  .update(canonicalJson({
    schemaVersion: RANKING_REFERENCE_SCHEMA_VERSION,
    contract: RANKING_REFERENCE_CONTRACT
  }))
  .digest("hex");

function clamp(value, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

function prevalenceGroup(positiveCount) {
  const count = Number(positiveCount) || 0;
  if (count < 30) return "under_30";
  if (count < 80) return "30_79";
  if (count < 200) return "80_199";
  return "200_plus";
}

function referenceScope(row) {
  const count = Number(row?.positiveCount) || 0;
  return count >= 200 ? `species:${row.taxonId}` : `group:${prevalenceGroup(count)}`;
}

function normalizeEntries(entries) {
  if (!Array.isArray(entries) || !entries.length) {
    throw new TypeError("ranking reference 至少需要一行 OOF 证据。");
  }
  return entries.map((entry) => {
    const row = entry?.row || entry;
    const foldId = String(entry?.foldId ?? row?.foldId ?? "");
    const taxonId = String(row?.taxonId ?? "");
    const contextIndex = Number(row?.contextIndex);
    const total = Number(row?.total);
    const actualPositive = Number(row?.actualPositive);
    const rawProbability = Number(entry?.probability ?? row?.probability ?? row?.rawProbability);
    const rawBaselineProbability = Number(row?.baselineProbability);
    if (
      !foldId || !taxonId || !Number.isInteger(contextIndex) || contextIndex < 0 ||
      !Number.isFinite(total) || total <= 0 || !Number.isFinite(actualPositive) ||
      actualPositive < 0 || actualPositive > total ||
      !Number.isFinite(rawProbability) || rawProbability < 0 || rawProbability > 1 ||
      !Number.isFinite(rawBaselineProbability) || rawBaselineProbability < 0 || rawBaselineProbability > 1
    ) {
      throw new TypeError("ranking reference 收到非法 OOF 行。");
    }
    return {
      foldId,
      contextIndex,
      taxonId,
      positiveCount: Number(row.positiveCount) || 0,
      total,
      actualPositive,
      observedFrequency: actualPositive / total,
      probability: rawProbability,
      baselineProbability: rawBaselineProbability,
      scope: referenceScope(row)
    };
  }).sort((left, right) =>
    left.foldId.localeCompare(right.foldId) ||
    left.contextIndex - right.contextIndex ||
    left.taxonId.localeCompare(right.taxonId)
  );
}

function weightedQuantile(rows, quantile) {
  const usable = rows
    .map((row) => ({ value: Number(row.value), weight: Number(row.weight) }))
    .filter((row) => Number.isFinite(row.value) && Number.isFinite(row.weight) && row.weight > 0)
    .sort((left, right) => left.value - right.value);
  const totalWeight = usable.reduce((sum, row) => sum + row.weight, 0);
  if (!usable.length || totalWeight <= 0) return null;
  const target = clamp(quantile) * totalWeight;
  let cumulative = 0;
  for (const row of usable) {
    cumulative += row.weight;
    if (cumulative + 1e-12 >= target) return row.value;
  }
  return usable.at(-1).value;
}

function fitRangeParameters(entries, contract = RANKING_REFERENCE_CONTRACT) {
  const residualsByScope = new Map();
  const add = (scope, entry) => {
    if (!residualsByScope.has(scope)) residualsByScope.set(scope, []);
    residualsByScope.get(scope).push({
      foldId: entry.foldId,
      value: Math.abs(entry.observedFrequency - entry.probability),
      weight: entry.total
    });
  };
  for (const entry of entries) {
    const scopes = new Set([
      entry.scope,
      `group:${prevalenceGroup(entry.positiveCount)}`,
      "global"
    ]);
    for (const scope of scopes) add(scope, entry);
  }
  const parameters = new Map();
  for (const [scope, rows] of [...residualsByScope].sort(([left], [right]) => left.localeCompare(right))) {
    const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);
    if (rows.length < contract.minimumCalibrationRows || totalWeight < contract.minimumCalibrationWeight) continue;
    const rowsByFold = new Map();
    for (const row of rows) {
      const foldId = String(row.foldId);
      if (!rowsByFold.has(foldId)) rowsByFold.set(foldId, []);
      rowsByFold.get(foldId).push(row);
    }
    const foldQuantiles = [...rowsByFold]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([foldId, foldRows]) => ({
        foldId,
        halfWidth: weightedQuantile(foldRows, contract.nominalCoverage),
        rowCount: foldRows.length,
        totalWeight: foldRows.reduce((sum, row) => sum + row.weight, 0)
      }))
      .filter((row) => Number.isFinite(row.halfWidth));
    if (foldQuantiles.length < contract.minimumCalibrationFolds) continue;
    const halfWidth = Math.max(...foldQuantiles.map((row) => row.halfWidth));
    if (!Number.isFinite(halfWidth)) continue;
    parameters.set(scope, {
      scope,
      halfWidth: clamp(halfWidth),
      rowCount: rows.length,
      totalWeight,
      calibrationFoldCount: foldQuantiles.length,
      foldQuantiles
    });
  }
  return parameters;
}

function parameterForEntry(parameters, entry) {
  const scopes = [...new Set([
    entry.scope,
    `group:${prevalenceGroup(entry.positiveCount)}`,
    "global"
  ])];
  const available = scopes.map((scope) => parameters.get(scope)).filter(Boolean);
  if (!available.length) {
    return { scope: "unavailable", sourceScopes: [], halfWidth: 1, rowCount: 0, totalWeight: 0 };
  }
  const narrowestScope = available[0];
  return {
    ...narrowestScope,
    sourceScopes: available.map((parameter) => parameter.scope),
    halfWidth: Math.max(...available.map((parameter) => parameter.halfWidth))
  };
}

function confidenceForWidth(width, contract = RANKING_REFERENCE_CONTRACT) {
  if (width <= contract.confidenceMaximumWidth.high) return "high";
  if (width <= contract.confidenceMaximumWidth.medium) return "medium";
  return "low";
}

function applyCrossFittedRanges(entries, contract = RANKING_REFERENCE_CONTRACT) {
  const normalized = normalizeEntries(entries);
  const foldIds = [...new Set(normalized.map((entry) => entry.foldId))].sort();
  if (foldIds.length < 2) throw new TypeError("ranking reference 至少需要两个 outer folds。");
  const ranged = [];
  const foldParameters = [];
  for (const heldoutFoldId of foldIds) {
    const training = normalized.filter((entry) => entry.foldId !== heldoutFoldId);
    const target = normalized.filter((entry) => entry.foldId === heldoutFoldId);
    const parameters = fitRangeParameters(training, contract);
    foldParameters.push({
      heldoutFoldId,
      trainingFoldIds: foldIds.filter((foldId) => foldId !== heldoutFoldId),
      parameterCount: parameters.size
    });
    for (const entry of target) {
      const parameter = parameterForEntry(parameters, entry);
      const lower = clamp(entry.probability - parameter.halfWidth);
      const upper = clamp(entry.probability + parameter.halfWidth);
      ranged.push({
        ...entry,
        referenceScope: parameter.scope,
        referenceSourceScopes: parameter.sourceScopes,
        referenceLower: lower,
        referenceUpper: upper,
        referenceWidth: upper - lower,
        confidence: confidenceForWidth(upper - lower, contract)
      });
    }
  }
  return {
    entries: ranged.sort((left, right) =>
      left.foldId.localeCompare(right.foldId) ||
      left.contextIndex - right.contextIndex ||
      left.taxonId.localeCompare(right.taxonId)
    ),
    foldParameters
  };
}

function dcgAtK(rows, probabilityKey, k = 20) {
  return [...rows]
    .sort((left, right) => right[probabilityKey] - left[probabilityKey] || left.taxonId.localeCompare(right.taxonId))
    .slice(0, k)
    .reduce((sum, row, index) => sum + (row.actualPositive > 0 ? 1 / Math.log2(index + 2) : 0), 0);
}

function rankingMetrics(entries) {
  const contexts = new Map();
  for (const entry of entries) {
    const key = `${entry.foldId}\0${entry.contextIndex}`;
    if (!contexts.has(key)) contexts.set(key, []);
    contexts.get(key).push(entry);
  }
  let recallHits = 0;
  let baselineRecallHits = 0;
  let recallActual = 0;
  let ndcgSum = 0;
  let baselineNdcgSum = 0;
  let evaluatedContexts = 0;
  let minimumCandidatesPerContext = Number.POSITIVE_INFINITY;
  let maximumCandidatesPerContext = 0;
  for (const rows of contexts.values()) {
    minimumCandidatesPerContext = Math.min(minimumCandidatesPerContext, rows.length);
    maximumCandidatesPerContext = Math.max(maximumCandidatesPerContext, rows.length);
    const actual = rows.filter((row) => row.actualPositive > 0);
    if (!actual.length) continue;
    const modelTop = new Set([...rows]
      .sort((left, right) => right.probability - left.probability || left.taxonId.localeCompare(right.taxonId))
      .slice(0, 20)
      .map((row) => row.taxonId));
    const baselineTop = new Set([...rows]
      .sort((left, right) => right.baselineProbability - left.baselineProbability || left.taxonId.localeCompare(right.taxonId))
      .slice(0, 20)
      .map((row) => row.taxonId));
    for (const row of actual) {
      if (modelTop.has(row.taxonId)) recallHits += 1;
      if (baselineTop.has(row.taxonId)) baselineRecallHits += 1;
    }
    recallActual += actual.length;
    const idealDcg = Array.from({ length: Math.min(20, actual.length) }, (_, index) => 1 / Math.log2(index + 2))
      .reduce((sum, value) => sum + value, 0);
    if (idealDcg > 0) {
      ndcgSum += dcgAtK(rows, "probability") / idealDcg;
      baselineNdcgSum += dcgAtK(rows, "baselineProbability") / idealDcg;
      evaluatedContexts += 1;
    }
  }
  const recallAt20 = recallActual ? recallHits / recallActual : null;
  const baselineRecallAt20 = recallActual ? baselineRecallHits / recallActual : null;
  const ndcgAt20 = evaluatedContexts ? ndcgSum / evaluatedContexts : null;
  const baselineNdcgAt20 = evaluatedContexts ? baselineNdcgSum / evaluatedContexts : null;
  return {
    recallAt20,
    baselineRecallAt20,
    recallAt20Delta: recallActual ? (recallHits - baselineRecallHits) / recallActual : null,
    ndcgAt20,
    baselineNdcgAt20,
    ndcgAt20Delta: evaluatedContexts ? ndcgAt20 - baselineNdcgAt20 : null,
    recallActual,
    evaluatedContexts,
    minimumCandidatesPerContext: Number.isFinite(minimumCandidatesPerContext) ? minimumCandidatesPerContext : 0,
    maximumCandidatesPerContext
  };
}

function rangeMetrics(entries, contract = RANKING_REFERENCE_CONTRACT) {
  const bySpecies = new Map();
  let coveredWeight = 0;
  let totalWeight = 0;
  let weightedWidth = 0;
  for (const entry of entries) {
    const covered = entry.observedFrequency + 1e-12 >= entry.referenceLower &&
      entry.observedFrequency <= entry.referenceUpper + 1e-12;
    coveredWeight += covered ? entry.total : 0;
    totalWeight += entry.total;
    weightedWidth += entry.total * entry.referenceWidth;
    if (!bySpecies.has(entry.taxonId)) bySpecies.set(entry.taxonId, { coveredWeight: 0, totalWeight: 0 });
    const species = bySpecies.get(entry.taxonId);
    species.coveredWeight += covered ? entry.total : 0;
    species.totalWeight += entry.total;
  }
  const species = [...bySpecies].map(([taxonId, values]) => ({
    taxonId,
    coverage: values.totalWeight > 0 ? values.coveredWeight / values.totalWeight : null,
    totalWeight: values.totalWeight
  })).filter((row) => Number.isFinite(row.coverage))
    .sort((left, right) => left.coverage - right.coverage || left.taxonId.localeCompare(right.taxonId));
  return {
    nominalCoverage: contract.nominalCoverage,
    overallCoverage: totalWeight > 0 ? coveredWeight / totalWeight : null,
    meanWidth: totalWeight > 0 ? weightedWidth / totalWeight : null,
    speciesCount: species.length,
    worstSpeciesCoverage: species[0]?.coverage ?? null,
    worstSpeciesId: species[0]?.taxonId ?? null,
    worstSpecies: species.slice(0, 30)
  };
}

function qualityFailures({ ranking, ranges, retention }, contract = RANKING_REFERENCE_CONTRACT) {
  const thresholds = contract.thresholds;
  const failures = [];
  if (!Number.isFinite(ranking.recallAt20Delta) || ranking.recallAt20Delta < thresholds.minimumRecallAt20Delta) {
    failures.push("ranking_reference.recallAt20Delta");
  }
  if (!Number.isFinite(ranking.ndcgAt20Delta) || ranking.ndcgAt20Delta < thresholds.minimumNdcgAt20Delta) {
    failures.push("ranking_reference.ndcgAt20Delta");
  }
  if (!Number.isFinite(ranges.overallCoverage) || ranges.overallCoverage < thresholds.minimumOverallCoverage) {
    failures.push("ranking_reference.overallCoverage");
  }
  if (!Number.isFinite(ranges.worstSpeciesCoverage) || ranges.worstSpeciesCoverage < thresholds.minimumWorstSpeciesCoverage) {
    failures.push("ranking_reference.worstSpeciesCoverage");
  }
  if (!Number.isFinite(ranges.meanWidth) || ranges.meanWidth > thresholds.maximumMeanWidth) {
    failures.push("ranking_reference.meanWidth");
  }
  if (retention.cachedCandidateRetention < thresholds.minimumCachedCandidateRetention) {
    failures.push("ranking_reference.cachedCandidateRetention");
  }
  return failures;
}

function evaluateRankingReference(entries, contract = RANKING_REFERENCE_CONTRACT) {
  const normalized = normalizeEntries(entries);
  const ranged = applyCrossFittedRanges(normalized, contract);
  const ranking = rankingMetrics(ranged.entries);
  const ranges = rangeMetrics(ranged.entries, contract);
  const lowProbabilityCount = ranged.entries.filter((entry) => entry.probability < contract.lowProbabilityCutoff).length;
  const retention = {
    inputRows: normalized.length,
    outputRows: ranged.entries.length,
    lowProbabilityCount,
    retainedLowProbabilityCount: lowProbabilityCount,
    cachedCandidateRetention: normalized.length ? ranged.entries.length / normalized.length : 0,
    lowProbabilityRetention: lowProbabilityCount ? 1 : null,
    thresholdFilteringApplied: false
  };
  const failures = qualityFailures({ ranking, ranges, retention }, contract);
  const productionParameters = [...fitRangeParameters(normalized, contract).values()]
    .sort((left, right) => left.scope.localeCompare(right.scope));
  return {
    schemaVersion: RANKING_REFERENCE_SCHEMA_VERSION,
    contractId: contract.id,
    contractSha256: RANKING_REFERENCE_CONTRACT_SHA256,
    developmentDiagnosticOnly: true,
    freezeEligible: false,
    formalProbabilityGateUnchanged: true,
    passed: failures.length === 0,
    failures,
    contract,
    ranking,
    ranges,
    retention,
    crossFitting: {
      fitFoldCount: ranged.foldParameters.length - 1,
      heldoutFoldCount: ranged.foldParameters.length,
      folds: ranged.foldParameters
    },
    productionParameters,
    limitations: [
      "cache_roster_contains_only_release_evaluated_taxa_and_does_not_prove_all_public_taxa_materialization",
      "reference_ranges_cover_heldout_context_observed_checklist_frequency_not_individual_bird_presence",
      "result_cannot_freeze_parameters_or_open_sealed",
      "full_development_build_must_recompute_time_space_observer_probability_gates"
    ]
  };
}

module.exports = {
  RANKING_REFERENCE_CONTRACT,
  RANKING_REFERENCE_CONTRACT_SHA256,
  RANKING_REFERENCE_SCHEMA_VERSION,
  applyCrossFittedRanges,
  evaluateRankingReference,
  fitRangeParameters,
  qualityFailures,
  rangeMetrics,
  rankingMetrics,
  weightedQuantile
};
