// Functions extracted from the legacy script.js features/ebird/seasonal domain.
export function installEbirdSeasonal(runtime) {
  const { EBIRD_SPECIES_LOCALE, EBIRD_SEASONAL_CACHE_STORAGE, EBIRD_SEASONAL_SETTINGS_STORAGE, EBIRD_SEASONAL_REGION_CODE, EBIRD_SEASONAL_CACHE_TTL_MS, EBIRD_SEASONAL_CONCURRENCY, state, elements } = runtime;
  const clampEbirdSeasonalWindow = (...args) => runtime.clampEbirdSeasonalWindow(...args);
  const clampEbirdSeasonalYears = (...args) => runtime.clampEbirdSeasonalYears(...args);
  const escapeHtml = (...args) => runtime.escapeHtml(...args);
  const fetchEbirdTaxonomyMap = (...args) => runtime.fetchEbirdTaxonomyMap(...args);
  const formatDate = (...args) => runtime.formatDate(...args);
  const formatIsoDate = (...args) => runtime.formatIsoDate(...args);
  const normalizeDate = (...args) => runtime.normalizeDate(...args);
  const normalizeDateInput = (...args) => runtime.normalizeDateInput(...args);
  const renderEmptyState = (...args) => runtime.renderEmptyState(...args);
  const safeLocalStorageGet = (...args) => runtime.safeLocalStorageGet(...args);
  const safeLocalStorageRemove = (...args) => runtime.safeLocalStorageRemove(...args);
  const safeLocalStorageSet = (...args) => runtime.safeLocalStorageSet(...args);
  const setEbirdSeasonalLoading = (...args) => runtime.setEbirdSeasonalLoading(...args);
  const setEbirdSeasonalMessage = (...args) => runtime.setEbirdSeasonalMessage(...args);
  const simplifyChineseText = (...args) => runtime.simplifyChineseText(...args);

function hydrateEbirdSeasonalInputs() {
  let settings = {};
  try {
    settings = JSON.parse(safeLocalStorageGet(EBIRD_SEASONAL_SETTINGS_STORAGE, "{}"));
  } catch (error) {
    settings = {};
  }

  if (elements.ebirdSeasonalDate) {
    elements.ebirdSeasonalDate.value = normalizeDateInput(settings.targetDate) || formatIsoDate(new Date());
  }
  if (elements.ebirdSeasonalYears) {
    elements.ebirdSeasonalYears.value = String(clampEbirdSeasonalYears(settings.yearCount));
  }
  if (elements.ebirdSeasonalWindow) {
    elements.ebirdSeasonalWindow.value = String(clampEbirdSeasonalWindow(settings.windowDays));
  }
}

function persistEbirdSeasonalSettings() {
  const settings = getEbirdSeasonalSettings();
  safeLocalStorageSet(EBIRD_SEASONAL_SETTINGS_STORAGE, JSON.stringify(settings));
}

function getEbirdSeasonalSettings() {
  const targetDate = normalizeDateInput(elements.ebirdSeasonalDate?.value) || formatIsoDate(new Date());
  const yearCount = clampEbirdSeasonalYears(elements.ebirdSeasonalYears?.value);
  const windowDays = clampEbirdSeasonalWindow(elements.ebirdSeasonalWindow?.value);

  if (elements.ebirdSeasonalDate) {
    elements.ebirdSeasonalDate.value = targetDate;
  }
  if (elements.ebirdSeasonalYears) {
    elements.ebirdSeasonalYears.value = String(yearCount);
  }
  if (elements.ebirdSeasonalWindow) {
    elements.ebirdSeasonalWindow.value = String(windowDays);
  }

  return {
    targetDate,
    yearCount,
    windowDays
  };
}

async function analyzeEbirdSeasonalPrediction() {
  const apiKey = elements.ebirdApiKey.value.trim();
  if (!apiKey) {
    setEbirdSeasonalMessage("请先在上方输入 eBird API 密钥。", true);
    elements.ebirdApiKey.focus();
    return;
  }

  const core = getEbirdSeasonalCore();
  if (!core) {
    setEbirdSeasonalMessage("eBird 季节分析模块未加载，请刷新页面后重试。", true);
    return;
  }

  const settings = getEbirdSeasonalSettings();
  persistEbirdSeasonalSettings();
  const requests = core.buildEbirdSeasonalDateRequests(settings.targetDate, settings.yearCount, settings.windowDays);
  if (!requests.length) {
    state.ebirdSeasonalResults = [];
    state.ebirdSeasonalMeta = null;
    renderEbirdSeasonalPrediction();
    setEbirdSeasonalMessage("这个目标日期在所选历史年份中没有可比日期，常见原因是 2 月 29 日且历史年份都不是闰年。", true);
    return;
  }

  setEbirdSeasonalLoading(true);
  setEbirdSeasonalMessage(`正在分析浙江 ${formatDate(settings.targetDate)} 前后 ${settings.windowDays} 天的多年历史记录...`);

  try {
    const dailyResult = await fetchEbirdSeasonalDailyEntries(apiKey, requests, (progress) => {
      setEbirdSeasonalMessage(
        `正在读取历史窗口：${progress.done}/${progress.total} 天，缓存 ${progress.cacheHits} 天，新拉取 ${progress.fetched} 天。`
      );
    });

    if (!dailyResult.dailyEntries.length) {
      state.ebirdSeasonalResults = [];
      state.ebirdSeasonalMeta = {
        ...settings,
        totalRequests: requests.length,
        successfulDays: 0,
        failedDays: dailyResult.failures.length,
        cacheHits: dailyResult.cacheHits,
        fetched: dailyResult.fetched,
        nonEmptyDays: dailyResult.nonEmptyDays,
        historicalObservationCount: dailyResult.historicalObservationCount,
        recentCount: 0,
        historicalYears: [...new Set(requests.map((entry) => entry.anchorYear))],
        generatedAt: new Date().toISOString()
      };
      renderEbirdSeasonalPrediction();
      setEbirdSeasonalMessage("历史窗口没有成功读取到可分析数据，请稍后重试或检查网络。", true);
      return;
    }

    const recentObservations = await fetchEbirdRecentSeasonalObservations(apiKey);
    const speciesCodes = [
      ...new Set([
        ...dailyResult.dailyEntries.flatMap((entry) => entry.observations.map((observation) => observation.speciesCode).filter(Boolean)),
        ...recentObservations.map((observation) => observation.speciesCode).filter(Boolean)
      ])
    ];
    let taxonomyMap = new Map();
    try {
      taxonomyMap = await fetchEbirdTaxonomyMap(apiKey, speciesCodes);
    } catch (taxonomyError) {
      console.warn("Failed to enrich seasonal taxonomy from eBird:", taxonomyError);
    }

    const successfulHistoricalYears = [...new Set(dailyResult.dailyEntries.map((entry) => entry.anchorYear))].sort((left, right) => left - right);
    const results = core.aggregateEbirdSeasonalPrediction({
      dailyEntries: dailyResult.dailyEntries,
      recentObservations,
      taxonomyMap,
      historicalYearCount: successfulHistoricalYears.length,
      totalHistoricalDays: dailyResult.dailyEntries.length
    });

    state.ebirdSeasonalResults = results;
    state.activeEbirdSeasonalSpeciesCode = "";
    state.ebirdSeasonalMeta = {
      ...settings,
      totalRequests: requests.length,
      successfulDays: dailyResult.dailyEntries.length,
      failedDays: dailyResult.failures.length,
      cacheHits: dailyResult.cacheHits,
      fetched: dailyResult.fetched,
      nonEmptyDays: dailyResult.nonEmptyDays,
      historicalObservationCount: dailyResult.historicalObservationCount,
      recentCount: recentObservations.length,
      historicalYears: successfulHistoricalYears,
      generatedAt: new Date().toISOString()
    };
    renderEbirdSeasonalPrediction();

    const highCount = results.filter((entry) => entry.probabilityLevel === "高概率").length;
    setEbirdSeasonalMessage(
      `浙江当季分析完成：${results.length} 个候选鸟种，其中高概率 ${highCount} 种；历史读取成功 ${dailyResult.dailyEntries.length}/${requests.length} 天，其中 ${dailyResult.nonEmptyDays} 天有记录，共 ${dailyResult.historicalObservationCount} 条历史鸟种记录。`
    );
  } catch (error) {
    state.ebirdSeasonalResults = [];
    state.ebirdSeasonalMeta = null;
    renderEbirdSeasonalPrediction();
    const extra =
      error instanceof TypeError
        ? " 这通常是浏览器跨域限制或网络拦截导致的；如果页面是纯静态部署，可能需要通过后端服务转发请求。"
        : "";
    setEbirdSeasonalMessage(`浙江当季分析失败：${error.message}${extra}`, true);
  } finally {
    setEbirdSeasonalLoading(false);
  }
}

function renderEbirdSeasonalPrediction() {
  if (!elements.ebirdSeasonalContainer || !elements.ebirdSeasonalSummary) {
    return;
  }

  const results = state.ebirdSeasonalResults || [];
  const meta = state.ebirdSeasonalMeta;
  elements.ebirdSeasonalContainer.innerHTML = "";
  elements.ebirdSeasonalSummary.textContent = meta
    ? [
        `区域 ${EBIRD_SEASONAL_REGION_CODE}`,
        `目标 ${formatDate(meta.targetDate)}`,
        `窗口 ±${meta.windowDays} 天`,
        `历史 ${formatSeasonalYearRange(meta.historicalYears)}`,
        `成功 ${meta.successfulDays}/${meta.totalRequests} 天`,
        `有记录 ${meta.nonEmptyDays || 0} 天`,
        `历史记录 ${meta.historicalObservationCount || 0} 条`,
        `近期记录 ${meta.recentCount} 条`
      ].join(" · ")
    : "尚未分析。结果会显示基于 eBird 历史提交记录推算出的当季候选鸟种。";

  if (!results.length) {
    renderEmptyState(elements.ebirdSeasonalContainer, "ebird-seasonal");
    return;
  }

  const rows = results
    .map((entry, index) => {
      const isActive = entry.speciesCode === state.activeEbirdSeasonalSpeciesCode;
      return `
        <div class="result-table-row seasonal-prediction-row${isActive ? " is-active" : ""}">
          <div class="result-table-cell result-table-index">${index + 1}</div>
          <div class="result-table-cell">
            <button type="button" class="result-table-name-btn" data-seasonal-species-code="${escapeHtml(entry.speciesCode)}" aria-expanded="${isActive ? "true" : "false"}">
              <strong>${escapeHtml(entry.commonName)}</strong>
              <span class="result-table-meta">${escapeHtml(entry.sciName || entry.speciesCode)}</span>
            </button>
          </div>
          <div class="result-table-cell result-table-status">
            <span class="seasonal-probability ${getSeasonalProbabilityClass(entry.probabilityLevel)}">${escapeHtml(entry.probabilityLevel)}</span>
            <small>${escapeHtml(entry.score.toFixed(2))}</small>
          </div>
          <div class="result-table-cell result-table-count">${escapeHtml(String(entry.yearsSeen))} 年</div>
          <div class="result-table-cell result-table-count">${escapeHtml(String(entry.hitDays))} 天</div>
          <div class="result-table-cell result-table-status">${entry.recentConfirmed ? "已确认" : "未确认"}</div>
          <div class="result-table-cell result-table-location">${escapeHtml(formatSeasonalRecentEvidence(entry))}</div>
        </div>
      `;
    })
    .join("");

  const activeEntry = results.find((entry) => entry.speciesCode === state.activeEbirdSeasonalSpeciesCode);
  elements.ebirdSeasonalContainer.innerHTML = `
    <div class="result-table seasonal-prediction-table" style="--table-columns: 56px minmax(180px, 1.3fr) 96px 90px 90px 96px minmax(180px, 1.2fr);">
      <div class="result-table-header">
        <div class="result-table-cell">排名</div>
        <div class="result-table-cell">鸟种</div>
        <div class="result-table-cell">概率</div>
        <div class="result-table-cell">命中年份</div>
        <div class="result-table-cell">命中天数</div>
        <div class="result-table-cell">近期</div>
        <div class="result-table-cell">近期证据</div>
      </div>
      <div class="result-table-body">
        ${rows}
      </div>
    </div>
    ${activeEntry ? renderEbirdSeasonalDetail(activeEntry) : ""}
  `;

  elements.ebirdSeasonalContainer.querySelectorAll("[data-seasonal-species-code]").forEach((button) => {
    button.addEventListener("click", () => {
      const speciesCode = button.dataset.seasonalSpeciesCode || "";
      state.activeEbirdSeasonalSpeciesCode = state.activeEbirdSeasonalSpeciesCode === speciesCode ? "" : speciesCode;
      renderEbirdSeasonalPrediction();
    });
  });
}

function renderEbirdSeasonalDetail(entry) {
  const dates = entry.historicalDates.slice(0, 40).map((date) => formatDate(date)).join("、");
  const extraDates = entry.historicalDates.length > 40 ? ` 等 ${entry.historicalDates.length} 天` : "";
  return `
    <div class="seasonal-prediction-detail">
      <div class="seasonal-detail-card">
        <strong>历史年份</strong>
        <span>${escapeHtml(entry.historicalYears.join("、") || "暂无")}</span>
      </div>
      <div class="seasonal-detail-card">
        <strong>历史命中日期</strong>
        <span>${escapeHtml(dates || "暂无")}${escapeHtml(extraDates)}</span>
      </div>
      <div class="seasonal-detail-card">
        <strong>近期证据</strong>
        <span>${escapeHtml(formatSeasonalRecentEvidence(entry))}</span>
      </div>
      <div class="seasonal-detail-card">
        <strong>说明</strong>
        <span>这是基于 eBird 历史提交记录的出现可能性，不代表未列出的鸟种不会出现。</span>
      </div>
    </div>
  `;
}

function clearEbirdSeasonalCache() {
  safeLocalStorageRemove(EBIRD_SEASONAL_CACHE_STORAGE);
  setEbirdSeasonalMessage("已清除浙江当季分析的历史缓存；下次分析会重新请求 eBird。");
}

async function fetchEbirdSeasonalDailyEntries(apiKey, requests, onProgress) {
  const cache = loadEbirdSeasonalCache();
  const entries = [];
  const failures = [];
  let cacheHits = 0;
  let fetched = 0;
  let done = 0;
  let nonEmptyDays = 0;
  let historicalObservationCount = 0;

  const tasks = requests.map((request) => async () => {
    const cached = getCachedEbirdSeasonalDay(cache, request.date);
    if (cached) {
      if (cached.length) {
        nonEmptyDays += 1;
        historicalObservationCount += cached.length;
      }
      cacheHits += 1;
      done += 1;
      onProgress?.({ done, total: requests.length, cacheHits, fetched });
      return {
        anchorYear: request.anchorYear,
        date: request.date,
        observations: cached
      };
    }

    try {
      const observations = await fetchEbirdHistoricSpeciesForDate(apiKey, request.date);
      if (observations.length) {
        setCachedEbirdSeasonalDay(cache, request.date, observations);
        nonEmptyDays += 1;
        historicalObservationCount += observations.length;
      }
      fetched += 1;
      done += 1;
      onProgress?.({ done, total: requests.length, cacheHits, fetched });
      return {
        anchorYear: request.anchorYear,
        date: request.date,
        observations
      };
    } catch (error) {
      failures.push({ ...request, error: error.message });
      done += 1;
      onProgress?.({ done, total: requests.length, cacheHits, fetched });
      return null;
    }
  });

  const results = await runLimitedConcurrency(tasks, EBIRD_SEASONAL_CONCURRENCY);
  results.forEach((entry) => {
    if (entry) {
      entries.push(entry);
    }
  });
  saveEbirdSeasonalCache(cache);

  return {
    dailyEntries: entries,
    failures,
    cacheHits,
    fetched,
    nonEmptyDays,
    historicalObservationCount
  };
}

async function fetchEbirdHistoricSpeciesForDate(apiKey, date) {
  const { year, month, day } = parseIsoDateParts(date);
  const url = new URL(`https://api.ebird.org/v2/data/obs/${EBIRD_SEASONAL_REGION_CODE}/historic/${year}/${month}/${day}`);
  url.searchParams.set("cat", "species");
  url.searchParams.set("sppLocale", EBIRD_SPECIES_LOCALE);
  url.searchParams.set("maxResults", "500");

  const response = await fetch(url, {
    headers: {
      "X-eBirdApiToken": apiKey
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`historic ${date} 返回 ${response.status}：${errorText || "请求失败"}`);
  }

  return normalizeEbirdSeasonalObservationList(await response.json());
}

async function fetchEbirdRecentSeasonalObservations(apiKey) {
  const url = new URL(`https://api.ebird.org/v2/data/obs/${EBIRD_SEASONAL_REGION_CODE}/recent`);
  url.searchParams.set("back", "30");
  url.searchParams.set("cat", "species");
  url.searchParams.set("sppLocale", EBIRD_SPECIES_LOCALE);
  url.searchParams.set("maxResults", "500");

  const response = await fetch(url, {
    headers: {
      "X-eBirdApiToken": apiKey
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`recent 返回 ${response.status}：${errorText || "请求失败"}`);
  }

  return normalizeEbirdSeasonalObservationList(await response.json());
}

function normalizeEbirdSeasonalObservationList(payload) {
  const unique = new Map();
  (Array.isArray(payload) ? payload : []).forEach((item) => {
    const speciesCode = String(item?.speciesCode || "").trim();
    if (!speciesCode) {
      return;
    }

    const existing = unique.get(speciesCode);
    if (existing && String(existing.obsDt || "") >= String(item?.obsDt || "")) {
      return;
    }

    unique.set(speciesCode, {
      speciesCode,
      comName: simplifyChineseText(item?.comName || ""),
      sciName: String(item?.sciName || "").trim(),
      obsDt: String(item?.obsDt || "").trim(),
      locName: String(item?.locName || item?.locId || "").trim()
    });
  });
  return [...unique.values()];
}

function loadEbirdSeasonalCache() {
  try {
    const parsed = JSON.parse(safeLocalStorageGet(EBIRD_SEASONAL_CACHE_STORAGE, "{}"));
    return {
      version: 1,
      days: parsed?.days && typeof parsed.days === "object" ? parsed.days : {}
    };
  } catch (error) {
    console.warn("Failed to load eBird seasonal cache:", error);
    return { version: 1, days: {} };
  }
}

function saveEbirdSeasonalCache(cache) {
  safeLocalStorageSet(
    EBIRD_SEASONAL_CACHE_STORAGE,
    JSON.stringify({
      version: 1,
      days: cache.days || {}
    })
  );
}

function getCachedEbirdSeasonalDay(cache, date) {
  const key = getEbirdSeasonalCacheKey(date);
  const cached = cache.days?.[key];
  if (!cached || !Array.isArray(cached.observations)) {
    return null;
  }
  if (!cached.observations.length) {
    delete cache.days[key];
    return null;
  }

  const savedAt = Date.parse(cached.savedAt || "");
  if (!Number.isFinite(savedAt) || Date.now() - savedAt > EBIRD_SEASONAL_CACHE_TTL_MS) {
    delete cache.days[key];
    return null;
  }

  return cached.observations;
}

function setCachedEbirdSeasonalDay(cache, date, observations) {
  cache.days[getEbirdSeasonalCacheKey(date)] = {
    savedAt: new Date().toISOString(),
    observations
  };
}

function getEbirdSeasonalCacheKey(date) {
  return `${EBIRD_SEASONAL_REGION_CODE}|${date}`;
}

async function runLimitedConcurrency(tasks, limit) {
  const results = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await tasks[currentIndex]();
    }
  }

  const workerCount = Math.min(Math.max(1, limit), tasks.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

function parseIsoDateParts(date) {
  const normalized = normalizeDateInput(date);
  if (!normalized) {
    throw new Error(`日期格式无效：${date}`);
  }
  const [year, month, day] = normalized.split("-").map(Number);
  return { year, month, day };
}

function getEbirdSeasonalCore() {
  return window.EBIRD_SEASONAL_CORE || null;
}

function formatSeasonalYearRange(years = []) {
  if (!years.length) {
    return "无";
  }
  if (years.length === 1) {
    return String(years[0]);
  }
  return `${years[0]}-${years[years.length - 1]}`;
}

function formatSeasonalRecentEvidence(entry) {
  if (!entry.recentConfirmed) {
    return "最近 30 天未确认";
  }
  const date = normalizeDate(entry.recentDate);
  const dateLabel = date ? formatDate(date) : "日期未知";
  return [dateLabel, entry.recentLocation].filter(Boolean).join(" · ");
}

function getSeasonalProbabilityClass(level) {
  if (level === "高概率") {
    return "is-high";
  }
  if (level === "中概率") {
    return "is-medium";
  }
  return "is-low";
}

  Object.assign(runtime, {
    hydrateEbirdSeasonalInputs,
    persistEbirdSeasonalSettings,
    getEbirdSeasonalSettings,
    analyzeEbirdSeasonalPrediction,
    renderEbirdSeasonalPrediction,
    renderEbirdSeasonalDetail,
    clearEbirdSeasonalCache,
    fetchEbirdSeasonalDailyEntries,
    fetchEbirdHistoricSpeciesForDate,
    fetchEbirdRecentSeasonalObservations,
    normalizeEbirdSeasonalObservationList,
    loadEbirdSeasonalCache,
    saveEbirdSeasonalCache,
    getCachedEbirdSeasonalDay,
    setCachedEbirdSeasonalDay,
    getEbirdSeasonalCacheKey,
    runLimitedConcurrency,
    parseIsoDateParts,
    getEbirdSeasonalCore,
    formatSeasonalYearRange,
    formatSeasonalRecentEvidence,
    getSeasonalProbabilityClass
  });
}
