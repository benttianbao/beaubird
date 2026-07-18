// Functions extracted from the legacy script.js features/bird-prep/workflow domain.
export function installBirdPrepWorkflow(runtime) {
  const { BIRDREPORT_CORE, state, elements } = runtime;
  const canUseBirdreportProxy = (...args) => runtime.canUseBirdreportProxy(...args);
  const createBirdreportPayload = (...args) => runtime.createBirdreportPayload(...args);
  const fetchAllBirdreportTaxa = (...args) => runtime.fetchAllBirdreportTaxa(...args);
  const getBirdreportTaxaArray = (...args) => runtime.getBirdreportTaxaArray(...args);
  const getBirdreportTaxonKey = (...args) => runtime.getBirdreportTaxonKey(...args);
  const isEmbeddedAndroidApp = (...args) => runtime.isEmbeddedAndroidApp(...args);
  const loadBirdPrepMacaulayPhotos = (...args) => runtime.loadBirdPrepMacaulayPhotos(...args);
  const loadBirdPrepProfileIndexForSpecies = (...args) => runtime.loadBirdPrepProfileIndexForSpecies(...args);
  const normalizeBirdreportTaxa = (...args) => runtime.normalizeBirdreportTaxa(...args);
  const normalizeDateInput = (...args) => runtime.normalizeDateInput(...args);
  const renderEmptyState = (...args) => runtime.renderEmptyState(...args);
  const setBirdPrepMessage = (...args) => runtime.setBirdPrepMessage(...args);
  const setElementLoadingClass = (...args) => runtime.setElementLoadingClass(...args);
  const shouldUseBirdPrepMacaulayImages = (...args) => runtime.shouldUseBirdPrepMacaulayImages(...args);
  const sortBirdreportTaxaByRecordCountDesc = (...args) => runtime.sortBirdreportTaxaByRecordCountDesc(...args);
  const triggerFileDownload = (...args) => runtime.triggerFileDownload(...args);

async function queryBirdPrepSpecies() {
  const payload = buildBirdPrepQueryPayload();
  if (!payload) {
    return;
  }

  if (!canUseBirdreportProxy(setBirdPrepMessage)) {
    return;
  }

  setBirdPrepLoading(true);
  setBirdPrepMessage("正在通过 BirdReport 查询地区鸟种...");
  state.birdPrepSpeciesResults = [];
  state.birdPrepSelectedSpeciesKeys.clear();
  state.birdPrepLastQueryPayload = null;
  state.birdPrepUnlockedFilterUsername = "";
  state.birdPrepUnlockedFilteredCount = 0;
  state.birdPrepUnlockedFilterWarning = "";
  renderBirdPrepSpeciesOptions();

  try {
    const username = getBirdPrepUnlockedUsername();
    let unlockedLookup = null;
    let unlockedWarning = "";
    if (username) {
      try {
        const unlockedSpecies = await getBirdPrepUnlockedSpeciesForUser(username, {
          onProgress: (message) => setBirdPrepMessage(message)
        });
        if (unlockedSpecies.length) {
          unlockedLookup = buildBirdPrepUnlockedTaxonLookup(unlockedSpecies);
          state.birdPrepUnlockedFilterUsername = username;
        } else {
          unlockedWarning = `没有查到「${username}」的全国已解锁鸟种，当前列表未过滤。`;
        }
      } catch (filterError) {
        console.warn("Failed to filter BirdPrep species by unlocked user:", filterError);
        unlockedWarning = `记录用户「${username}」已解锁鸟种查询失败：${filterError.message}，当前列表未过滤。`;
      }
    }

    setBirdPrepMessage("正在通过 BirdReport 查询地区鸟种...");
    const results = await fetchAllBirdreportTaxa(payload, {
      onProgress: (message) => setBirdPrepMessage(message)
    });
    const filterResult = unlockedLookup
      ? filterBirdPrepSpeciesByUnlocked(results, unlockedLookup)
      : { species: results, removedCount: 0 };
    const sortedResults = sortBirdreportTaxaByRecordCountDesc(filterResult.species);
    state.birdPrepSpeciesResults = sortedResults;
    state.birdPrepLastQueryPayload = { ...payload };
    state.birdPrepUnlockedFilteredCount = filterResult.removedCount;
    state.birdPrepUnlockedFilterWarning = unlockedWarning;
    if (elements.birdPrepSpeciesSearch) {
      elements.birdPrepSpeciesSearch.value = "";
    }
    renderBirdPrepSpeciesOptions();
    setBirdPrepMessage(formatBirdPrepQueryCompleteMessage(payload, results.length, sortedResults.length, username, filterResult.removedCount, unlockedWarning));
  } catch (error) {
    clearBirdPrepSpeciesResults();
    setBirdPrepMessage(`地区鸟种查询失败：${error.message}`, true);
  } finally {
    setBirdPrepLoading(false);
  }
}

function buildBirdPrepQueryPayload() {
  const startTime = normalizeDateInput(elements.birdPrepStartDate?.value);
  const endTime = normalizeDateInput(elements.birdPrepEndDate?.value);
  const province = String(elements.birdPrepProvince?.value || "").trim();
  const city = String(elements.birdPrepCity?.value || "").trim();
  const district = String(elements.birdPrepDistrict?.value || "").trim();
  const pointname = String(elements.birdPrepPointName?.value || "").trim();

  if (!province) {
    setBirdPrepMessage("请先选择省份；城市、区县、观测地点和日期可以留空。", true);
    elements.birdPrepProvince?.focus();
    return null;
  }

  if (startTime && endTime && startTime > endTime) {
    setBirdPrepMessage("开始日期不能晚于结束日期。", true);
    elements.birdPrepStartDate?.focus();
    return null;
  }

  return createBirdreportPayload({ startTime, endTime, province, city, district, pointname });
}

function formatBirdPrepQuerySummary(payload) {
  const areaText = [payload.province, payload.city, payload.district].filter(Boolean).join(" / ");
  const pointText = payload.pointname ? `观测地点“${payload.pointname}”` : "";
  const dateText = [payload.startTime, payload.endTime].filter(Boolean).join(" 至 ");
  return [areaText, pointText, dateText].filter(Boolean).join(" · ") || "当前筛选条件";
}

function formatBirdPrepQueryCompleteMessage(payload, originalCount, filteredCount, username, removedCount, warning) {
  const queryText = formatBirdPrepQuerySummary(payload);
  if (!username) {
    return `地区鸟种查询完成：${queryText} 共 ${filteredCount} 个鸟种。`;
  }
  if (warning) {
    return `地区鸟种查询完成：${queryText} 共 ${filteredCount} 个鸟种。${warning}`;
  }
  return `地区鸟种查询完成：${queryText} 原始 ${originalCount} 个鸟种，已剔除「${username}」已解锁 ${removedCount} 种，剩余 ${filteredCount} 个。`;
}

function getBirdPrepUnlockedUsername() {
  return String(elements.birdPrepUnlockedUsername?.value || "").trim();
}

async function fetchUserNationalBirdPrepSpecies(username, options = {}) {
  const { onProgress } = options;
  const primary = await fetchAllBirdreportTaxa(
    createBirdreportPayload({ username, mode: 1 }),
    {
      onProgress: (message) => onProgress?.(message.replace("BirdReport 鸟种", "用户全国已解锁鸟种"))
    }
  );
  if (primary.length) {
    return primary;
  }

  onProgress?.("按兼容模式重新核对记录用户全国已解锁鸟种...");
  return fetchAllBirdreportTaxa(
    createBirdreportPayload({ username }),
    {
      onProgress: (message) => onProgress?.(message.replace("BirdReport 鸟种", "用户全国已解锁鸟种"))
    }
  );
}

async function getBirdPrepUnlockedSpeciesForUser(username, options = {}) {
  username = String(username || "").trim();
  if (!username) {
    return [];
  }
  if (state.birdPrepUnlockedSpeciesCache.has(username)) {
    return state.birdPrepUnlockedSpeciesCache.get(username);
  }

  const species = normalizeBirdreportTaxa(await fetchUserNationalBirdPrepSpecies(username, options));
  state.birdPrepUnlockedSpeciesCache.set(username, species);
  return species;
}

function buildBirdPrepUnlockedTaxonLookup(items) {
  const lookup = {
    keys: new Set(),
    names: new Set()
  };

  getBirdreportTaxaArray(items).forEach((item) => {
    const key = getBirdreportTaxonKey(item);
    const name = getBirdPrepTaxonName(item);
    if (key) {
      lookup.keys.add(key);
    }
    if (name) {
      lookup.names.add(name);
    }
  });

  return lookup;
}

function getBirdPrepTaxonName(item) {
  return BIRDREPORT_CORE.getBirdreportTaxonName(item);
}

function filterBirdPrepSpeciesByUnlocked(species, lookup) {
  const sourceSpecies = getBirdreportTaxaArray(species);
  const filteredSpecies = sourceSpecies.filter(
    (item) => !lookup.keys.has(getBirdreportTaxonKey(item)) && !lookup.names.has(getBirdPrepTaxonName(item))
  );
  return {
    species: filteredSpecies,
    removedCount: sourceSpecies.length - filteredSpecies.length
  };
}

function renderBirdPrepSpeciesOptions() {
  const container = elements.birdPrepSpeciesOptions;
  if (!container) {
    return;
  }

  const previousSelection = state.birdPrepSelectedSpeciesKeys;
  const filter = String(elements.birdPrepSpeciesSearch?.value || "").trim().toLowerCase();
  const species = state.birdPrepSpeciesResults || [];
  const filtered = species.filter((item) => {
    if (!filter) {
      return true;
    }
    return [
      item.taxonname,
      item.name,
      item.latinname,
      item.englishname,
      item.taxonordername,
      item.taxonfamilyname
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(filter);
  });

  container.innerHTML = "";
  if (!species.length) {
    renderEmptyState(elements.birdPrepSpeciesOptions, "bird-prep-picker");
  } else if (!filtered.length) {
    renderEmptyState(container, "bird-prep-picker", {
      title: "没有匹配鸟种",
      description: "换一个中文名、学名、目或科再试。"
    });
  } else {
    filtered.forEach((item) => {
      const key = getBirdreportTaxonKey(item);
      const label = document.createElement("label");
      label.className = "bird-prep-species-option";
      label.setAttribute("role", "option");
      label.setAttribute("aria-selected", previousSelection.has(key) ? "true" : "false");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = key;
      checkbox.checked = previousSelection.has(key);
      checkbox.setAttribute("data-bird-prep-species-key", key);

      const text = document.createElement("span");
      text.textContent = formatBirdPrepSpeciesOption(item);

      label.append(checkbox, text);
      container.append(label);
    });
  }

  updateBirdPrepPptButton();
}

function handleBirdPrepSpeciesSelectionChange() {
  const container = elements.birdPrepSpeciesOptions;
  if (!container) {
    return;
  }

  container.querySelectorAll("[data-bird-prep-species-key]").forEach((checkbox) => {
    const key = checkbox.dataset.birdPrepSpeciesKey || checkbox.value;
    if (!key) {
      return;
    }
    if (checkbox.checked) {
      state.birdPrepSelectedSpeciesKeys.add(key);
      checkbox.closest(".bird-prep-species-option")?.setAttribute("aria-selected", "true");
    } else {
      state.birdPrepSelectedSpeciesKeys.delete(key);
      checkbox.closest(".bird-prep-species-option")?.setAttribute("aria-selected", "false");
    }
  });
  updateBirdPrepPptButton();
}

function formatBirdPrepSpeciesOption(item) {
  const name = item.taxonname || item.name || "未命名鸟种";
  const latinName = item.latinname || item.englishname || "";
  const taxonomy = [item.taxonordername, item.taxonfamilyname].filter(Boolean).join(" / ");
  const count = Number(item.recordcount) || 0;
  return [name, latinName, taxonomy, `${count.toLocaleString("zh-CN")} 条记录`].filter(Boolean).join(" · ");
}

function getSelectedBirdPrepSpecies() {
  if (!elements.birdPrepSpeciesOptions) {
    return [];
  }

  return (state.birdPrepSpeciesResults || []).filter((item) => state.birdPrepSelectedSpeciesKeys.has(getBirdreportTaxonKey(item)));
}

function selectAllVisibleBirdPrepSpecies() {
  const container = elements.birdPrepSpeciesOptions;
  if (!container || !state.birdPrepSpeciesResults.length) {
    return;
  }

  container.querySelectorAll("[data-bird-prep-species-key]").forEach((checkbox) => {
    checkbox.checked = true;
    state.birdPrepSelectedSpeciesKeys.add(checkbox.dataset.birdPrepSpeciesKey || checkbox.value);
    checkbox.closest(".bird-prep-species-option")?.setAttribute("aria-selected", "true");
  });
  updateBirdPrepPptButton();
}

function clearBirdPrepSpeciesSelection() {
  const container = elements.birdPrepSpeciesOptions;
  if (!container) {
    return;
  }

  state.birdPrepSelectedSpeciesKeys.clear();
  container.querySelectorAll("[data-bird-prep-species-key]").forEach((checkbox) => {
    checkbox.checked = false;
    checkbox.closest(".bird-prep-species-option")?.setAttribute("aria-selected", "false");
  });
  updateBirdPrepPptButton();
}

function clearBirdPrepSpeciesResults() {
  state.birdPrepSpeciesResults = [];
  state.birdPrepSelectedSpeciesKeys.clear();
  state.birdPrepLastQueryPayload = null;
  state.birdPrepUnlockedFilterUsername = "";
  state.birdPrepUnlockedFilteredCount = 0;
  state.birdPrepUnlockedFilterWarning = "";
  if (elements.birdPrepSpeciesSearch) {
    elements.birdPrepSpeciesSearch.value = "";
  }
  resetBirdPrepProgress();
  renderBirdPrepSpeciesOptions();
}

async function generateBirdPrepPpt() {
  if (isEmbeddedAndroidApp()) {
    setBirdPrepMessage("APK 版第一版暂不支持保存 PPTX，请在网页版生成。", true);
    return;
  }

  const selectedSpecies = getSelectedBirdPrepSpecies();
  if (!selectedSpecies.length) {
    setBirdPrepMessage("请先从鸟种下拉框选择至少 1 个鸟种。", true);
    elements.birdPrepSpeciesOptions?.focus();
    return;
  }

  if (!window.BeauBirdPrepPpt) {
    setBirdPrepMessage("PPT 生成模块未加载，请刷新页面后重试。", true);
    return;
  }

  if (shouldUseBirdPrepMacaulayImages() && !elements.birdPrepMacaulayRights?.checked) {
    setBirdPrepMessage("请先确认 Macaulay Library 图片仅用于你有权使用的 PPT，并保留署名。", true);
    elements.birdPrepMacaulayRights?.focus();
    return;
  }

  setBirdPrepGenerating(true);
  setBirdPrepProgress({ label: "读取鸟类简介", value: 8, detail: "正在读取所选鸟种简介。" });
  setBirdPrepMessage("正在读取鸟类简介并生成 PPT...");

  try {
    await yieldToBrowserFrame();
    const profileIndex = await loadBirdPrepProfileIndexForSpecies(selectedSpecies);
    const { slides, skippedNames } = window.BeauBirdPrepPpt.buildBirdPrepSlides(selectedSpecies, profileIndex);
    if (!slides.length) {
      const skippedText = skippedNames.length ? `已跳过：${skippedNames.join("、")}` : "";
      throw new Error(`所选鸟种在本地简介中都没有匹配项。${skippedText}`);
    }

    setBirdPrepProgress({ label: "准备幻灯片", value: 22, detail: `已匹配 ${slides.length} 个鸟种简介。` });
    await yieldToBrowserFrame();
    const photoResult = shouldUseBirdPrepMacaulayImages()
      ? await loadBirdPrepMacaulayPhotos(selectedSpecies, slides, {
          onProgress: (progress) => {
            const total = Math.max(Number(progress.total) || slides.length || 1, 1);
            const done = Math.max(Number(progress.done) || 0, 0);
            const ratio = Math.min(done / total, 1);
            const value = progress.phase === "taxonomy" ? 28 : 30 + Math.round(ratio * 55);
            setBirdPrepProgress({
              label: progress.label || "匹配/下载图片",
              value,
              detail: progress.detail || `正在下载图片 ${done}/${total}。`
            });
          }
        })
      : { attachedCount: 0, missingCount: 0 };
    if (!shouldUseBirdPrepMacaulayImages()) {
      setBirdPrepProgress({ label: "跳过图片", value: 82, detail: "未启用 Macaulay Library 图片，直接打包 PPT。" });
      await yieldToBrowserFrame();
    }

    setBirdPrepProgress({ label: "打包 PPT", value: 92, detail: "正在写入幻灯片和图片资源。" });
    await yieldToBrowserFrame();
    const bytes = window.BeauBirdPrepPpt.createBirdPrepPptx(slides, {
      title: `${formatBirdPrepQuerySummary(state.birdPrepLastQueryPayload || {})} 鸟类预习`
    });
    const filename = window.BeauBirdPrepPpt.buildBirdPrepPptxFilename({
      province: state.birdPrepLastQueryPayload?.province || elements.birdPrepProvince?.value || "",
      city: state.birdPrepLastQueryPayload?.city || elements.birdPrepCity?.value || "",
      district: state.birdPrepLastQueryPayload?.district || elements.birdPrepDistrict?.value || "",
      pointname: state.birdPrepLastQueryPayload?.pointname || elements.birdPrepPointName?.value || ""
    });
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    });
    setBirdPrepProgress({ label: "触发下载", value: 98, detail: "正在准备浏览器下载。" });
    await yieldToBrowserFrame();
    const url = URL.createObjectURL(blob);
    triggerFileDownload(filename, url, () => URL.revokeObjectURL(url));

    const skippedText = skippedNames.length ? `；跳过 ${skippedNames.length} 个无简介鸟种：${skippedNames.join("、")}` : "";
    const photoText = photoResult.attachedCount
      ? `；已添加 ${photoResult.attachedCount} 张 Macaulay Library 图片`
      : shouldUseBirdPrepMacaulayImages()
        ? photoResult.firstErrorMessage
          ? `；Macaulay Library 图片全部失败：${photoResult.firstErrorMessage}`
          : "；没有匹配到可嵌入的 Macaulay Library 图片"
        : "";
    setBirdPrepProgress({ label: "已完成", value: 100, detail: `已生成 ${slides.length} 页 PPT。`, status: "complete" });
    setBirdPrepMessage(`已生成 ${slides.length} 页鸟类预习 PPT：${filename}${photoText}${skippedText}`);
  } catch (error) {
    setBirdPrepProgress({ label: "生成失败", value: Number(elements.birdPrepProgressBar?.value) || 0, detail: error.message, status: "error" });
    setBirdPrepMessage(`生成 PPT 失败：${error.message}`, true);
  } finally {
    setBirdPrepGenerating(false);
  }
}

function syncBirdPrepMacaulayOptions() {
  if (!elements.birdPrepMacaulayRights) {
    return;
  }
  const enabled = Boolean(elements.birdPrepMacaulayImages?.checked);
  elements.birdPrepMacaulayRights.disabled = !enabled || state.birdPrepGenerating;
}

function setBirdPrepProgress({ label, value, max, detail, status } = {}) {
  const target = elements.birdPrepProgress;
  if (!target) {
    return;
  }

  const maxValue = Number.isFinite(Number(max)) && Number(max) > 0 ? Number(max) : 100;
  const rawValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  const progressValue = Math.min(Math.max(rawValue, 0), maxValue);
  const percent = Math.round((progressValue / maxValue) * 100);
  target.classList.remove("is-hidden", "is-complete", "is-error");
  target.removeAttribute("aria-hidden");
  if (status === "complete") {
    target.classList.add("is-complete");
  } else if (status === "error") {
    target.classList.add("is-error");
  }

  if (elements.birdPrepProgressBar) {
    elements.birdPrepProgressBar.max = maxValue;
    elements.birdPrepProgressBar.value = progressValue;
    elements.birdPrepProgressBar.textContent = `${percent}%`;
  }
  if (elements.birdPrepProgressLabel) {
    elements.birdPrepProgressLabel.textContent = label || "正在生成";
  }
  if (elements.birdPrepProgressPercent) {
    elements.birdPrepProgressPercent.textContent = `${percent}%`;
  }
  if (elements.birdPrepProgressDetail) {
    elements.birdPrepProgressDetail.textContent = detail || "正在制作鸟类预习 PPT。";
  }
}

function resetBirdPrepProgress() {
  const target = elements.birdPrepProgress;
  if (!target) {
    return;
  }

  target.classList.add("is-hidden");
  target.classList.remove("is-complete", "is-error");
  target.setAttribute("aria-hidden", "true");
  if (elements.birdPrepProgressBar) {
    elements.birdPrepProgressBar.max = 100;
    elements.birdPrepProgressBar.value = 0;
    elements.birdPrepProgressBar.textContent = "0%";
  }
  if (elements.birdPrepProgressLabel) {
    elements.birdPrepProgressLabel.textContent = "等待生成";
  }
  if (elements.birdPrepProgressPercent) {
    elements.birdPrepProgressPercent.textContent = "0%";
  }
  if (elements.birdPrepProgressDetail) {
    elements.birdPrepProgressDetail.textContent = "选择鸟种后生成 PPT。";
  }
}

function yieldToBrowserFrame() {
  return new Promise((resolve) => {
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => resolve());
      return;
    }
    window.setTimeout(resolve, 0);
  });
}

function setBirdPrepLoading(isLoading) {
  state.birdPrepLoading = isLoading;
  if (elements.queryBirdPrepSpeciesBtn) {
    elements.queryBirdPrepSpeciesBtn.disabled = isLoading;
    elements.queryBirdPrepSpeciesBtn.textContent = isLoading ? "查询中..." : "查询地区鸟种";
    setElementLoadingClass(elements.queryBirdPrepSpeciesBtn, isLoading);
  }
  [elements.birdPrepProvince, elements.birdPrepCity, elements.birdPrepDistrict, elements.birdPrepPointName, elements.birdPrepUnlockedUsername, elements.birdPrepStartDate, elements.birdPrepEndDate].forEach((element) => {
    if (element) {
      element.disabled = isLoading;
    }
  });
  [elements.birdPrepMacaulayImages].forEach((element) => {
    if (element) {
      element.disabled = isLoading;
    }
  });
  syncBirdPrepMacaulayOptions();
  setElementLoadingClass(elements.birdPrepMessage, isLoading);
  updateBirdPrepPptButton();
}

function setBirdPrepGenerating(isGenerating) {
  state.birdPrepGenerating = isGenerating;
  if (elements.generateBirdPrepPptBtn) {
    elements.generateBirdPrepPptBtn.textContent = isGenerating ? "生成中..." : "生成 PPT";
    setElementLoadingClass(elements.generateBirdPrepPptBtn, isGenerating);
  }
  syncBirdPrepMacaulayOptions();
  setElementLoadingClass(elements.birdPrepMessage, isGenerating);
  updateBirdPrepPptButton();
}

function updateBirdPrepPptButton() {
  const selectedCount = getSelectedBirdPrepSpecies().length;
  const totalCount = state.birdPrepSpeciesResults.length;
  if (elements.generateBirdPrepPptBtn) {
    elements.generateBirdPrepPptBtn.disabled =
      state.birdPrepLoading || state.birdPrepGenerating || !selectedCount || isEmbeddedAndroidApp();
  }
  if (elements.selectAllBirdPrepSpeciesBtn) {
    elements.selectAllBirdPrepSpeciesBtn.disabled = state.birdPrepLoading || state.birdPrepGenerating || !totalCount;
  }
  if (elements.clearBirdPrepSpeciesBtn) {
    elements.clearBirdPrepSpeciesBtn.disabled = state.birdPrepLoading || state.birdPrepGenerating || !selectedCount;
  }
  if (elements.birdPrepSummary) {
    const visibleCount = elements.birdPrepSpeciesOptions?.querySelectorAll("[data-bird-prep-species-key]").length || 0;
    elements.birdPrepSummary.textContent = totalCount
      ? `当前地区鸟种 ${totalCount} 种，列表展示 ${visibleCount} 种，已选择 ${selectedCount} 种。`
      : "查询地区鸟种后，可在这里多选要生成 PPT 的鸟种。";
  }
}

  Object.assign(runtime, {
    queryBirdPrepSpecies,
    buildBirdPrepQueryPayload,
    formatBirdPrepQuerySummary,
    formatBirdPrepQueryCompleteMessage,
    getBirdPrepUnlockedUsername,
    fetchUserNationalBirdPrepSpecies,
    getBirdPrepUnlockedSpeciesForUser,
    buildBirdPrepUnlockedTaxonLookup,
    getBirdPrepTaxonName,
    filterBirdPrepSpeciesByUnlocked,
    renderBirdPrepSpeciesOptions,
    handleBirdPrepSpeciesSelectionChange,
    formatBirdPrepSpeciesOption,
    getSelectedBirdPrepSpecies,
    selectAllVisibleBirdPrepSpecies,
    clearBirdPrepSpeciesSelection,
    clearBirdPrepSpeciesResults,
    generateBirdPrepPpt,
    syncBirdPrepMacaulayOptions,
    setBirdPrepProgress,
    resetBirdPrepProgress,
    yieldToBrowserFrame,
    setBirdPrepLoading,
    setBirdPrepGenerating,
    updateBirdPrepPptButton
  });
}
