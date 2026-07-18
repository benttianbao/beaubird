// Functions extracted from the legacy script.js features/birdreport/client domain.
export function installBirdreportClient(runtime) {
  const { BIRD_PREP_MACAULAY_MAX_IMAGE_BYTES, BIRD_PREP_MACAULAY_FETCH_TIMEOUT_MS, BIRD_PREP_MACAULAY_FETCH_ATTEMPTS, BIRDREPORT_CORE, BIRDREPORT_PARAM_PUBLIC_KEY, BIRDREPORT_AES_KEY_SOURCE, BIRDREPORT_AES_IV_SOURCE, BIRDREPORT_RARE_SPECIES_PROVINCE, state, elements } = runtime;
  const createBirdreportPayload = (...args) => runtime.createBirdreportPayload(...args);
  const dedupeBirdreportTaxa = (...args) => runtime.dedupeBirdreportTaxa(...args);
  const fetchWithTimeoutAndRetry = (...args) => runtime.fetchWithTimeoutAndRetry(...args);
  const formatBirdreportDateTime = (...args) => runtime.formatBirdreportDateTime(...args);
  const getBirdreportProxyBaseUrl = (...args) => runtime.getBirdreportProxyBaseUrl(...args);
  const getDefaultBirdreportProxyUrl = (...args) => runtime.getDefaultBirdreportProxyUrl(...args);
  const loadBirdreportProvinces = (...args) => runtime.loadBirdreportProvinces(...args);
  const readImageDimensions = (...args) => runtime.readImageDimensions(...args);
  const setBirdPrepMessage = (...args) => runtime.setBirdPrepMessage(...args);
  const setBirdreportMessage = (...args) => runtime.setBirdreportMessage(...args);
  const sortBirdreportRecordsByObservationTimeDesc = (...args) => runtime.sortBirdreportRecordsByObservationTimeDesc(...args);

async function initBirdreportProxy() {
  if (!canUseBirdreportProxy()) {
    if (elements.queryBirdreportProxyBtn) {
      elements.queryBirdreportProxyBtn.disabled = true;
    }
    if (elements.queryBirdPrepSpeciesBtn) {
      elements.queryBirdPrepSpeciesBtn.disabled = true;
    }
    return;
  }

  try {
    await loadBirdreportProvinces();
  } catch (error) {
    setBirdreportMessage(`BirdReport 初始化失败：${error.message}`, true);
    setBirdPrepMessage(`BirdReport 初始化失败：${error.message}`, true);
  }
}

function canUseBirdreportProxy(messageSetter = setBirdreportMessage) {
  if (typeof window.fetch !== "function") {
    messageSetter("当前环境缺少 fetch，暂时无法连接 BirdReport。", true);
    return false;
  }

  if (!window.JSEncrypt || typeof window.MD5 !== "function") {
    messageSetter("BirdReport 请求签名依赖未加载，暂时无法连接。", true);
    return false;
  }

  return true;
}

async function fetchRecentBirdreportRecordsByTaxon(species, options = {}) {
  const taxonId = String(species?.taxon_id || species?.taxonid || species?.key || "").trim();
  const taxonName = String(species?.taxonname || species?.name || "").trim();
  if (!taxonId && !taxonName) {
    throw new Error("缺少 BirdReport 鸟种编号或鸟种名称。");
  }

  const displayLimit = Math.max(1, Math.min(20, Number(options.limit) || 10));
  return fetchBirdreportRecordWindowByTaxon(
    { taxonId, taxonName },
    { startTime: "", endTime: "", label: "全历史" },
    { displayLimit }
  );
}

async function fetchBirdreportRecordWindowByTaxon(taxonQuery, windowRange, options = {}) {
  const taxonId = String(taxonQuery?.taxonId || taxonQuery || "").trim();
  const taxonName = String(taxonQuery?.taxonName || "").trim();
  const displayLimit = Math.max(1, Math.min(20, Number(options.displayLimit) || 10));
  const basePayload = createBirdreportPayload({
    province: BIRDREPORT_RARE_SPECIES_PROVINCE,
    startTime: windowRange.startTime,
    endTime: windowRange.endTime,
    state: ""
  });
  const reportPayload = {
    ...basePayload,
    ...(taxonId ? { taxonid: taxonId } : {}),
    ...(taxonName
      ? {
          taxonname: taxonName,
          taxon_name: taxonName,
          name: taxonName
        }
      : {})
  };
  const records = await fetchBirdreportReportPages(reportPayload, {
    maxPages: 1,
    pageLimit: displayLimit,
    displayLimit,
    stopAtDisplayLimit: true,
    checkCaptcha: true,
    filterRecord: isPublicBirdreportLocationRecord
  });

  return records.slice(0, displayLimit);
}

function isBirdreportCaptchaResponse(response) {
  const code = Number(response?.code);
  return code === 505 || code === 405;
}

function createBirdreportCaptchaError() {
  const error = new Error("BirdReport 需要验证码。");
  error.name = "BirdreportCaptchaError";
  return error;
}

function isBirdreportCaptchaError(error) {
  return error?.name === "BirdreportCaptchaError";
}

async function loadBirdreportCaptchaImage() {
  const baseUrl = getBirdreportProxyBaseUrl();
  const response = await fetch(`${baseUrl}/api/birdreport/captcha?ts=${Date.now()}`, {
    method: "GET",
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

async function verifyBirdreportCaptcha(code) {
  const baseUrl = getBirdreportProxyBaseUrl();
  const response = await fetch(`${baseUrl}/api/birdreport/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ code })
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const result = await response.json();
  if (!result?.success) {
    throw new Error(result?.msg || result?.message || "验证码不正确");
  }

  return result;
}

function createBirdreportRecordSearchPayload(basePayload, { taxonId = "", taxonName = "" } = {}) {
  return BIRDREPORT_CORE.createBirdreportRecordSearchPayload(basePayload, { taxonId, taxonName });
}

async function birdreportProxyGetJson(path) {
  const response = await birdreportProxyGet(path);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (response.ok) {
    return payload;
  }
  throw new Error(payload?.error || payload?.msg || `HTTP ${response.status}`);
}

async function birdreportProxyGetImage(path) {
  const response = await birdreportProxyGet(path);
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const payload = await response.json();
      message = payload?.error || payload?.msg || message;
    } catch {
      // Keep the HTTP status message.
    }
    throw new Error(message);
  }

  const contentType = String(response.headers.get("content-type") || "").split(";")[0].toLowerCase();
  if (!["image/jpeg", "image/png"].includes(contentType)) {
    throw new Error(`Macaulay Library 返回了不支持的图片类型：${contentType || "unknown"}`);
  }
  const blob = await response.blob();
  if (!blob.size || blob.size > BIRD_PREP_MACAULAY_MAX_IMAGE_BYTES) {
    throw new Error("Macaulay Library 图片为空或超过大小限制。");
  }
  const dimensions = await readImageDimensions(blob);
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    contentType,
    width: dimensions.width,
    height: dimensions.height
  };
}

function birdreportProxyGet(path) {
  const baseUrl = getBirdreportProxyBaseUrl();
  const url = `${baseUrl}${path}`;
  if (String(path || "").startsWith("/api/media/macaulay/")) {
    return fetchWithTimeoutAndRetry(url, {
      method: "GET"
    }, {
      attempts: BIRD_PREP_MACAULAY_FETCH_ATTEMPTS,
      timeoutMs: BIRD_PREP_MACAULAY_FETCH_TIMEOUT_MS
    });
  }
  return fetch(url, { method: "GET" });
}

async function fetchAllBirdreportTaxa(payload, options = {}) {
  const { onProgress } = options;
  const limit = 500;
  const firstPage = await birdreportProxyPost("/api/birdreport/taxon", {
    ...payload,
    page: 1,
    limit
  });
  const firstItems = normalizeBirdreportTaxonPage(firstPage);
  const total = Math.max(Number(firstPage?.count) || firstItems.length, firstItems.length);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (totalPages === 1) {
    return dedupeBirdreportTaxa(firstItems);
  }

  const pages = [];
  for (let page = 2; page <= totalPages; page += 1) {
    pages.push(page);
  }

  const rest = [];
  for (const page of pages) {
    onProgress?.(`正在查询 BirdReport 鸟种... 第 ${page}/${totalPages} 页`);
    const response = await birdreportProxyPost("/api/birdreport/taxon", {
      ...payload,
      page,
      limit
    });
    rest.push(...normalizeBirdreportTaxonPage(response));
  }

  return dedupeBirdreportTaxa([...firstItems, ...rest]);
}

async function fetchBirdreportRecordsByTaxon(species, targetDate, options = {}) {
  const taxonId = String(species?.taxon_id || species?.taxonid || species?.key || "").trim();
  if (!taxonId) {
    throw new Error("缺少 BirdReport 鸟种编号，暂时无法查询观测地点。");
  }

  const { onProgress } = options;
  const basePayload = createBirdreportPayload({
    province: BIRDREPORT_RARE_SPECIES_PROVINCE,
    startTime: targetDate,
    endTime: targetDate,
    state: "2"
  });
  return fetchBirdreportRecordPages(
    {
      ...basePayload,
      taxonid: taxonId
    },
    {
      onProgress,
      progressLabel: "正在加载观测地点..."
    }
  );
}

async function fetchBirdreportRecordsForCurrentQuery(species, payload, options = {}) {
  const taxonId = String(species?.taxon_id || species?.taxonid || species?.key || "").trim();
  const taxonName = String(species?.taxonname || species?.name || "").trim();
  if (!taxonId && !taxonName) {
    throw new Error("缺少 BirdReport 鸟种编号或名称，暂时无法查询地点。");
  }

  if (!payload) {
    throw new Error("缺少 BirdReport 查询条件，请先重新查询鸟种列表。");
  }

  const { onProgress } = options;
  const displayLimit = Math.max(1, Math.min(20, Number(options.limit) || 10));
  const maxPages = Math.max(1, Math.min(8, Number(options.maxPages) || 4));
  const basePayload = {
    ...payload,
    taxonid: taxonId,
    taxonname: taxonName,
    state: "2"
  };

  const records = await fetchBirdreportRecordPages(basePayload, {
    onProgress,
    progressLabel: "正在加载公开地点...",
    maxPages,
    displayLimit,
    stopAtDisplayLimit: true,
    checkCaptcha: true,
    filterRecord: isPublicBirdreportLocationRecord
  });

  return records.sort(sortBirdreportRecordsByObservationTimeDesc).slice(0, displayLimit);
}

async function fetchBirdreportReportPages(reportPayload, options = {}) {
  return fetchBirdreportRecordPages(reportPayload, {
    ...options,
    path: "/api/birdreport/report"
  });
}

async function fetchBirdreportRecordPages(recordPayload, options = {}) {
  const {
    path = "/api/birdreport/record",
    onProgress,
    pageLimit = 100,
    maxPages = Number.POSITIVE_INFINITY,
    displayLimit = Number.POSITIVE_INFINITY,
    stopAtDisplayLimit = false,
    checkCaptcha = false,
    progressLabel = "正在加载观测地点...",
    filterRecord = () => true
  } = options;
  const limit = Math.max(1, Number(pageLimit) || 100);
  const firstPage = await birdreportProxyPost(path, {
    ...recordPayload,
    page: 1,
    limit
  });
  if (checkCaptcha && isBirdreportCaptchaResponse(firstPage)) {
    throw createBirdreportCaptchaError();
  }

  const firstItems = normalizeBirdreportRecordPage(firstPage).filter(filterRecord);
  const total = Math.max(Number(firstPage?.count) || firstItems.length, firstItems.length);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const pagesToFetch = Math.min(totalPages, Math.max(1, Number(maxPages) || 1));
  const records = [...firstItems];

  for (let page = 2; page <= pagesToFetch; page += 1) {
    if (stopAtDisplayLimit && records.length >= displayLimit) {
      break;
    }
    onProgress?.(`${progressLabel} 第 ${page}/${pagesToFetch} 页`);
    const response = await birdreportProxyPost(path, {
      ...recordPayload,
      page,
      limit
    });
    if (checkCaptcha && isBirdreportCaptchaResponse(response)) {
      throw createBirdreportCaptchaError();
    }
    records.push(...normalizeBirdreportRecordPage(response).filter(filterRecord));
  }

  return records;
}

function isPublicBirdreportLocationRecord(record) {
  return record.isPublic && !record.isHiddenLocation;
}

function normalizeBirdreportTaxonPage(response) {
  return BIRDREPORT_CORE.normalizeBirdreportTaxonPage(response, { decodePayload: decodeBirdreportPayload });
}

function normalizeBirdreportRecordPage(response) {
  return BIRDREPORT_CORE.normalizeBirdreportRecordPage(response, { decodePayload: decodeBirdreportPayload }).map((record) => ({
    ...record,
    serialId: record.isHiddenLocation ? "*************" : record.serialId,
    pointName: record.isHiddenLocation ? "*** *** *** ********" : record.pointName,
    startTimeLabel: formatBirdreportDateTime(record.startTime),
    endTimeLabel: formatBirdreportDateTime(record.endTime)
  }));
}

function birdreportProxyPost(path, data) {
  const baseUrl = getBirdreportProxyBaseUrl();
  const signedRequest = buildBirdreportSignedRequest(data);

  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      ...signedRequest.headers
    },
    body: signedRequest.body
  }).then(async (response) => {
    let payload = null;
    const text = await response.text();
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    if (response.ok) {
      return payload;
    }

    const rawMessage =
      payload?.error ||
      payload?.msg ||
      (typeof payload === "string" ? payload : "") ||
      `HTTP ${response.status}`;
    const message =
      String(rawMessage).trim() === "Unknown endpoint"
        ? `BirdReport 后台还没有 ${path}，请重启后台以加载最新接口`
        : rawMessage;
    throw new Error(message);
  });
}

function buildBirdreportSignedRequest(data) {
  const serializedData = serializeBirdreportRequestData(data);
  const normalizedPayload = JSON.stringify(sortBirdreportObjectKeys(parseBirdreportRequestData(serializedData)));
  const timestamp = String(Date.now());
  const requestId = generateBirdreportRequestId();
  const sign = window.MD5(`${normalizedPayload}${requestId}${timestamp}`);
  const encrypt = new window.JSEncrypt();
  encrypt.setPublicKey(BIRDREPORT_PARAM_PUBLIC_KEY);
  const encryptedBody = encrypt.encryptLong(normalizedPayload);

  if (!encryptedBody) {
    throw new Error("BirdReport 请求体加密失败。");
  }

  return {
    body: encryptedBody,
    headers: {
      timestamp,
      requestId,
      sign
    }
  };
}

function serializeBirdreportRequestData(data) {
  return BIRDREPORT_CORE.serializeBirdreportRequestData(data);
}

function parseBirdreportRequestData(serializedData) {
  return BIRDREPORT_CORE.parseBirdreportRequestData(serializedData);
}

function sortBirdreportObjectKeys(source) {
  return BIRDREPORT_CORE.sortBirdreportObjectKeys(source);
}

function generateBirdreportRequestId() {
  const hexDigits = "0123456789abcdef";
  const output = [];
  for (let index = 0; index < 32; index += 1) {
    output[index] = hexDigits[Math.floor(Math.random() * 16)];
  }
  output[14] = "4";
  output[19] = hexDigits[(Number.parseInt(output[19], 16) & 0x3) | 0x8];
  return output.join("");
}

function decodeBirdreportPayload(payload) {
  if (!payload) {
    return [];
  }

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (!trimmed) {
      return [];
    }

    try {
      return JSON.parse(trimmed);
    } catch (jsonError) {
      const errors = [];
      if (typeof window.BIRDREPORT_APIJS?.decode === "function") {
        try {
          const decodedText = window.BIRDREPORT_APIJS.decode.call(window.BIRDREPORT_APIJS, trimmed) || "";
          return JSON.parse(decodedText || "[]");
        } catch (decodeError) {
          errors.push(decodeError);
        }
      }

      try {
        return JSON.parse(decodeBirdreportPayloadWithCryptoJs(trimmed) || "[]");
      } catch (fallbackError) {
        errors.push(fallbackError);
      }

      throw new Error(
        errors.length
          ? "BirdReport 返回数据解码失败，请刷新页面后重试。"
          : "BirdReport 解码依赖未加载，请刷新页面后重试。"
      );
    }
  }

  return payload;
}

function decodeBirdreportPayloadWithCryptoJs(payload) {
  if (!window.CryptoJS?.AES || !window.CryptoJS?.enc) {
    throw new Error("BirdReport 解码依赖未加载，暂时不能读取返回结果。");
  }

  const keySource = decodeBirdreportDecimalPairs(BIRDREPORT_AES_KEY_SOURCE);
  const ivSource = decodeBirdreportDecimalPairs(BIRDREPORT_AES_IV_SOURCE);
  const variants = [
    [window.CryptoJS.enc.Utf8, window.CryptoJS.enc.Utf8],
    [window.CryptoJS.enc.Utf8, window.CryptoJS.enc.Hex],
    [window.CryptoJS.enc.Hex, window.CryptoJS.enc.Hex],
    [window.CryptoJS.enc.Hex, window.CryptoJS.enc.Utf8]
  ];
  const errors = [];

  for (const [keyEncoding, ivEncoding] of variants) {
    try {
      const key = keyEncoding.parse(keySource);
      const iv = ivEncoding.parse(ivSource);
      const decoded = window.CryptoJS.AES.decrypt(payload, key, {
        iv,
        mode: window.CryptoJS.mode.CBC,
        padding: window.CryptoJS.pad.Pkcs7
      }).toString(window.CryptoJS.enc.Utf8);
      if (!decoded) {
        continue;
      }
      JSON.parse(decoded);
      return decoded;
    } catch (error) {
      errors.push(error);
    }
  }

  throw new Error(errors.length ? "BirdReport 返回数据解码失败。" : "BirdReport 解码依赖未加载。");
}

function decodeBirdreportDecimalPairs(source) {
  let output = "";
  for (let index = 0; index < source.length; index += 2) {
    output += String.fromCharCode(Number(source.slice(index, index + 2)));
  }
  return output;
}

function normalizeProxyBaseUrl(value) {
  const trimmed = String(value || "").trim() || getDefaultBirdreportProxyUrl();
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

  Object.assign(runtime, {
    initBirdreportProxy,
    canUseBirdreportProxy,
    fetchRecentBirdreportRecordsByTaxon,
    fetchBirdreportRecordWindowByTaxon,
    isBirdreportCaptchaResponse,
    createBirdreportCaptchaError,
    isBirdreportCaptchaError,
    loadBirdreportCaptchaImage,
    verifyBirdreportCaptcha,
    createBirdreportRecordSearchPayload,
    birdreportProxyGetJson,
    birdreportProxyGetImage,
    birdreportProxyGet,
    fetchAllBirdreportTaxa,
    fetchBirdreportRecordsByTaxon,
    fetchBirdreportRecordsForCurrentQuery,
    fetchBirdreportReportPages,
    fetchBirdreportRecordPages,
    isPublicBirdreportLocationRecord,
    normalizeBirdreportTaxonPage,
    normalizeBirdreportRecordPage,
    birdreportProxyPost,
    buildBirdreportSignedRequest,
    serializeBirdreportRequestData,
    parseBirdreportRequestData,
    sortBirdreportObjectKeys,
    generateBirdreportRequestId,
    decodeBirdreportPayload,
    decodeBirdreportPayloadWithCryptoJs,
    decodeBirdreportDecimalPairs,
    normalizeProxyBaseUrl
  });
}
