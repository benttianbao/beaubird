"use strict";

const state = {
  models: [],
  selectedLocation: null,
  locations: [],
  activeLocationIndex: -1,
  searchTimer: null,
  searchRequest: 0
};

const elements = {
  form: document.querySelector("#prediction-form"),
  modelSelect: document.querySelector("#model-select"),
  modelHelp: document.querySelector("#model-help"),
  modelSummary: document.querySelector("#model-summary"),
  date: document.querySelector("#prediction-date"),
  locationSearch: document.querySelector("#location-search"),
  locationHelp: document.querySelector("#location-help"),
  locationOptions: document.querySelector("#location-options"),
  predictButton: document.querySelector("#predict-button"),
  qualityNotice: document.querySelector("#quality-notice"),
  qualityMessage: document.querySelector("#quality-message"),
  statusRegion: document.querySelector("#status-region"),
  resultsRegion: document.querySelector("#results-region"),
  resultsSubtitle: document.querySelector("#results-subtitle"),
  resultCount: document.querySelector("#result-count"),
  resultContext: document.querySelector("#result-context"),
  birdResults: document.querySelector("#bird-results")
};

function localDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function text(value) {
  return String(value == null ? "" : value);
}

function formatInteger(value) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function formatPercent(value) {
  if (value == null || !Number.isFinite(Number(value))) return "资料不足";
  const percent = Number(value) * 100;
  return `${percent < 1 ? percent.toFixed(1) : Math.round(percent)}%`;
}

function formatBytes(value) {
  const gib = Number(value) / 1024 ** 3;
  return gib >= 1 ? `${gib.toFixed(1)} GB` : `${Math.round(Number(value) / 1024 ** 2)} MB`;
}

function confidenceLabel(value) {
  const labels = { high: "参考度高", medium: "参考度中", low: "参考度低" };
  return labels[String(value).toLowerCase()] || "实验参考";
}

function levelLabel(value) {
  return { city: "城市", district: "区县", point: "观鸟点", grid_r6: "区域", grid_r7: "小区域" }[value] || "地点";
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || "读取失败，请稍后重试");
  return body;
}

function currentModel() {
  return state.models.find((model) => model.id === elements.modelSelect.value) || null;
}

function updateModelDisplay() {
  const model = currentModel();
  if (!model) return;
  elements.modelSummary.replaceChildren();
  const label = document.createElement("span");
  label.className = "model-summary__label";
  label.textContent = "当前模型";
  const title = document.createElement("strong");
  title.textContent = model.modelVersion;
  const detail = document.createElement("span");
  detail.textContent = `数据截至 ${model.dataCutoffDate || "未知"} · ${formatBytes(model.sizeBytes)} · ${model.status}`;
  elements.modelSummary.append(label, title, detail);
  elements.modelHelp.textContent = `完整 52 周地点预测 · ${model.statusMessage}`;
  elements.qualityNotice.hidden = model.releaseEligible;
  elements.qualityMessage.textContent = model.statusMessage;
}

function updateSubmitState() {
  elements.predictButton.disabled = !currentModel() || !state.selectedLocation || !elements.date.value;
}

function showStatus(kind, title, message) {
  elements.resultsRegion.hidden = true;
  elements.statusRegion.hidden = false;
  elements.resultCount.hidden = true;
  if (kind === "loading") {
    const loading = document.createElement("div");
    loading.className = "loading-list";
    loading.setAttribute("aria-label", title);
    for (let index = 0; index < 4; index += 1) {
      const row = document.createElement("div");
      row.className = "loading-row";
      loading.append(row);
    }
    elements.statusRegion.replaceChildren(loading);
    return;
  }
  const container = document.createElement("div");
  container.className = kind === "error" ? "error-state" : "empty-state";
  const strong = document.createElement("strong");
  strong.textContent = title;
  const paragraph = document.createElement("p");
  paragraph.textContent = message;
  container.append(strong, paragraph);
  elements.statusRegion.replaceChildren(container);
}

function closeLocationOptions() {
  elements.locationOptions.hidden = true;
  elements.locationSearch.setAttribute("aria-expanded", "false");
  state.activeLocationIndex = -1;
}

function renderLocations() {
  elements.locationOptions.replaceChildren();
  if (!state.locations.length) {
    const empty = document.createElement("p");
    empty.className = "location-options__empty";
    empty.textContent = "没有找到匹配地点";
    elements.locationOptions.append(empty);
  } else {
    state.locations.forEach((location, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "location-option";
      button.id = `location-option-${index}`;
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", index === state.activeLocationIndex ? "true" : "false");
      const copy = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent = location.label;
      const support = document.createElement("small");
      support.textContent = `${formatInteger(location.support.checklists)} 份记录 · ${formatInteger(location.support.observers)} 位观察者`;
      copy.append(title, support);
      const type = document.createElement("span");
      type.className = "location-option__type";
      type.textContent = levelLabel(location.level);
      button.append(copy, type);
      button.addEventListener("click", () => selectLocation(location));
      elements.locationOptions.append(button);
    });
  }
  elements.locationOptions.hidden = false;
  elements.locationSearch.setAttribute("aria-expanded", "true");
}

function selectLocation(location) {
  state.selectedLocation = location;
  elements.locationSearch.value = location.label;
  elements.locationSearch.setAttribute("aria-invalid", "false");
  elements.locationHelp.textContent = `${levelLabel(location.level)} · ${formatInteger(location.support.checklists)} 份历史记录`;
  closeLocationOptions();
  updateSubmitState();
}

async function loadLocations(query = "") {
  const model = currentModel();
  if (!model) return;
  const requestNumber = ++state.searchRequest;
  try {
    const params = new URLSearchParams({ model: model.id, q: query, limit: "16" });
    const body = await fetchJson(`/api/locations?${params}`);
    if (requestNumber !== state.searchRequest) return;
    state.locations = body.locations;
    state.activeLocationIndex = -1;
    renderLocations();
  } catch (error) {
    if (requestNumber !== state.searchRequest) return;
    state.locations = [];
    renderLocations();
  }
}

function moveLocationSelection(direction) {
  if (elements.locationOptions.hidden || !state.locations.length) return;
  state.activeLocationIndex = (state.activeLocationIndex + direction + state.locations.length) % state.locations.length;
  const options = elements.locationOptions.querySelectorAll("[role='option']");
  options.forEach((option, index) => option.setAttribute("aria-selected", index === state.activeLocationIndex ? "true" : "false"));
  const active = options[state.activeLocationIndex];
  elements.locationSearch.setAttribute("aria-activedescendant", active.id);
  active.scrollIntoView({ block: "nearest" });
}

function renderPredictions(body) {
  elements.statusRegion.hidden = true;
  elements.resultsRegion.hidden = false;
  elements.resultsSubtitle.textContent = `${body.location.label} · ${body.query.date}`;
  elements.resultCount.textContent = `${body.results.length} 种`;
  elements.resultCount.hidden = false;
  elements.resultContext.replaceChildren();
  const contextItems = [
    ["地点", body.location.label],
    ["日期", body.query.date],
    ["模型", body.model.modelVersion]
  ];
  for (const [label, value] of contextItems) {
    const chip = document.createElement("span");
    chip.className = "context-chip";
    const strong = document.createElement("strong");
    strong.textContent = `${label} `;
    chip.append(strong, document.createTextNode(text(value)));
    elements.resultContext.append(chip);
  }

  const resultFragment = document.createDocumentFragment();
  for (const bird of body.results) {
    const item = document.createElement("li");
    item.className = "bird-row";
    const rank = document.createElement("span");
    rank.className = "bird-rank";
    rank.textContent = bird.rank;
    rank.setAttribute("aria-label", `第 ${bird.rank} 名`);

    const name = document.createElement("div");
    name.className = "bird-name";
    const common = document.createElement("strong");
    common.textContent = bird.commonName;
    const scientific = document.createElement("em");
    scientific.textContent = bird.scientificName || bird.englishName || `鸟种编号 ${bird.taxonId}`;
    const confidence = document.createElement("span");
    confidence.className = "confidence";
    confidence.textContent = `${confidenceLabel(bird.confidence)} · ${formatInteger(bird.observerCount)} 位观察者`;
    name.append(common, scientific, confidence);

    const probability = document.createElement("div");
    probability.className = "bird-probability";
    const number = document.createElement("strong");
    number.textContent = formatPercent(bird.probability);
    const interval = document.createElement("span");
    interval.textContent = bird.interval.lower == null
      ? "按出现顺序排列"
      : `参考范围 ${formatPercent(bird.interval.lower)}–${formatPercent(bird.interval.upper)}`;
    probability.append(number, interval);
    item.append(rank, name, probability);
    resultFragment.append(item);
  }
  elements.birdResults.replaceChildren(resultFragment);
}

async function runPrediction() {
  if (!state.selectedLocation) {
    elements.locationSearch.setAttribute("aria-invalid", "true");
    elements.locationSearch.focus();
    return;
  }
  showStatus("loading", "正在读取离线模型", "");
  elements.predictButton.disabled = true;
  elements.resultsSubtitle.textContent = "正在计算…";
  try {
    const params = new URLSearchParams({
      model: elements.modelSelect.value,
      spaceUnitId: state.selectedLocation.id,
      date: elements.date.value,
      limit: "600"
    });
    const body = await fetchJson(`/api/predictions?${params}`);
    renderPredictions(body);
  } catch (error) {
    elements.resultsSubtitle.textContent = "未能生成结果";
    showStatus("error", "这次没有读到预测", error.message);
  } finally {
    updateSubmitState();
  }
}

async function loadModels() {
  try {
    const body = await fetchJson("/api/models");
    state.models = body.models;
    elements.modelSelect.replaceChildren();
    for (const model of state.models) {
      const option = document.createElement("option");
      option.value = model.id;
      option.textContent = `${model.modelVersion}（${model.status}）`;
      elements.modelSelect.append(option);
    }
    elements.modelSelect.value = body.defaultModelId;
    elements.modelSelect.disabled = false;
    updateModelDisplay();
    updateSubmitState();
  } catch (error) {
    elements.modelSelect.replaceChildren(new Option("没有可用模型", ""));
    elements.modelHelp.textContent = error.message;
    const label = document.createElement("span");
    label.className = "model-summary__label";
    label.textContent = "当前模型";
    const title = document.createElement("strong");
    title.textContent = "没有可用模型";
    const detail = document.createElement("span");
    detail.textContent = "请检查模型文件夹";
    elements.modelSummary.replaceChildren(label, title, detail);
    showStatus("error", "无法打开离线模型", error.message);
  }
}

elements.date.value = localDate();
elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  runPrediction();
});
elements.modelSelect.addEventListener("change", () => {
  state.selectedLocation = null;
  state.locations = [];
  elements.locationSearch.value = "";
  elements.locationHelp.textContent = "模型已切换，请重新选择地点。";
  updateModelDisplay();
  updateSubmitState();
  showStatus("empty", "模型已切换", "选择地点后即可使用新模型预测。 ");
});
elements.date.addEventListener("change", updateSubmitState);
elements.locationSearch.addEventListener("focus", () => loadLocations(elements.locationSearch.value === state.selectedLocation?.label ? "" : elements.locationSearch.value));
elements.locationSearch.addEventListener("input", () => {
  state.selectedLocation = null;
  elements.locationSearch.setAttribute("aria-invalid", "false");
  updateSubmitState();
  clearTimeout(state.searchTimer);
  state.searchTimer = setTimeout(() => loadLocations(elements.locationSearch.value), 180);
});
elements.locationSearch.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    moveLocationSelection(event.key === "ArrowDown" ? 1 : -1);
  } else if (event.key === "Enter" && state.activeLocationIndex >= 0) {
    event.preventDefault();
    selectLocation(state.locations[state.activeLocationIndex]);
  } else if (event.key === "Escape") {
    closeLocationOptions();
  }
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".location-field")) closeLocationOptions();
});

loadModels();
