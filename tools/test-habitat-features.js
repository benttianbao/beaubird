"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { latLngToCell } = require("h3-js");

const {
  CONTINUOUS_HABITAT_FEATURE_CONTRACT,
  CONTINUOUS_HABITAT_FEATURE_KIND,
  CONTINUOUS_HABITAT_FEATURE_SCHEMA_VERSION,
  HABITAT_FEATURE_CONTRACT,
  HABITAT_FEATURE_KIND,
  HABITAT_FEATURE_SCHEMA_VERSION,
  habitatClusterForFractions,
  habitatManifestSummary,
  validateHabitatFeatureSet
} = require("../server/prediction/habitat-features");

const SNAPSHOT_SHA256 = "9".repeat(64);
const TILE_MANIFEST_SHA256 = "8".repeat(64);

function fractions(overrides = {}) {
  return {
    "10": 0,
    "20": 0,
    "30": 0,
    "40": 0,
    "50": 0,
    "60": 0,
    "70": 0,
    "80": 0,
    "90": 0,
    "95": 0,
    "100": 0,
    ...overrides
  };
}

function featureSet(cells) {
  return {
    schemaVersion: HABITAT_FEATURE_SCHEMA_VERSION,
    kind: HABITAT_FEATURE_KIND,
    contract: HABITAT_FEATURE_CONTRACT,
    snapshotSha256: SNAPSHOT_SHA256,
    tileManifestSha256: TILE_MANIFEST_SHA256,
    generationImplementationSha256: "6".repeat(64),
    cells
  };
}

function continuousFeatureSet(cells) {
  return {
    schemaVersion: CONTINUOUS_HABITAT_FEATURE_SCHEMA_VERSION,
    kind: CONTINUOUS_HABITAT_FEATURE_KIND,
    contract: CONTINUOUS_HABITAT_FEATURE_CONTRACT,
    snapshotSha256: SNAPSHOT_SHA256,
    tileManifestSha256: TILE_MANIFEST_SHA256,
    generationImplementationSha256: "5".repeat(64),
    cells
  };
}

test("WorldCover 固定规则确定六类粗粒度生境", () => {
  assert.equal(habitatClusterForFractions(fractions({ "80": 0.25, "10": 0.75 })), "water_wetland");
  assert.equal(habitatClusterForFractions(fractions({ "50": 0.3, "10": 0.7 })), "urban");
  assert.equal(habitatClusterForFractions(fractions({ "10": 0.5, "40": 0.5 })), "forest");
  assert.equal(habitatClusterForFractions(fractions({ "40": 0.4, "10": 0.4, "30": 0.2 })), "cropland");
  assert.equal(habitatClusterForFractions(fractions({ "30": 0.51, "10": 0.49 })), "open");
  assert.equal(habitatClusterForFractions(fractions({ "10": 0.4, "40": 0.3, "50": 0.2, "30": 0.1 })), "mixed");
});

test("生境特征规范化不受输入顺序影响并绑定快照与 tile manifest", () => {
  const forestH3 = latLngToCell(30.25, 120.15, 6);
  const wetlandH3 = latLngToCell(29.87, 121.55, 6);
  const cells = [
    {
      h3Index: forestH3,
      coverage: 0.98,
      classFractions: fractions({ "10": 0.7, "40": 0.2, "50": 0.1 }),
      habitatCluster: "forest"
    },
    {
      h3Index: wetlandH3,
      coverage: 0.95,
      classFractions: fractions({ "80": 0.3, "90": 0.2, "40": 0.3, "50": 0.2 }),
      habitatCluster: "water_wetland"
    }
  ];
  const forward = validateHabitatFeatureSet(featureSet(cells), {
    expectedSnapshotSha256: SNAPSHOT_SHA256
  });
  const reverse = validateHabitatFeatureSet(featureSet([...cells].reverse()), {
    expectedSnapshotSha256: SNAPSHOT_SHA256
  });
  assert.equal(forward.featureSetSha256, reverse.featureSetSha256);
  assert.deepEqual(forward.cells, reverse.cells);
  assert.equal(forward.summary.cellCount, 2);
  assert.equal(forward.summary.clusterCounts.forest, 1);
  assert.equal(forward.summary.clusterCounts.water_wetland, 1);
  assert.equal(forward.cellsByH3.get(forestH3).habitatCluster, "forest");
  const summary = habitatManifestSummary({
    ...forward,
    fileSha256: "7".repeat(64)
  });
  assert.equal(summary.fileSha256, "7".repeat(64));
  assert.equal(summary.featureSetSha256, forward.featureSetSha256);
  assert.equal(summary.generationImplementationSha256, "6".repeat(64));
  assert.equal(summary.snapshotSha256, SNAPSHOT_SHA256);
  assert.equal(JSON.stringify(summary).includes(forestH3), false);
  assert.equal(Object.hasOwn(summary, "cells"), false);
});

test("生境特征对守恒、覆盖、重复 H3 和派生类别全部 fail-closed", () => {
  const h3Index = latLngToCell(30.25, 120.15, 6);
  const validCell = {
    h3Index,
    coverage: 0.95,
    classFractions: fractions({ "10": 0.7, "40": 0.3 }),
    habitatCluster: "forest"
  };
  assert.throws(
    () => validateHabitatFeatureSet(featureSet([{ ...validCell, coverage: 0.89 }])),
    (error) => error.code === "HABITAT_FEATURE_COVERAGE_INVALID"
  );
  assert.throws(
    () => validateHabitatFeatureSet(featureSet([
      { ...validCell, classFractions: fractions({ "10": 0.7, "40": 0.2 }) }
    ])),
    (error) => error.code === "HABITAT_FEATURE_FRACTIONS_NOT_CONSERVED"
  );
  assert.throws(
    () => validateHabitatFeatureSet(featureSet([
      { ...validCell, habitatCluster: "urban" }
    ])),
    (error) => error.code === "HABITAT_FEATURE_CLUSTER_MISMATCH"
  );
  assert.throws(
    () => validateHabitatFeatureSet(featureSet([validCell, validCell])),
    (error) => error.code === "HABITAT_FEATURE_H3_DUPLICATE"
  );
  assert.throws(
    () => validateHabitatFeatureSet(featureSet([validCell]), {
      expectedSnapshotSha256: "1".repeat(64)
    }),
    (error) => error.code === "HABITAT_FEATURE_SNAPSHOT_MISMATCH"
  );
});

test("连续 v2 特征要求显式契约并可校验训练 H3 全覆盖", () => {
  const firstH3 = latLngToCell(30.25, 120.15, 6);
  const secondH3 = latLngToCell(29.87, 121.55, 6);
  const validated = validateHabitatFeatureSet(continuousFeatureSet([
    {
      h3Index: firstH3,
      coverage: 1,
      classFractions: fractions({ "10": 0.45, "40": 0.35, "50": 0.2 })
    },
    {
      h3Index: secondH3,
      coverage: 0.99,
      classFractions: fractions({ "80": 0.6, "90": 0.2, "40": 0.2 })
    }
  ]), {
    expectedSnapshotSha256: SNAPSHOT_SHA256,
    expectedContractId: CONTINUOUS_HABITAT_FEATURE_CONTRACT.id,
    requiredH3Indexes: [secondH3, firstH3]
  });
  assert.equal(validated.contract.id, CONTINUOUS_HABITAT_FEATURE_CONTRACT.id);
  assert.equal(validated.summary.cellCount, 2);
  assert.throws(
    () => validateHabitatFeatureSet(continuousFeatureSet(validated.cells), {
      requiredH3Indexes: [latLngToCell(28.1, 119.1, 6)]
    }),
    (error) => error.code === "HABITAT_FEATURE_COVERAGE_INCOMPLETE"
  );
  assert.throws(
    () => validateHabitatFeatureSet(continuousFeatureSet(validated.cells), {
      expectedContractId: HABITAT_FEATURE_CONTRACT.id
    }),
    (error) => error.code === "HABITAT_FEATURE_CONTRACT_MISMATCH"
  );
});
