"use strict";

const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const test = require("node:test");

const {
  SPATIAL_PROFILE_CALIBRATION_CONTRACT,
  spatialProfileCalibrationImplementationSha256,
  validateSpatialProfileCalibrationPreregistration
} = require("../server/prediction/spatial-profile-calibration-candidate");
const {
  sha256File
} = require("../server/prediction/spatial-oof-cache");
const {
  canonicalJson
} = require("../server/prediction/spatial-splits");
const {
  DEFAULT_MODEL_SHA256,
  assertFrozenCommand,
  preflightImplementationSha256
} = require("./preflight-zhejiang-spatial-profile-calibration");

const ROOT = resolve(__dirname, "..");
const PREREGISTRATION_PATH = resolve(
  ROOT,
  "docs/zhejiang-v1-20260715-spatial-profile-calibration-v11-preregistration.json"
);

function preregistration() {
  return JSON.parse(readFileSync(PREREGISTRATION_PATH, "utf8"));
}

test("v11 freezes exactly one profile-conditioned calibration hypothesis", () => {
  const value = preregistration();
  assert.equal(
    canonicalJson(value.contract.value),
    canonicalJson(SPATIAL_PROFILE_CALIBRATION_CONTRACT)
  );
  assert.equal(
    value.implementation.scorerImplementationSha256,
    spatialProfileCalibrationImplementationSha256(ROOT)
  );
  assert.equal(
    value.implementation.preflightImplementationSha256,
    preflightImplementationSha256(ROOT)
  );
  assert.equal(
    value.contract.value.seasonFeatureEnabled,
    false
  );
  assert.equal(value.changeControl.qualityThresholdsChanged, false);
  assert.equal(value.changeControl.runtimeIntegrationForbidden, true);
  assert.equal(value.stopPolicy.sealedForbidden, true);
  assert.equal(value.stopPolicy.singleDiagnosticRunOnly, true);
});

test("v11 binds the completed v10 no-go and immutable caches", () => {
  const value = preregistration();
  const pathFor = (key) => resolve(ROOT, value.inputs[key]);
  for (const [pathKey, hashKey] of [
    ["sourceSnapshotPath", "sourceSnapshotSha256"],
    ["spatialSplitPath", "spatialSplitFileSha256"],
    ["featurePath", "featureFileSha256"],
    ["neighborCachePath", "neighborCacheSha256"],
    ["featureCachePath", "featureCacheSha256"],
    ["v10ModelPath", "v10ModelSha256"],
    ["v10ReportPath", "v10ReportSha256"],
    ["defaultModelPath", "defaultModelSha256"]
  ]) {
    assert.equal(sha256File(pathFor(pathKey)), value.inputs[hashKey]);
  }
  assert.equal(value.inputs.defaultModelSha256, DEFAULT_MODEL_SHA256);
  const v10 = JSON.parse(
    readFileSync(pathFor("v10ReportPath"), "utf8")
  );
  assert.equal(v10.releaseQuality.passed, false);
  assert.deepEqual(v10.releaseQuality.failures, [
    "spatial.species_calibration.maximumEce"
  ]);
  assert.equal(
    v10.releaseQuality.spatial.metrics.calibrationEce.species
      .maximumEce,
    value.v10Finding.maximumSpeciesEce
  );
  assert.equal(
    value.v10Finding.maximumSpeciesEce >
      value.v10Finding.maximumSpeciesEceThreshold,
    true
  );
});

test("v11 completed diagnostic remains fail closed", () => {
  const value = preregistration();
  assert.equal(
    assertFrozenCommand(value),
    value.commands.candidateScoring
  );
  const diagnosticPath = resolve(
    ROOT,
    value.outputs.diagnosticPath
  );
  assert.equal(existsSync(diagnosticPath), true);
  assert.equal(existsSync(`${diagnosticPath}.sha256`), true);
  const sidecarSha256 = readFileSync(
    `${diagnosticPath}.sha256`,
    "utf8"
  ).trim().split(/\s+/)[0];
  assert.equal(sha256File(diagnosticPath), sidecarSha256);
  const diagnostic = JSON.parse(
    readFileSync(diagnosticPath, "utf8")
  );
  assert.equal(diagnostic.diagnosticOnly, true);
  assert.equal(diagnostic.developmentOnly, true);
  assert.equal(diagnostic.sealedPanelViewed, false);
  assert.equal(diagnostic.defaultModelModified, false);
  assert.equal(diagnostic.runtimeIntegrationEligible, false);
  assert.equal(diagnostic.candidate.guard.accepted, false);
  assert.equal(
    diagnostic.candidate.strictWorstSpeciesEceImprovement,
    false
  );
  assert.ok(diagnostic.candidate.maximumSpeciesEceDelta > 0);
  assert.deepEqual(diagnostic.candidate.failures, [
    "spatial.species_calibration.maximumEce"
  ]);
  assert.equal(
    diagnostic.recommendation.nextAction,
    "stop_profile_calibration_path_and_reassess_feature_resolution"
  );
  for (const forbidden of [
    "report_id",
    "observer",
    "coordinate",
    "h3",
    "space_unit_id",
    "point_id",
    "location_name",
    "context_index"
  ]) {
    assert.ok(value.privacyContract.forbidden.includes(forbidden));
  }
  assert.equal(
    validateSpatialProfileCalibrationPreregistration(value, {
      neighborCacheSha256: value.inputs.neighborCacheSha256,
      neighborCacheGenerationImplementationSha256:
        value.inputs.neighborCacheGenerationImplementationSha256,
      featureCacheSha256: value.inputs.featureCacheSha256,
      v10ReportSha256: value.inputs.v10ReportSha256,
      outputPath: value.outputs.diagnosticPath
    }),
    true
  );
});
