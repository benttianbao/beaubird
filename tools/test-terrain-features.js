"use strict";

const assert = require("node:assert/strict");
const { latLngToCell } = require("h3-js");

const {
  TERRAIN_FEATURE_CONTRACT,
  TERRAIN_FEATURE_KIND,
  TERRAIN_FEATURE_SCHEMA_VERSION,
  normalizationForCells,
  terrainVector,
  validateTerrainFeatureSet
} = require("../server/prediction/terrain-features");

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const SHA_C = "c".repeat(64);
const SHA_D = "d".repeat(64);
const SHA_E = "e".repeat(64);

function availableCell(latitude, longitude, elevation, relief, slope) {
  return {
    h3Index: latLngToCell(latitude, longitude, 6),
    available: true,
    elevationSampleCount: 100,
    slopeSampleCount: 90,
    meanElevationMeters: elevation,
    elevationStdDevMeters: relief,
    meanSlopeDegrees: slope
  };
}

const cells = [
  availableCell(30.1, 120.1, 10, 5, 2),
  availableCell(29.3, 119.2, 110, 25, 12),
  availableCell(28.2, 118.3, 210, 45, 22),
  {
    h3Index: latLngToCell(27.5, 121.1, 6),
    available: false,
    elevationSampleCount: 0,
    slopeSampleCount: 0,
    meanElevationMeters: null,
    elevationStdDevMeters: null,
    meanSlopeDegrees: null
  }
].sort((left, right) => left.h3Index.localeCompare(right.h3Index));

const normalization = normalizationForCells(cells);
const payload = {
  schemaVersion: TERRAIN_FEATURE_SCHEMA_VERSION,
  kind: TERRAIN_FEATURE_KIND,
  contract: TERRAIN_FEATURE_CONTRACT,
  snapshotSha256: SHA_A,
  cellCatalogFileSha256: SHA_B,
  cellCatalogFeatureSetSha256: SHA_C,
  tileManifestSha256: SHA_D,
  generationImplementationSha256: SHA_E,
  normalization,
  cells
};
const validated = validateTerrainFeatureSet(payload, {
  expectedSnapshotSha256: SHA_A,
  expectedCellCatalogFileSha256: SHA_B,
  expectedCellCatalogFeatureSetSha256: SHA_C,
  requiredH3Indexes: cells.map((cell) => cell.h3Index)
});
assert.equal(validated.summary.cellCount, 4);
assert.equal(validated.summary.availableCellCount, 3);
assert.equal(validated.summary.missingCellCount, 1);
assert.equal(validated.featureSetSha256.length, 64);
assert.deepEqual(
  terrainVector(
    validated.cells.find((cell) => !cell.available),
    validated
  ),
  [0, 0, 0],
  "missing terrain uses the frozen neutral standardized vector"
);
const standardized = terrainVector(
  validated.cells.find(
    (cell) => cell.available && cell.meanElevationMeters === 110
  ),
  validated
);
assert.ok(
  standardized.every((value) => Math.abs(value) <= 1e-12),
  "population midpoint is standardized deterministically"
);

assert.throws(
  () =>
    validateTerrainFeatureSet({
      ...payload,
      normalization: {
        ...normalization,
        means: [
          normalization.means[0] + 1,
          ...normalization.means.slice(1)
        ]
      }
    }),
  (error) =>
    error.code === "TERRAIN_FEATURE_NORMALIZATION_MISMATCH"
);
assert.throws(
  () => {
    const incompleteCells = payload.cells.slice(1);
    return validateTerrainFeatureSet({
      ...payload,
      normalization: normalizationForCells(incompleteCells),
      cells: incompleteCells
    }, {
      requiredH3Indexes: payload.cells.map((cell) => cell.h3Index)
    });
  },
  (error) =>
    error.code ===
    "TERRAIN_FEATURE_COVERAGE_EXACT_MISMATCH"
);
assert.throws(
  () => {
    const extraCell = availableCell(
      26.5,
      122.5,
      50,
      10,
      5
    );
    const cellsWithExtra = [...payload.cells, extraCell]
      .sort((left, right) =>
        left.h3Index.localeCompare(right.h3Index)
      );
    return validateTerrainFeatureSet(
      {
        ...payload,
        normalization:
          normalizationForCells(cellsWithExtra),
        cells: cellsWithExtra
      },
      {
        requiredH3Indexes: payload.cells.map(
          (cell) => cell.h3Index
        )
      }
    );
  },
  (error) =>
    error.code ===
    "TERRAIN_FEATURE_COVERAGE_EXACT_MISMATCH"
);
assert.throws(
  () =>
    validateTerrainFeatureSet({
      ...payload,
      cells: payload.cells.map((cell, index) =>
        index === 0
          ? {
              ...cell,
              available: false,
              meanElevationMeters: null,
              elevationStdDevMeters: null,
              meanSlopeDegrees: null
            }
          : cell
      )
    }),
  (error) => error.code === "TERRAIN_FEATURE_MISSING_POLICY_INVALID"
);

process.stdout.write("terrain feature contract tests passed\n");
