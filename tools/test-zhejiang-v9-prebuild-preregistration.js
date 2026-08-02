"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const test = require("node:test");

const {
  sha256File,
  spatialOofCacheGenerationImplementationSha256
} = require("../server/prediction/spatial-oof-cache");
const {
  PRODUCTION_SPATIAL_QUALITY_THRESHOLDS
} = require("../server/prediction/spatial-candidate-scorer");
const {
  HABITAT_EVIDENCE_CANDIDATES,
  HABITAT_EVIDENCE_SELECTION_POLICY,
  V9_STRUCTURAL_CANDIDATE_PLAN,
  continuousHabitatPrebuildImplementationSha256,
  habitatEvidenceCandidateSetSha256,
  structuralCandidatePlanSha256,
  validatePrebuildPreregistration
} = require("../server/prediction/continuous-habitat-prebuild");
const { canonicalJson } = require("../server/prediction/spatial-splits");

const projectRoot = resolve(__dirname, "..");
const preregistrationPath = resolve(
  projectRoot,
  "docs",
  "zhejiang-v1-20260715-continuous-habitat-v9-prebuild-preregistration.json"
);

function preregistration() {
  return JSON.parse(readFileSync(preregistrationPath, "utf8"));
}

test("v9 prebuild preregistration freezes executable candidates and stop policy", () => {
  const value = preregistration();
  assert.equal(value.generatedAt, undefined);
  assert.equal(value.status, "frozen_before_read_only_prebuild_diagnostic");
  assert.equal(
    value.implementationSha256,
    continuousHabitatPrebuildImplementationSha256()
  );
  assert.equal(
    value.candidateSet.sha256,
    habitatEvidenceCandidateSetSha256()
  );
  assert.equal(
    canonicalJson(value.candidateSet.candidates),
    canonicalJson(HABITAT_EVIDENCE_CANDIDATES)
  );
  assert.equal(
    canonicalJson(value.candidateSet.selectionPolicy),
    canonicalJson(HABITAT_EVIDENCE_SELECTION_POLICY)
  );
  assert.equal(
    value.structuralCandidatePlan.sha256,
    structuralCandidatePlanSha256()
  );
  assert.equal(
    canonicalJson(value.structuralCandidatePlan.plan),
    canonicalJson(V9_STRUCTURAL_CANDIDATE_PLAN)
  );
  assert.deepEqual(value.qualityThresholds, PRODUCTION_SPATIAL_QUALITY_THRESHOLDS);
  assert.equal(value.stopPolicy.sealedForbidden, true);
  assert.equal(value.stopPolicy.defaultModelOverwriteForbidden, true);
  assert.equal(value.stopPolicy.longBuildRequiresDiagnosticPass, true);
  assert.equal(value.diagnostic.freezeEligible, false);
});

test("v9 prebuild preregistration binds the available immutable inputs", () => {
  const value = preregistration();
  const inputFiles = [
    ["cacheFileSha256", value.inputs.cachePath],
    ["sourceSnapshotSha256", value.inputs.sourceSnapshotPath],
    ["spatialSplitFileSha256", value.inputs.spatialSplitPath]
  ];
  for (const [binding, relativePath] of inputFiles) {
    assert.equal(
      sha256File(resolve(projectRoot, relativePath)),
      value.inputs[binding],
      relativePath
    );
  }
  assert.equal(
    value.inputs.generationImplementationSha256,
    "d6203dee3dd8f47abcd4dd86cf943cfbdbc81f41607bcc8325de5430423c8c7f"
  );
  assert.notEqual(
    spatialOofCacheGenerationImplementationSha256(),
    value.inputs.generationImplementationSha256
  );
  assert.equal(
    sha256File(resolve(projectRoot, value.protectedState.defaultOfflineModelPath)),
    value.protectedState.defaultOfflineModelSha256
  );
});

test("v9 prebuild preregistration validates against its strict-cache identity", () => {
  const value = preregistration();
  const cacheIdentity = {
    fileSha256: value.inputs.cacheFileSha256,
    metadata: {
      sourceSnapshotSha256: value.inputs.sourceSnapshotSha256,
      spatialSplitFileSha256: value.inputs.spatialSplitFileSha256,
      spatialSplitManifestHash: value.inputs.spatialSplitManifestHash
    }
  };
  assert.equal(
    validatePrebuildPreregistration(value, {
      cache: cacheIdentity,
      outputPath: resolve(projectRoot, value.diagnostic.outputPath)
    }),
    true
  );
});
