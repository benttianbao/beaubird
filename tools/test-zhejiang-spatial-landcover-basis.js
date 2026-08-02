"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  SPATIAL_LANDCOVER_BASIS_CONTRACT,
  SpatialLandcoverBasisError,
  applyLandcoverResidual,
  attachBasis,
  buildLandcoverBasis,
  fitLandcoverResidual
} = require("../server/prediction/spatial-landcover-basis-candidate");

function syntheticFeatureCache() {
  const featureNames = [
    "local.worldcover_10",
    "local.worldcover_40",
    "local.worldcover_50",
    "local.worldcover_80",
    "local.worldcover_90",
    "local.worldcover_95"
  ];
  return {
    metadata: {
      profileModelSha256:
        SPATIAL_LANDCOVER_BASIS_CONTRACT
          .sourceProfileModelSha256,
      featureNames,
      normalization: {
        featureNames,
        means: featureNames.map(() => 0),
        standardDeviations: featureNames.map(() => 1)
      }
    },
    profiles: [
      {
        profileId: "forest",
        publicCellCount: 100,
        standardizedCentroid: [0.8, 0.1, 0.05, 0.03, 0.01, 0.01]
      },
      {
        profileId: "human",
        publicCellCount: 100,
        standardizedCentroid: [0.1, 0.45, 0.35, 0.05, 0.03, 0.02]
      },
      {
        profileId: "water",
        publicCellCount: 100,
        standardizedCentroid: [0.04, 0.02, 0.02, 0.86, 0.04, 0.02]
      }
    ]
  };
}

test("v12 freezes one continuous public land-cover basis", () => {
  assert.deepEqual(
    SPATIAL_LANDCOVER_BASIS_CONTRACT.basis.features.map(
      (feature) => feature.id
    ),
    [
      "local_forest",
      "local_human_modified",
      "local_aquatic"
    ]
  );
  assert.equal(
    SPATIAL_LANDCOVER_BASIS_CONTRACT.seasonFeatureEnabled,
    false
  );
  assert.equal(
    SPATIAL_LANDCOVER_BASIS_CONTRACT
      .residualCalibration.ridge,
    10
  );
  const left = buildLandcoverBasis(syntheticFeatureCache());
  const right = buildLandcoverBasis(syntheticFeatureCache());
  assert.equal(left.basisModelSha256, right.basisModelSha256);
  for (let dimension = 0; dimension < 3; dimension += 1) {
    const weightedMean =
      left.profiles.reduce(
        (sum, profile) =>
          sum +
          profile.publicCellCount *
            profile.values[dimension],
        0
      ) / left.publicCellCount;
    assert.ok(Math.abs(weightedMean) < 1e-10);
  }
});

test("ridge residual shares a continuous effect across profiles", () => {
  const points = [];
  for (let index = 0; index < 20; index += 1) {
    points.push({
      probability: 0.2,
      basis: [-1, 0, 0],
      positives: 1,
      total: 10
    });
    points.push({
      probability: 0.2,
      basis: [1, 0, 0],
      positives: 4,
      total: 10
    });
  }
  const fit = fitLandcoverResidual(points);
  assert.equal(fit.fitted, true);
  const low = applyLandcoverResidual(0.2, [-0.5, 0, 0], fit);
  const high = applyLandcoverResidual(0.2, [0.5, 0, 0], fit);
  assert.ok(low < 0.2);
  assert.ok(high > 0.2);
  assert.ok(high > low);
  assert.deepEqual(fit, fitLandcoverResidual(points));
});

test("v12 rejects a context layout mismatch", () => {
  const basis = buildLandcoverBasis(syntheticFeatureCache());
  assert.throws(
    () =>
      attachBasis(
        {
          outerFoldId: 1,
          contextCount: 2,
          scoreRows: []
        },
        [
          {
            contextIndex: 0,
            profileId: "forest"
          }
        ],
        basis
      ),
    (error) =>
      error instanceof SpatialLandcoverBasisError &&
      error.code ===
        "SPATIAL_LANDCOVER_BASIS_CONTEXT_LAYOUT_MISMATCH"
  );
});
