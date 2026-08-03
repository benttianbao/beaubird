// Functions extracted from the legacy script.js app/bootstrap domain.
export function installBootstrap(runtime) {
  const { SAMPLE_RECORDS, state, elements } = runtime;
  const analyzeEbirdSeasonalPrediction = (...args) => runtime.analyzeEbirdSeasonalPrediction(...args);
  const applyRuntimeEnvironment = (...args) => runtime.applyRuntimeEnvironment(...args);
  const checkZhejiangRareSpeciesToday = (...args) => runtime.checkZhejiangRareSpeciesToday(...args);
  const clearBirdPrepSpeciesResults = (...args) => runtime.clearBirdPrepSpeciesResults(...args);
  const clearBirdPrepSpeciesSelection = (...args) => runtime.clearBirdPrepSpeciesSelection(...args);
  const clearBirdreportSpeciesResults = (...args) => runtime.clearBirdreportSpeciesResults(...args);
  const clearEbirdApiKey = (...args) => runtime.clearEbirdApiKey(...args);
  const clearEbirdSeasonalCache = (...args) => runtime.clearEbirdSeasonalCache(...args);
  const clearUnlockedSpeciesResults = (...args) => runtime.clearUnlockedSpeciesResults(...args);
  const closeBirdreportSpeciesDetail = (...args) => runtime.closeBirdreportSpeciesDetail(...args);
  const closeRegionQueryDetail = (...args) => runtime.closeRegionQueryDetail(...args);
  const closeZhejiangRareSpeciesDetail = (...args) => runtime.closeZhejiangRareSpeciesDetail(...args);
  const exportUnlockedSpeciesTable = (...args) => runtime.exportUnlockedSpeciesTable(...args);
  const generateBirdPrepPpt = (...args) => runtime.generateBirdPrepPpt(...args);
  const handleBirdPrepCityChange = (...args) => runtime.handleBirdPrepCityChange(...args);
  const handleBirdPrepProvinceChange = (...args) => runtime.handleBirdPrepProvinceChange(...args);
  const handleBirdPrepSpeciesSelectionChange = (...args) => runtime.handleBirdPrepSpeciesSelectionChange(...args);
  const handleBirdreportCityChange = (...args) => runtime.handleBirdreportCityChange(...args);
  const handleBirdreportProvinceChange = (...args) => runtime.handleBirdreportProvinceChange(...args);
  const handleQuickNavClick = (...args) => runtime.handleQuickNavClick(...args);
  const handleZhejiangRareMonitorDateChange = (...args) => runtime.handleZhejiangRareMonitorDateChange(...args);
  const hydrateEbirdInputs = (...args) => runtime.hydrateEbirdInputs(...args);
  const hydrateEbirdSeasonalInputs = (...args) => runtime.hydrateEbirdSeasonalInputs(...args);
  const hydrateZhejiangRareMonitorInputs = (...args) => runtime.hydrateZhejiangRareMonitorInputs(...args);
  const importText = (...args) => runtime.importText(...args);
  const initBirdreportProxy = (...args) => runtime.initBirdreportProxy(...args);
  const initEmbeddedAndroidQuickNav = (...args) => runtime.initEmbeddedAndroidQuickNav(...args);
  const initBirdMap = (...args) => runtime.initBirdMap(...args);
  const initZhejiangRareSpeciesDailyQuery = (...args) => runtime.initZhejiangRareSpeciesDailyQuery(...args);
  const initZhejiangRareSpeciesMonitor = (...args) => runtime.initZhejiangRareSpeciesMonitor(...args);
  const isEmbeddedAndroidApp = (...args) => runtime.isEmbeddedAndroidApp(...args);
  const lockEmbeddedAndroidViewport = (...args) => runtime.lockEmbeddedAndroidViewport(...args);
  const normalizeRecords = (...args) => runtime.normalizeRecords(...args);
  const openBirdreportSearchPage = (...args) => runtime.openBirdreportSearchPage(...args);
  const openBirdreportTaxonPage = (...args) => runtime.openBirdreportTaxonPage(...args);
  const persistAndRender = (...args) => runtime.persistAndRender(...args);
  const persistEbirdSeasonalSettings = (...args) => runtime.persistEbirdSeasonalSettings(...args);
  const persistEbirdSettings = (...args) => runtime.persistEbirdSettings(...args);
  const queryBirdPrepSpecies = (...args) => runtime.queryBirdPrepSpecies(...args);
  const queryBirdreportSpeciesByProxy = (...args) => runtime.queryBirdreportSpeciesByProxy(...args);
  const queryUnlockedSpeciesByUser = (...args) => runtime.queryUnlockedSpeciesByUser(...args);
  const render = (...args) => runtime.render(...args);
  const renderBirdPrepSpeciesOptions = (...args) => runtime.renderBirdPrepSpeciesOptions(...args);
  const renderEbirdSeasonalPrediction = (...args) => runtime.renderEbirdSeasonalPrediction(...args);
  const renderLifeList = (...args) => runtime.renderLifeList(...args);
  const renderMap = (...args) => runtime.renderMap(...args);
  const renderRecordsOnly = (...args) => runtime.renderRecordsOnly(...args);
  const renderRegionQueryResults = (...args) => runtime.renderRegionQueryResults(...args);
  const renderSpeciesDiscovery = (...args) => runtime.renderSpeciesDiscovery(...args);
  const renderUnlockedSpeciesPanel = (...args) => runtime.renderUnlockedSpeciesPanel(...args);
  const renderZhejiangRareSpeciesPanel = (...args) => runtime.renderZhejiangRareSpeciesPanel(...args);
  const savePersonalRecords = (...args) => runtime.savePersonalRecords(...args);
  const saveZhejiangRareSpecies = (...args) => runtime.saveZhejiangRareSpecies(...args);
  const selectAllVisibleBirdPrepSpecies = (...args) => runtime.selectAllVisibleBirdPrepSpecies(...args);
  const setBirdPrepMessage = (...args) => runtime.setBirdPrepMessage(...args);
  const setBirdreportMessage = (...args) => runtime.setBirdreportMessage(...args);
  const setEbirdMessage = (...args) => runtime.setEbirdMessage(...args);
  const setEbirdSeasonalMessage = (...args) => runtime.setEbirdSeasonalMessage(...args);
  const setMessage = (...args) => runtime.setMessage(...args);
  const setUnlockedSpeciesMessage = (...args) => runtime.setUnlockedSpeciesMessage(...args);
  const setZhejiangRareSpeciesMessage = (...args) => runtime.setZhejiangRareSpeciesMessage(...args);
  const syncBirdPrepMacaulayOptions = (...args) => runtime.syncBirdPrepMacaulayOptions(...args);
  const syncEbirdRecords = (...args) => runtime.syncEbirdRecords(...args);
  const toggleZhejiangRareMonitor = (...args) => runtime.toggleZhejiangRareMonitor(...args);
  const updateBirdPrepPptButton = (...args) => runtime.updateBirdPrepPptButton(...args);

function bootstrap() {
  applyRuntimeEnvironment();
  lockEmbeddedAndroidViewport();
  hydrateEbirdInputs();
  hydrateEbirdSeasonalInputs();
  hydrateZhejiangRareMonitorInputs();
  bindEvents();
  syncBirdPrepMacaulayOptions();
  initBirdreportProxy();
  initEmbeddedAndroidQuickNav();
  initBirdMap();
  renderRegionQueryResults();
  renderEbirdSeasonalPrediction();
  renderZhejiangRareSpeciesPanel();
  renderUnlockedSpeciesPanel();
  setEbirdMessage("填入 API 密钥和区域代码后，可以查询 eBird 区域最近观测。查询结果不会保存到个人记录。");
  setEbirdSeasonalMessage("选择目标日期后，可按浙江多年同期历史记录分析当季可能出现鸟种。");
  setBirdreportMessage("选择时间和省 / 市 / 区后，可以查询 BirdReport 鸟种。");
  setBirdPrepMessage(
    isEmbeddedAndroidApp()
      ? "APK 版暂不支持保存 PPTX；网页版可查询地区鸟种并生成预习 PPT。"
      : "选择省份和城市后查询地区鸟种，再多选鸟种生成预习 PPT。"
  );
  updateBirdPrepPptButton();
  if (elements.birdreportUnlockedUsername && state.unlockedTargetUsername) {
    elements.birdreportUnlockedUsername.value = state.unlockedTargetUsername;
  }
  setUnlockedSpeciesMessage(
    state.unlockedTargetUsername
      ? `已恢复 ${state.unlockedTargetUsername} 的未解锁鸟种缓存；重新查询会刷新记录。`
      : "输入记录用户姓名后，可以核对该用户在浙江名录里还缺哪些鸟种。"
  );
  if (state.zhejiangRareMonitor.enabled) {
    setZhejiangRareSpeciesMessage("浙江稀有鸟种监测已恢复运行，页面保持打开时会继续每小时检查。");
  } else {
    setZhejiangRareSpeciesMessage("");
  }
  initZhejiangRareSpeciesMonitor();
  initZhejiangRareSpeciesDailyQuery();
}

function bindIfPresent(element, eventName, handler) {
  element?.addEventListener(eventName, handler);
}

function bindEvents() {
  bindIfPresent(elements.importPasteBtn, "click", () => {
    importText(elements.pasteInput.value, "粘贴内容");
  });

  bindIfPresent(elements.loadSampleBtn, "click", () => {
    state.personalRecords = normalizeRecords(SAMPLE_RECORDS);
    persistAndRender();
    setMessage(`已加载 ${state.personalRecords.length} 条示例记录。`);
  });

  bindIfPresent(elements.clearAllBtn, "click", () => {
    state.personalRecords = [];
    savePersonalRecords(state.personalRecords);
    render();
    setMessage("已清空全部个人记录。");
  });

  bindIfPresent(elements.fileInput, "change", async (event) => {
    const [file] = event.target.files || [];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      importText(text, `文件 ${file.name}`);
    } catch (error) {
      setMessage(`读取文件失败：${error.message}`, true);
    } finally {
      elements.fileInput.value = "";
    }
  });

  bindIfPresent(elements.syncEbirdBtn, "click", syncEbirdRecords);
  bindIfPresent(elements.clearEbirdKeyBtn, "click", clearEbirdApiKey);
  bindIfPresent(elements.ebirdApiKey, "change", persistEbirdSettings);
  bindIfPresent(elements.ebirdRegionCode, "change", persistEbirdSettings);
  bindIfPresent(elements.ebirdBackDays, "change", persistEbirdSettings);
  bindIfPresent(elements.analyzeEbirdSeasonalBtn, "click", analyzeEbirdSeasonalPrediction);
  bindIfPresent(elements.clearEbirdSeasonalCacheBtn, "click", clearEbirdSeasonalCache);
  bindIfPresent(elements.ebirdSeasonalDate, "change", persistEbirdSeasonalSettings);
  bindIfPresent(elements.ebirdSeasonalYears, "change", persistEbirdSeasonalSettings);
  bindIfPresent(elements.ebirdSeasonalWindow, "change", persistEbirdSeasonalSettings);
  bindIfPresent(elements.birdreportStartDate, "change", clearBirdreportSpeciesResults);
  bindIfPresent(elements.birdreportEndDate, "change", clearBirdreportSpeciesResults);
  bindIfPresent(elements.birdreportProvince, "change", handleBirdreportProvinceChange);
  bindIfPresent(elements.birdreportCity, "change", handleBirdreportCityChange);
  bindIfPresent(elements.birdreportDistrict, "change", clearBirdreportSpeciesResults);
  bindIfPresent(elements.birdreportPointName, "input", clearBirdreportSpeciesResults);
  bindIfPresent(elements.queryBirdreportProxyBtn, "click", queryBirdreportSpeciesByProxy);
  bindIfPresent(elements.openBirdreportTaxonBtn, "click", openBirdreportTaxonPage);
  bindIfPresent(elements.openBirdreportSearchBtn, "click", openBirdreportSearchPage);
  bindIfPresent(elements.queryUnlockedSpeciesBtn, "click", queryUnlockedSpeciesByUser);
  bindIfPresent(elements.exportUnlockedSpeciesBtn, "click", exportUnlockedSpeciesTable);
  bindIfPresent(elements.clearUnlockedSpeciesBtn, "click", clearUnlockedSpeciesResults);
  bindIfPresent(elements.birdreportUnlockedUsername, "keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      queryUnlockedSpeciesByUser();
    }
  });
  bindIfPresent(elements.saveZhejiangRareSpeciesBtn, "click", saveZhejiangRareSpecies);
  bindIfPresent(elements.checkZhejiangRareSpeciesBtn, "click", () => {
    checkZhejiangRareSpeciesToday({ source: "manual", notify: true });
  });
  bindIfPresent(elements.toggleZhejiangRareMonitorBtn, "click", toggleZhejiangRareMonitor);
  bindIfPresent(elements.zhejiangRareMonitorDate, "change", handleZhejiangRareMonitorDateChange);
  bindIfPresent(elements.speciesFilter, "change", renderRecordsOnly);
  bindIfPresent(elements.sortOrder, "change", renderRecordsOnly);
  bindIfPresent(elements.viewMode, "change", renderRecordsOnly);
  bindIfPresent(elements.lifeRegionFilter, "input", renderLifeList);
  bindIfPresent(elements.lifeBackDays, "input", renderLifeList);
  bindIfPresent(elements.speciesDiscoveryRegion, "input", renderSpeciesDiscovery);
  bindIfPresent(elements.speciesDiscoveryStart, "change", renderSpeciesDiscovery);
  bindIfPresent(elements.speciesDiscoveryEnd, "change", renderSpeciesDiscovery);
  bindIfPresent(elements.heatMetric, "change", renderMap);
  bindIfPresent(elements.regionQueryBackdrop, "click", closeRegionQueryDetail);
  bindIfPresent(elements.birdreportSpeciesDetailBackdrop, "click", closeBirdreportSpeciesDetail);
  bindIfPresent(elements.zhejiangRareSpeciesDetailBackdrop, "click", closeZhejiangRareSpeciesDetail);
  bindIfPresent(elements.birdPrepProvince, "change", handleBirdPrepProvinceChange);
  bindIfPresent(elements.birdPrepCity, "change", handleBirdPrepCityChange);
  bindIfPresent(elements.birdPrepDistrict, "change", clearBirdPrepSpeciesResults);
  bindIfPresent(elements.birdPrepPointName, "input", clearBirdPrepSpeciesResults);
  bindIfPresent(elements.birdPrepUnlockedUsername, "input", clearBirdPrepSpeciesResults);
  bindIfPresent(elements.birdPrepStartDate, "change", clearBirdPrepSpeciesResults);
  bindIfPresent(elements.birdPrepEndDate, "change", clearBirdPrepSpeciesResults);
  bindIfPresent(elements.birdPrepMacaulayImages, "change", syncBirdPrepMacaulayOptions);
  bindIfPresent(elements.queryBirdPrepSpeciesBtn, "click", queryBirdPrepSpecies);
  bindIfPresent(elements.birdPrepSpeciesSearch, "input", renderBirdPrepSpeciesOptions);
  bindIfPresent(elements.birdPrepSpeciesOptions, "change", handleBirdPrepSpeciesSelectionChange);
  bindIfPresent(elements.selectAllBirdPrepSpeciesBtn, "click", selectAllVisibleBirdPrepSpecies);
  bindIfPresent(elements.clearBirdPrepSpeciesBtn, "click", clearBirdPrepSpeciesSelection);
  bindIfPresent(elements.generateBirdPrepPptBtn, "click", generateBirdPrepPpt);
  document.addEventListener("keydown", handleRegionQueryDetailHotkeys);
  document.querySelectorAll(".app-quicknav-btn").forEach((button) => {
    button.addEventListener("click", handleQuickNavClick);
  });
}

function handleRegionQueryDetailHotkeys(event) {
  if (event.key !== "Escape") {
    return;
  }

  if (state.activeRegionRecordId) {
    closeRegionQueryDetail();
  }

  if (state.activeBirdreportSpeciesKey) {
    closeBirdreportSpeciesDetail();
  }

  if (state.activeZhejiangRareSpeciesKey) {
    closeZhejiangRareSpeciesDetail();
  }

  if (state.activeEbirdSeasonalSpeciesCode) {
    state.activeEbirdSeasonalSpeciesCode = "";
    renderEbirdSeasonalPrediction();
  }
}

  Object.assign(runtime, {
    bootstrap,
    bindIfPresent,
    bindEvents,
    handleRegionQueryDetailHotkeys
  });
}
