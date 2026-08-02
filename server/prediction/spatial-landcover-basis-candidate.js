"use strict";

const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const {
  compactMetrics,
  evaluateCandidateRows,
  spatialQualityFailures
} = require("./spatial-candidate-scorer");
const {
  baseScope,
  crossFitFamily
} = require("./spatial-profile-calibration-candidate");
const { canonicalJson } = require("./spatial-splits");

const SPATIAL_LANDCOVER_BASIS_SCHEMA_VERSION = 1;
const SPATIAL_LANDCOVER_BASIS_FILES = Object.freeze([
  "server/prediction/spatial-landcover-basis-candidate.js",
  "server/prediction/spatial-profile-calibration-candidate.js",
  "tools/score-zhejiang-spatial-landcover-basis.js"
]);
const SPATIAL_LANDCOVER_BASIS_CONTRACT = Object.freeze({
  id: "zhejiang_public_profile_landcover_basis_residual_v1",
  hypothesis:
    "The v11 categorical profile failure is caused by fold-confounded unseen profile levels; a shared continuous public land-cover basis can generalize across frozen profiles and reduce worst-species ECE without degrading Brier or pooled ECE.",
  control: "existing_species_or_prevalence_group_beta_calibration",
  candidate:
    "species_specific_ridge_logistic_residual_on_public_profile_landcover_basis",
  eligibleSpeciesMinimumOuterTrainingPositiveCount: 200,
  sourceFeatureContractId:
    "zhejiang_worldcover_h3_r6_multiscale_profiles_v1",
  sourceProfileModelSha256:
    "896848ec676c31f9aeed9117801b9e66a722b7f579b792c8047fc5312b0795e4",
  basis: Object.freeze({
    source: "frozen_public_profile_centroids_only",
    features: Object.freeze([
      Object.freeze({
        id: "local_forest",
        worldcoverClassCodes: Object.freeze([10])
      }),
      Object.freeze({
        id: "local_human_modified",
        worldcoverClassCodes: Object.freeze([40, 50])
      }),
      Object.freeze({
        id: "local_aquatic",
        worldcoverClassCodes: Object.freeze([80, 90, 95])
      })
    ]),
    standardization:
      "public_cell_count_weighted_population_over_all_frozen_profiles",
    minimumStandardDeviation: 1e-8,
    standardizedClip: 4,
    exactContextFeatureVectorForbidden: true
  }),
  residualCalibration: Object.freeze({
    offset: "logit_of_cross_fitted_control_beta_probability",
    coefficients: Object.freeze([
      "intercept",
      "local_forest",
      "local_human_modified",
      "local_aquatic"
    ]),
    ridge: 10,
    maximumIterations: 50,
    maximumAbsoluteCoefficient: 2,
    convergenceTolerance: 1e-7,
    crossFit: "leave_one_development_outer_fold_out",
    residualTraining:
      "strict_inner_oof_control_predictions_excluding_heldout_outer",
    guardScope: "species_across_all_heldout_outer_folds",
    maximumRelativeBrierDegradation: 0.01,
    maximumEceDegradation: 0.01
  }),
  selection: Object.freeze({
    requireEveryFoldGuard: true,
    requirePooledGuard: true,
    requireStrictWorstSpeciesEceImprovement: true,
    requireAllFrozenSpatialQualityGates: true
  }),
  seasonFeatureEnabled: false,
  privacy:
    "public_taxon_id_and_public_profile_centroid_basis_aggregates_only_no_context_or_location_identity"
});

class SpatialLandcoverBasisError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "SpatialLandcoverBasisError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function implementationSha256(
  projectRoot = resolve(__dirname, "..", "..")
) {
  const hash = createHash("sha256");
  for (const relativePath of [...SPATIAL_LANDCOVER_BASIS_FILES].sort()) {
    hash.update(relativePath);
    hash.update("\0");
    hash.update(readFileSync(resolve(projectRoot, relativePath)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function canonicalSha256(value) {
  return createHash("sha256")
    .update(canonicalJson(value))
    .digest("hex");
}

function stableNumber(value) {
  return Number(Number(value).toFixed(12));
}

function buildLandcoverBasis(featureCache) {
  const profiles = featureCache?.profiles;
  const normalization = featureCache?.metadata?.normalization;
  const featureNames =
    normalization?.featureNames || featureCache?.metadata?.featureNames;
  if (
    !Array.isArray(profiles) ||
    profiles.length < 2 ||
    !Array.isArray(featureNames) ||
    !Array.isArray(normalization?.means) ||
    !Array.isArray(normalization?.standardDeviations) ||
    featureNames.length !== normalization.means.length ||
    featureNames.length !== normalization.standardDeviations.length
  ) {
    throw new SpatialLandcoverBasisError(
      "SPATIAL_LANDCOVER_BASIS_SOURCE_INVALID",
      "冻结空间原型及其标准化统计不完整。"
    );
  }
  const indexByName = new Map(
    featureNames.map((name, index) => [String(name), index])
  );
  const rawRows = profiles.map((profile) => {
    if (
      !Array.isArray(profile.standardizedCentroid) ||
      profile.standardizedCentroid.length !== featureNames.length ||
      !(Number(profile.publicCellCount) > 0)
    ) {
      throw new SpatialLandcoverBasisError(
        "SPATIAL_LANDCOVER_BASIS_PROFILE_INVALID",
        "冻结空间原型质心或公共支持度无效。"
      );
    }
    const rawCentroid = profile.standardizedCentroid.map(
      (value, index) =>
        Number(normalization.means[index]) +
        Number(value) *
          Number(normalization.standardDeviations[index])
    );
    const values =
      SPATIAL_LANDCOVER_BASIS_CONTRACT.basis.features.map(
        (basisFeature) =>
          basisFeature.worldcoverClassCodes.reduce(
            (sum, code) => {
              const index = indexByName.get(
                `local.worldcover_${code}`
              );
              if (index === undefined) {
                throw new SpatialLandcoverBasisError(
                  "SPATIAL_LANDCOVER_BASIS_FEATURE_MISSING",
                  `冻结原型缺少 local.worldcover_${code}。`
                );
              }
              return sum + Number(rawCentroid[index]);
            },
            0
          )
      );
    return {
      profileId: String(profile.profileId),
      publicCellCount: Number(profile.publicCellCount),
      raw: values
    };
  });
  const publicCellCount = rawRows.reduce(
    (sum, row) => sum + row.publicCellCount,
    0
  );
  const dimension =
    SPATIAL_LANDCOVER_BASIS_CONTRACT.basis.features.length;
  const means = Array.from({ length: dimension }, (_, index) =>
    rawRows.reduce(
      (sum, row) =>
        sum + row.publicCellCount * row.raw[index],
      0
    ) / publicCellCount
  );
  const standardDeviations = Array.from(
    { length: dimension },
    (_, index) => {
      const variance =
        rawRows.reduce((sum, row) => {
          const difference = row.raw[index] - means[index];
          return (
            sum +
            row.publicCellCount * difference * difference
          );
        }, 0) / publicCellCount;
      const value = Math.sqrt(variance);
      return value <
        SPATIAL_LANDCOVER_BASIS_CONTRACT.basis
          .minimumStandardDeviation
        ? 1
        : value;
    }
  );
  const clip =
    SPATIAL_LANDCOVER_BASIS_CONTRACT.basis.standardizedClip;
  const rows = rawRows.map((row) => ({
    profileId: row.profileId,
    publicCellCount: row.publicCellCount,
    values: row.raw.map((value, index) =>
      stableNumber(
        Math.max(
          -clip,
          Math.min(
            clip,
            (value - means[index]) /
              standardDeviations[index]
          )
        )
      )
    )
  }));
  const serializable = {
    contractId: SPATIAL_LANDCOVER_BASIS_CONTRACT.id,
    sourceProfileModelSha256:
      featureCache.metadata.profileModelSha256,
    publicCellCount,
    featureIds:
      SPATIAL_LANDCOVER_BASIS_CONTRACT.basis.features.map(
        (feature) => feature.id
      ),
    means: means.map(stableNumber),
    standardDeviations:
      standardDeviations.map(stableNumber),
    profiles: rows
  };
  return {
    ...serializable,
    basisModelSha256: canonicalSha256(serializable),
    byProfileId: new Map(
      rows.map((row) => [row.profileId, row.values])
    )
  };
}

function attachBasis(fold, contexts, basis) {
  const contextByIndex = new Map(
    contexts.map((context) => [
      Number(context.contextIndex),
      {
        profileId: String(context.profileId),
        basis: basis.byProfileId.get(String(context.profileId))
      }
    ])
  );
  if (
    contextByIndex.size !== Number(fold.contextCount) ||
    contextByIndex.size === 0
  ) {
    throw new SpatialLandcoverBasisError(
      "SPATIAL_LANDCOVER_BASIS_CONTEXT_LAYOUT_MISMATCH",
      "特征上下文与邻居缓存 fold 布局不一致。"
    );
  }
  return {
    foldId: String(
      fold.innerFoldId == null
        ? fold.outerFoldId
        : fold.innerFoldId
    ),
    rows: fold.scoreRows.map((row) => {
      const context = contextByIndex.get(
        Number(row.contextIndex)
      );
      if (!context?.basis) {
        throw new SpatialLandcoverBasisError(
          "SPATIAL_LANDCOVER_BASIS_CONTEXT_MISSING",
          "评分行缺少对应的公开地表基底。"
        );
      }
      return {
        ...row,
        profileId: context.profileId,
        landcoverBasis: context.basis
      };
    })
  };
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
  const value = Math.max(
    1e-8,
    Math.min(1 - 1e-8, Number(probability) || 0)
  );
  return Math.log(value / (1 - value));
}

function solveLinearSystem(matrix, vector) {
  const dimension = vector.length;
  const augmented = matrix.map((row, index) => [
    ...row,
    vector[index]
  ]);
  for (let pivot = 0; pivot < dimension; pivot += 1) {
    let best = pivot;
    for (let row = pivot + 1; row < dimension; row += 1) {
      if (
        Math.abs(augmented[row][pivot]) >
        Math.abs(augmented[best][pivot])
      ) {
        best = row;
      }
    }
    if (Math.abs(augmented[best][pivot]) < 1e-12) {
      return null;
    }
    [augmented[pivot], augmented[best]] = [
      augmented[best],
      augmented[pivot]
    ];
    const divisor = augmented[pivot][pivot];
    for (
      let column = pivot;
      column <= dimension;
      column += 1
    ) {
      augmented[pivot][column] /= divisor;
    }
    for (let row = 0; row < dimension; row += 1) {
      if (row === pivot) continue;
      const factor = augmented[row][pivot];
      for (
        let column = pivot;
        column <= dimension;
        column += 1
      ) {
        augmented[row][column] -=
          factor * augmented[pivot][column];
      }
    }
  }
  return augmented.map((row) => row[dimension]);
}

function fitLandcoverResidual(points) {
  const dimension =
    1 +
    SPATIAL_LANDCOVER_BASIS_CONTRACT.basis.features.length;
  const usable = (points || []).filter(
    (point) =>
      Number(point.total) > 0 &&
      Number.isFinite(Number(point.probability)) &&
      Number(point.positives) >= 0 &&
      Array.isArray(point.basis) &&
      point.basis.length === dimension - 1 &&
      point.basis.every((value) =>
        Number.isFinite(Number(value))
      )
  );
  if (usable.length < dimension) {
    return {
      coefficients: Array(dimension).fill(0),
      fitted: false,
      iterations: 0
    };
  }
  const contract =
    SPATIAL_LANDCOVER_BASIS_CONTRACT.residualCalibration;
  let coefficients = Array(dimension).fill(0);
  let iterations = 0;
  for (
    ;
    iterations < contract.maximumIterations;
    iterations += 1
  ) {
    const gradient = Array(dimension).fill(0);
    const information = Array.from(
      { length: dimension },
      () => Array(dimension).fill(0)
    );
    for (const point of usable) {
      const features = [1, ...point.basis.map(Number)];
      const total = Number(point.total);
      const positives = Math.max(
        0,
        Math.min(total, Number(point.positives))
      );
      const linear =
        logit(point.probability) +
        coefficients.reduce(
          (sum, coefficient, index) =>
            sum + coefficient * features[index],
          0
        );
      const fitted = logistic(linear);
      const residual = positives - total * fitted;
      const variance = Math.max(
        1e-9,
        total * fitted * (1 - fitted)
      );
      for (let row = 0; row < dimension; row += 1) {
        gradient[row] += features[row] * residual;
        for (
          let column = 0;
          column < dimension;
          column += 1
        ) {
          information[row][column] +=
            features[row] *
            features[column] *
            variance;
        }
      }
    }
    for (let index = 0; index < dimension; index += 1) {
      gradient[index] -=
        contract.ridge * coefficients[index];
      information[index][index] += contract.ridge;
    }
    const delta = solveLinearSystem(information, gradient);
    if (!delta) break;
    coefficients = coefficients.map(
      (coefficient, index) =>
        Math.max(
          -contract.maximumAbsoluteCoefficient,
          Math.min(
            contract.maximumAbsoluteCoefficient,
            coefficient +
              Math.max(-1, Math.min(1, delta[index]))
          )
        )
    );
    if (
      Math.max(...delta.map(Math.abs)) <
      contract.convergenceTolerance
    ) {
      break;
    }
  }
  return {
    coefficients: coefficients.map(stableNumber),
    fitted: true,
    iterations
  };
}

function applyLandcoverResidual(
  probability,
  basis,
  fit
) {
  if (!fit?.fitted) return Number(probability);
  const features = [1, ...basis.map(Number)];
  const adjustment = fit.coefficients.reduce(
    (sum, coefficient, index) =>
      sum + coefficient * features[index],
    0
  );
  return logistic(logit(probability) + adjustment);
}

function targetPositiveCounts(targetRows) {
  const result = new Map();
  for (const row of targetRows) {
    result.set(
      row.taxonId,
      Math.max(
        result.get(row.taxonId) || 0,
        Number(row.positiveCount) || 0
      )
    );
  }
  return result;
}

function fitResidualMap(controlEntries, positiveByTaxon) {
  const pointsByTaxon = new Map();
  for (const entry of controlEntries) {
    const row = entry.row;
    const positiveCount =
      positiveByTaxon.get(row.taxonId);
    if (
      !(positiveCount >=
        SPATIAL_LANDCOVER_BASIS_CONTRACT
          .eligibleSpeciesMinimumOuterTrainingPositiveCount)
    ) {
      continue;
    }
    if (!pointsByTaxon.has(row.taxonId)) {
      pointsByTaxon.set(row.taxonId, []);
    }
    pointsByTaxon.get(row.taxonId).push({
      probability: entry.probability,
      basis: row.landcoverBasis,
      positives: row.actualPositive,
      total: row.total
    });
  }
  return new Map(
    [...pointsByTaxon].map(([taxonId, points]) => [
      taxonId,
      fitLandcoverResidual(points)
    ])
  );
}

function relativeBrierDegradation(control, candidate) {
  if (!Number.isFinite(control) || !Number.isFinite(candidate)) {
    return Number.POSITIVE_INFINITY;
  }
  if (control > 1e-12) {
    return (candidate - control) / control;
  }
  return candidate <= control + 1e-12
    ? 0
    : Number.POSITIVE_INFINITY;
}

function rowIdentity(foldId, row) {
  return [
    String(foldId),
    String(row.contextIndex),
    String(row.taxonId)
  ].join("\0");
}

function scoreCrossFitted(outerFolds, innerFoldsByOuter) {
  const control = crossFitFamily(
    outerFolds,
    baseScope,
    "existing_spatial_beta_calibration_control"
  );
  const controlByRow = new Map(
    control.entries.map((entry) => [
      rowIdentity(entry.foldId, entry.row),
      entry.probability
    ])
  );
  const preliminary = [];
  const scopeEntries = new Map();
  for (
    let heldout = 0;
    heldout < outerFolds.length;
    heldout += 1
  ) {
    const targetFold = outerFolds[heldout];
    const targetRows = targetFold.rows;
    const positiveByTaxon = targetPositiveCounts(targetRows);
    const innerFolds =
      innerFoldsByOuter.get(targetFold.foldId) || [];
    if (innerFolds.length !== 4) {
      throw new SpatialLandcoverBasisError(
        "SPATIAL_LANDCOVER_BASIS_INNER_LAYOUT_MISMATCH",
        "每个 outer 必须绑定四个严格 inner OOF fold。",
        {
          outerFoldId: targetFold.foldId,
          innerFoldCount: innerFolds.length
        }
      );
    }
    const innerControl = crossFitFamily(
      innerFolds,
      baseScope,
      `strict_inner_control_for_outer_${targetFold.foldId}`
    );
    const residuals = fitResidualMap(
      innerControl.entries,
      positiveByTaxon
    );
    const entries = targetRows.map((row) => {
      const positiveCount = positiveByTaxon.get(row.taxonId);
      const scope =
        positiveCount >=
        SPATIAL_LANDCOVER_BASIS_CONTRACT
          .eligibleSpeciesMinimumOuterTrainingPositiveCount
          ? `species:${row.taxonId}`
          : null;
      const controlProbability = controlByRow.get(
        rowIdentity(targetFold.foldId, row)
      );
      if (!Number.isFinite(controlProbability)) {
        throw new SpatialLandcoverBasisError(
          "SPATIAL_LANDCOVER_BASIS_CONTROL_ROW_MISSING",
          "outer control 缺少候选行身份。"
        );
      }
      const fit = scope
        ? residuals.get(row.taxonId) || null
        : null;
      const candidateProbability = scope
        ? applyLandcoverResidual(
            controlProbability,
            row.landcoverBasis,
            fit
          )
        : controlProbability;
      if (scope) {
        if (!scopeEntries.has(scope)) {
          scopeEntries.set(scope, {
            control: [],
            candidate: [],
            targetApplications: 0,
            fittedApplications: 0,
            fittedFoldIds: new Set()
          });
        }
        const aggregate = scopeEntries.get(scope);
        const shared = {
          foldId: targetFold.foldId,
          row
        };
        aggregate.control.push({
          ...shared,
          probability: controlProbability
        });
        aggregate.candidate.push({
          ...shared,
          probability: candidateProbability
        });
        aggregate.targetApplications += 1;
        if (fit?.fitted) {
          aggregate.fittedApplications += 1;
          aggregate.fittedFoldIds.add(
            targetFold.foldId
          );
        }
      }
      return {
        foldId: targetFold.foldId,
        row,
        scope,
        controlProbability,
        candidateProbability
      };
    });
    preliminary.push({
      foldId: targetFold.foldId,
      entries
    });
  }
  const acceptedScopes = new Set();
  const scopes = [];
  for (const [scope, entries] of scopeEntries) {
    const controlMetrics = evaluateCandidateRows(
      entries.control
    );
    const candidateMetrics = evaluateCandidateRows(
      entries.candidate
    );
    const brierDegradation = relativeBrierDegradation(
      controlMetrics.brier,
      candidateMetrics.brier
    );
    const eceDegradation =
      candidateMetrics.ece - controlMetrics.ece;
    const accepted =
      entries.fittedApplications ===
        entries.targetApplications &&
      brierDegradation <=
        SPATIAL_LANDCOVER_BASIS_CONTRACT
          .residualCalibration
          .maximumRelativeBrierDegradation &&
      eceDegradation <=
        SPATIAL_LANDCOVER_BASIS_CONTRACT
          .residualCalibration.maximumEceDegradation;
    if (accepted) acceptedScopes.add(scope);
    scopes.push({
      scope,
      accepted,
      targetApplications: entries.targetApplications,
      fittedApplications: entries.fittedApplications,
      fittedFoldCount: entries.fittedFoldIds.size,
      controlBrier: controlMetrics.brier,
      candidateBrier: candidateMetrics.brier,
      relativeBrierDegradation: brierDegradation,
      controlEce: controlMetrics.ece,
      candidateEce: candidateMetrics.ece,
      eceDegradation
    });
  }
  const candidateFolds = preliminary.map((fold) => {
    const entries = fold.entries.map((entry) => ({
      foldId: fold.foldId,
      row: entry.row,
      probability:
        entry.scope && acceptedScopes.has(entry.scope)
          ? entry.candidateProbability
          : entry.controlProbability
    }));
    return {
      foldId: fold.foldId,
      entries,
      metrics: evaluateCandidateRows(entries)
    };
  });
  const family = (id, evaluatedFolds) => {
    const entries = evaluatedFolds.flatMap(
      (fold) => fold.entries
    );
    return {
      familyId: id,
      metrics: evaluateCandidateRows(entries),
      folds: evaluatedFolds.map(({ foldId, metrics }) => ({
        foldId,
        metrics
      }))
    };
  };
  return {
    control,
    candidate: {
      ...family(
        SPATIAL_LANDCOVER_BASIS_CONTRACT.id,
        candidateFolds
      ),
      acceptedScopeCount: acceptedScopes.size,
      rejectedScopeCount:
        scopes.length - acceptedScopes.size,
      scopes: scopes.sort((left, right) =>
        left.scope.localeCompare(right.scope)
      )
    }
  };
}

function guardAgainstControl(control, candidate) {
  const controlByFold = new Map(
    control.folds.map((fold) => [fold.foldId, fold.metrics])
  );
  const folds = candidate.folds.map((fold) => {
    const baseline = controlByFold.get(fold.foldId);
    const brierDegradation = relativeBrierDegradation(
      baseline?.brier,
      fold.metrics.brier
    );
    const eceDegradation =
      fold.metrics.ece - Number(baseline?.ece);
    return {
      foldId: fold.foldId,
      brierDegradation,
      eceDegradation,
      accepted:
        brierDegradation <=
          SPATIAL_LANDCOVER_BASIS_CONTRACT
            .residualCalibration
            .maximumRelativeBrierDegradation &&
        eceDegradation <=
          SPATIAL_LANDCOVER_BASIS_CONTRACT
            .residualCalibration.maximumEceDegradation
    };
  });
  const pooledBrierDegradation = relativeBrierDegradation(
    control.metrics.brier,
    candidate.metrics.brier
  );
  const pooledEceDegradation =
    candidate.metrics.ece - control.metrics.ece;
  return {
    accepted:
      folds.every((fold) => fold.accepted) &&
      pooledBrierDegradation <=
        SPATIAL_LANDCOVER_BASIS_CONTRACT
          .residualCalibration
          .maximumRelativeBrierDegradation &&
      pooledEceDegradation <=
        SPATIAL_LANDCOVER_BASIS_CONTRACT
          .residualCalibration.maximumEceDegradation,
    pooledBrierDegradation,
    pooledEceDegradation,
    folds
  };
}

function compactFamily(family) {
  return {
    familyId: family.familyId,
    metrics: compactMetrics(family.metrics),
    failures: spatialQualityFailures(family.metrics),
    folds: family.folds.map((fold) => ({
      foldId: fold.foldId,
      metrics: compactMetrics(fold.metrics)
    }))
  };
}

function assertControlReproduction(control, v10Report) {
  const expected =
    v10Report?.releaseQuality?.spatial?.metrics;
  const comparisons = [
    ["brier", control.metrics.brier, expected?.brier],
    [
      "baselineBrier",
      control.metrics.baselineBrier,
      expected?.baselineBrier
    ],
    [
      "brierSkill",
      control.metrics.brierSkill,
      expected?.brierSkill
    ],
    ["ece", control.metrics.ece, expected?.ece],
    [
      "recallAt20Delta",
      control.metrics.recallAt20Delta,
      expected?.recallAt20Delta
    ],
    [
      "maximumSpeciesEce",
      control.metrics.calibrationEce?.species?.maximumEce,
      expected?.calibrationEce?.species?.maximumEce
    ],
    [
      "maximumGroupEce",
      control.metrics.calibrationEce?.group?.maximumEce,
      expected?.calibrationEce?.group?.maximumEce
    ]
  ];
  const mismatches = comparisons
    .filter(
      ([, actual, target]) =>
        !Number.isFinite(Number(actual)) ||
        !Number.isFinite(Number(target)) ||
        Math.abs(Number(actual) - Number(target)) > 1e-12
    )
    .map(([name, actual, target]) => ({
      name,
      actual,
      expected: target
    }));
  if (mismatches.length) {
    throw new SpatialLandcoverBasisError(
      "SPATIAL_LANDCOVER_BASIS_CONTROL_MISMATCH",
      "v12 control 未精确复现 v10 正式空间指标。",
      { mismatches }
    );
  }
}

function buildSpatialLandcoverBasisReport({
  neighborCache,
  featureCache,
  v10Report,
  v11Report
}) {
  if (
    v11Report?.runtimeIntegrationEligible !== false ||
    v11Report?.recommendation?.nextAction !==
      "stop_profile_calibration_path_and_reassess_feature_resolution"
  ) {
    throw new SpatialLandcoverBasisError(
      "SPATIAL_LANDCOVER_BASIS_V11_STATE_MISMATCH",
      "v12 必须绑定 v11 原型条件校准 No-Go。"
    );
  }
  const basis = buildLandcoverBasis(featureCache);
  const outerFolds = ["1", "2", "3", "4", "5"].map(
    (outerFoldId) => {
      const fold = neighborCache.readFold({ outerFoldId });
      const contexts = featureCache.readFoldContexts({
        outerFoldId
      });
      return attachBasis(fold, contexts, basis);
    }
  );
  const innerFoldsByOuter = new Map(
    ["1", "2", "3", "4", "5"].map((outerFoldId) => {
      const innerFoldIds = featureCache.foldSets
        .filter(
          (fold) =>
            String(fold.outerFoldId) === outerFoldId &&
            fold.innerFoldId != null
        )
        .map((fold) => String(fold.innerFoldId))
        .sort();
      const innerFolds = innerFoldIds.map((innerFoldId) => {
        const fold = neighborCache.readFold({
          outerFoldId,
          innerFoldId
        });
        const contexts = featureCache.readFoldContexts({
          outerFoldId,
          innerFoldId
        });
        return attachBasis(fold, contexts, basis);
      });
      return [outerFoldId, innerFolds];
    })
  );
  const scored = scoreCrossFitted(
    outerFolds,
    innerFoldsByOuter
  );
  assertControlReproduction(scored.control, v10Report);
  const guard = guardAgainstControl(
    scored.control,
    scored.candidate
  );
  const controlMaximumSpeciesEce =
    scored.control.metrics.calibrationEce.species.maximumEce;
  const candidateMaximumSpeciesEce =
    scored.candidate.metrics.calibrationEce.species.maximumEce;
  const strictImprovement =
    candidateMaximumSpeciesEce <
    controlMaximumSpeciesEce - 1e-12;
  const failures = spatialQualityFailures(
    scored.candidate.metrics
  );
  const runtimeIntegrationEligible =
    guard.accepted &&
    strictImprovement &&
    failures.length === 0;
  return {
    schemaVersion: SPATIAL_LANDCOVER_BASIS_SCHEMA_VERSION,
    reportType:
      "zhejiang_spatial_landcover_basis_candidate_diagnostic",
    diagnosticOnly: true,
    developmentOnly: true,
    sealedPanelViewed: false,
    defaultModelModified: false,
    runtimeIntegrationEligible,
    implementationSha256: implementationSha256(),
    contract: {
      sha256: canonicalSha256(
        SPATIAL_LANDCOVER_BASIS_CONTRACT
      ),
      value: SPATIAL_LANDCOVER_BASIS_CONTRACT
    },
    inputs: {
      neighborCacheSha256: neighborCache.fileSha256,
      featureCacheSha256: featureCache.fileSha256
    },
    basis: {
      basisModelSha256: basis.basisModelSha256,
      sourceProfileModelSha256:
        basis.sourceProfileModelSha256,
      publicCellCount: basis.publicCellCount,
      featureIds: basis.featureIds,
      means: basis.means,
      standardDeviations: basis.standardDeviations
    },
    control: compactFamily(scored.control),
    candidate: {
      ...compactFamily(scored.candidate),
      acceptedScopeCount:
        scored.candidate.acceptedScopeCount,
      rejectedScopeCount:
        scored.candidate.rejectedScopeCount,
      scopes: scored.candidate.scopes,
      guard,
      strictWorstSpeciesEceImprovement:
        strictImprovement,
      maximumSpeciesEceDelta:
        candidateMaximumSpeciesEce -
        controlMaximumSpeciesEce
    },
    recommendation: {
      runtimeIntegrationEligible,
      nextAction: runtimeIntegrationEligible
        ? "prepare_frozen_runtime_integration_and_full_development_revalidation"
        : "stop_landcover_basis_path_and_reassess_spatial_generalization",
      qualityGatesUnchanged: true,
      referenceMaterializationForbidden: true,
      sealedForbidden: true
    },
    limitations: [
      "development_diagnostic_only",
      "basis_uses_frozen_public_profile_centroids_not_exact_context_vectors",
      "season_week_is_intentionally_excluded",
      "no_runtime_or_model_parameter_changes",
      "single_diagnostic_run_only",
      "sealed_forbidden_without_explicit_user_approval"
    ]
  };
}

function validatePreregistration(
  preregistration,
  {
    neighborCacheSha256,
    neighborCacheGenerationImplementationSha256,
    featureCacheSha256,
    v10ReportSha256,
    v11ReportSha256,
    basisModelSha256,
    outputPath
  }
) {
  const failures = [];
  const same = (left, right) =>
    canonicalJson(left) === canonicalJson(right);
  if (
    preregistration?.schemaVersion !== 1 ||
    preregistration?.kind !==
      "zhejiang_spatial_landcover_basis_v12_preregistration"
  ) {
    failures.push("schema");
  }
  if (
    !same(
      preregistration?.contract?.value,
      SPATIAL_LANDCOVER_BASIS_CONTRACT
    ) ||
    preregistration?.contract?.sha256 !==
      canonicalSha256(SPATIAL_LANDCOVER_BASIS_CONTRACT)
  ) {
    failures.push("contract");
  }
  if (
    preregistration?.implementation
      ?.scorerImplementationSha256 !==
    implementationSha256()
  ) {
    failures.push("implementation");
  }
  for (const [key, expected] of Object.entries({
    neighborCacheSha256,
    neighborCacheGenerationImplementationSha256,
    featureCacheSha256,
    v10ReportSha256,
    v11ReportSha256
  })) {
    if (preregistration?.inputs?.[key] !== expected) {
      failures.push(`inputs.${key}`);
    }
  }
  if (
    preregistration?.basis?.basisModelSha256 !==
    basisModelSha256
  ) {
    failures.push("basis.basisModelSha256");
  }
  if (
    resolve(preregistration?.outputs?.diagnosticPath || "") !==
    resolve(outputPath)
  ) {
    failures.push("outputs.diagnosticPath");
  }
  for (const [key, expected] of Object.entries({
    diagnosticOnly: true,
    developmentOnly: true,
    qualityThresholdsChanged: false,
    sealedDataRead: false,
    defaultModelModified: false,
    runtimeIntegrationForbidden: true,
    referenceMaterializationForbidden: true
  })) {
    if (preregistration?.changeControl?.[key] !== expected) {
      failures.push(`changeControl.${key}`);
    }
  }
  if (
    preregistration?.stopPolicy?.singleDiagnosticRunOnly !==
      true ||
    preregistration?.stopPolicy?.sealedForbidden !== true
  ) {
    failures.push("stopPolicy");
  }
  if (failures.length) {
    throw new SpatialLandcoverBasisError(
      "SPATIAL_LANDCOVER_BASIS_PREREGISTRATION_MISMATCH",
      "v12 连续地表基底预登记与冻结实现或输入不一致。",
      { failures: [...new Set(failures)].sort() }
    );
  }
  return true;
}

module.exports = {
  SPATIAL_LANDCOVER_BASIS_CONTRACT,
  SPATIAL_LANDCOVER_BASIS_FILES,
  SPATIAL_LANDCOVER_BASIS_SCHEMA_VERSION,
  SpatialLandcoverBasisError,
  applyLandcoverResidual,
  attachBasis,
  buildLandcoverBasis,
  buildSpatialLandcoverBasisReport,
  fitLandcoverResidual,
  implementationSha256,
  scoreCrossFitted,
  validatePreregistration
};
