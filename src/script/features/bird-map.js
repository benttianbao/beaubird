export function installBirdMap(runtime) {
  const { state, elements } = runtime;
  let initialized = false;
  let initializationPromise = null;
  let amap = null;
  let map = null;
  let cluster = null;
  let mapStatus = null;
  let activeMode = "zhejiang";
  let activeSpecies = null;
  let visiblePoints = [];
  let personalPlaces = new Map();
  let refreshTimer = null;
  let requestSequence = 0;
  let pointRequestController = null;
  let fitSpeciesOnNextRefresh = false;

  async function fetchJson(url, options = {}) {
    const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 15000);
    const controller = new AbortController();
    let abortedByParent = false;
    const abortFromParent = () => {
      abortedByParent = true;
      controller.abort();
    };
    if (options.signal?.aborted) abortFromParent();
    else options.signal?.addEventListener("abort", abortFromParent, { once: true });
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json" },
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `请求失败（${response.status}）`);
      return payload;
    } catch (error) {
      if (error?.name === "AbortError" && !abortedByParent) {
        throw new Error("请求超时，请稍后重试。");
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abortFromParent);
    }
  }

  function setMapMessage(message, isError = false) {
    if (!elements.birdMapMessage) return;
    elements.birdMapMessage.textContent = message;
    elements.birdMapMessage.classList.toggle("error", isError);
  }

  function setMapBusy(isBusy) {
    elements.birdMapCanvas?.setAttribute("aria-busy", String(Boolean(isBusy)));
  }

  function setCanvasState(title, description, hidden = false) {
    if (!elements.birdMapCanvasState) return;
    elements.birdMapCanvasState.hidden = hidden;
    if (!hidden) {
      elements.birdMapCanvasState.innerHTML = `<strong>${runtime.escapeHtml(title)}</strong><span>${runtime.escapeHtml(description)}</span>`;
    }
  }

  function formatDateTime(value) {
    const text = String(value || "").trim();
    if (!text) return "未知时间";
    return text.replace("T", " ").slice(0, 16);
  }

  async function loadAmap(config) {
    window._AMapSecurityConfig = {
      serviceHost: new URL(config.securityServiceHost, window.location.origin).href
    };
    if (!window.AMapLoader) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://webapi.amap.com/loader.js";
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error("高德地图加载器无法访问。"));
        document.head.append(script);
      });
    }
    const loadedAmap = await window.AMapLoader.load({
      key: config.key,
      version: "2.0",
      plugins: ["AMap.MarkerCluster", "AMap.Scale", "AMap.ToolBar"]
    });
    await ensureAmapPlugins(loadedAmap, ["AMap.MarkerCluster", "AMap.Scale", "AMap.ToolBar"]);
    return loadedAmap;
  }

  async function ensureAmapPlugins(amapNamespace, pluginNames) {
    const constructorNames = pluginNames.map((name) => name.split(".").pop());
    if (constructorNames.every((name) => typeof amapNamespace[name] === "function")) return;
    if (typeof amapNamespace.plugin !== "function") {
      throw new Error("高德地图控件插件加载失败。");
    }
    await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("高德地图控件插件加载超时。")), 10000);
      amapNamespace.plugin(pluginNames, () => {
        window.clearTimeout(timeout);
        const missingPlugin = constructorNames.find((name) => typeof amapNamespace[name] !== "function");
        if (missingPlugin) {
          reject(new Error(`高德地图控件 ${missingPlugin} 加载失败。`));
          return;
        }
        resolve();
      });
    });
  }

  async function initBirdMap() {
    if (initialized) return initializationPromise;
    initialized = true;
    bindMapEvents();
    initializationPromise = (async () => {
      try {
        const [config, status] = await Promise.all([
          fetchJson("/api/map/config"),
          fetchJson("/api/map/status")
        ]);
        mapStatus = status;
        renderDatasetStatus();
        if (!status.available) {
          setCanvasState("地图数据尚未就绪", "请先生成 data/bird-map.sqlite，再重新加载页面。");
          setMapMessage("地图数据尚未生成。", true);
          return;
        }
        if (!config.enabled) {
          setCanvasState("高德地图尚未配置", "在站点环境中填写 Web JS API Key 和安全密钥后即可显示地图。");
          setMapMessage("数据已就绪，但高德地图 Key 或安全密钥尚未配置。", true);
          return;
        }
        amap = await loadAmap(config);
        map = new amap.Map("birdMapCanvas", {
          center: [120.25, 29.25],
          zoom: 7,
          viewMode: "2D",
          resizeEnable: true,
          scrollWheel: true
        });
        map.addControl(new amap.Scale());
        map.addControl(new amap.ToolBar({ position: "RB" }));
        map.on("moveend", scheduleVisiblePointRefresh);
        map.on("zoomend", scheduleVisiblePointRefresh);
        setCanvasState("", "", true);
        await refreshVisiblePoints();
      } catch (error) {
        setCanvasState("地图加载失败", error.message || "请检查网络与高德地图配置。");
        setMapMessage(`地图加载失败：${error.message}`, true);
      }
    })();
    return initializationPromise;
  }

  function bindMapEvents() {
    elements.birdMapModeControls?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-map-mode]");
      if (button) setMapMode(button.dataset.mapMode);
    });
    elements.birdMapSpeciesSearch?.addEventListener("input", scheduleSpeciesSearch);
    elements.birdMapSpeciesSearch?.addEventListener("keydown", (event) => {
      if (event.key === "Escape") clearSpeciesSuggestions();
      if (event.key === "Enter") {
        event.preventDefault();
        elements.birdMapSpeciesResults?.querySelector("button")?.click();
      }
    });
    elements.birdMapSpeciesResults?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-taxon-id]");
      if (!button) return;
      selectSpeciesFilter({
        taxonId: button.dataset.taxonId,
        commonName: button.dataset.commonName,
        scientificName: button.dataset.scientificName || ""
      }, { fit: true });
    });
    elements.birdMapClearSpecies?.addEventListener("click", clearSpeciesFilter);
    elements.birdMapVisibleList?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-place-id]");
      if (button) selectPlace(button.dataset.placeId);
    });
  }

  function setMapMode(mode) {
    const nextMode = mode === "personal" ? "personal" : "zhejiang";
    if (activeMode === nextMode) return;
    activeMode = nextMode;
    activeSpecies = null;
    clearSpeciesSuggestions();
    if (elements.birdMapSpeciesSearch) elements.birdMapSpeciesSearch.value = "";
    updateSpeciesFilterUi();
    elements.birdMapModeControls?.querySelectorAll("[data-map-mode]").forEach((button) => {
      const active = button.dataset.mapMode === activeMode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    renderDatasetStatus();
    fitSpeciesOnNextRefresh = nextMode === "personal";
    refreshVisiblePoints();
  }

  function renderDatasetStatus() {
    if (!elements.birdMapDatasetStatus) return;
    if (activeMode === "personal") {
      const coordinateCount = state.personalRecords.filter((record) => record.lat != null && record.lng != null).length;
      elements.birdMapDatasetStatus.textContent = `个人全国 · ${state.personalRecords.length.toLocaleString("zh-CN")} 条记录 · ${coordinateCount.toLocaleString("zh-CN")} 条有坐标`;
      return;
    }
    if (!mapStatus?.available) {
      elements.birdMapDatasetStatus.textContent = "浙江点位数据未就绪";
      return;
    }
    elements.birdMapDatasetStatus.textContent = `浙江 ${mapStatus.windowStartDate} 至 ${mapStatus.windowEndDate} · ${mapStatus.placeCount.toLocaleString("zh-CN")} 个点位 · 静态快照`;
  }

  function scheduleVisiblePointRefresh() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(refreshVisiblePoints, 260);
  }

  async function refreshVisiblePoints() {
    if (!map || !amap) return;
    const sequence = ++requestSequence;
    pointRequestController?.abort();
    const requestController = new AbortController();
    pointRequestController = requestController;
    setMapBusy(true);
    setMapMessage("正在加载当前地图范围内的鸟点...");
    try {
      let points;
      let truncated = false;
      if (activeMode === "personal") {
        points = buildPersonalPoints();
      } else {
        const bounds = fitSpeciesOnNextRefresh
          ? { west: 118, south: 27, east: 123.5, north: 31.5 }
          : getMapBounds();
        const pointLimit = getPointRequestLimit();
        const params = new URLSearchParams({
          west: String(bounds.west), south: String(bounds.south),
          east: String(bounds.east), north: String(bounds.north), limit: String(pointLimit)
        });
        if (activeSpecies?.taxonId) params.set("taxonId", activeSpecies.taxonId);
        const payload = await fetchJson(`/api/map/points?${params}`, {
          signal: requestController.signal,
          timeoutMs: 15000
        });
        points = payload.points || [];
        truncated = Boolean(payload.truncated);
      }
      if (sequence !== requestSequence) return;
      visiblePoints = points;
      renderMarkers(points);
      renderVisibleList(points);
      if (fitSpeciesOnNextRefresh && points.length) fitMapToPoints(points);
      fitSpeciesOnNextRefresh = false;
      if (truncated) {
        setMapMessage(`当前范围鸟点较多，先显示最近 ${points.length.toLocaleString("zh-CN")} 个；放大地图可查看更完整的点位。`);
      } else {
        setMapMessage(points.length ? `当前范围显示 ${points.length.toLocaleString("zh-CN")} 个鸟点。` : "当前范围没有符合条件的鸟点。", false);
      }
    } catch (error) {
      if (sequence !== requestSequence) return;
      visiblePoints = [];
      renderMarkers([]);
      renderVisibleList([]);
      setMapMessage(`鸟点加载失败：${error.message}`, true);
    } finally {
      if (sequence === requestSequence) {
        setMapBusy(false);
        if (pointRequestController === requestController) pointRequestController = null;
      }
    }
  }

  function getPointRequestLimit() {
    if (fitSpeciesOnNextRefresh) return 10000;
    const zoom = Number(map?.getZoom?.()) || 7;
    if (zoom <= 7) return 3000;
    if (zoom <= 9) return 5000;
    return 10000;
  }

  function getMapBounds() {
    const bounds = map.getBounds();
    const southwest = bounds.getSouthWest();
    const northeast = bounds.getNorthEast();
    return { west: southwest.lng, south: southwest.lat, east: northeast.lng, north: northeast.lat };
  }

  function renderMarkers(points) {
    const data = points.map((point) => ({ lnglat: [point.longitude, point.latitude], point }));
    if (cluster?.setData) {
      cluster.setData(data);
      return;
    }
    cluster?.setMap?.(null);
    cluster = new amap.MarkerCluster(map, data, {
      gridSize: 66,
      renderMarker(context) {
        const point = context.data[0].point;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "bird-map-marker";
        button.setAttribute("aria-label", `${point.name}，${point.speciesCount} 种，最近 ${formatDateTime(point.latestAt)}`);
        button.innerHTML = "<span aria-hidden=\"true\"></span>";
        button.addEventListener("click", () => selectPlace(point.placeId));
        context.marker.setContent(button);
        context.marker.setOffset(new amap.Pixel(-14, -14));
      },
      renderClusterMarker(context) {
        const marker = document.createElement("div");
        marker.className = "bird-map-cluster";
        marker.textContent = String(context.count);
        marker.setAttribute("aria-label", `${context.count} 个聚合鸟点`);
        context.marker.setContent(marker);
        context.marker.setOffset(new amap.Pixel(-18, -18));
      }
    });
  }

  function renderVisibleList(points) {
    if (!elements.birdMapVisibleList) return;
    if (!points.length) {
      elements.birdMapVisibleList.innerHTML = '<div class="empty-state"><strong>当前没有鸟点</strong><span>移动或缩放地图，或清除鸟种筛选。</span></div>';
      return;
    }
    elements.birdMapVisibleList.innerHTML = points.slice(0, 12).map((point) => `
      <button type="button" class="bird-map-place-row" data-place-id="${runtime.escapeHtml(point.placeId)}">
        <span><strong>${runtime.escapeHtml(point.name)}</strong><small>${runtime.escapeHtml([point.cityName, point.districtName].filter(Boolean).join(" · ") || "个人记录")}</small></span>
        <span class="bird-map-place-meta">${Number(point.speciesCount).toLocaleString("zh-CN")} 种<small>${runtime.escapeHtml(formatDateTime(point.speciesLastSeenAt || point.latestAt))}</small></span>
      </button>
    `).join("");
  }

  async function selectPlace(placeId) {
    const point = visiblePoints.find((item) => item.placeId === placeId);
    if (point && map) map.panTo([point.longitude, point.latitude]);
    if (activeMode === "personal") {
      renderPersonalPlaceDetail(personalPlaces.get(placeId));
      return;
    }
    if (!elements.birdMapDetail) return;
    elements.birdMapDetail.innerHTML = '<div class="bird-map-detail-loading" role="status">正在加载鸟点详情...</div>';
    try {
      const payload = await fetchJson(`/api/map/points/${encodeURIComponent(placeId)}`);
      renderPlaceDetail(payload.place);
    } catch (error) {
      elements.birdMapDetail.innerHTML = `<div class="empty-state"><strong>详情加载失败</strong><span>${runtime.escapeHtml(error.message)}</span></div>`;
    }
  }

  function renderPlaceDetail(place) {
    if (!place || !elements.birdMapDetail) return;
    elements.birdMapDetail.innerHTML = `
      <header class="bird-map-detail-header">
        <span class="bird-map-detail-kicker">观鸟点</span>
        <h3>${runtime.escapeHtml(place.name)}</h3>
        <p>${runtime.escapeHtml([place.cityName, place.districtName].filter(Boolean).join(" · "))}</p>
        <div class="bird-map-detail-stats"><span>${place.reportCount.toLocaleString("zh-CN")} 份记录</span><span>${place.speciesCount.toLocaleString("zh-CN")} 种</span><span>最近 ${runtime.escapeHtml(formatDateTime(place.latestAt))}</span></div>
      </header>
      <section class="bird-map-detail-section" aria-labelledby="birdMapRecentRecordsTitle">
        <h4 id="birdMapRecentRecordsTitle">最近记录</h4>
        <div class="bird-map-record-list">${place.recentRecords.map(renderRecord).join("") || '<span class="hint">暂无记录</span>'}</div>
      </section>
      <section class="bird-map-detail-section" aria-labelledby="birdMapRecentSpeciesTitle">
        <h4 id="birdMapRecentSpeciesTitle">最近出现的鸟</h4>
        <div class="bird-map-species-list">${place.recentSpecies.map((species) => `<button type="button" data-detail-taxon="${runtime.escapeHtml(species.taxonId)}" title="筛选这个鸟种"><strong>${runtime.escapeHtml(species.commonName)}</strong><span>${runtime.escapeHtml(formatDateTime(species.lastSeenAt))} · ${species.recordCount} 次</span></button>`).join("")}</div>
      </section>
    `;
    elements.birdMapDetail.querySelectorAll("[data-detail-taxon]").forEach((button) => {
      button.addEventListener("click", () => selectSpeciesFilter({
        taxonId: button.dataset.detailTaxon,
        commonName: button.querySelector("strong")?.textContent || "该鸟种"
      }, { fit: true }));
    });
  }

  function renderRecord(record) {
    const names = record.species.slice(0, 16).map((species) => species.commonName).join("、");
    return `<article class="bird-map-record"><div><strong>${runtime.escapeHtml(formatDateTime(record.observedAt))}</strong><span>${record.speciesCount} 种</span></div><p>${runtime.escapeHtml(names)}${record.species.length > 16 ? "等" : ""}</p></article>`;
  }

  function buildPersonalPoints() {
    const groups = new Map();
    const speciesFilter = activeSpecies?.commonName || "";
    for (const record of state.personalRecords) {
      if (record.lat == null || record.lng == null) continue;
      if (speciesFilter && record.species !== speciesFilter) continue;
      const projected = wgs84ToGcj02(Number(record.lng), Number(record.lat));
      const key = `${record.location}|${projected.longitude.toFixed(4)},${projected.latitude.toFixed(4)}`;
      if (!groups.has(key)) groups.set(key, { records: [], species: new Set(), projected });
      const group = groups.get(key);
      group.records.push(record);
      group.species.add(record.species);
    }
    personalPlaces = new Map();
    return [...groups.entries()].map(([key, group], index) => {
      group.records.sort((left, right) => right.date.localeCompare(left.date));
      const latest = group.records[0];
      const point = {
        placeId: `personal:${index}:${key}`,
        name: latest.location,
        cityName: "",
        districtName: "",
        longitude: group.projected.longitude,
        latitude: group.projected.latitude,
        reportCount: group.records.length,
        speciesCount: group.species.size,
        latestAt: latest.date,
        speciesLastSeenAt: speciesFilter ? latest.date : null
      };
      personalPlaces.set(point.placeId, { ...point, records: group.records });
      return point;
    });
  }

  function renderPersonalPlaceDetail(place) {
    if (!elements.birdMapDetail || !place) return;
    const species = new Map();
    for (const record of place.records) {
      if (!species.has(record.species)) species.set(record.species, { name: record.species, lastSeen: record.date, count: 0 });
      species.get(record.species).count += 1;
    }
    elements.birdMapDetail.innerHTML = `
      <header class="bird-map-detail-header"><span class="bird-map-detail-kicker">个人地点</span><h3>${runtime.escapeHtml(place.name)}</h3><div class="bird-map-detail-stats"><span>${place.reportCount} 条记录</span><span>${place.speciesCount} 种</span><span>最近 ${runtime.escapeHtml(formatDateTime(place.latestAt))}</span></div></header>
      <section class="bird-map-detail-section"><h4>最近记录</h4><div class="bird-map-record-list">${place.records.slice(0, 12).map((record) => `<article class="bird-map-record"><div><strong>${runtime.escapeHtml(formatDateTime(record.date))}</strong><span>${runtime.escapeHtml(record.species)}</span></div>${record.notes ? `<p>${runtime.escapeHtml(record.notes)}</p>` : ""}</article>`).join("")}</div></section>
      <section class="bird-map-detail-section"><h4>这里看过的鸟</h4><div class="bird-map-species-list">${[...species.values()].map((item) => `<button type="button" data-personal-species="${runtime.escapeHtml(item.name)}"><strong>${runtime.escapeHtml(item.name)}</strong><span>${item.count} 次 · ${runtime.escapeHtml(item.lastSeen)}</span></button>`).join("")}</div></section>
    `;
    elements.birdMapDetail.querySelectorAll("[data-personal-species]").forEach((button) => {
      button.addEventListener("click", () => selectSpeciesFilter({ commonName: button.dataset.personalSpecies, taxonId: button.dataset.personalSpecies }, { fit: true }));
    });
  }

  let speciesSearchTimer = null;
  function scheduleSpeciesSearch() {
    window.clearTimeout(speciesSearchTimer);
    speciesSearchTimer = window.setTimeout(searchSpecies, 180);
  }

  async function searchSpecies() {
    const query = String(elements.birdMapSpeciesSearch?.value || "").trim();
    if (!query) return clearSpeciesSuggestions();
    try {
      let results;
      if (activeMode === "personal") {
        results = [...new Set(state.personalRecords.map((record) => record.species))]
          .filter((name) => name.includes(query)).slice(0, 12)
          .map((name) => ({ taxonId: name, commonName: name, scientificName: "", placeCount: null }));
      } else {
        results = (await fetchJson(`/api/map/species?q=${encodeURIComponent(query)}&limit=12`)).species;
      }
      renderSpeciesSuggestions(results);
    } catch (error) {
      setMapMessage(`鸟种搜索失败：${error.message}`, true);
      clearSpeciesSuggestions();
    }
  }

  function renderSpeciesSuggestions(results) {
    if (!elements.birdMapSpeciesResults) return;
    elements.birdMapSpeciesResults.hidden = false;
    elements.birdMapSpeciesResults.innerHTML = results.length ? results.map((species) => `
      <button type="button" role="option" data-taxon-id="${runtime.escapeHtml(species.taxonId)}" data-common-name="${runtime.escapeHtml(species.commonName)}" data-scientific-name="${runtime.escapeHtml(species.scientificName || "")}">
        <span><strong>${runtime.escapeHtml(species.commonName)}</strong>${species.scientificName ? `<small>${runtime.escapeHtml(species.scientificName)}</small>` : ""}</span>
        ${species.placeCount == null ? "" : `<span>${species.placeCount} 个点</span>`}
      </button>
    `).join("") : '<div class="bird-map-search-empty">没有匹配鸟种</div>';
  }

  function clearSpeciesSuggestions() {
    if (!elements.birdMapSpeciesResults) return;
    elements.birdMapSpeciesResults.hidden = true;
    elements.birdMapSpeciesResults.innerHTML = "";
  }

  function selectSpeciesFilter(species, options = {}) {
    activeSpecies = species;
    if (elements.birdMapSpeciesSearch) elements.birdMapSpeciesSearch.value = species.commonName || "";
    clearSpeciesSuggestions();
    updateSpeciesFilterUi();
    fitSpeciesOnNextRefresh = Boolean(options.fit);
    refreshVisiblePoints();
  }

  function clearSpeciesFilter() {
    activeSpecies = null;
    if (elements.birdMapSpeciesSearch) elements.birdMapSpeciesSearch.value = "";
    updateSpeciesFilterUi();
    refreshVisiblePoints();
  }

  function updateSpeciesFilterUi() {
    if (!elements.birdMapActiveSpecies || !elements.birdMapClearSpecies) return;
    elements.birdMapActiveSpecies.hidden = !activeSpecies;
    elements.birdMapClearSpecies.hidden = !activeSpecies;
    elements.birdMapActiveSpecies.textContent = activeSpecies ? `鸟种：${activeSpecies.commonName}` : "";
  }

  function fitMapToPoints(points) {
    if (!points.length || !map) return;
    const markers = points.map((point) => new amap.Marker({ position: [point.longitude, point.latitude] }));
    map.setFitView(markers, false, [64, 64, 64, 64], 14);
  }

  async function openBirdMapForSpecies(species) {
    activeMode = "zhejiang";
    elements.birdMapModeControls?.querySelectorAll("[data-map-mode]").forEach((button) => {
      const active = button.dataset.mapMode === "zhejiang";
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    const section = document.getElementById("birdMapSection");
    runtime.setActiveQuickNav("birdMapSection");
    runtime.markJumpTarget(section);
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
    await initBirdMap();
    const taxonId = String(species?.taxonId || species?.taxon_id || species?.taxonid || "").trim();
    const commonName = String(species?.commonName || species?.taxonname || species?.name || "该鸟种").trim();
    selectSpeciesFilter({ taxonId, commonName, scientificName: species?.latinname || "" }, { fit: true });
  }

  function wgs84ToGcj02(longitude, latitude) {
    if (longitude < 72.004 || longitude > 137.8347 || latitude < 0.8293 || latitude > 55.8271) return { longitude, latitude };
    const a = 6378245;
    const ee = 0.006693421622965943;
    const transformLat = (lng, lat) => -100 + 2 * lng + 3 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng)) + (20 * Math.sin(6 * lng * Math.PI) + 20 * Math.sin(2 * lng * Math.PI)) * 2 / 3 + (20 * Math.sin(lat * Math.PI) + 40 * Math.sin(lat / 3 * Math.PI)) * 2 / 3 + (160 * Math.sin(lat / 12 * Math.PI) + 320 * Math.sin(lat * Math.PI / 30)) * 2 / 3;
    const transformLng = (lng, lat) => 300 + lng + 2 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng)) + (20 * Math.sin(6 * lng * Math.PI) + 20 * Math.sin(2 * lng * Math.PI)) * 2 / 3 + (20 * Math.sin(lng * Math.PI) + 40 * Math.sin(lng / 3 * Math.PI)) * 2 / 3 + (150 * Math.sin(lng / 12 * Math.PI) + 300 * Math.sin(lng / 30 * Math.PI)) * 2 / 3;
    const deltaLat = transformLat(longitude - 105, latitude - 35);
    const deltaLng = transformLng(longitude - 105, latitude - 35);
    const radLat = latitude / 180 * Math.PI;
    const magic = 1 - ee * Math.sin(radLat) * Math.sin(radLat);
    return {
      longitude: longitude + deltaLng * 180 / (a / Math.sqrt(magic) * Math.cos(radLat) * Math.PI),
      latitude: latitude + deltaLat * 180 / (a * (1 - ee) / (magic * Math.sqrt(magic)) * Math.PI)
    };
  }

  Object.assign(runtime, { initBirdMap, openBirdMapForSpecies });
}
