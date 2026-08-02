"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const test = require("node:test");

const {
  NEIGHBOR_POLICY_DIAGNOSTIC_CONTRACT,
  neighborPolicyDiagnosticContractSha256
} = require("../server/prediction/continuous-habitat-neighbor-policies");
const {
  EXPECTED_NEIGHBOR_POLICY_CACHE_LAYOUT,
  PRIVACY_CONTRACT,
  assertPrivacySafe,
  neighborPolicyOofCacheGenerationImplementationSha256
} = require("../server/prediction/neighbor-policy-oof-cache");
const {
  neighborPolicyCandidateScorerImplementationSha256
} = require("../server/prediction/neighbor-policy-candidate-scorer");
const { sha256File } = require("../server/prediction/spatial-oof-cache");
const { canonicalJson } = require("../server/prediction/spatial-splits");
const {
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
  "zhejiang-v1-20260715-neighbor-policy-oof-v9-r1-preregistration.json"
);

function preregistration() {
  return JSON.parse(readFileSync(preregistrationPath, "utf8"));
}

test("failed v9-r1 preregistration remains immutable after the validation fix", () => {
  const value = preregistration();
  assert.equal(
    sha256File(preregistrationPath),
    "1b0eedb270ea8e65637cdd70f53037150527d77d55332f1516dd88e7e37510b1"
  );
  assert.equal(value.generatedAt, undefined);
  assert.equal(
    value.changeControl.scope,
    "runtime_memory_and_checkpoint_recovery_only"
  );
  assert.equal(value.changeControl.modelParametersChanged, false);
  assert.equal(value.changeControl.inputDataChanged, false);
  assert.equal(value.changeControl.validationFoldsChanged, false);
  assert.equal(value.changeControl.qualityThresholdsChanged, false);
  assert.equal(value.changeControl.neighborPolicyContractChanged, false);
  assert.equal(value.changeControl.sealedDataRead, false);
  assert.equal(value.changeControl.legacyCheckpointReuseForbidden, true);
  assert.equal(value.runtime.nodeMaxOldSpaceSizeMb, 8192);
  assert.equal(value.runtime.workers, 4);
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
  assert.equal(
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
  assert.equal(assertPrivacySafe(value), true);
});

test("v9-r1 freezes independent paths and the bounded-heap launch command", () => {
  const value = preregistration();
  assert.match(
    value.commands.cacheBuild,
    /^node --max-old-space-size=8192 tools\/build-zhejiang-prediction-model\.js /
  );
  for (const path of [
    value.outputs.modelPath,
    value.outputs.cachePath,
    value.outputs.stdoutPath,
    value.outputs.stderrPath,
    value.scoring.outputPath,
    value.preflight.outputPath
  ]) {
    assert.match(path, /v9-r1/);
  }
  const frozen = assertFrozenCommands(value);
  assert.equal(frozen.buildOptions.workers, 4);
  assert.equal(
    frozen.buildOptions.modelVersion,
    "zhejiang-v1-20260715-development-neighbor-policy-v9-r1"
  );
  assert.equal(
    sha256File(resolve(projectRoot, value.protectedState.defaultModelPath)),
    value.protectedState.defaultModelSha256
  );
});
