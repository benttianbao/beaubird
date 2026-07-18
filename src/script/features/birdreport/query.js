// Functions extracted from the legacy script.js features/birdreport/query domain.
export function installBirdreportQuery(runtime) {
  const { BIRDREPORT_SEARCH_PAGE_URL, BIRDREPORT_TAXON_PAGE_URL, BIRDREPORT_CORE, state, elements } = runtime;
  const canUseBirdreportProxy = (...args) => runtime.canUseBirdreportProxy(...args);
  const createBirdreportPayload = (...args) => runtime.createBirdreportPayload(...args);
  const encodeBase64Utf8 = (...args) => runtime.encodeBase64Utf8(...args);
  const escapeHtml = (...args) => runtime.escapeHtml(...args);
  const fetchAllBirdreportTaxa = (...args) => runtime.fetchAllBirdreportTaxa(...args);
  const fetchBirdreportRecordsForCurrentQuery = (...args) => runtime.fetchBirdreportRecordsForCurrentQuery(...args);
  const getBirdreportTaxonKey = (...args) => runtime.getBirdreportTaxonKey(...args);
  const isBirdreportCaptchaError = (...args) => runtime.isBirdreportCaptchaError(...args);
  const loadBirdreportCaptchaImage = (...args) => runtime.loadBirdreportCaptchaImage(...args);
  const normalizeDateInput = (...args) => runtime.normalizeDateInput(...args);
  const renderEmptyState = (...args) => runtime.renderEmptyState(...args);
  const setBirdreportMessage = (...args) => runtime.setBirdreportMessage(...args);
  const setElementLoadingClass = (...args) => runtime.setElementLoadingClass(...args);
  const sortBirdreportTaxaByRecordCount = (...args) => runtime.sortBirdreportTaxaByRecordCount(...args);
  const verifyBirdreportCaptcha = (...args) => runtime.verifyBirdreportCaptcha(...args);

async function queryBirdreportSpeciesByProxy() {
  const payload = buildBirdreportQueryPayload();
  if (!payload) {
    return;
  }

  if (!canUseBirdreportProxy()) {
    return;
  }

  setBirdreportLoading(true);
  setBirdreportMessage("正在查询 BirdReport 鸟种...");
  clearBirdreportSpeciesDetail();
  renderBirdreportSpeciesDetail();

  try {
    const results = await fetchAllBirdreportTaxa(payload, {
      onProgress: (message) => setBirdreportMessage(message)
    });
    state.birdreportLastQueryPayload = { ...payload };
    renderBirdreportSpeciesResults(results);
    const queryText = formatBirdreportQuerySummary(payload);
    setBirdreportMessage(`BirdReport 查询完成：${queryText} 共 ${results.length} 个鸟种。`);
  } catch (error) {
    clearBirdreportSpeciesResults();
    setBirdreportMessage(`BirdReport 查询失败：${error.message}`, true);
  } finally {
    setBirdreportLoading(false);
  }
}

function renderBirdreportSpeciesDetail() {
  const detailTarget = elements.birdreportSpeciesDetail;
  if (!detailTarget) {
    return;
  }

  const species = state.birdreportSpeciesDetailSpecies;
  if (!state.activeBirdreportSpeciesKey || !species) {
    detailTarget.innerHTML = "";
    detailTarget.classList.add("is-hidden");
    elements.birdreportSpeciesDetailBackdrop?.classList.add("is-hidden");
    document.body.classList.remove("birdreport-species-detail-open");
    return;
  }

  let content = "";
  if (state.birdreportSpeciesDetailLoading) {
    content = '<div class="empty-state">正在加载当前筛选条件下的公开地点...</div>';
  } else if (state.birdreportSpeciesDetailError === "captcha_required") {
    content = `
      <div class="birdreport-captcha-panel">
        <strong>BirdReport 需要验证码</strong>
        <span>输入图片里的验证码后，会自动继续加载这个鸟种的公开地点。</span>
        <div class="birdreport-captcha-row">
          ${
            state.birdreportSpeciesCaptchaImageUrl
              ? `<img class="birdreport-captcha-image" src="${escapeHtml(state.birdreportSpeciesCaptchaImageUrl)}" alt="BirdReport 验证码" />`
              : '<span class="empty-state">验证码加载中...</span>'
          }
          <button type="button" class="ghost birdreport-species-refresh-captcha-btn">换一张</button>
        </div>
        <div class="birdreport-captcha-row">
          <input class="birdreport-captcha-input birdreport-species-captcha-input" type="text" inputmode="text" maxlength="4" autocomplete="off" placeholder="输入验证码" />
          <button type="button" class="birdreport-species-submit-captcha-btn">${state.birdreportSpeciesCaptchaLoading ? "验证中..." : "验证并重试"}</button>
        </div>
        ${state.birdreportSpeciesCaptchaError ? `<div class="message error">${escapeHtml(state.birdreportSpeciesCaptchaError)}</div>` : ""}
      </div>
    `;
  } else if (state.birdreportSpeciesDetailError) {
    content = `<div class="empty-state">加载失败：${escapeHtml(state.birdreportSpeciesDetailError)}</div>`;
  } else if (!state.birdreportSpeciesDetailRecords.length) {
    content = '<div class="empty-state">当前筛选条件下没有可展示的公开地点。</div>';
  } else {
    content = `
      <div class="birdreport-rare-detail-list">
        ${state.birdreportSpeciesDetailRecords
          .map(
            (record) => `
              <div class="birdreport-rare-detail-item">
                <strong>${escapeHtml(record.pointName || "未提供观测地点")}</strong>
                <div class="birdreport-rare-detail-meta">
                  <span>观测时间：${escapeHtml(record.startTimeLabel)} 至 ${escapeHtml(record.endTimeLabel)}</span>
                  <span>记录数量：${escapeHtml(String(record.taxonCount ?? 0))}</span>
                  <span>记录用户：${escapeHtml(record.username || "未提供")}</span>
                  <span>报告编号：${escapeHtml(record.serialId || "未提供")}</span>
                </div>
              </div>
            `
          )
          .join("")}
      </div>
    `;
  }

  detailTarget.innerHTML = `
    <div class="birdreport-rare-detail-header">
      <div>
        <h3 class="birdreport-rare-detail-title">${escapeHtml(species.taxonname || species.name || "未命名鸟种")} 的公开地点</h3>
        <p class="birdreport-rare-detail-subtitle">${escapeHtml(formatBirdreportQuerySummary(state.birdreportLastQueryPayload || {}))} · 点击表格中的其他鸟种可快速切换</p>
      </div>
      <button type="button" class="ghost" id="closeBirdreportSpeciesDetailBtn">收起详情</button>
    </div>
    ${content}
  `;
  detailTarget.classList.remove("is-hidden");
  elements.birdreportSpeciesDetailBackdrop?.classList.remove("is-hidden");
  document.body.classList.add("birdreport-species-detail-open");
  detailTarget.querySelector("#closeBirdreportSpeciesDetailBtn")?.addEventListener("click", closeBirdreportSpeciesDetail);

  const submit = detailTarget.querySelector(".birdreport-species-submit-captcha-btn");
  const input = detailTarget.querySelector(".birdreport-species-captcha-input");
  const refresh = detailTarget.querySelector(".birdreport-species-refresh-captcha-btn");
  if (submit) {
    submit.disabled = state.birdreportSpeciesCaptchaLoading;
    submit.addEventListener("click", () => submitBirdreportSpeciesCaptcha(species, input?.value));
  }
  input?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      submitBirdreportSpeciesCaptcha(species, input.value);
    }
  });
  refresh?.addEventListener("click", () => refreshBirdreportSpeciesCaptcha());
}

async function toggleBirdreportSpeciesDetail(species) {
  const key = getBirdreportTaxonKey(species);
  if (!key) {
    setBirdreportMessage("这个鸟种缺少可用编号，暂时不能查询地点。", true);
    return;
  }

  if (!state.birdreportLastQueryPayload) {
    setBirdreportMessage("请先重新执行一次 BirdReport 查询，再查看地点。", true);
    return;
  }

  if (state.activeBirdreportSpeciesKey === key && !state.birdreportSpeciesDetailLoading) {
    closeBirdreportSpeciesDetail();
    return;
  }

  state.activeBirdreportSpeciesKey = key;
  state.birdreportSpeciesDetailSpecies = species;
  state.birdreportSpeciesDetailRecords = [];
  state.birdreportSpeciesDetailError = "";
  state.birdreportSpeciesDetailLoading = true;
  renderBirdreportSpeciesResults(state.birdreportLastResults);
  setBirdreportMessage(`正在加载 ${species.taxonname || species.name || "该鸟种"} 在当前筛选条件下的公开地点...`);

  try {
    state.birdreportSpeciesDetailRecords = await fetchBirdreportRecordsForCurrentQuery(species, state.birdreportLastQueryPayload, {
      limit: 10,
      onProgress: (message) => setBirdreportMessage(message)
    });
    state.birdreportSpeciesDetailError = "";
    setBirdreportMessage(
      state.birdreportSpeciesDetailRecords.length
        ? `${species.taxonname || species.name || "该鸟种"} 的公开地点已加载 ${state.birdreportSpeciesDetailRecords.length} 条。`
        : `${species.taxonname || species.name || "该鸟种"} 在当前筛选条件下没有可展示的公开地点。`
    );
  } catch (error) {
    if (isBirdreportCaptchaError(error)) {
      state.birdreportSpeciesDetailError = "captcha_required";
      state.birdreportSpeciesCaptchaError = "";
      await refreshBirdreportSpeciesCaptcha({ silent: true });
      setBirdreportMessage("BirdReport 要求输入验证码，验证后会自动重试地点查询。", true);
    } else {
      state.birdreportSpeciesDetailError = error.message;
      setBirdreportMessage(`加载公开地点失败：${error.message}`, true);
    }
  } finally {
    state.birdreportSpeciesDetailLoading = false;
    renderBirdreportSpeciesResults(state.birdreportLastResults);
  }
}

async function submitBirdreportSpeciesCaptcha(species, rawCode) {
  const code = String(rawCode || "").trim();
  if (!code) {
    state.birdreportSpeciesCaptchaError = "请先输入验证码。";
    renderBirdreportSpeciesDetail();
    return;
  }

  state.birdreportSpeciesCaptchaLoading = true;
  state.birdreportSpeciesCaptchaError = "";
  renderBirdreportSpeciesDetail();

  try {
    await verifyBirdreportCaptcha(code);
    state.birdreportSpeciesCaptchaLoading = false;
    state.birdreportSpeciesCaptchaError = "";
    state.birdreportSpeciesDetailError = "";
    state.birdreportSpeciesDetailLoading = true;
    state.birdreportSpeciesDetailRecords = [];
    renderBirdreportSpeciesResults(state.birdreportLastResults);
    setBirdreportMessage("验证码通过，正在重新加载公开地点...");

    state.birdreportSpeciesDetailRecords = await fetchBirdreportRecordsForCurrentQuery(species, state.birdreportLastQueryPayload, {
      limit: 10,
      onProgress: (message) => setBirdreportMessage(message)
    });
    state.birdreportSpeciesDetailError = "";
    setBirdreportMessage(
      state.birdreportSpeciesDetailRecords.length
        ? `${species.taxonname || species.name || "该鸟种"} 的公开地点已加载 ${state.birdreportSpeciesDetailRecords.length} 条。`
        : `${species.taxonname || species.name || "该鸟种"} 在当前筛选条件下没有可展示的公开地点。`
    );
  } catch (error) {
    state.birdreportSpeciesCaptchaLoading = false;
    state.birdreportSpeciesDetailLoading = false;
    state.birdreportSpeciesDetailError = "captcha_required";
    state.birdreportSpeciesCaptchaError = error.message;
    await refreshBirdreportSpeciesCaptcha({ silent: true });
    setBirdreportMessage(`验证码验证失败：${error.message}`, true);
  } finally {
    state.birdreportSpeciesCaptchaLoading = false;
    state.birdreportSpeciesDetailLoading = false;
    renderBirdreportSpeciesResults(state.birdreportLastResults);
  }
}

async function refreshBirdreportSpeciesCaptcha(options = {}) {
  const { silent = false } = options;
  try {
    const imageUrl = await loadBirdreportCaptchaImage();
    if (state.birdreportSpeciesCaptchaImageUrl) {
      URL.revokeObjectURL(state.birdreportSpeciesCaptchaImageUrl);
    }
    state.birdreportSpeciesCaptchaImageUrl = imageUrl;
    if (!silent) {
      state.birdreportSpeciesCaptchaError = "";
      renderBirdreportSpeciesDetail();
    }
  } catch (error) {
    state.birdreportSpeciesCaptchaError = `验证码加载失败：${error.message}`;
    if (!silent) {
      renderBirdreportSpeciesDetail();
    }
  }
}

function clearBirdreportSpeciesDetail() {
  state.activeBirdreportSpeciesKey = null;
  state.birdreportSpeciesDetailSpecies = null;
  state.birdreportSpeciesDetailRecords = [];
  state.birdreportSpeciesDetailLoading = false;
  state.birdreportSpeciesDetailError = "";
  if (state.birdreportSpeciesCaptchaImageUrl) {
    URL.revokeObjectURL(state.birdreportSpeciesCaptchaImageUrl);
  }
  state.birdreportSpeciesCaptchaImageUrl = "";
  state.birdreportSpeciesCaptchaLoading = false;
  state.birdreportSpeciesCaptchaError = "";
}

function closeBirdreportSpeciesDetail() {
  if (!state.activeBirdreportSpeciesKey) {
    return;
  }

  clearBirdreportSpeciesDetail();
  renderBirdreportSpeciesResults(state.birdreportLastResults);
}

function renderBirdreportSpeciesResults(results) {
  elements.birdreportSpeciesContainer.innerHTML = "";
  if (!results.length) {
    state.birdreportLastResults = [];
    clearBirdreportSpeciesDetail();
    renderBirdreportSpeciesDetail();
    elements.birdreportSpeciesSummary.textContent = "当前条件下没有查到鸟种。";
    renderEmptyState(elements.birdreportSpeciesContainer, "birdreport", {
      title: "当前条件暂无鸟种",
      description: "调整时间、地区或观测地点后可以重新查询。"
    });
    return;
  }

  const sortedResults = sortBirdreportTaxaByRecordCount(results);
  state.birdreportLastResults = sortedResults;
  if (!sortedResults.some((item) => getBirdreportTaxonKey(item) === state.activeBirdreportSpeciesKey)) {
    clearBirdreportSpeciesDetail();
  }

  elements.birdreportSpeciesSummary.textContent = `当前查询返回 ${sortedResults.length} 个鸟种，已按记录次数升序排列。点击鸟种名称可以查看当前筛选条件下的公开地点。`;
  elements.birdreportSpeciesContainer.innerHTML = `
    <div class="result-table" style="--table-columns: 72px minmax(240px, 1.55fr) minmax(210px, 1.35fr) 120px 116px;">
      <div class="result-table-header">
        <div class="result-table-cell">序号</div>
        <div class="result-table-cell">鸟种</div>
        <div class="result-table-cell">分类</div>
        <div class="result-table-cell">记录数</div>
        <div class="result-table-cell">地点</div>
      </div>
      <div class="result-table-body">
        ${sortedResults
          .map((item, index) => {
            const key = getBirdreportTaxonKey(item);
            const isActive = key && key === state.activeBirdreportSpeciesKey;
            const isLoading = isActive && state.birdreportSpeciesDetailLoading;
            return `
              <div class="result-table-row${isActive ? " is-active" : ""}">
                <div class="result-table-cell result-table-index">${sortedResults.length - index}</div>
                <div class="result-table-cell">
                  <button
                    type="button"
                    class="result-table-name-btn"
                    data-birdreport-species-key="${escapeHtml(key)}"
                    ${key ? "" : "disabled"}
                    aria-pressed="${isActive ? "true" : "false"}"
                  >
                    <strong>${escapeHtml(item.taxonname || item.name || "未命名鸟种")}</strong>
                    <span class="result-table-meta">${escapeHtml(item.latinname || item.englishname || "未提供学名/英文名")}</span>
                  </button>
                </div>
                <div class="result-table-cell result-table-location">${escapeHtml(item.taxonordername || "未提供目")} · ${escapeHtml(item.taxonfamilyname || "未提供科")}</div>
                <div class="result-table-cell result-table-count">${escapeHtml((Number(item.recordcount) || 0).toLocaleString("zh-CN"))}</div>
                <div class="result-table-cell result-table-status">${!key ? "不可用" : isLoading ? "加载中..." : isActive ? "已展开" : "查看地点"}</div>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
  elements.birdreportSpeciesContainer.querySelectorAll("[data-birdreport-species-key]").forEach((button) => {
    button.addEventListener("click", () => {
      const species = state.birdreportLastResults.find((item) => getBirdreportTaxonKey(item) === button.dataset.birdreportSpeciesKey);
      if (species) {
        toggleBirdreportSpeciesDetail(species);
      }
    });
  });
  renderBirdreportSpeciesDetail();
}

function clearBirdreportSpeciesResults() {
  state.birdreportLastQueryPayload = null;
  state.birdreportLastResults = [];
  clearBirdreportSpeciesDetail();
  elements.birdreportSpeciesSummary.textContent = "";
  elements.birdreportSpeciesContainer.innerHTML = "";
  renderBirdreportSpeciesDetail();
}

function setBirdreportLoading(isLoading) {
  elements.queryBirdreportProxyBtn.disabled = isLoading;
  elements.openBirdreportTaxonBtn.disabled = isLoading;
  elements.openBirdreportSearchBtn.disabled = isLoading;
  elements.queryBirdreportProxyBtn.textContent = isLoading ? "查询中..." : "查询鸟种";
  setElementLoadingClass(elements.queryBirdreportProxyBtn, isLoading);
  setElementLoadingClass(elements.birdreportMessage, isLoading);
}

function openExternalUrl(url) {
  if (window.BeauBirdAndroid && typeof window.BeauBirdAndroid.openExternal === "function") {
    window.BeauBirdAndroid.openExternal(url);
    return;
  }

  window.open(url, "_blank", "noopener");
}

function openBirdreportTaxonPage() {
  const payload = buildBirdreportQueryPayload();
  if (!payload) {
    return;
  }

  const url = `${BIRDREPORT_TAXON_PAGE_URL}?search=${encodeURIComponent(encodeBase64Utf8(JSON.stringify(payload)))}`;
  openExternalUrl(url);
  setBirdreportMessage("已打开 BirdReport 鸟种结果页。");
}

function openBirdreportSearchPage() {
  const payload = buildBirdreportQueryPayload();
  if (!payload) {
    return;
  }

  const url = new URL(BIRDREPORT_SEARCH_PAGE_URL);
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== "") {
      url.searchParams.set(key, value);
    }
  });
  openExternalUrl(url.toString());
  setBirdreportMessage("已打开 BirdReport 查询页，并带入当前筛选条件。");
}

function buildBirdreportQueryPayload() {
  const startTime = normalizeDateInput(elements.birdreportStartDate.value);
  const endTime = normalizeDateInput(elements.birdreportEndDate.value);
  const province = String(elements.birdreportProvince.value || "").trim();
  const city = String(elements.birdreportCity.value || "").trim();
  const district = String(elements.birdreportDistrict.value || "").trim();
  const pointname = String(elements.birdreportPointName?.value || "").trim();

  if (![startTime, endTime, province, city, district, pointname].some(Boolean)) {
    setBirdreportMessage("请先选择区域、填写观测地点，或设置日期范围。", true);
    (elements.birdreportPointName || elements.birdreportProvince).focus();
    return null;
  }

  if (startTime && endTime && startTime > endTime) {
    setBirdreportMessage("开始日期不能晚于结束日期。", true);
    elements.birdreportStartDate.focus();
    return null;
  }

  return createBirdreportPayload({ startTime, endTime, province, city, district, pointname });
}

function formatBirdreportQuerySummary(payload) {
  return BIRDREPORT_CORE.formatBirdreportQuerySummary(payload);
}

function normalizeBirdreportAdministrativeArea(payload) {
  return BIRDREPORT_CORE.normalizeBirdreportAdministrativeArea(payload);
}

  Object.assign(runtime, {
    queryBirdreportSpeciesByProxy,
    renderBirdreportSpeciesDetail,
    toggleBirdreportSpeciesDetail,
    submitBirdreportSpeciesCaptcha,
    refreshBirdreportSpeciesCaptcha,
    clearBirdreportSpeciesDetail,
    closeBirdreportSpeciesDetail,
    renderBirdreportSpeciesResults,
    clearBirdreportSpeciesResults,
    setBirdreportLoading,
    openExternalUrl,
    openBirdreportTaxonPage,
    openBirdreportSearchPage,
    buildBirdreportQueryPayload,
    formatBirdreportQuerySummary,
    normalizeBirdreportAdministrativeArea
  });
}
