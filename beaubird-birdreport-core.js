(function initBeauBirdBirdreportCore(root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.BeauBirdBirdreportCore = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function createBeauBirdBirdreportCore(root) {
  const BIRDREPORT_VERSION = "CH4";
  const DEFAULT_PROVINCE = "浙江省";
  const RARE_RECORDCOUNT_THRESHOLD = 500;
  const HIDDEN_LOCATION_LABEL = "地点未公开";

  function getSharedData() {
    if (root?.BeauBirdData) {
      return root.BeauBirdData;
    }
    if (typeof require === "function") {
      try {
        return require("./beaubird-data");
      } catch {
        return {};
      }
    }
    return {};
  }

  function normalizeDateInput(value) {
    const normalized = String(value || "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
  }

  function createBirdreportPayload({
    startTime = "",
    endTime = "",
    province = "",
    city = "",
    district = "",
    pointname = "",
    username = "",
    state = "",
    mode = 0
  } = {}) {
    return normalizeBirdreportAdministrativeArea({
      startTime: normalizeDateInput(startTime),
      endTime: normalizeDateInput(endTime),
      province: String(province || "").trim(),
      city: String(city || "").trim(),
      district: String(district || "").trim(),
      pointname: String(pointname || "").trim(),
      username: String(username || "").trim(),
      state: String(state || "").trim(),
      version: BIRDREPORT_VERSION,
      outside_type: 0,
      mode
    });
  }

  function createBirdreportRecordSearchPayload(basePayload, { taxonId = "", taxonName = "" } = {}) {
    return {
      ...basePayload,
      ...(taxonId ? { taxonid: String(taxonId).trim() } : {}),
      ...(taxonName
        ? {
            taxonname: String(taxonName).trim(),
            taxon_name: String(taxonName).trim(),
            name: String(taxonName).trim()
          }
        : {}),
      field: "start_time",
      order: "desc",
      sort: "start_time",
      sortField: "start_time",
      sortOrder: "desc",
      orderField: "start_time",
      orderType: "desc"
    };
  }

  function normalizeBirdreportAdministrativeArea(payload) {
    const normalized = { ...payload };
    const municipalityAreas = getSharedData().birdreportMunicipalityAreas || [];
    const municipalityKey = `${normalized.province || ""}${normalized.city || ""}`;

    if (normalized.city && !normalized.district && municipalityAreas.includes(municipalityKey)) {
      normalized.district = normalized.city;
      normalized.city = "";
    }

    return normalized;
  }

  function formatBirdreportQuerySummary(payload = {}) {
    const areaText = [payload.province, payload.city, payload.district].filter(Boolean).join(" / ");
    const pointText = payload.pointname ? `观测地点“${payload.pointname}”` : "";
    return [areaText, pointText].filter(Boolean).join(" · ") || "当前筛选条件";
  }

  function getBirdreportTaxonKey(item) {
    return String(item?.taxon_id || item?.taxonid || item?.id || item?.key || item?.taxonname || item?.name || "").trim();
  }

  function getBirdreportTaxonName(item) {
    return String(item?.taxonname || item?.name || "").trim();
  }

  function normalizeBirdreportTaxon(item) {
    const key = getBirdreportTaxonKey(item);
    const recordcount = Number(item?.recordcount) || 0;
    const explicitRare = typeof item?.isRare === "boolean" ? item.isRare : undefined;
    return {
      key,
      taxon_id: String(item?.taxon_id || item?.taxonid || item?.id || key || "").trim(),
      taxonname: getBirdreportTaxonName(item),
      latinname: String(item?.latinname || item?.englishname || item?.scientificName || item?.sciName || "").trim(),
      taxonordername: String(item?.taxonordername || item?.orderName || "").trim(),
      taxonfamilyname: String(item?.taxonfamilyname || item?.familyName || "").trim(),
      recordcount,
      reportcount: Number(item?.reportcount ?? item?.reportCount ?? item?.report_count) || 0,
      isRare: explicitRare ?? recordcount <= RARE_RECORDCOUNT_THRESHOLD
    };
  }

  function normalizeBirdreportRecord(item, index = 0) {
    if (!item || typeof item !== "object") {
      return null;
    }

    const stateValue = Number(item.state ?? item.status);
    const provinceName = String(item.province_name || item.provinceName || item.province || "").trim();
    const cityName = String(item.city_name || item.cityName || item.city || "").trim();
    const districtName = String(item.district_name || item.districtName || item.district || item.county || "").trim();
    const pointName = String(
      item.point_name ||
        item.pointName ||
        item.pointname ||
        item.point ||
        item.location ||
        item.locationName ||
        item.locality ||
        item.address ||
        ""
    ).trim();
    const locationText = `${provinceName}${cityName}${districtName}${pointName}` || pointName;
    const hasVisibleLocation = Boolean(locationText) && !locationText.includes("*");
    const isPublic = stateValue === 2 || hasVisibleLocation;
    const location = isPublic ? locationText : HIDDEN_LOCATION_LABEL;
    const username = isPublic ? String(item.username || item.userName || item.nickname || "未提供").trim() : "******";
    const serialId = isPublic ? String(item.serial_id || item.serialId || item.serialid || item.id || "").trim() : "";
    const startTime = String(item.start_time || item.startTime || item.observation_time || item.observationTime || item.time || "").trim();
    const endTime = String(item.end_time || item.endTime || item.finish_time || item.finishTime || item.time || "").trim();

    return {
      id: String(item.serial_id || item.serialId || item.serialid || item.id || `${startTime || "record"}-${index}`),
      serialId,
      pointName: location,
      username: username || "未提供",
      taxonCount: Number(item.taxon_count ?? item.taxonCount ?? item.count ?? item.number) || 0,
      isPublic,
      isHiddenLocation: !isPublic || location.includes("*") || location === HIDDEN_LOCATION_LABEL,
      startTime,
      endTime,
      startTimeLabel: startTime || "未提供",
      endTimeLabel: endTime || "未提供"
    };
  }

  function getBirdreportItems(payload) {
    if (Array.isArray(payload)) {
      return payload;
    }
    if (!payload || typeof payload !== "object") {
      return [];
    }

    const candidates = [
      payload.species,
      payload.list,
      payload.rows,
      payload.records,
      payload.items,
      payload.result,
      payload.data
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate;
      }
    }
    for (const candidate of candidates) {
      const nested = getBirdreportItems(candidate);
      if (nested.length) {
        return nested;
      }
    }
    return [];
  }

  function decodeDefaultBirdreportPayload(payload) {
    if (!payload) {
      return [];
    }
    if (typeof payload !== "string") {
      return payload;
    }

    const trimmed = payload.trim();
    if (!trimmed) {
      return [];
    }

    return JSON.parse(trimmed);
  }

  function normalizeBirdreportTaxonPage(response, options = {}) {
    const decodePayload = options.decodePayload || decodeDefaultBirdreportPayload;
    const decoded = response?.data ? decodePayload(response.data) : [];
    const decodedItems = getBirdreportItems(decoded);
    const sourceItems = decodedItems.length ? decodedItems : getBirdreportItems(response);
    return sourceItems.map(normalizeBirdreportTaxon).filter((item) => item.key);
  }

  function normalizeBirdreportRecordPage(response, options = {}) {
    const decodePayload = options.decodePayload || decodeDefaultBirdreportPayload;
    const decoded = response?.data ? decodePayload(response.data) : [];
    const decodedItems = getBirdreportItems(decoded);
    const sourceItems = decodedItems.length ? decodedItems : getBirdreportItems(response);
    return sourceItems.map(normalizeBirdreportRecord).filter(Boolean);
  }

  function dedupeBirdreportTaxa(items) {
    const seen = new Set();
    return (items || []).filter((item) => {
      const key = getBirdreportTaxonKey(item);
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function sortBirdreportTaxaByRecordCount(items) {
    return [...(items || [])].sort((left, right) => {
      const leftCount = Number(left?.recordcount) || 0;
      const rightCount = Number(right?.recordcount) || 0;
      if (leftCount !== rightCount) {
        return leftCount - rightCount;
      }

      return getBirdreportTaxonName(left).localeCompare(getBirdreportTaxonName(right), "zh-CN");
    });
  }

  function sortBirdreportTaxaByRecordCountDesc(items) {
    return [...(items || [])].sort((left, right) => {
      const leftCount = Number(left?.recordcount) || 0;
      const rightCount = Number(right?.recordcount) || 0;
      if (leftCount !== rightCount) {
        return rightCount - leftCount;
      }

      return getBirdreportTaxonName(left).localeCompare(getBirdreportTaxonName(right), "zh-CN");
    });
  }

  function normalizeBirdreportSerialId(record) {
    return String(record?.serialId || record?.id || "")
      .replace(/\D/g, "")
      .replace(/^0+/, "");
  }

  function sortBirdreportRecordsBySerialIdDesc(left, right) {
    const leftSerial = normalizeBirdreportSerialId(left);
    const rightSerial = normalizeBirdreportSerialId(right);
    if (leftSerial.length !== rightSerial.length) {
      return rightSerial.length - leftSerial.length;
    }

    const serialDiff = rightSerial.localeCompare(leftSerial, "en-US");
    if (serialDiff !== 0) {
      return serialDiff;
    }

    return String(right?.id || "").localeCompare(String(left?.id || ""), "zh-CN");
  }

  function parseBirdreportRecordTime(value) {
    const text = String(value || "").trim();
    if (!text) {
      return 0;
    }

    const parsed = new Date(text.replace(" ", "T"));
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }

  function sortBirdreportRecordsByObservationTimeDesc(left, right) {
    const rightTime = parseBirdreportRecordTime(right?.startTime || right?.endTime);
    const leftTime = parseBirdreportRecordTime(left?.startTime || left?.endTime);
    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    return sortBirdreportRecordsBySerialIdDesc(left, right);
  }

  function serializeBirdreportRequestData(data) {
    const params = new URLSearchParams();
    Object.entries(data || {}).forEach(([key, value]) => {
      if (value == null || value === "") {
        return;
      }
      params.append(key, String(value));
    });
    return params.toString();
  }

  function parseBirdreportRequestData(serializedData) {
    if (!serializedData) {
      return {};
    }

    const result = {};
    String(serializedData)
      .split("&")
      .forEach((entry) => {
        if (!entry) {
          return;
        }
        const separatorIndex = entry.indexOf("=");
        if (separatorIndex === -1) {
          result[entry] = "";
          return;
        }
        result[entry.slice(0, separatorIndex)] = entry.slice(separatorIndex + 1);
      });
    return result;
  }

  function sortBirdreportObjectKeys(source) {
    return Object.keys(source || {})
      .sort()
      .reduce((result, key) => {
        result[key] = source[key];
        return result;
      }, {});
  }

  return {
    BIRDREPORT_VERSION,
    DEFAULT_PROVINCE,
    RARE_RECORDCOUNT_THRESHOLD,
    createBirdreportPayload,
    createBirdreportRecordSearchPayload,
    dedupeBirdreportTaxa,
    formatBirdreportQuerySummary,
    getBirdreportItems,
    getBirdreportTaxonKey,
    getBirdreportTaxonName,
    normalizeBirdreportAdministrativeArea,
    normalizeBirdreportRecord,
    normalizeBirdreportRecordPage,
    normalizeBirdreportTaxon,
    normalizeBirdreportTaxonPage,
    parseBirdreportRequestData,
    serializeBirdreportRequestData,
    sortBirdreportObjectKeys,
    sortBirdreportRecordsBySerialIdDesc,
    sortBirdreportRecordsByObservationTimeDesc,
    sortBirdreportTaxaByRecordCount,
    sortBirdreportTaxaByRecordCountDesc
  };
});
