"use strict";

const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const { canonicalJson } = require("./spatial-splits");
const {
  TERRAIN_FEATURE_CONTRACT
} = require("./terrain-features");
const {
  TERRAIN_SPATIAL_EVIDENCE_CONTRACT,
  terrainSpatialEvidenceContractSha256
} = require("./terrain-spatial-evidence");
const {
  TERRAIN_OOF_PRIVACY_CONTRACT
} = require("./terrain-oof-cache");

const TERRAIN_PREREGISTRATION_KIND =
  "zhejiang_true_terrain_v11_preregistration";
const TERRAIN_PREREGISTRATION_PENDING_STATE =
  "awaiting_source_published_dem_files_and_feature_sha_binding";
const TERRAIN_PREREGISTRATION_FROZEN_STATE =
  "frozen_ready_for_oof";
const TERRAIN_OOF_SCORER_IMPLEMENTATION_FILES =
  Object.freeze([
    "tools/score-zhejiang-terrain-oof-v11.js"
  ]);
const FROZEN_SNAPSHOT_SHA256 =
  "92602be9b9c3aeb3d7c6cf966c459710a5a9bf6bc078e604a3805ab05fc0b16a";
const FROZEN_SPATIAL_SPLIT_SHA256 =
  "7deafec542c95b1463c92fe6948831247666a22923921b22890bb24adac9accc";
const FROZEN_WORLDCOVER_FILE_SHA256 =
  "085b134fc86124213c7abf8f0d813ef25489de1754c908ff98e384a1b189d451";
const FROZEN_WORLDCOVER_FEATURE_SET_SHA256 =
  "b2a3ae75832f7b5bd0830375691a8f727c7214b7cb3e149dfa1fe8236bcb99f5";
const FROZEN_V10_REPORT_SHA256 =
  "f05a353ecdd5350fff15975ab9f894c1e07ed7c8a5e9f3c99c46faeb4c137b33";
const FROZEN_DEFAULT_MODEL_SHA256 =
  "c4d8f759cdb9275b9d9171877d80b339e8796342dd262b380cf99360108ac582";
const FROZEN_DEM_SOURCE_CATALOG_FILE_SHA256 =
  "5b860b28e73730a5cf192b4fbf971454ffc491ed3feed0a409ff0674b37c9375";
const FROZEN_DEM_SOURCE_CATALOG_MANIFEST_SHA256 =
  "784255db378945d82a063cf6b300c1dc5a431bb7ad8997993ef8ac20dd18d6bb";
const FROZEN_SOURCE_UNAVAILABLE_TILE_IDS = Object.freeze([
  "N26_00_E121_00"
]);
const FROZEN_REQUIRED_TERRAIN_TILE_IDS = Object.freeze([
  "N26_00_E119_00",
  "N26_00_E120_00",
  "N26_00_E121_00",
  "N27_00_E117_00",
  "N27_00_E118_00",
  "N27_00_E119_00",
  "N27_00_E120_00",
  "N27_00_E121_00",
  "N28_00_E117_00",
  "N28_00_E118_00",
  "N28_00_E119_00",
  "N28_00_E120_00",
  "N28_00_E121_00",
  "N29_00_E117_00",
  "N29_00_E118_00",
  "N29_00_E119_00",
  "N29_00_E120_00",
  "N29_00_E121_00",
  "N29_00_E122_00",
  "N30_00_E118_00",
  "N30_00_E119_00",
  "N30_00_E120_00",
  "N30_00_E121_00",
  "N30_00_E122_00",
  "N31_00_E119_00",
  "N31_00_E120_00",
  "N31_00_E121_00"
]);
const FROZEN_TERRAIN_QUALITY_GATES = Object.freeze({
  maximumSpeciesEce: 0.05,
  maximumGroupEce: 0.1,
  maximumOverallEce: 0.1,
  minimumBrierSkillExclusive: 0,
  minimumRecallAt20Delta: -0.02,
  maximumRelativeBrierDegradationVsV10PerFoldAndPooled:
    0.01,
  maximumEceDegradationVsV10PerFoldAndPooled: 0.01,
  thresholdRelaxationAllowed: false
});

class TerrainPreregistrationError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "TerrainPreregistrationError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function canonicalSha256(value) {
  return createHash("sha256")
    .update(canonicalJson(value))
    .digest("hex");
}

function terrainFeatureContractSha256() {
  return canonicalSha256(TERRAIN_FEATURE_CONTRACT);
}

function terrainOofScorerImplementationSha256(
  projectRoot = resolve(__dirname, "..", "..")
) {
  const hash = createHash("sha256");
  for (const relativePath of [
    ...TERRAIN_OOF_SCORER_IMPLEMENTATION_FILES
  ].sort()) {
    hash.update(relativePath, "utf8");
    hash.update("\0", "utf8");
    hash.update(
      readFileSync(resolve(projectRoot, relativePath))
    );
    hash.update("\0", "utf8");
  }
  return hash.digest("hex");
}

function validatePreregistration(
  preregistration,
  {
    requireFrozen = false,
    terrainFeatureSet = null,
    preregistrationFileSha256 = null,
    controlReportFileSha256 = null,
    implementation = null
  } = {}
) {
  const failures = [];
  const requireEqual = (path, actual, expected) => {
    if (canonicalJson(actual) !== canonicalJson(expected)) {
      failures.push(path);
    }
  };
  requireEqual(
    "schemaVersion",
    preregistration?.schemaVersion,
    1
  );
  requireEqual(
    "kind",
    preregistration?.kind,
    TERRAIN_PREREGISTRATION_KIND
  );
  requireEqual(
    "modelVersion",
    preregistration?.modelVersion,
    "zhejiang-v1-20260715-development-terrain-v11"
  );
  requireEqual(
    "developmentOnly",
    preregistration?.developmentOnly,
    true
  );
  requireEqual(
    "publishEligible",
    preregistration?.publishEligible,
    false
  );
  requireEqual(
    "sealedPanelViewed",
    preregistration?.sealedPanelViewed,
    false
  );
  requireEqual(
    "referenceMaterialized",
    preregistration?.referenceMaterialized,
    false
  );
  requireEqual(
    "frozenInputs.snapshot.sha256",
    preregistration?.frozenInputs?.snapshot?.sha256,
    FROZEN_SNAPSHOT_SHA256
  );
  requireEqual(
    "frozenInputs.spatialSplits.sha256",
    preregistration?.frozenInputs?.spatialSplits?.sha256,
    FROZEN_SPATIAL_SPLIT_SHA256
  );
  requireEqual(
    "frozenInputs.spatialSplits.panel",
    preregistration?.frozenInputs?.spatialSplits?.panel,
    "development"
  );
  requireEqual(
    "frozenInputs.worldCover.sha256",
    preregistration?.frozenInputs?.worldCover?.sha256,
    FROZEN_WORLDCOVER_FILE_SHA256
  );
  requireEqual(
    "frozenInputs.worldCover.featureSetSha256",
    preregistration?.frozenInputs?.worldCover
      ?.featureSetSha256,
    FROZEN_WORLDCOVER_FEATURE_SET_SHA256
  );
  requireEqual(
    "frozenInputs.defaultModelReadOnlyGuard.sha256",
    preregistration?.frozenInputs
      ?.defaultModelReadOnlyGuard?.sha256,
    FROZEN_DEFAULT_MODEL_SHA256
  );
  requireEqual(
    "frozenInputs.v10ControlReport.sha256",
    preregistration?.frozenInputs?.v10ControlReport
      ?.sha256,
    FROZEN_V10_REPORT_SHA256
  );
  if (
    controlReportFileSha256 &&
    String(controlReportFileSha256).toLowerCase() !==
      FROZEN_V10_REPORT_SHA256
  ) failures.push("controlReportFileSha256");
  requireEqual(
    "demSource.datasetId",
    preregistration?.demSource?.datasetId,
    TERRAIN_FEATURE_CONTRACT.sourceDatasetId
  );
  requireEqual(
    "demSource.release",
    preregistration?.demSource?.release,
    TERRAIN_FEATURE_CONTRACT.sourceDatasetRelease
  );
  requireEqual(
    "demSource.horizontalCrs",
    preregistration?.demSource?.horizontalCrs,
    TERRAIN_FEATURE_CONTRACT.sourceHorizontalCrs
  );
  requireEqual(
    "demSource.verticalCrs",
    preregistration?.demSource?.verticalCrs,
    TERRAIN_FEATURE_CONTRACT.sourceVerticalCrs
  );
  requireEqual(
    "demSource.gridAlignment",
    preregistration?.demSource?.gridAlignment,
    TERRAIN_FEATURE_CONTRACT.sourceGridAlignment
  );
  requireEqual(
    "demSource.sourceCatalogFileSha256",
    preregistration?.demSource
      ?.sourceCatalogFileSha256,
    FROZEN_DEM_SOURCE_CATALOG_FILE_SHA256
  );
  requireEqual(
    "demSource.sourceCatalogManifestSha256",
    preregistration?.demSource
      ?.sourceCatalogManifestSha256,
    FROZEN_DEM_SOURCE_CATALOG_MANIFEST_SHA256
  );
  requireEqual(
    "demSource.requiredTileIds",
    preregistration?.demSource?.requiredTileIds,
    FROZEN_REQUIRED_TERRAIN_TILE_IDS
  );
  requireEqual(
    "demSource.sourceUnavailableTileIds",
    preregistration?.demSource
      ?.sourceUnavailableTileIds,
    FROZEN_SOURCE_UNAVAILABLE_TILE_IDS
  );
  requireEqual(
    "demSource.sourcePublishedTileCount",
    preregistration?.demSource
      ?.sourcePublishedTileCount,
    26
  );
  requireEqual(
    "demSource.sourceUnavailablePolicy",
    preregistration?.demSource
      ?.sourceUnavailablePolicy,
    "do_not_fill_with_glo90_or_zero; cells_below_frozen_sample_support_follow_the_missing_value_policy"
  );
  requireEqual(
    "terrainFeatureContract.contractId",
    preregistration?.terrainFeatureContract
      ?.contractId,
    TERRAIN_FEATURE_CONTRACT.id
  );
  requireEqual(
    "terrainFeatureContract.contractSha256",
    preregistration?.terrainFeatureContract
      ?.contractSha256,
    terrainFeatureContractSha256()
  );
  requireEqual(
    "terrainFeatureContract.features",
    preregistration?.terrainFeatureContract?.features,
    [
      "mean_elevation_m",
      "elevation_stddev_m",
      "mean_slope_deg"
    ]
  );
  requireEqual(
    "terrainFeatureContract.targetIndependent",
    preregistration?.terrainFeatureContract
      ?.targetIndependent,
    true
  );
  requireEqual(
    "terrainFeatureContract.labelIndependent",
    preregistration?.terrainFeatureContract
      ?.labelIndependent,
    true
  );
  requireEqual(
    "terrainFeatureContract.standardization",
    preregistration?.terrainFeatureContract
      ?.standardization,
    {
      population:
        "all_available_cells_in_frozen_5743_cell_public_h3_catalog",
      method: "population_mean_and_standard_deviation",
      minimumStandardDeviation: 1e-8,
      belowMinimumStandardDeviationDenominator: 1,
      clip: 6,
      fitPerFold: false
    }
  );
  requireEqual(
    "candidate.contractId",
    preregistration?.candidate?.contractId,
    TERRAIN_SPATIAL_EVIDENCE_CONTRACT.id
  );
  requireEqual(
    "candidate.contractSha256",
    preregistration?.candidate?.contractSha256,
    terrainSpatialEvidenceContractSha256()
  );
  requireEqual(
    "candidate.candidateCount",
    preregistration?.candidate?.candidateCount,
    1
  );
  requireEqual(
    "candidate.parameterSearch",
    preregistration?.candidate?.parameterSearch,
    false
  );
  requireEqual(
    "candidate.postHocSpeciesCalibrationAdded",
    preregistration?.candidate
      ?.postHocSpeciesCalibrationAdded,
    false
  );
  requireEqual(
    "candidate.integrationPoint",
    preregistration?.candidate?.integrationPoint,
    "continuous_habitat_neighbor_selection_and_weight_before_grid_r6_evidence"
  );
  requireEqual(
    "candidate.terrainBandwidth",
    preregistration?.candidate?.terrainBandwidth,
    1
  );
  requireEqual(
    "candidate.combinedWeight",
    preregistration?.candidate?.combinedWeight,
    "habitat_gaussian_weight_times_terrain_gaussian_weight"
  );
  requireEqual(
    "oofProtocol.outerFoldCount",
    preregistration?.oofProtocol?.outerFoldCount,
    5
  );
  requireEqual(
    "oofProtocol.innerFoldCount",
    preregistration?.oofProtocol?.innerFoldCount,
    20
  );
  requireEqual(
    "oofProtocol.innerFoldRole",
    preregistration?.oofProtocol?.innerFoldRole,
    "fresh_strict_nested_completeness_and_diagnostics_only_no_candidate_selection_or_gate_tuning"
  );
  requireEqual(
    "oofProtocol.privacyContract",
    preregistration?.oofProtocol?.privacyContract,
    TERRAIN_OOF_PRIVACY_CONTRACT
  );
  requireEqual(
    "qualityGates",
    preregistration?.qualityGates,
    FROZEN_TERRAIN_QUALITY_GATES
  );
  requireEqual(
    "controlReproduction.absoluteTolerance",
    preregistration?.controlReproduction
      ?.absoluteTolerance,
    1e-12
  );
  if (
    preregistration?.versionDefinition
      ?.forbiddenNextVersion !== "v13"
  ) failures.push("versionDefinition.forbiddenNextVersion");
  if (
    preregistration?.forbiddenInputsAndActions
      ?.includes("sealed_panel_access") !== true
  ) failures.push("forbiddenInputsAndActions");
  const state = preregistration?.state;
  if (
    ![
      TERRAIN_PREREGISTRATION_PENDING_STATE,
      TERRAIN_PREREGISTRATION_FROZEN_STATE
    ].includes(state)
  ) failures.push("state");
  if (
    requireFrozen &&
    state !== TERRAIN_PREREGISTRATION_FROZEN_STATE
  ) failures.push("state.not_frozen_ready_for_oof");
  requireEqual(
    "implementation.terrainOofScorerFiles",
    preregistration?.implementation
      ?.terrainOofScorerFiles,
    TERRAIN_OOF_SCORER_IMPLEMENTATION_FILES
  );
  const implementationHashKeys = [
    "predictionImplementationSha256",
    "terrainOofCacheGenerationImplementationSha256",
    "terrainOofScorerImplementationSha256"
  ];
  if (
    state === TERRAIN_PREREGISTRATION_PENDING_STATE
  ) {
    for (const key of implementationHashKeys) {
      if (
        preregistration?.implementation?.[key] !==
        null
      ) failures.push(`implementation.${key}.pending`);
    }
  } else if (
    state === TERRAIN_PREREGISTRATION_FROZEN_STATE
  ) {
    for (const key of implementationHashKeys) {
      if (
        !/^[a-f0-9]{64}$/.test(
          String(
            preregistration?.implementation?.[key] ||
              ""
          )
        )
      ) failures.push(`implementation.${key}`);
    }
    if (implementation) {
      for (const key of implementationHashKeys) {
        requireEqual(
          `implementation.${key}`,
          preregistration?.implementation?.[key],
          implementation[key]
        );
      }
    }
  }
  if (terrainFeatureSet) {
    const binding = preregistration?.terrainFeatureContract;
    requireEqual(
      "terrainFeatureContract.fileSha256",
      binding?.fileSha256,
      terrainFeatureSet.fileSha256
    );
    requireEqual(
      "terrainFeatureContract.featureSetSha256",
      binding?.featureSetSha256,
      terrainFeatureSet.featureSetSha256
    );
    requireEqual(
      "terrainFeatureContract.generationImplementationSha256",
      binding?.generationImplementationSha256,
      terrainFeatureSet
        .generationImplementationSha256
    );
    requireEqual(
      "demSource.tileManifestSha256",
      preregistration?.demSource
        ?.tileManifestSha256,
      terrainFeatureSet.tileManifestSha256
    );
    requireEqual(
      "terrainFeatureContract.cellCatalogFileSha256",
      binding?.cellCatalogFileSha256,
      terrainFeatureSet.cellCatalogFileSha256
    );
    requireEqual(
      "terrainFeatureContract.cellCatalogFeatureSetSha256",
      binding?.cellCatalogFeatureSetSha256,
      terrainFeatureSet
        .cellCatalogFeatureSetSha256
    );
  }
  if (
    state === TERRAIN_PREREGISTRATION_FROZEN_STATE
  ) {
    if (
      preregistration?.demSource?.downloadApproved !==
        true ||
      preregistration?.demSource?.downloadPerformed !==
        true
    ) failures.push("demSource.approval_and_download");
    const resolvedFiles =
      preregistration?.demSource?.resolvedFiles;
    const expectedResolvedTileIds =
      FROZEN_REQUIRED_TERRAIN_TILE_IDS.filter(
        (tileId) =>
          !FROZEN_SOURCE_UNAVAILABLE_TILE_IDS.includes(
            tileId
          )
      );
    if (
      !Array.isArray(resolvedFiles) ||
      resolvedFiles.length !== 26 ||
      resolvedFiles.some(
        (file) =>
          file?.fileName !==
            `Copernicus_DSM_10_${file?.tileId}_DEM.tif` ||
          !/^[a-f0-9]{64}$/.test(
            String(file?.sha256 || "")
          ) ||
          !Number.isInteger(Number(file?.bytes)) ||
          Number(file.bytes) <= 0
      ) ||
      canonicalJson(
        resolvedFiles.map((file) => file.tileId)
      ) !== canonicalJson(expectedResolvedTileIds)
    ) failures.push("demSource.resolvedFiles");
    requireEqual(
      "demSource.sourceUnavailableTiles",
      preregistration?.demSource
        ?.sourceUnavailableTiles,
      [
        {
          tileId: "N26_00_E121_00",
          status: "not_published_by_source"
        }
      ]
    );
    if (
      preregistrationFileSha256 &&
      !/^[a-f0-9]{64}$/.test(
        String(preregistrationFileSha256).toLowerCase()
      )
    ) failures.push("preregistrationFileSha256");
  }
  if (failures.length) {
    throw new TerrainPreregistrationError(
      "TERRAIN_PREREGISTRATION_INVALID",
      "真实 v11 地形预登记未通过冻结契约校验。",
      { failures }
    );
  }
  return {
    state,
    readyForOof:
      state === TERRAIN_PREREGISTRATION_FROZEN_STATE,
    privacyContract: TERRAIN_OOF_PRIVACY_CONTRACT
  };
}

function validateOofDecision(
  decision,
  {
    cacheFileSha256,
    snapshotSha256,
    spatialSplitFileSha256,
    terrainFeatureFileSha256,
    terrainFeatureSetSha256,
    preregistrationFileSha256,
    controlReportFileSha256,
    predictionImplementationSha256,
    terrainOofCacheGenerationImplementationSha256,
    terrainOofScorerImplementationSha256
  }
) {
  const failures = [];
  const requireEqual = (path, actual, expected) => {
    if (canonicalJson(actual) !== canonicalJson(expected)) {
      failures.push(path);
    }
  };
  requireEqual(
    "schemaVersion",
    decision?.schemaVersion,
    1
  );
  requireEqual(
    "kind",
    decision?.kind,
    "zhejiang_true_terrain_v11_oof_decision"
  );
  requireEqual(
    "developmentOnly",
    decision?.developmentOnly,
    true
  );
  requireEqual(
    "publishEligible",
    decision?.publishEligible,
    false
  );
  requireEqual(
    "diagnosticOnly",
    decision?.diagnosticOnly,
    true
  );
  requireEqual(
    "sealedPanelViewed",
    decision?.sealedPanelViewed,
    false
  );
  requireEqual("decision", decision?.decision, "Go");
  requireEqual(
    "goForFullSqliteBuild",
    decision?.goForFullSqliteBuild,
    true
  );
  requireEqual(
    "goForPublication",
    decision?.goForPublication,
    false
  );
  requireEqual(
    "control.passed",
    decision?.control?.passed,
    true
  );
  requireEqual(
    "candidate.passed",
    decision?.candidate?.passed,
    true
  );
  requireEqual(
    "protocol.outerFoldCount",
    decision?.protocol?.outerFoldCount,
    5
  );
  requireEqual(
    "protocol.innerFoldCount",
    decision?.protocol?.innerFoldCount,
    20
  );
  requireEqual(
    "protocol.innerFoldRole",
    decision?.protocol?.innerFoldRole,
    "fresh_strict_nested_completeness_and_diagnostics_only_no_candidate_selection_or_gate_tuning"
  );
  requireEqual(
    "protocol.candidateCount",
    decision?.protocol?.candidateCount,
    1
  );
  requireEqual(
    "protocol.parameterSearch",
    decision?.protocol?.parameterSearch,
    false
  );
  requireEqual(
    "protocol.postHocSpeciesCalibrationAdded",
    decision?.protocol?.postHocSpeciesCalibrationAdded,
    false
  );
  requireEqual(
    "candidate.gates",
    decision?.candidate?.gates,
    FROZEN_TERRAIN_QUALITY_GATES
  );
  for (const [key, expected] of Object.entries({
    cacheFileSha256,
    snapshotSha256,
    spatialSplitFileSha256,
    terrainFeatureFileSha256,
    terrainFeatureSetSha256,
    preregistrationFileSha256,
    v10ControlReportFileSha256:
      controlReportFileSha256,
    predictionImplementationSha256,
    terrainOofCacheGenerationImplementationSha256,
    terrainOofScorerImplementationSha256
  })) {
    requireEqual(
      `inputs.${key}`,
      decision?.inputs?.[key],
      expected
    );
  }
  requireEqual(
    "control.tolerance",
    decision?.control?.tolerance,
    1e-12
  );
  requireEqual(
    "control.failures",
    decision?.control?.failures,
    []
  );
  requireEqual(
    "candidate.failures",
    decision?.candidate?.failures,
    []
  );
  const metricKeys = [
    "brier",
    "baselineBrier",
    "brierSkill",
    "ece",
    "recallAt20",
    "recallAt20Delta",
    "maximumSpeciesEce",
    "maximumGroupEce",
    "evaluatedWeight",
    "validationContexts"
  ];
  const finiteMetrics = (path, metrics) => {
    for (const key of metricKeys) {
      if (!Number.isFinite(Number(metrics?.[key]))) {
        failures.push(`${path}.${key}`);
      }
    }
  };
  finiteMetrics(
    "candidate.metrics",
    decision?.candidate?.metrics
  );
  const candidateMetrics = decision?.candidate?.metrics;
  if (
    !(Number(candidateMetrics?.maximumSpeciesEce) <=
      FROZEN_TERRAIN_QUALITY_GATES.maximumSpeciesEce)
  ) failures.push("candidate.metrics.maximumSpeciesEce.gate");
  if (
    !(Number(candidateMetrics?.maximumGroupEce) <=
      FROZEN_TERRAIN_QUALITY_GATES.maximumGroupEce)
  ) failures.push("candidate.metrics.maximumGroupEce.gate");
  if (
    !(Number(candidateMetrics?.ece) <=
      FROZEN_TERRAIN_QUALITY_GATES.maximumOverallEce)
  ) failures.push("candidate.metrics.ece.gate");
  if (
    !(Number(candidateMetrics?.brierSkill) >
      FROZEN_TERRAIN_QUALITY_GATES.minimumBrierSkillExclusive)
  ) failures.push("candidate.metrics.brierSkill.gate");
  if (
    !(Number(candidateMetrics?.recallAt20Delta) >=
      FROZEN_TERRAIN_QUALITY_GATES.minimumRecallAt20Delta)
  ) failures.push("candidate.metrics.recallAt20Delta.gate");
  const candidateFolds = decision?.candidate?.folds;
  if (
    !Array.isArray(candidateFolds) ||
    candidateFolds.length !== 5
  ) {
    failures.push("candidate.folds");
  } else {
    for (const fold of candidateFolds) {
      finiteMetrics(
        `candidate.folds.${fold?.foldId}`,
        fold?.metrics
      );
    }
  }
  const degradationComparisons =
    decision?.candidate?.degradationComparisons;
  if (
    !Array.isArray(degradationComparisons) ||
    degradationComparisons.length !== 6
  ) {
    failures.push("candidate.degradationComparisons");
  } else {
    for (const comparison of degradationComparisons) {
      if (
        !Number.isFinite(
          Number(comparison?.relativeBrierDegradation)
        ) ||
        Number(comparison.relativeBrierDegradation) >
          FROZEN_TERRAIN_QUALITY_GATES
            .maximumRelativeBrierDegradationVsV10PerFoldAndPooled
      ) {
        failures.push(
          `candidate.degradationComparisons.${comparison?.scope}.brier`
        );
      }
      if (
        !Number.isFinite(
          Number(comparison?.eceDegradation)
        ) ||
        Number(comparison.eceDegradation) >
          FROZEN_TERRAIN_QUALITY_GATES
            .maximumEceDegradationVsV10PerFoldAndPooled
      ) {
        failures.push(
          `candidate.degradationComparisons.${comparison?.scope}.ece`
        );
      }
    }
  }
  const controlComparisons =
    decision?.control?.comparisons;
  if (
    !Array.isArray(controlComparisons) ||
    controlComparisons.length !== 6
  ) {
    failures.push("control.comparisons");
  } else {
    for (const comparison of controlComparisons) {
      for (const [metric, difference] of Object.entries(
        comparison?.differences || {}
      )) {
        if (
          !metricKeys.includes(metric) ||
          !Number.isFinite(Number(difference)) ||
          Number(difference) > 1e-12
        ) {
          failures.push(
            `control.comparisons.${comparison?.scope}.${metric}`
          );
        }
      }
      if (
        Object.keys(comparison?.differences || {})
          .length !== metricKeys.length
      ) {
        failures.push(
          `control.comparisons.${comparison?.scope}.metrics`
        );
      }
    }
  }
  requireEqual(
    "innerDiagnostics.gateApplied",
    decision?.innerDiagnostics?.gateApplied,
    false
  );
  requireEqual(
    "innerDiagnostics.parameterSelectionApplied",
    decision?.innerDiagnostics
      ?.parameterSelectionApplied,
    false
  );
  for (const channel of ["candidate", "control"]) {
    requireEqual(
      `innerDiagnostics.${channel}.outerGroupCount`,
      decision?.innerDiagnostics?.[channel]
        ?.outerGroupCount,
      5
    );
    requireEqual(
      `innerDiagnostics.${channel}.innerFoldCount`,
      decision?.innerDiagnostics?.[channel]
        ?.innerFoldCount,
      20
    );
    finiteMetrics(
      `innerDiagnostics.${channel}.metrics`,
      decision?.innerDiagnostics?.[channel]?.metrics
    );
  }
  if (failures.length) {
    throw new TerrainPreregistrationError(
      "TERRAIN_OOF_DECISION_INVALID",
      "完整 SQLite 构建未绑定通过全部固定门槛的真实 v11 OOF Go 决策。",
      { failures }
    );
  }
  return true;
}

module.exports = {
  FROZEN_DEFAULT_MODEL_SHA256,
  FROZEN_SNAPSHOT_SHA256,
  FROZEN_SPATIAL_SPLIT_SHA256,
  FROZEN_TERRAIN_QUALITY_GATES,
  FROZEN_V10_REPORT_SHA256,
  FROZEN_WORLDCOVER_FEATURE_SET_SHA256,
  FROZEN_WORLDCOVER_FILE_SHA256,
  TERRAIN_PREREGISTRATION_FROZEN_STATE,
  TERRAIN_PREREGISTRATION_KIND,
  TERRAIN_PREREGISTRATION_PENDING_STATE,
  TERRAIN_OOF_SCORER_IMPLEMENTATION_FILES,
  TerrainPreregistrationError,
  terrainFeatureContractSha256,
  terrainOofScorerImplementationSha256,
  validateOofDecision,
  validatePreregistration
};
