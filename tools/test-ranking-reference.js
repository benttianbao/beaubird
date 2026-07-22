"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  RANKING_REFERENCE_CONTRACT,
  RANKING_REFERENCE_CONTRACT_SHA256,
  applyCrossFittedRanges,
  evaluateRankingReference,
  fitRangeParameters,
  qualityFailures,
  weightedQuantile
} = require("../server/prediction/ranking-reference");

function fixtureEntries() {
  const entries = [];
  for (let fold = 1; fold <= 5; fold += 1) {
    for (let index = 0; index < 24; index += 1) {
      const positive = index >= 20;
      const probability = positive ? 0.3 + (index - 20) * 0.02 : 0.005 + index * 0.001;
      entries.push({
        foldId: String(fold),
        probability,
        row: {
          contextIndex: fold - 1,
          taxonId: `taxon-${String(index).padStart(2, "0")}`,
          positiveCount: 300,
          total: 10,
          actualPositive: positive ? 3 : 0,
          baselineProbability: positive ? 0.01 : 0.5 - index * 0.01
        }
      });
    }
  }
  return entries;
}

function deterministicProjection(report) {
  return structuredClone(report);
}

test("加权分位数按权重而不是行数计算", () => {
  assert.equal(weightedQuantile([
    { value: 0.1, weight: 1 },
    { value: 0.2, weight: 8 },
    { value: 0.9, weight: 1 }
  ], 0.5), 0.2);
});

test("五折 OOF 参考范围保留低概率候选并改善排序", () => {
  const report = evaluateRankingReference(fixtureEntries());
  assert.match(RANKING_REFERENCE_CONTRACT_SHA256, /^[0-9a-f]{64}$/);
  assert.equal(report.contractId, RANKING_REFERENCE_CONTRACT.id);
  assert.equal(report.developmentDiagnosticOnly, true);
  assert.equal(report.freezeEligible, false);
  assert.equal(report.formalProbabilityGateUnchanged, true);
  assert.equal(report.crossFitting.fitFoldCount, 4);
  assert.equal(report.crossFitting.heldoutFoldCount, 5);
  assert.ok(report.ranking.recallAt20Delta > 0);
  assert.ok(report.ranking.ndcgAt20Delta > 0);
  assert.equal(report.retention.cachedCandidateRetention, 1);
  assert.equal(report.retention.lowProbabilityRetention, 1);
  assert.equal(report.retention.thresholdFilteringApplied, false);
  assert.equal(report.retention.inputRows, report.retention.outputRows);
  assert.equal(report.passed, true);
  assert.deepEqual(report.failures, []);
  assert.ok(report.productionParameters.length > 0);
  assert.deepEqual(
    report.productionParameters.map((row) => row.scope),
    report.productionParameters.map((row) => row.scope).toSorted()
  );
});

test("输入顺序不改变规范参数、范围或指标", () => {
  const entries = fixtureEntries();
  const forward = evaluateRankingReference(entries);
  const reversed = evaluateRankingReference([...entries].reverse());
  assert.deepEqual(deterministicProjection(reversed), deterministicProjection(forward));
});

test("heldout 标签不参与该折参考范围拟合", () => {
  const entries = fixtureEntries();
  const changed = structuredClone(entries);
  for (const entry of changed.filter((row) => row.foldId === "3")) {
    entry.row.actualPositive = entry.row.total - entry.row.actualPositive;
  }
  const originalRanges = applyCrossFittedRanges(entries).entries
    .filter((entry) => entry.foldId === "3")
    .map(({ taxonId, referenceScope, referenceLower, referenceUpper, confidence }) => ({
      taxonId,
      referenceScope,
      referenceLower,
      referenceUpper,
      confidence
    }));
  const changedRanges = applyCrossFittedRanges(changed).entries
    .filter((entry) => entry.foldId === "3")
    .map(({ taxonId, referenceScope, referenceLower, referenceUpper, confidence }) => ({
      taxonId,
      referenceScope,
      referenceLower,
      referenceUpper,
      confidence
    }));
  assert.deepEqual(changedRanges, originalRanges);
});

test("单鸟参考范围不会窄于常见度组和全局折稳健范围", () => {
  const entries = [];
  for (let fold = 1; fold <= 5; fold += 1) {
    entries.push({
      foldId: String(fold),
      probability: 0.1,
      row: {
        contextIndex: fold,
        taxonId: "common",
        positiveCount: 300,
        total: 10,
        actualPositive: 1,
        baselineProbability: 0.1
      }
    });
    entries.push({
      foldId: String(fold),
      probability: 0.1,
      row: {
        contextIndex: fold,
        taxonId: "rare",
        positiveCount: 20,
        total: 10,
        actualPositive: 3,
        baselineProbability: 0.1
      }
    });
  }
  const ranged = applyCrossFittedRanges(entries).entries.find((entry) =>
    entry.foldId === "1" && entry.taxonId === "common"
  );
  assert.deepEqual(ranged.referenceSourceScopes, ["species:common", "group:200_plus", "global"]);
  assert.ok(Math.abs(ranged.referenceLower - 0) < 1e-12);
  assert.ok(Math.abs(ranged.referenceUpper - 0.3) < 1e-12);
});

test("低支持鸟种不会在 prevalence group 中重复计权", () => {
  const rows = [1, 2, 3].map((index) => ({
    foldId: String(index),
    contextIndex: index,
    taxonId: `rare-${index}`,
    positiveCount: 20,
    total: 10,
    actualPositive: 1,
    probability: 0.05,
    baselineProbability: 0.04,
    observedFrequency: 0.1,
    scope: "group:under_30"
  }));
  const parameters = fitRangeParameters(rows);
  assert.equal(parameters.get("group:under_30").rowCount, 3);
  assert.equal(parameters.get("group:under_30").totalWeight, 30);
});

test("范围覆盖率、宽度或候选守恒不合格时给出独立失败项", () => {
  assert.deepEqual(qualityFailures({
    ranking: { recallAt20Delta: -0.01, ndcgAt20Delta: -0.02 },
    ranges: { overallCoverage: 0.89, worstSpeciesCoverage: 0.79, meanWidth: 0.36 },
    retention: { cachedCandidateRetention: 0.99 }
  }), [
    "ranking_reference.recallAt20Delta",
    "ranking_reference.ndcgAt20Delta",
    "ranking_reference.overallCoverage",
    "ranking_reference.worstSpeciesCoverage",
    "ranking_reference.meanWidth",
    "ranking_reference.cachedCandidateRetention"
  ]);
});

test("非法概率和非完整 OOF 行被拒绝", () => {
  const invalid = fixtureEntries();
  invalid[0].probability = Number.NaN;
  assert.throws(() => evaluateRankingReference(invalid), /非法 OOF 行/);
});
