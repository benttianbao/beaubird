"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const {
  DEFAULT_OPTIONS,
  validateBuildSafetyOptions
} = require("./build-zhejiang-prediction-model");
const {
  boundarySummary,
  requiredTerrainTileIds,
  terrainFeatureGenerationImplementationSha256
} = require("./build-zhejiang-terrain-features");
const {
  loadHabitatFeatureSet
} = require("../server/prediction/habitat-features");
const {
  FROZEN_TERRAIN_QUALITY_GATES,
  TERRAIN_OOF_SCORER_IMPLEMENTATION_FILES,
  TERRAIN_PREREGISTRATION_FROZEN_STATE,
  terrainOofScorerImplementationSha256,
  validateOofDecision,
  validatePreregistration
} = require("../server/prediction/terrain-preregistration");
const {
  TERRAIN_SPATIAL_EVIDENCE_CONTRACT
} = require("../server/prediction/terrain-spatial-evidence");
const {
  CONTINUOUS_HABITAT_KERNEL_CONTRACT
} = require("../server/prediction/continuous-habitat");

const preregistration = JSON.parse(
  readFileSync(
    resolve(
      __dirname,
      "..",
      "docs",
      "zhejiang-v1-20260715-terrain-v11-preregistration.json"
    ),
    "utf8"
  )
);
const validated = validatePreregistration(
  preregistration
);
assert.equal(
  validated.state,
  TERRAIN_PREREGISTRATION_FROZEN_STATE
);
assert.equal(validated.readyForOof, true);
const worldCover = loadHabitatFeatureSet(
  resolve(
    __dirname,
    "..",
    preregistration.frozenInputs.worldCover.path
  ),
  {
    expectedSnapshotSha256:
      preregistration.frozenInputs.snapshot.sha256
  }
);
assert.deepEqual(
  requiredTerrainTileIds(
    worldCover.cells.map((cell) =>
      boundarySummary(cell.h3Index)
    )
  ),
  preregistration.demSource.requiredTileIds
);
assert.match(
  terrainFeatureGenerationImplementationSha256(),
  /^[a-f0-9]{64}$/
);
assert.deepEqual(
  preregistration.implementation.terrainOofScorerFiles,
  TERRAIN_OOF_SCORER_IMPLEMENTATION_FILES
);
assert.match(
  terrainOofScorerImplementationSha256(),
  /^[a-f0-9]{64}$/
);

assert.throws(
  () =>
    validatePreregistration({
      ...preregistration,
      qualityGates: {
        ...preregistration.qualityGates,
        maximumSpeciesEce: 0.06
      }
    }),
  (error) =>
    error.code === "TERRAIN_PREREGISTRATION_INVALID" &&
    error.details.failures.includes("qualityGates")
);

const decisionBindings = {
  cacheFileSha256: "0".repeat(64),
  snapshotSha256: "1".repeat(64),
  spatialSplitFileSha256: "2".repeat(64),
  terrainFeatureFileSha256: "3".repeat(64),
  terrainFeatureSetSha256: "4".repeat(64),
  preregistrationFileSha256: "5".repeat(64),
  controlReportFileSha256: "6".repeat(64),
  predictionImplementationSha256: "7".repeat(64),
  terrainOofCacheGenerationImplementationSha256:
    "8".repeat(64),
  terrainOofScorerImplementationSha256:
    "9".repeat(64)
};
const passingMetrics = {
  brier: 0.019,
  baselineBrier: 0.021,
  brierSkill: 0.09,
  ece: 0.01,
  recallAt20: 0.4,
  recallAt20Delta: 0,
  maximumSpeciesEce: 0.04,
  maximumGroupEce: 0.02,
  evaluatedWeight: 100,
  validationContexts: 10
};
const zeroDifferences = Object.fromEntries(
  Object.keys(passingMetrics).map((key) => [key, 0])
);
const comparisonScopes = [
  "pooled",
  "fold-1",
  "fold-2",
  "fold-3",
  "fold-4",
  "fold-5"
];
const goDecision = {
  schemaVersion: 1,
  kind: "zhejiang_true_terrain_v11_oof_decision",
  developmentOnly: true,
  diagnosticOnly: true,
  publishEligible: false,
  sealedPanelViewed: false,
  decision: "Go",
  goForFullSqliteBuild: true,
  goForPublication: false,
  protocol: {
    outerFoldCount: 5,
    innerFoldCount: 20,
    innerFoldRole:
      "fresh_strict_nested_completeness_and_diagnostics_only_no_candidate_selection_or_gate_tuning",
    candidateCount: 1,
    parameterSearch: false,
    postHocSpeciesCalibrationAdded: false
  },
  control: {
    passed: true,
    tolerance: 1e-12,
    failures: [],
    comparisons: comparisonScopes.map((scope) => ({
      scope,
      differences: zeroDifferences
    }))
  },
  candidate: {
    passed: true,
    gates: FROZEN_TERRAIN_QUALITY_GATES,
    failures: [],
    metrics: passingMetrics,
    folds: [1, 2, 3, 4, 5].map((foldId) => ({
      foldId: String(foldId),
      metrics: passingMetrics
    })),
    degradationComparisons: comparisonScopes.map(
      (scope) => ({
        scope,
        relativeBrierDegradation: 0,
        eceDegradation: 0
      })
    )
  },
  innerDiagnostics: {
    gateApplied: false,
    parameterSelectionApplied: false,
    candidate: {
      outerGroupCount: 5,
      innerFoldCount: 20,
      metrics: passingMetrics
    },
    control: {
      outerGroupCount: 5,
      innerFoldCount: 20,
      metrics: passingMetrics
    }
  },
  inputs: {
    cacheFileSha256:
      decisionBindings.cacheFileSha256,
    snapshotSha256:
      decisionBindings.snapshotSha256,
    spatialSplitFileSha256:
      decisionBindings.spatialSplitFileSha256,
    terrainFeatureFileSha256:
      decisionBindings.terrainFeatureFileSha256,
    terrainFeatureSetSha256:
      decisionBindings.terrainFeatureSetSha256,
    preregistrationFileSha256:
      decisionBindings.preregistrationFileSha256,
    v10ControlReportFileSha256:
      decisionBindings.controlReportFileSha256,
    predictionImplementationSha256:
      decisionBindings.predictionImplementationSha256,
    terrainOofCacheGenerationImplementationSha256:
      decisionBindings
        .terrainOofCacheGenerationImplementationSha256,
    terrainOofScorerImplementationSha256:
      decisionBindings
        .terrainOofScorerImplementationSha256
  }
};
assert.equal(
  validateOofDecision(goDecision, decisionBindings),
  true
);
assert.throws(
  () =>
    validateOofDecision(
      {
        ...goDecision,
        inputs: {
          ...goDecision.inputs,
          predictionImplementationSha256:
            "a".repeat(64)
        }
      },
      decisionBindings
    ),
  (error) =>
    error.code === "TERRAIN_OOF_DECISION_INVALID" &&
    error.details.failures.includes(
      "inputs.predictionImplementationSha256"
    )
);

const base = {
  ...DEFAULT_OPTIONS,
  testOnly: true,
  pointerPath: null,
  habitatFeaturesPath: "worldcover.json",
  habitatModel:
    CONTINUOUS_HABITAT_KERNEL_CONTRACT.id,
  terrainFeaturesPath: "terrain.json",
  terrainModel:
    TERRAIN_SPATIAL_EVIDENCE_CONTRACT.id,
  terrainPreregistrationPath: "preregistration.json",
  terrainControlReportPath: "v10.report.json",
  spatialSplitManifestPath: "split.json",
  spatialEvaluationPanel: "development"
};
assert.doesNotThrow(() =>
  validateBuildSafetyOptions({
    ...base,
    materializationProfile: "evaluation-only",
    writeTerrainOofCachePath: "terrain-oof.sqlite"
  })
);
assert.throws(
  () =>
    validateBuildSafetyOptions({
      ...base,
      materializationProfile: "full"
    }),
  (error) =>
    error.code === "TERRAIN_V11_BUILD_FORBIDDEN" &&
    error.details.failures.includes(
      "terrainOofDecisionPath.required_for_full"
    )
);
assert.doesNotThrow(() =>
  validateBuildSafetyOptions({
    ...base,
    materializationProfile: "full",
    terrainOofDecisionPath: "decision.json",
    terrainOofCachePath: "terrain-oof.sqlite"
  })
);

process.stdout.write(
  "terrain v11 preregistration tests passed\n"
);
