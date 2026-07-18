// Functions extracted from the legacy script.js features/birdreport/regions domain.
export function installBirdreportRegions(runtime) {
  const { elements } = runtime;
  const birdreportProxyPost = (...args) => runtime.birdreportProxyPost(...args);
  const canUseBirdreportProxy = (...args) => runtime.canUseBirdreportProxy(...args);
  const clearBirdPrepSpeciesResults = (...args) => runtime.clearBirdPrepSpeciesResults(...args);
  const clearBirdreportSpeciesResults = (...args) => runtime.clearBirdreportSpeciesResults(...args);
  const setBirdPrepMessage = (...args) => runtime.setBirdPrepMessage(...args);
  const setBirdreportMessage = (...args) => runtime.setBirdreportMessage(...args);

async function handleBirdreportProvinceChange() {
  resetSelectOptions(elements.birdreportCity, "请选择市");
  resetSelectOptions(elements.birdreportDistrict, "请选择区");
  clearBirdreportSpeciesResults();

  const province = elements.birdreportProvince.value;
  if (!province) {
    return;
  }

  try {
    const selectedOption = elements.birdreportProvince.selectedOptions[0];
    const provinceCode = selectedOption?.dataset.code || "";
    const response = await birdreportProxyPost("/api/birdreport/city", { province_code: provinceCode });
    renderBirdreportRegionOptions(elements.birdreportCity, response.data || [], "city_name", "city_code", "请选择市");
  } catch (error) {
    setBirdreportMessage(`加载城市失败：${error.message}`, true);
  }
}

async function handleBirdreportCityChange() {
  resetSelectOptions(elements.birdreportDistrict, "请选择区");
  clearBirdreportSpeciesResults();

  const city = elements.birdreportCity.value;
  if (!city) {
    return;
  }

  try {
    const selectedOption = elements.birdreportCity.selectedOptions[0];
    const cityCode = selectedOption?.dataset.code || "";
    const response = await birdreportProxyPost("/api/birdreport/district", { city_code: cityCode });
    renderBirdreportRegionOptions(elements.birdreportDistrict, response.data || [], "district_name", null, "请选择区");
  } catch (error) {
    setBirdreportMessage(`加载区县失败：${error.message}`, true);
  }
}

async function loadBirdreportProvinces() {
  resetSelectOptions(elements.birdreportProvince, "省份加载中...");
  resetSelectOptions(elements.birdreportCity, "请选择市");
  resetSelectOptions(elements.birdreportDistrict, "请选择区");
  resetSelectOptions(elements.birdPrepProvince, "省份加载中...");
  resetSelectOptions(elements.birdPrepCity, "请选择市");
  resetSelectOptions(elements.birdPrepDistrict, "请选择区");
  const response = await birdreportProxyPost("/api/birdreport/province");
  renderBirdreportRegionOptions(elements.birdreportProvince, response.data || [], "province_name", "province_code", "请选择省");
  renderBirdreportRegionOptions(elements.birdPrepProvince, response.data || [], "province_name", "province_code", "请选择省");
  setBirdreportMessage("BirdReport 已连接，可以开始查询。");
  setBirdPrepMessage("BirdReport 已连接，可以查询地区鸟种。");
}

async function handleBirdPrepProvinceChange() {
  resetSelectOptions(elements.birdPrepCity, "请选择市");
  resetSelectOptions(elements.birdPrepDistrict, "请选择区");
  clearBirdPrepSpeciesResults();

  const province = elements.birdPrepProvince.value;
  if (!province) {
    return;
  }

  if (!canUseBirdreportProxy(setBirdPrepMessage)) {
    return;
  }

  try {
    const selectedOption = elements.birdPrepProvince.selectedOptions[0];
    const provinceCode = selectedOption?.dataset.code || "";
    const response = await birdreportProxyPost("/api/birdreport/city", { province_code: provinceCode });
    renderBirdreportRegionOptions(elements.birdPrepCity, response.data || [], "city_name", "city_code", "请选择市");
    setBirdPrepMessage(`已加载 ${province} 的城市列表。`);
  } catch (error) {
    setBirdPrepMessage(`加载城市失败：${error.message}`, true);
  }
}

async function handleBirdPrepCityChange() {
  resetSelectOptions(elements.birdPrepDistrict, "请选择区");
  clearBirdPrepSpeciesResults();

  const city = elements.birdPrepCity.value;
  if (!city) {
    return;
  }

  if (!canUseBirdreportProxy(setBirdPrepMessage)) {
    return;
  }

  try {
    const selectedOption = elements.birdPrepCity.selectedOptions[0];
    const cityCode = selectedOption?.dataset.code || "";
    const response = await birdreportProxyPost("/api/birdreport/district", { city_code: cityCode });
    renderBirdreportRegionOptions(elements.birdPrepDistrict, response.data || [], "district_name", null, "请选择区");
    setBirdPrepMessage(`已加载 ${city} 的区县列表。`);
  } catch (error) {
    setBirdPrepMessage(`加载区县失败：${error.message}`, true);
  }
}

function renderBirdreportRegionOptions(target, items, labelKey, codeKey, placeholder) {
  if (!target) {
    return;
  }
  resetSelectOptions(target, placeholder);
  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = String(item[labelKey] || "").trim();
    option.textContent = option.value;
    if (codeKey) {
      option.dataset.code = String(item[codeKey] || "").trim();
    }
    target.append(option);
  });
}

function resetSelectOptions(target, placeholder) {
  if (!target) {
    return;
  }
  target.innerHTML = "";
  const option = document.createElement("option");
  option.value = "";
  option.textContent = placeholder;
  target.append(option);
}

  Object.assign(runtime, {
    handleBirdreportProvinceChange,
    handleBirdreportCityChange,
    loadBirdreportProvinces,
    handleBirdPrepProvinceChange,
    handleBirdPrepCityChange,
    renderBirdreportRegionOptions,
    resetSelectOptions
  });
}
