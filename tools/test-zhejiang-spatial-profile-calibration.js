"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  SPATIAL_PROFILE_CALIBRATION_CONTRACT,
  attachProfiles,
  baseScope,
  buildSpatialProfileCalibrationReport,
  crossFitFamily,
  spatialProfileCalibrationImplementationSha256,
  validateSpatialProfileCalibrationPreregistration
} = require("../server/prediction/spatial-profile-calibration-candidate");
const {
  compactMetrics
} = require("../server/prediction/spatial-candidate-scorer");
const {
  canonicalJson
} = require("../server/prediction/spatial-splits");
const { createHash } = require("node:crypto");

function syntheticFold(outerFoldId) {
  const scoreRows = [];
  const contexts = [];
  for (let contextIndex = 0; contextIndex < 8; contextIndex += 1) {
    const profileId =
      contextIndex % 2 === 0 ? "profile_a" : "profile_b";
    const rawProbability =
      profileId === "profile_a" ? 0.8 : 0.2;
    const observedRate =
      profileId === "profile_a" ? 0.2 : 0.8;
    contexts.push({
      contextIndex,
      profileId,
      profileIndex: profileId === "profile_a" ? 0 : 1,
      seasonWeek: 10
    });
    scoreRows.push({
      contextIndex,
      taxonId: "public_taxon",
      positiveCount: 250,
      total: 10,
      actualPositive: observedRate * 10,
      rawProbability,
      baselineProbability: 0.5,
      deepestLevel: "habitat_continuous"
    });
  }
  return {
    neighbor: {
      outerFoldId: String(outerFoldId),
      contextCount: contexts.length,
      scoreRows
    },
    contexts
  };
}

function syntheticCaches() {
  const folds = new Map(
    ["1", "2", "3", "4", "5"].map((foldId) => [
      foldId,
      syntheticFold(foldId)
    ])
  );
  return {
    neighborCache: {
      fileSha256: "a".repeat(64),
      readFold({ outerFoldId }) {
        return folds.get(String(outerFoldId)).neighbor;
      }
    },
    featureCache: {
      fileSha256: "b".repeat(64),
      readFoldContexts({ outerFoldId }) {
        return folds.get(String(outerFoldId)).contexts;
      }
    },
    folds
  };
}

test("v11 profile calibration is deterministic and improves profile-confounded residuals", () => {
  const { neighborCache, featureCache, folds } =
    syntheticCaches();
  const attached = [...folds.values()].map(({ neighbor, contexts }) =>
    attachProfiles(neighbor, contexts)
  );
  const control = crossFitFamily(
    attached,
    baseScope,
    "existing_spatial_beta_calibration_control"
  );
  const v10Report = {
    releaseQuality: {
      spatial: {
        metrics: control.metrics
      }
    }
  };
  const first = buildSpatialProfileCalibrationReport({
    neighborCache,
    featureCache,
    v10Report
  });
  const second = buildSpatialProfileCalibrationReport({
    neighborCache,
    featureCache,
    v10Report
  });
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(first.control.familyId, control.familyId);
  assert.deepEqual(
    first.control.metrics,
    compactMetrics(control.metrics)
  );
  assert.ok(
    first.candidate.metrics.calibrationEce.species.maximumEce <
      first.control.metrics.calibrationEce.species.maximumEce
  );
  assert.equal(
    first.contract.value.seasonFeatureEnabled,
    false
  );
  assert.equal(first.sealedPanelViewed, false);
  assert.equal(first.defaultModelModified, false);
});

test("v11 rejects a context layout mismatch", () => {
  const { neighborCache, featureCache } = syntheticCaches();
  const fold = neighborCache.readFold({ outerFoldId: "1" });
  const contexts = featureCache
    .readFoldContexts({ outerFoldId: "1" })
    .slice(1);
  assert.throws(
    () => attachProfiles(fold, contexts),
    (error) =>
      error.code === "SPATIAL_PROFILE_CONTEXT_LAYOUT_MISMATCH"
  );
});

test("v11 preregistration binds the frozen contract and implementation", () => {
  const contractSha256 = createHash("sha256")
    .update(canonicalJson(SPATIAL_PROFILE_CALIBRATION_CONTRACT))
    .digest("hex");
  const preregistration = {
    schemaVersion: 1,
    kind: "zhejiang_spatial_profile_calibration_v11_preregistration",
    status: "frozen_before_single_development_diagnostic",
    contract: {
      sha256: contractSha256,
      value: SPATIAL_PROFILE_CALIBRATION_CONTRACT
    },
    implementation: {
      scorerImplementationSha256:
        spatialProfileCalibrationImplementationSha256()
    },
    inputs: {
      neighborCacheSha256: "a".repeat(64),
      neighborCacheGenerationImplementationSha256: "e".repeat(64),
      featureCacheSha256: "b".repeat(64),
      v10ReportSha256: "c".repeat(64)
    },
    outputs: {
      diagnosticPath: "out.json"
    },
    changeControl: {
      diagnosticOnly: true,
      developmentOnly: true,
      qualityThresholdsChanged: false,
      sealedDataRead: false,
      defaultModelModified: false,
      runtimeIntegrationForbidden: true,
      referenceMaterializationForbidden: true
    }
  };
  assert.equal(
    validateSpatialProfileCalibrationPreregistration(
      preregistration,
      {
        neighborCacheSha256: "a".repeat(64),
        neighborCacheGenerationImplementationSha256: "e".repeat(64),
        featureCacheSha256: "b".repeat(64),
        v10ReportSha256: "c".repeat(64),
        outputPath: "out.json"
      }
    ),
    true
  );
  preregistration.inputs.featureCacheSha256 = "d".repeat(64);
  assert.throws(
    () =>
      validateSpatialProfileCalibrationPreregistration(
        preregistration,
        {
          neighborCacheSha256: "a".repeat(64),
          neighborCacheGenerationImplementationSha256: "e".repeat(64),
          featureCacheSha256: "b".repeat(64),
          v10ReportSha256: "c".repeat(64),
          outputPath: "out.json"
        }
      ),
    (error) =>
      error.code === "SPATIAL_PROFILE_PREREGISTRATION_MISMATCH"
  );
});
