// Functions extracted from the legacy script.js features/ebird/recent domain.
export function installEbirdRecent(runtime) {
  const { EBIRD_API_KEY_STORAGE, EBIRD_REGION_STORAGE, EBIRD_BACK_STORAGE, EBIRD_SPECIES_LOCALE, state, elements } = runtime;
  const chunkArray = (...args) => runtime.chunkArray(...args);
  const clampBackDays = (...args) => runtime.clampBackDays(...args);
  const escapeHtml = (...args) => runtime.escapeHtml(...args);
  const extractGenus = (...args) => runtime.extractGenus(...args);
  const formatDate = (...args) => runtime.formatDate(...args);
  const formatTaxonLabel = (...args) => runtime.formatTaxonLabel(...args);
  const normalizeDate = (...args) => runtime.normalizeDate(...args);
  const normalizeRecord = (...args) => runtime.normalizeRecord(...args);
  const renderEmptyState = (...args) => runtime.renderEmptyState(...args);
  const safeLocalStorageGet = (...args) => runtime.safeLocalStorageGet(...args);
  const safeLocalStorageRemove = (...args) => runtime.safeLocalStorageRemove(...args);
  const safeLocalStorageSet = (...args) => runtime.safeLocalStorageSet(...args);
  const setEbirdLoading = (...args) => runtime.setEbirdLoading(...args);
  const setEbirdMessage = (...args) => runtime.setEbirdMessage(...args);
  const simplifyChineseText = (...args) => runtime.simplifyChineseText(...args);
  const toNumber = (...args) => runtime.toNumber(...args);
  const toTaxonOrder = (...args) => runtime.toTaxonOrder(...args);

function renderRegionQueryResults() {
  elements.regionQuerySummary.textContent = "";
  elements.regionQueryContainer.innerHTML = "";

  if (!state.regionQueryRecords.length) {
    state.activeRegionRecordId = null;
    renderRegionQueryDetail();
    renderEmptyState(elements.regionQueryContainer, "ebird-region");
    return;
  }

  const speciesCount = new Set(state.regionQueryRecords.map((record) => record.species)).size;
  elements.regionQuerySummary.textContent = `当前区域查询结果共 ${state.regionQueryRecords.length} 条，涉及 ${speciesCount} 个种类。这些结果不会保存到个人记录。`;

  if (!state.regionQueryRecords.some((record) => record.id === state.activeRegionRecordId)) {
    state.activeRegionRecordId = null;
  }

  elements.regionQueryContainer.innerHTML = `
    <div class="result-table" style="--table-columns: 72px minmax(210px, 1.4fr) minmax(260px, 1.9fr) 150px 116px;">
      <div class="result-table-header">
        <div class="result-table-cell">序号</div>
        <div class="result-table-cell">鸟种</div>
        <div class="result-table-cell">地点</div>
        <div class="result-table-cell">日期</div>
        <div class="result-table-cell">详情</div>
      </div>
      <div class="result-table-body">
        ${state.regionQueryRecords
          .map((record, index) => {
            const isActive = record.id === state.activeRegionRecordId;
            return `
              <div class="result-table-row${isActive ? " is-active" : ""}">
                <div class="result-table-cell result-table-index">${state.regionQueryRecords.length - index}</div>
                <div class="result-table-cell">
                  <button
                    type="button"
                    class="result-table-name-btn"
                    data-region-record-id="${escapeHtml(String(record.id || ""))}"
                    aria-pressed="${isActive ? "true" : "false"}"
                  >
                    <strong>${escapeHtml(record.species)}</strong>
                    <span class="result-table-meta">${escapeHtml(record.sciName || "点击查看详情")}</span>
                  </button>
                </div>
                <div class="result-table-cell result-table-location">${escapeHtml(record.location || "未提供地点")}</div>
                <div class="result-table-cell result-table-date">${escapeHtml(formatDate(record.date))}</div>
                <div class="result-table-cell result-table-status">${isActive ? "已展开" : "查看详情"}</div>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
  elements.regionQueryContainer.querySelectorAll("[data-region-record-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const recordId = button.dataset.regionRecordId || "";
      state.activeRegionRecordId = state.activeRegionRecordId === recordId ? null : recordId;
      renderRegionQueryResults();
    });
  });

  renderRegionQueryDetail();
}

function renderRegionQueryDetail() {
  const record = state.regionQueryRecords.find((entry) => entry.id === state.activeRegionRecordId);

  if (!record) {
    elements.regionQueryDetail.innerHTML = "";
    elements.regionQueryDetail.classList.add("is-hidden");
    elements.regionQueryBackdrop?.classList.add("is-hidden");
    document.body.classList.remove("query-detail-open");
    return;
  }

  const detailItems = [
    { label: "观测日期", value: formatDate(record.date) },
    { label: "观测地点", value: record.location },
    {
      label: "坐标",
      value: record.lat != null && record.lng != null ? `${record.lat.toFixed(4)}, ${record.lng.toFixed(4)}` : "未提供"
    },
    { label: "学名", value: record.sciName || "未提供" },
    { label: "物种代码", value: record.speciesCode || "未提供" },
    { label: "目", value: formatTaxonLabel("order", record.orderName) },
    { label: "科", value: formatTaxonLabel("family", record.familyName, record.familyCommonName) },
    { label: "属", value: formatTaxonLabel("genus", record.genusName) },
    { label: "备注", value: record.notes || "未提供" }
  ];

  elements.regionQueryDetail.innerHTML = `
    <div class="query-detail-header">
      <div>
        <h3 class="query-detail-title">${escapeHtml(record.species)}</h3>
        <p class="query-detail-subtitle">详情固定显示在右侧，方便你连续点不同卡片快速对比。</p>
      </div>
      <button type="button" class="ghost query-detail-close">收起详情</button>
    </div>
    <div class="query-detail-grid">
      ${detailItems
        .map(
          (item) => `
            <div class="query-detail-item">
              <strong>${escapeHtml(item.label)}</strong>
              <span>${escapeHtml(item.value)}</span>
            </div>
          `
        )
        .join("")}
    </div>
  `;
  elements.regionQueryDetail.classList.remove("is-hidden");
  elements.regionQueryBackdrop?.classList.remove("is-hidden");
  document.body.classList.add("query-detail-open");
  elements.regionQueryDetail.querySelector(".query-detail-close")?.addEventListener("click", closeRegionQueryDetail);
}

function closeRegionQueryDetail() {
  if (!state.activeRegionRecordId) {
    return;
  }

  state.activeRegionRecordId = null;
  renderRegionQueryResults();
}

async function syncEbirdRecords() {
  const apiKey = elements.ebirdApiKey.value.trim();
  const regionCode = elements.ebirdRegionCode.value.trim();
  const backDays = clampBackDays(elements.ebirdBackDays.value);

  if (!apiKey) {
    setEbirdMessage("请先输入 eBird API 密钥。", true);
    elements.ebirdApiKey.focus();
    return;
  }

  if (!regionCode) {
    setEbirdMessage("请先输入区域代码，例如 CN-31 或 L7884500。", true);
    elements.ebirdRegionCode.focus();
    return;
  }

  elements.ebirdBackDays.value = String(backDays);
  persistEbirdSettings();
  setEbirdLoading(true);
  setEbirdMessage("正在查询 eBird 区域最近观测...");

  try {
    const url = new URL(`https://api.ebird.org/v2/data/obs/${encodeURIComponent(regionCode)}/recent`);
    url.searchParams.set("back", String(backDays));
    url.searchParams.set("maxResults", "500");
    url.searchParams.set("sppLocale", EBIRD_SPECIES_LOCALE);

    const response = await fetch(url, {
      headers: {
        "X-eBirdApiToken": apiKey
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`eBird 返回 ${response.status}：${errorText || "请求失败"}`);
    }

    const payload = await response.json();
    let taxonomyMap = new Map();

    try {
      taxonomyMap = await fetchEbirdTaxonomyMap(apiKey, payload.map((observation) => observation.speciesCode));
    } catch (taxonomyError) {
      console.warn("Failed to enrich taxonomy from eBird:", taxonomyError);
    }

    const imported = normalizeEbirdObservations(payload, taxonomyMap);
    state.regionQueryRecords = imported;
    renderRegionQueryResults();

    if (!imported.length) {
      setEbirdMessage("eBird 已连接成功，但这个区域在所选天数内没有可显示的观测。");
      return;
    }

    setEbirdMessage(`eBird 区域查询完成：抓取 ${imported.length} 条结果。这些结果仅供查看，不会保存到个人记录。`);
  } catch (error) {
    state.regionQueryRecords = [];
    renderRegionQueryResults();
    const extra =
      error instanceof TypeError
        ? " 这通常是浏览器跨域限制或网络拦截导致的；如果页面是纯静态部署，可能需要通过后端服务转发请求。"
        : "";
    setEbirdMessage(`查询失败：${error.message}${extra}`, true);
  } finally {
    setEbirdLoading(false);
  }
}

function hydrateEbirdInputs() {
  elements.ebirdApiKey.value = safeLocalStorageGet(EBIRD_API_KEY_STORAGE, "");
  elements.ebirdRegionCode.value = safeLocalStorageGet(EBIRD_REGION_STORAGE, "");
  elements.ebirdBackDays.value = safeLocalStorageGet(EBIRD_BACK_STORAGE, "14");
}

function persistEbirdSettings() {
  const backDays = clampBackDays(elements.ebirdBackDays.value);
  elements.ebirdBackDays.value = String(backDays);
  safeLocalStorageSet(EBIRD_API_KEY_STORAGE, elements.ebirdApiKey.value.trim());
  safeLocalStorageSet(EBIRD_REGION_STORAGE, elements.ebirdRegionCode.value.trim());
  safeLocalStorageSet(EBIRD_BACK_STORAGE, String(backDays));
}

function clearEbirdApiKey() {
  elements.ebirdApiKey.value = "";
  safeLocalStorageRemove(EBIRD_API_KEY_STORAGE);
  setEbirdMessage("已清除本地保存的 eBird API 密钥。");
}

function getStoredEbirdApiKey() {
  return String(elements.ebirdApiKey?.value || safeLocalStorageGet(EBIRD_API_KEY_STORAGE, "")).trim();
}

function normalizeEbirdObservations(observations, taxonomyMap = new Map()) {
  if (!Array.isArray(observations)) {
    return [];
  }

  return observations
    .map((observation, index) => {
      const taxonomy = taxonomyMap.get(observation.speciesCode) || {};
      return normalizeRecord({
        id: createEbirdObservationId(observation, index),
        date: normalizeDate(observation.obsDt),
        species: taxonomy.commonName || observation.comName || observation.sciName,
        location: String(observation.locName || observation.locId || "").trim(),
        lat: toNumber(observation.lat),
        lng: toNumber(observation.lng),
        notes: buildEbirdNotes(observation),
        speciesCode: observation.speciesCode,
        sciName: taxonomy.sciName || observation.sciName,
        taxonOrder: taxonomy.taxonOrder ?? null,
        orderName: taxonomy.orderName,
        familyName: taxonomy.familyName,
        familyCommonName: taxonomy.familyCommonName,
        genusName: taxonomy.genusName
      });
    })
    .filter((record) => record.date && record.species && record.location);
}

function createEbirdObservationId(observation, index) {
  const parts = [
    "ebird",
    observation.subId || "nosub",
    observation.speciesCode || "nospecies",
    normalizeDate(observation.obsDt) || "nodate",
    String(observation.locId || observation.locName || "").trim() || "nolocation",
    String(index)
  ];

  return parts.join("|");
}

function buildEbirdNotes(observation) {
  const parts = ["eBird 同步"];
  if (observation.howMany != null) {
    parts.push(`数量 ${observation.howMany}`);
  }
  if (observation.subId) {
    parts.push(`提交 ${observation.subId}`);
  }
  return parts.join(" · ");
}

async function fetchEbirdTaxonomyMap(apiKey, speciesCodes) {
  const uniqueCodes = [...new Set(speciesCodes.filter(Boolean))];
  const result = new Map();

  if (!uniqueCodes.length) {
    return result;
  }

  const chunks = chunkArray(uniqueCodes, 80);
  await Promise.all(
    chunks.map(async (chunk) => {
      const url = new URL("https://api.ebird.org/v2/ref/taxonomy/ebird");
      url.searchParams.set("fmt", "json");
      url.searchParams.set("locale", EBIRD_SPECIES_LOCALE);
      url.searchParams.set("species", chunk.join(","));

      const response = await fetch(url, {
        headers: {
          "X-eBirdApiToken": apiKey
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`taxonomy 返回 ${response.status}：${errorText || "请求失败"}`);
      }

      const payload = await response.json();
      payload.forEach((item) => {
        result.set(item.speciesCode, {
          speciesCode: String(item.speciesCode || "").trim(),
          commonName: simplifyChineseText(item.comName || ""),
          sciName: String(item.sciName || "").trim(),
          taxonOrder: toTaxonOrder(item.taxonOrder),
          orderName: String(item.order || "").trim(),
          familyName: String(item.familySciName || item.family || "").trim(),
          familyCommonName: simplifyChineseText(item.familyComName || item.familyCommonName || ""),
          genusName: extractGenus(item.sciName)
        });
      });
    })
  );

  return result;
}

  Object.assign(runtime, {
    renderRegionQueryResults,
    renderRegionQueryDetail,
    closeRegionQueryDetail,
    syncEbirdRecords,
    hydrateEbirdInputs,
    persistEbirdSettings,
    clearEbirdApiKey,
    getStoredEbirdApiKey,
    normalizeEbirdObservations,
    createEbirdObservationId,
    buildEbirdNotes,
    fetchEbirdTaxonomyMap
  });
}
