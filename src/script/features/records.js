// Functions extracted from the legacy script.js features/records domain.
export function installRecords(runtime) {
  const { PERSONAL_STORAGE_KEY, LEGACY_STORAGE_KEY, COMMON_BIRD_TAXONOMY, ROOT_CLASS_LABEL, UNKNOWN_ORDER_LABEL, UNKNOWN_FAMILY_LABEL, UNKNOWN_GENUS_LABEL, TAXON_ZH_MAP, state, elements } = runtime;
  const addDays = (...args) => runtime.addDays(...args);
  const createId = (...args) => runtime.createId(...args);
  const escapeHtml = (...args) => runtime.escapeHtml(...args);
  const extractGenus = (...args) => runtime.extractGenus(...args);
  const formatDate = (...args) => runtime.formatDate(...args);
  const formatIsoDate = (...args) => runtime.formatIsoDate(...args);
  const normalizeDate = (...args) => runtime.normalizeDate(...args);
  const parsePositiveInteger = (...args) => runtime.parsePositiveInteger(...args);
  const renderRegionQueryResults = (...args) => runtime.renderRegionQueryResults(...args);
  const safeLocalStorageGet = (...args) => runtime.safeLocalStorageGet(...args);
  const safeLocalStorageSet = (...args) => runtime.safeLocalStorageSet(...args);
  const setMessage = (...args) => runtime.setMessage(...args);
  const simplifyChineseText = (...args) => runtime.simplifyChineseText(...args);
  const toNumber = (...args) => runtime.toNumber(...args);
  const toTaxonOrder = (...args) => runtime.toTaxonOrder(...args);

function importText(text, sourceName) {
  const trimmed = text.trim();
  if (!trimmed) {
    setMessage("没有可导入的内容。", true);
    return;
  }

  try {
    const imported = parseInput(trimmed);
    if (!imported.length) {
      setMessage("未识别到有效记录，请检查格式。", true);
      return;
    }

    state.personalRecords = normalizeRecords([...state.personalRecords, ...imported]);
    persistAndRender();
    setMessage(`已从${sourceName}导入 ${imported.length} 条个人记录，当前共 ${state.personalRecords.length} 条。`);
  } catch (error) {
    setMessage(`导入失败：${error.message}`, true);
  }
}

function parseInput(text) {
  const compact = text.trim();
  if (compact.startsWith("[") || compact.startsWith("{")) {
    return parseJsonInput(compact);
  }

  const firstLine = compact.split(/\r?\n/, 1)[0];
  if ((firstLine.includes(",") || firstLine.includes("\t")) && /date|species|location|lat|lng|common|observation/i.test(firstLine)) {
    return parseDelimitedInput(compact, firstLine.includes("\t") ? "\t" : ",");
  }

  return parseLineInput(compact);
}

function parseJsonInput(text) {
  const parsed = JSON.parse(text);
  const items = Array.isArray(parsed) ? parsed : [parsed];
  return items.map((item) => toRecord(item));
}

function parseDelimitedInput(text, delimiter = ",") {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) {
    return [];
  }

  const headers = splitDelimitedLine(lines[0], delimiter).map((header) => normalizeHeaderName(header));
  return lines.slice(1).map((line) => {
    const cells = splitDelimitedLine(line, delimiter);
    const raw = headers.reduce((result, header, index) => {
      result[header] = cells[index] ?? "";
      return result;
    }, {});
    return toRecord(raw);
  });
}

function parseLineInput(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[\t,，]/).map((part) => part.trim());
      return toRecord({
        date: parts[0],
        species: parts[1],
        location: parts[2],
        lat: parts[3],
        lng: parts[4],
        notes: parts.slice(5).join(" ")
      });
    });
}

function splitDelimitedLine(line, delimiter = ",") {
  const cells = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === delimiter && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function toRecord(raw) {
  const record = normalizeRecord({
    date: getRawValue(raw, ["date", "observedat", "time", "obsdt", "observationdate"]),
    species: getRawValue(raw, ["species", "name", "bird", "commonname", "comname"]),
    location: getRawValue(raw, ["location", "place", "site", "locname", "locationname"]),
    notes: getRawValue(raw, ["notes", "note", "comment", "comments", "speciescomments"]),
    lat: getRawValue(raw, ["lat", "latitude"]),
    lng: getRawValue(raw, ["lng", "lon", "longitude"]),
    sciName: getRawValue(raw, ["sciname", "scientificname", "scientific_name"]),
    speciesCode: getRawValue(raw, ["speciescode", "species_code"]),
    taxonOrder: getRawValue(raw, ["taxonorder", "taxon_order"]),
    orderName: getRawValue(raw, ["ordername", "order", "order_name"]),
    familyName: getRawValue(raw, ["familyname", "family", "familysciname", "family_name"]),
    familyCommonName: getRawValue(raw, ["familycommonname", "familycommon", "familycomname", "family_common"]),
    genusName: getRawValue(raw, ["genusname", "genus", "genus_name"])
  });

  if (!record.date || !record.species || !record.location) {
    throw new Error("每条记录至少需要日期、种类和地点。");
  }

  return record;
}

function getRawValue(raw, keys) {
  for (const key of keys) {
    if (raw[key] != null && raw[key] !== "") {
      return raw[key];
    }

    const matchedKey = Object.keys(raw).find((rawKey) => normalizeHeaderName(rawKey) === normalizeHeaderName(key));
    if (matchedKey && raw[matchedKey] != null && raw[matchedKey] !== "") {
      return raw[matchedKey];
    }
  }
  return "";
}

function normalizeHeaderName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeRecords(records) {
  return records
    .map((record) => normalizeRecord(record))
    .filter((record) => record.date && record.species && record.location)
    .sort((left, right) => right.date.localeCompare(left.date));
}

function persistAndRender() {
  savePersonalRecords(state.personalRecords);
  render();
}

function render() {
  renderRegionQueryResults();
}

function renderFilters() {
  const previousValue = elements.speciesFilter.value;
  const speciesList = [...new Set(state.personalRecords.map((record) => record.species))].sort((a, b) => a.localeCompare(b, "zh-CN"));

  elements.speciesFilter.innerHTML = '<option value="">全部种类</option>';
  speciesList.forEach((species) => {
    const option = document.createElement("option");
    option.value = species;
    option.textContent = species;
    elements.speciesFilter.append(option);
  });

  if (speciesList.includes(previousValue)) {
    elements.speciesFilter.value = previousValue;
  }
}

function renderRecordsOnly() {
  const viewMode = elements.viewMode.value;
  const filtered = getVisibleRecords();

  elements.recordsContainer.className = `records ${viewMode === "list" ? "list" : "cards"}`;
  renderStats(filtered);
  renderTaxonomyBrowser(filtered);

  if (!filtered.length) {
    elements.recordsContainer.innerHTML = '<div class="empty-state">当前筛选条件下没有记录。</div>';
    return;
  }

  elements.recordsContainer.innerHTML = "";
  filtered.forEach((record) => {
    const item = document.createElement("article");
    item.className = "record";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(record.species)}</strong>
        <small>${escapeHtml(formatDate(record.date))}</small>
      </div>
      <div>${escapeHtml(record.location)}</div>
      <div>
        ${record.lat != null && record.lng != null ? `<small>坐标：${record.lat.toFixed(3)}, ${record.lng.toFixed(3)}</small>` : '<small>未提供坐标</small>'}
        ${record.notes ? `<div class="record-note">${escapeHtml(record.notes)}</div>` : ""}
      </div>
    `;
    elements.recordsContainer.append(item);
  });
}

function renderStats(records) {
  if (!state.personalRecords.length) {
    elements.statsSummary.textContent = "还没有观鸟记录。";
    return;
  }

  const speciesCount = new Set(records.map((record) => record.species)).size;
  const coordinateCount = records.filter((record) => record.lat != null && record.lng != null).length;
  elements.statsSummary.textContent = `当前展示 ${records.length} 条个人记录，涉及 ${speciesCount} 个种类，其中 ${coordinateCount} 条可用于地图热力图。`;
}

function renderTaxonomyBrowser(records) {
  elements.taxonomyBrowser.innerHTML = "";

  if (!records.length) {
    return;
  }

  const root = buildTaxonomyTree(records);
  if (!root) {
    return;
  }

  const list = document.createElement("ul");
  list.className = "taxonomy-list";
  list.append(renderTaxonomyNode(root, 0, "class:Aves"));
  elements.taxonomyBrowser.append(list);
}

function renderLifeList() {
  const context = getLifeListContext();
  elements.lifeSummary.textContent = context.summary;
  elements.lifeListContainer.innerHTML = "";

  if (!context.entries.length) {
    elements.lifeListContainer.innerHTML = '<div class="empty-state">当前区域和时间范围内还没有个人生涯记录。</div>';
    return;
  }

  context.entries.forEach((entry) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "life-item";
    item.innerHTML = `
      <strong>${escapeHtml(entry.species)}</strong>
      <span>最近记录：${escapeHtml(entry.lastSeenLabel)}</span>
      <span>首次记录：${escapeHtml(entry.firstSeenLabel)}</span>
      <span>累计 ${entry.count} 条 · ${entry.locationCount} 个地点</span>
    `;
    item.addEventListener("click", () => {
      elements.speciesFilter.value = entry.species;
      renderRecordsOnly();
    });
    elements.lifeListContainer.append(item);
  });
}

function renderSpeciesDiscovery() {
  const context = getSpeciesDiscoveryContext();
  elements.speciesDiscoverySummary.textContent = context.summary;
  elements.speciesDiscoveryContainer.innerHTML = "";

  if (!context.entries.length) {
    elements.speciesDiscoveryContainer.innerHTML = '<div class="empty-state">当前时间和地区条件下没有匹配到鸟种。</div>';
    return;
  }

  context.entries.forEach((entry) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "life-item";
    item.innerHTML = `
      <strong>${escapeHtml(entry.species)}</strong>
      <span>首次记录：${escapeHtml(entry.firstSeenLabel)}</span>
      <span>最近记录：${escapeHtml(entry.lastSeenLabel)}</span>
      <span>${entry.count} 条记录 · ${entry.locationCount} 个地点</span>
    `;
    item.addEventListener("click", () => {
      elements.speciesFilter.value = entry.species;
      renderRecordsOnly();
    });
    elements.speciesDiscoveryContainer.append(item);
  });
}

function getVisibleRecords() {
  const species = elements.speciesFilter.value;
  const sortOrder = elements.sortOrder.value;

  return state.personalRecords
    .filter((record) => !species || record.species === species)
    .sort((left, right) => {
      const result = left.date.localeCompare(right.date);
      return sortOrder === "asc" ? result : -result;
    });
}

function getLifeListContext() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!state.personalRecords.length) {
    return {
      entries: [],
      summary: "还没有可统计的个人记录。"
    };
  }

  const regionInput = String(elements.lifeRegionFilter.value || "").trim();
  const regionKeyword = regionInput.toLocaleLowerCase("zh-CN");
  const backDays = parsePositiveInteger(elements.lifeBackDays.value);
  const earliestDate = state.personalRecords.reduce(
    (result, record) => (record.date < result ? record.date : result),
    state.personalRecords[0].date
  );
  const startDate = backDays == null ? earliestDate : formatIsoDate(addDays(today, -(backDays - 1)));
  const endDate = formatIsoDate(today);
  const filteredRecords = state.personalRecords.filter((record) => {
    const inRegion = !regionKeyword || record.location.toLocaleLowerCase("zh-CN").includes(regionKeyword);
    const inRange = record.date >= startDate && record.date <= endDate;
    return inRegion && inRange;
  });
  const grouped = buildSpeciesAggregate(filteredRecords);

  const entries = [...grouped.values()]
    .map((entry) => ({
      species: entry.species,
      count: entry.count,
      firstSeen: entry.firstSeen,
      lastSeen: entry.lastSeen,
      firstSeenLabel: formatDate(entry.firstSeen),
      lastSeenLabel: formatDate(entry.lastSeen),
      locationCount: entry.locations.size
    }))
    .sort((left, right) => {
      if (left.lastSeen !== right.lastSeen) {
        return right.lastSeen.localeCompare(left.lastSeen);
      }
      if (left.count !== right.count) {
        return right.count - left.count;
      }
      return left.species.localeCompare(right.species, "zh-CN");
    });

  const regionText = regionInput ? `区域包含“${regionInput}”` : "全部区域";
  const timeText =
    backDays == null ? `${formatDate(startDate)} 至 ${formatDate(endDate)}` : `最近 ${backDays} 天（${formatDate(startDate)} 至 ${formatDate(endDate)}）`;

  return {
    entries,
    summary: `${regionText}，时间范围 ${timeText}，累计 ${filteredRecords.length} 条记录，涉及 ${entries.length} 个生涯种。`
  };
}

function getSpeciesDiscoveryContext() {
  if (!state.personalRecords.length) {
    return {
      entries: [],
      summary: "还没有可筛选的个人记录。"
    };
  }

  const regionInput = String(elements.speciesDiscoveryRegion.value || "").trim();
  const regionKeyword = regionInput.toLocaleLowerCase("zh-CN");
  const startDate = normalizeDateInput(elements.speciesDiscoveryStart.value) || getRecordBoundaryDate("earliest");
  const endDate = normalizeDateInput(elements.speciesDiscoveryEnd.value) || getRecordBoundaryDate("latest");
  const validStartDate = startDate <= endDate ? startDate : endDate;
  const validEndDate = startDate <= endDate ? endDate : startDate;
  const filteredRecords = state.personalRecords.filter((record) => {
    const inRegion = !regionKeyword || record.location.toLocaleLowerCase("zh-CN").includes(regionKeyword);
    const inRange = record.date >= validStartDate && record.date <= validEndDate;
    return inRegion && inRange;
  });
  const grouped = buildSpeciesAggregate(filteredRecords);
  const entries = [...grouped.values()]
    .map((entry) => ({
      species: entry.species,
      count: entry.count,
      firstSeen: entry.firstSeen,
      lastSeen: entry.lastSeen,
      firstSeenLabel: formatDate(entry.firstSeen),
      lastSeenLabel: formatDate(entry.lastSeen),
      locationCount: entry.locations.size
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      if (right.lastSeen !== left.lastSeen) {
        return right.lastSeen.localeCompare(left.lastSeen);
      }
      return left.species.localeCompare(right.species, "zh-CN");
    });

  return {
    entries,
    summary: `筛选范围：${regionInput || "全部地区"} · ${formatDate(validStartDate)} 至 ${formatDate(validEndDate)}，共找到 ${entries.length} 个鸟种，匹配 ${filteredRecords.length} 条记录。`
  };
}

function buildSpeciesAggregate(records) {
  const grouped = new Map();

  records.forEach((record) => {
    if (!grouped.has(record.species)) {
      grouped.set(record.species, {
        species: record.species,
        count: 0,
        firstSeen: record.date,
        lastSeen: record.date,
        locations: new Set()
      });
    }

    const bucket = grouped.get(record.species);
    bucket.count += 1;
    bucket.firstSeen = record.date < bucket.firstSeen ? record.date : bucket.firstSeen;
    bucket.lastSeen = record.date > bucket.lastSeen ? record.date : bucket.lastSeen;
    bucket.locations.add(record.location);
  });

  return grouped;
}

function getRecordBoundaryDate(mode) {
  if (!state.personalRecords.length) {
    return formatIsoDate(new Date());
  }

  return state.personalRecords.reduce((result, record) => {
    if (mode === "earliest") {
      return record.date < result ? record.date : result;
    }
    return record.date > result ? record.date : result;
  }, state.personalRecords[0].date);
}

function normalizeDateInput(value) {
  const normalized = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

function initMap() {
  if (!window.L) {
    setMessage("地图组件未加载，地图热力图不可用。", true);
    return;
  }

  state.map = L.map("map", {
    center: [31.23, 121.47],
    zoom: 5,
    scrollWheelZoom: true
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(state.map);
}

function renderMap() {
  if (!state.map || !window.L || !L.heatLayer) {
    return;
  }

  const points = buildHeatPoints(elements.heatMetric.value);
  if (state.heatLayer) {
    state.map.removeLayer(state.heatLayer);
    state.heatLayer = null;
  }

  if (!points.length) {
    state.map.setView([31.23, 121.47], 5);
    return;
  }

  state.heatLayer = L.heatLayer(points, {
    radius: 28,
    blur: 22,
    maxZoom: 10,
    minOpacity: 0.4
  }).addTo(state.map);

  const bounds = L.latLngBounds(points.map(([lat, lng]) => [lat, lng]));
  state.map.fitBounds(bounds.pad(0.35));
}

function buildHeatPoints(metric) {
  const coordinateRecords = state.personalRecords.filter((record) => record.lat != null && record.lng != null);
  if (!coordinateRecords.length) {
    return [];
  }

  const grouped = new Map();
  coordinateRecords.forEach((record) => {
    const key = `${record.lat.toFixed(4)},${record.lng.toFixed(4)}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        lat: record.lat,
        lng: record.lng,
        count: 0,
        species: new Set()
      });
    }

    const bucket = grouped.get(key);
    bucket.count += 1;
    bucket.species.add(record.species);
  });

  const rawPoints = [...grouped.values()].map((item) => [
    item.lat,
    item.lng,
    metric === "speciesRichness" ? item.species.size : item.count
  ]);

  const maxWeight = Math.max(...rawPoints.map((point) => point[2]), 1);
  return rawPoints.map(([lat, lng, weight]) => [lat, lng, weight / maxWeight]);
}

function renderCalendarHeatmap() {
  const days = buildCalendarDays();
  const counts = state.personalRecords.reduce((result, record) => {
    result[record.date] = (result[record.date] || 0) + 1;
    return result;
  }, {});
  const maxCount = Math.max(...Object.values(counts), 0);

  renderLegend(maxCount);
  elements.calendarHeatmap.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "calendar-grid";

  days.forEach((day) => {
    const cell = document.createElement("div");
    const count = day ? counts[day] || 0 : 0;

    cell.className = `day-cell${day ? "" : " empty"}`;
    if (day) {
      cell.style.background = calendarColor(count, maxCount);
      cell.title = `${day}：${count} 条记录`;
    }
    grid.append(cell);
  });

  elements.calendarHeatmap.append(grid);
}

function renderLegend(maxCount) {
  const levels = [0, 0.25, 0.5, 0.75, 1];
  const scale = levels
    .map((level) => `<span class="legend-cell" style="background:${calendarColor(Math.round(maxCount * level), maxCount)}"></span>`)
    .join("");

  elements.calendarLegend.innerHTML = `
    <span>少</span>
    <span class="legend-scale">${scale}</span>
    <span>多</span>
  `;
}

function mergeRecords(existingRecords, incomingRecords) {
  const merged = [...existingRecords];
  const seen = new Set(existingRecords.map(createDedupKey));
  let addedCount = 0;
  let duplicateCount = 0;

  incomingRecords.forEach((record) => {
    const key = createDedupKey(record);
    if (seen.has(key)) {
      duplicateCount += 1;
      return;
    }

    seen.add(key);
    merged.push(record);
    addedCount += 1;
  });

  return {
    mergedRecords: normalizeRecords(merged),
    addedCount,
    duplicateCount
  };
}

function createDedupKey(record) {
  return [
    record.date,
    record.species,
    record.location,
    record.lat == null ? "" : Number(record.lat).toFixed(4),
    record.lng == null ? "" : Number(record.lng).toFixed(4)
  ].join("|");
}

function normalizeRecord(record) {
  const species = simplifyChineseText(String(record.species || "").trim());
  const sciName = String(record.sciName || record.scientificName || "").trim();
  const speciesCode = String(record.speciesCode || record.species_code || "").trim();
  const fallbackTaxonomy = getFallbackTaxonomy(species, speciesCode, sciName);
  const finalSciName = sciName || fallbackTaxonomy.sciName || "";
  const genusName = String(record.genusName || record.genus || extractGenus(finalSciName) || fallbackTaxonomy.genusName || "").trim();
  const familyCommonName = simplifyChineseText(
    String(record.familyCommonName || record.familyCommon || fallbackTaxonomy.familyCommonName || "").trim()
  );

  return {
    id: record.id || createId(),
    date: normalizeDate(record.date),
    species,
    location: String(record.location || "").trim(),
    lat: toNumber(record.lat),
    lng: toNumber(record.lng),
    notes: String(record.notes || "").trim(),
    speciesCode: speciesCode || fallbackTaxonomy.speciesCode || "",
    sciName: finalSciName,
    taxonOrder: toTaxonOrder(record.taxonOrder ?? record.taxon_order) ?? fallbackTaxonomy.taxonOrder ?? null,
    className: "Aves",
    orderName: String(record.orderName || record.order || fallbackTaxonomy.orderName || "").trim(),
    familyName: String(record.familyName || record.family || fallbackTaxonomy.familyName || "").trim(),
    familyCommonName,
    genusName
  };
}

function migrateExistingRecords() {
  const previousSnapshot = JSON.stringify(state.personalRecords);
  const normalized = normalizeRecords(state.personalRecords);
  const changed = countMigratedRecords(state.personalRecords, normalized);

  if (previousSnapshot !== JSON.stringify(normalized)) {
    state.personalRecords = normalized;
  }

  return { changed };
}

function countMigratedRecords(previousRecords, nextRecords) {
  const limit = Math.min(previousRecords.length, nextRecords.length);
  let changed = Math.abs(previousRecords.length - nextRecords.length);

  for (let index = 0; index < limit; index += 1) {
    const previous = previousRecords[index] || {};
    const next = nextRecords[index] || {};
    if (
      String(previous.species || "") !== String(next.species || "") ||
      String(previous.orderName || previous.order || "") !== String(next.orderName || "") ||
      String(previous.familyName || previous.family || "") !== String(next.familyName || "") ||
      String(previous.familyCommonName || previous.familyCommon || "") !== String(next.familyCommonName || "") ||
      String(previous.genusName || previous.genus || "") !== String(next.genusName || "") ||
      String(previous.sciName || previous.scientificName || "") !== String(next.sciName || "") ||
      String(previous.speciesCode || previous.species_code || "") !== String(next.speciesCode || "")
    ) {
      changed += 1;
    }
  }

  return changed;
}

function buildInitialMessage() {
  if (!state.personalRecords.length) {
    return "可以上传文件、粘贴内容，或先加载示例数据。";
  }

  if (state.migrationSummary.changed > 0) {
    return `已加载 ${state.personalRecords.length} 条个人记录，并自动更新了 ${state.migrationSummary.changed} 条旧记录的鸟名/分类信息。`;
  }

  return `已加载 ${state.personalRecords.length} 条个人记录。`;
}

function getFallbackTaxonomy(species, speciesCode, sciName) {
  if (species && COMMON_BIRD_TAXONOMY[species]) {
    return COMMON_BIRD_TAXONOMY[species];
  }

  if (sciName) {
    const entry = Object.values(COMMON_BIRD_TAXONOMY).find((item) => item.sciName === sciName);
    if (entry) {
      return entry;
    }
  }

  if (speciesCode) {
    const entry = Object.values(COMMON_BIRD_TAXONOMY).find((item) => item.speciesCode === speciesCode);
    if (entry) {
      return entry;
    }
  }

  return {};
}

function buildTaxonomyTree(records) {
  const root = createTaxonomyNode("class", "Aves", ROOT_CLASS_LABEL);

  records.forEach((record) => {
    hydrateTaxonomyNode(root, record);
    const path = getTaxonomyPath(record);
    let current = root;

    path.forEach((segment) => {
      const nodeKey = `${segment.level}:${segment.key}`;
      if (!current.children.has(nodeKey)) {
        current.children.set(nodeKey, createTaxonomyNode(segment.level, segment.key, segment.label));
      }

      current = current.children.get(nodeKey);
      hydrateTaxonomyNode(current, record);
    });
  });

  return root.recordCount ? root : null;
}

function createTaxonomyNode(level, key, label) {
  return {
    level,
    key,
    label,
    recordCount: 0,
    speciesSet: new Set(),
    sortValue: Number.POSITIVE_INFINITY,
    children: new Map()
  };
}

function hydrateTaxonomyNode(node, record) {
  node.recordCount += 1;
  node.speciesSet.add(record.species);
  if (record.taxonOrder != null) {
    node.sortValue = Math.min(node.sortValue, record.taxonOrder);
  }
}

function getTaxonomyPath(record) {
  const orderKey = record.orderName || UNKNOWN_ORDER_LABEL;
  const familyKey = record.familyName || UNKNOWN_FAMILY_LABEL;
  const genusKey = record.genusName || UNKNOWN_GENUS_LABEL;

  return [
    { level: "order", key: orderKey, label: formatTaxonLabel("order", orderKey) },
    { level: "family", key: familyKey, label: formatTaxonLabel("family", familyKey, record.familyCommonName) },
    { level: "genus", key: genusKey, label: formatTaxonLabel("genus", genusKey) },
    { level: "species", key: record.species, label: record.species }
  ];
}

function renderTaxonomyNode(node, depth, pathKey) {
  const item = document.createElement("li");
  item.className = `taxonomy-item level-${node.level}`;

  const hasChildren = node.children.size > 0;
  const isExpanded = state.expandedTaxa.has(pathKey);
  const isActiveLeaf = node.level === "species" && elements.speciesFilter.value === node.label;
  const button = document.createElement("button");
  button.type = "button";
  button.className = `taxonomy-toggle${isExpanded ? " is-expanded" : ""}${hasChildren ? "" : " is-leaf"}${isActiveLeaf ? " is-active" : ""}`;
  button.style.setProperty("--depth", String(depth));
  button.setAttribute("aria-expanded", String(Boolean(hasChildren && isExpanded)));

  const caret = document.createElement("span");
  caret.className = "taxonomy-caret";
  caret.textContent = hasChildren ? (isExpanded ? "▾" : "▸") : "•";

  const label = document.createElement("span");
  label.className = "taxonomy-label";
  label.textContent = node.label;

  const meta = document.createElement("span");
  meta.className = "taxonomy-meta";
  meta.textContent = node.level === "species" ? `${node.recordCount} 条` : `${node.speciesSet.size} 种 · ${node.recordCount} 条`;

  button.append(caret, label, meta);
  button.addEventListener("click", () => {
    if (hasChildren) {
      if (state.expandedTaxa.has(pathKey)) {
        state.expandedTaxa.delete(pathKey);
      } else {
        state.expandedTaxa.add(pathKey);
      }
      renderRecordsOnly();
      return;
    }

    elements.speciesFilter.value = elements.speciesFilter.value === node.label ? "" : node.label;
    renderRecordsOnly();
  });

  item.append(button);

  if (hasChildren && isExpanded) {
    const list = document.createElement("ul");
    list.className = "taxonomy-list";
    getSortedTaxonomyChildren(node).forEach((child) => {
      const childPathKey = `${pathKey}/${child.level}:${child.key}`;
      list.append(renderTaxonomyNode(child, depth + 1, childPathKey));
    });
    item.append(list);
  }

  return item;
}

function getSortedTaxonomyChildren(node) {
  return [...node.children.values()].sort((left, right) => {
    if (left.sortValue !== right.sortValue) {
      return left.sortValue - right.sortValue;
    }
    return left.label.localeCompare(right.label, "zh-CN");
  });
}

function formatTaxonLabel(level, value, commonName = "") {
  if (!value) {
    return level === "order" ? UNKNOWN_ORDER_LABEL : level === "family" ? UNKNOWN_FAMILY_LABEL : UNKNOWN_GENUS_LABEL;
  }

  if (level === "genus") {
    return /^[A-Z]/.test(value) ? `${value} 属` : value.endsWith("属") ? value : `${value}属`;
  }

  if (level === "family" && commonName) {
    const familyLabel = commonName.endsWith("科") ? commonName : `${commonName}科`;
    return `${familyLabel} (${value})`;
  }

  const zhStem = TAXON_ZH_MAP[level]?.[value];
  if (zhStem) {
    const suffix = level === "order" ? "目" : "科";
    return `${zhStem}${suffix} (${value})`;
  }

  return value;
}

function buildCalendarDays() {
  const end = new Date();
  end.setHours(0, 0, 0, 0);

  const start = new Date(end);
  start.setDate(end.getDate() - 364);
  start.setHours(0, 0, 0, 0);

  const days = [];
  const prefix = start.getDay();
  for (let index = 0; index < prefix; index += 1) {
    days.push(null);
  }

  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(formatIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function calendarColor(count, maxCount) {
  if (!count || !maxCount) {
    return "#edf3ec";
  }

  const ratio = count / maxCount;
  if (ratio <= 0.25) {
    return "#cfe7d5";
  }
  if (ratio <= 0.5) {
    return "#92c9a0";
  }
  if (ratio <= 0.75) {
    return "#54a86c";
  }
  return "#2f7d4a";
}

function loadPersonalRecords() {
  try {
    const personalRaw = safeLocalStorageGet(PERSONAL_STORAGE_KEY, "");
    if (personalRaw) {
      return normalizeRecords(JSON.parse(personalRaw));
    }

    const legacyRaw = safeLocalStorageGet(LEGACY_STORAGE_KEY, "");
    if (!legacyRaw) {
      return [];
    }

    return normalizeRecords(JSON.parse(legacyRaw)).filter((record) => !isLegacyRegionQueryRecord(record));
  } catch (error) {
    console.warn("Failed to load personal records:", error);
    return [];
  }
}

function savePersonalRecords(records) {
  safeLocalStorageSet(PERSONAL_STORAGE_KEY, JSON.stringify(records));
}

function isLegacyRegionQueryRecord(record) {
  return String(record.notes || "").startsWith("eBird 同步");
}

  Object.assign(runtime, {
    importText,
    parseInput,
    parseJsonInput,
    parseDelimitedInput,
    parseLineInput,
    splitDelimitedLine,
    toRecord,
    getRawValue,
    normalizeHeaderName,
    normalizeRecords,
    persistAndRender,
    render,
    renderFilters,
    renderRecordsOnly,
    renderStats,
    renderTaxonomyBrowser,
    renderLifeList,
    renderSpeciesDiscovery,
    getVisibleRecords,
    getLifeListContext,
    getSpeciesDiscoveryContext,
    buildSpeciesAggregate,
    getRecordBoundaryDate,
    normalizeDateInput,
    initMap,
    renderMap,
    buildHeatPoints,
    renderCalendarHeatmap,
    renderLegend,
    mergeRecords,
    createDedupKey,
    normalizeRecord,
    migrateExistingRecords,
    countMigratedRecords,
    buildInitialMessage,
    getFallbackTaxonomy,
    buildTaxonomyTree,
    createTaxonomyNode,
    hydrateTaxonomyNode,
    getTaxonomyPath,
    renderTaxonomyNode,
    getSortedTaxonomyChildren,
    formatTaxonLabel,
    buildCalendarDays,
    calendarColor,
    loadPersonalRecords,
    savePersonalRecords,
    isLegacyRegionQueryRecord
  });
}
