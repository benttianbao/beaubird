"use strict";

const { seasonWeek, seasonalDay } = require("../prediction/geo");

function requestError(message, code = "INVALID_REQUEST", statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, "\\$&");
}

function normalizeDate(value) {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || seasonalDay(date) == null) {
    throw requestError("请选择有效日期");
  }
  return date;
}

function normalizeLimit(value, fallback = 20) {
  const parsed = Number.parseInt(value ?? fallback, 10);
  return Math.max(1, Math.min(100, Number.isFinite(parsed) ? parsed : fallback));
}

function parseJson(value, fallback) {
  try {
    return value == null || value === "" ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function locationLabel(row) {
  const parts = [];
  if (row.level === "point" && row.name) parts.push(row.name);
  if (row.city_name && !parts.includes(row.city_name)) parts.push(row.city_name);
  if (row.district_name && !parts.includes(row.district_name)) parts.push(row.district_name);
  if (!parts.length) parts.push(row.name || row.code || "未命名地点");
  return parts.join(" · ");
}

function searchLocations(database, input = {}) {
  const query = String(input.query || "").trim().slice(0, 80);
  const limit = Math.max(1, Math.min(20, Number.parseInt(input.limit ?? 12, 10) || 12));
  const params = [];
  let filter = "";
  if (query) {
    const pattern = `%${escapeLike(query)}%`;
    filter = `AND (name LIKE ? ESCAPE '\\' OR code LIKE ? ESCAPE '\\' OR city_name LIKE ? ESCAPE '\\' OR district_name LIKE ? ESCAPE '\\')`;
    params.push(pattern, pattern, pattern, pattern);
  } else {
    filter = "AND level = 'city'";
  }
  const rows = database
    .prepare(
      `SELECT id, level, code, name, city_name, district_name,
              centroid_longitude, centroid_latitude, checklist_count, observer_count
       FROM space_units
       WHERE supported = 1
         AND level IN ('city', 'district', 'point')
         ${filter}
       ORDER BY CASE level WHEN 'city' THEN 0 WHEN 'district' THEN 1 ELSE 2 END,
                checklist_count DESC, observer_count DESC, name
       LIMIT ?`
    )
    .all(...params, limit);

  return rows.map((row) => ({
    id: String(row.id),
    level: String(row.level),
    code: String(row.code || ""),
    name: String(row.name || "未命名地点"),
    label: locationLabel(row),
    cityName: String(row.city_name || ""),
    districtName: String(row.district_name || ""),
    centroid:
      row.centroid_longitude == null || row.centroid_latitude == null
        ? null
        : { longitude: Number(row.centroid_longitude), latitude: Number(row.centroid_latitude) },
    support: {
      checklists: Number(row.checklist_count) || 0,
      observers: Number(row.observer_count) || 0
    }
  }));
}

function getLocation(database, spaceUnitId) {
  const id = String(spaceUnitId || "").trim();
  if (!id || id.length > 300) throw requestError("请先选择地点");
  const row = database
    .prepare(
      `SELECT id, level, code, name, city_name, district_name,
              centroid_longitude, centroid_latitude, checklist_count, observer_count
       FROM space_units
       WHERE id = ? AND supported = 1`
    )
    .get(id);
  if (!row) throw requestError("所选地点不在这个模型中", "UNKNOWN_LOCATION", 404);
  return {
    id: String(row.id),
    level: String(row.level),
    code: String(row.code || ""),
    name: String(row.name || "未命名地点"),
    label: locationLabel(row),
    cityName: String(row.city_name || ""),
    districtName: String(row.district_name || ""),
    support: { checklists: Number(row.checklist_count) || 0, observers: Number(row.observer_count) || 0 }
  };
}

function locationPredictions(database, input = {}) {
  const date = normalizeDate(input.date);
  const week = seasonWeek(date);
  const limit = normalizeLimit(input.limit, 30);
  const location = getLocation(database, input.spaceUnitId);
  const rows = database
    .prepare(
      `SELECT lp.taxon_id, lp.probability, lp.ranking_score,
              lp.interval_lower, lp.interval_upper, lp.probability_level,
              lp.effective_checklists, lp.observer_count, lp.support_years_json,
              lp.confidence, lp.fallback_level, lp.resolved_space_unit_id,
              t.common_name, t.scientific_name, t.english_name,
              resolved.level AS resolved_level, resolved.name AS resolved_name
       FROM location_predictions lp
       JOIN taxa t ON t.taxon_id = lp.taxon_id
       LEFT JOIN space_units resolved ON resolved.id = lp.resolved_space_unit_id
       WHERE lp.space_unit_id = ?
         AND lp.temporal_granularity = 'week'
         AND lp.season_bucket = ?
         AND t.is_sensitive = 0
       ORDER BY lp.ranking_score DESC, lp.interval_lower DESC, lp.taxon_id
       LIMIT ?`
    )
    .all(location.id, week, limit);
  if (!rows.length) {
    throw requestError("这个地点和日期暂时没有可用预测", "INSUFFICIENT_DATA", 422);
  }

  return {
    query: { date, seasonWeek: week, limit },
    location,
    results: rows.map((row, index) => ({
      rank: index + 1,
      taxonId: String(row.taxon_id),
      commonName: String(row.common_name || "未命名鸟种"),
      scientificName: String(row.scientific_name || ""),
      englishName: String(row.english_name || ""),
      probability: row.probability == null ? null : Number(row.probability),
      rankingScore: Number(row.ranking_score) || 0,
      probabilityLevel: String(row.probability_level || ""),
      interval: {
        lower: row.interval_lower == null ? null : Number(row.interval_lower),
        upper: row.interval_upper == null ? null : Number(row.interval_upper)
      },
      effectiveChecklists: Number(row.effective_checklists) || 0,
      observerCount: Number(row.observer_count) || 0,
      supportYears: parseJson(row.support_years_json, []),
      confidence: String(row.confidence || ""),
      fallbackLevel: String(row.resolved_level || row.fallback_level || ""),
      fallbackName: String(row.resolved_name || "")
    }))
  };
}

module.exports = {
  getLocation,
  locationPredictions,
  normalizeDate,
  requestError,
  searchLocations
};
