import { readFile, writeFile } from "node:fs/promises";
import { createDecipheriv, createHash, publicEncrypt, randomUUID, constants } from "node:crypto";
import { writeZhejiangSpeciesJs, ZHEJIANG_SPECIES_JSON_PATH } from "./write-zhejiang-species-js.mjs";

console.error("这个脚本已停用：报告数量现在由页面通过 BirdReport 代理查询并缓存，避免直连接口写入错误的 0。");
process.exit(1);

const API_URL = "https://api.birdreport.cn/front/record/search/page";
const REFERER = "https://www.birdreport.cn/home/search/record.html";
const ORIGIN = "https://www.birdreport.cn";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
const VERSION = "CH4";
const PROVINCE = "浙江省";
const CONCURRENCY = 8;

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCvxXa98E1uWXnBzXkS2yHUfnBM6n3PCwLdfIox03T91joBvjtoDqiQ5x3tTOfpHs3LtiqMMEafls6b0YWtgB1dse1W5m+FpeusVkCOkQxB4SZDH6tuerIknnmB/Hsq5wgEkIvO5Pff9biig6AyoAkdWpSek/1/B7zYIepYY0lxKQIDAQAB
-----END PUBLIC KEY-----`;

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

async function fetchReportCount(species) {
  const taxonId = String(species?.taxon_id || species?.taxonid || species?.key || "").trim();
  if (!taxonId) {
    return 0;
  }

  const { body, headers } = createSignedBody({
    province: PROVINCE,
    taxonid: taxonId,
    version: VERSION,
    outside_type: 0,
    mode: 0,
    page: 1,
    limit: 1
  });

  const response = await fetch(API_URL, {
    method: "POST",
    headers,
    body
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${species.taxonname || taxonId} HTTP ${response.status}: ${text}`);
  }

  const json = JSON.parse(text);
  if (json?.code && Number(json.code) !== 200 && Number(json.code) !== 0) {
    throw new Error(`${species.taxonname || taxonId} code ${json.code}: ${json.msg || json.message || text}`);
  }

  return Number(json?.count) || 0;
}

async function mapWithConcurrency(items, limit, worker) {
  const result = new Array(items.length);
  let index = 0;

  async function run() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      result[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return result;
}

async function main() {
  const data = JSON.parse(await readFile(ZHEJIANG_SPECIES_JSON_PATH, "utf8"));
  const species = Array.isArray(data.species) ? data.species : [];
  let completed = 0;

  await mapWithConcurrency(species, CONCURRENCY, async (item) => {
    const reportcount = await fetchReportCount(item);
    completed += 1;
    item.reportcount = reportcount;
    item.reportCountSource = "record_search_page_count";
    if (completed % 25 === 0 || completed === species.length) {
      console.log(`已更新报告数量 ${completed}/${species.length}`);
    }
  });

  data.reportCountUpdatedAt = new Date().toISOString();
  data.totalReportCount = species.reduce((sum, item) => sum + (Number(item.reportcount) || 0), 0);
  await writeFile(ZHEJIANG_SPECIES_JSON_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await writeZhejiangSpeciesJs();
  console.log(`完成：${species.length} 种，报告数量合计 ${data.totalReportCount}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
