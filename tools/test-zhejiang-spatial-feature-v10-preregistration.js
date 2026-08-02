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
  MULTISCALE_SPATIAL_FEATURE_CONTRACT,
  buildMultiscaleSpatialFeatureProfiles,
  multiscaleSpatialFeatureContractSha256,
  multiscaleSpatialFeatureGenerationImplementationSha256
} = require("../server/prediction/multiscale-spatial-features");
const {
  EXPECTED_SPATIAL_FEATURE_DIAGNOSTIC_CACHE_LAYOUT,
  PRIVACY_CONTRACT,
  assertPrivacySafe,
  spatialFeatureDiagnosticCacheGenerationImplementationSha256,
  validateSpatialFeatureDiagnosticPreregistration
} = require("../server/prediction/spatial-feature-diagnostic-cache");
const { sha256File } = require("../server/prediction/spatial-oof-cache");
const {
  verifySpatialSplitManifest
} = require("../server/prediction/spatial-transfer");
const { canonicalJson } = require("../server/prediction/spatial-splits");
const {
  predictionImplementationSha256
} = require("./build-zhejiang-prediction-model");
const {
  assertFrozenBuildCommand,
  preflightImplementationSha256
} = require("./preflight-zhejiang-spatial-feature-diagnostic-cache");

const projectRoot = resolve(__dirname, "..");
const preregistrationPath = resolve(
  projectRoot,
  "docs",
  "zhejiang-v1-20260715-multiscale-spatial-feature-v10-preregistration.json"
);

function preregistration() {
  return JSON.parse(
    readFileSync(preregistrationPath, "utf8")
  );
}

test("v10 freezes the multiscale feature and privacy contracts", () => {
  const value = preregistration();
  assert.equal(
    sha256File(preregistrationPath),
    "c97d8be73e3d7c5cc738d96d12e31bafb4be0f25da10a4d2c54f4af6e648be0c"
  );
  assert.equal(value.generatedAt, undefined);
  assert.equal(
    value.implementation.predictionImplementationSha256,
    "621c1e8288329c6988adb013253ae9bf42a06b2043aba92114047d5912d7cc74"
  );
  assert.notEqual(
    value.implementation.predictionImplementationSha256,
    predictionImplementationSha256()
  );
  assert.equal(
    value.implementation
      .multiscaleFeatureGenerationImplementationSha256,
    multiscaleSpatialFeatureGenerationImplementationSha256()
  );
  assert.equal(
    value.implementation.cacheGenerationImplementationSha256,
    "3b22953053024a5b6cedac61c91a0cf5f4442f7d87149bb0c08a65926ac5823c"
  );
  assert.notEqual(
    value.implementation.cacheGenerationImplementationSha256,
    spatialFeatureDiagnosticCacheGenerationImplementationSha256()
  );
  assert.equal(
    value.implementation.preflightImplementationSha256,
    "dad1a347f96de5a3fa1919321196bf5f6ec41fc925e31814e1350f57254b6c86"
  );
  assert.notEqual(
    value.implementation.preflightImplementationSha256,
    preflightImplementationSha256()
  );
  assert.equal(
    value.contract.sha256,
    multiscaleSpatialFeatureContractSha256()
  );
  assert.equal(
    canonicalJson(value.contract.value),
    canonicalJson(MULTISCALE_SPATIAL_FEATURE_CONTRACT)
  );
  assert.equal(
    canonicalJson(value.expectedLayout),
    canonicalJson(
      EXPECTED_SPATIAL_FEATURE_DIAGNOSTIC_CACHE_LAYOUT
    )
  );
  assert.equal(
    canonicalJson(value.privacyContract),
    canonicalJson(PRIVACY_CONTRACT)
  );
  assert.equal(assertPrivacySafe(value), true);
});

test("v10 preregistration binds the real inputs, companion, and completed outputs", () => {
  const value = preregistration();
  const snapshotPath = resolve(
    projectRoot,
    value.inputs.sourceSnapshotPath
  );
  const snapshotSha256 = sha256File(snapshotPath);
  const featureSet = loadHabitatFeatureSet(
    resolve(projectRoot, value.inputs.featurePath),
    {
      expectedSnapshotSha256: snapshotSha256,
      expectedContractId:
        CONTINUOUS_HABITAT_FEATURE_CONTRACT.id
    }
  );
  const verifiedSpatialSplit = verifySpatialSplitManifest({
    manifestPath: resolve(
      projectRoot,
      value.inputs.spatialSplitPath
    ),
    sourceSnapshotSha256: snapshotSha256,
    panelName: "development"
  });
  const profileModel =
    buildMultiscaleSpatialFeatureProfiles(featureSet);
  assert.equal(
    validateSpatialFeatureDiagnosticPreregistration(
      value,
      {
        sourceSnapshotSha256: snapshotSha256,
        verifiedSpatialSplit,
        habitatFeatureSet: featureSet,
        profileModel,
        predictionImplementationSha256:
          value.implementation.predictionImplementationSha256,
        cacheGenerationImplementationSha256:
          value.implementation
            .cacheGenerationImplementationSha256,
        modelOutputPath: resolve(
          projectRoot,
          value.outputs.modelPath
        ),
        companionNeighborCachePath: resolve(
          projectRoot,
          value.companion.path
        ),
        companionMode: "existing_read_only",
        featureCacheOutputPath: resolve(
          projectRoot,
          value.outputs.featureCachePath
        ),
        modelVersion: value.modelVersion
      }
    ),
    true
  );
  assert.equal(
    sha256File(
      resolve(projectRoot, value.protectedState.defaultModelPath)
    ),
    value.protectedState.defaultModelSha256
  );
  assert.equal(
    existsSync(resolve(projectRoot, value.outputs.modelPath)),
    true
  );
  assert.equal(
    existsSync(
      resolve(projectRoot, value.outputs.featureCachePath)
    ),
    true
  );
  for (const outputPath of [
    value.outputs.modelPath,
    value.outputs.buildReportPath,
    value.outputs.featureCachePath
  ]) {
    const absolutePath = resolve(projectRoot, outputPath);
    const sidecarPath = `${absolutePath}.sha256`;
    assert.equal(existsSync(sidecarPath), true);
    const registeredSha256 = readFileSync(sidecarPath, "utf8")
      .trim()
      .split(/\s+/)[0];
    assert.equal(sha256File(absolutePath), registeredSha256);
  }
});

test("v10 preflight is hash-bound and records pre-run output absence", () => {
  const value = preregistration();
  const parsed = assertFrozenBuildCommand(value);
  assert.equal(parsed.workers, 4);
  assert.equal(parsed.materializationProfile, "evaluation-only");
  assert.equal(
    parsed.companionNeighborPolicyOofCachePath,
    value.companion.path
  );
  const preflightPath = resolve(
    projectRoot,
    "data",
    "prediction-models",
    "development-cache",
    "zhejiang-v1-20260715-spatial-feature-diagnostic-v10-preflight.json"
  );
  const preflight = JSON.parse(
    readFileSync(preflightPath, "utf8")
  );
  assert.equal(preflight.ok, true);
  assert.equal(preflight.outputsAbsent, true);
  assert.equal(preflight.sealedPanelViewed, false);
  assert.equal(
    preflight.companionNeighborCacheSha256,
    value.companion.fileSha256
  );
  assert.equal(
    sha256File(preflightPath),
    "c72b2d0b6f1128975941e565f28fa6f8b1105f1e9d87bde0e15821a178c7b270"
  );
  assert.equal(
    String(
      readFileSync(`${preflightPath}.sha256`, "utf8")
    ).trim().split(/\s+/)[0],
    sha256File(preflightPath)
  );
});
