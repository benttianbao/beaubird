const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { createSiteServer } = require("../server/site/app");
const { createUser, initializeSiteDatabase } = require("../server/site/store");

const ROOT = path.resolve(__dirname, "..");
const USERNAME = "Lingod";
const PROVINCE = "浙江省";
const VERSION = "CH4";
const LIMIT = 500;
const write = (text) => process.stdout.write(text);
const writeError = (text) => process.stderr.write(text);
const PUBLIC_KEY =
  "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCvxXa98E1uWXnBzXkS2yHUfnBM6n3PCwLdfIox03T91joBvjtoDqiQ5x3tTOfpHs3LtiqMMEafls6b0YWtgB1dse1W5m+FpeusVkCOkQxB4SZDH6tuerIknnmB/Hsq5wgEkIvO5Pff9biig6AyoAkdWpSek/1/B7zYIepYY0lxKQIDAQAB";

function createBirdreportVm() {
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
  return context;
}

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

function signPayload(context, data) {
  const serialized = serialize(data);
  const payload = JSON.stringify(sortAscii(dataToJson(serialized || "{}")));
  const timestamp = String(Date.now());
  const id = requestId();
  const encrypt = new context.JSEncrypt();
  encrypt.setPublicKey(PUBLIC_KEY);
  return {
    body: encrypt.encryptLong(payload),
    headers: {
      timestamp,
      requestId: id,
      sign: context.MD5(payload + id + timestamp)
    }
  };
}

function decodePayload(context, value) {
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

async function postTaxon(context, baseUrl, cookie, data) {
  const signed = signPayload(context, data);
  const response = await fetch(`${baseUrl}/api/birdreport/taxon`, {
    method: "POST",
    headers: {
      Accept: "application/json, text/plain, */*",
      "Accept-Encoding": "identity",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Cookie: cookie,
      ...signed.headers
    },
    body: signed.body
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 240)}`);
  }
  if (!response.ok || Number(json.code) >= 400) {
    throw new Error(`HTTP ${response.status}: ${json.msg || text.slice(0, 240)}`);
  }
  return json;
}

async function fetchAll(context, baseUrl, cookie, payload) {
  const first = await postTaxon(context, baseUrl, cookie, { ...payload, page: 1, limit: LIMIT });
  const decoded = decodePayload(context, first.data);
  const firstItems = itemsFrom(decoded);
  const total = Math.max(Number(first.count) || firstItems.length, firstItems.length);
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const all = [...firstItems];
  for (let page = 2; page <= totalPages; page += 1) {
    const next = await postTaxon(context, baseUrl, cookie, { ...payload, page, limit: LIMIT });
    all.push(...itemsFrom(decodePayload(context, next.data)));
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

async function main() {
  const tempDir = mkdtempSync(join(tmpdir(), "beaubird-site-live-"));
  const db = initializeSiteDatabase(join(tempDir, "site.sqlite"));
  createUser(db, {
    username: "admin",
    password: "AdminPass123!",
    role: "admin",
    mustChangePassword: false
  });
  const server = createSiteServer({ database: db, projectRoot: ROOT });
  const context = createBirdreportVm();

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "AdminPass123!" })
    });
    const cookie = login.headers.get("set-cookie")?.split(";")[0] || "";
    if (!login.ok || !cookie) {
      throw new Error(`Login failed: HTTP ${login.status}`);
    }

    const catalog = await fetchAll(context, baseUrl, cookie, {
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
    const observed = await fetchAll(context, baseUrl, cookie, {
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

    if (!observed.length) {
      throw new Error(`${USERNAME} returned 0 observed species through site proxy`);
    }
    write(`${USERNAME} observed ${observed.length}/${catalog.length} species through site proxy\n`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  writeError(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
