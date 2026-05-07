const { readFile } = require("node:fs/promises");
const { resolve } = require("node:path");

const {
  DEFAULT_PROVINCE,
  aggregateLocations,
  buildRareHits,
  formatRareBirdReply,
  isValidIsoDate,
  normalizeBirdreportTaxon
} = require("./core");

const DEFAULT_BASELINE_PATH = resolve(__dirname, "..", "..", "data", "zhejiang-birdreport-species.json");
const BIRDREPORT_VERSION = "CH4";

function createBirdreportPayload({
  province = DEFAULT_PROVINCE,
  startTime = "",
  endTime = "",
  city = "",
  district = "",
  pointname = "",
  username = "",
  state = "",
  mode = 0
} = {}) {
  return {
    province: String(province || "").trim(),
    startTime: String(startTime || "").trim(),
    endTime: String(endTime || "").trim(),
    ...(city ? { city: String(city).trim() } : {}),
    ...(district ? { district: String(district).trim() } : {}),
    ...(pointname ? { pointname: String(pointname).trim() } : {}),
    ...(username ? { username: String(username).trim() } : {}),
    ...(state ? { state: String(state).trim() } : {}),
    version: BIRDREPORT_VERSION,
    outside_type: 0,
    mode
  };
}

function createRareBirdQueryService(options = {}) {
  const {
    baselinePath = DEFAULT_BASELINE_PATH,
    baselineSpecies = null,
    birdreportClient,
    province = DEFAULT_PROVINCE,
    recordConcurrency = 4
  } = options;
  let baselineCache = Array.isArray(baselineSpecies) ? baselineSpecies.map(normalizeBirdreportTaxon) : null;

  async function loadBaselineSpecies() {
    if (baselineCache) {
      return baselineCache;
    }

    const raw = await readFile(baselinePath, "utf8");
    const parsed = JSON.parse(raw);
    const species = Array.isArray(parsed?.species) ? parsed.species : [];
    baselineCache = species.map(normalizeBirdreportTaxon).filter((item) => item.key);
    return baselineCache;
  }

  async function queryDate(date) {
    if (!isValidIsoDate(date)) {
      throw new Error("日期格式必须是 YYYY-MM-DD。");
    }
    if (!birdreportClient || typeof birdreportClient.fetchAllTaxa !== "function") {
      throw new Error("BirdReport 客户端不可用。");
    }

    const baseline = await loadBaselineSpecies();
    const payload = createBirdreportPayload({ province, startTime: date, endTime: date });
    const dailyTaxa = await birdreportClient.fetchAllTaxa(payload);
    const hits = buildRareHits(dailyTaxa, baseline);

    await mapWithConcurrency(hits, recordConcurrency, async (hit) => {
      if (typeof birdreportClient.fetchRecordsByTaxon !== "function") {
        hit.locations = [];
        return;
      }
      try {
        const records = await birdreportClient.fetchRecordsByTaxon(hit, date);
        hit.locations = aggregateLocations(records);
      } catch (error) {
        hit.locations = [];
        hit.locationError = error?.message || "地点查询失败";
      }
    });

    return {
      date,
      province,
      hits,
      reply: formatRareBirdReply({ date, province, hits })
    };
  }

  return {
    loadBaselineSpecies,
    queryDate
  };
}

async function mapWithConcurrency(items, limit, worker) {
  const workerCount = Math.max(1, Math.min(Number(limit) || 1, items.length || 1));
  let index = 0;
  async function run() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      await worker(items[currentIndex], currentIndex);
    }
  }
  await Promise.all(Array.from({ length: workerCount }, run));
}

module.exports = {
  BIRDREPORT_VERSION,
  DEFAULT_BASELINE_PATH,
  createBirdreportPayload,
  createRareBirdQueryService,
  mapWithConcurrency
};
