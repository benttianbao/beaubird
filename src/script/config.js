// Shared constants and existing browser-global adapters.
const STORAGE_KEY = "birdBlogRecordsV1";
const PERSONAL_STORAGE_KEY = "birdBlogPersonalRecordsV1";
const LEGACY_STORAGE_KEY = STORAGE_KEY;
const EBIRD_API_KEY_STORAGE = "birdBlogEbirdApiKey";
const EBIRD_REGION_STORAGE = "birdBlogEbirdRegionCode";
const EBIRD_BACK_STORAGE = "birdBlogEbirdBackDays";
const EBIRD_SPECIES_LOCALE = "zh_SIM";
const EBIRD_SEASONAL_CACHE_STORAGE = "birdBlogEbirdSeasonalCacheV1";
const EBIRD_SEASONAL_SETTINGS_STORAGE = "birdBlogEbirdSeasonalSettingsV1";
const EBIRD_SEASONAL_REGION_CODE = "CN-33";
const EBIRD_SEASONAL_DEFAULT_YEARS = 10;
const EBIRD_SEASONAL_DEFAULT_WINDOW_DAYS = 7;
const EBIRD_SEASONAL_CACHE_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const EBIRD_SEASONAL_CONCURRENCY = 4;
const BIRDREPORT_RARE_SPECIES_STORAGE = "birdBlogBirdreportRareSpeciesV1";
const BIRDREPORT_RARE_MONITOR_STORAGE = "birdBlogBirdreportRareMonitorV1";
const BIRDREPORT_RARE_NOTIFICATION_LOG_STORAGE = "birdBlogBirdreportRareNotificationLogV1";
const BIRDREPORT_UNLOCKED_SPECIES_CACHE_STORAGE = "birdBlogBirdreportUnlockedSpeciesCacheV1";
const BIRDREPORT_SEARCH_PAGE_URL = "https://www.birdreport.cn/home/search/page.html";
const BIRDREPORT_TAXON_PAGE_URL = "https://www.birdreport.cn/home/search/taxon.html";
const BIRDREPORT_ZHEJIANG_SPECIES_DATA_URL = "./data/zhejiang-birdreport-species.json";
const BIRDREPORT_ZHEJIANG_SPECIES_GLOBAL = "BEAUBIRD_ZHEJIANG_SPECIES_DATA";
const BIRD_PROFILE_SHARD_BASE_URL = "./data/bird-profiles/";
const BIRD_PROFILE_SHARD_INDEX_URL = "./data/bird-profiles/index.json";
const BIRD_PROFILE_SHARD_INDEX_SCRIPT_URL = "./data/bird-profiles/index.js";
const BIRD_PROFILE_SHARD_INDEX_GLOBAL = "BEAUBIRD_BIRD_PROFILE_SHARDS_INDEX";
const BIRD_PROFILE_SHARDS_GLOBAL = "BEAUBIRD_BIRD_PROFILE_SHARDS";
const ALL_BIRDS_FULL_DATA_URL = "./all_birds_full.json";
const ALL_BIRDS_FULL_SCRIPT_URL = "./all_birds_full.js";
const ALL_BIRDS_FULL_GLOBAL = "BEAUBIRD_ALL_BIRDS_FULL";
const BIRD_PREP_LOGIN_EXPIRED_MESSAGE = "登录已过期，请重新登录后再生成 PPT。";
const BIRD_PREP_MACAULAY_MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const BIRD_PREP_MACAULAY_MAX_TOTAL_IMAGE_BYTES = 48 * 1024 * 1024;
const BIRD_PREP_MACAULAY_FETCH_TIMEOUT_MS = 90 * 1000;
const BIRD_PREP_MACAULAY_FETCH_ATTEMPTS = 2;
const BIRD_PREP_IMAGE_DIMENSION_TIMEOUT_MS = 5000;
const BIRDREPORT_CORE = window.BeauBirdBirdreportCore || {};
const BIRDREPORT_VERSION = BIRDREPORT_CORE.BIRDREPORT_VERSION || "CH4";
const ANDROID_APP_USER_AGENT_TOKEN = "BeauBirdAndroidApp";
const BIRDREPORT_PARAM_PUBLIC_KEY = "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCvxXa98E1uWXnBzXkS2yHUfnBM6n3PCwLdfIox03T91joBvjtoDqiQ5x3tTOfpHs3LtiqMMEafls6b0YWtgB1dse1W5m+FpeusVkCOkQxB4SZDH6tuerIknnmB/Hsq5wgEkIvO5Pff9biig6AyoAkdWpSek/1/B7zYIepYY0lxKQIDAQAB";
const BIRDREPORT_AES_KEY_SOURCE = "6756696653534952657053656868665752665050485566485667545454484967";
const BIRDREPORT_AES_IV_SOURCE = "53536868555767547048526949655455";
const DEFAULT_BIRDREPORT_PROXY_URL = "http://127.0.0.1:8787";
const ANDROID_BIRDREPORT_PROXY_URL = "http://127.0.0.1:8787";
const BIRDREPORT_RARE_SPECIES_PROVINCE = "浙江省";
const BIRDREPORT_RARE_SPECIES_THRESHOLD = 500;
const BIRDREPORT_MONITOR_INTERVAL_MS = 60 * 60 * 1000;
const UNLOCKED_SPECIES_VISIBLE_ROW_COUNT = 15;

const BEAUBIRD_UTILS = window.BeauBirdUtils || {};
const BEAUBIRD_DATA = window.BeauBirdData || {};
const formatCompactTimestamp = typeof BEAUBIRD_UTILS.formatCompactTimestamp === "function"
  ? BEAUBIRD_UTILS.formatCompactTimestamp
  : (date) => {
      const value = date instanceof Date ? date : new Date(date);
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, "0");
      const day = String(value.getDate()).padStart(2, "0");
      const hours = String(value.getHours()).padStart(2, "0");
      const minutes = String(value.getMinutes()).padStart(2, "0");
      const seconds = String(value.getSeconds()).padStart(2, "0");
      return `${year}${month}${day}-${hours}${minutes}${seconds}`;
    };
const TRADITIONAL_PHRASE_REPLACEMENTS = BEAUBIRD_DATA.traditionalPhraseReplacements || [];
const TRADITIONAL_CHAR_MAP = BEAUBIRD_DATA.traditionalCharMap || {};
const COMMON_BIRD_TAXONOMY = BEAUBIRD_DATA.commonBirdTaxonomy || {};
const SAMPLE_RECORDS = [
  { date: "2026-03-01", species: "白鹭", location: "杭州西溪湿地", lat: 30.271, lng: 120.123, notes: "芦苇边活动频繁" },
  { date: "2026-03-02", species: "麻雀", location: "上海人民公园", lat: 31.231, lng: 121.47, notes: "晨间群聚觅食" },
  { date: "2026-03-03", species: "红嘴蓝鹊", location: "杭州西湖", lat: 30.24, lng: 120.15, notes: "林缘短暂停留" },
  { date: "2026-03-04", species: "夜鹭", location: "广州海珠湿地", lat: 23.071, lng: 113.318, notes: "黄昏时出现" },
  { date: "2026-03-05", species: "戴胜", location: "北京奥林匹克森林公园", lat: 40.019, lng: 116.396, notes: "地面翻找昆虫" },
  { date: "2026-03-05", species: "白鹭", location: "杭州西溪湿地", lat: 30.271, lng: 120.123, notes: "同点位再次观察到" },
  { date: "2026-03-08", species: "翠鸟", location: "成都锦城湖", lat: 30.57, lng: 104.047, notes: "停在近岸枯枝" },
  { date: "2026-03-10", species: "珠颈斑鸠", location: "深圳莲花山公园", lat: 22.548, lng: 114.055, notes: "步道旁常见" }
];
const ROOT_CLASS_LABEL = "鸟纲";
const UNKNOWN_ORDER_LABEL = "未分类目";
const UNKNOWN_FAMILY_LABEL = "未分类科";
const UNKNOWN_GENUS_LABEL = "未分类属";
const TAXON_ZH_MAP = {
  order: {
    Accipitriformes: "鹰形",
    Anseriformes: "雁形",
    Apodiformes: "雨燕",
    Bucerotiformes: "犀鸟",
    Charadriiformes: "鸻形",
    Columbiformes: "鸽形",
    Coraciiformes: "佛法僧",
    Cuculiformes: "鹃形",
    Falconiformes: "隼形",
    Galliformes: "鸡形",
    Gruiformes: "鹤形",
    Passeriformes: "雀形",
    Pelecaniformes: "鹈形",
    Piciformes: "䴕形",
    Podicipediformes: "䴙䴘形",
    Psittaciformes: "鹦形",
    Strigiformes: "鸮形",
    Suliformes: "鲣鸟"
  },
  family: {
    Accipitridae: "鹰",
    Alcedinidae: "翠鸟",
    Anatidae: "鸭雁",
    Ardeidae: "鹭",
    Columbidae: "鸠鸽",
    Corvidae: "鸦",
    Cuculidae: "杜鹃",
    Hirundinidae: "燕",
    Laridae: "鸥",
    Motacillidae: "鹡鸰",
    Muscicapidae: "鹟",
    Paridae: "山雀",
    Passeridae: "雀",
    Phasianidae: "雉",
    Picidae: "啄木鸟",
    Pycnonotidae: "鹎",
    Rallidae: "秧鸡",
    Sturnidae: "椋鸟",
    Strigidae: "鸱鸮",
    Upupidae: "戴胜"
  }
};

export {
  STORAGE_KEY,
  PERSONAL_STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  EBIRD_API_KEY_STORAGE,
  EBIRD_REGION_STORAGE,
  EBIRD_BACK_STORAGE,
  EBIRD_SPECIES_LOCALE,
  EBIRD_SEASONAL_CACHE_STORAGE,
  EBIRD_SEASONAL_SETTINGS_STORAGE,
  EBIRD_SEASONAL_REGION_CODE,
  EBIRD_SEASONAL_DEFAULT_YEARS,
  EBIRD_SEASONAL_DEFAULT_WINDOW_DAYS,
  EBIRD_SEASONAL_CACHE_TTL_MS,
  EBIRD_SEASONAL_CONCURRENCY,
  BIRDREPORT_RARE_SPECIES_STORAGE,
  BIRDREPORT_RARE_MONITOR_STORAGE,
  BIRDREPORT_RARE_NOTIFICATION_LOG_STORAGE,
  BIRDREPORT_UNLOCKED_SPECIES_CACHE_STORAGE,
  BIRDREPORT_SEARCH_PAGE_URL,
  BIRDREPORT_TAXON_PAGE_URL,
  BIRDREPORT_ZHEJIANG_SPECIES_DATA_URL,
  BIRDREPORT_ZHEJIANG_SPECIES_GLOBAL,
  BIRD_PROFILE_SHARD_BASE_URL,
  BIRD_PROFILE_SHARD_INDEX_URL,
  BIRD_PROFILE_SHARD_INDEX_SCRIPT_URL,
  BIRD_PROFILE_SHARD_INDEX_GLOBAL,
  BIRD_PROFILE_SHARDS_GLOBAL,
  ALL_BIRDS_FULL_DATA_URL,
  ALL_BIRDS_FULL_SCRIPT_URL,
  ALL_BIRDS_FULL_GLOBAL,
  BIRD_PREP_LOGIN_EXPIRED_MESSAGE,
  BIRD_PREP_MACAULAY_MAX_IMAGE_BYTES,
  BIRD_PREP_MACAULAY_MAX_TOTAL_IMAGE_BYTES,
  BIRD_PREP_MACAULAY_FETCH_TIMEOUT_MS,
  BIRD_PREP_MACAULAY_FETCH_ATTEMPTS,
  BIRD_PREP_IMAGE_DIMENSION_TIMEOUT_MS,
  BIRDREPORT_CORE,
  BIRDREPORT_VERSION,
  ANDROID_APP_USER_AGENT_TOKEN,
  BIRDREPORT_PARAM_PUBLIC_KEY,
  BIRDREPORT_AES_KEY_SOURCE,
  BIRDREPORT_AES_IV_SOURCE,
  DEFAULT_BIRDREPORT_PROXY_URL,
  ANDROID_BIRDREPORT_PROXY_URL,
  BIRDREPORT_RARE_SPECIES_PROVINCE,
  BIRDREPORT_RARE_SPECIES_THRESHOLD,
  BIRDREPORT_MONITOR_INTERVAL_MS,
  UNLOCKED_SPECIES_VISIBLE_ROW_COUNT,
  BEAUBIRD_UTILS,
  BEAUBIRD_DATA,
  formatCompactTimestamp,
  TRADITIONAL_PHRASE_REPLACEMENTS,
  TRADITIONAL_CHAR_MAP,
  COMMON_BIRD_TAXONOMY,
  SAMPLE_RECORDS,
  ROOT_CLASS_LABEL,
  UNKNOWN_ORDER_LABEL,
  UNKNOWN_FAMILY_LABEL,
  UNKNOWN_GENUS_LABEL,
  TAXON_ZH_MAP
};
