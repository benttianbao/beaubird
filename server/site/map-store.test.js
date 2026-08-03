const assert = require("node:assert/strict");
const { mkdirSync, rmSync, rmdirSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");

const { handleMapApi } = require("./map-api");
const { createBirdMapStore } = require("./map-store");

function createMapFixture(path) {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
    CREATE TABLE species (taxon_id TEXT PRIMARY KEY, common_name TEXT, scientific_name TEXT, english_name TEXT) WITHOUT ROWID;
    CREATE TABLE places (
      place_id TEXT PRIMARY KEY, name TEXT, city_name TEXT, district_name TEXT,
      longitude REAL, latitude REAL, report_count INTEGER, species_count INTEGER, latest_at TEXT
    ) WITHOUT ROWID;
    CREATE TABLE records (record_id INTEGER PRIMARY KEY, place_id TEXT, observed_at TEXT, species_count INTEGER);
    CREATE TABLE record_species (
      record_id INTEGER, taxon_id TEXT, observed_count INTEGER, PRIMARY KEY (record_id, taxon_id)
    ) WITHOUT ROWID;
    CREATE TABLE place_species (
      place_id TEXT, taxon_id TEXT, record_count INTEGER, total_observed_count INTEGER,
      last_seen_at TEXT, PRIMARY KEY (place_id, taxon_id)
    ) WITHOUT ROWID;
    INSERT INTO metadata VALUES ('window_start_date', '2024-07-16'), ('window_end_date', '2026-07-15'),
      ('place_count', '2'), ('report_count', '2'), ('observation_count', '3'), ('species_count', '2');
    INSERT INTO species VALUES
      ('1', '小白鹭', 'Egretta garzetta', 'Little Egret'),
      ('2', '苍鹭', 'Ardea cinerea', 'Grey Heron');
    INSERT INTO places VALUES
      ('birdreport:100', '西湖', '杭州市', '西湖区', 120.12, 30.26, 1, 2, '2026-07-15 08:00'),
      ('birdreport:200', '东钱湖', '宁波市', '鄞州区', 121.63, 29.78, 1, 1, '2026-06-01 07:00');
    INSERT INTO records VALUES (1, 'birdreport:100', '2026-07-15 08:00', 2), (2, 'birdreport:200', '2026-06-01 07:00', 1);
    INSERT INTO record_species VALUES (1, '1', 2), (1, '2', 1), (2, '1', 3);
    INSERT INTO place_species VALUES
      ('birdreport:100', '1', 1, 2, '2026-07-15 08:00'),
      ('birdreport:100', '2', 1, 1, '2026-07-15 08:00'),
      ('birdreport:200', '1', 1, 3, '2026-06-01 07:00');
  `);
  db.close();
}

test("queries visible points, species filters and private place detail", (t) => {
  const directory = join(tmpdir(), `beaubird-map-store-${process.pid}-${Date.now()}`);
  const databasePath = join(directory, "map.sqlite");
  mkdirSync(directory);
  createMapFixture(databasePath);
  const store = createBirdMapStore(databasePath);
  t.after(() => {
    store.close();
    rmSync(databasePath, { force: true });
    rmdirSync(directory);
  });

  const visible = store.listPoints({ west: 120, south: 30, east: 121, north: 31 });
  assert.equal(visible.points.length, 1);
  assert.equal(visible.points[0].name, "西湖");

  const filtered = store.listPoints({ west: 118, south: 27, east: 123, north: 32, taxonId: "2" });
  assert.deepEqual(filtered.points.map((point) => point.placeId), ["birdreport:100"]);
  assert.equal(filtered.points[0].speciesRecordCount, 1);

  const species = store.searchSpecies("白鹭");
  assert.equal(species[0].taxonId, "1");
  assert.equal(species[0].placeCount, 2);

  const place = store.getPlace("birdreport:100");
  assert.equal(place.recentRecords[0].species.length, 2);
  assert.equal(place.recentSpecies[0].lastSeenAt, "2026-07-15 08:00");
  assert.equal("reportId" in place.recentRecords[0], false);
});

test("map API reports readiness separately for data and AMap configuration", () => {
  const mapStore = {
    available: true,
    getMetadata() {
      return { place_count: "2", window_start_date: "2024-07-16", window_end_date: "2026-07-15" };
    }
  };
  const status = handleMapApi({
    amapJsKey: "",
    amapSecurityCode: "",
    mapStore,
    pathname: "/api/map/status",
    url: new URL("http://localhost/api/map/status")
  });
  assert.equal(status.payload.available, true);
  assert.equal(status.payload.mapProviderReady, false);
  assert.equal(status.payload.placeCount, 2);

  const config = handleMapApi({
    amapJsKey: "public-key",
    amapSecurityCode: "server-secret",
    mapStore,
    pathname: "/api/map/config",
    url: new URL("http://localhost/api/map/config")
  });
  assert.deepEqual(config.payload, {
    enabled: true,
    key: "public-key",
    securityServiceHost: "/_AMapService"
  });
  assert.doesNotMatch(JSON.stringify(config.payload), /server-secret/);
});
