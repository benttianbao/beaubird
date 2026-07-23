"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const test = require("node:test");

const {
  CONTINUOUS_HABITAT_KERNEL_CONTRACT
} = require("../server/prediction/continuous-habitat");
const {
  CONTINUOUS_HABITAT_FEATURE_CONTRACT,
  loadHabitatFeatureSet
} = require("../server/prediction/habitat-features");
const {
  SPATIAL_OOF_CACHE_EVIDENCE_CONTRACT_SHA256,
  SPATIAL_OOF_CACHE_KIND,
  SPATIAL_OOF_CACHE_SCHEMA_VERSION,
  sha256File,
  spatialOofCacheGenerationImplementationSha256
} = require("../server/prediction/spatial-oof-cache");
const {
  SPATIAL_CANDIDATE_SCORER_SCHEMA_VERSION,
  spatialCandidateScorerImplementationSha256
} = require("../server/prediction/spatial-candidate-scorer");
const { canonicalJson } = require("../server/prediction/spatial-splits");
const {
  PRODUCTION_QUALITY_GATE,
  predictionImplementationSha256
} = require("./build-zhejiang-prediction-model");
const {
  habitatFeatureGenerationImplementationSha256
} = require("./build-zhejiang-habitat-features");
const { tileFileName } = require("./download-worldcover-tiles");

const projectRoot = resolve(__dirname, "..");
const preregistrationPath = resolve(
  projectRoot,
  "docs",
  "zhejiang-v1-20260715-continuous-habitat-v7-preregistration.json"
);

function kernelContractSha256() {
  return createHash("sha256")
    .update(canonicalJson(CONTINUOUS_HABITAT_KERNEL_CONTRACT))
    .digest("hex");
}

test("v7 preregistration binds the executable contracts and unchanged gates", () => {
  const preregistration = JSON.parse(readFileSync(preregistrationPath, "utf8"));
  assert.equal(preregistration.generatedAt, undefined);
  assert.equal(preregistration.status, "frozen_before_long_development_build");
  assert.deepEqual(
    preregistration.continuousHabitatKernel,
    CONTINUOUS_HABITAT_KERNEL_CONTRACT
  );
  assert.deepEqual(preregistration.qualityThresholds, PRODUCTION_QUALITY_GATE);
  assert.equal(
    preregistration.strictCache.schemaVersion,
    SPATIAL_OOF_CACHE_SCHEMA_VERSION
  );
  assert.equal(preregistration.strictCache.kind, SPATIAL_OOF_CACHE_KIND);
  assert.equal(
    preregistration.candidateScoring.schemaVersion,
    SPATIAL_CANDIDATE_SCORER_SCHEMA_VERSION
  );
  assert.equal(
    preregistration.implementation.predictionImplementationSha256,
    predictionImplementationSha256()
  );
  assert.equal(
    preregistration.implementation.cacheGenerationImplementationSha256,
    spatialOofCacheGenerationImplementationSha256()
  );
  assert.equal(
    preregistration.implementation.cacheEvidenceContractSha256,
    SPATIAL_OOF_CACHE_EVIDENCE_CONTRACT_SHA256
  );
  assert.equal(
    preregistration.implementation.scorerImplementationSha256,
    spatialCandidateScorerImplementationSha256()
  );
  assert.equal(
    preregistration.implementation.kernelContractSha256,
    kernelContractSha256()
  );
  assert.equal(
    preregistration.bindings.featureGenerationImplementationSha256,
    habitatFeatureGenerationImplementationSha256()
  );
  assert.equal(preregistration.stopPolicy.sealedForbiddenDuringThisPlan, true);
  assert.equal(
    preregistration.stopPolicy.defaultOfflineModelOverwriteForbidden,
    true
  );
});

test("available fixed inputs match every preregistered SHA binding", () => {
  const preregistration = JSON.parse(readFileSync(preregistrationPath, "utf8"));
  const inputs = [
    [
      "sourceSnapshotSha256",
      "data/prediction-snapshots/zhejiang-v1-20260715.sqlite"
    ],
    [
      "spatialSplitFileSha256",
      "docs/zhejiang-v1-20260715-spatial-splits.json"
    ],
    [
      "featureFileSha256",
      "data/prediction-features/zhejiang-v1-20260715-worldcover-h3-r6-continuous-v2.json"
    ],
    [
      "tileManifestFileSha256",
      "data/prediction-features/zhejiang-v1-20260715-worldcover-h3-r6-continuous-v2.json.tiles.json"
    ],
    [
      "targetIndependentPreflightAuditSha256",
      "data/prediction-models/development-cache/zhejiang-v1-20260715-continuous-habitat-v7-preregister-audit.json"
    ]
  ];
  for (const [binding, relativePath] of inputs) {
    const absolutePath = resolve(projectRoot, relativePath);
    if (!existsSync(absolutePath)) continue;
    assert.equal(
      sha256File(absolutePath),
      preregistration.bindings[binding],
      relativePath
    );
  }
  const featurePath = resolve(
    projectRoot,
    "data/prediction-features/zhejiang-v1-20260715-worldcover-h3-r6-continuous-v2.json"
  );
  if (existsSync(featurePath)) {
    const features = loadHabitatFeatureSet(featurePath, {
      expectedSnapshotSha256: preregistration.bindings.sourceSnapshotSha256,
      expectedContractId: CONTINUOUS_HABITAT_FEATURE_CONTRACT.id
    });
    assert.equal(
      features.featureSetSha256,
      preregistration.bindings.featureSetSha256
    );
    assert.equal(
      features.tileManifestSha256,
      preregistration.bindings.tileManifestSha256
    );
    assert.equal(
      features.generationImplementationSha256,
      preregistration.bindings.featureGenerationImplementationSha256
    );
    assert.equal(features.summary.cellCount, preregistration.featureCoverage.featureH3R6Count);
  }
  for (const tile of preregistration.officialWorldCoverTiles) {
    const tilePath = resolve(
      projectRoot,
      "data/prediction-features/worldcover-2021-v200",
      tileFileName(tile.tileId)
    );
    if (!existsSync(tilePath)) continue;
    assert.equal(sha256File(tilePath), tile.fileSha256, tile.tileId);
  }
});
