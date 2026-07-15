"use strict";

const { createHash } = require("node:crypto");
const {
  cellToBoundary,
  cellToLatLng,
  getHexagonAreaAvg,
  getHexagonEdgeLengthAvg,
  getResolution,
  gridDisk,
  isValidCell,
  latLngToCell
} = require("h3-js");

const EARTH_RADIUS_METERS = 6378137;
const X_PI = (Math.PI * 3000) / 180;
const H3_RESOLUTIONS = Object.freeze({
  grid_r7: 7,
  grid_r6: 6
});

// Conservative bounds include Zhejiang's inhabited offshore islands. Administrative
// metadata is still the source of truth for district/city assignment.
const ZHEJIANG_BOUNDS = Object.freeze({
  minLongitude: 117.95,
  minLatitude: 26.95,
  maxLongitude: 123.2,
  maxLatitude: 31.35
});

// A conservative coverage mask, deliberately split into mainland and offshore
// envelopes. It is not used for administrative display; its sole purpose is to
// reject obvious Shanghai/Anhui/Jiangxi/Fujian coordinates that a rectangular
// bounding box would incorrectly accept while retaining Zhejiang's islands.
const ZHEJIANG_COVERAGE_POLYGONS = Object.freeze([
  Object.freeze([
    [118.0, 27.75],
    [118.55, 27.15],
    [119.35, 26.98],
    [120.25, 27.08],
    [120.85, 27.45],
    [121.2, 28.05],
    [121.55, 28.75],
    [121.95, 29.7],
    [121.75, 30.25],
    [121.3, 30.85],
    [120.55, 31.18],
    [119.6, 31.15],
    [118.85, 30.8],
    [118.4, 30.25],
    [118.08, 29.55],
    [118.0, 27.75]
  ]),
  Object.freeze([
    [121.45, 29.3],
    [123.2, 29.3],
    [123.2, 30.75],
    [121.45, 30.75],
    [121.45, 29.3]
  ]),
  Object.freeze([
    [120.45, 27.0],
    [121.35, 27.0],
    [121.35, 28.35],
    [120.45, 28.35],
    [120.45, 27.0]
  ])
]);

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeCoordinatePair(longitude, latitude) {
  let lng = toFiniteNumber(longitude);
  let lat = toFiniteNumber(latitude);
  if (lng == null || lat == null) {
    return { longitude: null, latitude: null, swapped: false, valid: false };
  }
  let swapped = false;
  if (Math.abs(lng) <= 90 && Math.abs(lat) > 90 && Math.abs(lat) <= 180) {
    [lng, lat] = [lat, lng];
    swapped = true;
  }
  const valid = Math.abs(lng) <= 180 && Math.abs(lat) <= 90;
  return { longitude: valid ? lng : null, latitude: valid ? lat : null, swapped, valid };
}

function bd09ToGcj02(longitude, latitude) {
  const x = longitude - 0.0065;
  const y = latitude - 0.006;
  const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * X_PI);
  const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * X_PI);
  return {
    longitude: z * Math.cos(theta),
    latitude: z * Math.sin(theta)
  };
}

function transformLatitude(x, y) {
  let value = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  value += ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3;
  value += ((20 * Math.sin(y * Math.PI) + 40 * Math.sin((y / 3) * Math.PI)) * 2) / 3;
  value += ((160 * Math.sin((y / 12) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30)) * 2) / 3;
  return value;
}

function transformLongitude(x, y) {
  let value = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  value += ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3;
  value += ((20 * Math.sin(x * Math.PI) + 40 * Math.sin((x / 3) * Math.PI)) * 2) / 3;
  value += ((150 * Math.sin((x / 12) * Math.PI) + 300 * Math.sin((x / 30) * Math.PI)) * 2) / 3;
  return value;
}

function wgs84ToGcj02(longitude, latitude) {
  const a = 6378245;
  const ee = 0.006693421622965943;
  let deltaLat = transformLatitude(longitude - 105, latitude - 35);
  let deltaLng = transformLongitude(longitude - 105, latitude - 35);
  const radLat = (latitude / 180) * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - ee * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  deltaLat = (deltaLat * 180) / (((a * (1 - ee)) / (magic * sqrtMagic)) * Math.PI);
  deltaLng = (deltaLng * 180) / ((a / sqrtMagic) * Math.cos(radLat) * Math.PI);
  return { longitude: longitude + deltaLng, latitude: latitude + deltaLat };
}

function gcj02ToWgs84(longitude, latitude) {
  // Fixed-point inversion is more accurate than the common one-step approximation
  // and remains deterministic across the offline and online runtimes.
  let estimateLng = longitude;
  let estimateLat = latitude;
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const projected = wgs84ToGcj02(estimateLng, estimateLat);
    estimateLng -= projected.longitude - longitude;
    estimateLat -= projected.latitude - latitude;
  }
  return { longitude: estimateLng, latitude: estimateLat };
}

function bd09ToWgs84(longitude, latitude) {
  const normalized = normalizeCoordinatePair(longitude, latitude);
  if (!normalized.valid) {
    return { ...normalized, source: "bd09" };
  }
  const gcj = bd09ToGcj02(normalized.longitude, normalized.latitude);
  const wgs = gcj02ToWgs84(gcj.longitude, gcj.latitude);
  return {
    longitude: wgs.longitude,
    latitude: wgs.latitude,
    swapped: normalized.swapped,
    valid: Number.isFinite(wgs.longitude) && Number.isFinite(wgs.latitude),
    source: "bd09"
  };
}

function isWithinZhejiang(longitude, latitude) {
  const lng = toFiniteNumber(longitude);
  const lat = toFiniteNumber(latitude);
  if (
    lng == null ||
    lat == null ||
    lng < ZHEJIANG_BOUNDS.minLongitude ||
    lng > ZHEJIANG_BOUNDS.maxLongitude ||
    lat < ZHEJIANG_BOUNDS.minLatitude ||
    lat > ZHEJIANG_BOUNDS.maxLatitude
  ) {
    return false;
  }
  return ZHEJIANG_COVERAGE_POLYGONS.some((polygon) => pointInPolygon(lng, lat, polygon));
}

function pointInPolygon(longitude, latitude, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const [currentLongitude, currentLatitude] = polygon[index];
    const [previousLongitude, previousLatitude] = polygon[previous];
    const crosses =
      currentLatitude > latitude !== previousLatitude > latitude &&
      longitude <
        ((previousLongitude - currentLongitude) * (latitude - currentLatitude)) /
          (previousLatitude - currentLatitude) +
          currentLongitude;
    if (crosses) inside = !inside;
  }
  return inside;
}

function gridCell(longitude, latitude, level = "grid_r7") {
  const resolution = H3_RESOLUTIONS[level];
  if (resolution == null) {
    throw new TypeError(`Unsupported grid level: ${level}`);
  }
  const normalized = normalizeCoordinatePair(longitude, latitude);
  if (!normalized.valid) {
    return null;
  }
  const h3Index = latLngToCell(normalized.latitude, normalized.longitude, resolution);
  const [centroidLatitude, centroidLongitude] = cellToLatLng(h3Index);
  const boundary = cellToBoundary(h3Index, true);
  const longitudes = boundary.map((pair) => Number(pair[0]));
  const latitudes = boundary.map((pair) => Number(pair[1]));
  return {
    id: `${level}:${h3Index}`,
    level,
    h3Index,
    resolution,
    edgeLengthMeters: getHexagonEdgeLengthAvg(resolution, "m"),
    areaSquareMeters: getHexagonAreaAvg(resolution, "m2"),
    boundary,
    minLongitude: Math.min(...longitudes),
    minLatitude: Math.min(...latitudes),
    maxLongitude: Math.max(...longitudes),
    maxLatitude: Math.max(...latitudes),
    centroidLongitude,
    centroidLatitude
  };
}

function parseGridId(id) {
  const match = /^(grid_r[67]):([0-9a-f]{15})$/i.exec(String(id || ""));
  if (!match) {
    return null;
  }
  const level = match[1];
  const h3Index = match[2].toLowerCase();
  const resolution = H3_RESOLUTIONS[level];
  if (!isValidCell(h3Index) || getResolution(h3Index) !== resolution) {
    return null;
  }
  const [centroidLatitude, centroidLongitude] = cellToLatLng(h3Index);
  const boundary = cellToBoundary(h3Index, true);
  const longitudes = boundary.map((pair) => Number(pair[0]));
  const latitudes = boundary.map((pair) => Number(pair[1]));
  return {
    id: `${level}:${h3Index}`,
    level,
    h3Index,
    resolution,
    edgeLengthMeters: getHexagonEdgeLengthAvg(resolution, "m"),
    areaSquareMeters: getHexagonAreaAvg(resolution, "m2"),
    boundary,
    minLongitude: Math.min(...longitudes),
    minLatitude: Math.min(...latitudes),
    maxLongitude: Math.max(...longitudes),
    maxLatitude: Math.max(...latitudes),
    centroidLongitude,
    centroidLatitude
  };
}

function areAdjacentGridCells(leftId, rightId) {
  const left = parseGridId(leftId);
  const right = parseGridId(rightId);
  return Boolean(
    left &&
      right &&
      left.level === right.level &&
      gridDisk(left.h3Index, 1).includes(right.h3Index)
  );
}

function neighboringGridCellIds(id) {
  const parsed = parseGridId(id);
  if (!parsed) return [];
  return gridDisk(parsed.h3Index, 1).map((h3Index) => `${parsed.level}:${h3Index}`);
}

function haversineDistanceMeters(leftLongitude, leftLatitude, rightLongitude, rightLatitude) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(rightLatitude - leftLatitude);
  const deltaLng = toRadians(rightLongitude - leftLongitude);
  const leftLat = toRadians(leftLatitude);
  const rightLat = toRadians(rightLatitude);
  const value =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(leftLat) * Math.cos(rightLat) * Math.sin(deltaLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(value)));
}

function stableHash(value) {
  return createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");
}

function isoDateParts(value) {
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value || "").slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day, iso: text };
}

function seasonalDay(value) {
  const parts = isoDateParts(value);
  if (!parts) {
    return null;
  }
  if (parts.month === 2 && parts.day === 29) {
    return 59.5;
  }
  const reference = new Date(Date.UTC(2001, parts.month - 1, parts.day));
  return Math.floor((reference - Date.UTC(2001, 0, 1)) / 86400000) + 1;
}

function seasonWeek(value) {
  const day = typeof value === "number" ? value : seasonalDay(value);
  if (day == null || !Number.isFinite(day)) {
    return null;
  }
  return Math.min(52, Math.floor((Math.max(1, Math.min(365, day)) - 1) / 7) + 1);
}

function weekCenterDay(week) {
  const normalized = Math.max(1, Math.min(52, Number(week) || 1));
  return normalized === 52 ? 361.5 : (normalized - 1) * 7 + 4;
}

function cyclicDayDistance(leftDay, rightDay) {
  const difference = Math.abs(leftDay - rightDay);
  return Math.min(difference, 365 - difference);
}

function encodeUnitComponent(value) {
  return encodeURIComponent(String(value || "").trim() || "未知");
}

function administrativeUnitId(level, cityName, districtName) {
  if (level === "province") {
    return "province:zhejiang";
  }
  if (level === "city") {
    return `city:${encodeUnitComponent(cityName)}`;
  }
  if (level === "district") {
    return `district:${encodeUnitComponent(cityName)}:${encodeUnitComponent(districtName)}`;
  }
  throw new TypeError(`Unsupported administrative level: ${level}`);
}

module.exports = {
  H3_RESOLUTIONS,
  ZHEJIANG_BOUNDS,
  ZHEJIANG_COVERAGE_POLYGONS,
  administrativeUnitId,
  areAdjacentGridCells,
  bd09ToGcj02,
  bd09ToWgs84,
  cyclicDayDistance,
  gcj02ToWgs84,
  gridCell,
  haversineDistanceMeters,
  isWithinZhejiang,
  neighboringGridCellIds,
  isoDateParts,
  normalizeCoordinatePair,
  parseGridId,
  pointInPolygon,
  seasonWeek,
  seasonalDay,
  stableHash,
  weekCenterDay,
  wgs84ToGcj02
};
