// Functions extracted from the legacy script.js features/birdreport/unlocked domain.
export function installUnlockedSpecies(runtime) {
  const { BIRDREPORT_UNLOCKED_SPECIES_CACHE_STORAGE, BIRDREPORT_RARE_SPECIES_PROVINCE, UNLOCKED_SPECIES_VISIBLE_ROW_COUNT, formatCompactTimestamp, state, elements } = runtime;
  const canUseBirdreportProxy = (...args) => runtime.canUseBirdreportProxy(...args);
  const createBirdreportPayload = (...args) => runtime.createBirdreportPayload(...args);
  const escapeHtml = (...args) => runtime.escapeHtml(...args);
  const fetchAllBirdreportTaxa = (...args) => runtime.fetchAllBirdreportTaxa(...args);
  const fetchRecentBirdreportRecordsByTaxon = (...args) => runtime.fetchRecentBirdreportRecordsByTaxon(...args);
  const fetchZhejiangSpeciesCatalogFromJson = (...args) => runtime.fetchZhejiangSpeciesCatalogFromJson(...args);
  const formatDateTime = (...args) => runtime.formatDateTime(...args);
  const getBirdreportReportCount = (...args) => runtime.getBirdreportReportCount(...args);
  const getBirdreportTaxaArray = (...args) => runtime.getBirdreportTaxaArray(...args);
  const getBirdreportTaxonKey = (...args) => runtime.getBirdreportTaxonKey(...args);
  const isBirdreportCaptchaError = (...args) => runtime.isBirdreportCaptchaError(...args);
  const loadBirdreportCaptchaImage = (...args) => runtime.loadBirdreportCaptchaImage(...args);
  const normalizeBirdreportTaxa = (...args) => runtime.normalizeBirdreportTaxa(...args);
  const renderEmptyState = (...args) => runtime.renderEmptyState(...args);
  const safeLocalStorageGet = (...args) => runtime.safeLocalStorageGet(...args);
  const safeLocalStorageRemove = (...args) => runtime.safeLocalStorageRemove(...args);
  const safeLocalStorageSet = (...args) => runtime.safeLocalStorageSet(...args);
  const saveTextFile = (...args) => runtime.saveTextFile(...args);
  const serializeBirdreportTaxon = (...args) => runtime.serializeBirdreportTaxon(...args);
  const setElementLoadingClass = (...args) => runtime.setElementLoadingClass(...args);
  const setStatusMessage = (...args) => runtime.setStatusMessage(...args);
  const toCsvText = (...args) => runtime.toCsvText(...args);
  const verifyBirdreportCaptcha = (...args) => runtime.verifyBirdreportCaptcha(...args);

async function queryUnlockedSpeciesByUser() {
  const username = String(elements.birdreportUnlockedUsername?.value || "").trim();
  if (!username) {
    setUnlockedSpeciesMessage("请先输入记录用户姓名。", true);
    elements.birdreportUnlockedUsername?.focus();
    return;
  }

  if (!canUseBirdreportProxy()) {
    setUnlockedSpeciesMessage("BirdReport 暂时不可用，无法查询记录用户。", true);
    return;
  }

  setUnlockedSpeciesLoading(true);
  setUnlockedSpeciesMessage(`正在查询 ${username} 的浙江鸟种...`);

  try {
    const catalog = normalizeBirdreportTaxa(await fetchZhejiangSpeciesCatalogForUnlocked({
      onProgress: (message) => setUnlockedSpeciesMessage(message)
    }));
    const observed = normalizeBirdreportTaxa(await fetchUserZhejiangSpecies(username, {
      onProgress: (message) => setUnlockedSpeciesMessage(message)
    }));
    if (catalog.length && !observed.length) {
      throw new Error(`BirdReport 没有查到「${username}」在浙江的鸟种记录；请确认输入的是记录页里显示的完整记录用户名。`);
    }

    const missing = buildUnlockedMissingSpecies(catalog, observed);

    state.unlockedSpeciesCatalog = catalog;
    state.unlockedObservedSpecies = observed;
    state.unlockedMissingSpecies = missing;
    state.unlockedTargetUsername = username;
    state.unlockedSpeciesCacheSavedAt = new Date().toISOString();
    state.unlockedSpeciesTableVisible = true;
    clearUnlockedSpeciesDetail();
    saveUnlockedSpeciesCache();
    renderUnlockedSpeciesPanel();
    setUnlockedSpeciesMessage(
      `${username} 已解锁 ${observed.length} / ${catalog.length} 种浙江鸟种，还差 ${missing.length} 种。`
    );
  } catch (error) {
    setUnlockedSpeciesMessage(`未解锁鸟种查询失败：${error.message}`, true);
  } finally {
    setUnlockedSpeciesLoading(false);
  }
}

async function fetchZhejiangSpeciesCatalogForUnlocked(options = {}) {
  const { onProgress } = options;
  try {
    onProgress?.("正在刷新浙江鸟种名录和历史记录数...");
    const onlineCatalog = await fetchAllBirdreportTaxa(createBirdreportPayload({ province: BIRDREPORT_RARE_SPECIES_PROVINCE }), {
      onProgress: (message) => onProgress?.(message.replace("BirdReport 鸟种", "浙江鸟种名录"))
    });
    if (onlineCatalog.length) {
      return onlineCatalog.map(serializeBirdreportTaxon).sort(sortBirdreportTaxaByReportCountDesc);
    }
  } catch (error) {
    console.warn("Failed to refresh Zhejiang species catalog from BirdReport:", error);
    onProgress?.(`在线刷新浙江名录失败，使用本地缓存名录：${error.message}`);
  }

  return fetchZhejiangSpeciesCatalogFromJson();
}

async function fetchUserZhejiangSpecies(username, options = {}) {
  const { onProgress } = options;
  const primary = await fetchAllBirdreportTaxa(
    createBirdreportPayload({
      province: BIRDREPORT_RARE_SPECIES_PROVINCE,
      username,
      mode: 1
    }),
    {
      onProgress: (message) => onProgress?.(message.replace("BirdReport 鸟种", "用户浙江鸟种"))
    }
  );
  if (primary.length) {
    return primary;
  }

  onProgress?.("按兼容模式重新核对记录用户鸟种...");
  return fetchAllBirdreportTaxa(
    createBirdreportPayload({
      province: BIRDREPORT_RARE_SPECIES_PROVINCE,
      username
    }),
    {
      onProgress: (message) => onProgress?.(message.replace("BirdReport 鸟种", "用户浙江鸟种"))
    }
  );
}

function buildUnlockedMissingSpecies(catalog, observed) {
  const catalogItems = getBirdreportTaxaArray(catalog);
  const observedItems = getBirdreportTaxaArray(observed);
  const observedKeys = new Set(observedItems.map(getBirdreportTaxonKey).filter(Boolean));
  const observedNames = new Set(observedItems.map((item) => String(item?.taxonname || item?.name || "").trim()).filter(Boolean));

  return catalogItems
    .filter((item) => !observedKeys.has(getBirdreportTaxonKey(item)) && !observedNames.has(String(item?.taxonname || "").trim()))
    .sort(sortBirdreportTaxaByReportCountDesc);
}

function sortBirdreportTaxaByReportCountDesc(left, right) {
  const countDiff = getBirdreportReportCount(right) - getBirdreportReportCount(left);
  if (countDiff !== 0) {
    return countDiff;
  }

  return String(left?.taxonname || "").localeCompare(String(right?.taxonname || ""), "zh-CN");
}

function renderUnlockedSpeciesPanel() {
  if (!elements.unlockedSpeciesSummary || !elements.unlockedSpeciesContainer) {
    return;
  }

  const catalog = getBirdreportTaxaArray(state.unlockedSpeciesCatalog);
  const observed = getBirdreportTaxaArray(state.unlockedObservedSpecies);
  const missing = getBirdreportTaxaArray(state.unlockedMissingSpecies);
  const catalogCount = catalog.length || 0;
  const missingCount = missing.length || 0;
  const observedCount = observed.length || (catalogCount ? catalogCount - missingCount : 0);
  updateUnlockedSpeciesExportButton();

  if (!catalogCount) {
    elements.unlockedSpeciesSummary.classList.remove("is-rich");
    elements.unlockedSpeciesSummary.textContent = "输入记录用户后，可核对浙江 588 种名录中的未解锁鸟种。";
    renderEmptyState(elements.unlockedSpeciesContainer, "unlocked");
    return;
  }

  renderUnlockedSpeciesSummary({
    observedCount,
    missingCount,
    catalogCount
  });

  renderUnlockedSpeciesList();
}

function renderUnlockedSpeciesSummary({ observedCount, missingCount, catalogCount }) {
  elements.unlockedSpeciesSummary.classList.add("is-rich");
  elements.unlockedSpeciesSummary.innerHTML = `
    <div class="unlocked-summary-toolbar">
      <div class="unlocked-summary-grid">
        ${renderUnlockedSpeciesSummaryCard("记录用户", state.unlockedTargetUsername || "未填写", "info")}
        ${renderUnlockedSpeciesSummaryCard("已解锁", `${observedCount} 种`, "success")}
        ${renderUnlockedSpeciesSummaryCard("未解锁", `${missingCount} 种`, "warning")}
        ${renderUnlockedSpeciesSummaryCard("浙江名录", `${catalogCount} 种`, "catalog")}
        ${
          state.unlockedSpeciesCacheSavedAt
            ? renderUnlockedSpeciesSummaryCard("缓存", formatDateTime(state.unlockedSpeciesCacheSavedAt), "neutral")
            : ""
        }
      </div>
      <div class="unlocked-summary-actions">
        <button type="button" class="ghost unlocked-summary-toggle">${state.unlockedSpeciesShowMeta ? "隐藏鸟种信息" : "显示鸟种信息"}</button>
      </div>
    </div>
  `;
  elements.unlockedSpeciesSummary
    .querySelector(".unlocked-summary-toggle")
    ?.addEventListener("click", toggleUnlockedSpeciesInfoVisibility);
}

function renderUnlockedSpeciesSummaryCard(label, value, tone = "neutral") {
  const toneClass = ["success", "warning", "info", "catalog", "neutral"].includes(tone) ? ` is-${tone}` : "";
  return `
    <div class="unlocked-summary-card${toneClass}">
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(label)}</span>
    </div>
  `;
}

function toggleUnlockedSpeciesInfoVisibility() {
  state.unlockedSpeciesShowMeta = !state.unlockedSpeciesShowMeta;
  renderUnlockedSpeciesPanel();
}

function toggleUnlockedSpeciesTableVisibility() {
  state.unlockedSpeciesTableVisible = !state.unlockedSpeciesTableVisible;
  if (!state.unlockedSpeciesTableVisible) {
    clearUnlockedSpeciesDetail();
  }
  renderUnlockedSpeciesPanel();
}

function renderUnlockedSpeciesList() {
  const previousScrollTop = elements.unlockedSpeciesContainer.querySelector(".unlocked-species-scroll")?.scrollTop || 0;
  elements.unlockedSpeciesContainer.innerHTML = "";
  const missing = getBirdreportTaxaArray(state.unlockedMissingSpecies);
  if (!missing.length) {
    elements.unlockedSpeciesContainer.innerHTML = '<div class="empty-state">这个用户已经解锁浙江名录里的全部鸟种。</div>';
    return;
  }

  const module = document.createElement("section");
  module.className = "unlocked-species-module";
  module.style.setProperty("--unlocked-visible-rows", String(UNLOCKED_SPECIES_VISIBLE_ROW_COUNT));
  module.setAttribute("aria-label", "全部未解锁鸟种列表");
  module.addEventListener("click", (event) => {
    const button = event.target.closest("[data-unlocked-map-taxon]");
    if (!button) return;
    event.stopPropagation();
    runtime.openBirdMapForSpecies?.({
      taxonId: button.dataset.unlockedMapTaxon,
      commonName: button.dataset.unlockedMapName,
      latinname: button.dataset.unlockedMapScientific
    });
  });
  module.append(createUnlockedSpeciesModuleHeader(missing.length));

  if (!state.unlockedSpeciesTableVisible) {
    const empty = document.createElement("div");
    empty.className = "empty-state unlocked-species-module-empty";
    empty.style.setProperty("--empty-icon", "\"📋\"");
    empty.textContent = `已隐藏 ${missing.length} 个未解锁鸟种，点击“展开列表”查看。`;
    module.append(empty);
    elements.unlockedSpeciesContainer.append(module);
    return;
  }

  const totalReportCount = Math.max(
    1,
    missing.reduce(
      (sum, item) => sum + getBirdreportReportCount(item),
      0
    )
  );

  const table = document.createElement("div");
  table.className = "unlocked-species-table";
  table.innerHTML = `
    <div class="unlocked-species-table-head" role="row">
      <span class="unlocked-table-cell unlocked-cell-rank">序号</span>
      <span class="unlocked-table-cell unlocked-cell-code">编号</span>
      <span class="unlocked-table-cell unlocked-cell-name">中文名</span>
      <span class="unlocked-table-cell unlocked-cell-count">历史记录</span>
      <span class="unlocked-table-cell unlocked-cell-toggle">展开</span>
    </div>
  `;

  missing.forEach((item, index) => {
    const key = getBirdreportTaxonKey(item);
    const isActive = key === state.activeUnlockedSpeciesKey;
    const reportCount = getBirdreportReportCount(item);
    const frequency = (reportCount / totalReportCount) * 100;
    const taxonId = String(item?.taxon_id || item?.taxonid || item?.id || "--").trim() || "--";
    const entry = document.createElement("article");
    entry.className = [
      "unlocked-species-entry",
      isActive ? "is-active" : ""
    ].filter(Boolean).join(" ");
    entry.innerHTML = `
      <button
        type="button"
        class="unlocked-species-row"
        aria-expanded="${isActive ? "true" : "false"}"
        aria-label="${isActive ? "收起" : "展开"} ${escapeHtml(item.taxonname || "未命名鸟种")} 的鸟种信息和公开地点"
      >
        <span class="unlocked-table-cell unlocked-cell-rank">${index + 1}</span>
        <span class="unlocked-table-cell unlocked-cell-code">${escapeHtml(taxonId)}</span>
        <span class="unlocked-table-cell unlocked-cell-name">
          <strong>${escapeHtml(item.taxonname || "未命名鸟种")}</strong>
          ${state.unlockedSpeciesShowMeta ? `<small>${escapeHtml(buildUnlockedSpeciesMetaLine(item))}</small>` : ""}
        </span>
        <span class="unlocked-table-cell unlocked-cell-count">${escapeHtml(reportCount.toLocaleString("zh-CN"))}</span>
        <span class="unlocked-table-cell unlocked-cell-toggle" aria-hidden="true">${isActive ? "⌃" : "⌄"}</span>
      </button>
    `;

    entry.querySelector(".unlocked-species-row")?.addEventListener("click", () => toggleUnlockedSpeciesLocations(item));

    if (isActive) {
      entry.append(
        renderUnlockedSpeciesLocationPanel(item, {
          reportCount,
          frequency
        })
      );
    }

    table.append(entry);
  });

  const scroll = document.createElement("div");
  scroll.className = "unlocked-species-scroll";
  scroll.tabIndex = 0;
  scroll.append(table);
  module.append(scroll);
  elements.unlockedSpeciesContainer.append(module);
  scroll.scrollTop = previousScrollTop;
}

function createUnlockedSpeciesModuleHeader(missingCount) {
  const header = document.createElement("div");
  header.className = "unlocked-species-module-header";
  const buttonLabel = state.unlockedSpeciesTableVisible ? "隐藏列表" : "展开列表";
  const username = String(state.unlockedTargetUsername || "").trim() || "未填写";
  header.innerHTML = `
    <div class="unlocked-species-module-title">
      <strong>全部未解锁鸟种</strong>
      <span>${escapeHtml(String(missingCount))} 种 · 记录用户：${escapeHtml(username)}</span>
    </div>
    <button type="button" class="ghost unlocked-module-toggle" aria-label="${escapeHtml(buttonLabel)}">
      ${escapeHtml(buttonLabel)}
    </button>
  `;
  header
    .querySelector(".unlocked-module-toggle")
    ?.addEventListener("click", toggleUnlockedSpeciesTableVisibility);
  return header;
}

function buildUnlockedSpeciesMetaLine(item) {
  const taxonMeta = [item?.taxonordername, item?.taxonfamilyname].filter(Boolean).join(" · ");
  return [item?.latinname, taxonMeta].filter(Boolean).join(" · ") || "点击展开查看详情";
}

function renderUnlockedSpeciesLocationPanel(species, context = {}) {
  const panel = document.createElement("div");
  panel.className = "unlocked-location-panel";
  const reportCount = Number.isFinite(context.reportCount) ? context.reportCount : getBirdreportReportCount(species);
  const frequency = Number.isFinite(context.frequency) ? context.frequency : 0;
  const summaryBlock = `
    <div class="unlocked-detail-grid">
      <div class="unlocked-detail-card">
        <strong>学名</strong>
        <span>${escapeHtml(species.latinname || "未提供学名")}</span>
      </div>
      <div class="unlocked-detail-card">
        <strong>缺口频率</strong>
        <span>${escapeHtml(frequency.toFixed(5))}%</span>
      </div>
      <div class="unlocked-detail-card">
        <strong>目 / 科</strong>
        <span>${escapeHtml(formatUnlockedSpeciesTaxonomy(species))}</span>
      </div>
      <div class="unlocked-detail-card">
        <strong>浙江历史记录</strong>
        <span>${escapeHtml(reportCount.toLocaleString("zh-CN"))}</span>
      </div>
    </div>
    <div class="unlocked-map-action">
      <button
        type="button"
        class="ghost"
        data-unlocked-map-taxon="${escapeHtml(String(species?.taxon_id || species?.taxonid || ""))}"
        data-unlocked-map-name="${escapeHtml(species?.taxonname || "该鸟种")}"
        data-unlocked-map-scientific="${escapeHtml(species?.latinname || "")}"
      >在地图查看浙江近两年地点</button>
    </div>
  `;

  if (state.unlockedSpeciesDetailLoading) {
    panel.innerHTML = `${summaryBlock}<div class="empty-state">正在按报告编号加载公开地点...</div>`;
    return panel;
  }

  if (state.unlockedSpeciesDetailError) {
    if (state.unlockedSpeciesDetailError === "captcha_required") {
      panel.innerHTML = `${summaryBlock}
        <div class="birdreport-captcha-panel">
          <strong>BirdReport 需要验证码</strong>
          <span>请输入图片里的验证码，验证通过后会自动重新加载这个鸟种的地点。</span>
          <div class="birdreport-captcha-row">
            ${
              state.unlockedSpeciesCaptchaImageUrl
                ? `<img class="birdreport-captcha-image" src="${escapeHtml(state.unlockedSpeciesCaptchaImageUrl)}" alt="BirdReport 验证码" />`
                : '<span class="empty-state">验证码加载中...</span>'
            }
            <button type="button" class="ghost birdreport-refresh-captcha-btn">换一张</button>
          </div>
          <div class="birdreport-captcha-row">
            <input class="birdreport-captcha-input" type="text" inputmode="text" maxlength="4" autocomplete="off" placeholder="输入验证码" />
            <button type="button" class="birdreport-submit-captcha-btn">${state.unlockedSpeciesCaptchaLoading ? "验证中..." : "验证并重试"}</button>
          </div>
          ${state.unlockedSpeciesCaptchaError ? `<div class="message error">${escapeHtml(state.unlockedSpeciesCaptchaError)}</div>` : ""}
        </div>
      `;
      const input = panel.querySelector(".birdreport-captcha-input");
      const submit = panel.querySelector(".birdreport-submit-captcha-btn");
      const refresh = panel.querySelector(".birdreport-refresh-captcha-btn");
      if (submit) {
        submit.disabled = state.unlockedSpeciesCaptchaLoading;
        submit.addEventListener("click", () => submitUnlockedSpeciesCaptcha(species, input?.value));
      }
      input?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          submitUnlockedSpeciesCaptcha(species, input.value);
        }
      });
      refresh?.addEventListener("click", () => refreshUnlockedSpeciesCaptcha());
      return panel;
    }

    panel.innerHTML = `${summaryBlock}<div class="empty-state">加载失败：${escapeHtml(state.unlockedSpeciesDetailError)}</div>`;
    return panel;
  }

  if (!state.unlockedSpeciesDetailRecords.length) {
    panel.innerHTML = `${summaryBlock}<div class="empty-state">BirdReport 暂时没有返回可展示的公开地点。</div>`;
    return panel;
  }

  panel.innerHTML = `
    ${summaryBlock}
    <div class="unlocked-location-title">
      <strong>${escapeHtml(species.taxonname || "未命名鸟种")} 公开地点</strong>
      <span>按记录中心活动报告默认顺序展示</span>
    </div>
    <div class="unlocked-location-list">
      ${state.unlockedSpeciesDetailRecords
        .map(
          (record) => `
            <div class="unlocked-location-item">
              <strong>${escapeHtml(record.pointName || "未提供观测地点")}</strong>
              <span>${escapeHtml(record.startTimeLabel)} 至 ${escapeHtml(record.endTimeLabel)}</span>
              <span>记录用户：${escapeHtml(record.username || "未提供")} · 数量：${escapeHtml(String(record.taxonCount ?? 0))} · 报告编号：${escapeHtml(record.serialId || "未提供")}</span>
            </div>
          `
        )
        .join("")}
    </div>
  `;
  return panel;
}

function formatUnlockedSpeciesTaxonomy(species) {
  const orderName = String(species?.taxonordername || "").trim() || "未提供目";
  const familyName = String(species?.taxonfamilyname || "").trim() || "未提供科";
  return `${orderName} · ${familyName}`;
}

async function toggleUnlockedSpeciesLocations(species) {
  const key = getBirdreportTaxonKey(species);
  if (!key || !species.taxon_id) {
    setUnlockedSpeciesMessage("这个鸟种缺少 BirdReport 鸟种编号，暂时不能查询地点。", true);
    return;
  }

  if (state.activeUnlockedSpeciesKey === key && !state.unlockedSpeciesDetailLoading) {
    clearUnlockedSpeciesDetail();
    renderUnlockedSpeciesList();
    return;
  }

  state.activeUnlockedSpeciesKey = key;
  state.unlockedSpeciesDetailRecords = [];
  state.unlockedSpeciesDetailError = "";
  state.unlockedSpeciesDetailLoading = true;
  renderUnlockedSpeciesList();
  setUnlockedSpeciesMessage(`正在按记录中心默认顺序加载 ${species.taxonname || "该鸟种"} 在浙江的公开地点...`);

  try {
    state.unlockedSpeciesDetailRecords = await fetchRecentBirdreportRecordsByTaxon(species, {
      limit: 10
    });
    state.unlockedSpeciesDetailError = "";
    setUnlockedSpeciesMessage(
      state.unlockedSpeciesDetailRecords.length
        ? `${species.taxonname || "该鸟种"} 公开地点已加载 ${state.unlockedSpeciesDetailRecords.length} 条，按活动报告默认顺序展示。`
        : `${species.taxonname || "该鸟种"} 暂时没有可展示的公开地点。`
    );
  } catch (error) {
    if (isBirdreportCaptchaError(error)) {
      state.unlockedSpeciesDetailError = "captcha_required";
      state.unlockedSpeciesCaptchaError = "";
      await refreshUnlockedSpeciesCaptcha({ silent: true });
      setUnlockedSpeciesMessage("BirdReport 要求输入验证码，验证后会自动重试地点查询。", true);
    } else {
      state.unlockedSpeciesDetailError = error.message;
      setUnlockedSpeciesMessage(`加载公开地点失败：${error.message}`, true);
    }
  } finally {
    state.unlockedSpeciesDetailLoading = false;
    renderUnlockedSpeciesList();
  }
}

async function submitUnlockedSpeciesCaptcha(species, rawCode) {
  const code = String(rawCode || "").trim();
  if (!code) {
    state.unlockedSpeciesCaptchaError = "请先输入验证码。";
    renderUnlockedSpeciesList();
    return;
  }

  state.unlockedSpeciesCaptchaLoading = true;
  state.unlockedSpeciesCaptchaError = "";
  renderUnlockedSpeciesList();

  try {
    await verifyBirdreportCaptcha(code);
    state.unlockedSpeciesCaptchaLoading = false;
    state.unlockedSpeciesCaptchaError = "";
    state.unlockedSpeciesDetailError = "";
    state.unlockedSpeciesDetailLoading = true;
    state.unlockedSpeciesDetailRecords = [];
    renderUnlockedSpeciesList();
    setUnlockedSpeciesMessage("验证码通过，正在重新加载公开地点...");

    state.unlockedSpeciesDetailRecords = await fetchRecentBirdreportRecordsByTaxon(species, {
      limit: 10
    });
    state.unlockedSpeciesDetailError = "";
    setUnlockedSpeciesMessage(
      state.unlockedSpeciesDetailRecords.length
        ? `${species.taxonname || "该鸟种"} 公开地点已加载 ${state.unlockedSpeciesDetailRecords.length} 条，按活动报告默认顺序展示。`
        : `${species.taxonname || "该鸟种"} 暂时没有可展示的公开地点。`
    );
  } catch (error) {
    state.unlockedSpeciesCaptchaLoading = false;
    state.unlockedSpeciesDetailLoading = false;
    state.unlockedSpeciesDetailError = "captcha_required";
    state.unlockedSpeciesCaptchaError = error.message;
    await refreshUnlockedSpeciesCaptcha({ silent: true });
    setUnlockedSpeciesMessage(`验证码验证失败：${error.message}`, true);
  } finally {
    state.unlockedSpeciesCaptchaLoading = false;
    state.unlockedSpeciesDetailLoading = false;
    renderUnlockedSpeciesList();
  }
}

async function refreshUnlockedSpeciesCaptcha(options = {}) {
  const { silent = false } = options;
  try {
    const imageUrl = await loadBirdreportCaptchaImage();
    if (state.unlockedSpeciesCaptchaImageUrl) {
      URL.revokeObjectURL(state.unlockedSpeciesCaptchaImageUrl);
    }
    state.unlockedSpeciesCaptchaImageUrl = imageUrl;
    if (!silent) {
      state.unlockedSpeciesCaptchaError = "";
      renderUnlockedSpeciesList();
    }
  } catch (error) {
    state.unlockedSpeciesCaptchaError = `验证码加载失败：${error.message}`;
    if (!silent) {
      renderUnlockedSpeciesList();
    }
  }
}

function clearUnlockedSpeciesDetail() {
  state.activeUnlockedSpeciesKey = null;
  state.unlockedSpeciesDetailRecords = [];
  state.unlockedSpeciesDetailLoading = false;
  state.unlockedSpeciesDetailError = "";
  if (state.unlockedSpeciesCaptchaImageUrl) {
    URL.revokeObjectURL(state.unlockedSpeciesCaptchaImageUrl);
  }
  state.unlockedSpeciesCaptchaImageUrl = "";
  state.unlockedSpeciesCaptchaLoading = false;
  state.unlockedSpeciesCaptchaError = "";
}

function clearUnlockedSpeciesResults(options = {}) {
  const { keepUsername = false } = options;
  state.unlockedSpeciesCatalog = [];
  state.unlockedObservedSpecies = [];
  state.unlockedMissingSpecies = [];
  state.unlockedTargetUsername = "";
  state.unlockedSpeciesCacheSavedAt = "";
  state.unlockedSpeciesTableVisible = true;
  clearUnlockedSpeciesDetail();
  clearUnlockedSpeciesCache();
  if (!keepUsername && elements.birdreportUnlockedUsername) {
    elements.birdreportUnlockedUsername.value = "";
  }
  renderUnlockedSpeciesPanel();
  setUnlockedSpeciesMessage("已清空未解锁鸟种查询结果。");
}

async function exportUnlockedSpeciesTable() {
  const rows = buildUnlockedSpeciesExportRows();
  if (!rows.length) {
    setUnlockedSpeciesMessage("当前没有可导出的未解锁鸟种。", true);
    return;
  }

  try {
    document.querySelector("[data-unlocked-export-overlay]")?.remove();
    document.body.classList.remove("unlocked-export-open");
    const csvContent = toCsvText([
      ["鸟类名称", "目", "科"],
      ...rows
    ]);
    const filename = buildUnlockedSpeciesExportFilename("csv");
    const locationLabel = await saveTextFile(filename, "text/csv;charset=utf-8", `\uFEFF${csvContent}`);
    setUnlockedSpeciesMessage(`未解锁鸟种表格已导出：${locationLabel || filename}`);
  } catch (error) {
    setUnlockedSpeciesMessage(`导出未解锁鸟种失败：${error.message}`, true);
  }
}

function buildUnlockedSpeciesExportRows() {
  return [...getBirdreportTaxaArray(state.unlockedMissingSpecies)]
    .sort(sortBirdreportTaxaByReportCountDesc)
    .map((item) => [
      String(item?.taxonname || item?.name || "未命名鸟种").trim() || "未命名鸟种",
      String(item?.taxonordername || "").trim() || "未提供",
      String(item?.taxonfamilyname || "").trim() || "未提供"
    ]);
}

function buildUnlockedSpeciesExportFilename(extension = "csv") {
  const username = String(state.unlockedTargetUsername || "未命名用户").trim().replace(/[\\/:*?"<>|]/g, "_");
  const stamp = formatCompactTimestamp(new Date());
  return `${username}-未解锁鸟种-${stamp}.${extension}`;
}

function setUnlockedSpeciesMessage(message, isError = false) {
  setStatusMessage(elements.unlockedSpeciesMessage, message, isError);
}

function updateUnlockedSpeciesExportButton(isLoading = false) {
  if (!elements.exportUnlockedSpeciesBtn) {
    return;
  }

  elements.exportUnlockedSpeciesBtn.disabled = isLoading;
}

function setUnlockedSpeciesLoading(isLoading) {
  if (elements.queryUnlockedSpeciesBtn) {
    elements.queryUnlockedSpeciesBtn.disabled = isLoading;
    elements.queryUnlockedSpeciesBtn.textContent = isLoading ? "查询中..." : "查询未解锁鸟种";
    setElementLoadingClass(elements.queryUnlockedSpeciesBtn, isLoading);
  }
  updateUnlockedSpeciesExportButton(isLoading);
  if (elements.clearUnlockedSpeciesBtn) {
    elements.clearUnlockedSpeciesBtn.disabled = isLoading;
  }
  if (elements.birdreportUnlockedUsername) {
    elements.birdreportUnlockedUsername.disabled = isLoading;
  }
  setElementLoadingClass(elements.unlockedSpeciesMessage, isLoading);
}

function loadUnlockedSpeciesCache() {
  try {
    const raw = safeLocalStorageGet(BIRDREPORT_UNLOCKED_SPECIES_CACHE_STORAGE, "");
    if (!raw) {
      return createEmptyUnlockedSpeciesCache();
    }

    const parsed = JSON.parse(raw);
    const cache = {
      username: String(parsed?.username || "").trim(),
      savedAt: String(parsed?.savedAt || "").trim(),
      catalog: normalizeBirdreportTaxa(parsed?.catalog),
      observed: normalizeBirdreportTaxa(parsed?.observed),
      missing: normalizeBirdreportTaxa(parsed?.missing)
    };

    if (cache.username && !cache.catalog.length) {
      return createEmptyUnlockedSpeciesCache();
    }

    if (cache.username && cache.catalog.length && !cache.observed.length && cache.missing.length >= cache.catalog.length) {
      return createEmptyUnlockedSpeciesCache();
    }

    return cache;
  } catch (error) {
    console.warn("Failed to load unlocked species cache:", error);
    return createEmptyUnlockedSpeciesCache();
  }
}

function createEmptyUnlockedSpeciesCache() {
  return {
    username: "",
    savedAt: "",
    catalog: [],
    observed: [],
    missing: []
  };
}

function saveUnlockedSpeciesCache() {
  const payload = {
    username: state.unlockedTargetUsername,
    savedAt: state.unlockedSpeciesCacheSavedAt,
    catalog: normalizeBirdreportTaxa(state.unlockedSpeciesCatalog),
    observed: normalizeBirdreportTaxa(state.unlockedObservedSpecies),
    missing: normalizeBirdreportTaxa(state.unlockedMissingSpecies)
  };
  safeLocalStorageSet(BIRDREPORT_UNLOCKED_SPECIES_CACHE_STORAGE, JSON.stringify(payload));
}

function clearUnlockedSpeciesCache() {
  safeLocalStorageRemove(BIRDREPORT_UNLOCKED_SPECIES_CACHE_STORAGE);
}

  Object.assign(runtime, {
    queryUnlockedSpeciesByUser,
    fetchZhejiangSpeciesCatalogForUnlocked,
    fetchUserZhejiangSpecies,
    buildUnlockedMissingSpecies,
    sortBirdreportTaxaByReportCountDesc,
    renderUnlockedSpeciesPanel,
    renderUnlockedSpeciesSummary,
    renderUnlockedSpeciesSummaryCard,
    toggleUnlockedSpeciesInfoVisibility,
    toggleUnlockedSpeciesTableVisibility,
    renderUnlockedSpeciesList,
    createUnlockedSpeciesModuleHeader,
    buildUnlockedSpeciesMetaLine,
    renderUnlockedSpeciesLocationPanel,
    formatUnlockedSpeciesTaxonomy,
    toggleUnlockedSpeciesLocations,
    submitUnlockedSpeciesCaptcha,
    refreshUnlockedSpeciesCaptcha,
    clearUnlockedSpeciesDetail,
    clearUnlockedSpeciesResults,
    exportUnlockedSpeciesTable,
    buildUnlockedSpeciesExportRows,
    buildUnlockedSpeciesExportFilename,
    setUnlockedSpeciesMessage,
    updateUnlockedSpeciesExportButton,
    setUnlockedSpeciesLoading,
    loadUnlockedSpeciesCache,
    createEmptyUnlockedSpeciesCache,
    saveUnlockedSpeciesCache,
    clearUnlockedSpeciesCache
  });
}
