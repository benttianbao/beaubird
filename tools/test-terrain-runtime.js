"use strict";

const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");

const {
  createArtifactSchema
} = require("./build-zhejiang-prediction-model");
const {
  CONTINUOUS_HABITAT_KERNEL_CONTRACT
} = require("../server/prediction/continuous-habitat");
const {
  PredictionModel
} = require("../server/prediction/model");
const {
  TERRAIN_FEATURE_CONTRACT
} = require("../server/prediction/terrain-features");
const {
  TERRAIN_SPATIAL_EVIDENCE_CONTRACT,
  selectTerrainAugmentedNeighbors
} = require("../server/prediction/terrain-spatial-evidence");

function setManifest(database, key, value) {
  database.prepare(
    "INSERT INTO manifest(key, value) VALUES (?, ?)"
  ).run(key, JSON.stringify(value));
}

function insertUnit(
  database,
  { id, level, code, parentId = null, supported = 1 }
) {
  database.prepare(`
    INSERT INTO space_units
      (id, level, code, name, parent_id, city_name,
       district_name, checklist_count, observer_count,
       support_years_json, supported)
    VALUES (?, ?, ?, ?, ?, '测试市', '', 100, 10, '[2025]', ?)
  `).run(id, level, code, id, parentId, supported);
}

function createDatabase(terrainEnabled) {
  const database = new DatabaseSync(":memory:");
  createArtifactSchema(database);
  setManifest(database, "schema_version", "2");
  setManifest(database, "model_version", "terrain-runtime-test");
  setManifest(database, "quality_gate", { passed: true });
  setManifest(database, "test_only", true);
  setManifest(database, "temporal_bandwidth_days", 14);
  setManifest(
    database,
    "habitat_model",
    CONTINUOUS_HABITAT_KERNEL_CONTRACT.id
  );
  setManifest(database, "habitat_features", {
    contractId:
      CONTINUOUS_HABITAT_KERNEL_CONTRACT
        .featureContractId,
    fileSha256: "a".repeat(64),
    featureSetSha256: "b".repeat(64),
    cellCount: 3
  });
  setManifest(
    database,
    "continuous_habitat_kernel",
    CONTINUOUS_HABITAT_KERNEL_CONTRACT
  );
  if (terrainEnabled) {
    setManifest(database, "terrain_features", {
      contractId: TERRAIN_FEATURE_CONTRACT.id,
      cellCatalogFileSha256: "a".repeat(64),
      cellCatalogFeatureSetSha256: "b".repeat(64),
      cellCount: 3,
      availableCellCount: 3
    });
    setManifest(
      database,
      "terrain_spatial_evidence_model",
      TERRAIN_SPATIAL_EVIDENCE_CONTRACT
    );
  } else {
    setManifest(
      database,
      "terrain_spatial_evidence_model",
      null
    );
  }
  database.prepare(`
    INSERT INTO taxa
      (taxon_id, common_name, positive_count,
       observer_count, calibration_scope)
    VALUES ('4004', '测试鸟', 240, 10, 'none')
  `).run();
  insertUnit(database, {
    id: "province:zhejiang",
    level: "province",
    code: "zhejiang"
  });
  insertUnit(database, {
    id: "city:test",
    level: "city",
    code: "test",
    parentId: "province:zhejiang",
    supported: 0
  });
  for (const [id, code] of [
    ["grid:target", "target"],
    ["grid:a", "a"],
    ["grid:b", "b"]
  ]) {
    insertUnit(database, {
      id,
      level: "grid_r6",
      code,
      parentId: "city:test"
    });
  }
  const insertHabitat = database.prepare(`
    INSERT INTO continuous_habitat_features
      (h3_r6, forest, open, cropland, urban,
       water_wetland)
    VALUES (?, 1, 0, 0, 0, 0)
  `);
  for (const h3 of ["target", "a", "b"]) {
    insertHabitat.run(h3);
  }
  if (terrainEnabled) {
    const insertTerrain = database.prepare(`
      INSERT INTO terrain_features
        (h3_r6, available, elevation_sample_count,
         slope_sample_count, mean_elevation_m,
         elevation_stddev_m, mean_slope_deg,
         standardized_mean_elevation,
         standardized_elevation_stddev,
         standardized_mean_slope)
      VALUES (?, 1, 32, 32, 1, 1, 1, ?, ?, ?)
    `);
    insertTerrain.run("target", 0, 0, 0);
    insertTerrain.run("a", 0, 0, 0);
    insertTerrain.run("b", 6, 6, 6);
  }
  const insertExposure = database.prepare(`
    INSERT INTO checklist_exposure
      (space_unit_id, season_week,
       effective_checklists, raw_checklists,
       observer_count, support_years_json)
    VALUES (?, 26, ?, ?, 10, '[2025]')
  `);
  insertExposure.run("province:zhejiang", 100, 100);
  insertExposure.run("grid:a", 10, 10);
  insertExposure.run("grid:b", 10, 10);
  database.prepare(`
    INSERT INTO taxon_detection
      (space_unit_id, season_week, taxon_id,
       effective_detections, raw_detections,
       observer_count, support_years_json)
    VALUES ('province:zhejiang', 26, '4004', 1, 1, 1, '[2025]')
  `).run();
  database.prepare(`
    INSERT INTO taxon_detection
      (space_unit_id, season_week, taxon_id,
       effective_detections, raw_detections,
       observer_count, support_years_json)
    VALUES ('grid:b', 26, '4004', 10, 10, 10, '[2025]')
  `).run();
  return database;
}

const terrainDatabase = createDatabase(true);
const controlDatabase = createDatabase(false);
const terrainModel = new PredictionModel({
  database: terrainDatabase,
  testOnly: true
});
const controlModel = new PredictionModel({
  database: controlDatabase,
  testOnly: true
});
try {
  const terrainScore = terrainModel.scoreUnitTaxonAtWeek(
    "grid:target",
    "4004",
    26
  );
  const controlScore = controlModel.scoreUnitTaxonAtWeek(
    "grid:target",
    "4004",
    26
  );
  assert.ok(
    terrainScore.rawProbability <
      controlScore.rawProbability
  );
  const directSelection =
    selectTerrainAugmentedNeighbors({
      targetUnitId: "grid:target",
      targetCityName: "测试市",
      targetHabitatVector: [1, 0, 0, 0, 0],
      targetTerrainVector: [0, 0, 0],
      candidates: [
        {
          unitId: "grid:a",
          cityName: "测试市",
          habitatVector: [1, 0, 0, 0, 0],
          terrainVector: [0, 0, 0]
        },
        {
          unitId: "grid:b",
          cityName: "测试市",
          habitatVector: [1, 0, 0, 0, 0],
          terrainVector: [6, 6, 6]
        }
      ]
    });
  const expectedExposure = directSelection.neighbors.reduce(
    (sum, neighbor) => sum + neighbor.weight * 10,
    0
  );
  assert.ok(
    Math.abs(
      terrainScore.habitatEvidence.exposure -
        expectedExposure
    ) < 1e-12
  );
  assert.equal(
    terrainModel.meta().terrainSpatialEvidenceModel.id,
    TERRAIN_SPATIAL_EVIDENCE_CONTRACT.id
  );
  assert.equal(
    controlModel.meta().terrainSpatialEvidenceModel,
    null
  );
  process.stdout.write(
    "terrain runtime consistency tests passed\n"
  );
} finally {
  terrainModel.close();
  controlModel.close();
  terrainDatabase.close();
  controlDatabase.close();
}
