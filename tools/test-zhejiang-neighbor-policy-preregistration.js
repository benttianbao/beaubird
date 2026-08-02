"use strict";

const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const test = require("node:test");

const {
  CONTINUOUS_HABITAT_FEATURE_CONTRACT,
  loadHabitatFeatureSet
} = require("../server/prediction/habitat-features");
const {
  NEIGHBOR_POLICY_DIAGNOSTIC_CONTRACT,
  neighborPolicyDiagnosticContractSha256
} = require("../server/prediction/continuous-habitat-neighbor-policies");
const {
  EXPECTED_NEIGHBOR_POLICY_CACHE_LAYOUT,
  PRIVACY_CONTRACT,
  assertPrivacySafe,
  neighborPolicyOofCacheGenerationImplementationSha256,
  validateNeighborPolicyCachePreregistration
} = require("../server/prediction/neighbor-policy-oof-cache");
const {
  NEIGHBOR_POLICY_CANDIDATE_SCORER_SCHEMA_VERSION,
  neighborPolicyCandidateScorerImplementationSha256
} = require("../server/prediction/neighbor-policy-candidate-scorer");
const { sha256File } = require("../server/prediction/spatial-oof-cache");
const {
  canonicalJson
} = require("../server/prediction/spatial-splits");
const {
  verifySpatialSplitManifest
} = require("../server/prediction/spatial-transfer");
const {
  PRODUCTION_QUALITY_GATE,
  predictionImplementationSha256
} = require("./build-zhejiang-prediction-model");
const {
  assertFrozenCommands,
  preflightImplementationSha256
} = require("./preflight-zhejiang-neighbor-policy-oof-cache");

const projectRoot = resolve(__dirname, "..");
const preregistrationPath = resolve(
  projectRoot,
  "docs",
  "zhejiang-v1-20260715-neighbor-policy-oof-v9-preregistration.json"
);

function preregistration() {
  return JSON.parse(readFileSync(preregistrationPath, "utf8"));
}

function absolute(relativePath) {
  return resolve(projectRoot, relativePath);
}

test("failed v9 preregistration remains immutable and cannot bind the optimized implementation", () => {
  const value = preregistration();
  assert.equal(
    sha256File(preregistrationPath),
    "0b1aef48eb2e02e397b0affe7000307ff0ae41dc1a1667c97ba57b4df3c24c72"
  );
  assert.equal(value.generatedAt, undefined);
  assert.equal(
    value.status,
    "frozen_before_single_long_development_cache_build"
  );
  assert.equal(value.diagnosticOnly, true);
  assert.notEqual(
    value.implementation.predictionImplementationSha256,
    predictionImplementationSha256()
  );
  assert.notEqual(
    value.implementation.cacheGenerationImplementationSha256,
    neighborPolicyOofCacheGenerationImplementationSha256()
  );
  assert.equal(
    value.implementation.scorerImplementationSha256,
    neighborPolicyCandidateScorerImplementationSha256()
  );
  assert.notEqual(
    value.preflight.implementationSha256,
    preflightImplementationSha256()
  );
  assert.equal(
    value.contract.sha256,
    neighborPolicyDiagnosticContractSha256()
  );
  assert.equal(
    canonicalJson(value.contract.value),
    canonicalJson(NEIGHBOR_POLICY_DIAGNOSTIC_CONTRACT)
  );
  assert.equal(
    canonicalJson(value.expectedLayout),
    canonicalJson(EXPECTED_NEIGHBOR_POLICY_CACHE_LAYOUT)
  );
  assert.equal(
    canonicalJson(value.privacyContract),
    canonicalJson(PRIVACY_CONTRACT)
  );
  assert.equal(
    value.scoring.schemaVersion,
    NEIGHBOR_POLICY_CANDIDATE_SCORER_SCHEMA_VERSION
  );
  assert.equal(value.stopPolicy.sealedForbidden, true);
  assert.equal(value.stopPolicy.defaultModelOverwriteForbidden, true);
  assert.equal(value.stopPolicy.referenceMaterializationForbidden, true);
  assert.equal(
    value.stopPolicy.singleLongRunRequiresExplicitApproval,
    true
  );
  for (const command of Object.values(value.commands)) {
    assert.equal(/[\r\n]/.test(command), false);
  }
  assert.doesNotThrow(() => assertFrozenCommands(value));
  assert.equal(assertPrivacySafe(value), true);
});

test("neighbor-policy preregistration binds all immutable inputs", () => {
  const value = preregistration();
  const sourceSnapshotSha256 = sha256File(
    absolute(value.inputs.sourceSnapshotPath)
  );
  assert.equal(
    sourceSnapshotSha256,
    value.inputs.sourceSnapshotSha256
  );
  assert.equal(
    sha256File(absolute(value.inputs.spatialSplitPath)),
    value.inputs.spatialSplitFileSha256
  );
  assert.equal(
    sha256File(absolute(value.inputs.featurePath)),
    value.inputs.featureFileSha256
  );
  assert.equal(
    sha256File(absolute(value.inputs.tileManifestPath)),
    value.inputs.tileManifestFileSha256
  );
  assert.equal(
    sha256File(absolute(value.inputs.targetIndependentAuditPath)),
    value.inputs.targetIndependentAuditSha256
  );
  const verifiedSpatialSplit = verifySpatialSplitManifest({
    manifestPath: absolute(value.inputs.spatialSplitPath),
    sourceSnapshotSha256,
    panelName: "development",
    sealedPanelConfirmation: null
  });
  assert.equal(
    verifiedSpatialSplit.manifestHash,
    value.inputs.spatialSplitManifestHash
  );
  const habitatFeatureSet = loadHabitatFeatureSet(
    absolute(value.inputs.featurePath),
    {
      expectedSnapshotSha256: sourceSnapshotSha256,
      expectedContractId:
        CONTINUOUS_HABITAT_FEATURE_CONTRACT.id
    }
  );
  assert.equal(
    habitatFeatureSet.featureSetSha256,
    value.inputs.featureSetSha256
  );
  assert.equal(
    habitatFeatureSet.tileManifestSha256,
    value.inputs.tileManifestSha256
  );
  assert.equal(
    habitatFeatureSet.generationImplementationSha256,
    value.inputs.featureGenerationImplementationSha256
  );
  assert.throws(
    () => validateNeighborPolicyCachePreregistration(value, {
        sourceSnapshotSha256,
        verifiedSpatialSplit,
        habitatFeatureSet,
        predictionImplementationSha256:
          predictionImplementationSha256(),
        qualityThresholds: {
          ...PRODUCTION_QUALITY_GATE,
          maximumRelativeBrierDegradation: 0.01,
          maximumEceDegradation: 0.01
        },
        modelOutputPath: absolute(value.outputs.modelPath),
        cacheOutputPath: absolute(value.outputs.cachePath),
        modelVersion: value.outputs.modelVersion
      }),
    (error) =>
      error?.code ===
        "NEIGHBOR_POLICY_OOF_CACHE_PREREGISTRATION_MISMATCH" &&
      canonicalJson(error.details?.failures) === canonicalJson([
        "implementation.predictionImplementationSha256",
        "implementation.cacheGenerationImplementationSha256"
      ])
  );
  assert.equal(
    sha256File(absolute(value.protectedState.defaultModelPath)),
    value.protectedState.defaultModelSha256
  );
});

test("failed v9 attempt produced no publishable model, cache, report, or score", () => {
  const value = preregistration();
  const targets = [
    value.outputs.modelPath,
    `${value.outputs.modelPath}.sha256`,
    value.outputs.buildReportPath,
    `${value.outputs.buildReportPath}.sha256`,
    value.outputs.cachePath,
    `${value.outputs.cachePath}.sha256`,
    value.scoring.outputPath,
    `${value.scoring.outputPath}.sha256`
  ];
  for (const target of targets) {
    assert.equal(existsSync(absolute(target)), false, target);
  }
  const stderrPath = absolute(value.outputs.stderrPath);
  if (existsSync(stderrPath)) {
    assert.match(
      readFileSync(stderrPath, "utf8"),
      /JavaScript heap out of memory/
    );
  }
});

test("completed preflight, when present, is hash-bound and remains build-free", () => {
  const value = preregistration();
  const preflightPath = absolute(value.preflight.outputPath);
  if (!existsSync(preflightPath)) return;
  const sidecarPath = `${preflightPath}.sha256`;
  assert.equal(existsSync(sidecarPath), true);
  const expectedSha256 = readFileSync(sidecarPath, "utf8")
    .trim()
    .split(/\s+/)[0];
  assert.equal(sha256File(preflightPath), expectedSha256);
  const report = JSON.parse(readFileSync(preflightPath, "utf8"));
  assert.equal(report.readyForExplicitApproval, true);
  assert.equal(report.longBuildStarted, false);
  assert.equal(report.sealedPanelViewed, false);
  assert.equal(report.defaultModelModified, false);
  assert.equal(report.checks.allOutputTargetsAbsent, true);
});
