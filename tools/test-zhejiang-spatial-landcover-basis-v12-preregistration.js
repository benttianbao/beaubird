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
  openSpatialFeatureDiagnosticCache
} = require("../server/prediction/spatial-feature-diagnostic-cache");
const {
  SPATIAL_LANDCOVER_BASIS_CONTRACT,
  buildLandcoverBasis,
  implementationSha256,
  validatePreregistration
} = require("../server/prediction/spatial-landcover-basis-candidate");
const {
  sha256File
} = require("../server/prediction/spatial-oof-cache");
const { canonicalJson } = require("../server/prediction/spatial-splits");
const {
  verifySpatialSplitManifest
} = require("../server/prediction/spatial-transfer");
const {
  DEFAULT_MODEL_SHA256,
  assertFrozenCommand,
  preflightImplementationSha256
} = require("./preflight-zhejiang-spatial-landcover-basis");

const ROOT = resolve(__dirname, "..");
const PREREGISTRATION_PATH = resolve(
  ROOT,
  "docs/zhejiang-v1-20260715-spatial-landcover-basis-v12-preregistration.json"
);

function preregistration() {
  return JSON.parse(
    readFileSync(PREREGISTRATION_PATH, "utf8")
  );
}

function openBasis(value) {
  const sourceSnapshotSha256 = sha256File(
    resolve(ROOT, value.inputs.sourceSnapshotPath)
  );
  const verifiedSpatialSplit = verifySpatialSplitManifest({
    manifestPath: resolve(ROOT, value.inputs.spatialSplitPath),
    sourceSnapshotSha256,
    panelName: "development",
    sealedPanelConfirmation: null
  });
  const featureSet = loadHabitatFeatureSet(
    resolve(ROOT, value.inputs.featurePath),
    {
      expectedSnapshotSha256: sourceSnapshotSha256,
      expectedContractId:
        CONTINUOUS_HABITAT_FEATURE_CONTRACT.id
    }
  );
  const cache = openSpatialFeatureDiagnosticCache({
    cachePath: resolve(ROOT, value.inputs.featureCachePath),
    companionNeighborCachePath: resolve(
      ROOT,
      value.inputs.neighborCachePath
    ),
    verifiedSpatialSplit,
    sourceSnapshotSha256,
    sourceFeatureFileSha256: featureSet.fileSha256,
    sourceFeatureSetSha256: featureSet.featureSetSha256
  });
  return {
    cache,
    basis: buildLandcoverBasis(cache)
  };
}

test("v12 freezes one continuous basis hypothesis", () => {
  const value = preregistration();
  assert.equal(
    canonicalJson(value.contract.value),
    canonicalJson(SPATIAL_LANDCOVER_BASIS_CONTRACT)
  );
  assert.equal(
    value.implementation.scorerImplementationSha256,
    implementationSha256(ROOT)
  );
  assert.equal(
    value.implementation.preflightImplementationSha256,
    preflightImplementationSha256(ROOT)
  );
  assert.equal(value.stopPolicy.noFreeParameterSearch, true);
  assert.equal(value.stopPolicy.noRidgeSweep, true);
  assert.equal(value.changeControl.qualityThresholdsChanged, false);
  assert.equal(value.changeControl.runtimeIntegrationForbidden, true);
});

test("v12 binds immutable inputs and v11 no-go", () => {
  const value = preregistration();
  const pathFor = (key) => resolve(ROOT, value.inputs[key]);
  for (const [pathKey, hashKey] of [
    ["sourceSnapshotPath", "sourceSnapshotSha256"],
    ["spatialSplitPath", "spatialSplitFileSha256"],
    ["featurePath", "featureFileSha256"],
    ["neighborCachePath", "neighborCacheSha256"],
    ["featureCachePath", "featureCacheSha256"],
    ["v10ReportPath", "v10ReportSha256"],
    ["v11ReportPath", "v11ReportSha256"],
    ["defaultModelPath", "defaultModelSha256"]
  ]) {
    assert.equal(sha256File(pathFor(pathKey)), value.inputs[hashKey]);
  }
  assert.equal(value.inputs.defaultModelSha256, DEFAULT_MODEL_SHA256);
  const v11 = JSON.parse(
    readFileSync(pathFor("v11ReportPath"), "utf8")
  );
  assert.equal(v11.runtimeIntegrationEligible, false);
  assert.equal(
    v11.recommendation.nextAction,
    "stop_profile_calibration_path_and_reassess_feature_resolution"
  );
});

test("v12 completed diagnostic remains fail closed", () => {
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
  assert.equal(diagnostic.candidate.guard.accepted, true);
  assert.equal(
    diagnostic.candidate.strictWorstSpeciesEceImprovement,
    false
  );
  assert.equal(diagnostic.candidate.maximumSpeciesEceDelta, 0);
  assert.deepEqual(diagnostic.candidate.failures, [
    "spatial.species_calibration.maximumEce"
  ]);
  assert.equal(
    diagnostic.recommendation.nextAction,
    "stop_landcover_basis_path_and_reassess_spatial_generalization"
  );
  const opened = openBasis(value);
  try {
    assert.equal(
      opened.basis.basisModelSha256,
      value.basis.basisModelSha256
    );
    assert.equal(
      validatePreregistration(value, {
        neighborCacheSha256:
          value.inputs.neighborCacheSha256,
        neighborCacheGenerationImplementationSha256:
          value.inputs
            .neighborCacheGenerationImplementationSha256,
        featureCacheSha256:
          value.inputs.featureCacheSha256,
        v10ReportSha256: value.inputs.v10ReportSha256,
        v11ReportSha256: value.inputs.v11ReportSha256,
        basisModelSha256: opened.basis.basisModelSha256,
        outputPath: value.outputs.diagnosticPath
      }),
      true
    );
  } finally {
    opened.cache.close();
  }
  for (const forbidden of [
    "report_id",
    "observer",
    "coordinate",
    "h3",
    "space_unit_id",
    "point_id",
    "location_name",
    "context_index",
    "exact_context_feature_vector"
  ]) {
    assert.ok(value.privacyContract.forbidden.includes(forbidden));
  }
});
