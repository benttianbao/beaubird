"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  RANKING_REFERENCE_CONTRACT,
  RANKING_REFERENCE_CONTRACT_SHA256
} = require("../server/prediction/ranking-reference");
const {
  RANKING_REFERENCE_BINDING_KIND,
  RANKING_REFERENCE_OUTPUT_MEANING,
  normalizeParameters,
  parameterMap,
  parameterSetSha256,
  referenceRange,
  reportBinding
} = require("../server/prediction/ranking-reference-runtime");

const HASHES = Object.freeze({
  report: "1".repeat(64),
  scorer: "2".repeat(64),
  snapshot: "3".repeat(64),
  splitFile: "4".repeat(64),
  splitManifest: "5".repeat(64)
});

function parameter(scope, halfWidth) {
  return {
    scope,
    halfWidth,
    rowCount: 20,
    totalWeight: 200,
    calibrationFoldCount: 2,
    foldQuantiles: [
      { foldId: "1", halfWidth: halfWidth / 2, rowCount: 10, totalWeight: 100 },
      { foldId: "2", halfWidth, rowCount: 10, totalWeight: 100 }
    ]
  };
}

function fixtureReport() {
  return {
    schemaVersion: 5,
    reportType: "zhejiang_development_spatial_oof_candidate_diagnostic",
    diagnosticOnly: true,
    freezeEligible: false,
    sealedPanelViewed: false,
    cache: {
      sourceSnapshotSha256: HASHES.snapshot,
      spatialSplitFileSha256: HASHES.splitFile,
      spatialSplitManifestHash: HASHES.splitManifest
    },
    scoring: { scorerImplementationSha256: HASHES.scorer },
    rankingReference: {
      developmentDiagnosticOnly: true,
      freezeEligible: false,
      formalProbabilityGateUnchanged: true,
      passed: true,
      failures: [],
      contractId: RANKING_REFERENCE_CONTRACT.id,
      contractSha256: RANKING_REFERENCE_CONTRACT_SHA256,
      contract: RANKING_REFERENCE_CONTRACT,
      retention: { cachedCandidateRetention: 1, thresholdFilteringApplied: false },
      crossFitting: { fitFoldCount: 4, heldoutFoldCount: 5 },
      productionParameters: [
        parameter("species:bird-a", 0.04),
        parameter("group:200_plus", 0.08),
        parameter("global", 0.1)
      ]
    }
  };
}

test("development 报告严格绑定快照、split、scorer 与参数 SHA", () => {
  const binding = reportBinding(fixtureReport(), {
    reportPath: "ranking.json",
    reportSha256: HASHES.report,
    scorerImplementationSha256: HASHES.scorer,
    sourceSnapshotSha256: HASHES.snapshot,
    spatialSplitFileSha256: HASHES.splitFile,
    spatialSplitManifestHash: HASHES.splitManifest
  });
  assert.equal(binding.kind, RANKING_REFERENCE_BINDING_KIND);
  assert.equal(binding.outputMeaning, RANKING_REFERENCE_OUTPUT_MEANING);
  assert.equal(binding.parameterCount, 3);
  assert.equal(binding.parametersSha256, parameterSetSha256(binding.parameters));
  assert.equal(binding.sealedPanelViewed, false);
});

test("单鸟范围采用 specific、prevalence group 与 global 的最大半宽", () => {
  const parameters = normalizeParameters([
    parameter("global", 0.1),
    parameter("group:200_plus", 0.08),
    parameter("species:bird-a", 0.04)
  ]);
  const range = referenceRange(0.02, "bird-a", 300, parameterMap(parameters));
  assert.equal(range.lower, 0);
  assert.equal(range.upper, 0.12000000000000001);
  assert.deepEqual(range.sourceScopes, ["species:bird-a", "group:200_plus", "global"]);
  assert.equal(range.confidence, "medium");
});

test("未评估的低支持鸟种仍通过 global 回退得到较小数字", () => {
  const range = referenceRange(0.01, "rare-bird", 5, [parameter("global", 0.1)]);
  assert.equal(range.lower, 0);
  assert.equal(range.upper, 0.11);
  assert.deepEqual(range.sourceScopes, ["global"]);
});

test("篡改 scorer、打开 sealed 或非最保守折参数会 fail closed", () => {
  const changed = fixtureReport();
  changed.sealedPanelViewed = true;
  changed.scoring.scorerImplementationSha256 = "f".repeat(64);
  changed.rankingReference.productionParameters[0].halfWidth = 0.01;
  assert.throws(
    () => reportBinding(changed, {
      reportPath: "ranking.json",
      reportSha256: HASHES.report,
      scorerImplementationSha256: HASHES.scorer,
      sourceSnapshotSha256: HASHES.snapshot,
      spatialSplitFileSha256: HASHES.splitFile,
      spatialSplitManifestHash: HASHES.splitManifest
    }),
    (error) => error.details.failures.includes("report.sealedPanelViewed") &&
      error.details.failures.includes("scoring.scorerImplementationSha256") &&
      error.details.failures.some((failure) => failure.startsWith("reference.productionParameters:"))
  );
});
