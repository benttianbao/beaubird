// Functions extracted from the legacy script.js features/birdreport/domain domain.
export function installBirdreportDomain(runtime) {
  const { BIRDREPORT_ZHEJIANG_SPECIES_DATA_URL, BIRDREPORT_ZHEJIANG_SPECIES_GLOBAL, BIRDREPORT_CORE, BIRDREPORT_RARE_SPECIES_THRESHOLD, state } = runtime;

function createBirdreportPayload({
  startTime = "",
  endTime = "",
  province = "",
  city = "",
  district = "",
  pointname = "",
  username = "",
  state = "",
  mode = 0
} = {}) {
  return BIRDREPORT_CORE.createBirdreportPayload({
    startTime,
    endTime,
    province,
    city,
    district,
    pointname,
    username,
    state,
    mode
  });
}

function getBirdreportTaxonKey(item) {
  return BIRDREPORT_CORE.getBirdreportTaxonKey(item);
}

function getBirdreportRarityFields(item) {
  const hasExplicitRarity = typeof item?.isRare === "boolean";
  const isRare = hasExplicitRarity ? item.isRare : (Number(item?.recordcount) || 0) <= BIRDREPORT_RARE_SPECIES_THRESHOLD;
  return {
    isRare,
    rarityLevel: String(item?.rarityLevel || (isRare ? "rare" : "common")).trim(),
    raritySource: String(item?.raritySource || (hasExplicitRarity ? "manual" : "recordcount_threshold")).trim(),
    manualAdded: Boolean(item?.manualAdded),
    rarityNote: String(item?.rarityNote || "").trim()
  };
}

function serializeBirdreportTaxon(item) {
  return {
    key: getBirdreportTaxonKey(item),
    taxon_id: String(item?.taxon_id || item?.taxonid || item?.id || "").trim(),
    taxonname: item?.taxonname || item?.name || "",
    latinname: item?.latinname || item?.englishname || "",
    taxonordername: item?.taxonordername || "",
    taxonfamilyname: item?.taxonfamilyname || "",
    recordcount: Number(item?.recordcount) || 0,
    reportcount: Number(item?.reportcount ?? item?.reportCount ?? item?.report_count) || 0,
    ...getBirdreportRarityFields(item)
  };
}

function getBirdreportTaxaArray(payload) {
  return BIRDREPORT_CORE.getBirdreportItems(payload);
}

function normalizeBirdreportTaxa(payload) {
  return getBirdreportTaxaArray(payload)
    .map(serializeBirdreportTaxon)
    .filter((item) => item.key);
}

async function fetchZhejiangSpeciesBaselineFromJson() {
  const parsed = await loadZhejiangSpeciesData();
  const species = normalizeZhejiangSpeciesCatalog(parsed);
  if (!species.length) {
    throw new Error("本地名录里没有可用鸟种");
  }

  return {
    totalSpecies: Number(parsed?.totalSpecies) || species.length,
    rareSpecies: sortBirdreportTaxaByRecordCount(species.filter((item) => item.isRare))
  };
}

async function fetchZhejiangSpeciesCatalogFromJson() {
  const parsed = await loadZhejiangSpeciesData();
  const species = normalizeZhejiangSpeciesCatalog(parsed);
  if (!species.length) {
    throw new Error("本地浙江鸟种名录里没有可用鸟种");
  }

  return species;
}

async function loadZhejiangSpeciesData() {
  const embedded = window[BIRDREPORT_ZHEJIANG_SPECIES_GLOBAL];
  if (embedded?.species?.length) {
    return embedded;
  }

  const response = await fetch(BIRDREPORT_ZHEJIANG_SPECIES_DATA_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

function normalizeZhejiangSpeciesCatalog(payload) {
  return Array.isArray(payload?.species) ? payload.species.map(serializeBirdreportTaxon).filter((item) => item.key) : [];
}

function toRareSpeciesHit(item, baseline) {
  return {
    ...serializeBirdreportTaxon(item),
    baselineRecordCount: Number(baseline?.recordcount) || 0,
    targetDateRecordCount: Number(item?.recordcount) || 0
  };
}

function sortBirdreportRecordsByObservationTimeDesc(left, right) {
  return BIRDREPORT_CORE.sortBirdreportRecordsByObservationTimeDesc(left, right);
}

function sortBirdreportRecordsBySerialIdDesc(left, right) {
  return BIRDREPORT_CORE.sortBirdreportRecordsBySerialIdDesc(left, right);
}

function getBirdreportReportCount(item) {
  const explicitReportCount = Number(item?.reportcount ?? item?.reportCount ?? item?.report_count);
  if (Number.isFinite(explicitReportCount) && explicitReportCount > 0) {
    return explicitReportCount;
  }

  return Number(item?.recordcount) || 0;
}

function dedupeBirdreportTaxa(items) {
  return BIRDREPORT_CORE.dedupeBirdreportTaxa(items);
}

function sortBirdreportTaxaByRecordCount(items) {
  return BIRDREPORT_CORE.sortBirdreportTaxaByRecordCount(items);
}

function sortBirdreportTaxaByRecordCountDesc(items) {
  return BIRDREPORT_CORE.sortBirdreportTaxaByRecordCountDesc(items);
}

  Object.assign(runtime, {
    createBirdreportPayload,
    getBirdreportTaxonKey,
    getBirdreportRarityFields,
    serializeBirdreportTaxon,
    getBirdreportTaxaArray,
    normalizeBirdreportTaxa,
    fetchZhejiangSpeciesBaselineFromJson,
    fetchZhejiangSpeciesCatalogFromJson,
    loadZhejiangSpeciesData,
    normalizeZhejiangSpeciesCatalog,
    toRareSpeciesHit,
    sortBirdreportRecordsByObservationTimeDesc,
    sortBirdreportRecordsBySerialIdDesc,
    getBirdreportReportCount,
    dedupeBirdreportTaxa,
    sortBirdreportTaxaByRecordCount,
    sortBirdreportTaxaByRecordCountDesc
  });
}
