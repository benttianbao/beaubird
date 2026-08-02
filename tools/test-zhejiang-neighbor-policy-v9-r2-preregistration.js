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
  "zhejiang-v1-20260715-neighbor-policy-oof-v9-r2-preregistration.json"
);

function preregistration() {
  return JSON.parse(readFileSync(preregistrationPath, "utf8"));
}

test("v9-r2 freezes the fractional-weight validation retry without changing model policy", () => {
  const value = preregistration();
  assert.equal(
    sha256File(preregistrationPath),
    "391ddbfffa38103479693044d295ba2efe1863d955acde33839acd4e305c2e2d"
  );
  assert.equal(value.generatedAt, undefined);
  assert.equal(
    value.changeControl.scope,
    "fractional_evaluation_weight_validation_only"
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
  assert.equal(
    value.implementation.predictionImplementationSha256,
    "4c4cf9efda73e9034b53d1454863ccfbcbe14ac80ba08d66cf453ad93d021788"
  );
  assert.notEqual(
    value.implementation.predictionImplementationSha256,
    predictionImplementationSha256()
  );
  assert.equal(
    value.implementation.cacheGenerationImplementationSha256,
    "226eba391fee4d6b8b2fc9282b14d138a1ce24cd6bce0c48484ebd42f61e10f1"
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
    "47e21e1575b9f07158a7e61876a9a1700f933808547b08dd6248d49d884653d7"
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

test("v9-r2 freezes independent paths and the bounded-heap launch command", () => {
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
    assert.match(path, /v9-r2/);
  }
  const frozen = assertFrozenCommands(value);
  assert.equal(frozen.buildOptions.workers, 4);
  assert.equal(
    frozen.buildOptions.modelVersion,
    "zhejiang-v1-20260715-development-neighbor-policy-v9-r2"
  );
  assert.equal(
    sha256File(resolve(projectRoot, value.protectedState.defaultModelPath)),
    value.protectedState.defaultModelSha256
  );
});
