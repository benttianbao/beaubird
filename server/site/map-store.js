const { existsSync } = require("node:fs");
const { resolve } = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const MAX_POINT_LIMIT = 10_000;

function numberInRange(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : fallback;
}

function createUnavailableStore(databasePath) {
  return {
    available: false,
    databasePath,
    close() {},
    getMetadata() { return {}; },
    getPlace() { return null; },
    listPoints() { return { points: [], truncated: false }; },
    searchSpecies() { return []; }
  };
}

function createBirdMapStore(databasePath) {
  const resolvedPath = resolve(databasePath);
  if (!existsSync(resolvedPath)) return createUnavailableStore(resolvedPath);
  const database = new DatabaseSync(resolvedPath, { readOnly: true });
  const metadata = Object.fromEntries(
    database.prepare("SELECT key, value FROM metadata ORDER BY key").all().map((row) => [row.key, row.value])
  );

  return {
    available: true,
    databasePath: resolvedPath,
    close() { database.close(); },
    getMetadata() { return { ...metadata }; },
    listPoints(options = {}) {
      const west = numberInRange(options.west, -180, 180, 118.0);
      const south = numberInRange(options.south, -90, 90, 27.0);
      const east = numberInRange(options.east, -180, 180, 123.5);
      const north = numberInRange(options.north, -90, 90, 31.5);
      if (west >= east || south >= north) throw new RangeError("地图范围无效。");
      const requestedLimit = Math.floor(numberInRange(options.limit, 1, MAX_POINT_LIMIT, 5_000));
      const taxonId = String(options.taxonId || "").trim();
      const rows = taxonId
        ? database.prepare(`
            SELECT places.place_id, places.name, places.city_name, places.district_name,
                   places.longitude, places.latitude, places.report_count, places.species_count,
                   places.latest_at, place_species.last_seen_at AS species_last_seen_at,
                   place_species.record_count AS species_record_count
            FROM places
            JOIN place_species ON place_species.place_id = places.place_id
            WHERE places.longitude BETWEEN ? AND ? AND places.latitude BETWEEN ? AND ?
              AND place_species.taxon_id = ?
            ORDER BY place_species.last_seen_at DESC, places.latest_at DESC
            LIMIT ?
          `).all(west, east, south, north, taxonId, requestedLimit + 1)
        : database.prepare(`
            SELECT place_id, name, city_name, district_name, longitude, latitude,
                   report_count, species_count, latest_at, NULL AS species_last_seen_at,
                   NULL AS species_record_count
            FROM places
            WHERE longitude BETWEEN ? AND ? AND latitude BETWEEN ? AND ?
            ORDER BY latest_at DESC
            LIMIT ?
          `).all(west, east, south, north, requestedLimit + 1);
      const truncated = rows.length > requestedLimit;
      return {
        truncated,
        points: rows.slice(0, requestedLimit).map(toPoint)
      };
    },
    searchSpecies(query, limit = 20) {
      const term = String(query || "").trim();
      const safeLimit = Math.floor(numberInRange(limit, 1, 50, 20));
      const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
      const rows = database.prepare(`
        SELECT species.taxon_id, species.common_name, species.scientific_name, species.english_name,
               COUNT(place_species.place_id) AS place_count,
               SUM(place_species.record_count) AS record_count,
               MAX(place_species.last_seen_at) AS last_seen_at
        FROM species
        JOIN place_species ON place_species.taxon_id = species.taxon_id
        WHERE ? = '' OR species.common_name LIKE ? ESCAPE '\\'
          OR species.scientific_name LIKE ? ESCAPE '\\'
          OR species.english_name LIKE ? ESCAPE '\\'
        GROUP BY species.taxon_id
        ORDER BY CASE WHEN species.common_name = ? THEN 0 ELSE 1 END,
                 last_seen_at DESC, record_count DESC, species.common_name
        LIMIT ?
      `).all(term, pattern, pattern, pattern, term, safeLimit);
      return rows.map((row) => ({
        taxonId: String(row.taxon_id),
        commonName: row.common_name,
        scientificName: row.scientific_name,
        englishName: row.english_name,
        placeCount: Number(row.place_count),
        recordCount: Number(row.record_count),
        lastSeenAt: row.last_seen_at
      }));
    },
    getPlace(placeId) {
      const row = database.prepare(`
        SELECT place_id, name, city_name, district_name, longitude, latitude,
               report_count, species_count, latest_at
        FROM places WHERE place_id = ?
      `).get(String(placeId || ""));
      if (!row) return null;
      const recentRecords = database.prepare(`
        SELECT record_id, observed_at, species_count
        FROM records WHERE place_id = ?
        ORDER BY observed_at DESC, record_id DESC LIMIT 8
      `).all(row.place_id).map((record) => ({
        observedAt: record.observed_at,
        speciesCount: Number(record.species_count),
        species: database.prepare(`
          SELECT species.taxon_id, species.common_name, record_species.observed_count
          FROM record_species JOIN species ON species.taxon_id = record_species.taxon_id
          WHERE record_species.record_id = ?
          ORDER BY species.common_name LIMIT 80
        `).all(record.record_id).map((species) => ({
          taxonId: String(species.taxon_id),
          commonName: species.common_name,
          observedCount: species.observed_count == null ? null : Number(species.observed_count)
        }))
      }));
      const recentSpecies = database.prepare(`
        SELECT species.taxon_id, species.common_name, species.scientific_name, species.english_name,
               place_species.record_count, place_species.total_observed_count, place_species.last_seen_at
        FROM place_species JOIN species ON species.taxon_id = place_species.taxon_id
        WHERE place_species.place_id = ?
        ORDER BY place_species.last_seen_at DESC, place_species.record_count DESC, species.common_name
        LIMIT 80
      `).all(row.place_id).map((species) => ({
        taxonId: String(species.taxon_id),
        commonName: species.common_name,
        scientificName: species.scientific_name,
        englishName: species.english_name,
        recordCount: Number(species.record_count),
        totalObservedCount: species.total_observed_count == null ? null : Number(species.total_observed_count),
        lastSeenAt: species.last_seen_at
      }));
      return { ...toPoint(row), recentRecords, recentSpecies };
    }
  };
}

function toPoint(row) {
  return {
    placeId: row.place_id,
    name: row.name,
    cityName: row.city_name,
    districtName: row.district_name,
    longitude: Number(row.longitude),
    latitude: Number(row.latitude),
    reportCount: Number(row.report_count),
    speciesCount: Number(row.species_count),
    latestAt: row.latest_at,
    speciesLastSeenAt: row.species_last_seen_at || null,
    speciesRecordCount: row.species_record_count == null ? null : Number(row.species_record_count)
  };
}

module.exports = { MAX_POINT_LIMIT, createBirdMapStore };
