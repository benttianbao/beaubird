"use strict";

const assert = require("node:assert/strict");
const {
  chmodSync,
  existsSync,
  mkdtempSync,
  rmdirSync,
  unlinkSync
} = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const test = require("node:test");

const {
  CONTINUOUS_HABITAT_KERNEL_CONTRACT
} = require("../server/prediction/continuous-habitat");
const {
  NEIGHBOR_POLICY_DIAGNOSTIC_CONTRACT,
  aggregateContinuousHabitatNeighborPolicyEvidence,
  assertStructuralCandidateAlignment,
  neighborPolicyDiagnosticContractSha256,
  selectContinuousHabitatNeighborPolicies
} = require("../server/prediction/continuous-habitat-neighbor-policies");
const {
  EXPECTED_NEIGHBOR_POLICY_CACHE_LAYOUT,
  NEIGHBOR_POLICY_OOF_CACHE_KIND,
  NEIGHBOR_POLICY_OOF_CACHE_SCHEMA_VERSION,
  assertPrivacySafe,
  createNeighborPolicyOofCacheWriter,
  neighborPolicyOofCacheGenerationImplementationSha256,
  openNeighborPolicyOofCache,
  writeNeighborPolicyOofCache
} = require("../server/prediction/neighbor-policy-oof-cache");
const {
  buildNeighborPolicyCandidateReport,
  neighborPolicyCandidateScorerImplementationSha256,
  probabilityFromNeighborPolicyEvidence,
  validateNeighborPolicyScoringPreregistration
} = require("../server/prediction/neighbor-policy-candidate-scorer");
const {
  DEFAULT_OPTIONS,
  evaluationProbability,
  validateBuildSafetyOptions
} = require("./build-zhejiang-prediction-model");
const {
  parseArguments: parseScorerArguments
} = require("./score-zhejiang-neighbor-policy-oof-cache");

const BASE_ADMIN_CAPS = Object.freeze({
  rare_under_30: Object.freeze({ city: 100, district: 10 }),
  group_30_79: Object.freeze({ city: 100, district: 10 }),
  group_80_199: Object.freeze({ city: 100, district: 10 }),
  species_200_plus: Object.freeze({ city: 100, district: 10 })
});

function vector(openShare) {
  return [1 - openShare, openShare, 0, 0, 0];
}

function candidateFixture() {
  const candidates = [];
  for (let index = 1; index <= 30; index += 1) {
    candidates.push({
      unitId: `grid_r6:same-${String(index).padStart(2, "0")}`,
      cityName: "city:a",
      vector: vector(0.01 + index / 10000)
    });
    candidates.push({
      unitId: `grid_r6:other-${String(index).padStart(2, "0")}`,
      cityName: "city:b",
      vector: vector(0.03 + index / 10000)
    });
  }
  return candidates;
}

function selections() {
  return selectContinuousHabitatNeighborPolicies({
    targetUnitId: "grid_r6:target",
    targetCityName: "city:a",
    targetVector: vector(0.01),
    candidates: candidateFixture()
  });
}

function evidenceForTaxon(detectionRate) {
  return aggregateContinuousHabitatNeighborPolicyEvidence(selections(), {
    exposureForNeighbor: () => 10,
    detectionsForNeighbor: () => 10 * detectionRate
  });
}

function sourceRow({
  contextIndex,
  taxonId,
  positiveCount,
  actualPositive,
  detectionRate,
  total = 10
}) {
  const neighborPolicyEvidence = evidenceForTaxon(detectionRate);
  const control = neighborPolicyEvidence.find(
    (policy) => policy.policyId === "same_city_exclusive_v1"
  ).channels[0];
  const row = {
    contextIndex,
    taxonId,
    positiveCount,
    actualPositive,
    total,
    rawProbability: 0,
    baselineProbability: 0.2,
    deepestLevel: "habitat_continuous",
    hasSupportedLocalUnit: false,
    adminEvidence: {
      province: { exposure: 100, detections: 20, strength: 0 },
      city: { exposure: 40, detections: 9, strength: 24 },
      district: { exposure: 20, detections: 5, strength: 18 }
    },
    habitatEvidence: {
      exposure: control.exposure,
      detections: control.detections,
      neighborCount: control.neighborCount,
      strength: control.evidencePriorStrength
    },
    neighborPolicyEvidence
  };
  row.rawProbability = probabilityFromNeighborPolicyEvidence(
    {
      ...row,
      provinceExposure: row.adminEvidence.province.exposure,
      provinceDetections: row.adminEvidence.province.detections,
      cityExposure: row.adminEvidence.city.exposure,
      cityDetections: row.adminEvidence.city.detections,
      cityStrength: row.adminEvidence.city.strength,
      districtExposure: row.adminEvidence.district.exposure,
      districtDetections: row.adminEvidence.district.detections,
      districtStrength: row.adminEvidence.district.strength
    },
    BASE_ADMIN_CAPS,
    "same_city_exclusive_v1"
  );
  return row;
}

function foldFixture() {
  return Array.from({ length: 5 }, (_, outerIndex) => {
    const foldId = String(outerIndex + 1);
    const rows = [
      sourceRow({
        contextIndex: outerIndex,
        taxonId: "4356",
        positiveCount: 250,
        actualPositive: 2,
        detectionRate: 0.2
      }),
      sourceRow({
        contextIndex: outerIndex,
        taxonId: "4866",
        positiveCount: 300,
        actualPositive: 6,
        detectionRate: 0.6
      })
    ];
    return {
      foldId,
      evidenceConfiguration: { bandwidthDays: 14 },
      referenceRawMetrics: { brier: 0.1 },
      scoreRows: rows,
      innerFolds: Array.from({ length: 5 }, (_, index) => index + 1)
        .filter((innerFoldId) => innerFoldId !== Number(foldId))
        .map((innerFoldId) => ({
          innerFoldId: String(innerFoldId),
          trainingFoldIds: Array.from({ length: 5 }, (_, index) =>
            String(index + 1)
          ).filter(
            (trainingFoldId) =>
              trainingFoldId !== foldId &&
              trainingFoldId !== String(innerFoldId)
          ),
          evidenceConfiguration: { bandwidthDays: 14 },
          referenceRawMetrics: { brier: 0.1 },
          scoreRows: [
            sourceRow({
              contextIndex: outerIndex * 10 + innerFoldId,
              taxonId: "4356",
              positiveCount: 200,
              actualPositive: 2,
              detectionRate: 0.2
            }),
            sourceRow({
              contextIndex: outerIndex * 10 + innerFoldId,
              taxonId: "4866",
              positiveCount: 240,
              actualPositive: 6,
              detectionRate: 0.6
            })
          ]
        }))
    };
  });
}

function verifiedSplit() {
  return {
    panelName: "development",
    fileSha256: "b".repeat(64),
    manifestHash: "c".repeat(64),
    manifest: {
      sourceSnapshotSha256: "a".repeat(64)
    },
    panel: {
      folds: Array.from({ length: 5 }, (_, index) => ({
        foldId: String(index + 1)
      }))
    }
  };
}

function fixtureOptions(cachePath) {
  return {
    cachePath,
    verifiedSpatialSplit: verifiedSplit(),
    sourceSnapshotSha256: "a".repeat(64),
    generationImplementationSha256:
      neighborPolicyOofCacheGenerationImplementationSha256(),
    predictionImplementationSha256: "d".repeat(64),
    baseAdminExposureCapsByPrevalence: BASE_ADMIN_CAPS,
    qualityThresholds: {
      maximumSpeciesEce: 0.05
    },
    generationOptions: {
      contractId: NEIGHBOR_POLICY_DIAGNOSTIC_CONTRACT.id
    },
    developmentPoolPositiveCounts: new Map([
      ["4356", 300],
      ["4866", 350]
    ])
  };
}

function writeFixture(cachePath) {
  return writeNeighborPolicyOofCache({
    ...fixtureOptions(cachePath),
    folds: foldFixture()
  });
}

function writeStreamingFixture(cachePath, onFoldSetCommitted = null) {
  const writer = createNeighborPolicyOofCacheWriter({
    ...fixtureOptions(cachePath),
    onFoldSetCommitted
  });
  try {
    for (const outer of foldFixture()) {
      const outerScoreRows = outer.scoreRows;
      writer.appendFoldSet({
        outerFoldId: outer.foldId,
        innerFoldId: 0,
        trainingFoldIds: ["1", "2", "3", "4", "5"].filter(
          (foldId) => foldId !== outer.foldId
        ),
        evidenceConfiguration: outer.evidenceConfiguration,
        referenceRawMetrics: outer.referenceRawMetrics,
        scoreRows: outerScoreRows
      });
      outerScoreRows.length = 0;
      for (const inner of outer.innerFolds) {
        const innerScoreRows = inner.scoreRows;
        writer.appendFoldSet({
          outerFoldId: outer.foldId,
          innerFoldId: inner.innerFoldId,
          trainingFoldIds: inner.trainingFoldIds,
          evidenceConfiguration: inner.evidenceConfiguration,
          referenceRawMetrics: inner.referenceRawMetrics,
          scoreRows: innerScoreRows
        });
        innerScoreRows.length = 0;
      }
    }
    return writer.finalize();
  } catch (error) {
    writer.abort();
    throw error;
  }
}

function cleanupCache(path) {
  for (const file of [path, `${path}.sha256`]) {
    chmodSync(file, 0o666);
    unlinkSync(file);
  }
}

test("three executable policies stay aligned and broaden the same-city control", () => {
  assert.equal(assertStructuralCandidateAlignment(), true);
  assert.equal(neighborPolicyDiagnosticContractSha256().length, 64);
  const selected = selections();
  assert.deepEqual(
    selected.map((policy) => policy.policyId),
    [
      "same_city_exclusive_v1",
      "same_city_min8_fill_zhejiang_v1",
      "dual_channel_same_city_zhejiang_v1"
    ]
  );
  const control = selected[0].channels[0].neighbors;
  assert.equal(control.length, 24);
  assert.ok(control.every((neighbor) => neighbor.unitId.includes(":same-")));
  const fill = selected[1].channels[0].neighbors;
  assert.equal(fill.length, 24);
  assert.equal(
    fill.filter((neighbor) => neighbor.unitId.includes(":same-")).length,
    8
  );
  assert.equal(
    fill.filter((neighbor) => neighbor.unitId.includes(":other-")).length,
    16
  );
  assert.equal(selected[2].channels[0].neighbors.length, 24);
  assert.equal(selected[2].channels[1].neighbors.length, 24);
  assert.ok(
    selected.flatMap((policy) =>
      policy.channels.flatMap((channel) => channel.neighbors)
    ).every((neighbor) => neighbor.unitId !== "grid_r6:target")
  );
});

test("evaluation capture reproduces current habitat evidence exactly", () => {
  const selected = selections().map((policy) => ({
    policyId: policy.policyId,
    channels: policy.channels.map((channel) => ({
      channelId: channel.channelId,
      applicationOrder: channel.applicationOrder,
      evidenceExposureCap: channel.evidenceExposureCap,
      evidencePriorStrength: channel.evidencePriorStrength,
      neighbors: channel.neighbors.map((neighbor) => ({
        unitId: neighbor.unitId,
        weight: neighbor.weight
      }))
    }))
  }));
  const weekly = (value) => {
    const values = Array(53).fill(0);
    values[26] = value;
    return values;
  };
  const exposures = new Map([
    ["province:zhejiang", weekly(100)],
    ["city:a", weekly(40)],
    ["district:a", weekly(20)]
  ]);
  const hits = new Map([
    ["province:zhejiang\u00004356", weekly(20)],
    ["city:a\u00004356", weekly(9)],
    ["district:a\u00004356", weekly(5)]
  ]);
  for (const candidate of candidateFixture()) {
    exposures.set(candidate.unitId, weekly(10));
    hits.set(`${candidate.unitId}\u00004356`, weekly(2));
  }
  const result = evaluationProbability({
    context: {
      province_unit: "province:zhejiang",
      city_unit: "city:a",
      district_unit: "district:a",
      habitat_unit: null,
      grid_r6_unit: "grid_r6:target",
      grid_r7_unit: null,
      point_unit: null,
      season_week: 26,
      continuousHabitat: {
        scope: "same_city",
        neighbors: selected[0].channels[0].neighbors
      },
      continuousHabitatPolicies: selected
    },
    taxonId: "4356",
    taxonPositiveCount: 250,
    exposures,
    hits,
    supports: new Map([
      ["province:zhejiang", { checklists: 100, observers: 20 }],
      ["city:a", { checklists: 40, observers: 10 }],
      ["district:a", { checklists: 20, observers: 6 }]
    ]),
    bandwidthDays: 14,
    options: {
      ...DEFAULT_OPTIONS,
      habitatModel: CONTINUOUS_HABITAT_KERNEL_CONTRACT.id,
      continuousHabitatKernel: CONTINUOUS_HABITAT_KERNEL_CONTRACT
    },
    captureAdminEvidence: true,
    captureNeighborPolicyEvidence: true
  });
  const control = result.neighborPolicyEvidence[0].channels[0];
  assert.equal(control.exposure, result.habitatEvidence.exposure);
  assert.equal(control.detections, result.habitatEvidence.detections);
  assert.equal(control.neighborCount, result.habitatEvidence.neighborCount);
  assert.equal(
    control.evidencePriorStrength,
    result.habitatEvidence.strength
  );
});

test("strict builder safety rejects free or conflicting cache settings", () => {
  const options = {
    ...DEFAULT_OPTIONS,
    testOnly: true,
    sourceIsSnapshot: true,
    sourcePath: "snapshot.sqlite",
    snapshotPath: "snapshot.sqlite",
    workers: 4,
    pointerPath: null,
    materializationProfile: "evaluation-only",
    habitatFeaturesPath: "features.json",
    habitatModel: CONTINUOUS_HABITAT_KERNEL_CONTRACT.id,
    spatialSplitManifestPath: "split.json",
    spatialEvaluationPanel: "development",
    writeNeighborPolicyOofCachePath: "cache.sqlite",
    neighborPolicyPreregistrationPath: "preregistration.json"
  };
  assert.doesNotThrow(() => validateBuildSafetyOptions(options));
  assert.throws(
    () =>
      validateBuildSafetyOptions({
        ...options,
        writeSpatialOofCachePath: "other.sqlite"
      }),
    { code: "NEIGHBOR_POLICY_OOF_CACHE_BUILD_FORBIDDEN" }
  );
  assert.throws(
    () =>
      validateBuildSafetyOptions({
        ...options,
        neighborPolicyDiagnosticContract: {
          ...NEIGHBOR_POLICY_DIAGNOSTIC_CONTRACT,
          maximumDistance: 0.5
        }
      }),
    { code: "NEIGHBOR_POLICY_OOF_CACHE_BUILD_FORBIDDEN" }
  );
});

test("companion cache is deterministic, strict, privacy-safe, and fold-readable", () => {
  const directory = mkdtempSync(join(tmpdir(), "beaubird-neighbor-cache-"));
  const firstPath = join(directory, "first.sqlite");
  const secondPath = join(directory, "second.sqlite");
  try {
    const first = writeFixture(firstPath);
    const second = writeFixture(secondPath);
    assert.equal(first.fileSha256, second.fileSha256);
    assert.equal(first.schemaVersion, NEIGHBOR_POLICY_OOF_CACHE_SCHEMA_VERSION);
    assert.equal(first.cacheKind, NEIGHBOR_POLICY_OOF_CACHE_KIND);
    assert.equal(first.foldCount, 5);
    assert.equal(first.innerFoldCount, 20);
    assert.equal(first.outerRowCount, 10);
    assert.equal(first.innerRowCount, 40);
    assert.equal(first.evidenceRowCount, 200);
    const opened = openNeighborPolicyOofCache({
      cachePath: firstPath,
      verifiedSpatialSplit: verifiedSplit(),
      sourceSnapshotSha256: "a".repeat(64)
    });
    try {
      assert.equal(opened.foldSets.length, 25);
      assert.equal(opened.metadata.diagnosticOnly, true);
      const outer = opened.readFold({ outerFoldId: "1" });
      assert.equal(outer.scoreRows.length, 2);
      assert.deepEqual(
        outer.scoreRows[0].neighborPolicyEvidence.map(
          (policy) => policy.policyId
        ),
        [
          "same_city_exclusive_v1",
          "same_city_min8_fill_zhejiang_v1",
          "dual_channel_same_city_zhejiang_v1"
        ]
      );
      assert.equal(
        outer.scoreRows[0].neighborPolicyEvidence.reduce(
          (sum, policy) => sum + policy.channels.length,
          0
        ),
        4
      );
      assert.throws(
        () => opened.readFold({ outerFoldId: "9" }),
        { code: "NEIGHBOR_POLICY_OOF_CACHE_FOLD_UNKNOWN" }
      );
    } finally {
      opened.close();
    }
    assert.equal(assertPrivacySafe({ publicTaxonId: "4356" }), true);
    assert.throws(
      () => assertPrivacySafe({ nested: { unitId: "grid_r6:private" } }),
      { code: "NEIGHBOR_POLICY_OOF_CACHE_PRIVACY_VIOLATION" }
    );
  } finally {
    cleanupCache(firstPath);
    cleanupCache(secondPath);
    rmdirSync(directory);
  }
});

test("streaming writer commits one fold set at a time without retaining score rows", () => {
  const directory = mkdtempSync(join(tmpdir(), "beaubird-neighbor-stream-"));
  const firstPath = join(directory, "first.sqlite");
  const secondPath = join(directory, "second.sqlite");
  const commits = [];
  try {
    const first = writeStreamingFixture(firstPath, (commit) => {
      commits.push(commit);
    });
    const second = writeStreamingFixture(secondPath);
    assert.equal(commits.length, 25);
    assert.deepEqual(
      commits.map((commit) => commit.committedSetCount),
      Array.from({ length: 25 }, (_, index) => index + 1)
    );
    assert.equal(first.fileSha256, second.fileSha256);
    assert.equal(first.outerRowCount, 10);
    assert.equal(first.innerRowCount, 40);
    assert.equal(first.evidenceRowCount, 200);
    const opened = openNeighborPolicyOofCache({
      cachePath: firstPath,
      verifiedSpatialSplit: verifiedSplit(),
      sourceSnapshotSha256: "a".repeat(64)
    });
    try {
      assert.equal(opened.foldSets.length, 25);
      assert.equal(opened.readFold({ outerFoldId: "1" }).scoreRows.length, 2);
      assert.equal(
        opened.readFold({ outerFoldId: "5", innerFoldId: "4" })
          .scoreRows.length,
        2
      );
    } finally {
      opened.close();
    }
  } finally {
    cleanupCache(firstPath);
    cleanupCache(secondPath);
    rmdirSync(directory);
  }
});

test("streaming writer accepts fractional evaluation weight totals", () => {
  const directory = mkdtempSync(join(tmpdir(), "beaubird-neighbor-fractional-"));
  const cachePath = join(directory, "cache.sqlite");
  const folds = foldFixture();
  for (const outer of folds) {
    for (const row of outer.scoreRows) {
      row.total = 0.9621469923470252;
      row.actualPositive = Math.min(row.actualPositive / 10, row.total);
    }
    for (const inner of outer.innerFolds) {
      for (const row of inner.scoreRows) {
        row.total = 0.9621469923470252;
        row.actualPositive = Math.min(row.actualPositive / 10, row.total);
      }
    }
  }
  const result = writeNeighborPolicyOofCache({
    ...fixtureOptions(cachePath),
    folds
  });
  assert.equal(result.outerRowCount + result.innerRowCount, 50);
  const opened = openNeighborPolicyOofCache({
    cachePath,
    verifiedSpatialSplit: verifiedSplit(),
    sourceSnapshotSha256: "a".repeat(64)
  });
  try {
    assert.equal(
      opened.readFold({ outerFoldId: "1" }).scoreRows[0].total,
      0.9621469923470252
    );
  } finally {
    opened.close();
    cleanupCache(cachePath);
    rmdirSync(directory);
  }
});

test("streaming writer refuses incomplete publication and aborts cleanly", () => {
  const directory = mkdtempSync(join(tmpdir(), "beaubird-neighbor-abort-"));
  const cachePath = join(directory, "cache.sqlite");
  const writer = createNeighborPolicyOofCacheWriter(
    fixtureOptions(cachePath)
  );
  try {
    const outer = foldFixture()[0];
    writer.appendFoldSet({
      outerFoldId: outer.foldId,
      innerFoldId: 0,
      trainingFoldIds: ["2", "3", "4", "5"],
      evidenceConfiguration: outer.evidenceConfiguration,
      referenceRawMetrics: outer.referenceRawMetrics,
      scoreRows: outer.scoreRows
    });
    assert.throws(
      () => writer.finalize(),
      { code: "NEIGHBOR_POLICY_OOF_CACHE_FOLDS_INVALID" }
    );
  } finally {
    writer.abort();
    assert.equal(existsSync(cachePath), false);
    assert.equal(existsSync(`${cachePath}.sha256`), false);
    assert.equal(existsSync(writer.temporaryPath), false);
    rmdirSync(directory);
  }
});

test("streaming writer resumes committed fold transactions after interruption", () => {
  const directory = mkdtempSync(join(tmpdir(), "beaubird-neighbor-resume-"));
  const cachePath = join(directory, "cache.sqlite");
  const folds = foldFixture();
  const firstWriter = createNeighborPolicyOofCacheWriter(
    fixtureOptions(cachePath)
  );
  const firstOuter = folds[0];
  firstWriter.appendFoldSet({
    outerFoldId: firstOuter.foldId,
    innerFoldId: 0,
    trainingFoldIds: ["2", "3", "4", "5"],
    evidenceConfiguration: firstOuter.evidenceConfiguration,
    referenceRawMetrics: firstOuter.referenceRawMetrics,
    scoreRows: firstOuter.scoreRows
  });
  const checkpointPath = firstWriter.checkpointPath;
  const temporaryPath = firstWriter.temporaryPath;
  firstWriter.abort({ preserveCheckpoint: true });
  assert.equal(existsSync(checkpointPath), true);
  assert.equal(existsSync(temporaryPath), true);

  const resumed = createNeighborPolicyOofCacheWriter(
    fixtureOptions(cachePath)
  );
  try {
    assert.equal(resumed.resumed, true);
    assert.equal(
      resumed.hasFoldSet({ outerFoldId: "1", innerFoldId: 0 }),
      true
    );
    assert.equal(
      resumed.foldSetSummary({ outerFoldId: "1", innerFoldId: 0 })
        .scoreCount,
      2
    );
    for (const outer of folds) {
      const outerIdentity = {
        outerFoldId: outer.foldId,
        innerFoldId: 0
      };
      if (!resumed.hasFoldSet(outerIdentity)) {
        resumed.appendFoldSet({
          ...outerIdentity,
          trainingFoldIds: ["1", "2", "3", "4", "5"].filter(
            (foldId) => foldId !== outer.foldId
          ),
          evidenceConfiguration: outer.evidenceConfiguration,
          referenceRawMetrics: outer.referenceRawMetrics,
          scoreRows: outer.scoreRows
        });
      }
      for (const inner of outer.innerFolds) {
        const identity = {
          outerFoldId: outer.foldId,
          innerFoldId: inner.innerFoldId
        };
        if (resumed.hasFoldSet(identity)) continue;
        resumed.appendFoldSet({
          ...identity,
          trainingFoldIds: inner.trainingFoldIds,
          evidenceConfiguration: inner.evidenceConfiguration,
          referenceRawMetrics: inner.referenceRawMetrics,
          scoreRows: inner.scoreRows
        });
      }
    }
    const result = resumed.finalize();
    assert.equal(result.outerRowCount, 10);
    assert.equal(result.innerRowCount, 40);
    assert.equal(existsSync(checkpointPath), false);
    assert.equal(existsSync(temporaryPath), false);
  } finally {
    if (existsSync(cachePath)) cleanupCache(cachePath);
    if (existsSync(temporaryPath) || existsSync(checkpointPath)) {
      resumed.abort();
    }
    rmdirSync(directory);
  }
});

test("candidate scorer reproduces the control and emits a development-only decision", () => {
  const directory = mkdtempSync(join(tmpdir(), "beaubird-neighbor-score-"));
  const cachePath = join(directory, "cache.sqlite");
  try {
    writeFixture(cachePath);
    const opened = openNeighborPolicyOofCache({
      cachePath,
      verifiedSpatialSplit: verifiedSplit(),
      sourceSnapshotSha256: "a".repeat(64)
    });
    try {
      const report = buildNeighborPolicyCandidateReport(opened);
      assert.equal(report.generatedAt, undefined);
      assert.equal(report.diagnosticOnly, true);
      assert.equal(report.freezeEligible, false);
      assert.equal(report.sealedPanelViewed, false);
      assert.equal(report.defaultModelModified, false);
      assert.equal(report.controlReproduction.checkedRows, 50);
      assert.equal(
        report.controlReproduction.maximumAbsoluteDifference,
        0
      );
      assert.equal(
        report.scorerImplementationSha256,
        neighborPolicyCandidateScorerImplementationSha256()
      );
      assert.equal(report.nestedSelection.folds.length, 5);
      assert.equal(
        report.exploratoryProductionSelection.mustNotFreeze,
        true
      );
      assert.equal(assertPrivacySafe(report), true);
    } finally {
      opened.close();
    }
  } finally {
    cleanupCache(cachePath);
    rmdirSync(directory);
  }
});

test("scoring preregistration and CLI reject drift or free parameters", () => {
  const directory = mkdtempSync(join(tmpdir(), "beaubird-neighbor-prereg-"));
  const cachePath = join(directory, "cache.sqlite");
  const outputPath = join(directory, "diagnostic.json");
  try {
    writeFixture(cachePath);
    const opened = openNeighborPolicyOofCache({
      cachePath,
      verifiedSpatialSplit: verifiedSplit(),
      sourceSnapshotSha256: "a".repeat(64)
    });
    try {
      const preregistration = {
        schemaVersion: 1,
        kind: "zhejiang_neighbor_policy_oof_cache_v9_preregistration",
        status: "frozen_before_single_long_development_cache_build",
        implementation: {
          scorerImplementationSha256:
            neighborPolicyCandidateScorerImplementationSha256(),
          cacheGenerationImplementationSha256:
            opened.metadata.generationImplementationSha256,
          predictionImplementationSha256:
            opened.metadata.predictionImplementationSha256
        },
        contract: {
          sha256: opened.metadata.contractSha256,
          value: NEIGHBOR_POLICY_DIAGNOSTIC_CONTRACT
        },
        inputs: {
          sourceSnapshotSha256:
            opened.metadata.sourceSnapshotSha256,
          spatialSplitFileSha256:
            opened.metadata.spatialSplitFileSha256,
          spatialSplitManifestHash:
            opened.metadata.spatialSplitManifestHash
        },
        expectedLayout: EXPECTED_NEIGHBOR_POLICY_CACHE_LAYOUT,
        outputs: { cachePath },
        scoring: {
          schemaVersion: 1,
          outputPath,
          outputMustNotExistBeforeRun: true,
          diagnosticOnly: true,
          freezeEligible: false
        },
        stopPolicy: {
          sealedForbidden: true,
          defaultModelOverwriteForbidden: true,
          referenceMaterializationForbidden: true
        }
      };
      const validationCache = {
        ...opened,
        metadata: {
          ...opened.metadata,
          foldCount:
            EXPECTED_NEIGHBOR_POLICY_CACHE_LAYOUT.outerFoldCount,
          innerFoldCount:
            EXPECTED_NEIGHBOR_POLICY_CACHE_LAYOUT.innerFoldCount,
          outerRowCount:
            EXPECTED_NEIGHBOR_POLICY_CACHE_LAYOUT.outerScoreRows,
          innerRowCount:
            EXPECTED_NEIGHBOR_POLICY_CACHE_LAYOUT.innerScoreRows,
          evidenceRowCount:
            EXPECTED_NEIGHBOR_POLICY_CACHE_LAYOUT.neighborDetectionRows
        }
      };
      assert.equal(
        validateNeighborPolicyScoringPreregistration(
          preregistration,
          { cache: validationCache, cachePath, outputPath }
        ),
        true
      );
      assert.throws(
        () =>
          validateNeighborPolicyScoringPreregistration(
            {
              ...preregistration,
              scoring: {
                ...preregistration.scoring,
                outputPath: join(directory, "other.json")
              }
            },
            { cache: validationCache, cachePath, outputPath }
          ),
        { code: "NEIGHBOR_POLICY_SCORING_PREREGISTRATION_MISMATCH" }
      );
    } finally {
      opened.close();
    }
    assert.throws(
      () =>
        parseScorerArguments([
          "--cache",
          cachePath,
          "--cap",
          "20"
        ]),
      { code: "NEIGHBOR_POLICY_SCORER_OPTIONS_INVALID" }
    );
  } finally {
    cleanupCache(cachePath);
    rmdirSync(directory);
  }
});
