const { createDecipheriv, createHash, publicEncrypt, randomUUID, constants } = require("node:crypto");

const { DEFAULT_PROVINCE, normalizeBirdreportRecord, normalizeBirdreportTaxon } = require("./core");
const { createBirdreportPayload } = require("./service");

const ORIGIN = "https://www.birdreport.cn";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
const TAXON_URL = "https://api.birdreport.cn/front/record/activity/taxon";
const TAXON_REFERER = "https://www.birdreport.cn/home/search/taxon.html";
const RECORD_URL = "https://api.birdreport.cn/front/record/search/page";
const RECORD_REFERER = "https://www.birdreport.cn/home/search/record.html";
const CAPTCHA_URL = "https://api.birdreport.cn/front/code/visited/generate";
const CAPTCHA_VERIFY_URL = "https://api.birdreport.cn/front/code/visited/verify";
const CAPTCHA_REFERER = "https://www.birdreport.cn/home/code/verify.html";
const PAGE_LIMIT = 500;
const RECORD_LIMIT = 100;
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCvxXa98E1uWXnBzXkS2yHUfnBM6n3PCwLdfIox03T91joBvjtoDqiQ5x3tTOfpHs3LtiqMMEafls6b0YWtgB1dse1W5m+FpeusVkCOkQxB4SZDH6tuerIknnmB/Hsq5wgEkIvO5Pff9biig6AyoAkdWpSek/1/B7zYIepYY0lxKQIDAQAB
-----END PUBLIC KEY-----`;
const AES_KEY_SOURCE = "C8EB5514AF5ADDB94B2207B08C66601C";
const AES_IV_SOURCE = "55DD79C6F04E1A67";

function createBirdreportBusinessError(payload) {
  const code = Number(payload?.code ?? payload?.errorCode);
  const message = payload?.msg || payload?.message || payload?.error || `BirdReport error ${payload?.errorCode || payload?.code}`;
  const error = new Error(code === 405 || code === 505 ? "BirdReport 需要验证码或服务拒绝。" : message);
  if (code === 405 || code === 505) {
    error.name = "BirdreportCaptchaError";
  }
  error.code = code;
  return error;
}

function serializeQuery(value) {
  return Object.entries(value || {})
    .filter(([, entryValue]) => entryValue !== undefined && entryValue !== null && entryValue !== "")
    .map(([key, entryValue]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(entryValue))}`)
    .join("&");
}

function parseFormBody(body) {
  return String(body || "")
    .split("&")
    .reduce((result, entry) => {
      if (!entry) {
        return result;
      }
      const separatorIndex = entry.indexOf("=");
      if (separatorIndex === -1) {
        result[entry] = "";
        return result;
      }
      result[entry.slice(0, separatorIndex)] = entry.slice(separatorIndex + 1);
      return result;
    }, {});
}

function sortObjectKeys(source) {
  return Object.keys(source || {})
    .sort()
    .reduce((result, key) => {
      result[key] = source[key];
      return result;
    }, {});
}

function encryptLong(text) {
  const chunks = [];
  const source = Buffer.from(String(text || ""), "utf8");
  const maxChunkSize = 117;

  for (let offset = 0; offset < source.length; offset += maxChunkSize) {
    chunks.push(
      publicEncrypt(
        {
          key: PUBLIC_KEY,
          padding: constants.RSA_PKCS1_PADDING
        },
        source.subarray(offset, offset + maxChunkSize)
      )
    );
  }

  return Buffer.concat(chunks).toString("base64");
}

function buildSignedBirdreportRequest(data, options = {}) {
  const formBody = serializeQuery(data);
  const normalizedPayload = JSON.stringify(sortObjectKeys(parseFormBody(formBody)));
  const timestamp = String(options.timestamp || Date.now());
  const requestId = String(options.requestId || randomUUID().replaceAll("-", ""));
  const sign = createHash("md5").update(`${normalizedPayload}${requestId}${timestamp}`).digest("hex");
  const encryptPayload = options.encryptPayload || encryptLong;

  return {
    body: encryptPayload(normalizedPayload),
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Origin: ORIGIN,
      "User-Agent": USER_AGENT,
      timestamp,
      requestId,
      sign
    }
  };
}

function decodeEncryptedBirdreportData(payload) {
  const attempts = [
    ["aes-256-cbc", Buffer.from(AES_KEY_SOURCE, "utf8"), Buffer.from(AES_IV_SOURCE, "utf8")],
    ["aes-128-cbc", Buffer.from(AES_KEY_SOURCE, "hex"), Buffer.from(`${AES_IV_SOURCE}${AES_IV_SOURCE}`, "hex")]
  ];

  for (const [algorithm, key, iv] of attempts) {
    try {
      const decipher = createDecipheriv(algorithm, key, iv);
      const decoded = Buffer.concat([decipher.update(Buffer.from(String(payload), "base64")), decipher.final()]).toString("utf8");
      return JSON.parse(decoded || "[]");
    } catch {
      // Try the next known BirdReport AES variant.
    }
  }

  throw new Error("BirdReport 返回数据解码失败。");
}

function decodeBirdreportPayload(payload) {
  if (!payload) {
    return [];
  }
  if (typeof payload !== "string") {
    return payload;
  }

  const trimmed = payload.trim();
  if (!trimmed) {
    return [];
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return decodeEncryptedBirdreportData(trimmed);
  }
}

function getBirdreportItems(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const candidates = [payload.list, payload.rows, payload.records, payload.items, payload.result, payload.data, payload.species];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }
  for (const candidate of candidates) {
    const nested = getBirdreportItems(candidate);
    if (nested.length) {
      return nested;
    }
  }
  return [];
}

function normalizeBirdreportTaxonPage(response) {
  const decoded = decodeBirdreportPayload(response?.data);
  const decodedItems = getBirdreportItems(decoded);
  const sourceItems = decodedItems.length ? decodedItems : getBirdreportItems(response);
  return sourceItems.map(normalizeBirdreportTaxon).filter((item) => item.key);
}

function normalizeBirdreportRecordPage(response) {
  const decoded = decodeBirdreportPayload(response?.data);
  const decodedItems = getBirdreportItems(decoded);
  const sourceItems = decodedItems.length ? decodedItems : getBirdreportItems(response);
  return sourceItems.map(normalizeBirdreportRecord).filter(Boolean);
}

function createCookieJar() {
  const cookies = new Map();
  return {
    header() {
      return [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
    },
    store(headers) {
      const raw = headers?.getSetCookie ? headers.getSetCookie() : headers?.get?.("set-cookie");
      const lines = Array.isArray(raw) ? raw : raw ? [raw] : [];
      for (const line of lines) {
        const firstPart = String(line).split(";")[0];
        const separatorIndex = firstPart.indexOf("=");
        if (separatorIndex > 0) {
          cookies.set(firstPart.slice(0, separatorIndex).trim(), firstPart.slice(separatorIndex + 1).trim());
        }
      }
    }
  };
}

function createBirdreportClient(options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const signRequest = options.signRequest || buildSignedBirdreportRequest;
  const cookieJar = createCookieJar();

  function withBirdreportHeaders(extraHeaders = {}) {
    const cookieHeader = cookieJar.header();
    return {
      Accept: "application/json, text/plain, */*",
      Origin: ORIGIN,
      "User-Agent": USER_AGENT,
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...extraHeaders
    };
  }

  async function postBirdreport(url, referer, data) {
    const signedRequest = signRequest(data);
    const response = await fetchImpl(url, {
      method: "POST",
      headers: withBirdreportHeaders({
        ...signedRequest.headers,
        Referer: referer
      }),
      body: signedRequest.body
    });
    cookieJar.store(response.headers);
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`BirdReport HTTP ${response.status}: ${text || "请求失败"}`);
    }
    const payload = text ? JSON.parse(text) : {};
    if (payload?.success === false || payload?.errorCode) {
      throw createBirdreportBusinessError(payload);
    }
    return payload;
  }

  async function fetchCaptchaImage() {
    const response = await fetchImpl(`${CAPTCHA_URL}?timestamp=${Date.now()}`, {
      method: "GET",
      headers: withBirdreportHeaders({
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        Referer: CAPTCHA_REFERER
      })
    });
    cookieJar.store(response.headers);
    const body = Buffer.from(await response.arrayBuffer());
    if (!response.ok) {
      throw new Error(`BirdReport 验证码加载失败：HTTP ${response.status}`);
    }
    return {
      body,
      contentType: response.headers?.get?.("content-type") || "image/png"
    };
  }

  async function verifyCaptcha(code) {
    const response = await fetchImpl(CAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: withBirdreportHeaders({
        "Content-Type": "application/json; charset=UTF-8",
        Referer: CAPTCHA_REFERER
      }),
      body: JSON.stringify({ code: String(code || "").trim() })
    });
    cookieJar.store(response.headers);
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`BirdReport 验证码校验失败：HTTP ${response.status}`);
    }
    const payload = text ? JSON.parse(text) : {};
    if (!payload?.success) {
      throw new Error(payload?.msg || payload?.message || "验证码不正确");
    }
    return payload;
  }

  async function fetchAllTaxa(payload, requestOptions = {}) {
    const limit = Number(requestOptions.limit) || PAGE_LIMIT;
    const firstPage = await postBirdreport(TAXON_URL, TAXON_REFERER, { ...payload, page: 1, limit });
    const firstItems = normalizeBirdreportTaxonPage(firstPage);
    const total = Math.max(Number(firstPage?.count) || firstItems.length, firstItems.length);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const items = [...firstItems];

    for (let page = 2; page <= totalPages; page += 1) {
      const response = await postBirdreport(TAXON_URL, TAXON_REFERER, { ...payload, page, limit });
      items.push(...normalizeBirdreportTaxonPage(response));
    }

    const seen = new Set();
    return items.filter((item) => {
      if (!item.key || seen.has(item.key)) {
        return false;
      }
      seen.add(item.key);
      return true;
    });
  }

  async function fetchRecordsByTaxon(species, date, requestOptions = {}) {
    const limit = Number(requestOptions.limit) || RECORD_LIMIT;
    const taxonId = String(species?.taxon_id || species?.taxonid || species?.key || "").trim();
    if (!taxonId) {
      return [];
    }

    const basePayload = createBirdreportPayload({
      province: requestOptions.province || DEFAULT_PROVINCE,
      startTime: date,
      endTime: date,
      state: "2"
    });
    const firstPage = await postBirdreport(RECORD_URL, RECORD_REFERER, { ...basePayload, taxonid: taxonId, page: 1, limit });
    const firstItems = normalizeBirdreportRecordPage(firstPage);
    const total = Math.max(Number(firstPage?.count) || firstItems.length, firstItems.length);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const items = [...firstItems];

    for (let page = 2; page <= totalPages; page += 1) {
      const response = await postBirdreport(RECORD_URL, RECORD_REFERER, { ...basePayload, taxonid: taxonId, page, limit });
      items.push(...normalizeBirdreportRecordPage(response));
    }

    return items;
  }

  return {
    fetchCaptchaImage,
    fetchAllTaxa,
    fetchRecordsByTaxon,
    postBirdreport,
    verifyCaptcha
  };
}

module.exports = {
  CAPTCHA_URL,
  CAPTCHA_VERIFY_URL,
  RECORD_URL,
  TAXON_URL,
  buildSignedBirdreportRequest,
  createBirdreportBusinessError,
  createBirdreportClient,
  decodeBirdreportPayload,
  encryptLong,
  normalizeBirdreportRecordPage,
  normalizeBirdreportTaxonPage,
  parseFormBody,
  serializeQuery
};
