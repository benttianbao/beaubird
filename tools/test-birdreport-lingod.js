const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const USERNAME = "Lingod";
const PROVINCE = "浙江省";
const VERSION = "CH4";
const LIMIT = 500;

const endpoint = "https://api.birdreport.cn/front/record/activity/taxon";
const referer = "https://www.birdreport.cn/home/search/taxon.html";
const proxyBaseUrl = String(process.env.BEAUBIRD_PROXY_URL || "").replace(/\/+$/, "");
const write = (text) => process.stdout.write(text);

const context = {
  console,
  navigator: {
    appName: "Netscape",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/123.0.0.0 Safari/537.36"
  },
  atob: (value) => Buffer.from(String(value), "base64").toString("binary")
};
context.window = context;
context.globalThis = context;
context.$ = { ajaxSetup() {} };
context.jQuery = context.$;
vm.createContext(context);

for (const file of ["vendor/crypto-js.min.js", "vendor/jqueryAjax.js", "vendor/aes.util.js"]) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, { filename: file });
}

const publicKey =
  "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCvxXa98E1uWXnBzXkS2yHUfnBM6n3PCwLdfIox03T91joBvjtoDqiQ5x3tTOfpHs3LtiqMMEafls6b0YWtgB1dse1W5m+FpeusVkCOkQxB4SZDH6tuerIknnmB/Hsq5wgEkIvO5Pff9biig6AyoAkdWpSek/1/B7zYIepYY0lxKQIDAQAB";

function dataToJson(data) {
  const result = {};
  for (const item of String(data || "").split("&")) {
    if (!item) {
      continue;
    }
    const pieces = item.split("=");
    result[pieces[0]] = pieces.length === 2 ? pieces[1] : "";
  }
  return result;
}

function sortAscii(source) {
  return Object.keys(source)
    .sort()
    .reduce((result, key) => {
      result[key] = source[key];
      return result;
    }, {});
}

function requestId() {
  const hex = "0123456789abcdef";
  const chars = [];
  for (let index = 0; index < 32; index += 1) {
    chars[index] = hex[Math.floor(Math.random() * 16)];
  }
  chars[14] = "4";
  chars[19] = hex[(parseInt(chars[19], 16) & 3) | 8];
  return chars.join("");
}

function serialize(data) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    if (value != null && value !== "") {
      params.append(key, String(value));
    }
  }
  return params.toString();
}

function signPayload(data) {
  const serialized = serialize(data);
  const payload = JSON.stringify(sortAscii(dataToJson(serialized || "{}")));
  const timestamp = String(Date.parse(new Date()));
  const id = requestId();
  const encrypt = new context.JSEncrypt();
  encrypt.setPublicKey(publicKey);
  return {
    body: encrypt.encryptLong(payload),
    headers: {
      timestamp,
      requestId: id,
      sign: context.MD5(payload + id + timestamp)
    }
  };
}

function decodePayload(value) {
  if (value == null || value === "") {
    return null;
  }
  const trimmed = String(value).trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }
  return JSON.parse(context.BIRDREPORT_APIJS.decode(trimmed));
}

function itemsFrom(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (!payload || typeof payload !== "object") {
    return [];
  }
  for (const key of ["species", "list", "rows", "records", "items", "result", "data"]) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value;
    }
    const nested = itemsFrom(value);
    if (nested.length) {
      return nested;
    }
  }
  return [];
}

async function postTaxon(data) {
  const signed = signPayload(data);
  const response = await fetch(proxyBaseUrl ? `${proxyBaseUrl}/api/birdreport/taxon` : endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json, text/plain, */*",
      "Accept-Encoding": "identity",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Origin: "https://www.birdreport.cn",
      Referer: referer,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
      ...signed.headers
    },
    body: signed.body
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 180)}`);
  }
  if (!response.ok || Number(json.code) >= 400) {
    throw new Error(`HTTP ${response.status}: ${json.msg || text.slice(0, 180)}`);
  }
  return json;
}

async function fetchAll(payload) {
  const first = await postTaxon({ ...payload, page: 1, limit: LIMIT });
  const firstItems = itemsFrom(decodePayload(first.data));
  const total = Math.max(Number(first.count) || firstItems.length, firstItems.length);
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const all = [...firstItems];
  for (let page = 2; page <= totalPages; page += 1) {
    const next = await postTaxon({ ...payload, page, limit: LIMIT });
    all.push(...itemsFrom(decodePayload(next.data)));
  }
  const seen = new Set();
  return all.filter((item) => {
    const key = String(item.taxon_id || item.taxonid || item.id || item.taxonname || item.name || "").trim();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

(async () => {
  const catalog = await fetchAll({
    startTime: "",
    endTime: "",
    province: PROVINCE,
    city: "",
    district: "",
    pointname: "",
    username: "",
    state: "",
    version: VERSION,
    outside_type: 0,
    mode: 0
  });
  const observed = await fetchAll({
    startTime: "",
    endTime: "",
    province: PROVINCE,
    city: "",
    district: "",
    pointname: "",
    username: USERNAME,
    state: "",
    version: VERSION,
    outside_type: 0,
    mode: 1
  });
  write(`${USERNAME} ${observed.length}/${catalog.length}\n`);
})();
