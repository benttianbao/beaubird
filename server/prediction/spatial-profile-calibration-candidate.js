"use strict";

const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const {
  calibrateProbability,
  fitBetaCalibration
} = require("./math");
const {
  canonicalJson
} = require("./spatial-splits");
const {
  compactMetrics,
  evaluateCandidateRows,
  spatialQualityFailures
} = require("./spatial-candidate-scorer");

const SPATIAL_PROFILE_CALIBRATION_SCHEMA_VERSION = 1;
const SPATIAL_PROFILE_CALIBRATION_FILES = Object.freeze([
  "server/prediction/spatial-profile-calibration-candidate.js",
  "tools/score-zhejiang-spatial-profile-calibration.js"
]);
const SPATIAL_PROFILE_CALIBRATION_CONTRACT = Object.freeze({
  id: "zhejiang_multiscale_profile_beta_calibration_v1",
  hypothesis:
    "The v10 spatial species-calibration failure is concentrated by frozen public multiscale WorldCover profile, so cross-fitted species-by-profile beta calibration can reduce worst-species ECE without degrading pooled Brier or ECE.",
  control: "existing_species_or_prevalence_group_beta_calibration",
  candidate: "species_by_profile_beta_calibration",
  eligibleSpeciesMinimumOuterTrainingPositiveCount: 200,
  featureContractId:
    "zhejiang_worldcover_h3_r6_multiscale_profiles_v1",
  profileModelSha256:
    "896848ec676c31f9aeed9117801b9e66a722b7f579b792c8047fc5312b0795e4",
  seasonFeatureEnabled: false,
  calibration: Object.freeze({
    family: "beta",
    ridge: 0.001,
    crossFit: "leave_one_development_outer_fold_out",
    guardScope: "candidate_scope_across_all_heldout_outer_folds",
    maximumRelativeBrierDegradation: 0.01,
    maximumEceDegradation: 0.01
  }),
  selection: Object.freeze({
    requireEveryFoldGuard: true,
    requirePooledGuard: true,
    requireStrictWorstSpeciesEceImprovement: true,
    requireAllFrozenSpatialQualityGates: true
  }),
  privacy:
    "public_taxon_id_and_public_profile_id_aggregates_only_no_context_or_location_identity"
});

class SpatialProfileCalibrationError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "SpatialProfileCalibrationError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function spatialProfileCalibrationImplementationSha256(
  projectRoot = resolve(__dirname, "..", "..")
) {
  const hash = createHash("sha256");
  for (const relativePath of [...SPATIAL_PROFILE_CALIBRATION_FILES].sort()) {
    hash.update(relativePath);
    hash.update("\0");
    hash.update(readFileSync(resolve(projectRoot, relativePath)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function relativeBrierDegradation(control, candidate) {
  if (!Number.isFinite(control) || !Number.isFinite(candidate)) {
    return Number.POSITIVE_INFINITY;
  }
  if (control > 1e-12) return (candidate - control) / control;
  return candidate <= control + 1e-12
    ? 0
    : Number.POSITIVE_INFINITY;
}

function baseScope(row) {
  const positiveCount = Number(row.positiveCount) || 0;
  if (positiveCount >= 200) return `species:${row.taxonId}`;
  if (positiveCount >= 120) return "group:positive_120_199";
  if (positiveCount >= 60) return "group:positive_60_119";
  if (positiveCount >= 30) return "group:positive_30_59";
  return null;
}

function profileScope(row) {
  const positiveCount = Number(row.positiveCount) || 0;
  if (positiveCount >= 200 && row.profileId) {
    return `species_profile:${row.taxonId}:${row.profileId}`;
  }
  return baseScope(row);
}

function attachProfiles(fold, contexts) {
  const profileByContext = new Map(
    contexts.map((context) => [
      Number(context.contextIndex),
      String(context.profileId)
    ])
  );
  if (
    profileByContext.size !== Number(fold.contextCount) ||
    profileByContext.size === 0
  ) {
    throw new SpatialProfileCalibrationError(
      "SPATIAL_PROFILE_CONTEXT_LAYOUT_MISMATCH",
      "特征上下文与邻居缓存 fold 布局不一致。"
    );
  }
  return {
    foldId: String(fold.outerFoldId),
    rows: fold.scoreRows.map((row) => {
      const profileId = profileByContext.get(Number(row.contextIndex));
      if (!profileId) {
        throw new SpatialProfileCalibrationError(
          "SPATIAL_PROFILE_CONTEXT_MISSING",
          "邻居评分行缺少对应的多尺度特征原型。",
          {
            outerFoldId: fold.outerFoldId,
            contextIndex: row.contextIndex
          }
        );
      }
      return { ...row, profileId };
    })
  };
}

function calibrationGroupFromPositiveCount(positiveCount) {
  const count = Number(positiveCount) || 0;
  if (count >= 120 && count < 200) {
    return "group:positive_120_199";
  }
  if (count >= 60 && count < 120) {
    return "group:positive_60_119";
  }
  if (count >= 30 && count < 60) {
    return "group:positive_30_59";
  }
  return null;
}

function fitScopeMap(
  trainingRows,
  targetRows,
  scopeForRow,
  mode
) {
  const targetPositiveByTaxon = new Map();
  for (const row of targetRows) {
    targetPositiveByTaxon.set(
      row.taxonId,
      Math.max(
        targetPositiveByTaxon.get(row.taxonId) || 0,
        Number(row.positiveCount) || 0
      )
    );
  }
  const targetScopes = new Set(targetRows.map(scopeForRow).filter(Boolean));
  const pointsByScope = new Map();
  for (const row of trainingRows) {
    const targetPositiveCount =
      targetPositiveByTaxon.get(row.taxonId);
    if (targetPositiveCount === undefined) continue;
    const scope =
      targetPositiveCount >= 200
        ? mode === "profile"
          ? row.profileId
            ? `species_profile:${row.taxonId}:${row.profileId}`
            : null
          : `species:${row.taxonId}`
        : calibrationGroupFromPositiveCount(
            targetPositiveCount
          );
    if (!scope || !targetScopes.has(scope)) continue;
    if (!pointsByScope.has(scope)) pointsByScope.set(scope, []);
    pointsByScope.get(scope).push({
      probability: row.rawProbability,
      positives: row.actualPositive,
      total: row.total
    });
  }
  return new Map(
    [...targetScopes].map((scope) => [
      scope,
      fitBetaCalibration(pointsByScope.get(scope) || [], {
        ridge:
          SPATIAL_PROFILE_CALIBRATION_CONTRACT.calibration.ridge
      })
    ])
  );
}

function crossFitFamily(folds, scopeForRow, familyId) {
  const mode =
    scopeForRow === profileScope ? "profile" : "base";
  const foldMaps = [];
  const scopeEntries = new Map();
  for (let heldout = 0; heldout < folds.length; heldout += 1) {
    const trainingRows = folds.flatMap((fold, index) =>
      index === heldout ? [] : fold.rows
    );
    const targetRows = folds[heldout].rows;
    const fitMap = fitScopeMap(
      trainingRows,
      targetRows,
      scopeForRow,
      mode
    );
    foldMaps.push(fitMap);
    for (const row of targetRows) {
      const scope = scopeForRow(row);
      if (!scope) continue;
      if (!scopeEntries.has(scope)) {
        scopeEntries.set(scope, {
          raw: [],
          candidate: [],
          fittedApplications: 0
        });
      }
      const fit = fitMap.get(scope) || null;
      const candidateProbability = calibrateProbability(
        row.rawProbability,
        fit
      );
      const entry = {
        foldId: folds[heldout].foldId,
        row,
        probability: row.rawProbability
      };
      scopeEntries.get(scope).raw.push(entry);
      scopeEntries.get(scope).candidate.push({
        ...entry,
        probability: candidateProbability
      });
      if (fit?.fitted) {
        scopeEntries.get(scope).fittedApplications += 1;
      }
    }
  }
  const acceptedScopes = new Set();
  const scopes = [];
  for (const [scope, entries] of scopeEntries) {
    const rawMetrics = evaluateCandidateRows(entries.raw);
    const candidateMetrics = evaluateCandidateRows(
      entries.candidate
    );
    const brierDegradation = relativeBrierDegradation(
      rawMetrics.brier,
      candidateMetrics.brier
    );
    const eceDegradation =
      candidateMetrics.ece - rawMetrics.ece;
    const accepted =
      entries.fittedApplications > 0 &&
      brierDegradation <=
        SPATIAL_PROFILE_CALIBRATION_CONTRACT.calibration
          .maximumRelativeBrierDegradation &&
      eceDegradation <=
        SPATIAL_PROFILE_CALIBRATION_CONTRACT.calibration
          .maximumEceDegradation;
    if (accepted) acceptedScopes.add(scope);
    scopes.push({
      scope,
      accepted,
      fittedApplications: entries.fittedApplications,
      rawBrier: rawMetrics.brier,
      candidateBrier: candidateMetrics.brier,
      relativeBrierDegradation: brierDegradation,
      rawEce: rawMetrics.ece,
      candidateEce: candidateMetrics.ece,
      eceDegradation
    });
  }
  const evaluatedFolds = folds.map((fold, index) => {
    const entries = fold.rows.map((row) => {
      const scope = scopeForRow(row);
      const fit =
        scope && acceptedScopes.has(scope)
          ? foldMaps[index].get(scope) || null
          : null;
      return {
        foldId: fold.foldId,
        row,
        probability: calibrateProbability(
          row.rawProbability,
          fit
        )
      };
    });
    return {
      foldId: fold.foldId,
      entries,
      metrics: evaluateCandidateRows(entries)
    };
  });
  const entries = evaluatedFolds.flatMap((fold) => fold.entries);
  return {
    familyId,
    entries,
    metrics: evaluateCandidateRows(entries),
    folds: evaluatedFolds.map(({ foldId, metrics }) => ({
      foldId,
      metrics
    })),
    acceptedScopeCount: acceptedScopes.size,
    rejectedScopeCount: scopes.length - acceptedScopes.size,
    scopes: scopes.sort((left, right) =>
      left.scope.localeCompare(right.scope)
    )
  };
}

function guardAgainstControl(control, candidate) {
  const controlFolds = new Map(
    control.folds.map((fold) => [fold.foldId, fold.metrics])
  );
  const folds = candidate.folds.map((fold) => {
    const baseline = controlFolds.get(fold.foldId);
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
          SPATIAL_PROFILE_CALIBRATION_CONTRACT.calibration
            .maximumRelativeBrierDegradation &&
        eceDegradation <=
          SPATIAL_PROFILE_CALIBRATION_CONTRACT.calibration
            .maximumEceDegradation
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
        SPATIAL_PROFILE_CALIBRATION_CONTRACT.calibration
          .maximumRelativeBrierDegradation &&
      pooledEceDegradation <=
        SPATIAL_PROFILE_CALIBRATION_CONTRACT.calibration
          .maximumEceDegradation,
    pooledBrierDegradation,
    pooledEceDegradation,
    folds
  };
}

function compactFamily(family) {
  return {
    familyId: family.familyId,
    acceptedScopeCount: family.acceptedScopeCount,
    rejectedScopeCount: family.rejectedScopeCount,
    metrics: compactMetrics(family.metrics),
    failures: spatialQualityFailures(family.metrics),
    folds: family.folds.map((fold) => ({
      foldId: fold.foldId,
      metrics: compactMetrics(fold.metrics)
    })),
    scopes: family.scopes
  };
}

function assertControlReproduction(control, v10Report) {
  const expected = v10Report?.releaseQuality?.spatial?.metrics;
  const comparisons = [
    ["brier", control.metrics.brier, expected?.brier],
    ["baselineBrier", control.metrics.baselineBrier, expected?.baselineBrier],
    ["brierSkill", control.metrics.brierSkill, expected?.brierSkill],
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
    ]
  ];
  const mismatches = comparisons
    .filter(([, actual, registered]) =>
      !Number.isFinite(Number(actual)) ||
      !Number.isFinite(Number(registered)) ||
      Math.abs(Number(actual) - Number(registered)) > 1e-12
    )
    .map(([key, actual, registered]) => ({
      key,
      actual,
      registered
    }));
  if (mismatches.length) {
    throw new SpatialProfileCalibrationError(
      "SPATIAL_PROFILE_CONTROL_REPRODUCTION_FAILED",
      "v11 control 无法精确复现 v10 正式空间指标。",
      { mismatches }
    );
  }
  return true;
}

function buildSpatialProfileCalibrationReport({
  neighborCache,
  featureCache,
  v10Report
}) {
  const folds = ["1", "2", "3", "4", "5"].map(
    (outerFoldId) => {
      const fold = neighborCache.readFold({ outerFoldId });
      const contexts = featureCache.readFoldContexts({
        outerFoldId
      });
      return attachProfiles(fold, contexts);
    }
  );
  const control = crossFitFamily(
    folds,
    baseScope,
    "existing_spatial_beta_calibration_control"
  );
  assertControlReproduction(control, v10Report);
  const candidate = crossFitFamily(
    folds,
    profileScope,
    SPATIAL_PROFILE_CALIBRATION_CONTRACT.id
  );
  const guard = guardAgainstControl(control, candidate);
  const controlMaximumSpeciesEce =
    control.metrics.calibrationEce.species.maximumEce;
  const candidateMaximumSpeciesEce =
    candidate.metrics.calibrationEce.species.maximumEce;
  const failures = spatialQualityFailures(candidate.metrics);
  const strictImprovement =
    candidateMaximumSpeciesEce < controlMaximumSpeciesEce - 1e-12;
  const runtimeIntegrationEligible =
    guard.accepted &&
    strictImprovement &&
    failures.length === 0;
  return {
    schemaVersion: SPATIAL_PROFILE_CALIBRATION_SCHEMA_VERSION,
    reportType:
      "zhejiang_spatial_profile_calibration_candidate_diagnostic",
    diagnosticOnly: true,
    developmentOnly: true,
    sealedPanelViewed: false,
    defaultModelModified: false,
    runtimeIntegrationEligible,
    implementationSha256:
      spatialProfileCalibrationImplementationSha256(),
    contract: {
      sha256: createHash("sha256")
        .update(canonicalJson(SPATIAL_PROFILE_CALIBRATION_CONTRACT))
        .digest("hex"),
      value: SPATIAL_PROFILE_CALIBRATION_CONTRACT
    },
    inputs: {
      neighborCacheSha256: neighborCache.fileSha256,
      featureCacheSha256: featureCache.fileSha256
    },
    control: compactFamily(control),
    candidate: {
      ...compactFamily(candidate),
      guard,
      strictWorstSpeciesEceImprovement: strictImprovement,
      maximumSpeciesEceDelta:
        candidateMaximumSpeciesEce - controlMaximumSpeciesEce
    },
    recommendation: {
      runtimeIntegrationEligible,
      nextAction: runtimeIntegrationEligible
        ? "prepare_frozen_runtime_integration_and_full_development_revalidation"
        : "stop_profile_calibration_path_and_reassess_feature_resolution",
      qualityGatesUnchanged: true,
      referenceMaterializationForbidden: true,
      sealedForbidden: true
    },
    limitations: [
      "development_diagnostic_only",
      "public_multiscale_profile_ids_only",
      "season_week_is_intentionally_excluded",
      "no_runtime_or_model_parameter_changes",
      "full_development_revalidation_required_after_runtime_integration",
      "sealed_forbidden_without_explicit_user_approval"
    ]
  };
}

function validateSpatialProfileCalibrationPreregistration(
  preregistration,
  {
    neighborCacheSha256,
    neighborCacheGenerationImplementationSha256,
    featureCacheSha256,
    v10ReportSha256,
    outputPath
  }
) {
  const failures = [];
  if (
    preregistration?.schemaVersion !== 1 ||
    preregistration?.kind !==
      "zhejiang_spatial_profile_calibration_v11_preregistration" ||
    preregistration?.status !==
      "frozen_before_single_development_diagnostic"
  ) {
    failures.push("identity");
  }
  if (
    canonicalJson(preregistration?.contract?.value) !==
      canonicalJson(SPATIAL_PROFILE_CALIBRATION_CONTRACT)
  ) {
    failures.push("contract.value");
  }
  const contractSha256 = createHash("sha256")
    .update(canonicalJson(SPATIAL_PROFILE_CALIBRATION_CONTRACT))
    .digest("hex");
  if (preregistration?.contract?.sha256 !== contractSha256) {
    failures.push("contract.sha256");
  }
  if (
    preregistration?.implementation?.scorerImplementationSha256 !==
    spatialProfileCalibrationImplementationSha256()
  ) {
    failures.push("implementation.scorerImplementationSha256");
  }
  for (const [key, expected] of Object.entries({
    neighborCacheSha256,
    neighborCacheGenerationImplementationSha256,
    featureCacheSha256,
    v10ReportSha256
  })) {
    if (preregistration?.inputs?.[key] !== expected) {
      failures.push(`inputs.${key}`);
    }
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
  if (failures.length) {
    throw new SpatialProfileCalibrationError(
      "SPATIAL_PROFILE_PREREGISTRATION_MISMATCH",
      "v11 空间原型校准预登记与冻结实现或输入不一致。",
      { failures: [...new Set(failures)].sort() }
    );
  }
  return true;
}

module.exports = {
  SPATIAL_PROFILE_CALIBRATION_CONTRACT,
  SPATIAL_PROFILE_CALIBRATION_FILES,
  SPATIAL_PROFILE_CALIBRATION_SCHEMA_VERSION,
  SpatialProfileCalibrationError,
  attachProfiles,
  baseScope,
  buildSpatialProfileCalibrationReport,
  crossFitFamily,
  profileScope,
  spatialProfileCalibrationImplementationSha256,
  validateSpatialProfileCalibrationPreregistration
};
