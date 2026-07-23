"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const test = require("node:test");

const {
  DEVELOPMENT_POOL_POSITIVE_COUNT_POLICY,
  INNER_TRAINING_POSITIVE_COUNT_POLICY,
  OUTER_TRAINING_POSITIVE_COUNT_POLICY,
  candidateSetSha256
} = require("../server/prediction/spatial-oof-cache");
const {
  DEFAULT_CALIBRATOR_FAMILIES,
  SPATIAL_CALIBRATION_GUARD,
  SPATIAL_ERROR_AUDIT_CONTRACT,
  buildSpatialErrorAudit,
  evaluateCandidateRows,
  probabilityFromAdminEvidence,
  baselineProbabilityFromAdminEvidence,
  scoreSpatialOofCandidates,
  spatialQualityFailures
} = require("../server/prediction/spatial-candidate-scorer");
const {
  FROZEN_NOVEL_GRID_ADMIN_EXPOSURE_CAPS_V1
} = require("../server/prediction/spatial-transfer");
const {
  RANKING_REFERENCE_CONTRACT,
  RANKING_REFERENCE_CONTRACT_SHA256
} = require("../server/prediction/ranking-reference");
const { canonicalJson } = require("../server/prediction/spatial-splits");
const { prevalenceGroup } = require("../server/prediction/model");
const { parseArguments } = require("./score-zhejiang-spatial-oof-cache");

const EXPECTED_CAP_POLICY = Object.freeze({
  strategy: "strict_nested_near_optimal_0.1pct_minimax_regret_5pct_fallback_v2",
  maximumRelativePooledBrierRegret: 0.001,
  maximumFoldRelativeBrierRegret: 0.05
});
const EXPECTED_ROBUST_SCOPE_POLICY = Object.freeze({
  strategy: "strict_nested_every_fold_guard_minimax_ece_v2",
  requireEveryFoldGuard: true,
  requireWorstFoldEceNonDegradation: true
});
const EXPECTED_SELECTION_STRATEGY = "strict_nested_scope_adaptive_fixed_v2";

function makeRow({
  contextIndex,
  taxonId,
  positiveCount,
  outerPositiveCount,
  developmentPositiveCount,
  kind,
  taxonIndex,
  foldIndex
}) {
  const total = 10;
  const provinceExposure = 100;
  const provinceDetections = kind === "ordinary" ? 3 + (taxonIndex % 15) : 10;
  const cityExposure = 1000;
  const districtExposure = 1000;
  const high = kind === "common-high";
  const low = kind === "common-low";
  const cityDetections = high || low ? 900 : 20 + (taxonIndex % 12) * 55;
  const districtDetections = high || low ? 900 : 10 + (taxonIndex % 10) * 65;
  const row = {
    contextIndex,
    taxonId,
    positiveCount,
    ...(outerPositiveCount === undefined ? {} : { outerPositiveCount }),
    developmentPositiveCount,
    actualPositive: high ? 9 : low ? 1 : (taxonIndex + contextIndex + foldIndex) % 6,
    total,
    rawProbability: 0,
    baselineProbability: 0,
    deepestLevel: "district",
    hasSupportedLocalUnit: false,
    provinceExposure,
    provinceDetections,
    cityExposure,
    cityDetections,
    cityStrength: positiveCount >= 200 ? 24 : 30,
    districtExposure,
    districtDetections,
    districtStrength: positiveCount >= 200 ? 18 : 22
  };
  const baseCaps = FROZEN_NOVEL_GRID_ADMIN_EXPOSURE_CAPS_V1[prevalenceGroup(positiveCount)];
  row.rawProbability = probabilityFromAdminEvidence(row, baseCaps);
  row.baselineProbability = baselineProbabilityFromAdminEvidence(row);
  return row;
}

function makeCache() {
  const taxa = [
    { taxonId: "common-low", positiveCount: 500, developmentPositiveCount: 520, kind: "common-low" },
    { taxonId: "common-high", positiveCount: 600, developmentPositiveCount: 620, kind: "common-high" },
    { taxonId: "boundary-common", positiveCount: 190, developmentPositiveCount: 205, kind: "ordinary" },
    ...Array.from({ length: 19 }, (_, index) => ({
      taxonId: `ordinary-${String(index + 1).padStart(2, "0")}`,
      positiveCount: 100,
      developmentPositiveCount: 120,
      kind: "ordinary"
    }))
  ];
  return {
    fileSha256: "f".repeat(64),
    metadata: {
      panel: "development",
      diagnosticOnly: true,
      candidateSetSha256: candidateSetSha256(),
      developmentPoolPositiveCountPolicy: DEVELOPMENT_POOL_POSITIVE_COUNT_POLICY,
      outerTrainingPositiveCountPolicy: OUTER_TRAINING_POSITIVE_COUNT_POLICY,
      innerTrainingPositiveCountPolicy: INNER_TRAINING_POSITIVE_COUNT_POLICY,
      baseAdminExposureCapsByPrevalence: FROZEN_NOVEL_GRID_ADMIN_EXPOSURE_CAPS_V1,
      sourceSnapshotSha256: "a".repeat(64),
      spatialSplitFileSha256: "b".repeat(64),
      spatialSplitManifestHash: "c".repeat(64),
      evidenceContractSha256: "d".repeat(64),
      generationImplementationSha256: "e".repeat(64),
      predictionImplementationSha256: "1".repeat(64)
    },
    folds: Array.from({ length: 5 }, (_, foldIndex) => {
      const foldId = String(foldIndex + 1);
      const scoreRows = Array.from({ length: 3 }, (_, contextIndex) =>
        taxa.map((taxon, taxonIndex) => makeRow({
          contextIndex,
          taxonId: taxon.taxonId,
          positiveCount: taxon.positiveCount,
          developmentPositiveCount: taxon.developmentPositiveCount,
          kind: taxon.kind,
          taxonIndex,
          foldIndex
        }))
      ).flat();
      const innerFolds = Array.from({ length: 5 }, (_, innerFoldIndex) => String(innerFoldIndex + 1))
        .filter((innerFoldId) => innerFoldId !== foldId)
        .map((innerFoldId) => {
          const innerFoldIndex = Number(innerFoldId) - 1;
          return {
            innerFoldId,
            trainingFoldIds: ["1", "2", "3", "4", "5"]
              .filter((candidate) => candidate !== foldId && candidate !== innerFoldId),
            scoreRows: Array.from({ length: 3 }, (_, contextIndex) =>
              taxa.map((taxon, taxonIndex) => {
                const innerPositiveCount = Math.max(
                  0,
                  taxon.positiveCount - 20 - ((foldIndex + innerFoldIndex) % 3)
                );
                return makeRow({
                  contextIndex,
                  taxonId: taxon.taxonId,
                  positiveCount: innerPositiveCount,
                  outerPositiveCount: taxon.positiveCount,
                  developmentPositiveCount: taxon.developmentPositiveCount,
                  kind: taxon.kind,
                  taxonIndex,
                  foldIndex: foldIndex * 5 + innerFoldIndex
                });
              })
            ).flat()
          };
        });
      return {
        foldId,
        referenceRawMetrics: evaluateCandidateRows(scoreRows.map((row) => ({
          foldId,
          row,
          probability: row.rawProbability
        }))),
        scoreRows,
        innerFolds
      };
    })
  };
}

function deterministicProjection(report) {
  const clone = structuredClone(report);
  delete clone.generatedAt;
  delete clone.scoring.workers;
  return clone;
}

function recomputeReferenceRawMetrics(fold) {
  fold.referenceRawMetrics = evaluateCandidateRows(fold.scoreRows.map((row) => ({
    foldId: String(fold.foldId),
    row,
    probability: row.rawProbability
  })));
}

function canonicalSha256(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function assertCandidateManifest(report) {
  const manifest = report.scoring.fixedCandidateManifest;
  assert.ok(manifest);
  const { sha256, ...payload } = manifest;
  assert.match(sha256, /^[0-9a-f]{64}$/);
  assert.equal(sha256, canonicalSha256(payload));
  assert.deepEqual(payload, {
    selectionStrategy: EXPECTED_SELECTION_STRATEGY,
    capCandidateSetSha256: candidateSetSha256(),
    capCandidateCount: 25,
    capPolicy: EXPECTED_CAP_POLICY,
    calibratorFamilies: DEFAULT_CALIBRATOR_FAMILIES,
    calibrationGuard: SPATIAL_CALIBRATION_GUARD,
    robustScopeSelectionPolicy: EXPECTED_ROBUST_SCOPE_POLICY,
    rankingReferenceContract: RANKING_REFERENCE_CONTRACT
  });
  assert.equal(report.scoring.candidateSetSha256, payload.capCandidateSetSha256);
  assert.equal(report.scoring.candidateCount, payload.capCandidateCount);
  assert.equal(report.scoring.calibratorCandidateCount, payload.calibratorFamilies.length);
  assert.equal(report.scoring.fixedCandidateSetSha256, sha256);
  assert.equal(report.crossFittedSelection.fixedCandidateSetSha256, sha256);
}

function assertInnerFoldProvenance(container, selectionFoldIds, allFoldIds) {
  const selected = [...selectionFoldIds].map(String).sort();
  const all = [...allFoldIds].map(String).sort();
  assert.ok(selected.every((foldId) => all.includes(foldId)));
  assert.equal(container.cachedEvidenceRebuiltForInnerFolds, true);
  assert.ok(Array.isArray(container.innerFolds));
  assert.deepEqual(container.innerFolds.map((fold) => fold.heldoutFoldId), selected);
  for (const innerFold of container.innerFolds) {
    assert.deepEqual(
      innerFold.trainingFoldIds,
      selected.filter((foldId) => foldId !== innerFold.heldoutFoldId)
    );
    assert.equal(Object.hasOwn(innerFold, "cachedEvidenceTrainingFoldIds"), false);
    assert.equal(innerFold.trainingFoldIds.includes(innerFold.heldoutFoldId), false);
  }
}

function assertFoldSelectionHashes(fold) {
  assert.match(fold.selectionSha256, /^[0-9a-f]{64}$/);
  assert.match(fold.validationSha256, /^[0-9a-f]{64}$/);
  const selectionRecord = structuredClone(fold);
  delete selectionRecord.selectionSha256;
  delete selectionRecord.metrics;
  delete selectionRecord.validationSha256;
  assert.equal(fold.selectionSha256, canonicalSha256(selectionRecord));
  assert.equal(fold.validationSha256, canonicalSha256(fold.metrics));
}

function assertFamilyStrengthProvenance(report, fold) {
  const familiesById = new Map(report.calibratorFamilies.map(({ family }) => [family.id, family]));
  assert.equal(familiesById.size, DEFAULT_CALIBRATOR_FAMILIES.length);
  for (const family of DEFAULT_CALIBRATOR_FAMILIES) {
    assert.deepEqual(familiesById.get(family.id), family);
    assert.ok(Number.isFinite(family.ridge));
    assert.ok(Number.isFinite(family.shrinkage));
    assert.ok(family.shrinkage >= 0 && family.shrinkage <= 1);
  }
  for (const scope of fold.scopeSelections) {
    const family = familiesById.get(scope.familyId);
    assert.ok(family, `unknown calibrator family ${scope.familyId}`);
    assert.deepEqual(scope.family, family);
    if (scope.accepted) {
      assert.equal(scope.fit?.fitted, true, scope.scope);
      assert.equal(scope.fit.shrinkage, family.shrinkage, scope.scope);
    } else {
      assert.equal(scope.fit, null, scope.scope);
    }
  }
}

function crossFittedFold(report, heldoutFoldId) {
  const selection = report.crossFittedSelection;
  assert.ok(selection, "report must expose cross-fitted selection provenance");
  assert.equal(selection.fitFoldCount, 4);
  assert.equal(selection.heldoutFoldCount, 5);
  assert.equal(selection.strategy, EXPECTED_SELECTION_STRATEGY);
  assertCandidateManifest(report);
  assert.ok(Array.isArray(selection.folds));
  assert.equal(selection.folds.length, 5);
  assert.ok(selection.production);
  const fold = selection.folds.find((entry) => entry.heldoutFoldId === String(heldoutFoldId));
  assert.ok(fold, `missing cross-fitted selection for fold ${heldoutFoldId}`);
  assertInnerFoldProvenance(
    fold,
    fold.trainingFoldIds,
    selection.folds.map((entry) => entry.heldoutFoldId)
  );
  assertFoldSelectionHashes(fold);
  assert.ok(fold.capPolicy);
  assert.equal(fold.capPolicy.strategy, EXPECTED_CAP_POLICY.strategy);
  assert.equal(
    fold.capPolicy.maximumRelativePooledBrierRegret,
    EXPECTED_CAP_POLICY.maximumRelativePooledBrierRegret
  );
  assert.equal(
    fold.capPolicy.maximumFoldRelativeBrierRegret,
    EXPECTED_CAP_POLICY.maximumFoldRelativeBrierRegret
  );
  assert.ok(Array.isArray(fold.capPolicy.speciesCaps));
  assert.deepEqual(fold.capPolicy.trainingFoldIds, fold.trainingFoldIds);
  assert.ok(fold.capPolicy.speciesCaps.length > 0);
  assert.ok(fold.capPolicy.speciesCaps.every((species) =>
    typeof species.taxonId === "string" &&
    typeof species.selectedCandidateId === "string" &&
    species.caps && typeof species.caps === "object"
  ));
  assert.ok(Array.isArray(fold.scopeSelections));
  assert.ok(fold.scopeSelections.length > 0);
  assert.ok(fold.scopeSelections.every((scope) =>
    typeof scope.scope === "string" &&
    typeof scope.familyId === "string" &&
    typeof scope.accepted === "boolean"
  ));
  assert.ok(fold.overallGuard);
  assert.ok(fold.metrics);
  assertFamilyStrengthProvenance(report, fold);
  return fold;
}

function assertProductionSelection(report) {
  const production = report.crossFittedSelection.production;
  const allFoldIds = ["1", "2", "3", "4", "5"];
  assert.deepEqual(production.trainingFoldIds, allFoldIds);
  assertInnerFoldProvenance(production, allFoldIds, allFoldIds);
  assert.equal(production.capPolicy.strategy, EXPECTED_CAP_POLICY.strategy);
  assert.deepEqual(production.capPolicy.trainingFoldIds, allFoldIds);
  assert.ok(production.capPolicy.speciesCaps.length > 0);
  assertFamilyStrengthProvenance(report, production);
  assert.match(production.selectionSha256, /^[0-9a-f]{64}$/);
  const selectionRecord = structuredClone(production);
  delete selectionRecord.selectionSha256;
  assert.equal(production.selectionSha256, canonicalSha256(selectionRecord));
}

test("逐鸟 25 组 cap 使用四折选择一折验证并能区分相反空间迁移", async () => {
  const cache = makeCache();
  const before = structuredClone(cache);
  const report = await scoreSpatialOofCandidates(cache, { workers: 2, generatedAt: "fixed" });
  assert.equal(report.schemaVersion, 6);
  assert.equal(report.diagnosticOnly, true);
  assert.equal(report.freezeEligible, false);
  assert.equal(report.sealedPanelViewed, false);
  assert.equal(report.scoring.candidateCount, 25);
  assert.equal(report.scoring.chunkRecords, 4096);
  assert.equal(report.scoring.fitFoldCount, 4);
  assert.equal(report.scoring.heldoutFoldCount, 5);
  assert.equal(report.rankingReference.contractId, RANKING_REFERENCE_CONTRACT.id);
  assert.equal(report.rankingReference.contractSha256, RANKING_REFERENCE_CONTRACT_SHA256);
  assert.equal(report.rankingReference.developmentDiagnosticOnly, true);
  assert.equal(report.rankingReference.freezeEligible, false);
  assert.equal(report.rankingReference.formalProbabilityGateUnchanged, true);
  assert.equal(report.rankingReference.retention.cachedCandidateRetention, 1);
  assert.equal(report.rankingReference.retention.thresholdFilteringApplied, false);
  assert.equal(report.rankingReference.crossFitting.fitFoldCount, 4);
  assert.equal(report.rankingReference.crossFitting.heldoutFoldCount, 5);
  const low = report.speciesCapTuning.species.find((row) => row.taxonId === "common-low");
  const high = report.speciesCapTuning.species.find((row) => row.taxonId === "common-high");
  const boundary = report.speciesCapTuning.species.find((row) => row.taxonId === "boundary-common");
  assert.ok(low);
  assert.ok(high);
  assert.ok(boundary);
  assert.equal(boundary.developmentPositiveCount, 205);
  assert.equal(boundary.crossFit.length, 0);
  assert.equal(report.speciesCapTuning.productionCandidateCount, 3);
  assert.notEqual(low.selectedCandidateId, high.selectedCandidateId);
  assert.equal(low.selectedCandidateId, "city=0,district=0");
  assert.equal(high.selectedCandidateId, "city=infinite,district=300");
  for (const species of [low, high]) {
    assert.equal(species.crossFit.length, 5);
    for (const fold of species.crossFit) {
      assert.equal(fold.trainingFoldIds.length, 4);
      assert.equal(fold.trainingFoldIds.includes(fold.heldoutFoldId), false);
    }
  }
  const familyIds = report.calibratorFamilies.map((row) => row.family.id);
  for (const family of DEFAULT_CALIBRATOR_FAMILIES) assert.ok(familyIds.includes(family.id));
  assert.equal(report.calibratorFamilies.every((family) => family.foldMetrics.length === 5), true);
  assert.deepEqual(cache, before);
});

test("workers=1/2/4 不改变候选、校准和完整指标结果", async () => {
  const cache = makeCache();
  const single = await scoreSpatialOofCandidates(cache, { workers: 1, generatedAt: "one" });
  const dual = await scoreSpatialOofCandidates(cache, { workers: 2, generatedAt: "two" });
  const quad = await scoreSpatialOofCandidates(cache, { workers: 4, generatedAt: "four" });
  assert.deepEqual(deterministicProjection(dual), deterministicProjection(single));
  assert.deepEqual(deterministicProjection(quad), deterministicProjection(single));
});

test("改变 heldout 折标签不影响该折使用的 cap、family、校准强度或 scope guard 决策", async () => {
  const heldoutFoldId = "3";
  const originalCache = makeCache();
  const changedCache = structuredClone(originalCache);
  const changedFold = changedCache.folds.find((fold) => String(fold.foldId) === heldoutFoldId);
  assert.ok(changedFold);
  for (const row of changedFold.scoreRows) {
    row.actualPositive = row.total - row.actualPositive;
  }
  recomputeReferenceRawMetrics(changedFold);
  assert.notDeepEqual(
    changedFold.referenceRawMetrics,
    originalCache.folds.find((fold) => String(fold.foldId) === heldoutFoldId).referenceRawMetrics
  );

  const original = await scoreSpatialOofCandidates(originalCache, { workers: 1, generatedAt: "fixed" });
  const changed = await scoreSpatialOofCandidates(changedCache, { workers: 1, generatedAt: "fixed" });
  for (const report of [original, changed]) {
    assert.equal(report.diagnosticOnly, true);
    assert.equal(report.freezeEligible, false);
    assert.equal(report.recommendation.familyId, EXPECTED_SELECTION_STRATEGY);
  }

  const allFoldIds = ["1", "2", "3", "4", "5"];
  for (const foldId of allFoldIds) {
    const fold = crossFittedFold(original, foldId);
    assert.deepEqual(fold.trainingFoldIds, allFoldIds.filter((candidate) => candidate !== foldId));
  }
  assertProductionSelection(original);

  const originalFold = crossFittedFold(original, heldoutFoldId);
  const changedReportFold = crossFittedFold(changed, heldoutFoldId);
  assert.deepEqual(originalFold.trainingFoldIds, ["1", "2", "4", "5"]);
  assert.deepEqual(changedReportFold.trainingFoldIds, ["1", "2", "4", "5"]);
  assert.deepEqual(
    originalFold.scopeSelections.map((scope) => scope.scope),
    originalFold.scopeSelections.map((scope) => scope.scope).toSorted()
  );
  assert.deepEqual(changedReportFold.capPolicy, originalFold.capPolicy);
  assert.deepEqual(changedReportFold.scopeSelections, originalFold.scopeSelections);
  assert.deepEqual(changedReportFold.overallGuard, originalFold.overallGuard);
  assert.equal(changedReportFold.selectionSha256, originalFold.selectionSha256);
  assert.notEqual(changedReportFold.validationSha256, originalFold.validationSha256);
  assert.notDeepEqual(changedReportFold.metrics, originalFold.metrics);
  assert.equal(
    changed.crossFittedSelection.fixedCandidateSetSha256,
    original.crossFittedSelection.fixedCandidateSetSha256
  );

  const originalDecision = structuredClone(originalFold);
  const changedDecision = structuredClone(changedReportFold);
  delete originalDecision.metrics;
  delete originalDecision.validationSha256;
  delete changedDecision.metrics;
  delete changedDecision.validationSha256;
  assert.deepEqual(changedDecision, originalDecision);
});

test("严格内层标签参与对应外层的候选选择且不读取外层 heldout 标签", async () => {
  const outerFoldId = "3";
  const originalCache = makeCache();
  const changedCache = structuredClone(originalCache);
  const changedOuterFold = changedCache.folds.find((fold) => String(fold.foldId) === outerFoldId);
  const changedInnerFold = changedOuterFold.innerFolds.find((fold) => String(fold.innerFoldId) === "2");
  for (const row of changedInnerFold.scoreRows) row.actualPositive = row.total - row.actualPositive;

  const original = await scoreSpatialOofCandidates(originalCache, { workers: 1, generatedAt: "fixed" });
  const changed = await scoreSpatialOofCandidates(changedCache, { workers: 1, generatedAt: "fixed" });
  const originalFold = crossFittedFold(original, outerFoldId);
  const changedFold = crossFittedFold(changed, outerFoldId);
  assert.notEqual(changedFold.selectionSha256, originalFold.selectionSha256);
  assert.notDeepEqual(changedFold.overallGuard, originalFold.overallGuard);
});

test("离线评分器拒绝缺失严格内层证据的 v1 形状缓存", async () => {
  const cache = makeCache();
  delete cache.folds[0].innerFolds;
  await assert.rejects(
    () => scoreSpatialOofCandidates(cache, { workers: 1, generatedAt: "fixed" }),
    (error) => error.code === "SPATIAL_OOF_INNER_FOLDS_INVALID"
  );
});

test("校准器候选 manifest 拒绝未预登记的 ridge 或 shrinkage batch", async () => {
  const changedFamilies = DEFAULT_CALIBRATOR_FAMILIES.map((family, index) =>
    index === 1 ? { ...family, shrinkage: family.shrinkage + 0.01 } : family
  );
  await assert.rejects(
    () => scoreSpatialOofCandidates(makeCache(), {
      workers: 1,
      calibratorFamilies: changedFamilies,
      generatedAt: "fixed"
    }),
    (error) => error.code === "SPATIAL_CALIBRATOR_BATCH_NOT_FIXED" &&
      Array.isArray(error.details?.expectedFamilies) &&
      Array.isArray(error.details?.actualFamilies)
  );
});

test("缓存 reference raw metrics 必须能由逐行充分统计完整重算", async () => {
  const cache = makeCache();
  cache.folds[0].referenceRawMetrics.brier += 0.001;
  await assert.rejects(
    () => scoreSpatialOofCandidates(cache, { workers: 1, generatedAt: "fixed" }),
    (error) => error.code === "SPATIAL_OOF_REFERENCE_METRICS_MISMATCH" &&
      error.details?.mismatches?.includes("brier")
  );
});

test("校准器族最终整体 Brier 与 ECE 也受 1%/0.01 保护门约束", async () => {
  const report = await scoreSpatialOofCandidates(makeCache(), { workers: 1, generatedAt: "fixed" });
  for (const family of report.calibratorFamilies) {
    const relativeBrierDegradation =
      (family.metrics.brier - family.rawMetrics.brier) / family.rawMetrics.brier;
    const eceDegradation = family.metrics.ece - family.rawMetrics.ece;
    assert.ok(relativeBrierDegradation <= 0.01 + 1e-12, family.family.id);
    assert.ok(eceDegradation <= 0.01 + 1e-12, family.family.id);
    if (!family.guard.overall.accepted) {
      assert.equal(family.guard.acceptedCount, 0);
      assert.equal(family.productionCalibrators.length, 0);
    }
  }
});

test("正式空间门仍拒绝 maximumSpeciesEce 超过 0.05", () => {
  const failures = spatialQualityFailures({
    brierSkill: 0.02,
    ece: 0.01,
    recallAt20Delta: 0,
    calibrationEce: {
      species: { scopeCount: 2, maximumEce: 0.0500000001 },
      group: { scopeCount: 2, maximumEce: 0.02 }
    }
  });
  assert.deepEqual(failures, ["spatial.species_calibration.maximumEce"]);
});

test("逐鸟空间误差审计识别跨折方向冲突且不暴露地点身份", () => {
  const makeAuditEntry = ({ foldId, taxonId, probability, positives, total = 100 }) => ({
    foldId,
    row: {
      contextIndex: Number(foldId),
      taxonId,
      positiveCount: 300,
      actualPositive: positives,
      total,
      rawProbability: probability,
      baselineProbability: 0.1,
      deepestLevel: "district"
    },
    probability
  });
  const entries = [
    makeAuditEntry({ foldId: "1", taxonId: "4866", probability: 0.6, positives: 60, total: 200 }),
    makeAuditEntry({ foldId: "2", taxonId: "4866", probability: 0.3, positives: 50 }),
    makeAuditEntry({ foldId: "1", taxonId: "steady-over", probability: 0.4, positives: 20 }),
    makeAuditEntry({ foldId: "2", taxonId: "steady-over", probability: 0.5, positives: 30 }),
    makeAuditEntry({ foldId: "1", taxonId: "within-gate", probability: 0.2, positives: 19 }),
    makeAuditEntry({ foldId: "2", taxonId: "within-gate", probability: 0.3, positives: 29 })
  ];
  const metrics = evaluateCandidateRows(entries);
  const audit = buildSpatialErrorAudit(entries);
  assert.deepEqual(audit.contract, SPATIAL_ERROR_AUDIT_CONTRACT);
  assert.equal(audit.maximumSpeciesEce, 0.05);
  assert.equal(audit.auditedScopeCount, 3);
  assert.equal(audit.overThresholdCount, 2);
  assert.equal(audit.underOrAtThresholdCount, 1);
  assert.equal(audit.worstTaxonId, metrics.calibrationEce.species.worstScopeId);
  assert.equal(audit.maximumObservedEce, metrics.calibrationEce.species.maximumEce);
  assert.deepEqual(audit.classificationCounts, {
    consistent_overprediction: 1,
    mixed_by_spatial_fold: 1
  });
  const mixed = audit.species.find((species) => species.taxonId === "4866");
  assert.equal(mixed.classification, "mixed_by_spatial_fold");
  assert.equal(mixed.recommendedNextStep, "add_stable_spatial_habitat_features");
  assert.deepEqual(mixed.folds.map((fold) => fold.direction), ["overprediction", "underprediction"]);
  assert.equal(mixed.bins.length, 2);
  const steady = audit.species.find((species) => species.taxonId === "steady-over");
  assert.equal(steady.classification, "consistent_overprediction");
  assert.equal(steady.recommendedNextStep, "regularized_monotone_calibration");
  assert.deepEqual(buildSpatialErrorAudit([...entries].reverse()), audit);
  const auditKeys = [];
  const collectKeys = (value) => {
    if (Array.isArray(value)) {
      for (const item of value) collectKeys(item);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value)) {
      auditKeys.push(key);
      collectKeys(item);
    }
  };
  collectKeys(audit);
  assert.equal(
    auditKeys.some((key) =>
      /report_id|observer|longitude|latitude|location|h3|district_id|city_id/i.test(key)
    ),
    false
  );
});

test("Recall@20 从逐 context 新概率重新排序而不是复用摘要", () => {
  const rows = Array.from({ length: 21 }, (_, index) => ({
    contextIndex: 0,
    taxonId: `taxon-${String(index).padStart(2, "0")}`,
    positiveCount: 300,
    actualPositive: index === 20 ? 1 : 0,
    total: 1,
    baselineProbability: 1 - index / 100,
    rawProbability: 1 - index / 100,
    deepestLevel: "district"
  }));
  const missed = evaluateCandidateRows(rows.map((row, index) => ({
    foldId: "1",
    row,
    probability: 1 - index / 100
  })));
  const recovered = evaluateCandidateRows(rows.map((row, index) => ({
    foldId: "1",
    row,
    probability: index === 20 ? 1 : 0.5 - index / 100
  })));
  assert.equal(missed.recallAt20, 0);
  assert.equal(recovered.recallAt20, 1);
});

test("CLI 不接受 sealed 或自由 cap 参数", () => {
  assert.throws(() => parseArguments(["--sealed-release", "x"]), /未知参数/);
  assert.throws(() => parseArguments(["--city-cap", "50"]), /未知参数/);
});
