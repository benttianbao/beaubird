"use strict";

const { DatabaseSync } = require("node:sqlite");
const {
  ZHEJIANG_BOUNDS,
  gridCell,
  isWithinZhejiang,
  seasonWeek,
  seasonalDay,
  weekCenterDay
} = require("./geo");
const {
  betaInterval,
  calibrateProbability,
  confidenceLevel,
  probabilityLevel
} = require("./math");
const { adminCapForTaxon, capEffectiveEvidence } = require("./spatial-transfer");
const {
  RANKING_REFERENCE_CONTRACT,
  RANKING_REFERENCE_CONTRACT_SHA256
} = require("./ranking-reference");
const {
  RANKING_REFERENCE_BINDING_KIND,
  RANKING_REFERENCE_OUTPUT_MEANING,
  normalizeParameters,
  parameterMap,
  parameterSetSha256,
  referenceRange
} = require("./ranking-reference-runtime");
class SensitivePredictionModel {
  constructor() {
    throw new Error("当前离线模型不启用独立敏感鸟制品；所有有效鸟种统一来自公共训练快照。");
  }
}

const SCHEMA_VERSION = "3";
const SUPPORTED_SCHEMA_VERSIONS = Object.freeze(new Set(["2", SCHEMA_VERSION]));
const REQUIRED_RUNTIME_TABLES = Object.freeze([
  "manifest",
  "taxa",
  "space_units",
  "location_lookup",
  "checklist_exposure",
  "taxon_detection",
  "calibration_parameters",
  "location_predictions",
  "reverse_hotspots"
]);
const DEFAULT_PRIOR_STRENGTHS = Object.freeze({
  city: 24,
  district: 18,
  grid_r6: 14,
  grid_r7: 10,
  point: 8
});
const PREVALENCE_GROUPS = Object.freeze(["rare_under_30", "group_30_79", "group_80_199", "species_200_plus"]);

function prevalenceGroup(positiveCount) {
  const count = Number(positiveCount) || 0;
  if (count >= 200) return "species_200_plus";
  if (count >= 80) return "group_80_199";
  if (count >= 30) return "group_30_79";
  return "rare_under_30";
}

function calibrationGroup(positiveCount) {
  const count = Number(positiveCount) || 0;
  if (count < 30) return null;
  if (count < 60) return "positive_30_59";
  if (count < 120) return "positive_60_119";
  if (count < 200) return "positive_120_199";
  return null;
}

function resolvePriorStrength(flatStrengths, strengthsByPrevalence, level, positiveCount) {
  const group = prevalenceGroup(positiveCount);
  const tuned = Number(strengthsByPrevalence?.[level]?.[group]);
  if (Number.isFinite(tuned) && tuned > 0) return tuned;
  const fallback = Number(flatStrengths?.[level]);
  if (Number.isFinite(fallback) && fallback > 0) return fallback;
  return Number(DEFAULT_PRIOR_STRENGTHS[level]) || 10;
}

class PredictionError extends Error {
  constructor(code, message, statusCode = 400, details = undefined) {
    super(message);
    this.name = "PredictionError";
    this.code = code;
    this.statusCode = statusCode;
    if (details !== undefined) this.details = details;
  }
}

function parseJson(value, fallback) {
  try {
    return value == null || value === "" ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function parseManifestValue(value) {
  if (value == null) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function toLimit(value, fallback = 20) {
  const parsed = Number.parseInt(value ?? fallback, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(600, parsed));
}

function normalizeDate(value) {
  const text = String(value || "").slice(0, 10);
  if (seasonalDay(text) == null) {
    throw new PredictionError("INVALID_REQUEST", "date 必须是有效的 YYYY-MM-DD 日期。", 400);
  }
  return text;
}

function rowToUnit(row) {
  if (!row) return null;
  return {
    id: row.id,
    level: row.level,
    code: row.code,
    name: row.name,
    parentId: row.parent_id,
    cityName: row.city_name,
    districtName: row.district_name,
    centroidLongitude: row.centroid_longitude,
    centroidLatitude: row.centroid_latitude,
    boundary: parseJson(row.boundary_json, null),
    minLongitude: row.min_longitude,
    minLatitude: row.min_latitude,
    maxLongitude: row.max_longitude,
    maxLatitude: row.max_latitude,
    checklistCount: row.checklist_count,
    observerCount: row.observer_count,
    supportYears: parseJson(row.support_years_json, []),
    supported: Boolean(row.supported)
  };
}

function rowToTaxon(row) {
  if (!row) return null;
  return {
    taxonId: row.taxon_id,
    commonName: row.common_name,
    scientificName: row.scientific_name,
    englishName: row.english_name || "",
    sensitive: Boolean(row.is_sensitive),
    positiveCount: Number(row.positive_count) || 0,
    observerCount: Number(row.observer_count) || 0,
    rawPositiveReports: Number(row.raw_positive_reports) || 0,
    effectivePositiveUnits: Number(row.effective_positive_units) || 0,
    eventCount: Number(row.event_count) || 0,
    supportYearCount: Number(row.support_year_count) || 0,
    dominantEventShare: Number(row.dominant_event_share) || 0,
    eventDominated: Boolean(row.event_dominated),
    singleSupportYear: Boolean(row.single_support_year),
    vagrantCandidate: Boolean(row.vagrant_candidate),
    vagrantReason: row.vagrant_reason || null,
    calibrationScope: row.calibration_scope || "none"
  };
}

function outputProbability(taxon, rawProbability, calibratedProbability) {
  return taxon.positiveCount >= 30 && !taxon.vagrantCandidate ? calibratedProbability : null;
}

function taxonDataSufficiency(taxon) {
  if (taxon.vagrantCandidate) return "event_history_only";
  return taxon.positiveCount >= 30 ? "sufficient" : "insufficient";
}

function taxonOccurrencePattern(taxon) {
  return {
    label: taxon.vagrantCandidate ? "偶发/追鸟聚集候选" : "稳定季节模式",
    vagrantCandidate: taxon.vagrantCandidate,
    eventDominated: taxon.eventDominated,
    singleSupportYear: taxon.singleSupportYear,
    dominantEventShare: taxon.dominantEventShare,
    eventCount: taxon.eventCount,
    supportYearCount: taxon.supportYearCount,
    reason: taxon.vagrantReason
  };
}

function seasonSegments(startDay, endDay) {
  if (startDay == null || endDay == null) return [];
  const start = Number(startDay);
  const end = Number(endDay);
  return start <= end ? [[start, end]] : [[start, 365], [1, end]];
}

function seasonWindowsIntersect(leftStart, leftEnd, rightStart, rightEnd) {
  const left = seasonSegments(leftStart, leftEnd);
  const right = seasonSegments(rightStart, rightEnd);
  if (!left.length || !right.length) return true;
  return left.some(([start, end]) =>
    right.some(([otherStart, otherEnd]) => Math.max(start, otherStart) <= Math.min(end, otherEnd))
  );
}

function requestedSeasonDays(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return null;
  const start = seasonalDay(normalizeDate(dateFrom || dateTo));
  const end = seasonalDay(normalizeDate(dateTo || dateFrom));
  return { start, end };
}

function seasonDayToIso(year, day) {
  const rounded = Math.max(1, Math.min(365, Math.round(Number(day) || 1)));
  const reference = new Date(Date.UTC(2001, 0, rounded));
  const date = new Date(Date.UTC(year, reference.getUTCMonth(), reference.getUTCDate()));
  return date.toISOString().slice(0, 10);
}

function formatSeasonWindow(startDay, endDay, requestedYear) {
  const year = Number(requestedYear) || new Date().getUTCFullYear();
  const startDate = seasonDayToIso(year, startDay);
  const endYear = Number(endDay) < Number(startDay) ? year + 1 : year;
  const endDate = seasonDayToIso(endYear, endDay);
  const peakDate = seasonDayToIso(year, (Number(startDay) + Number(endDay)) / 2);
  const label = `${Number(startDate.slice(5, 7))}月${Number(startDate.slice(8, 10))}日—${Number(endDate.slice(5, 7))}月${Number(endDate.slice(8, 10))}日`;
  return { startDate, endDate, peakDate, label };
}

class PredictionModel {
  constructor(options = {}) {
    if (!options.database && !options.databasePath) {
      throw new PredictionError("MODEL_UNAVAILABLE", "未配置预测模型数据库。", 503);
    }
    this.ownsDatabase = !options.database;
    this.testOnlyRequested = options.testOnly === true;
    this.builderEvaluation = options.builderEvaluation === true;
    if (this.builderEvaluation && (!options.database || options.databasePath)) {
      throw new PredictionError("MODEL_UNAVAILABLE", "builderEvaluation 只允许使用构建器共享的内存数据库句柄。", 503);
    }
    if (this.testOnlyRequested && process.env.NODE_ENV === "production") {
      throw new PredictionError("MODEL_UNAVAILABLE", "生产环境禁止加载 testOnly 预测模型。", 503);
    }
    try {
      this.database = options.database || new DatabaseSync(options.databasePath, { readOnly: true });
      if (this.ownsDatabase) this.database.exec("PRAGMA query_only = ON");
    } catch (error) {
      throw new PredictionError("MODEL_UNAVAILABLE", `无法打开预测模型：${error.message}`, 503);
    }
    this.manifestMap = new Map();
    this.unitCache = new Map();
    this.exposureCache = new Map();
    this.detectionCache = new Map();
    this.taxonCache = new Map();
    this.calibrationCache = new Map();
    this.spatialCalibrationCache = new Map();
    this.spatialCalibrationEnabled = false;
    this.rankingReferenceParameters = new Map();
    this.rankingReferenceEnabled = false;
    this.schemaVersion = "";
    this.locationPredictionsHaveResolvedUnit = false;
    this.sensitiveModel = null;
    try {
      this.#initialize();
      if (options.sensitiveArtifactPath || options.sensitiveEncryptedArtifact) {
        this.sensitiveModel = new SensitivePredictionModel({
          artifactPath: options.sensitiveArtifactPath,
          encryptedArtifact: options.sensitiveEncryptedArtifact,
          key: options.sensitiveKey,
          allowUnqualifiedForTesting: this.testOnlyRequested
        });
        const sensitiveMeta = this.sensitiveModel.meta();
        const publicCutoff = String(this.manifestMap.get("data_cutoff_date") || "");
        if (String(sensitiveMeta.dataCutoffDate || "") !== publicCutoff) {
          throw new Error(
            `敏感预测制品数据截止日期 ${sensitiveMeta.dataCutoffDate || "未知"} 与公共模型 ${publicCutoff || "未知"} 不一致`
          );
        }
        const publicSnapshotSha256 = String(this.manifestMap.get("source_snapshot_sha256") || "").toLowerCase();
        const sensitiveSnapshotSha256 = String(sensitiveMeta.sourceSnapshotSha256 || "").toLowerCase();
        if (
          !/^[a-f0-9]{64}$/.test(publicSnapshotSha256) ||
          sensitiveSnapshotSha256 !== publicSnapshotSha256
        ) {
          throw new Error("公共与敏感预测制品未绑定到同一个训练快照 SHA-256");
        }
      }
      this.ready();
    } catch (error) {
      try {
        this.sensitiveModel?.close();
      } catch {
        // Preserve the original validation error.
      }
      this.sensitiveModel = null;
      if (this.ownsDatabase && this.database) {
        try {
          this.database.close();
        } catch {
          // Preserve the model validation error while still attempting to release the file handle.
        }
      }
      this.database = null;
      throw error;
    }
  }

  #initialize() {
    try {
      for (const row of this.database.prepare("SELECT key, value FROM manifest").iterate()) {
        this.manifestMap.set(row.key, parseManifestValue(row.value));
      }
      this.schemaVersion = String(this.manifestMap.get("schema_version") || "");
      if (!SUPPORTED_SCHEMA_VERSIONS.has(this.schemaVersion)) {
        throw new Error(`不支持的模型 schema_version=${this.schemaVersion}`);
      }
      const qualityGate = this.manifestMap.get("quality_gate");
      if (!qualityGate || typeof qualityGate !== "object" || qualityGate.passed !== true) {
        throw new Error("模型未通过 manifest.quality_gate，拒绝加载");
      }
      if (qualityGate.internalBuild === true && !this.builderEvaluation) {
        throw new Error("构建中间制品不得作为线上模型加载");
      }
      if (this.builderEvaluation && qualityGate.internalBuild !== true) {
        throw new Error("builderEvaluation 仅能加载显式标记的构建中间制品");
      }
      const artifactIsTestOnly = this.manifestMap.get("test_only") === true;
      if (artifactIsTestOnly && (!this.testOnlyRequested || process.env.NODE_ENV === "production")) {
        throw new Error("testOnly 模型只能在非生产测试中显式加载");
      }
      for (const row of this.database.prepare("SELECT * FROM calibration_parameters").iterate()) {
        this.calibrationCache.set(`${row.scope}:${row.scope_id}`, {
          a: row.a,
          b: row.b,
          c: row.c
        });
      }
      this.spatialCalibrationEnabled = this.manifestMap.get("novel_grid_spatial_calibration_enabled") === true;
      const spatialCalibrators = this.manifestMap.get("novel_grid_spatial_calibrators") || [];
      if (!Array.isArray(spatialCalibrators)) {
        throw new Error("manifest.novel_grid_spatial_calibrators 必须是数组");
      }
      for (const calibrator of spatialCalibrators) {
        const scope = String(calibrator?.scope || "");
        const fit = calibrator?.fit || {};
        if (
          !/^(species:[^:]+|group:positive_(30_59|60_119|120_199))$/.test(scope) ||
          ![fit.a, fit.b, fit.c].every((value) => Number.isFinite(Number(value))) ||
          this.spatialCalibrationCache.has(scope)
        ) {
          throw new Error(`无效或重复的 novel-grid 空间校准参数：${scope || "<empty>"}`);
        }
        this.spatialCalibrationCache.set(scope, {
          a: Number(fit.a),
          b: Number(fit.b),
          c: Number(fit.c)
        });
      }
      if (this.schemaVersion === SCHEMA_VERSION) {
        const binding = this.manifestMap.get("ranking_reference");
        if (
          !binding || binding.kind !== RANKING_REFERENCE_BINDING_KIND ||
          binding.outputMeaning !== RANKING_REFERENCE_OUTPUT_MEANING ||
          binding.contractId !== RANKING_REFERENCE_CONTRACT.id ||
          binding.contractSha256 !== RANKING_REFERENCE_CONTRACT_SHA256 ||
          binding.diagnosticOnly !== true || binding.freezeEligible !== false ||
          binding.sealedPanelViewed !== false
        ) {
          throw new Error("schema v3 缺少有效的 ranking_reference manifest 绑定");
        }
        const rows = this.database.prepare(
          `SELECT scope, half_width, row_count, total_weight,
                  calibration_fold_count, fold_quantiles_json
           FROM ranking_reference_parameters
           ORDER BY scope`
        ).all();
        const parameters = normalizeParameters(rows.map((row) => ({
          scope: row.scope,
          halfWidth: row.half_width,
          rowCount: row.row_count,
          totalWeight: row.total_weight,
          calibrationFoldCount: row.calibration_fold_count,
          foldQuantiles: parseJson(row.fold_quantiles_json, [])
        })));
        if (
          Number(binding.parameterCount) !== parameters.length ||
          binding.parametersSha256 !== parameterSetSha256(parameters)
        ) {
          throw new Error("ranking_reference 参数数量或 SHA-256 不匹配");
        }
        this.rankingReferenceParameters = parameterMap(parameters);
        this.rankingReferenceEnabled = true;
      }
      this.locationPredictionsHaveResolvedUnit = this.database
        .prepare("PRAGMA table_info(location_predictions)")
        .all()
        .some((column) => column.name === "resolved_space_unit_id");
    } catch (error) {
      throw new PredictionError("MODEL_UNAVAILABLE", `预测模型结构无效：${error.message}`, 503);
    }
  }

  close() {
    if (this.sensitiveModel) this.sensitiveModel.close();
    this.sensitiveModel = null;
    if (this.ownsDatabase && this.database) this.database.close();
    this.database = null;
  }

  ready() {
    try {
      for (const table of REQUIRED_RUNTIME_TABLES) {
        this.database.prepare(`SELECT 1 FROM ${table} LIMIT 1`).get();
      }
      if (this.schemaVersion === SCHEMA_VERSION) {
        this.database.prepare("SELECT 1 FROM ranking_reference_parameters LIMIT 1").get();
      }
      if (this.sensitiveModel) this.sensitiveModel.meta();
      const meta = this.meta();
      return { ok: true, modelVersion: meta.modelVersion, schemaVersion: meta.schemaVersion };
    } catch (error) {
      if (error instanceof PredictionError) throw error;
      throw new PredictionError("MODEL_UNAVAILABLE", `预测模型 readiness 检查失败：${error.message}`, 503);
    }
  }

  meta() {
    const rawCoverage = this.manifestMap.get("coverage") || {};
    const taxonCount = Number(this.database.prepare("SELECT COUNT(*) AS count FROM taxa").get().count) || 0;
    const dataCutoffDate = String(this.manifestMap.get("data_cutoff_date") || "");
    const coverage = {
      ...rawCoverage,
      checklists: Number(rawCoverage.insertedTrainingReports || rawCoverage.completeCount || 0),
      taxa: taxonCount,
      dateFrom: String(rawCoverage.dataStartDate || ""),
      dateTo: dataCutoffDate,
      longitudeCoverage: Number(rawCoverage.coordinateCoverage || 0)
    };
    return {
      modelVersion: String(this.manifestMap.get("model_version") || ""),
      dataCutoffDate,
      builtAt: String(this.manifestMap.get("built_at") || ""),
      generatedAt: String(this.manifestMap.get("built_at") || ""),
      probabilityDefinition: String(this.manifestMap.get("probability_definition") || ""),
      coordinateSystem: "WGS84",
      sourceCoordinateSystem: String(this.manifestMap.get("source_coordinate_system") || "BD-09"),
      gridAlgorithm: String(this.manifestMap.get("grid_algorithm") || "h3_v4"),
      administrativeCoverageIndex: String(this.manifestMap.get("administrative_coverage_index") || ""),
      temporalBandwidthDays: Number(this.manifestMap.get("temporal_bandwidth_days") || 14),
      temporalEvaluationModel: String(this.manifestMap.get("temporal_evaluation_model") || ""),
      rankingReference: this.manifestMap.get("ranking_reference") || null,
      temporalBaselineModel: String(this.manifestMap.get("temporal_baseline_model") || ""),
      coverage,
      sensitiveAvailable: Boolean(this.sensitiveModel),
      schemaVersion: String(this.manifestMap.get("schema_version"))
    };
  }

  #getUnit(unitId) {
    if (!unitId) return null;
    if (!this.unitCache.has(unitId)) {
      const row = this.database.prepare("SELECT * FROM space_units WHERE id = ?").get(unitId);
      this.unitCache.set(unitId, rowToUnit(row));
    }
    return this.unitCache.get(unitId);
  }

  #getTaxon(taxonId) {
    const key = String(taxonId || "");
    if (!this.taxonCache.has(key)) {
      this.taxonCache.set(key, rowToTaxon(this.database.prepare("SELECT * FROM taxa WHERE taxon_id = ?").get(key)));
    }
    return this.taxonCache.get(key);
  }

  #resolveAdministrativeCoverage(longitude, latitude) {
    const row = this.database
      .prepare(
        `SELECT *
         FROM space_units
         WHERE level IN ('district', 'city')
           AND supported = 1
           AND min_longitude IS NOT NULL AND max_longitude IS NOT NULL
           AND min_latitude IS NOT NULL AND max_latitude IS NOT NULL
           AND min_longitude <= ? AND max_longitude >= ?
           AND min_latitude <= ? AND max_latitude >= ?
         ORDER BY CASE level WHEN 'district' THEN 0 ELSE 1 END,
                  ((max_longitude - min_longitude) * (max_latitude - min_latitude)) ASC,
                  checklist_count DESC, id
         LIMIT 1`
      )
      .get(longitude, longitude, latitude, latitude);
    return rowToUnit(row);
  }

  #pathFromUnit(unitId) {
    const reversed = [];
    const seen = new Set();
    let unit = this.#getUnit(unitId);
    while (unit && !seen.has(unit.id)) {
      reversed.push(unit);
      seen.add(unit.id);
      unit = this.#getUnit(unit.parentId);
    }
    return reversed.reverse();
  }

  #resolveLocation(input) {
    const hasPointId = input.pointId != null && Boolean(String(input.pointId).trim());
    const hasLongitude = input.longitude != null || input.lng != null;
    const hasLatitude = input.latitude != null || input.lat != null;
    if (!hasPointId && !hasLongitude && !hasLatitude) {
      throw new PredictionError("INVALID_REQUEST", "必须提供 pointId 或一组 WGS84 longitude/latitude。", 400);
    }
    if (hasLongitude !== hasLatitude) {
      throw new PredictionError("INVALID_REQUEST", "longitude 和 latitude 必须成对提供。", 400);
    }
    let unit = null;
    if (hasPointId) {
      const lookup = this.database
        .prepare("SELECT space_unit_id FROM location_lookup WHERE lookup_type = 'point_id' AND lookup_key = ?")
        .get(String(input.pointId).trim());
      unit = this.#getUnit(lookup?.space_unit_id);
    }

    let longitude = input.longitude ?? input.lng;
    let latitude = input.latitude ?? input.lat;
    if (!unit && longitude != null && latitude != null) {
      longitude = Number(longitude);
      latitude = Number(latitude);
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        throw new PredictionError("INVALID_REQUEST", "longitude/latitude 必须是有限数字。", 400);
      }
      if (!isWithinZhejiang(longitude, latitude)) {
        throw new PredictionError("OUTSIDE_ZHEJIANG", "坐标不在浙江预测覆盖范围内。", 400, ZHEJIANG_BOUNDS);
      }
      const r7 = gridCell(longitude, latitude, "grid_r7");
      const r6 = gridCell(longitude, latitude, "grid_r6");
      unit = this.#getUnit(r7.id) || this.#getUnit(r6.id);
      if (!unit) unit = this.#resolveAdministrativeCoverage(longitude, latitude);
    }

    if (!unit) {
      if (input.pointId != null && longitude == null && latitude == null) {
        throw new PredictionError("INSUFFICIENT_DATA", "该点位不在当前模型中，请同时提供经纬度。", 422);
      }
      unit = this.#getUnit("province:zhejiang");
    }
    const path = this.#pathFromUnit(unit.id);
    const supported = path.filter((candidate) => candidate.supported);
    if (!supported.length) {
      throw new PredictionError("INSUFFICIENT_DATA", "该位置暂无足够训练数据。", 422);
    }
    return {
      path,
      resolvedUnit: supported[supported.length - 1],
      longitude: Number.isFinite(Number(longitude)) ? Number(longitude) : null,
      latitude: Number.isFinite(Number(latitude)) ? Number(latitude) : null
    };
  }

  #readExposure(unitId) {
    if (!this.exposureCache.has(unitId)) {
      const values = Array.from({ length: 53 }, () => ({ effective: 0, raw: 0, observers: 0, years: [] }));
      for (const row of this.database
        .prepare("SELECT * FROM checklist_exposure WHERE space_unit_id = ? ORDER BY season_week")
        .iterate(unitId)) {
        values[row.season_week] = {
          effective: Number(row.effective_checklists) || 0,
          raw: Number(row.raw_checklists) || 0,
          observers: Number(row.observer_count) || 0,
          years: parseJson(row.support_years_json, [])
        };
      }
      this.exposureCache.set(unitId, values);
    }
    return this.exposureCache.get(unitId);
  }

  #readDetection(unitId, taxonId) {
    if (!this.detectionCache.has(unitId)) this.detectionCache.set(unitId, new Map());
    const unitCache = this.detectionCache.get(unitId);
    if (!unitCache.has(taxonId)) {
      const values = Array.from({ length: 53 }, () => ({ effective: 0, raw: 0, observers: 0, years: [] }));
      for (const row of this.database
        .prepare("SELECT * FROM taxon_detection WHERE space_unit_id = ? AND taxon_id = ? ORDER BY season_week")
        .iterate(unitId, taxonId)) {
        values[row.season_week] = {
          effective: Number(row.effective_detections) || 0,
          raw: Number(row.raw_detections) || 0,
          observers: Number(row.observer_count) || 0,
          years: parseJson(row.support_years_json, [])
        };
      }
      unitCache.set(taxonId, values);
    }
    return unitCache.get(taxonId);
  }

  #smoothed(values, day, field) {
    const bandwidth = Number(this.manifestMap.get("temporal_bandwidth_days") || 14);
    let total = 0;
    for (let week = 1; week <= 52; week += 1) {
      const difference = Math.abs(day - weekCenterDay(week));
      const distance = Math.min(difference, 365 - difference);
      if (distance > bandwidth * 3.5) continue;
      const weight = Math.exp(-0.5 * (distance / bandwidth) ** 2);
      total += (Number(values[week]?.[field]) || 0) * weight;
    }
    return total;
  }

  #supportAround(values, day) {
    const bandwidth = Number(this.manifestMap.get("temporal_bandwidth_days") || 14);
    let observers = 0;
    const years = new Set();
    for (let week = 1; week <= 52; week += 1) {
      const difference = Math.abs(day - weekCenterDay(week));
      const distance = Math.min(difference, 365 - difference);
      if (distance > bandwidth * 3.5 || Number(values[week]?.effective) <= 0) continue;
      // Weekly observer sets are not retained in the online artifact. Taking the
      // maximum is conservative: summing would double-count returning observers.
      observers = Math.max(observers, Number(values[week]?.observers) || 0);
      for (const year of values[week]?.years || []) years.add(Number(year));
    }
    return { observers, years: [...years].filter(Number.isFinite).sort((left, right) => left - right) };
  }

  releaseUnitScoreCache(unitId) {
    this.exposureCache.delete(unitId);
    this.detectionCache.delete(unitId);
  }

  #calibratorFor(taxon) {
    if (taxon.calibrationScope === "species") {
      return this.calibrationCache.get(`species:${taxon.taxonId}`) || null;
    }
    if (taxon.calibrationScope.startsWith("group:")) {
      return this.calibrationCache.get(`group:${taxon.calibrationScope.slice(6)}`) || null;
    }
    return null;
  }

  #spatialCalibratorFor(taxon) {
    if (Number(taxon.positiveCount) >= 200) {
      return this.spatialCalibrationCache.get(`species:${taxon.taxonId}`) || null;
    }
    const group = calibrationGroup(taxon.positiveCount);
    return group ? this.spatialCalibrationCache.get(`group:${group}`) || null : null;
  }

  scoreUnitTaxonAtDay(unitId, taxonId, day) {
    const taxon = this.#getTaxon(taxonId);
    if (!taxon) {
      throw new PredictionError("UNKNOWN_TAXON", "模型中不存在该鸟种。", 404);
    }
    const fullPath = this.#pathFromUnit(unitId);
    const path = fullPath.filter((unit) => unit.supported);
    if (!path.length) {
      throw new PredictionError("INSUFFICIENT_DATA", "空间单元没有足够训练数据。", 422);
    }
    const priorStrengths = {
      ...DEFAULT_PRIOR_STRENGTHS,
      ...(this.manifestMap.get("prior_strengths") || {})
    };
    const priorStrengthsByPrevalence = this.manifestMap.get("prior_strengths_by_prevalence") || {};
    const adminExposureCapsByPrevalence =
      this.manifestMap.get("novel_grid_admin_exposure_caps_by_prevalence") || null;
    const hasSupportedLocalUnit = fullPath.some(
      (unit) => unit.supported && ["grid_r6", "grid_r7", "point"].includes(unit.level)
    );
    const applyNovelGridTransfer = Boolean(adminExposureCapsByPrevalence && !hasSupportedLocalUnit);
    const taxonPrevalenceGroup = prevalenceGroup(taxon.positiveCount);
    let alpha = 1;
    let beta = 1;
    let effective = 0;
    let deepest = path[0];
    let detectionSupport = { observers: 0, years: [] };
    for (const unit of path) {
      let exposure = this.#smoothed(this.#readExposure(unit.id), day, "effective");
      const detectionValues = this.#readDetection(unit.id, taxonId);
      let detections = Math.min(exposure, this.#smoothed(detectionValues, day, "effective"));
      if (applyNovelGridTransfer && (unit.level === "city" || unit.level === "district")) {
        const cap = adminCapForTaxon(
          adminExposureCapsByPrevalence,
          taxonPrevalenceGroup,
          unit.level
        );
        const capped = capEffectiveEvidence(exposure, detections, cap);
        exposure = capped.exposure;
        detections = capped.detections;
      }
      if (unit.level === "province") {
        alpha = 1 + detections;
        beta = 1 + Math.max(0, exposure - detections);
        effective = exposure;
        deepest = unit;
        detectionSupport = this.#supportAround(detectionValues, day);
        continue;
      }
      if (exposure <= 0) continue;
      const parentProbability = alpha / (alpha + beta);
      const strength = resolvePriorStrength(
        priorStrengths,
        priorStrengthsByPrevalence,
        unit.level,
        taxon.positiveCount
      );
      alpha = parentProbability * strength + detections;
      beta = (1 - parentProbability) * strength + Math.max(0, exposure - detections);
      effective = exposure;
      deepest = unit;
      detectionSupport = this.#supportAround(detectionValues, day);
    }
    const rawProbability = alpha / (alpha + beta);
    const rawInterval = betaInterval(alpha, beta, 0.9);
    const calibrator = applyNovelGridTransfer && this.spatialCalibrationEnabled
      ? this.#spatialCalibratorFor(taxon)
      : this.#calibratorFor(taxon);
    const probability = calibrateProbability(rawProbability, calibrator);
    const posteriorLower = calibrateProbability(rawInterval.lower, calibrator);
    const posteriorUpper = calibrateProbability(rawInterval.upper, calibrator);
    const range = this.rankingReferenceEnabled
      ? referenceRange(probability, taxon.taxonId, taxon.positiveCount, this.rankingReferenceParameters)
      : {
          lower: Math.min(posteriorLower, posteriorUpper),
          upper: Math.max(posteriorLower, posteriorUpper),
          confidence: confidenceLevel(
            effective,
            detectionSupport.observers,
            posteriorLower,
            posteriorUpper
          ),
          sourceScopes: []
        };
    return {
      taxon,
      rawProbability,
      probability,
      intervalLower: range.lower,
      intervalUpper: range.upper,
      intervalMeaning: this.rankingReferenceEnabled
        ? RANKING_REFERENCE_OUTPUT_MEANING
        : "beta_posterior_probability_interval",
      referenceSourceScopes: range.sourceScopes,
      posteriorIntervalLower: Math.min(posteriorLower, posteriorUpper),
      posteriorIntervalUpper: Math.max(posteriorLower, posteriorUpper),
      probabilityLevel: probabilityLevel(probability),
      effectiveChecklists: effective,
      observerCount: detectionSupport.observers,
      supportYears: detectionSupport.years,
      confidence: range.confidence,
      unit: deepest
    };
  }

  scoreUnitTaxonAtWeek(unitId, taxonId, week) {
    return this.scoreUnitTaxonAtDay(unitId, taxonId, weekCenterDay(week));
  }

  #formatLocationRow(row, taxon) {
    const calibrated = Number(row.probability);
    const spatialLevel = this.locationPredictionsHaveResolvedUnit
      ? row.unit_level || row.fallback_level
      : row.fallback_level || row.unit_level;
    const resolvedSpaceUnitId = row.resolved_unit_id || row.resolved_space_unit_id || row.space_unit_id;
    const sensitivePoint = taxon.sensitive && spatialLevel === "point";
    return {
      taxonId: taxon.taxonId,
      commonName: taxon.commonName,
      scientificName: taxon.scientificName,
      probability: outputProbability(taxon, calibrated, calibrated),
      probabilityLevel: row.probability_level,
      interval: {
        lower: Number(row.interval_lower),
        upper: Number(row.interval_upper)
      },
      intervalMeaning: this.rankingReferenceEnabled
        ? RANKING_REFERENCE_OUTPUT_MEANING
        : "beta_posterior_probability_interval",
      effectiveChecklists: Number(row.effective_checklists),
      observerCount: Number(row.observer_count),
      supportYears: parseJson(row.support_years_json, []),
      confidence: row.confidence,
      sensitive: taxon.sensitive,
      occurrencePattern: taxonOccurrencePattern(taxon),
      fallbackLevel: spatialLevel,
      spatialLevel,
      spatialCode: sensitivePoint ? null : row.unit_code || null,
      requestedSpaceUnitId: row.space_unit_id,
      spaceUnit: {
        id: sensitivePoint ? null : resolvedSpaceUnitId,
        level: spatialLevel,
        code: sensitivePoint ? null : row.unit_code || null,
        name: row.unit_name || ""
      },
      support: {
        effectiveChecklists: Number(row.effective_checklists),
        observers: Number(row.observer_count),
        years: parseJson(row.support_years_json, [])
      },
      temporalGranularity: row.temporal_granularity,
      dataSufficiency: taxonDataSufficiency(taxon)
    };
  }

  #asPredictionError(error) {
    if (error instanceof PredictionError) return error;
    if (error?.code) {
      return new PredictionError(error.code, error.message, Number(error.statusCode) || 400, error.details);
    }
    return new PredictionError("MODEL_UNAVAILABLE", `敏感预测查询失败：${error?.message || error}`, 503);
  }

  #isSensitiveTaxon(taxonId) {
    if (!this.sensitiveModel) return false;
    if (typeof this.sensitiveModel.hasTaxon === "function") {
      return Boolean(this.sensitiveModel.hasTaxon(taxonId));
    }
    return Boolean(this.sensitiveModel.taxa?.has(String(taxonId || "")));
  }

  byLocation(input = {}) {
    const date = normalizeDate(input.date);
    const week = seasonWeek(date);
    const location = this.#resolveLocation(input);
    const limit = toLimit(input.limit);
    const role = input.role === "admin" ? "admin" : "user";
    const locationPredictionSql = this.locationPredictionsHaveResolvedUnit
      ? `SELECT lp.*, resolved.id AS resolved_unit_id,
                resolved.level AS unit_level, resolved.code AS unit_code, resolved.name AS unit_name
         FROM location_predictions lp
         JOIN space_units resolved ON resolved.id = lp.resolved_space_unit_id
         JOIN taxa t ON t.taxon_id = lp.taxon_id
         WHERE lp.space_unit_id = ?
           AND lp.temporal_granularity = 'week'
           AND lp.season_bucket = ?
           AND t.is_sensitive = 0
         ORDER BY lp.ranking_score DESC, lp.interval_lower DESC
         LIMIT ?`
      : `SELECT lp.*, su.id AS resolved_unit_id,
                su.level AS unit_level, su.code AS unit_code, su.name AS unit_name
         FROM location_predictions lp
         JOIN space_units su ON su.id = lp.space_unit_id
         JOIN taxa t ON t.taxon_id = lp.taxon_id
         WHERE lp.space_unit_id = ?
           AND lp.temporal_granularity = 'week'
           AND lp.season_bucket = ?
           AND t.is_sensitive = 0
         ORDER BY lp.ranking_score DESC, lp.interval_lower DESC
         LIMIT ?`;
    const ordinaryRows = this.database
      .prepare(locationPredictionSql)
      .all(location.resolvedUnit.id, week, limit)
      .filter((row) => !this.#isSensitiveTaxon(row.taxon_id))
      .slice(0, limit);

    let results = ordinaryRows.map((row) => this.#formatLocationRow(row, this.#getTaxon(row.taxon_id)));
    if (this.sensitiveModel) {
      const gridUnit = [...location.path].reverse().find((unit) => unit.level === "grid_r6");
      const cityUnit = location.path.find((unit) => unit.level === "city");
      const cityName = cityUnit?.name || location.resolvedUnit.cityName || "";
      try {
        const sensitive = this.sensitiveModel.byLocation({
          date,
          role,
          limit,
          longitude: location.longitude,
          latitude: location.latitude,
          gridId: gridUnit?.id,
          cityName
        });
        results = [...results, ...sensitive.results]
          .sort((left, right) => {
            const leftScore = Number(left.probability ?? left.interval?.lower ?? -1);
            const rightScore = Number(right.probability ?? right.interval?.lower ?? -1);
            return rightScore - leftScore;
          })
          .slice(0, limit);
      } catch (error) {
        if (error?.code !== "INSUFFICIENT_DATA") throw this.#asPredictionError(error);
      }
    }
    if (!results.length) {
      throw new PredictionError("INSUFFICIENT_DATA", "该时间地点暂无足够预测数据。", 422);
    }
    return {
      query: {
        date,
        pointId: input.pointId == null ? null : String(input.pointId),
        longitude: location.longitude,
        latitude: location.latitude,
        seasonWeek: week,
        resolvedSpaceUnitId: location.resolvedUnit.id,
        resolvedLevel: location.resolvedUnit.level,
        resolvedName: location.resolvedUnit.name
      },
      modelVersion: String(this.manifestMap.get("model_version") || ""),
      dataCutoffDate: String(this.manifestMap.get("data_cutoff_date") || ""),
      probabilityDefinition: String(this.manifestMap.get("probability_definition") || ""),
      results
    };
  }

  bySpecies(input = {}) {
    const taxon = this.#getTaxon(input.taxonId);
    if (this.#isSensitiveTaxon(input.taxonId)) {
      try {
        const response = this.sensitiveModel.bySpecies(input);
        return {
          ...response,
          modelVersion: String(this.manifestMap.get("model_version") || ""),
          dataCutoffDate: String(this.manifestMap.get("data_cutoff_date") || "")
        };
      } catch (error) {
        throw this.#asPredictionError(error);
      }
    }
    if (!taxon) {
      if (this.sensitiveModel) {
        try {
          const response = this.sensitiveModel.bySpecies(input);
          return {
            ...response,
            modelVersion: String(this.manifestMap.get("model_version") || ""),
            dataCutoffDate: String(this.manifestMap.get("data_cutoff_date") || "")
          };
        } catch (error) {
          if (error?.code !== "UNKNOWN_TAXON") throw this.#asPredictionError(error);
        }
      }
      throw new PredictionError("UNKNOWN_TAXON", "模型中不存在该鸟种。", 404);
    }
    const role = input.role === "admin" ? "admin" : "user";
    const limit = toLimit(input.limit);
    const season = requestedSeasonDays(input.dateFrom, input.dateTo);
    const allowedSensitiveLevels = role === "admin"
      ? new Set(["grid_r6", "district", "city", "province"])
      : new Set(["city", "province"]);
    const granularity = taxon.sensitive && role !== "admin" ? "month" : "week";
    const region =
      input.region && typeof input.region === "object"
        ? {
            level: String(input.region.level || "").trim(),
            code: String(input.region.code || "").trim(),
            name: String(input.region.name || "").trim()
          }
        : { level: "", code: "", name: String(input.region || "").trim() };
    const candidates = this.database
      .prepare(
        `SELECT rh.*, su.level, su.name, su.city_name, su.district_name,
                su.code, su.boundary_json, su.centroid_longitude, su.centroid_latitude
         FROM reverse_hotspots rh
         JOIN space_units su ON su.id = rh.space_unit_id
         WHERE rh.taxon_id = ?
           AND rh.temporal_granularity = ?
         ORDER BY rh.rank_score DESC
         LIMIT 2000`
      )
      .all(taxon.taxonId, granularity)
      .filter((row) => !taxon.sensitive || allowedSensitiveLevels.has(row.level))
      .filter((row) => !region.level || row.level === region.level)
      .filter((row) => !region.code || String(row.code) === region.code ||
        parseJson(row.member_space_unit_ids_json, []).includes(region.code))
      .filter(
        (row) =>
          !region.name ||
          [row.name, row.city_name, row.district_name].some((name) => String(name || "").includes(region.name))
      )
      .filter(
        (row) =>
          !season ||
          seasonWindowsIntersect(row.season_start_day, row.season_end_day, season.start, season.end)
      );

    const requestedYear = Number(String(input.dateFrom || input.dateTo || "").slice(0, 4)) || new Date().getUTCFullYear();
    const hotspots = candidates.slice(0, limit).map((row) => {
      const window = formatSeasonWindow(row.season_start_day, row.season_end_day, requestedYear);
      window.peakDate = seasonDayToIso(requestedYear, row.peak_day);
      window.granularity = row.temporal_granularity;
      const centroid =
        taxon.sensitive && role !== "admin"
          ? null
          : { longitude: row.centroid_longitude, latitude: row.centroid_latitude };
      const memberSpaceUnitIds = parseJson(row.member_space_unit_ids_json, [row.space_unit_id]);
      const hotspotBoundary = parseJson(row.hotspot_boundary_json, parseJson(row.boundary_json, null));
      return {
        taxonId: taxon.taxonId,
        commonName: taxon.commonName,
        spaceUnitId: row.space_unit_id,
        level: row.level,
        name: row.name,
        cityName: row.city_name,
        districtName: row.district_name,
        centroid,
        memberSpaceUnitIds,
        region: {
          level: row.level,
          code: row.code,
          name: row.name,
          cityName: row.city_name,
          districtName: row.district_name,
          centroid,
          boundary: taxon.sensitive && role !== "admin" ? null : hotspotBoundary,
          memberSpaceUnitIds
        },
        seasonStartDay: row.season_start_day,
        seasonEndDay: row.season_end_day,
        peakDay: row.peak_day,
        probability: outputProbability(taxon, row.probability, row.probability),
        probabilityLevel: row.probability_level,
        interval: { lower: row.interval_lower, upper: row.interval_upper },
        effectiveChecklists: row.effective_checklists,
        observerCount: row.observer_count,
        supportYears: parseJson(row.support_years_json, []),
        confidence: row.confidence,
        occurrencePattern: taxonOccurrencePattern(taxon),
        support: {
          effectiveChecklists: row.effective_checklists,
          observers: row.observer_count,
          years: parseJson(row.support_years_json, [])
        },
        timeWindow: window,
        temporalGranularity: row.temporal_granularity,
        dataSufficiency: taxonDataSufficiency(taxon)
      };
    });
    if (!hotspots.length) {
      throw new PredictionError("INSUFFICIENT_DATA", "该鸟种在指定范围内暂无足够预测数据。", 422);
    }
    return {
      query: {
        taxonId: taxon.taxonId,
        dateFrom: input.dateFrom || null,
        dateTo: input.dateTo || null,
        region: input.region || null,
        temporalGranularity: granularity
      },
      modelVersion: String(this.manifestMap.get("model_version") || ""),
      dataCutoffDate: String(this.manifestMap.get("data_cutoff_date") || ""),
      taxon,
      hotspots
    };
  }

  searchLocations(input = {}) {
    const query = String(input.query ?? input.q ?? "").trim().slice(0, 80);
    if (!query) return [];
    const limit = Math.max(1, Math.min(20, Number.parseInt(input.limit ?? 10, 10) || 10));
    const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
    return this.database
      .prepare(
        `SELECT code, name, city_name, district_name, checklist_count, observer_count
         FROM space_units
         WHERE level = 'point'
           AND supported = 1
           AND (code LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\'
                OR city_name LIKE ? ESCAPE '\\' OR district_name LIKE ? ESCAPE '\\')
         ORDER BY CASE WHEN code = ? THEN 0 WHEN name = ? THEN 1 ELSE 2 END,
                  checklist_count DESC, observer_count DESC, name
         LIMIT ?`
      )
      .all(pattern, pattern, pattern, pattern, query, query, limit)
      .map((row) => ({
        pointId: String(row.code),
        name: String(row.name || "未命名点位"),
        cityName: String(row.city_name || ""),
        districtName: String(row.district_name || ""),
        support: {
          checklists: Number(row.checklist_count) || 0,
          observers: Number(row.observer_count) || 0
        }
      }));
  }
}

module.exports = {
  DEFAULT_PRIOR_STRENGTHS,
  PREVALENCE_GROUPS,
  PredictionError,
  PredictionModel,
  SCHEMA_VERSION,
  SUPPORTED_SCHEMA_VERSIONS,
  prevalenceGroup,
  resolvePriorStrength
};
