const { existsSync, mkdirSync, renameSync, rmSync } = require("node:fs");
const { dirname, resolve } = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const { bd09ToGcj02, normalizeCoordinatePair } = require("../server/prediction/geo");

const SCHEMA_VERSION = "1";
const SAFETY_GENERATION = "beaubird-public-sqlite-sensitive-safe-v3";
const SAFETY_GENERATIONS = new Set([
  SAFETY_GENERATION,
  "beaubird-unified-quality-filter-v1"
]);

function parseArgs(argv) {
  const options = {
    sourcePath: "data/prediction-snapshots/zhejiang-v1-20260715.sqlite",
    outputPath: "data/bird-map.sqlite",
    cutoffDate: "",
    force: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--source") options.sourcePath = argv[++index];
    else if (argument === "--output") options.outputPath = argv[++index];
    else if (argument === "--cutoff-date") options.cutoffDate = argv[++index];
    else if (argument === "--force") options.force = true;
    else throw new Error(`未知参数：${argument}`);
  }
  if (!options.sourcePath || !options.outputPath) throw new Error("--source 和 --output 不能为空。");
  return options;
}

function shiftDate(dateText, years, days) {
  const date = new Date(`${dateText}T00:00:00Z`);
  if (Number.isNaN(date.valueOf())) throw new Error(`无效日期：${dateText}`);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function validateSource(source) {
  const tables = new Set(
    source.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all().map((row) => row.name)
  );
  for (const required of ["reports", "observations", "public_output_safety"]) {
    if (!tables.has(required)) throw new Error(`源快照缺少 ${required} 表。`);
  }
  const safety = source.prepare("SELECT generation FROM public_output_safety ORDER BY created_at DESC LIMIT 1").get();
  if (!SAFETY_GENERATIONS.has(safety?.generation)) {
    throw new Error("源快照没有通过敏感数据安全契约，拒绝生成地图数据。");
  }
}

function createSchema(target) {
  target.exec(`
    PRAGMA journal_mode = DELETE;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
    CREATE TABLE species (
      taxon_id TEXT PRIMARY KEY,
      common_name TEXT NOT NULL,
      scientific_name TEXT NOT NULL DEFAULT '',
      english_name TEXT NOT NULL DEFAULT ''
    ) WITHOUT ROWID;
    CREATE TABLE places (
      place_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      city_name TEXT NOT NULL DEFAULT '',
      district_name TEXT NOT NULL DEFAULT '',
      longitude REAL NOT NULL,
      latitude REAL NOT NULL,
      report_count INTEGER NOT NULL,
      species_count INTEGER NOT NULL DEFAULT 0,
      latest_at TEXT NOT NULL
    ) WITHOUT ROWID;
    CREATE TABLE records (
      record_id INTEGER PRIMARY KEY,
      place_id TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      species_count INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (place_id) REFERENCES places(place_id)
    );
    CREATE TABLE record_species (
      record_id INTEGER NOT NULL,
      taxon_id TEXT NOT NULL,
      observed_count INTEGER,
      PRIMARY KEY (record_id, taxon_id),
      FOREIGN KEY (record_id) REFERENCES records(record_id),
      FOREIGN KEY (taxon_id) REFERENCES species(taxon_id)
    ) WITHOUT ROWID;
    CREATE TABLE place_species (
      place_id TEXT NOT NULL,
      taxon_id TEXT NOT NULL,
      record_count INTEGER NOT NULL,
      total_observed_count INTEGER,
      last_seen_at TEXT NOT NULL,
      PRIMARY KEY (place_id, taxon_id),
      FOREIGN KEY (place_id) REFERENCES places(place_id),
      FOREIGN KEY (taxon_id) REFERENCES species(taxon_id)
    ) WITHOUT ROWID;
  `);
}

function safePlaceId(row) {
  const pointId = String(row.point_id || "").trim();
  if (pointId) return `birdreport:${pointId}`;
  return `coordinate:${Number(row.longitude).toFixed(5)},${Number(row.latitude).toFixed(5)}`;
}

function buildBirdMapDataset(options = {}) {
  const sourcePath = resolve(options.sourcePath || "data/prediction-snapshots/zhejiang-v1-20260715.sqlite");
  const outputPath = resolve(options.outputPath || "data/bird-map.sqlite");
  const temporaryPath = `${outputPath}.building`;
  if (!existsSync(sourcePath)) throw new Error(`找不到源快照：${sourcePath}`);
  if (existsSync(outputPath) && !options.force) {
    throw new Error(`输出文件已存在：${outputPath}。如需替换请加 --force。`);
  }
  mkdirSync(dirname(outputPath), { recursive: true });
  rmSync(temporaryPath, { force: true });

  const source = new DatabaseSync(sourcePath, { readOnly: true });
  let target;
  try {
    validateSource(source);
    const sourceCutoff = source
      .prepare("SELECT MAX(substr(start_time, 1, 10)) AS cutoff FROM reports WHERE start_time IS NOT NULL")
      .get()?.cutoff;
    const cutoffDate = String(options.cutoffDate || sourceCutoff || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoffDate)) throw new Error("无法确定有效的数据截止日期。");
    if (sourceCutoff && cutoffDate > sourceCutoff) throw new Error(`截止日期不能晚于快照日期 ${sourceCutoff}。`);
    const windowStart = shiftDate(cutoffDate, -2, 1);

    target = new DatabaseSync(temporaryPath);
    createSchema(target);
    target.exec("BEGIN IMMEDIATE");
    const reportToRecord = new Map();
    const placeAggregates = new Map();
    let recordId = 0;
    const reportRows = source.prepare(`
      SELECT report_id, point_id, point_name, city_name, district_name, longitude, latitude, start_time
      FROM reports
      WHERE substr(start_time, 1, 10) BETWEEN ? AND ?
        AND longitude IS NOT NULL AND latitude IS NOT NULL
        AND sensitive_data_saved = 0
      ORDER BY start_time, report_id
    `);
    for (const row of reportRows.iterate(windowStart, cutoffDate)) {
      const normalized = normalizeCoordinatePair(row.longitude, row.latitude);
      if (!normalized.valid) continue;
      const projected = bd09ToGcj02(normalized.longitude, normalized.latitude);
      const placeId = safePlaceId(row);
      let place = placeAggregates.get(placeId);
      if (!place) {
        place = {
          placeId,
          name: String(row.point_name || row.district_name || row.city_name || "未命名观鸟点").trim(),
          cityName: String(row.city_name || "").trim(),
          districtName: String(row.district_name || "").trim(),
          longitude: projected.longitude,
          latitude: projected.latitude,
          reportCount: 0,
          latestAt: row.start_time
        };
        placeAggregates.set(placeId, place);
      }
      place.reportCount += 1;
      if (String(row.start_time) >= String(place.latestAt)) {
        place.latestAt = row.start_time;
        place.name = String(row.point_name || place.name).trim();
        place.cityName = String(row.city_name || place.cityName).trim();
        place.districtName = String(row.district_name || place.districtName).trim();
        place.longitude = projected.longitude;
        place.latitude = projected.latitude;
      }
      recordId += 1;
      reportToRecord.set(String(row.report_id), { recordId, placeId, observedAt: row.start_time });
    }

    const insertPlace = target.prepare(`INSERT INTO places
      (place_id, name, city_name, district_name, longitude, latitude, report_count, latest_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const place of placeAggregates.values()) {
      insertPlace.run(place.placeId, place.name, place.cityName, place.districtName, place.longitude, place.latitude, place.reportCount, place.latestAt);
    }
    const insertRecord = target.prepare("INSERT INTO records (record_id, place_id, observed_at, species_count) VALUES (?, ?, ?, 0)");
    for (const report of reportToRecord.values()) insertRecord.run(report.recordId, report.placeId, report.observedAt);

    const upsertSpecies = target.prepare(`INSERT INTO species (taxon_id, common_name, scientific_name, english_name)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(taxon_id) DO UPDATE SET
        common_name = CASE WHEN excluded.common_name <> '' THEN excluded.common_name ELSE species.common_name END,
        scientific_name = CASE WHEN excluded.scientific_name <> '' THEN excluded.scientific_name ELSE species.scientific_name END,
        english_name = CASE WHEN excluded.english_name <> '' THEN excluded.english_name ELSE species.english_name END`);
    const insertRecordSpecies = target.prepare("INSERT OR IGNORE INTO record_species (record_id, taxon_id, observed_count) VALUES (?, ?, ?)");
    const upsertPlaceSpecies = target.prepare(`INSERT INTO place_species
      (place_id, taxon_id, record_count, total_observed_count, last_seen_at)
      VALUES (?, ?, 1, ?, ?)
      ON CONFLICT(place_id, taxon_id) DO UPDATE SET
        record_count = place_species.record_count + 1,
        total_observed_count = CASE
          WHEN place_species.total_observed_count IS NULL OR excluded.total_observed_count IS NULL THEN NULL
          ELSE place_species.total_observed_count + excluded.total_observed_count END,
        last_seen_at = MAX(place_species.last_seen_at, excluded.last_seen_at)`);
    const recordSpeciesCounts = new Map();
    const observationRows = source.prepare(`
      SELECT observations.report_id, observations.taxon_id, observations.taxon_name,
             observations.latinname, observations.englishname, observations.taxon_count
      FROM observations JOIN reports ON reports.report_id = observations.report_id
      WHERE substr(reports.start_time, 1, 10) BETWEEN ? AND ?
        AND reports.sensitive_data_saved = 0
        AND observations.is_red_species = 0 AND observations.source_outside_type = 0
        AND observations.taxon_id IS NOT NULL
      ORDER BY observations.report_id, observations.taxon_key
    `);
    for (const row of observationRows.iterate(windowStart, cutoffDate)) {
      const report = reportToRecord.get(String(row.report_id));
      if (!report) continue;
      const taxonId = String(row.taxon_id).trim();
      if (!taxonId) continue;
      upsertSpecies.run(taxonId, String(row.taxon_name || "未命名鸟种").trim(), String(row.latinname || "").trim(), String(row.englishname || "").trim());
      const observedCount = Number.isFinite(Number(row.taxon_count)) ? Number(row.taxon_count) : null;
      insertRecordSpecies.run(report.recordId, taxonId, observedCount);
      upsertPlaceSpecies.run(report.placeId, taxonId, observedCount, report.observedAt);
      recordSpeciesCounts.set(report.recordId, (recordSpeciesCounts.get(report.recordId) || 0) + 1);
    }
    const updateRecordCount = target.prepare("UPDATE records SET species_count = ? WHERE record_id = ?");
    for (const [id, count] of recordSpeciesCounts) updateRecordCount.run(count, id);

    target.exec(`
      DELETE FROM records WHERE species_count = 0;
      DELETE FROM places WHERE place_id NOT IN (SELECT DISTINCT place_id FROM records);
      UPDATE places SET
        report_count = (SELECT COUNT(*) FROM records WHERE records.place_id = places.place_id),
        species_count = (SELECT COUNT(*) FROM place_species WHERE place_species.place_id = places.place_id),
        latest_at = (SELECT MAX(observed_at) FROM records WHERE records.place_id = places.place_id);
      CREATE INDEX idx_places_bounds ON places(longitude, latitude);
      CREATE INDEX idx_places_latest ON places(latest_at DESC);
      CREATE INDEX idx_records_place_time ON records(place_id, observed_at DESC);
      CREATE INDEX idx_record_species_record ON record_species(record_id);
      CREATE INDEX idx_place_species_taxon ON place_species(taxon_id, last_seen_at DESC, place_id);
      CREATE INDEX idx_species_common_name ON species(common_name);
    `);
    const counts = {
      place_count: target.prepare("SELECT COUNT(*) AS count FROM places").get().count,
      report_count: target.prepare("SELECT COUNT(*) AS count FROM records").get().count,
      observation_count: target.prepare("SELECT COUNT(*) AS count FROM record_species").get().count,
      species_count: target.prepare("SELECT COUNT(*) AS count FROM species").get().count
    };
    const metadata = {
      schema_version: SCHEMA_VERSION,
      source_kind: "birdreport",
      source_cutoff_date: cutoffDate,
      window_start_date: windowStart,
      window_end_date: cutoffDate,
      coordinate_system: "GCJ-02",
      generated_at: new Date().toISOString(),
      ...counts
    };
    const writeMetadata = target.prepare("INSERT INTO metadata (key, value) VALUES (?, ?)");
    for (const [key, value] of Object.entries(metadata)) writeMetadata.run(key, String(value));
    target.exec("COMMIT");
    target.exec("PRAGMA optimize");
    target.close();
    target = null;
    source.close();
    if (existsSync(outputPath)) rmSync(outputPath, { force: true });
    renameSync(temporaryPath, outputPath);
    return { outputPath, ...metadata };
  } catch (error) {
    try { target?.exec("ROLLBACK"); } catch {}
    target?.close();
    source.close();
    rmSync(temporaryPath, { force: true });
    throw error;
  }
}

function main() {
  console.log(JSON.stringify(buildBirdMapDataset(parseArgs(process.argv.slice(2))), null, 2));
}

if (require.main === module) main();

module.exports = { SAFETY_GENERATION, buildBirdMapDataset, parseArgs, shiftDate };
