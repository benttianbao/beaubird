// Functions extracted from the legacy script.js features/birdreport/rare-monitor domain.
export function installRareMonitor(runtime) {
  const { BIRDREPORT_RARE_SPECIES_STORAGE, BIRDREPORT_RARE_MONITOR_STORAGE, BIRDREPORT_RARE_NOTIFICATION_LOG_STORAGE, BIRDREPORT_RARE_SPECIES_PROVINCE, BIRDREPORT_RARE_SPECIES_THRESHOLD, BIRDREPORT_MONITOR_INTERVAL_MS, state, elements } = runtime;
  const canUseBirdreportProxy = (...args) => runtime.canUseBirdreportProxy(...args);
  const createBirdreportPayload = (...args) => runtime.createBirdreportPayload(...args);
  const escapeHtml = (...args) => runtime.escapeHtml(...args);
  const fetchAllBirdreportTaxa = (...args) => runtime.fetchAllBirdreportTaxa(...args);
  const fetchBirdreportRecordsByTaxon = (...args) => runtime.fetchBirdreportRecordsByTaxon(...args);
  const fetchZhejiangSpeciesBaselineFromJson = (...args) => runtime.fetchZhejiangSpeciesBaselineFromJson(...args);
  const formatDate = (...args) => runtime.formatDate(...args);
  const formatDateTime = (...args) => runtime.formatDateTime(...args);
  const formatIsoDate = (...args) => runtime.formatIsoDate(...args);
  const getBirdreportTaxonKey = (...args) => runtime.getBirdreportTaxonKey(...args);
  const normalizeDateInput = (...args) => runtime.normalizeDateInput(...args);
  const renderEmptyState = (...args) => runtime.renderEmptyState(...args);
  const safeLocalStorageGet = (...args) => runtime.safeLocalStorageGet(...args);
  const safeLocalStorageSet = (...args) => runtime.safeLocalStorageSet(...args);
  const serializeBirdreportTaxon = (...args) => runtime.serializeBirdreportTaxon(...args);
  const setElementLoadingClass = (...args) => runtime.setElementLoadingClass(...args);
  const setStatusMessage = (...args) => runtime.setStatusMessage(...args);
  const sortBirdreportTaxaByRecordCount = (...args) => runtime.sortBirdreportTaxaByRecordCount(...args);
  const toRareSpeciesHit = (...args) => runtime.toRareSpeciesHit(...args);

function hydrateZhejiangRareMonitorInputs() {
  const targetDate = formatIsoDate(new Date());
  state.zhejiangRareMonitor.targetDate = targetDate;
  if (elements.zhejiangRareMonitorDate) {
    elements.zhejiangRareMonitorDate.value = targetDate;
  }
  saveZhejiangRareMonitor(state.zhejiangRareMonitor);
}

function handleZhejiangRareMonitorDateChange() {
  const targetDate = getSelectedZhejiangRareMonitorDate();
  state.zhejiangRareMonitor.targetDate = targetDate;
  state.zhejiangRareHits = [];
  clearZhejiangRareSpeciesDetail();
  saveZhejiangRareMonitor(state.zhejiangRareMonitor);
  renderZhejiangRareSpeciesPanel();

  if (state.zhejiangRareMonitor.enabled) {
    setZhejiangRareSpeciesMessage(`监测日期已改为 ${targetDate}，后续每小时检查会按这个日期执行。`);
  } else {
    setZhejiangRareSpeciesMessage(`已选择检查日期 ${targetDate}。`);
  }
}

function initZhejiangRareSpeciesMonitor() {
  if (!state.zhejiangRareMonitor.enabled) {
    renderZhejiangRareSpeciesPanel();
    return;
  }

  startZhejiangRareMonitor({ silent: true });
}

async function initZhejiangRareSpeciesDailyQuery() {
  if (state.zhejiangRareMonitor.enabled) {
    return;
  }

  if (!state.zhejiangRareSpecies?.species?.length) {
    const saved = await saveZhejiangRareSpecies();
    if (!saved) {
      return;
    }
  }

  await checkZhejiangRareSpeciesToday({ source: "auto", notify: false });
}

function renderZhejiangRareSpeciesPanel() {
  const rareSpecies = state.zhejiangRareSpecies?.species || [];
  const monitor = state.zhejiangRareMonitor || {};
  const status = monitor.enabled ? "运行中" : "未启动";
  const targetDate = getSelectedZhejiangRareMonitorDate();
  const savedLabel = state.zhejiangRareSpecies?.savedAt ? formatDateTime(state.zhejiangRareSpecies.savedAt) : "尚未保存";
  const checkedLabel = monitor.lastCheckedAt
    ? `${formatDateTime(monitor.lastCheckedAt)}（检查 ${monitor.lastCheckedDate || targetDate}）`
    : "尚未检查";
  const hitLabel = monitor.lastHitAt ? formatDateTime(monitor.lastHitAt) : "所选日期暂无命中";
  const targetDateLabel = formatDate(targetDate);
  if (elements.zhejiangRareMonitorDate && elements.zhejiangRareMonitorDate.value !== targetDate) {
    elements.zhejiangRareMonitorDate.value = targetDate;
  }
  elements.zhejiangRareSpeciesSummary.textContent = [
    `名单 ${rareSpecies.length} 种`,
    `基线 ${BIRDREPORT_RARE_SPECIES_PROVINCE} 全历史记录次数 <= ${BIRDREPORT_RARE_SPECIES_THRESHOLD}`,
    `检查日期 ${targetDateLabel}`,
    `名单保存 ${savedLabel}`,
    `监测状态 ${status}`,
    `上次检查 ${checkedLabel}`,
    `最近命中 ${hitLabel}`
  ].join(" · ");

  elements.toggleZhejiangRareMonitorBtn.textContent = monitor.enabled ? "停止每小时监测" : "开始每小时监测";
  renderZhejiangRareSpeciesHits(targetDateLabel, state.zhejiangRareHits, rareSpecies.length > 0);
}

function renderZhejiangRareSpeciesHits(todayLabel, hits, hasBaseline) {
  elements.zhejiangRareSpeciesContainer.innerHTML = "";
  if (!hits.length) {
    clearZhejiangRareSpeciesDetail();
    renderZhejiangRareSpeciesDetail();
    const emptyText = hasBaseline
      ? `${todayLabel} 暂未发现命中的浙江稀有鸟种。`
      : `保存浙江稀有鸟种名单后，这里会显示所选日期命中的稀有鸟种。`;
    renderEmptyState(elements.zhejiangRareSpeciesContainer, "monitor", {
      title: hasBaseline ? "暂未命中稀有鸟种" : "等待检查稀有鸟种",
      description: emptyText
    });
    return;
  }

  hits.forEach((item) => {
    const isActive = item.key === state.activeZhejiangRareSpeciesKey;
    const card = document.createElement("article");
    card.className = `record${isActive ? " is-active" : ""}`;
    card.innerHTML = `
      <div>
        <strong>${escapeHtml(item.taxonname || item.name || "未命名鸟种")}</strong>
        <small>${escapeHtml(item.latinname || item.englishname || "未提供学名/英文名")}</small>
      </div>
      <div>${escapeHtml(item.taxonordername || "未提供目")} · ${escapeHtml(item.taxonfamilyname || "未提供科")}</div>
      <div><small>所选日期记录次数：${escapeHtml(String(item.targetDateRecordCount ?? 0))}</small></div>
      <div><small>历史基线记录次数：${escapeHtml(String(item.baselineRecordCount ?? 0))}</small></div>
      <div><small>${isActive ? "已展开地点详情" : "点击查看观测地点"}</small></div>
    `;
    card.addEventListener("click", () => {
      toggleZhejiangRareSpeciesDetail(item);
    });
    elements.zhejiangRareSpeciesContainer.append(card);
  });

  renderZhejiangRareSpeciesDetail();
}

async function saveZhejiangRareSpecies() {
  setZhejiangRareSpeciesLoading(true);
  setZhejiangRareSpeciesMessage(`正在读取本地 ${BIRDREPORT_RARE_SPECIES_PROVINCE} 鸟种名录...`);

  try {
    let totalSpecies = 0;
    let rareSpecies = [];
    let sourceLabel = "本地 JSON";

    try {
      const baseline = await fetchZhejiangSpeciesBaselineFromJson();
      totalSpecies = baseline.totalSpecies;
      rareSpecies = baseline.rareSpecies;
    } catch (jsonError) {
      if (!canUseBirdreportProxy(setZhejiangRareSpeciesMessage)) {
        throw new Error(`读取本地浙江鸟种名录失败：${jsonError.message}`);
      }

      sourceLabel = "BirdReport 在线查询";
      setZhejiangRareSpeciesMessage(`读取本地名录失败，正在回退到 BirdReport 在线查询：${jsonError.message}`);
      const results = await fetchAllBirdreportTaxa(createBirdreportPayload({ province: BIRDREPORT_RARE_SPECIES_PROVINCE }), {
        onProgress: (message) => setZhejiangRareSpeciesMessage(message)
      });
      totalSpecies = results.length;
      rareSpecies = sortBirdreportTaxaByRecordCount(
        results.filter((item) => (Number(item?.recordcount) || 0) <= BIRDREPORT_RARE_SPECIES_THRESHOLD)
      ).map(serializeBirdreportTaxon);
    }

    state.zhejiangRareSpecies = {
      province: BIRDREPORT_RARE_SPECIES_PROVINCE,
      threshold: BIRDREPORT_RARE_SPECIES_THRESHOLD,
      savedAt: new Date().toISOString(),
      totalSpecies,
      source: sourceLabel,
      species: rareSpecies
    };
    state.zhejiangRareHits = [];
    state.zhejiangRareNotificationLog = {};
    state.zhejiangRareMonitor.lastHitAt = "";
    clearZhejiangRareSpeciesDetail();
    saveZhejiangRareSpeciesToStorage(state.zhejiangRareSpecies);
    saveZhejiangRareNotificationLog(state.zhejiangRareNotificationLog);
    saveZhejiangRareMonitor(state.zhejiangRareMonitor);
    renderZhejiangRareSpeciesPanel();
    setZhejiangRareSpeciesMessage(`已保存 ${rareSpecies.length} 种浙江稀有鸟种，来源：${sourceLabel}。`);
    return true;
  } catch (error) {
    setZhejiangRareSpeciesMessage(`保存浙江稀有鸟种名单失败：${error.message}`, true);
    return false;
  } finally {
    setZhejiangRareSpeciesLoading(false);
  }
}

async function toggleZhejiangRareMonitor() {
  if (state.zhejiangRareMonitor.enabled) {
    stopZhejiangRareMonitor();
    return;
  }

  await startZhejiangRareMonitor();
}

async function startZhejiangRareMonitor(options = {}) {
  if (!canUseBirdreportProxy(setZhejiangRareSpeciesMessage)) {
    return false;
  }

  const { silent = false } = options;
  state.zhejiangRareMonitor.targetDate = getSelectedZhejiangRareMonitorDate();
  if (!state.zhejiangRareSpecies?.species?.length) {
    if (!silent) {
      setZhejiangRareSpeciesMessage("本地还没有浙江稀有鸟种名单，先为你生成一次。");
    }
    const saved = await saveZhejiangRareSpecies();
    if (!saved) {
      return false;
    }
  }

  await ensureBrowserNotificationPermission({ prompt: !silent });
  state.zhejiangRareMonitor.enabled = true;
  saveZhejiangRareMonitor(state.zhejiangRareMonitor);
  scheduleZhejiangRareMonitor();
  renderZhejiangRareSpeciesPanel();

  if (!silent) {
    setZhejiangRareSpeciesMessage(`已开始每小时监测浙江 ${getSelectedZhejiangRareMonitorDate()} 的 BirdReport 数据。页面保持打开时会自动检查。`);
  }

  checkZhejiangRareSpeciesToday({ source: silent ? "resume" : "start", notify: true });
  return true;
}

function stopZhejiangRareMonitor() {
  if (state.zhejiangRareMonitorTimerId) {
    window.clearInterval(state.zhejiangRareMonitorTimerId);
    state.zhejiangRareMonitorTimerId = null;
  }

  state.zhejiangRareMonitor.enabled = false;
  saveZhejiangRareMonitor(state.zhejiangRareMonitor);
  renderZhejiangRareSpeciesPanel();
  setZhejiangRareSpeciesMessage("已停止浙江稀有鸟种每小时监测。");
}

function scheduleZhejiangRareMonitor() {
  if (state.zhejiangRareMonitorTimerId) {
    window.clearInterval(state.zhejiangRareMonitorTimerId);
  }

  state.zhejiangRareMonitorTimerId = window.setInterval(() => {
    checkZhejiangRareSpeciesToday({ source: "scheduled", notify: true });
  }, BIRDREPORT_MONITOR_INTERVAL_MS);
}

async function toggleZhejiangRareSpeciesDetail(species) {
  const targetDate = getSelectedZhejiangRareMonitorDate();
  if (state.activeZhejiangRareSpeciesKey === species.key && state.zhejiangRareSpeciesDetailTargetDate === targetDate) {
    clearZhejiangRareSpeciesDetail();
    renderZhejiangRareSpeciesHits(formatDate(targetDate), state.zhejiangRareHits, Boolean(state.zhejiangRareSpecies?.species?.length));
    return;
  }

  state.activeZhejiangRareSpeciesKey = species.key;
  state.zhejiangRareSpeciesDetailTargetDate = targetDate;
  state.zhejiangRareSpeciesDetailSpecies = species;
  state.zhejiangRareSpeciesDetailRecords = [];
  state.zhejiangRareSpeciesDetailError = "";
  state.zhejiangRareSpeciesDetailLoading = true;
  renderZhejiangRareSpeciesHits(formatDate(targetDate), state.zhejiangRareHits, Boolean(state.zhejiangRareSpecies?.species?.length));
  setZhejiangRareSpeciesMessage(`正在加载 ${species.taxonname || species.name} 在 ${targetDate} 的观测地点...`);

  try {
    const records = await fetchBirdreportRecordsByTaxon(species, targetDate, {
      onProgress: (message) => setZhejiangRareSpeciesMessage(message)
    });
    state.zhejiangRareSpeciesDetailRecords = records;
    state.zhejiangRareSpeciesDetailError = "";
    setZhejiangRareSpeciesMessage(
      records.length
        ? `${species.taxonname || species.name} 在 ${targetDate} 共找到 ${records.length} 条观测记录。`
        : `${species.taxonname || species.name} 在 ${targetDate} 没有可展示的公开观测地点。`
    );
  } catch (error) {
    state.zhejiangRareSpeciesDetailError = error.message;
    setZhejiangRareSpeciesMessage(`加载观测地点失败：${error.message}`, true);
  } finally {
    state.zhejiangRareSpeciesDetailLoading = false;
    renderZhejiangRareSpeciesDetail();
  }
}

async function checkZhejiangRareSpeciesToday(options = {}) {
  const { source = "manual", notify = true } = options;
  if (!state.zhejiangRareSpecies?.species?.length) {
    setZhejiangRareSpeciesMessage("请先保存浙江稀有鸟种名单。", true);
    return [];
  }

  if (!canUseBirdreportProxy(setZhejiangRareSpeciesMessage)) {
    return [];
  }

  if (state.zhejiangRareMonitorInFlight) {
    if (source === "manual") {
      setZhejiangRareSpeciesMessage("浙江稀有鸟种检查进行中，请稍候。");
    }
    return state.zhejiangRareHits;
  }

  state.zhejiangRareMonitorInFlight = true;
  setZhejiangRareSpeciesLoading(true);
  const targetDate = getSelectedZhejiangRareMonitorDate();
  state.zhejiangRareMonitor.targetDate = targetDate;
  const sourcePrefix = source === "manual" ? "正在检查" : "正在自动检查";
  setZhejiangRareSpeciesMessage(`${sourcePrefix} ${BIRDREPORT_RARE_SPECIES_PROVINCE} ${targetDate} 的 BirdReport 数据...`);

  try {
    const results = await fetchAllBirdreportTaxa(
      createBirdreportPayload({ province: BIRDREPORT_RARE_SPECIES_PROVINCE, startTime: targetDate, endTime: targetDate }),
      {
        onProgress: (message) => setZhejiangRareSpeciesMessage(message)
      }
    );
    const rareSpeciesMap = new Map((state.zhejiangRareSpecies.species || []).map((item) => [item.key, item]));
    const hits = sortBirdreportTaxaByRecordCount(
      results
        .filter((item) => rareSpeciesMap.has(getBirdreportTaxonKey(item)))
        .map((item) => toRareSpeciesHit(item, rareSpeciesMap.get(getBirdreportTaxonKey(item))))
    );

    state.zhejiangRareHits = hits;
    state.zhejiangRareMonitor.lastCheckedAt = new Date().toISOString();
    state.zhejiangRareMonitor.lastCheckedDate = targetDate;
    if (hits.length) {
      state.zhejiangRareMonitor.lastHitAt = state.zhejiangRareMonitor.lastCheckedAt;
    }
    if (!hits.some((item) => item.key === state.activeZhejiangRareSpeciesKey) || state.zhejiangRareSpeciesDetailTargetDate !== targetDate) {
      clearZhejiangRareSpeciesDetail();
    }
    saveZhejiangRareMonitor(state.zhejiangRareMonitor);
    renderZhejiangRareSpeciesPanel();

    if (notify) {
      await notifyRareSpeciesHits(targetDate, hits, { prompt: source === "start" });
    }

    setZhejiangRareSpeciesMessage(
      hits.length
        ? `${BIRDREPORT_RARE_SPECIES_PROVINCE} ${targetDate} 命中 ${hits.length} 种稀有鸟，已更新本地记录。`
        : `${BIRDREPORT_RARE_SPECIES_PROVINCE} ${targetDate} 暂未发现命中的稀有鸟种。`
    );
    return hits;
  } catch (error) {
    setZhejiangRareSpeciesMessage(`检查浙江指定日期 BirdReport 数据失败：${error.message}`, true);
    return [];
  } finally {
    state.zhejiangRareMonitorInFlight = false;
    setZhejiangRareSpeciesLoading(false);
  }
}

async function notifyRareSpeciesHits(date, hits, options = {}) {
  const { prompt = false } = options;
  if (!hits.length) {
    return;
  }

  const hasPermission = await ensureBrowserNotificationPermission({ prompt });
  if (!hasPermission) {
    return;
  }

  const notifiedKeys = new Set(state.zhejiangRareNotificationLog[date] || []);
  const newHits = hits.filter((item) => !notifiedKeys.has(item.key));
  if (!newHits.length) {
    return;
  }

  const preview = newHits.slice(0, 3).map((item) => item.taxonname || item.name).join("、");
  const body =
    newHits.length === 1
      ? `${preview} 出现在浙江 ${date} 的 BirdReport 结果里。`
      : `${preview} 等 ${newHits.length} 种稀有鸟出现在浙江 ${date} 的 BirdReport 结果里。`;

  const notification = new Notification("浙江稀有鸟种提醒", {
    body,
    tag: `zhejiang-rare-species-${date}`,
    renotify: true
  });
  notification.onclick = () => window.focus();

  state.zhejiangRareNotificationLog[date] = [...notifiedKeys, ...newHits.map((item) => item.key)];
  saveZhejiangRareNotificationLog(state.zhejiangRareNotificationLog);
}

function renderZhejiangRareSpeciesDetail() {
  const detailTarget = elements.zhejiangRareSpeciesDetail;
  if (!detailTarget) {
    return;
  }

  const species = state.zhejiangRareSpeciesDetailSpecies;
  if (!state.activeZhejiangRareSpeciesKey || !species) {
    detailTarget.innerHTML = "";
    detailTarget.classList.add("is-hidden");
    elements.zhejiangRareSpeciesDetailBackdrop?.classList.add("is-hidden");
    document.body.classList.remove("zhejiang-rare-detail-open");
    return;
  }

  const targetDate = state.zhejiangRareSpeciesDetailTargetDate || getSelectedZhejiangRareMonitorDate();
  let content = "";
  if (state.zhejiangRareSpeciesDetailLoading) {
    content = '<div class="empty-state">正在加载观测地点...</div>';
  } else if (state.zhejiangRareSpeciesDetailError) {
    content = `<div class="empty-state">加载失败：${escapeHtml(state.zhejiangRareSpeciesDetailError)}</div>`;
  } else if (!state.zhejiangRareSpeciesDetailRecords.length) {
    content = '<div class="empty-state">当前条件下没有可展示的公开观测地点。</div>';
  } else {
    content = `
      <div class="birdreport-rare-detail-list">
        ${state.zhejiangRareSpeciesDetailRecords
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
        <h3 class="birdreport-rare-detail-title">${escapeHtml(species.taxonname || species.name || "未命名鸟种")} 的观测地点</h3>
        <p class="birdreport-rare-detail-subtitle">${escapeHtml(targetDate)} · ${escapeHtml(BIRDREPORT_RARE_SPECIES_PROVINCE)} · 点击其他卡片可切换地点列表</p>
      </div>
      <button type="button" class="ghost" id="closeZhejiangRareSpeciesDetailBtn">收起详情</button>
    </div>
    ${content}
  `;
  detailTarget.classList.remove("is-hidden");
  elements.zhejiangRareSpeciesDetailBackdrop?.classList.remove("is-hidden");
  document.body.classList.add("zhejiang-rare-detail-open");
  detailTarget.querySelector("#closeZhejiangRareSpeciesDetailBtn")?.addEventListener("click", closeZhejiangRareSpeciesDetail);
}

function clearZhejiangRareSpeciesDetail() {
  state.activeZhejiangRareSpeciesKey = null;
  state.zhejiangRareSpeciesDetailTargetDate = "";
  state.zhejiangRareSpeciesDetailSpecies = null;
  state.zhejiangRareSpeciesDetailRecords = [];
  state.zhejiangRareSpeciesDetailLoading = false;
  state.zhejiangRareSpeciesDetailError = "";
}

function closeZhejiangRareSpeciesDetail() {
  if (!state.activeZhejiangRareSpeciesKey) {
    return;
  }

  clearZhejiangRareSpeciesDetail();
  renderZhejiangRareSpeciesHits(
    formatDate(getSelectedZhejiangRareMonitorDate()),
    state.zhejiangRareHits,
    Boolean(state.zhejiangRareSpecies?.species?.length)
  );
}

async function ensureBrowserNotificationPermission(options = {}) {
  const { prompt = false } = options;
  if (!("Notification" in window)) {
    setZhejiangRareSpeciesMessage("当前浏览器不支持桌面通知，仍会继续监测并在页面内显示结果。", true);
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission === "denied") {
    setZhejiangRareSpeciesMessage("浏览器通知权限已被拒绝，仍会继续监测并在页面内显示结果。", true);
    return false;
  }

  if (!prompt) {
    return false;
  }

  const result = await Notification.requestPermission();
  if (result !== "granted") {
    setZhejiangRareSpeciesMessage("未开启浏览器通知权限，监测命中时只会在页面内显示。", true);
    return false;
  }

  return true;
}

function setZhejiangRareSpeciesLoading(isLoading) {
  elements.saveZhejiangRareSpeciesBtn.disabled = isLoading;
  elements.checkZhejiangRareSpeciesBtn.disabled = isLoading;
  elements.toggleZhejiangRareMonitorBtn.disabled = isLoading;
  elements.zhejiangRareMonitorDate.disabled = isLoading;
  elements.saveZhejiangRareSpeciesBtn.textContent = isLoading ? "处理中..." : "保存浙江稀有鸟种名单";
  elements.checkZhejiangRareSpeciesBtn.textContent = isLoading ? "检查中..." : "立即检查所选日期数据";
  setElementLoadingClass(elements.saveZhejiangRareSpeciesBtn, isLoading);
  setElementLoadingClass(elements.checkZhejiangRareSpeciesBtn, isLoading);
  setElementLoadingClass(elements.zhejiangRareSpeciesMessage, isLoading);
}

function setZhejiangRareSpeciesMessage(message, isError = false) {
  setStatusMessage(elements.zhejiangRareSpeciesMessage, message, isError);
}

function getSelectedZhejiangRareMonitorDate() {
  const selectedDate = normalizeDateInput(elements.zhejiangRareMonitorDate?.value);
  return selectedDate || normalizeDateInput(state.zhejiangRareMonitor?.targetDate) || formatIsoDate(new Date());
}

function loadZhejiangRareSpecies() {
  try {
    const raw = safeLocalStorageGet(BIRDREPORT_RARE_SPECIES_STORAGE, "");
    if (!raw) {
      return {
        province: BIRDREPORT_RARE_SPECIES_PROVINCE,
        threshold: BIRDREPORT_RARE_SPECIES_THRESHOLD,
        savedAt: "",
        source: "",
        totalSpecies: 0,
        species: []
      };
    }

    const parsed = JSON.parse(raw);
    return {
      province: parsed?.province || BIRDREPORT_RARE_SPECIES_PROVINCE,
      threshold: Number(parsed?.threshold) || BIRDREPORT_RARE_SPECIES_THRESHOLD,
      savedAt: parsed?.savedAt || "",
      source: parsed?.source || "",
      totalSpecies: Number(parsed?.totalSpecies) || 0,
      species: Array.isArray(parsed?.species)
        ? parsed.species.map(serializeBirdreportTaxon)
        : []
    };
  } catch (error) {
    console.warn("Failed to load Zhejiang rare species:", error);
    return {
      province: BIRDREPORT_RARE_SPECIES_PROVINCE,
      threshold: BIRDREPORT_RARE_SPECIES_THRESHOLD,
      savedAt: "",
      source: "",
      totalSpecies: 0,
      species: []
    };
  }
}

function saveZhejiangRareSpeciesToStorage(payload) {
  safeLocalStorageSet(BIRDREPORT_RARE_SPECIES_STORAGE, JSON.stringify(payload));
}

function loadZhejiangRareMonitor() {
  try {
    const raw = safeLocalStorageGet(BIRDREPORT_RARE_MONITOR_STORAGE, "");
    if (!raw) {
      return { enabled: false, targetDate: formatIsoDate(new Date()), lastCheckedAt: "", lastCheckedDate: "", lastHitAt: "" };
    }

    const parsed = JSON.parse(raw);
    return {
      enabled: Boolean(parsed?.enabled),
      targetDate: normalizeDateInput(parsed?.targetDate) || formatIsoDate(new Date()),
      lastCheckedAt: parsed?.lastCheckedAt || "",
      lastCheckedDate: parsed?.lastCheckedDate || "",
      lastHitAt: parsed?.lastHitAt || ""
    };
  } catch (error) {
    console.warn("Failed to load Zhejiang rare species monitor:", error);
    return { enabled: false, targetDate: formatIsoDate(new Date()), lastCheckedAt: "", lastCheckedDate: "", lastHitAt: "" };
  }
}

function saveZhejiangRareMonitor(payload) {
  safeLocalStorageSet(BIRDREPORT_RARE_MONITOR_STORAGE, JSON.stringify(payload));
}

function loadZhejiangRareNotificationLog() {
  try {
    const raw = safeLocalStorageGet(BIRDREPORT_RARE_NOTIFICATION_LOG_STORAGE, "");
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.warn("Failed to load Zhejiang rare species notification log:", error);
    return {};
  }
}

function saveZhejiangRareNotificationLog(payload) {
  safeLocalStorageSet(BIRDREPORT_RARE_NOTIFICATION_LOG_STORAGE, JSON.stringify(payload));
}

  Object.assign(runtime, {
    hydrateZhejiangRareMonitorInputs,
    handleZhejiangRareMonitorDateChange,
    initZhejiangRareSpeciesMonitor,
    initZhejiangRareSpeciesDailyQuery,
    renderZhejiangRareSpeciesPanel,
    renderZhejiangRareSpeciesHits,
    saveZhejiangRareSpecies,
    toggleZhejiangRareMonitor,
    startZhejiangRareMonitor,
    stopZhejiangRareMonitor,
    scheduleZhejiangRareMonitor,
    toggleZhejiangRareSpeciesDetail,
    checkZhejiangRareSpeciesToday,
    notifyRareSpeciesHits,
    renderZhejiangRareSpeciesDetail,
    clearZhejiangRareSpeciesDetail,
    closeZhejiangRareSpeciesDetail,
    ensureBrowserNotificationPermission,
    setZhejiangRareSpeciesLoading,
    setZhejiangRareSpeciesMessage,
    getSelectedZhejiangRareMonitorDate,
    loadZhejiangRareSpecies,
    saveZhejiangRareSpeciesToStorage,
    loadZhejiangRareMonitor,
    saveZhejiangRareMonitor,
    loadZhejiangRareNotificationLog,
    saveZhejiangRareNotificationLog
  });
}
