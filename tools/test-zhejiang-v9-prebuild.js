"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  probabilityFromAdminEvidence
} = require("../server/prediction/spatial-candidate-scorer");
const {
  CURRENT_HABITAT_EVIDENCE_CANDIDATE_ID,
  HABITAT_EVIDENCE_CANDIDATES,
  V9_FEATURE_CONTRACT_CANDIDATES,
  V9_NEIGHBOR_POLICY_CANDIDATES,
  assertPrebuildReportPrivacy,
  buildContinuousHabitatPrebuildReport,
  habitatEvidenceCandidateSetSha256,
  probabilityFromHabitatEvidenceCandidate,
  selectRobustCandidate,
  structuralCandidatePlanSha256
} = require("../server/prediction/continuous-habitat-prebuild");
const {
  parseArguments
} = require("./audit-zhejiang-continuous-habitat-v9-prebuild");

const BASE_CAPS = Object.freeze({
  rare_under_30: Object.freeze({ city: null, district: null }),
  group_30_79: Object.freeze({ city: null, district: null }),
  group_80_199: Object.freeze({ city: null, district: null }),
  species_200_plus: Object.freeze({ city: null, district: null })
});

function currentCandidate() {
  return HABITAT_EVIDENCE_CANDIDATES.find(
    (candidate) => candidate.id === CURRENT_HABITAT_EVIDENCE_CANDIDATE_ID
  );
}

function syntheticRow({
  contextIndex,
  taxonId,
  actualPositive,
  provinceDetections,
  habitatDetections
}) {
  const row = {
    contextIndex,
    taxonId,
    positiveCount: 300,
    developmentPositiveCount: 300,
    actualPositive,
    total: 10,
    baselineProbability: 0.5,
    deepestLevel: "province",
    hasSupportedLocalUnit: false,
    provinceExposure: 100,
    provinceDetections,
    cityExposure: 20,
    cityDetections: Math.min(20, provinceDetections / 4),
    cityStrength: 40,
    districtExposure: 12,
    districtDetections: Math.min(12, provinceDetections / 8),
    districtStrength: 30,
    habitatExposure: 24,
    habitatDetections,
    habitatStrength: 30,
    habitatNeighborCount: 24
  };
  row.rawProbability = probabilityFromAdminEvidence(
    row,
    BASE_CAPS.species_200_plus
  );
  return row;
}

function syntheticEvidence(foldId, contextOffset) {
  return {
    foldId,
    scoreRows: [
      syntheticRow({
        contextIndex: contextOffset,
        taxonId: "4356",
        actualPositive: 2,
        provinceDetections: 20,
        habitatDetections: 5
      }),
      syntheticRow({
        contextIndex: contextOffset,
        taxonId: "9988",
        actualPositive: 7,
        provinceDetections: 70,
        habitatDetections: 16
      })
    ]
  };
}

function syntheticCache() {
  const folds = Array.from({ length: 5 }, (_, outerIndex) => {
    const foldId = String(outerIndex + 1);
    const outer = syntheticEvidence(foldId, outerIndex + 1);
    return {
      ...outer,
      innerFolds: Array.from({ length: 4 }, (_, innerIndex) => {
        const innerFoldId = `${foldId}.${innerIndex + 1}`;
        return {
          ...syntheticEvidence(
            innerFoldId,
            100 + outerIndex * 10 + innerIndex
          ),
          innerFoldId
        };
      })
    };
  });
  return {
    fileSha256: "a".repeat(64),
    metadata: {
      panel: "development",
      diagnosticOnly: true,
      foldCount: 5,
      innerFoldCount: 20,
      outerRowCount: 10,
      innerRowCount: 40,
      sourceSnapshotSha256: "b".repeat(64),
      spatialSplitFileSha256: "c".repeat(64),
      spatialSplitManifestHash: "d".repeat(64),
      generationImplementationSha256: "e".repeat(64),
      predictionImplementationSha256: "f".repeat(64),
      baseAdminExposureCapsByPrevalence: BASE_CAPS,
      evidenceOptions: {
        continuousHabitatKernel: {
          id: "zhejiang_worldcover_hellinger_kernel_v1"
        }
      }
    },
    folds
  };
}

function metrics({
  brier,
  ece,
  maximumSpeciesEce
}) {
  return {
    brier,
    ece,
    calibrationEce: {
      species: { maximumEce: maximumSpeciesEce }
    }
  };
}

function evaluation(candidate, values) {
  return {
    candidate,
    metrics: metrics(values),
    folds: ["1", "2", "3", "4"].map((foldId) => ({
      foldId,
      metrics: metrics(values)
    })),
    failures: []
  };
}

test("v9 prebuild freezes a unique 12-cell cap-by-prior grid", () => {
  assert.equal(HABITAT_EVIDENCE_CANDIDATES.length, 12);
  assert.equal(
    new Set(HABITAT_EVIDENCE_CANDIDATES.map((candidate) => candidate.id)).size,
    12
  );
  assert.ok(currentCandidate());
  assert.equal(habitatEvidenceCandidateSetSha256().length, 64);
  assert.equal(structuralCandidatePlanSha256().length, 64);
  assert.equal(V9_NEIGHBOR_POLICY_CANDIDATES.length, 3);
  assert.equal(V9_FEATURE_CONTRACT_CANDIDATES.length, 3);
});

test("current cap and prior exactly reproduce the v8 scorer including uncapped admin evidence", () => {
  const row = syntheticRow({
    contextIndex: 1,
    taxonId: "4356",
    actualPositive: 2,
    provinceDetections: 20,
    habitatDetections: 5
  });
  assert.equal(
    probabilityFromHabitatEvidenceCandidate(row, BASE_CAPS, currentCandidate()),
    row.rawProbability
  );
  assert.throws(
    () =>
      probabilityFromHabitatEvidenceCandidate(row, BASE_CAPS, {
        ...currentCandidate(),
        exposureCap: 999
      }),
    { code: "CONTINUOUS_HABITAT_PREBUILD_CANDIDATE_INVALID" }
  );
});

test("robust selection is deterministic and rejects fold-level degradation", () => {
  const baseline = evaluation(currentCandidate(), {
    brier: 0.1,
    ece: 0.02,
    maximumSpeciesEce: 0.08
  });
  const challengerCandidate = HABITAT_EVIDENCE_CANDIDATES.find(
    (candidate) => candidate.id === "cap=5,prior=10"
  );
  const challenger = evaluation(challengerCandidate, {
    brier: 0.099,
    ece: 0.019,
    maximumSpeciesEce: 0.07
  });
  assert.equal(
    selectRobustCandidate([baseline, challenger]).selected.candidate.id,
    challengerCandidate.id
  );
  assert.equal(
    selectRobustCandidate([challenger, baseline]).selected.candidate.id,
    challengerCandidate.id
  );
  const degraded = evaluation(challengerCandidate, {
    brier: 0.2,
    ece: 0.04,
    maximumSpeciesEce: 0.01
  });
  assert.equal(
    selectRobustCandidate([baseline, degraded]).selected.candidate.id,
    CURRENT_HABITAT_EVIDENCE_CANDIDATE_ID
  );
});

test("privacy contract rejects nested private spatial identity", () => {
  assert.equal(assertPrebuildReportPrivacy({ taxonId: "4356" }), true);
  assert.throws(
    () =>
      assertPrebuildReportPrivacy({
        result: {
          coordinates: [120, 30]
        }
      }),
    { code: "CONTINUOUS_HABITAT_PREBUILD_PRIVACY_VIOLATION" }
  );
});

test("synthetic strict cache produces a deterministic diagnostic-only report", () => {
  const cache = syntheticCache();
  const first = buildContinuousHabitatPrebuildReport(cache);
  const second = buildContinuousHabitatPrebuildReport(cache);
  assert.deepEqual(first, second);
  assert.equal(first.diagnosticOnly, true);
  assert.equal(first.freezeEligible, false);
  assert.equal(first.sealedPanelViewed, false);
  assert.equal(first.defaultModelModified, false);
  assert.equal(first.referenceReproduction.passed, true);
  assert.equal(first.referenceReproduction.checkedOuterRows, 10);
  assert.equal(first.referenceReproduction.checkedInnerRows, 40);
  assert.equal(first.nestedSelection.heldoutOuterFoldCount, 5);
  assert.equal(first.exploratoryProductionSelection.mustNotFreeze, true);
  assert.equal(assertPrebuildReportPrivacy(first), true);
});

test("diagnostic CLI rejects any unregistered free parameter", () => {
  assert.throws(
    () => parseArguments(["--cache", "cache.sqlite", "--cap", "99"]),
    { code: "CONTINUOUS_HABITAT_PREBUILD_OPTIONS_INVALID" }
  );
});
