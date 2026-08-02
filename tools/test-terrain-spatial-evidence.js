"use strict";

const assert = require("node:assert/strict");

const {
  CONTINUOUS_HABITAT_KERNEL_CONTRACT,
  selectContinuousHabitatNeighbors
} = require("../server/prediction/continuous-habitat");
const {
  TERRAIN_SPATIAL_EVIDENCE_CONTRACT,
  selectTerrainAugmentedNeighbors,
  terrainRmsDistance,
  terrainSpatialEvidenceContractSha256
} = require("../server/prediction/terrain-spatial-evidence");

const habitat = [0.6, 0.1, 0.1, 0.1, 0.1];
const candidates = [
  {
    unitId: "grid_r6:a",
    cityName: "city:hangzhou",
    habitatVector: habitat,
    terrainVector: [3, 3, 3]
  },
  {
    unitId: "grid_r6:b",
    cityName: "city:hangzhou",
    habitatVector: habitat,
    terrainVector: [0.1, 0.1, 0.1]
  },
  {
    unitId: "grid_r6:c",
    cityName: "city:ningbo",
    habitatVector: habitat,
    terrainVector: [0, 0, 0]
  },
  ...["d", "e", "f", "g", "h", "i"].map((suffix, index) => ({
    unitId: `grid_r6:${suffix}`,
    cityName: "city:hangzhou",
    habitatVector: habitat,
    terrainVector: [1 + index, 1 + index, 1 + index]
  }))
];

const control = selectContinuousHabitatNeighbors({
  targetUnitId: "grid_r6:target",
  targetCityName: "city:hangzhou",
  targetVector: habitat,
  candidates: candidates.map((candidate) => ({
    unitId: candidate.unitId,
    cityName: candidate.cityName,
    vector: candidate.habitatVector
  })),
  contract: CONTINUOUS_HABITAT_KERNEL_CONTRACT
});
assert.equal(
  control.neighbors[0].unitId,
  "grid_r6:a",
  "WorldCover-only control preserves lexical tie break"
);

const terrain = selectTerrainAugmentedNeighbors({
  targetUnitId: "grid_r6:target",
  targetCityName: "city:hangzhou",
  targetHabitatVector: habitat,
  targetTerrainVector: [0, 0, 0],
  candidates,
  contract: TERRAIN_SPATIAL_EVIDENCE_CONTRACT
});
assert.equal(
  terrain.neighbors[0].unitId,
  "grid_r6:b",
  "terrain similarity enters neighbor ranking"
);
assert.ok(
  terrain.neighbors[0].weight > terrain.neighbors[1].weight,
  "terrain similarity enters neighbor weight"
);
assert.ok(
  Math.abs(terrainRmsDistance([0, 0, 0], [1, 1, 1]) - 1) <
    1e-12
);
assert.match(
  terrainSpatialEvidenceContractSha256(),
  /^[0-9a-f]{64}$/
);
assert.throws(
  () =>
    selectTerrainAugmentedNeighbors({
      targetUnitId: "grid_r6:target",
      targetCityName: "city:hangzhou",
      targetHabitatVector: habitat,
      targetTerrainVector: [0, 0, 0],
      candidates,
      contract: {
        ...TERRAIN_SPATIAL_EVIDENCE_CONTRACT,
        neighborCount: 12
      }
    }),
  (error) => error.code === "TERRAIN_SPATIAL_CONTRACT_MISMATCH"
);

process.stdout.write("terrain spatial evidence tests passed\n");
