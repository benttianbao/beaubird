"use strict";

const assert = require("node:assert/strict");
const { mkdtempSync, readFileSync, unlinkSync, rmdirSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { after, before, test } = require("node:test");
const { once } = require("node:events");
const { DatabaseSync } = require("node:sqlite");

const { createOfflinePredictionServer } = require("../server/offline-prediction/app");
const { seasonWeek } = require("../server/prediction/geo");

const fixtureDirectory = mkdtempSync(join(tmpdir(), "beaubird-offline-prediction-"));
const fixtureNames = ["model-a.sqlite", "model-b.sqlite", "evaluation-only.sqlite", "test-only.sqlite"];
let server;
let baseUrl;

function manifestSet(database, key, value) {
  database.prepare("INSERT INTO manifest (key, value) VALUES (?, ?)").run(key, JSON.stringify(value));
}

function createFixture(name, options = {}) {
  const database = new DatabaseSync(join(fixtureDirectory, name));
  database.exec(`
    CREATE TABLE manifest (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE taxa (
      taxon_id TEXT PRIMARY KEY,
      common_name TEXT,
      scientific_name TEXT,
      english_name TEXT,
      is_sensitive INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE space_units (
      id TEXT PRIMARY KEY,
      level TEXT,
      code TEXT,
      name TEXT,
      parent_id TEXT,
      city_name TEXT,
      district_name TEXT,
      centroid_longitude REAL,
      centroid_latitude REAL,
      checklist_count INTEGER,
      observer_count INTEGER,
      supported INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE location_predictions (
      space_unit_id TEXT,
      resolved_space_unit_id TEXT,
      temporal_granularity TEXT,
      season_bucket INTEGER,
      taxon_id TEXT,
      probability REAL,
      ranking_score REAL,
      interval_lower REAL,
      interval_upper REAL,
      probability_level TEXT,
      effective_checklists REAL,
      observer_count INTEGER,
      support_years_json TEXT,
      confidence TEXT,
      fallback_level TEXT
    );
    CREATE TABLE reverse_hotspots (taxon_id TEXT);
  `);
  manifestSet(database, "schema_version", "2");
  manifestSet(database, "model_version", options.modelVersion || name.replace(".sqlite", ""));
  manifestSet(database, "built_at", options.builtAt || "2026-07-20T00:00:00.000Z");
  manifestSet(database, "data_cutoff_date", "2026-07-15");
  manifestSet(database, "forward_top_k", 100);
  manifestSet(database, "quality_gate", options.qualityGate || { passed: false });
  manifestSet(database, "test_only", options.testOnly === true);
  database
    .prepare(
      `INSERT INTO space_units
       (id, level, code, name, city_name, district_name, centroid_longitude, centroid_latitude,
        checklist_count, observer_count, supported)
       VALUES (?, 'city', ?, ?, ?, '', 120.2, 30.3, 1200, 88, 1)`
    )
    .run("city:hangzhou", "330100", "杭州市", "杭州市");
  database.prepare("INSERT INTO taxa VALUES (?, ?, ?, ?, ?)").run("ordinary", options.birdName || "白鹭", "Egretta garzetta", "Little Egret", 0);
  database.prepare("INSERT INTO taxa VALUES (?, ?, ?, ?, ?)").run("sensitive", "敏感鸟", "Secretus avis", "Secret Bird", 1);
  if (options.hasPredictions !== false) {
    const insert = database.prepare(
      `INSERT INTO location_predictions
       (space_unit_id, resolved_space_unit_id, temporal_granularity, season_bucket, taxon_id,
        probability, ranking_score, interval_lower, interval_upper, probability_level,
        effective_checklists, observer_count, support_years_json, confidence, fallback_level)
       VALUES ('city:hangzhou', 'city:hangzhou', 'week', ?, ?, ?, ?, ?, ?, 'medium', 91, 32, '[2024,2025,2026]', 'high', 'city')`
    );
    const week = seasonWeek("2026-07-21");
    insert.run(week, "ordinary", 0.42, 0.84, 0.32, 0.52);
    insert.run(week, "sensitive", 0.92, 0.99, 0.82, 0.97);
  }
  database.close();
}

before(async () => {
  createFixture("model-a.sqlite", { birdName: "白鹭", builtAt: "2026-07-21T00:00:00.000Z" });
  createFixture("model-b.sqlite", { birdName: "夜鹭", builtAt: "2026-07-19T00:00:00.000Z" });
  createFixture("evaluation-only.sqlite", { hasPredictions: false });
  createFixture("test-only.sqlite", { testOnly: true });
  server = createOfflinePredictionServer({
    projectRoot: resolve(__dirname, ".."),
    modelDirectory: fixtureDirectory,
    preferredModel: "model-b.sqlite"
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await once(server, "close");
  for (const name of fixtureNames) unlinkSync(join(fixtureDirectory, name));
  rmdirSync(fixtureDirectory);
});

test("模型目录只列出含完整正向结果的模型，并选择预设默认模型", async () => {
  const response = await fetch(`${baseUrl}/api/models`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.defaultModelId, "model-b.sqlite");
  assert.deepEqual(body.models.map((model) => model.id), ["model-b.sqlite", "model-a.sqlite"]);
  assert.equal(body.models[0].status, "实验版");
  assert.equal(body.models[0].filePath, undefined);
});

test("默认地点列表与关键词搜索均可用", async () => {
  const defaults = await (await fetch(`${baseUrl}/api/locations?model=model-b.sqlite`)).json();
  assert.equal(defaults.locations[0].label, "杭州市");
  const searched = await (await fetch(`${baseUrl}/api/locations?model=model-b.sqlite&q=${encodeURIComponent("杭州")}`)).json();
  assert.equal(searched.locations.length, 1);
  assert.equal(searched.locations[0].id, "city:hangzhou");
});

test("模型切换会读取各自结果，并过滤敏感鸟", async () => {
  const params = new URLSearchParams({ spaceUnitId: "city:hangzhou", date: "2026-07-21" });
  const first = await (await fetch(`${baseUrl}/api/predictions?model=model-a.sqlite&${params}`)).json();
  const second = await (await fetch(`${baseUrl}/api/predictions?model=model-b.sqlite&${params}`)).json();
  assert.deepEqual(first.results.map((bird) => bird.commonName), ["白鹭"]);
  assert.deepEqual(second.results.map((bird) => bird.commonName), ["夜鹭"]);
  assert.equal(second.results[0].probability, 0.42);
  assert.equal(second.query.seasonWeek, seasonWeek("2026-07-21"));
});

test("拒绝任意模型路径、无效日期和未知地点", async () => {
  const unknownModel = await fetch(`${baseUrl}/api/locations?model=${encodeURIComponent("../model-b.sqlite")}`);
  assert.equal(unknownModel.status, 404);
  const invalidDate = await fetch(`${baseUrl}/api/predictions?model=model-b.sqlite&spaceUnitId=city%3Ahangzhou&date=2026-13-99`);
  assert.equal(invalidDate.status, 400);
  const unknownLocation = await fetch(`${baseUrl}/api/predictions?model=model-b.sqlite&spaceUnitId=unknown&date=2026-07-21`);
  assert.equal(unknownLocation.status, 404);
});

test("静态页面独立提供，并阻止读取目录外文件", async () => {
  const page = await fetch(`${baseUrl}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /浙江鸟种离线预测/);
  const traversal = await fetch(`${baseUrl}/%2e%2e/package.json`);
  assert.equal(traversal.status, 404);
  const html = readFileSync(resolve(__dirname, "..", "server", "offline-prediction", "public", "index.html"), "utf8");
  assert.match(html, /id="model-select"/);
  assert.match(html, /只在本机运行/);
});
