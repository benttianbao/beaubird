import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createDecipheriv, createHash, publicEncrypt, randomUUID, constants } from "node:crypto";
import { writeZhejiangSpeciesJs } from "./write-zhejiang-species-js.mjs";

const API_URL = "https://api.birdreport.cn/front/record/activity/taxon";
const REFERER = "https://www.birdreport.cn/home/search/taxon.html";
const ORIGIN = "https://www.birdreport.cn";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
const VERSION = "CH4";
const PROVINCE = "浙江省";
const PAGE_LIMIT = 500;
const OUTPUT_PATH = resolve("data/zhejiang-birdreport-species.json");
const RARE_RECORDCOUNT_THRESHOLD = 500;

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCvxXa98E1uWXnBzXkS2yHUfnBM6n3PCwLdfIox03T91joBvjtoDqiQ5x3tTOfpHs3LtiqMMEafls6b0YWtgB1dse1W5m+FpeusVkCOkQxB4SZDH6tuerIknnmB/Hsq5wgEkIvO5Pff9biig6AyoAkdWpSek/1/B7zYIepYY0lxKQIDAQAB
-----END PUBLIC KEY-----`;

const AES_KEY_HEX = "C8EB5514AF5ADDB94B2207B08C66601C";
const AES_IV_HEX = "55DD79C6F04E1A67";

function sortAscii(value) {
  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = value[key];
      return result;
    }, {});
}

function serializeQuery(value) {
  return Object.entries(value)
    .filter(([, entryValue]) => entryValue !== undefined && entryValue !== null && entryValue !== "")
    .map(([key, entryValue]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(entryValue))}`)
    .join("&");
}

function parseFormBody(body) {
  return body.split("&").reduce((result, part) => {
    if (!part) {
      return result;
    }

    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) {
      result[part] = "";
      return result;
    }

    result[part.slice(0, separatorIndex)] = part.slice(separatorIndex + 1);
    return result;
  }, {});
}

function encryptLong(text) {
  const chunks = [];
  const source = Buffer.from(text, "utf8");
  const maxChunkSize = 117;

  for (let offset = 0; offset < source.length; offset += maxChunkSize) {
    chunks.push(
      publicEncrypt(
        {
          key: PUBLIC_KEY,
          padding: constants.RSA_PKCS1_PADDING
        },
        source.subarray(offset, offset + maxChunkSize)
      ).toString("base64")
    );
  }

  return chunks.join("");
}

function createSignedBody(data) {
  const formBody = serializeQuery(data);
  const sortedPayload = JSON.stringify(sortAscii(parseFormBody(formBody)));
  const timestamp = String(Date.parse(new Date()));
  const requestId = randomUUID().replaceAll("-", "");
  const sign = createHash("md5").update(`${sortedPayload}${requestId}${timestamp}`).digest("hex");

  return {
    body: encryptLong(sortedPayload),
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Origin: ORIGIN,
      Referer: REFERER,
      "User-Agent": USER_AGENT,
      timestamp,
      requestId,
      sign
    }
  };
}

function decodeBirdreportPayload(payload) {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  const attempts = [
    ["aes-128-cbc", Buffer.from(AES_KEY_HEX, "hex"), Buffer.from(AES_IV_HEX, "hex")],
    ["aes-256-cbc", Buffer.from(AES_KEY_HEX, "utf8"), Buffer.from(AES_IV_HEX, "utf8")]
  ];

  for (const [algorithm, key, iv] of attempts) {
    try {
      const decipher = createDecipheriv(algorithm, key, iv);
      const decoded = Buffer.concat([decipher.update(Buffer.from(payload, "base64")), decipher.final()]).toString("utf8");
      return JSON.parse(decoded || "[]");
    } catch {
      // Try the next known BirdReport AES variant.
    }
  }

  throw new Error(`无法解密 BirdReport 响应 data，前 80 字符：${String(payload).slice(0, 80)}`);
}

function getTaxonKey(item) {
  return String(item?.taxon_id || item?.taxonid || item?.id || item?.taxonname || item?.name || "").trim();
}

async function loadExistingSpecies() {
  try {
    const raw = await readFile(OUTPUT_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.species) ? parsed.species : [];
  } catch {
    return [];
  }
}

function getRarityFields(item, existingItem) {
  const hasExistingRarity = typeof existingItem?.isRare === "boolean";
  const isRare = hasExistingRarity
    ? existingItem.isRare
    : (Number(item?.recordcount) || 0) <= RARE_RECORDCOUNT_THRESHOLD;

  return {
    isRare,
    rarityLevel: String(existingItem?.rarityLevel || (isRare ? "rare" : "common")).trim(),
    raritySource: String(existingItem?.raritySource || "recordcount_threshold").trim(),
    manualAdded: Boolean(existingItem?.manualAdded),
    rarityNote: String(existingItem?.rarityNote || "").trim()
  };
}

function serializeTaxon(item, existingSpeciesByKey = new Map()) {
  const key = getTaxonKey(item);
  const existingItem = existingSpeciesByKey.get(key);
  return {
    key,
    taxon_id: String(item?.taxon_id || item?.taxonid || item?.id || "").trim(),
    taxonname: item?.taxonname || item?.name || "",
    latinname: item?.latinname || item?.englishname || "",
    taxonordername: item?.taxonordername || "",
    taxonfamilyname: item?.taxonfamilyname || "",
    recordcount: Number(item?.recordcount) || 0,
    ...getRarityFields(item, existingItem)
  };
}

function dedupeTaxa(items) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = getTaxonKey(item);
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

function sortTaxa(items) {
  return [...items].sort((left, right) => {
    const leftCount = Number(left?.recordcount) || 0;
    const rightCount = Number(right?.recordcount) || 0;
    if (leftCount !== rightCount) {
      return leftCount - rightCount;
    }

    const leftName = String(left?.taxonname || left?.name || "");
    const rightName = String(right?.taxonname || right?.name || "");
    return leftName.localeCompare(rightName, "zh-CN");
  });
}

async function fetchTaxonPage(page) {
  const { body, headers } = createSignedBody({
    province: PROVINCE,
    version: VERSION,
    outside_type: 0,
    mode: 0,
    page,
    limit: PAGE_LIMIT
  });

  const response = await fetch(API_URL, {
    method: "POST",
    headers,
    body
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`BirdReport returned HTTP ${response.status}: ${text}`);
  }

  const json = JSON.parse(text);
  if (json?.code && Number(json.code) !== 200 && Number(json.code) !== 0) {
    throw new Error(`BirdReport returned code ${json.code}: ${json.msg || json.message || text}`);
  }

  return {
    count: Number(json?.count) || 0,
    items: decodeBirdreportPayload(json?.data)
  };
}

async function main() {
  const existingSpecies = await loadExistingSpecies();
  const existingSpeciesByKey = new Map(existingSpecies.map((item) => [getTaxonKey(item), item]).filter(([key]) => key));
  const firstPage = await fetchTaxonPage(1);
  const total = Math.max(firstPage.count, firstPage.items.length);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));
  const allItems = [...firstPage.items];

  console.log(`BirdReport 浙江省鸟种总数：${total}，分页：${totalPages}`);

  for (let page = 2; page <= totalPages; page += 1) {
    console.log(`正在获取第 ${page}/${totalPages} 页...`);
    const pageResult = await fetchTaxonPage(page);
    allItems.push(...pageResult.items);
  }

  const fetchedSpecies = sortTaxa(dedupeTaxa(allItems)).map((item) => serializeTaxon(item, existingSpeciesByKey));
  const fetchedKeys = new Set(fetchedSpecies.map((item) => item.key));
  const manualSpecies = existingSpecies
    .filter((item) => Boolean(item?.manualAdded) && !fetchedKeys.has(getTaxonKey(item)))
    .map((item) => ({
      ...item,
      key: getTaxonKey(item),
      isRare: typeof item?.isRare === "boolean" ? item.isRare : true,
      rarityLevel: String(item?.rarityLevel || "rare").trim(),
      raritySource: String(item?.raritySource || "manual").trim(),
      manualAdded: true,
      rarityNote: String(item?.rarityNote || "").trim()
    }));
  const species = [...fetchedSpecies, ...manualSpecies];
  const payload = {
    schemaVersion: 2,
    province: PROVINCE,
    source: API_URL,
    query: {
      province: PROVINCE,
      version: VERSION,
      outside_type: 0,
      mode: 0
    },
    fetchedAt: new Date().toISOString(),
    rareThreshold: RARE_RECORDCOUNT_THRESHOLD,
    totalSpecies: species.length,
    birdreportSpeciesCount: fetchedSpecies.length,
    manualSpeciesCount: manualSpecies.length,
    rareSpeciesCount: species.filter((item) => item.isRare).length,
    species
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await writeZhejiangSpeciesJs();

  console.log(`已保存 ${species.length} 种到 ${OUTPUT_PATH}`);
  if (species.length !== 588) {
    console.warn(`注意：本次保存数量为 ${species.length}，不是预期的 588。`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
