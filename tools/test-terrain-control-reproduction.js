"use strict";

const assert = require("node:assert/strict");

const {
  DEFAULT_OPTIONS,
  evaluationProbability
} = require("./build-zhejiang-prediction-model");
const {
  CONTINUOUS_HABITAT_KERNEL_CONTRACT
} = require("../server/prediction/continuous-habitat");
const {
  TERRAIN_SPATIAL_EVIDENCE_CONTRACT
} = require("../server/prediction/terrain-spatial-evidence");

function weekly(value) {
  const values = Array(53).fill(0);
  values[26] = value;
  return values;
}

const taxonId = "4004";
const exposures = new Map([
  ["province:zhejiang", weekly(100)],
  ["grid_r6:a", weekly(10)],
  ["grid_r6:b", weekly(10)]
]);
const hits = new Map([
  [`province:zhejiang\u0000${taxonId}`, weekly(5)],
  [`grid_r6:a\u0000${taxonId}`, weekly(1)],
  [`grid_r6:b\u0000${taxonId}`, weekly(8)]
]);
const supports = new Map([
  [
    "province:zhejiang",
    {
      checklists: 100,
      observers: 10
    }
  ]
]);
const controlNeighbors = [
  { unitId: "grid_r6:a", weight: 0.75 },
  { unitId: "grid_r6:b", weight: 0.25 }
];
const terrainNeighbors = [
  { unitId: "grid_r6:a", weight: 0.2 },
  { unitId: "grid_r6:b", weight: 0.8 }
];
const baseContext = {
  season_week: 26,
  province_unit: "province:zhejiang",
  city_unit: null,
  district_unit: null,
  habitat_unit: null,
  grid_r6_unit: "grid_r6:target",
  grid_r7_unit: null,
  point_unit: null
};
const baseOptions = {
  ...DEFAULT_OPTIONS,
  habitatModel:
    CONTINUOUS_HABITAT_KERNEL_CONTRACT.id,
  continuousHabitatKernel:
    CONTINUOUS_HABITAT_KERNEL_CONTRACT
};
const common = {
  taxonId,
  taxonPositiveCount: 240,
  exposures,
  hits,
  supports,
  bandwidthDays: 14
};
const terrainResult = evaluationProbability({
  ...common,
  context: {
    ...baseContext,
    continuousHabitat: {
      scope: "same_city",
      neighbors: terrainNeighbors
    },
    continuousHabitatControl: {
      scope: "same_city",
      neighbors: controlNeighbors
    }
  },
  options: {
    ...baseOptions,
    terrainModel:
      TERRAIN_SPATIAL_EVIDENCE_CONTRACT.id,
    terrainSpatialEvidenceContract:
      TERRAIN_SPATIAL_EVIDENCE_CONTRACT
  }
});
const controlResult = evaluationProbability({
  ...common,
  context: {
    ...baseContext,
    continuousHabitat: {
      scope: "same_city",
      neighbors: controlNeighbors
    }
  },
  options: {
    ...baseOptions,
    terrainModel: null
  }
});

assert.ok(
  Math.abs(
    terrainResult.terrainControlProbability -
      controlResult.probability
  ) <= 1e-12,
  JSON.stringify({
    terrainControlProbability:
      terrainResult.terrainControlProbability,
    controlRawProbability:
      controlResult.probability,
    terrainControlHabitatEvidence:
      terrainResult.terrainControlHabitatEvidence,
    controlHabitatEvidence:
      controlResult.habitatEvidence
  })
);
assert.deepEqual(
  terrainResult.terrainControlHabitatEvidence,
  controlResult.habitatEvidence
);
assert.notEqual(
  terrainResult.probability,
  controlResult.probability
);

process.stdout.write(
  "terrain control reproduction tests passed\n"
);
