"use strict";

const assert = require("node:assert/strict");
const { mkdirSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { randomUUID } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const test = require("node:test");

const {
  RANKING_REFERENCE_CONTRACT,
  RANKING_REFERENCE_CONTRACT_SHA256
} = require("../server/prediction/ranking-reference");
const {
  RANKING_REFERENCE_BINDING_KIND,
  RANKING_REFERENCE_OUTPUT_MEANING,
  parameterSetSha256
} = require("../server/prediction/ranking-reference-runtime");
const { PredictionError, PredictionModel, SCHEMA_VERSION } = require("../server/prediction/model");
const {
  buildReverseHotspots,
  createArtifactSchema,
  createUnitRegistry,
  insertSpaceUnits,
  materializeLocationPredictions
} = require("./build-zhejiang-prediction-model");

function fixturePath(name) {
  const directory = resolve(__dirname, "..", ".tmp", `ranking-artifact-${randomUUID()}`);
  mkdirSync(directory, { recursive: true });
  return join(directory, name);
}

function parameter() {
  return {
    scope: "global",
    halfWidth: 0.1,
    rowCount: 20,
    totalWeight: 200,
    calibrationFoldCount: 2,
    foldQuantiles: [
      { foldId: "1", halfWidth: 0.08, rowCount: 10, totalWeight: 100 },
      { foldId: "2", halfWidth: 0.1, rowCount: 10, totalWeight: 100 }
    ]
  };
}

function createFixture(path, { tamperParameter = false } = {}) {
  const database = new DatabaseSync(path);
  createArtifactSchema(database);
  const value = parameter();
  const manifestSet = (key, entry) => database
    .prepare("INSERT INTO manifest(key, value) VALUES (?, ?)")
    .run(key, JSON.stringify(entry));
  manifestSet("schema_version", SCHEMA_VERSION);
  manifestSet("model_version", "ranking-reference-fixture");
  manifestSet("quality_gate", { passed: true, failures: [] });
  manifestSet("test_only", true);
  manifestSet("prior_strengths", { city: 24, district: 18, grid_r6: 14, grid_r7: 10, point: 8 });
  manifestSet("prior_strengths_by_prevalence", {});
  manifestSet("novel_grid_admin_exposure_caps_by_prevalence", null);
  manifestSet("novel_grid_spatial_calibration_enabled", false);
  manifestSet("novel_grid_spatial_calibrators", []);
  manifestSet("ranking_reference", {
    schemaVersion: 1,
    kind: RANKING_REFERENCE_BINDING_KIND,
    contractId: RANKING_REFERENCE_CONTRACT.id,
    contractSha256: RANKING_REFERENCE_CONTRACT_SHA256,
    outputMeaning: RANKING_REFERENCE_OUTPUT_MEANING,
    parametersSha256: parameterSetSha256([value]),
    parameterCount: 1,
    diagnosticOnly: true,
    freezeEligible: false,
    sealedPanelViewed: false
  });
  database.prepare(
    `INSERT INTO ranking_reference_parameters
       (scope, half_width, row_count, total_weight, calibration_fold_count, fold_quantiles_json)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    value.scope,
    value.halfWidth,
    tamperParameter ? value.rowCount + 1 : value.rowCount,
    value.totalWeight,
    value.calibrationFoldCount,
    JSON.stringify(value.foldQuantiles)
  );
  database.prepare(
    `INSERT INTO taxa
       (taxon_id, common_name, positive_count, observer_count, calibration_scope)
     VALUES ('bird-a', '测试鸟', 300, 50, 'none')`
  ).run();
  database.prepare(
    `INSERT INTO space_units
       (id, level, code, name, checklist_count, observer_count, support_years_json, supported)
     VALUES ('province:zhejiang', 'province', 'zhejiang', '浙江省', 100, 50, '[2025,2026]', 1)`
  ).run();
  database.prepare(
    `INSERT INTO checklist_exposure
       (space_unit_id, season_week, effective_checklists, raw_checklists, observer_count, support_years_json)
     VALUES ('province:zhejiang', 1, 10, 10, 5, '[2025,2026]')`
  ).run();
  database.prepare(
    `INSERT INTO taxon_detection
       (space_unit_id, season_week, taxon_id, effective_detections, raw_detections, observer_count, support_years_json)
     VALUES ('province:zhejiang', 1, 'bird-a', 5, 5, 5, '[2025,2026]')`
  ).run();
  database.close();
}

test("schema v3 runtime 使用绑定参数生成 checklist frequency 参考范围", () => {
  const path = fixturePath("model.sqlite");
  createFixture(path);
  const model = new PredictionModel({ databasePath: path, testOnly: true });
  const score = model.scoreUnitTaxonAtWeek("province:zhejiang", "bird-a", 1);
  assert.equal(score.probability, 0.5);
  assert.equal(score.intervalLower, 0.4);
  assert.equal(score.intervalUpper, 0.6);
  assert.equal(score.intervalMeaning, RANKING_REFERENCE_OUTPUT_MEANING);
  assert.deepEqual(score.referenceSourceScopes, ["global"]);
  assert.notDeepEqual(
    [score.posteriorIntervalLower, score.posteriorIntervalUpper],
    [score.intervalLower, score.intervalUpper]
  );
  model.close();
});

test("schema v3 runtime 拒绝参数表与 manifest SHA 不一致", () => {
  const path = fixturePath("tampered.sqlite");
  createFixture(path, { tamperParameter: true });
  assert.throws(
    () => new PredictionModel({ databasePath: path, testOnly: true }),
    (error) => error instanceof PredictionError &&
      error.code === "MODEL_UNAVAILABLE" &&
      /参数数量或 SHA-256 不匹配/.test(error.message)
  );
});

test("参考范围构建在完整层级保留全部公共鸟种而不受 forwardTopK 截断", () => {
  const path = fixturePath("complete-forward.sqlite");
  createFixture(path);
  const database = new DatabaseSync(path);
  database.prepare("UPDATE manifest SET value = ? WHERE key = 'quality_gate'")
    .run(JSON.stringify({ passed: true, failures: [], internalBuild: true }));
  database.prepare(
    `INSERT INTO taxa
       (taxon_id, common_name, positive_count, observer_count, calibration_scope)
     VALUES ('bird-b', '低排名测试鸟', 300, 20, 'none')`
  ).run();
  database.prepare(
    `INSERT INTO taxon_detection
       (space_unit_id, season_week, taxon_id, effective_detections, raw_detections,
        observer_count, support_years_json)
     VALUES ('province:zhejiang', 1, 'bird-b', 1, 1, 1, '[2026]')`
  ).run();
  const result = materializeLocationPredictions(database, {
    testOnly: true,
    forwardTopK: 1,
    rankingReferenceBinding: { parameterCount: 1 }
  });
  assert.equal(result.publicTaxa, 2);
  assert.equal(result.completeForwardRows, 2 * 52);
  assert.equal(
    database.prepare("SELECT COUNT(*) AS count FROM location_predictions").get().count,
    2 * 52
  );
  assert.equal(
    database.prepare(
      "SELECT COUNT(DISTINCT taxon_id) AS count FROM location_predictions WHERE season_bucket = 1"
    ).get().count,
    2
  );
  database.close();
});

test("反向热点完全并列时不受候选输入顺序影响", () => {
  const candidates = [
    [1, 14, 8, 0.4, 0.52, 0.4, 0.61, "medium", 10, 5, "[2025,2026]", "medium"],
    [1, 14, 7, 0.4, 0.51, 0.4, 0.6, "medium", 10, 5, "[2025,2026]", "medium"],
    [15, 28, 21, 0.3, 0.42, 0.3, 0.5, "medium", 9, 4, "[2025,2026]", "medium"],
    [350, 365, 357, 0.35, 0.46, 0.35, 0.54, "medium", 9, 4, "[2025,2026]", "medium"]
  ];
  const orders = [
    [0, 1, 2, 3],
    [3, 2, 1, 0],
    [1, 3, 2, 0],
    [2, 0, 3, 1]
  ];
  const projections = orders.map((order, orderIndex) => {
    const path = fixturePath(`reverse-order-${orderIndex}.sqlite`);
    createFixture(path);
    const database = new DatabaseSync(path);
    const insert = database.prepare(
      `INSERT INTO reverse_candidates
         (taxon_id, space_unit_id, temporal_granularity, season_start_day, season_end_day,
          peak_day, rank_score, probability, interval_lower, interval_upper,
          probability_level, effective_checklists, observer_count, support_years_json, confidence)
       VALUES ('bird-a', 'province:zhejiang', 'week', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const index of order) insert.run(...candidates[index]);
    const result = buildReverseHotspots(database, { reverseTopK: 300 });
    const rows = database.prepare(
      "SELECT * FROM reverse_hotspots ORDER BY season_start_day, season_end_day"
    ).all();
    database.close();
    return { result, rows };
  });
  for (const projection of projections.slice(1)) assert.deepEqual(projection, projections[0]);
  assert.equal(projections[0].rows[0].season_start_day, 350);
  assert.equal(projections[0].rows[0].season_end_day, 28);
  assert.equal(projections[0].rows[0].peak_day, 7);
});

test("空间单元和地点查询键发生冲突时失败而不是静默覆盖", () => {
  const registry = createUnitRegistry();
  registry.register({ id: "point:collision", level: "point", code: "point-a" });
  assert.throws(
    () => registry.register({ id: "point:collision", level: "point", code: "point-b" }),
    (error) => error.code === "SPACE_UNIT_ID_COLLISION"
  );

  const database = new DatabaseSync(":memory:");
  createArtifactSchema(database);
  const unit = {
    id: "point:strict-lookup",
    level: "point",
    code: "strict-lookup",
    name: "严格查询测试点",
    parentId: null
  };
  insertSpaceUnits(database, {
    units: new Map([[unit.id, unit]]),
    locationLookups: new Map([["legacy-point", unit.id]])
  }, new Map());
  assert.throws(
    () => insertSpaceUnits(database, {
      units: new Map(),
      locationLookups: new Map([["legacy-point", unit.id]])
    }, new Map()),
    /UNIQUE constraint failed: location_lookup/
  );
  assert.equal(
    database.prepare(
      "SELECT space_unit_id FROM location_lookup WHERE lookup_type='point_id' AND lookup_key='legacy-point'"
    ).get().space_unit_id,
    unit.id
  );
  database.close();
});

test("反向热点合并同一空间单元的重复时间组件且不触发唯一键冲突", () => {
  const path = fixturePath("reverse-hotspot-collision.sqlite");
  createFixture(path);
  const database = new DatabaseSync(path);
  const insert = database.prepare(
    `INSERT INTO reverse_candidates
       (taxon_id, space_unit_id, temporal_granularity, season_start_day, season_end_day,
        peak_day, rank_score, probability, interval_lower, interval_upper,
        probability_level, effective_checklists, observer_count, support_years_json, confidence)
     VALUES ('bird-a', 'province:zhejiang', 'week', 1, 14, 7, 0.4, 0.5, 0.4, 0.6,
             'medium', 10, 5, '[2025,2026]', 'medium')`
  );
  insert.run();
  insert.run();
  const result = buildReverseHotspots(database, { reverseTopK: 300 });
  assert.equal(result.insertedRows, 1);
  assert.equal(
    database.prepare("SELECT COUNT(*) AS count FROM reverse_hotspots").get().count,
    1
  );
  assert.deepEqual(
    JSON.parse(
      database.prepare("SELECT member_space_unit_ids_json FROM reverse_hotspots").get()
        .member_space_unit_ids_json
    ),
    ["province:zhejiang"]
  );
  database.close();
});
