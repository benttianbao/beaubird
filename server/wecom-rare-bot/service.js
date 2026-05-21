const { readFile } = require("node:fs/promises");
const { resolve } = require("node:path");
const { createBirdreportPayload: createSharedBirdreportPayload } = require("../../beaubird-birdreport-core");

const {
  DEFAULT_PROVINCE,
  aggregateLocations,
  buildRareHits,
  formatRareSpeciesListReply,
  formatSpeciesLocationReply,
  isValidIsoDate,
  matchRareSpeciesByName,
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
  const payload = createSharedBirdreportPayload({
    province,
    startTime,
    endTime,
    city,
    district,
    pointname,
    username,
    state,
    mode
  });
  ["city", "district", "pointname", "username", "state"].forEach((key) => {
    if (!payload[key]) {
      delete payload[key];
    }
  });
  return payload;
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

  async function queryDateHits(date) {
    if (!isValidIsoDate(date)) {
      throw new Error("日期格式必须是 YYYY-MM-DD。");
    }
    if (!birdreportClient || typeof birdreportClient.fetchAllTaxa !== "function") {
      throw new Error("BirdReport 客户端不可用。");
    }

    const baseline = await loadBaselineSpecies();
    const payload = createBirdreportPayload({ province, startTime: date, endTime: date });
    const dailyTaxa = await birdreportClient.fetchAllTaxa(payload);
    return buildRareHits(dailyTaxa, baseline);
  }

  async function queryDateSpecies(date) {
    const hits = await queryDateHits(date);
    return {
      date,
      province,
      hits,
      reply: formatRareSpeciesListReply({ date, province, hits })
    };
  }

  async function querySpeciesLocations(date, speciesName) {
    const hits = await queryDateHits(date);
    const match = matchRareSpeciesByName(hits, speciesName);
    if (match.status !== "matched") {
      return {
        date,
        province,
        status: match.status,
        species: match.species,
        candidates: match.candidates,
        locations: [],
        reply: formatSpeciesLocationReply({
          date,
          speciesName,
          status: match.status,
          candidates: match.candidates
        })
      };
    }

    if (!birdreportClient || typeof birdreportClient.fetchRecordsByTaxon !== "function") {
      throw new Error("BirdReport 记录查询客户端不可用。");
    }

    const records = await birdreportClient.fetchRecordsByTaxon(match.species, date);
    const locations = aggregateLocations(records);

    return {
      date,
      province,
      status: "matched",
      species: match.species,
      candidates: [],
      locations,
      reply: formatSpeciesLocationReply({ date, species: match.species, locations })
    };
  }

  return {
    loadBaselineSpecies,
    queryDate: queryDateSpecies,
    queryDateSpecies,
    querySpeciesLocations
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
