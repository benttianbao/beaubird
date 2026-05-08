const RARE_RECORDCOUNT_THRESHOLD = 500;
const DEFAULT_PROVINCE = "浙江省";

function isValidIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function extractDateCommand(text) {
  const source = String(text || "").trim();
  if (!source.includes("@")) {
    return null;
  }

  const match = /\b\d{4}-\d{2}-\d{2}\b/.exec(source);
  if (!match || !isValidIsoDate(match[0])) {
    return null;
  }

  return match[0];
}

function parseRareBotCommand(text) {
  const source = String(text || "").trim();
  if (!source.includes("@")) {
    return null;
  }

  const match = /\b\d{4}-\d{2}-\d{2}\b/.exec(source);
  if (!match || !isValidIsoDate(match[0])) {
    return null;
  }

  const speciesName = source
    .slice(match.index + match[0].length)
    .replace(/^[\s,，:：;；。]+/, "")
    .trim();
  return {
    type: speciesName ? "location" : "date",
    date: match[0],
    speciesName
  };
}

function extractCaptchaCode(text) {
  const source = String(text || "").trim();
  if (!source || source.includes("@") || /\b\d{4}-\d{2}-\d{2}\b/.test(source)) {
    return null;
  }
  return /^[A-Za-z0-9]{4,6}$/.test(source) ? source : null;
}

function getTaxonKey(item) {
  return String(item?.taxon_id || item?.taxonid || item?.id || item?.key || item?.taxonname || item?.name || "").trim();
}

function normalizeBirdreportTaxon(item) {
  const key = getTaxonKey(item);
  const recordcount = Number(item?.recordcount) || 0;
  const explicitRare = typeof item?.isRare === "boolean" ? item.isRare : undefined;
  return {
    key,
    taxon_id: String(item?.taxon_id || item?.taxonid || item?.id || key || "").trim(),
    taxonname: String(item?.taxonname || item?.name || "").trim(),
    latinname: String(item?.latinname || item?.englishname || "").trim(),
    taxonordername: String(item?.taxonordername || "").trim(),
    taxonfamilyname: String(item?.taxonfamilyname || "").trim(),
    recordcount,
    reportcount: Number(item?.reportcount ?? item?.reportCount ?? item?.report_count) || 0,
    isRare: explicitRare ?? recordcount <= RARE_RECORDCOUNT_THRESHOLD
  };
}

function sortTaxaByRecordCount(items) {
  return [...items].sort((left, right) => {
    const countDiff = (Number(left?.recordcount) || 0) - (Number(right?.recordcount) || 0);
    if (countDiff !== 0) {
      return countDiff;
    }

    return String(left?.taxonname || left?.name || "").localeCompare(String(right?.taxonname || right?.name || ""), "zh-CN");
  });
}

function buildRareHits(dailyTaxa, rareBaseline) {
  const rareMap = new Map();
  for (const item of rareBaseline || []) {
    const normalized = normalizeBirdreportTaxon(item);
    if (normalized.key && normalized.isRare) {
      rareMap.set(normalized.key, normalized);
    }
  }

  const hits = [];
  const seen = new Set();
  for (const item of dailyTaxa || []) {
    const normalized = normalizeBirdreportTaxon(item);
    const baseline = rareMap.get(normalized.key);
    if (!baseline || seen.has(normalized.key)) {
      continue;
    }

    seen.add(normalized.key);
    hits.push({
      ...normalized,
      baselineRecordCount: Number(baseline.recordcount) || 0,
      targetDateRecordCount: Number(normalized.recordcount) || 0,
      locations: []
    });
  }

  return sortTaxaByRecordCount(hits);
}

function normalizeSpeciesNameForMatch(value) {
  return String(value || "").replace(/[\s　,，.。:：;；、]/g, "").trim();
}

function matchRareSpeciesByName(hits, speciesName) {
  const query = normalizeSpeciesNameForMatch(speciesName);
  if (!query) {
    return { status: "none", species: null, candidates: [] };
  }

  const normalizedHits = (hits || []).map((item) => ({
    item,
    name: normalizeSpeciesNameForMatch(item?.taxonname || item?.name)
  }));
  const exact = normalizedHits.filter((entry) => entry.name === query).map((entry) => entry.item);
  if (exact.length === 1) {
    return { status: "matched", species: exact[0], candidates: [] };
  }
  if (exact.length > 1) {
    return { status: "multiple", species: null, candidates: exact };
  }

  const candidates = normalizedHits
    .filter((entry) => entry.name && (entry.name.includes(query) || query.includes(entry.name)))
    .map((entry) => entry.item);
  if (candidates.length === 1) {
    return { status: "matched", species: candidates[0], candidates: [] };
  }
  if (candidates.length > 1) {
    return { status: "multiple", species: null, candidates };
  }
  return { status: "none", species: null, candidates: [] };
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
  const location = isPublic ? locationText : "地点未公开";
  const startTime = String(item.start_time || item.startTime || item.observation_time || item.observationTime || item.time || "").trim();
  const endTime = String(item.end_time || item.endTime || item.finish_time || item.finishTime || item.time || "").trim();

  return {
    id: String(item.serial_id || item.serialId || item.serialid || item.id || `${startTime || "record"}-${index}`),
    serialId: isPublic ? String(item.serial_id || item.serialId || item.serialid || item.id || "").trim() : "",
    pointName: location,
    username: isPublic ? String(item.username || item.userName || item.nickname || "未提供").trim() : "******",
    taxonCount: Number(item.taxon_count ?? item.taxonCount ?? item.count ?? item.number) || 0,
    isPublic,
    isHiddenLocation: !isPublic || location.includes("*") || location === "地点未公开",
    startTime,
    endTime
  };
}

function aggregateLocations(records) {
  const groups = new Map();
  for (const record of records || []) {
    if (!record) {
      continue;
    }

    const name = record.isHiddenLocation || !record.pointName ? "地点未公开" : record.pointName;
    const existing = groups.get(name) || { name, count: 0, records: 0 };
    existing.count += Number(record.taxonCount) || 1;
    existing.records += 1;
    groups.set(name, existing);
  }

  return [...groups.values()].sort((left, right) => {
    if (left.name === "地点未公开" && right.name !== "地点未公开") {
      return 1;
    }
    if (right.name === "地点未公开" && left.name !== "地点未公开") {
      return -1;
    }
    if (right.count !== left.count) {
      return right.count - left.count;
    }
    return left.name.localeCompare(right.name, "zh-CN");
  });
}

function formatLocationSummary(locations, maxLocations = 6) {
  if (!locations?.length) {
    return "地点：暂无可展示地点";
  }

  const visible = locations.slice(0, maxLocations);
  const summary = visible.map((item) => `${item.name} ${item.count} 次`).join("、");
  const rest = locations.length > visible.length ? ` 等 ${locations.length} 处` : "";
  return `地点：${summary}${rest}`;
}

function formatRareSpeciesListReply({ date, province = DEFAULT_PROVINCE, hits = [], error = "" } = {}) {
  const displayProvince = String(province || DEFAULT_PROVINCE).replace(/省$/, "");
  if (error) {
    return `${displayProvince}稀有鸟种 ${date || ""}\n查询失败：${error}`.trim();
  }
  if (!hits.length) {
    return `${displayProvince}稀有鸟种 ${date}\n当天暂未发现命中的稀有鸟种。`;
  }

  const lines = [`${displayProvince}稀有鸟种 ${date}`, `共 ${hits.length} 种`];
  hits.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.taxonname || item.name || "未命名鸟种"}`);
  });
  return lines.join("\n");
}

function formatCandidateReply({ date, speciesName, candidates = [] } = {}) {
  const lines = [`${speciesName || "该鸟种"} ${date || ""} 匹配到多个鸟种，请补全名称：`.trim()];
  candidates.slice(0, 8).forEach((item, index) => {
    lines.push(`${index + 1}. ${item.taxonname || item.name || "未命名鸟种"}`);
  });
  return lines.join("\n");
}

function formatSpeciesLocationReply({ date, species, speciesName = "", locations = [], candidates = [], status = "matched", error = "" } = {}) {
  const displayName = species?.taxonname || species?.name || speciesName || "该鸟种";
  if (error) {
    return `${displayName} ${date || ""} 浙江公开地点\n查询失败：${error}`.trim();
  }
  if (status === "multiple") {
    return formatCandidateReply({ date, speciesName: displayName, candidates });
  }
  if (status === "none") {
    return `${displayName} ${date || ""}\n当天未命中该稀有鸟种。`.trim();
  }

  const sortedLocations = [...(locations || [])].sort((left, right) => {
    const countDiff = (Number(right?.count) || 0) - (Number(left?.count) || 0);
    if (countDiff !== 0) {
      return countDiff;
    }
    return String(left?.name || "").localeCompare(String(right?.name || ""), "zh-CN");
  });
  if (!sortedLocations.length) {
    return `${displayName} ${date} 浙江公开地点\n暂未查到可展示的公开地点。`;
  }

  const lines = [`${displayName} ${date} 浙江公开地点`, `共 ${sortedLocations.length} 个地点`];
  sortedLocations.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.name || "地点未公开"} ${Number(item.count) || 0} 次`);
  });
  return lines.join("\n");
}

function formatRareBirdReply({ date, province = DEFAULT_PROVINCE, hits = [], error = "" } = {}) {
  const displayProvince = String(province || DEFAULT_PROVINCE).replace(/省$/, "");
  if (error) {
    return `${displayProvince}稀有记录 ${date || ""}\n查询失败：${error}`.trim();
  }

  if (!hits.length) {
    return `${displayProvince}稀有记录 ${date}\n当天暂未发现命中的稀有鸟种。`;
  }

  const lines = [`${displayProvince}稀有记录 ${date}`, `共命中 ${hits.length} 种`];
  hits.forEach((item, index) => {
    const name = item.taxonname || item.name || "未命名鸟种";
    const dailyCount = Number(item.targetDateRecordCount ?? item.recordcount) || 0;
    const baselineCount = Number(item.baselineRecordCount) || 0;
    lines.push(`${index + 1}. ${name}：${dailyCount} 次（历史 ${baselineCount} 次）`);
    lines.push(`   ${item.locationError ? `地点：查询失败（${item.locationError}）` : formatLocationSummary(item.locations || [])}`);
  });

  return lines.join("\n");
}

module.exports = {
  DEFAULT_PROVINCE,
  RARE_RECORDCOUNT_THRESHOLD,
  aggregateLocations,
  buildRareHits,
  extractCaptchaCode,
  extractDateCommand,
  formatLocationSummary,
  formatRareSpeciesListReply,
  formatRareBirdReply,
  formatSpeciesLocationReply,
  getTaxonKey,
  isValidIsoDate,
  matchRareSpeciesByName,
  normalizeBirdreportRecord,
  normalizeBirdreportTaxon,
  parseRareBotCommand,
  sortTaxaByRecordCount
};
