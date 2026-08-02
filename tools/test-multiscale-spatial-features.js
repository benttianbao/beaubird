"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { gridDisk, latLngToCell } = require("h3-js");

const {
  CONTINUOUS_HABITAT_FEATURE_CONTRACT,
  WORLDCOVER_CLASS_CODES
} = require("../server/prediction/habitat-features");
const {
  MULTISCALE_SPATIAL_FEATURE_CONTRACT,
  MULTISCALE_SPATIAL_FEATURE_MINIMUM_PUBLIC_CELLS,
  MULTISCALE_SPATIAL_FEATURE_NAMES,
  buildMultiscaleSpatialFeatureProfiles,
  multiscaleSpatialFeatureContractSha256,
  multiscaleSpatialFeatureVector,
  serializableMultiscaleSpatialFeatureProfiles
} = require("../server/prediction/multiscale-spatial-features");

function fractionsForIndex(index) {
  const primary = index % WORLDCOVER_CLASS_CODES.length;
  const secondary =
    (index * 5 + 3) % WORLDCOVER_CLASS_CODES.length;
  const tertiary =
    (index * 7 + 1) % WORLDCOVER_CLASS_CODES.length;
  const values = Object.fromEntries(
    WORLDCOVER_CLASS_CODES.map((code) => [String(code), 0])
  );
  values[String(WORLDCOVER_CLASS_CODES[primary])] += 0.6;
  values[String(WORLDCOVER_CLASS_CODES[secondary])] += 0.3;
  values[String(WORLDCOVER_CLASS_CODES[tertiary])] += 0.1;
  return values;
}

function syntheticFeatureSet() {
  const center = latLngToCell(30.27, 120.15, 6);
  const indexes = gridDisk(center, 18).sort();
  const cells = indexes.map((h3Index, index) => ({
    h3Index,
    coverage: 0.9 + (index % 11) / 110,
    classFractions: fractionsForIndex(index)
  }));
  return {
    contract: CONTINUOUS_HABITAT_FEATURE_CONTRACT,
    featureSetSha256: "a".repeat(64),
    cells,
    cellsByH3: new Map(
      cells.map((cell) => [cell.h3Index, cell])
    )
  };
}

test("multiscale contract preserves 11 classes at three exact rings", () => {
  const featureSet = syntheticFeatureSet();
  const target = featureSet.cells[Math.floor(featureSet.cells.length / 2)];
  const vector = multiscaleSpatialFeatureVector(
    target.h3Index,
    featureSet
  );
  assert.equal(MULTISCALE_SPATIAL_FEATURE_NAMES.length, 40);
  assert.equal(vector.length, 40);
  assert.deepEqual(
    MULTISCALE_SPATIAL_FEATURE_CONTRACT.classCodes,
    WORLDCOVER_CLASS_CODES
  );
  assert.deepEqual(
    MULTISCALE_SPATIAL_FEATURE_CONTRACT.scales.map(
      (scale) => scale.ringDistance
    ),
    [0, 1, 2]
  );
  assert.ok(vector.every(Number.isFinite));
  assert.ok(vector.slice(33).every((value) => value >= 0 && value <= 1));
  assert.match(
    multiscaleSpatialFeatureContractSha256(),
    /^[0-9a-f]{64}$/
  );
});

test("profile fitting is deterministic and enforces public support", () => {
  const featureSet = syntheticFeatureSet();
  const first = buildMultiscaleSpatialFeatureProfiles(featureSet);
  const second = buildMultiscaleSpatialFeatureProfiles({
    ...featureSet,
    cells: [...featureSet.cells].reverse()
  });
  assert.equal(
    first.profileModelSha256,
    second.profileModelSha256
  );
  assert.deepEqual(first.profiles, second.profiles);
  assert.equal(first.profileByH3.size, featureSet.cells.length);
  assert.ok(
    first.profiles.every(
      (profile) =>
        profile.publicCellCount >=
        MULTISCALE_SPATIAL_FEATURE_MINIMUM_PUBLIC_CELLS
    )
  );
  const serialized =
    serializableMultiscaleSpatialFeatureProfiles(first);
  assert.equal("profileByH3" in serialized, false);
  assert.equal(
    JSON.stringify(serialized).includes(featureSet.cells[0].h3Index),
    false
  );
  assert.equal(
    serialized.normalization.featureNames.length,
    MULTISCALE_SPATIAL_FEATURE_NAMES.length
  );
});
