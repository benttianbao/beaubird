const assert = require("node:assert/strict");
const { mkdirSync, rmSync, rmdirSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");

const { SAFETY_GENERATION, buildBirdMapDataset } = require("./build-bird-map-dataset");

function createFixture(path) {
  const database = new DatabaseSync(path);
  database.exec(`
    CREATE TABLE public_output_safety (generation TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE reports (
      report_id TEXT PRIMARY KEY, point_id TEXT, point_name TEXT, city_name TEXT, district_name TEXT,
      longitude REAL, latitude REAL, start_time TEXT, observations_complete INTEGER NOT NULL,
      sensitive_data_saved INTEGER NOT NULL
    );
    CREATE TABLE observations (
      report_id TEXT NOT NULL, taxon_key TEXT NOT NULL, taxon_id TEXT, taxon_name TEXT,
      latinname TEXT, englishname TEXT, taxon_count INTEGER, is_red_species INTEGER NOT NULL,
      source_outside_type INTEGER NOT NULL, PRIMARY KEY (report_id, taxon_key)
    );
  `);
  database.prepare("INSERT INTO public_output_safety VALUES (?, ?)").run(SAFETY_GENERATION, "2026-07-16T00:00:00Z");
  const report = database.prepare("INSERT INTO reports VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0)");
  report.run("recent-a", "100", "西湖", "杭州市", "西湖区", 120.13, 30.27, "2026-07-15 08:00");
  report.run("recent-b", "100", "西湖", "杭州市", "西湖区", 120.13, 30.27, "2025-06-01 07:00");
  database.prepare("UPDATE reports SET observations_complete = 0 WHERE report_id = 'recent-b'").run();
  report.run("old", "200", "旧点", "宁波市", "海曙区", 121.55, 29.87, "2024-07-15 07:00");
  const observation = database.prepare("INSERT INTO observations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  observation.run("recent-a", "1", "1", "小白鹭", "Egretta garzetta", "Little Egret", 2, 0, 0);
  observation.run("recent-a", "2", "2", "敏感鸟种", "Secretus avis", "Secret Bird", 1, 1, 0);
  observation.run("recent-b", "1", "1", "小白鹭", "Egretta garzetta", "Little Egret", 3, 0, 0);
  observation.run("old", "1", "1", "小白鹭", "Egretta garzetta", "Little Egret", 4, 0, 0);
  database.close();
}

function cleanup(directory, ...paths) {
  for (const path of paths) rmSync(path, { force: true });
  rmdirSync(directory);
}

test("builds a two-year private map artifact without sensitive or source identity fields", (t) => {
  const directory = join(tmpdir(), `beaubird-map-${process.pid}-${Date.now()}`);
  const sourcePath = join(directory, "source.sqlite");
  const outputPath = join(directory, "map.sqlite");
  mkdirSync(directory);
  t.after(() => cleanup(directory, sourcePath, outputPath, `${outputPath}.building`));
  createFixture(sourcePath);

  const result = buildBirdMapDataset({ sourcePath, outputPath, cutoffDate: "2026-07-15" });
  assert.equal(result.window_start_date, "2024-07-16");
  assert.equal(result.place_count, 1);
  assert.equal(result.report_count, 2);
  assert.equal(result.observation_count, 2);
  assert.equal(result.species_count, 1);

  const database = new DatabaseSync(outputPath, { readOnly: true });
  const place = database.prepare("SELECT * FROM places").get();
  assert.equal(place.name, "西湖");
  assert.equal(place.report_count, 2);
  assert.equal(place.species_count, 1);
  assert.ok(place.longitude < 120.13 && place.longitude > 120.12);
  assert.ok(place.latitude < 30.27 && place.latitude > 30.26);
  assert.deepEqual(database.prepare("SELECT common_name FROM species").all().map((row) => row.common_name), ["小白鹭"]);
  const tableSql = database.prepare("SELECT sql FROM sqlite_schema WHERE type = 'table'").all().map((row) => row.sql).join("\n");
  assert.doesNotMatch(tableSql, /observer|username|raw_report_json|report_id TEXT/i);
  database.close();
});

test("rejects a source without the sensitive-data safety marker", (t) => {
  const directory = join(tmpdir(), `beaubird-map-invalid-${process.pid}-${Date.now()}`);
  const sourcePath = join(directory, "source.sqlite");
  const outputPath = join(directory, "map.sqlite");
  mkdirSync(directory);
  t.after(() => cleanup(directory, sourcePath, outputPath));
  const database = new DatabaseSync(sourcePath);
  database.exec("CREATE TABLE reports(start_time TEXT); CREATE TABLE observations(report_id TEXT);");
  database.close();
  assert.throws(() => buildBirdMapDataset({ sourcePath, outputPath }), /public_output_safety/);
});
