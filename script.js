/* @generated from src/script/main.js; do not edit directly. */
(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/script/config.js
  var config_exports = {};
  __export(config_exports, {
    ALL_BIRDS_FULL_DATA_URL: () => ALL_BIRDS_FULL_DATA_URL,
    ALL_BIRDS_FULL_GLOBAL: () => ALL_BIRDS_FULL_GLOBAL,
    ALL_BIRDS_FULL_SCRIPT_URL: () => ALL_BIRDS_FULL_SCRIPT_URL,
    ANDROID_APP_USER_AGENT_TOKEN: () => ANDROID_APP_USER_AGENT_TOKEN,
    ANDROID_BIRDREPORT_PROXY_URL: () => ANDROID_BIRDREPORT_PROXY_URL,
    BEAUBIRD_DATA: () => BEAUBIRD_DATA,
    BEAUBIRD_UTILS: () => BEAUBIRD_UTILS,
    BIRDREPORT_AES_IV_SOURCE: () => BIRDREPORT_AES_IV_SOURCE,
    BIRDREPORT_AES_KEY_SOURCE: () => BIRDREPORT_AES_KEY_SOURCE,
    BIRDREPORT_CORE: () => BIRDREPORT_CORE,
    BIRDREPORT_MONITOR_INTERVAL_MS: () => BIRDREPORT_MONITOR_INTERVAL_MS,
    BIRDREPORT_PARAM_PUBLIC_KEY: () => BIRDREPORT_PARAM_PUBLIC_KEY,
    BIRDREPORT_RARE_MONITOR_STORAGE: () => BIRDREPORT_RARE_MONITOR_STORAGE,
    BIRDREPORT_RARE_NOTIFICATION_LOG_STORAGE: () => BIRDREPORT_RARE_NOTIFICATION_LOG_STORAGE,
    BIRDREPORT_RARE_SPECIES_PROVINCE: () => BIRDREPORT_RARE_SPECIES_PROVINCE,
    BIRDREPORT_RARE_SPECIES_STORAGE: () => BIRDREPORT_RARE_SPECIES_STORAGE,
    BIRDREPORT_RARE_SPECIES_THRESHOLD: () => BIRDREPORT_RARE_SPECIES_THRESHOLD,
    BIRDREPORT_SEARCH_PAGE_URL: () => BIRDREPORT_SEARCH_PAGE_URL,
    BIRDREPORT_TAXON_PAGE_URL: () => BIRDREPORT_TAXON_PAGE_URL,
    BIRDREPORT_UNLOCKED_SPECIES_CACHE_STORAGE: () => BIRDREPORT_UNLOCKED_SPECIES_CACHE_STORAGE,
    BIRDREPORT_VERSION: () => BIRDREPORT_VERSION,
    BIRDREPORT_ZHEJIANG_SPECIES_DATA_URL: () => BIRDREPORT_ZHEJIANG_SPECIES_DATA_URL,
    BIRDREPORT_ZHEJIANG_SPECIES_GLOBAL: () => BIRDREPORT_ZHEJIANG_SPECIES_GLOBAL,
    BIRD_PREP_IMAGE_DIMENSION_TIMEOUT_MS: () => BIRD_PREP_IMAGE_DIMENSION_TIMEOUT_MS,
    BIRD_PREP_LOGIN_EXPIRED_MESSAGE: () => BIRD_PREP_LOGIN_EXPIRED_MESSAGE,
    BIRD_PREP_MACAULAY_FETCH_ATTEMPTS: () => BIRD_PREP_MACAULAY_FETCH_ATTEMPTS,
    BIRD_PREP_MACAULAY_FETCH_TIMEOUT_MS: () => BIRD_PREP_MACAULAY_FETCH_TIMEOUT_MS,
    BIRD_PREP_MACAULAY_MAX_IMAGE_BYTES: () => BIRD_PREP_MACAULAY_MAX_IMAGE_BYTES,
    BIRD_PREP_MACAULAY_MAX_TOTAL_IMAGE_BYTES: () => BIRD_PREP_MACAULAY_MAX_TOTAL_IMAGE_BYTES,
    BIRD_PROFILE_SHARDS_GLOBAL: () => BIRD_PROFILE_SHARDS_GLOBAL,
    BIRD_PROFILE_SHARD_BASE_URL: () => BIRD_PROFILE_SHARD_BASE_URL,
    BIRD_PROFILE_SHARD_INDEX_GLOBAL: () => BIRD_PROFILE_SHARD_INDEX_GLOBAL,
    BIRD_PROFILE_SHARD_INDEX_SCRIPT_URL: () => BIRD_PROFILE_SHARD_INDEX_SCRIPT_URL,
    BIRD_PROFILE_SHARD_INDEX_URL: () => BIRD_PROFILE_SHARD_INDEX_URL,
    COMMON_BIRD_TAXONOMY: () => COMMON_BIRD_TAXONOMY,
    DEFAULT_BIRDREPORT_PROXY_URL: () => DEFAULT_BIRDREPORT_PROXY_URL,
    EBIRD_API_KEY_STORAGE: () => EBIRD_API_KEY_STORAGE,
    EBIRD_BACK_STORAGE: () => EBIRD_BACK_STORAGE,
    EBIRD_REGION_STORAGE: () => EBIRD_REGION_STORAGE,
    EBIRD_SEASONAL_CACHE_STORAGE: () => EBIRD_SEASONAL_CACHE_STORAGE,
    EBIRD_SEASONAL_CACHE_TTL_MS: () => EBIRD_SEASONAL_CACHE_TTL_MS,
    EBIRD_SEASONAL_CONCURRENCY: () => EBIRD_SEASONAL_CONCURRENCY,
    EBIRD_SEASONAL_DEFAULT_WINDOW_DAYS: () => EBIRD_SEASONAL_DEFAULT_WINDOW_DAYS,
    EBIRD_SEASONAL_DEFAULT_YEARS: () => EBIRD_SEASONAL_DEFAULT_YEARS,
    EBIRD_SEASONAL_REGION_CODE: () => EBIRD_SEASONAL_REGION_CODE,
    EBIRD_SEASONAL_SETTINGS_STORAGE: () => EBIRD_SEASONAL_SETTINGS_STORAGE,
    EBIRD_SPECIES_LOCALE: () => EBIRD_SPECIES_LOCALE,
    LEGACY_STORAGE_KEY: () => LEGACY_STORAGE_KEY,
    PERSONAL_STORAGE_KEY: () => PERSONAL_STORAGE_KEY,
    ROOT_CLASS_LABEL: () => ROOT_CLASS_LABEL,
    SAMPLE_RECORDS: () => SAMPLE_RECORDS,
    STORAGE_KEY: () => STORAGE_KEY,
    TAXON_ZH_MAP: () => TAXON_ZH_MAP,
    TRADITIONAL_CHAR_MAP: () => TRADITIONAL_CHAR_MAP,
    TRADITIONAL_PHRASE_REPLACEMENTS: () => TRADITIONAL_PHRASE_REPLACEMENTS,
    UNKNOWN_FAMILY_LABEL: () => UNKNOWN_FAMILY_LABEL,
    UNKNOWN_GENUS_LABEL: () => UNKNOWN_GENUS_LABEL,
    UNKNOWN_ORDER_LABEL: () => UNKNOWN_ORDER_LABEL,
    UNLOCKED_SPECIES_VISIBLE_ROW_COUNT: () => UNLOCKED_SPECIES_VISIBLE_ROW_COUNT,
    formatCompactTimestamp: () => formatCompactTimestamp
  });
  var STORAGE_KEY = "birdBlogRecordsV1";
  var PERSONAL_STORAGE_KEY = "birdBlogPersonalRecordsV1";
  var LEGACY_STORAGE_KEY = STORAGE_KEY;
  var EBIRD_API_KEY_STORAGE = "birdBlogEbirdApiKey";
  var EBIRD_REGION_STORAGE = "birdBlogEbirdRegionCode";
  var EBIRD_BACK_STORAGE = "birdBlogEbirdBackDays";
  var EBIRD_SPECIES_LOCALE = "zh_SIM";
  var EBIRD_SEASONAL_CACHE_STORAGE = "birdBlogEbirdSeasonalCacheV1";
  var EBIRD_SEASONAL_SETTINGS_STORAGE = "birdBlogEbirdSeasonalSettingsV1";
  var EBIRD_SEASONAL_REGION_CODE = "CN-33";
  var EBIRD_SEASONAL_DEFAULT_YEARS = 10;
  var EBIRD_SEASONAL_DEFAULT_WINDOW_DAYS = 7;
  var EBIRD_SEASONAL_CACHE_TTL_MS = 180 * 24 * 60 * 60 * 1e3;
  var EBIRD_SEASONAL_CONCURRENCY = 4;
  var BIRDREPORT_RARE_SPECIES_STORAGE = "birdBlogBirdreportRareSpeciesV1";
  var BIRDREPORT_RARE_MONITOR_STORAGE = "birdBlogBirdreportRareMonitorV1";
  var BIRDREPORT_RARE_NOTIFICATION_LOG_STORAGE = "birdBlogBirdreportRareNotificationLogV1";
  var BIRDREPORT_UNLOCKED_SPECIES_CACHE_STORAGE = "birdBlogBirdreportUnlockedSpeciesCacheV1";
  var BIRDREPORT_SEARCH_PAGE_URL = "https://www.birdreport.cn/home/search/page.html";
  var BIRDREPORT_TAXON_PAGE_URL = "https://www.birdreport.cn/home/search/taxon.html";
  var BIRDREPORT_ZHEJIANG_SPECIES_DATA_URL = "./data/zhejiang-birdreport-species.json";
  var BIRDREPORT_ZHEJIANG_SPECIES_GLOBAL = "BEAUBIRD_ZHEJIANG_SPECIES_DATA";
  var BIRD_PROFILE_SHARD_BASE_URL = "./data/bird-profiles/";
  var BIRD_PROFILE_SHARD_INDEX_URL = "./data/bird-profiles/index.json";
  var BIRD_PROFILE_SHARD_INDEX_SCRIPT_URL = "./data/bird-profiles/index.js";
  var BIRD_PROFILE_SHARD_INDEX_GLOBAL = "BEAUBIRD_BIRD_PROFILE_SHARDS_INDEX";
  var BIRD_PROFILE_SHARDS_GLOBAL = "BEAUBIRD_BIRD_PROFILE_SHARDS";
  var ALL_BIRDS_FULL_DATA_URL = "./all_birds_full.json";
  var ALL_BIRDS_FULL_SCRIPT_URL = "./all_birds_full.js";
  var ALL_BIRDS_FULL_GLOBAL = "BEAUBIRD_ALL_BIRDS_FULL";
  var BIRD_PREP_LOGIN_EXPIRED_MESSAGE = "登录已过期，请重新登录后再生成 PPT。";
  var BIRD_PREP_MACAULAY_MAX_IMAGE_BYTES = 12 * 1024 * 1024;
  var BIRD_PREP_MACAULAY_MAX_TOTAL_IMAGE_BYTES = 48 * 1024 * 1024;
  var BIRD_PREP_MACAULAY_FETCH_TIMEOUT_MS = 90 * 1e3;
  var BIRD_PREP_MACAULAY_FETCH_ATTEMPTS = 2;
  var BIRD_PREP_IMAGE_DIMENSION_TIMEOUT_MS = 5e3;
  var BIRDREPORT_CORE = window.BeauBirdBirdreportCore || {};
  var BIRDREPORT_VERSION = BIRDREPORT_CORE.BIRDREPORT_VERSION || "CH4";
  var ANDROID_APP_USER_AGENT_TOKEN = "BeauBirdAndroidApp";
  var BIRDREPORT_PARAM_PUBLIC_KEY = "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCvxXa98E1uWXnBzXkS2yHUfnBM6n3PCwLdfIox03T91joBvjtoDqiQ5x3tTOfpHs3LtiqMMEafls6b0YWtgB1dse1W5m+FpeusVkCOkQxB4SZDH6tuerIknnmB/Hsq5wgEkIvO5Pff9biig6AyoAkdWpSek/1/B7zYIepYY0lxKQIDAQAB";
  var BIRDREPORT_AES_KEY_SOURCE = "6756696653534952657053656868665752665050485566485667545454484967";
  var BIRDREPORT_AES_IV_SOURCE = "53536868555767547048526949655455";
  var DEFAULT_BIRDREPORT_PROXY_URL = "http://127.0.0.1:8787";
  var ANDROID_BIRDREPORT_PROXY_URL = "http://127.0.0.1:8787";
  var BIRDREPORT_RARE_SPECIES_PROVINCE = "浙江省";
  var BIRDREPORT_RARE_SPECIES_THRESHOLD = 500;
  var BIRDREPORT_MONITOR_INTERVAL_MS = 60 * 60 * 1e3;
  var UNLOCKED_SPECIES_VISIBLE_ROW_COUNT = 15;
  var BEAUBIRD_UTILS = window.BeauBirdUtils || {};
  var BEAUBIRD_DATA = window.BeauBirdData || {};
  var formatCompactTimestamp = typeof BEAUBIRD_UTILS.formatCompactTimestamp === "function" ? BEAUBIRD_UTILS.formatCompactTimestamp : (date) => {
    const value = date instanceof Date ? date : new Date(date);
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    const hours = String(value.getHours()).padStart(2, "0");
    const minutes = String(value.getMinutes()).padStart(2, "0");
    const seconds = String(value.getSeconds()).padStart(2, "0");
    return `${year}${month}${day}-${hours}${minutes}${seconds}`;
  };
  var TRADITIONAL_PHRASE_REPLACEMENTS = BEAUBIRD_DATA.traditionalPhraseReplacements || [];
  var TRADITIONAL_CHAR_MAP = BEAUBIRD_DATA.traditionalCharMap || {};
  var COMMON_BIRD_TAXONOMY = BEAUBIRD_DATA.commonBirdTaxonomy || {};
  var SAMPLE_RECORDS = [
    { date: "2026-03-01", species: "白鹭", location: "杭州西溪湿地", lat: 30.271, lng: 120.123, notes: "芦苇边活动频繁" },
    { date: "2026-03-02", species: "麻雀", location: "上海人民公园", lat: 31.231, lng: 121.47, notes: "晨间群聚觅食" },
    { date: "2026-03-03", species: "红嘴蓝鹊", location: "杭州西湖", lat: 30.24, lng: 120.15, notes: "林缘短暂停留" },
    { date: "2026-03-04", species: "夜鹭", location: "广州海珠湿地", lat: 23.071, lng: 113.318, notes: "黄昏时出现" },
    { date: "2026-03-05", species: "戴胜", location: "北京奥林匹克森林公园", lat: 40.019, lng: 116.396, notes: "地面翻找昆虫" },
    { date: "2026-03-05", species: "白鹭", location: "杭州西溪湿地", lat: 30.271, lng: 120.123, notes: "同点位再次观察到" },
    { date: "2026-03-08", species: "翠鸟", location: "成都锦城湖", lat: 30.57, lng: 104.047, notes: "停在近岸枯枝" },
    { date: "2026-03-10", species: "珠颈斑鸠", location: "深圳莲花山公园", lat: 22.548, lng: 114.055, notes: "步道旁常见" }
  ];
  var ROOT_CLASS_LABEL = "鸟纲";
  var UNKNOWN_ORDER_LABEL = "未分类目";
  var UNKNOWN_FAMILY_LABEL = "未分类科";
  var UNKNOWN_GENUS_LABEL = "未分类属";
  var TAXON_ZH_MAP = {
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

  // src/script/shared/storage.js
  function installStorage(runtime2) {
    function safeLocalStorageGet(key, fallback = "") {
      try {
        const value = localStorage.getItem(key);
        return value == null ? fallback : value;
      } catch (error) {
        console.warn("Failed to read localStorage:", error);
        return fallback;
      }
    }
    function safeLocalStorageSet(key, value) {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (error) {
        console.warn("Failed to write localStorage:", error);
        return false;
      }
    }
    function safeLocalStorageRemove(key) {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn("Failed to remove localStorage:", error);
      }
    }
    Object.assign(runtime2, {
      safeLocalStorageGet,
      safeLocalStorageSet,
      safeLocalStorageRemove
    });
  }

  // src/script/shared/utils.js
  function installSharedUtils(runtime2) {
    const { EBIRD_SEASONAL_DEFAULT_YEARS: EBIRD_SEASONAL_DEFAULT_YEARS2, EBIRD_SEASONAL_DEFAULT_WINDOW_DAYS: EBIRD_SEASONAL_DEFAULT_WINDOW_DAYS2, TRADITIONAL_PHRASE_REPLACEMENTS: TRADITIONAL_PHRASE_REPLACEMENTS2, TRADITIONAL_CHAR_MAP: TRADITIONAL_CHAR_MAP2 } = runtime2;
    function normalizeDate(value) {
      if (!value) {
        return "";
      }
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return "";
      }
      return formatIsoDate(date);
    }
    function formatIsoDate(date) {
      return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
      ].join("-");
    }
    function addDays(date, amount) {
      const result = new Date(date);
      result.setDate(result.getDate() + amount);
      return result;
    }
    function formatDate(value) {
      return new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "short",
        day: "numeric"
      }).format(new Date(value));
    }
    function formatDateTime(value) {
      return new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date(value));
    }
    function formatBirdreportDateTime(value) {
      const text = String(value || "").trim();
      if (!text) {
        return "未提供";
      }
      const normalized = text.replace(" ", "T");
      const parsed = new Date(normalized);
      return Number.isNaN(parsed.getTime()) ? text : formatDateTime(parsed.toISOString());
    }
    function toNumber(value) {
      if (value === "" || value == null) {
        return null;
      }
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    }
    function parsePositiveInteger(value) {
      if (value === "" || value == null) {
        return null;
      }
      const number = Number(value);
      if (!Number.isFinite(number) || number < 1) {
        return null;
      }
      return Math.round(number);
    }
    function toTaxonOrder(value) {
      if (value === "" || value == null) {
        return null;
      }
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    }
    function createId() {
      return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }
    function extractGenus(value) {
      const genus = String(value || "").trim().split(/\s+/, 1)[0];
      return genus && /^[A-Z][A-Za-z-]+$/.test(genus) ? genus : "";
    }
    function simplifyChineseText(value) {
      let result = String(value || "").trim();
      TRADITIONAL_PHRASE_REPLACEMENTS2.forEach(([source, target]) => {
        result = result.replaceAll(source, target);
      });
      return [...result].map((char) => TRADITIONAL_CHAR_MAP2[char] || char).join("");
    }
    function chunkArray(items, size) {
      const chunks = [];
      for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
      }
      return chunks;
    }
    function clampBackDays(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) {
        return 14;
      }
      return Math.min(30, Math.max(1, Math.round(number)));
    }
    function clampEbirdSeasonalYears(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) {
        return EBIRD_SEASONAL_DEFAULT_YEARS2;
      }
      return Math.min(15, Math.max(1, Math.round(number)));
    }
    function clampEbirdSeasonalWindow(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) {
        return EBIRD_SEASONAL_DEFAULT_WINDOW_DAYS2;
      }
      return Math.min(14, Math.max(0, Math.round(number)));
    }
    function escapeHtml(value) {
      return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
    }
    function encodeBase64Utf8(value) {
      return btoa(unescape(encodeURIComponent(String(value))));
    }
    Object.assign(runtime2, {
      normalizeDate,
      formatIsoDate,
      addDays,
      formatDate,
      formatDateTime,
      formatBirdreportDateTime,
      toNumber,
      parsePositiveInteger,
      toTaxonOrder,
      createId,
      extractGenus,
      simplifyChineseText,
      chunkArray,
      clampBackDays,
      clampEbirdSeasonalYears,
      clampEbirdSeasonalWindow,
      escapeHtml,
      encodeBase64Utf8
    });
  }

  // src/script/shared/ui.js
  function installSharedUi(runtime2) {
    const { state: state2, elements: elements2, EMPTY_STATE_COPY: EMPTY_STATE_COPY2 } = runtime2;
    const escapeHtml = (...args) => runtime2.escapeHtml(...args);
    function renderEmptyState(target, variant, options = {}) {
      if (!target) {
        return;
      }
      const copy = {
        ...EMPTY_STATE_COPY2[variant] || {},
        ...options
      };
      const title = copy.title || "暂无结果";
      const description = copy.description || "完成查询后，结果会显示在这里。";
      const variantClass = String(variant || "default").replace(/[^a-z0-9-]/gi, "") || "default";
      target.innerHTML = `
    <div class="empty-state result-empty result-empty--${variantClass}" role="status">
      <strong class="empty-state-title">${escapeHtml(title)}</strong>
      <span>${escapeHtml(description)}</span>
    </div>
  `;
    }
    function setMessage(message, isError = false) {
      setStatusMessage(elements2.importMessage, message, isError);
    }
    function setEbirdMessage(message, isError = false) {
      setStatusMessage(elements2.ebirdMessage, message, isError);
    }
    function setEbirdSeasonalMessage(message, isError = false) {
      setStatusMessage(elements2.ebirdSeasonalMessage, message, isError);
    }
    function setBirdreportMessage(message, isError = false) {
      setStatusMessage(elements2.birdreportMessage, message, isError);
    }
    function setBirdPrepMessage(message, isError = false) {
      setStatusMessage(elements2.birdPrepMessage, message, isError);
    }
    function setStatusMessage(target, message, isError = false) {
      if (!target) {
        return;
      }
      target.textContent = message;
      target.classList.toggle("error", Boolean(isError));
    }
    function setElementLoadingClass(element, isLoading) {
      if (!element) {
        return;
      }
      const loading = Boolean(isLoading);
      element.classList.toggle("is-loading", loading);
      if (loading) {
        element.setAttribute("aria-busy", "true");
      } else {
        element.removeAttribute("aria-busy");
      }
    }
    function setEbirdLoading(isLoading) {
      elements2.syncEbirdBtn.disabled = isLoading;
      elements2.clearEbirdKeyBtn.disabled = isLoading;
      elements2.syncEbirdBtn.textContent = isLoading ? "查询中..." : "查询 eBird";
      setElementLoadingClass(elements2.syncEbirdBtn, isLoading);
      setElementLoadingClass(elements2.ebirdMessage, isLoading);
    }
    function setEbirdSeasonalLoading(isLoading) {
      if (elements2.analyzeEbirdSeasonalBtn) {
        elements2.analyzeEbirdSeasonalBtn.disabled = isLoading;
        elements2.analyzeEbirdSeasonalBtn.textContent = isLoading ? "分析中..." : "分析浙江当季鸟种";
        setElementLoadingClass(elements2.analyzeEbirdSeasonalBtn, isLoading);
      }
      if (elements2.clearEbirdSeasonalCacheBtn) {
        elements2.clearEbirdSeasonalCacheBtn.disabled = isLoading;
      }
      setElementLoadingClass(elements2.ebirdSeasonalMessage, isLoading);
    }
    Object.assign(runtime2, {
      renderEmptyState,
      setMessage,
      setEbirdMessage,
      setEbirdSeasonalMessage,
      setBirdreportMessage,
      setBirdPrepMessage,
      setStatusMessage,
      setElementLoadingClass,
      setEbirdLoading,
      setEbirdSeasonalLoading
    });
  }

  // src/script/shared/download.js
  function installDownloads(runtime2) {
    function toCsvText(rows) {
      return rows.map((row) => row.map(escapeCsvField).join(",")).join("\r\n");
    }
    function escapeCsvField(value) {
      const text = String(value ?? "");
      if (!/[",\r\n]/.test(text)) {
        return text;
      }
      return `"${text.replace(/"/g, '""')}"`;
    }
    async function saveTextFile(filename, mimeType, content) {
      if (window.BeauBirdAndroid && typeof window.BeauBirdAndroid.saveTextFile === "function") {
        return window.BeauBirdAndroid.saveTextFile(filename, mimeType, content) || filename;
      }
      if (window.showSaveFilePicker) {
        try {
          const fileHandle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [
              {
                description: "CSV 表格",
                accept: {
                  [mimeType]: [".csv"]
                }
              }
            ]
          });
          const writable = await fileHandle.createWritable();
          await writable.write(content);
          await writable.close();
          return fileHandle.name || filename;
        } catch (error) {
          if (error?.name === "AbortError") {
            throw error;
          }
          console.warn("showSaveFilePicker failed, falling back to anchor download:", error);
        }
      }
      if (window.location.protocol === "file:") {
        triggerFileDownload(filename, `data:${mimeType},${encodeURIComponent(content)}`);
        return filename;
      }
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      triggerFileDownload(filename, url, () => URL.revokeObjectURL(url));
      return filename;
    }
    function triggerFileDownload(filename, href, cleanup) {
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = filename;
      anchor.rel = "noopener";
      anchor.style.display = "none";
      document.body.append(anchor);
      try {
        anchor.dispatchEvent(new MouseEvent("click", { view: window, bubbles: true, cancelable: true }));
      } finally {
        setTimeout(() => {
          anchor.remove();
          cleanup?.();
        }, 60 * 1e3);
      }
    }
    Object.assign(runtime2, {
      toCsvText,
      escapeCsvField,
      saveTextFile,
      triggerFileDownload
    });
  }

  // src/script/app/runtime.js
  function installRuntime(runtime2) {
    const { ANDROID_APP_USER_AGENT_TOKEN: ANDROID_APP_USER_AGENT_TOKEN2, DEFAULT_BIRDREPORT_PROXY_URL: DEFAULT_BIRDREPORT_PROXY_URL2, ANDROID_BIRDREPORT_PROXY_URL: ANDROID_BIRDREPORT_PROXY_URL2 } = runtime2;
    const normalizeProxyBaseUrl = (...args) => runtime2.normalizeProxyBaseUrl(...args);
    function handleQuickNavClick(event) {
      const targetId = event.currentTarget?.dataset?.target;
      if (!targetId) {
        return;
      }
      const section = document.getElementById(targetId);
      if (!section) {
        return;
      }
      setActiveQuickNav(targetId);
      markJumpTarget(section);
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    function markJumpTarget(section) {
      document.querySelectorAll(".panel.is-jump-target").forEach((panel) => {
        panel.classList.remove("is-jump-target");
      });
      const token = String(Date.now());
      section.dataset.jumpFocusToken = token;
      section.classList.add("is-jump-target");
      window.setTimeout(() => {
        if (section.dataset.jumpFocusToken === token) {
          section.classList.remove("is-jump-target");
          delete section.dataset.jumpFocusToken;
        }
      }, 520);
    }
    function setActiveQuickNav(targetId) {
      document.querySelectorAll(".app-quicknav-btn").forEach((button) => {
        const isActive = button.dataset.target === targetId;
        button.classList.toggle("is-active", isActive);
        button.toggleAttribute("aria-current", isActive);
        if (isActive) {
          button.setAttribute("aria-current", "true");
        }
      });
    }
    function initEmbeddedAndroidQuickNav() {
      if (!isEmbeddedAndroidApp()) {
        return;
      }
      const sections = ["monitorSection", "birdMapSection", "unlockedSection", "birdPrepSection", "ebirdSection", "birdreportSection"].map((id) => document.getElementById(id)).filter(Boolean);
      if (!sections.length || !("IntersectionObserver" in window)) {
        return;
      }
      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries.filter((entry) => entry.isIntersecting).sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
          if (visible?.target?.id) {
            setActiveQuickNav(visible.target.id);
          }
        },
        {
          rootMargin: "-18% 0px -56% 0px",
          threshold: [0.2, 0.35, 0.55]
        }
      );
      sections.forEach((section) => observer.observe(section));
    }
    function isEmbeddedAndroidApp() {
      return navigator.userAgent.includes(ANDROID_APP_USER_AGENT_TOKEN2);
    }
    function getDefaultBirdreportProxyUrl() {
      if (isEmbeddedAndroidApp()) {
        return ANDROID_BIRDREPORT_PROXY_URL2;
      }
      if (window.location.protocol === "file:") {
        return DEFAULT_BIRDREPORT_PROXY_URL2;
      }
      return window.location.origin;
    }
    function applyRuntimeEnvironment() {
      if (isEmbeddedAndroidApp()) {
        document.body.classList.add("embedded-android-app");
      }
    }
    function lockEmbeddedAndroidViewport() {
      if (!isEmbeddedAndroidApp()) {
        return;
      }
      const applyViewport = () => {
        let viewport = document.querySelector('meta[name="viewport"]');
        if (!viewport) {
          viewport = document.createElement("meta");
          viewport.setAttribute("name", "viewport");
          document.head.append(viewport);
        }
        viewport.setAttribute(
          "content",
          "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        );
        document.documentElement.style.width = "100%";
        document.documentElement.style.maxWidth = "100%";
        document.body.style.width = "100%";
        document.body.style.maxWidth = "100%";
        document.body.style.overflowX = "hidden";
      };
      applyViewport();
      window.addEventListener("resize", applyViewport, { passive: true });
      window.visualViewport?.addEventListener("resize", applyViewport, { passive: true });
      window.addEventListener("orientationchange", applyViewport, { passive: true });
    }
    function getBirdreportProxyBaseUrl() {
      return normalizeProxyBaseUrl(getDefaultBirdreportProxyUrl());
    }
    Object.assign(runtime2, {
      handleQuickNavClick,
      markJumpTarget,
      setActiveQuickNav,
      initEmbeddedAndroidQuickNav,
      isEmbeddedAndroidApp,
      getDefaultBirdreportProxyUrl,
      applyRuntimeEnvironment,
      lockEmbeddedAndroidViewport,
      getBirdreportProxyBaseUrl
    });
  }

  // src/script/features/records.js
  function installRecords(runtime2) {
    const { PERSONAL_STORAGE_KEY: PERSONAL_STORAGE_KEY2, LEGACY_STORAGE_KEY: LEGACY_STORAGE_KEY2, COMMON_BIRD_TAXONOMY: COMMON_BIRD_TAXONOMY2, ROOT_CLASS_LABEL: ROOT_CLASS_LABEL2, UNKNOWN_ORDER_LABEL: UNKNOWN_ORDER_LABEL2, UNKNOWN_FAMILY_LABEL: UNKNOWN_FAMILY_LABEL2, UNKNOWN_GENUS_LABEL: UNKNOWN_GENUS_LABEL2, TAXON_ZH_MAP: TAXON_ZH_MAP2, state: state2, elements: elements2 } = runtime2;
    const addDays = (...args) => runtime2.addDays(...args);
    const createId = (...args) => runtime2.createId(...args);
    const escapeHtml = (...args) => runtime2.escapeHtml(...args);
    const extractGenus = (...args) => runtime2.extractGenus(...args);
    const formatDate = (...args) => runtime2.formatDate(...args);
    const formatIsoDate = (...args) => runtime2.formatIsoDate(...args);
    const normalizeDate = (...args) => runtime2.normalizeDate(...args);
    const parsePositiveInteger = (...args) => runtime2.parsePositiveInteger(...args);
    const renderRegionQueryResults = (...args) => runtime2.renderRegionQueryResults(...args);
    const safeLocalStorageGet = (...args) => runtime2.safeLocalStorageGet(...args);
    const safeLocalStorageSet = (...args) => runtime2.safeLocalStorageSet(...args);
    const setMessage = (...args) => runtime2.setMessage(...args);
    const simplifyChineseText = (...args) => runtime2.simplifyChineseText(...args);
    const toNumber = (...args) => runtime2.toNumber(...args);
    const toTaxonOrder = (...args) => runtime2.toTaxonOrder(...args);
    function importText(text, sourceName) {
      const trimmed = text.trim();
      if (!trimmed) {
        setMessage("没有可导入的内容。", true);
        return;
      }
      try {
        const imported = parseInput(trimmed);
        if (!imported.length) {
          setMessage("未识别到有效记录，请检查格式。", true);
          return;
        }
        state2.personalRecords = normalizeRecords([...state2.personalRecords, ...imported]);
        persistAndRender();
        setMessage(`已从${sourceName}导入 ${imported.length} 条个人记录，当前共 ${state2.personalRecords.length} 条。`);
      } catch (error) {
        setMessage(`导入失败：${error.message}`, true);
      }
    }
    function parseInput(text) {
      const compact = text.trim();
      if (compact.startsWith("[") || compact.startsWith("{")) {
        return parseJsonInput(compact);
      }
      const firstLine = compact.split(/\r?\n/, 1)[0];
      if ((firstLine.includes(",") || firstLine.includes("	")) && /date|species|location|lat|lng|common|observation/i.test(firstLine)) {
        return parseDelimitedInput(compact, firstLine.includes("	") ? "	" : ",");
      }
      return parseLineInput(compact);
    }
    function parseJsonInput(text) {
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      return items.map((item) => toRecord(item));
    }
    function parseDelimitedInput(text, delimiter = ",") {
      const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (lines.length < 2) {
        return [];
      }
      const headers = splitDelimitedLine(lines[0], delimiter).map((header) => normalizeHeaderName(header));
      return lines.slice(1).map((line) => {
        const cells = splitDelimitedLine(line, delimiter);
        const raw = headers.reduce((result, header, index) => {
          result[header] = cells[index] ?? "";
          return result;
        }, {});
        return toRecord(raw);
      });
    }
    function parseLineInput(text) {
      return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
        const parts = line.split(/[\t,，]/).map((part) => part.trim());
        return toRecord({
          date: parts[0],
          species: parts[1],
          location: parts[2],
          lat: parts[3],
          lng: parts[4],
          notes: parts.slice(5).join(" ")
        });
      });
    }
    function splitDelimitedLine(line, delimiter = ",") {
      const cells = [];
      let current = "";
      let quoted = false;
      for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        const next = line[index + 1];
        if (char === '"') {
          if (quoted && next === '"') {
            current += '"';
            index += 1;
          } else {
            quoted = !quoted;
          }
          continue;
        }
        if (char === delimiter && !quoted) {
          cells.push(current);
          current = "";
          continue;
        }
        current += char;
      }
      cells.push(current);
      return cells;
    }
    function toRecord(raw) {
      const record = normalizeRecord({
        date: getRawValue(raw, ["date", "observedat", "time", "obsdt", "observationdate"]),
        species: getRawValue(raw, ["species", "name", "bird", "commonname", "comname"]),
        location: getRawValue(raw, ["location", "place", "site", "locname", "locationname"]),
        notes: getRawValue(raw, ["notes", "note", "comment", "comments", "speciescomments"]),
        lat: getRawValue(raw, ["lat", "latitude"]),
        lng: getRawValue(raw, ["lng", "lon", "longitude"]),
        sciName: getRawValue(raw, ["sciname", "scientificname", "scientific_name"]),
        speciesCode: getRawValue(raw, ["speciescode", "species_code"]),
        taxonOrder: getRawValue(raw, ["taxonorder", "taxon_order"]),
        orderName: getRawValue(raw, ["ordername", "order", "order_name"]),
        familyName: getRawValue(raw, ["familyname", "family", "familysciname", "family_name"]),
        familyCommonName: getRawValue(raw, ["familycommonname", "familycommon", "familycomname", "family_common"]),
        genusName: getRawValue(raw, ["genusname", "genus", "genus_name"])
      });
      if (!record.date || !record.species || !record.location) {
        throw new Error("每条记录至少需要日期、种类和地点。");
      }
      return record;
    }
    function getRawValue(raw, keys) {
      for (const key of keys) {
        if (raw[key] != null && raw[key] !== "") {
          return raw[key];
        }
        const matchedKey = Object.keys(raw).find((rawKey) => normalizeHeaderName(rawKey) === normalizeHeaderName(key));
        if (matchedKey && raw[matchedKey] != null && raw[matchedKey] !== "") {
          return raw[matchedKey];
        }
      }
      return "";
    }
    function normalizeHeaderName(value) {
      return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
    }
    function normalizeRecords(records) {
      return records.map((record) => normalizeRecord(record)).filter((record) => record.date && record.species && record.location).sort((left, right) => right.date.localeCompare(left.date));
    }
    function persistAndRender() {
      savePersonalRecords(state2.personalRecords);
      render();
    }
    function render() {
      renderRegionQueryResults();
    }
    function renderFilters() {
      const previousValue = elements2.speciesFilter.value;
      const speciesList = [...new Set(state2.personalRecords.map((record) => record.species))].sort((a, b) => a.localeCompare(b, "zh-CN"));
      elements2.speciesFilter.innerHTML = '<option value="">全部种类</option>';
      speciesList.forEach((species) => {
        const option = document.createElement("option");
        option.value = species;
        option.textContent = species;
        elements2.speciesFilter.append(option);
      });
      if (speciesList.includes(previousValue)) {
        elements2.speciesFilter.value = previousValue;
      }
    }
    function renderRecordsOnly() {
      const viewMode = elements2.viewMode.value;
      const filtered = getVisibleRecords();
      elements2.recordsContainer.className = `records ${viewMode === "list" ? "list" : "cards"}`;
      renderStats(filtered);
      renderTaxonomyBrowser(filtered);
      if (!filtered.length) {
        elements2.recordsContainer.innerHTML = '<div class="empty-state">当前筛选条件下没有记录。</div>';
        return;
      }
      elements2.recordsContainer.innerHTML = "";
      filtered.forEach((record) => {
        const item = document.createElement("article");
        item.className = "record";
        item.innerHTML = `
      <div>
        <strong>${escapeHtml(record.species)}</strong>
        <small>${escapeHtml(formatDate(record.date))}</small>
      </div>
      <div>${escapeHtml(record.location)}</div>
      <div>
        ${record.lat != null && record.lng != null ? `<small>坐标：${record.lat.toFixed(3)}, ${record.lng.toFixed(3)}</small>` : "<small>未提供坐标</small>"}
        ${record.notes ? `<div class="record-note">${escapeHtml(record.notes)}</div>` : ""}
      </div>
    `;
        elements2.recordsContainer.append(item);
      });
    }
    function renderStats(records) {
      if (!state2.personalRecords.length) {
        elements2.statsSummary.textContent = "还没有观鸟记录。";
        return;
      }
      const speciesCount = new Set(records.map((record) => record.species)).size;
      const coordinateCount = records.filter((record) => record.lat != null && record.lng != null).length;
      elements2.statsSummary.textContent = `当前展示 ${records.length} 条个人记录，涉及 ${speciesCount} 个种类，其中 ${coordinateCount} 条可用于地图热力图。`;
    }
    function renderTaxonomyBrowser(records) {
      elements2.taxonomyBrowser.innerHTML = "";
      if (!records.length) {
        return;
      }
      const root = buildTaxonomyTree(records);
      if (!root) {
        return;
      }
      const list = document.createElement("ul");
      list.className = "taxonomy-list";
      list.append(renderTaxonomyNode(root, 0, "class:Aves"));
      elements2.taxonomyBrowser.append(list);
    }
    function renderLifeList() {
      const context = getLifeListContext();
      elements2.lifeSummary.textContent = context.summary;
      elements2.lifeListContainer.innerHTML = "";
      if (!context.entries.length) {
        elements2.lifeListContainer.innerHTML = '<div class="empty-state">当前区域和时间范围内还没有个人生涯记录。</div>';
        return;
      }
      context.entries.forEach((entry) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "life-item";
        item.innerHTML = `
      <strong>${escapeHtml(entry.species)}</strong>
      <span>最近记录：${escapeHtml(entry.lastSeenLabel)}</span>
      <span>首次记录：${escapeHtml(entry.firstSeenLabel)}</span>
      <span>累计 ${entry.count} 条 · ${entry.locationCount} 个地点</span>
    `;
        item.addEventListener("click", () => {
          elements2.speciesFilter.value = entry.species;
          renderRecordsOnly();
        });
        elements2.lifeListContainer.append(item);
      });
    }
    function renderSpeciesDiscovery() {
      const context = getSpeciesDiscoveryContext();
      elements2.speciesDiscoverySummary.textContent = context.summary;
      elements2.speciesDiscoveryContainer.innerHTML = "";
      if (!context.entries.length) {
        elements2.speciesDiscoveryContainer.innerHTML = '<div class="empty-state">当前时间和地区条件下没有匹配到鸟种。</div>';
        return;
      }
      context.entries.forEach((entry) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "life-item";
        item.innerHTML = `
      <strong>${escapeHtml(entry.species)}</strong>
      <span>首次记录：${escapeHtml(entry.firstSeenLabel)}</span>
      <span>最近记录：${escapeHtml(entry.lastSeenLabel)}</span>
      <span>${entry.count} 条记录 · ${entry.locationCount} 个地点</span>
    `;
        item.addEventListener("click", () => {
          elements2.speciesFilter.value = entry.species;
          renderRecordsOnly();
        });
        elements2.speciesDiscoveryContainer.append(item);
      });
    }
    function getVisibleRecords() {
      const species = elements2.speciesFilter.value;
      const sortOrder = elements2.sortOrder.value;
      return state2.personalRecords.filter((record) => !species || record.species === species).sort((left, right) => {
        const result = left.date.localeCompare(right.date);
        return sortOrder === "asc" ? result : -result;
      });
    }
    function getLifeListContext() {
      const today = /* @__PURE__ */ new Date();
      today.setHours(0, 0, 0, 0);
      if (!state2.personalRecords.length) {
        return {
          entries: [],
          summary: "还没有可统计的个人记录。"
        };
      }
      const regionInput = String(elements2.lifeRegionFilter.value || "").trim();
      const regionKeyword = regionInput.toLocaleLowerCase("zh-CN");
      const backDays = parsePositiveInteger(elements2.lifeBackDays.value);
      const earliestDate = state2.personalRecords.reduce(
        (result, record) => record.date < result ? record.date : result,
        state2.personalRecords[0].date
      );
      const startDate = backDays == null ? earliestDate : formatIsoDate(addDays(today, -(backDays - 1)));
      const endDate = formatIsoDate(today);
      const filteredRecords = state2.personalRecords.filter((record) => {
        const inRegion = !regionKeyword || record.location.toLocaleLowerCase("zh-CN").includes(regionKeyword);
        const inRange = record.date >= startDate && record.date <= endDate;
        return inRegion && inRange;
      });
      const grouped = buildSpeciesAggregate(filteredRecords);
      const entries = [...grouped.values()].map((entry) => ({
        species: entry.species,
        count: entry.count,
        firstSeen: entry.firstSeen,
        lastSeen: entry.lastSeen,
        firstSeenLabel: formatDate(entry.firstSeen),
        lastSeenLabel: formatDate(entry.lastSeen),
        locationCount: entry.locations.size
      })).sort((left, right) => {
        if (left.lastSeen !== right.lastSeen) {
          return right.lastSeen.localeCompare(left.lastSeen);
        }
        if (left.count !== right.count) {
          return right.count - left.count;
        }
        return left.species.localeCompare(right.species, "zh-CN");
      });
      const regionText = regionInput ? `区域包含“${regionInput}”` : "全部区域";
      const timeText = backDays == null ? `${formatDate(startDate)} 至 ${formatDate(endDate)}` : `最近 ${backDays} 天（${formatDate(startDate)} 至 ${formatDate(endDate)}）`;
      return {
        entries,
        summary: `${regionText}，时间范围 ${timeText}，累计 ${filteredRecords.length} 条记录，涉及 ${entries.length} 个生涯种。`
      };
    }
    function getSpeciesDiscoveryContext() {
      if (!state2.personalRecords.length) {
        return {
          entries: [],
          summary: "还没有可筛选的个人记录。"
        };
      }
      const regionInput = String(elements2.speciesDiscoveryRegion.value || "").trim();
      const regionKeyword = regionInput.toLocaleLowerCase("zh-CN");
      const startDate = normalizeDateInput(elements2.speciesDiscoveryStart.value) || getRecordBoundaryDate("earliest");
      const endDate = normalizeDateInput(elements2.speciesDiscoveryEnd.value) || getRecordBoundaryDate("latest");
      const validStartDate = startDate <= endDate ? startDate : endDate;
      const validEndDate = startDate <= endDate ? endDate : startDate;
      const filteredRecords = state2.personalRecords.filter((record) => {
        const inRegion = !regionKeyword || record.location.toLocaleLowerCase("zh-CN").includes(regionKeyword);
        const inRange = record.date >= validStartDate && record.date <= validEndDate;
        return inRegion && inRange;
      });
      const grouped = buildSpeciesAggregate(filteredRecords);
      const entries = [...grouped.values()].map((entry) => ({
        species: entry.species,
        count: entry.count,
        firstSeen: entry.firstSeen,
        lastSeen: entry.lastSeen,
        firstSeenLabel: formatDate(entry.firstSeen),
        lastSeenLabel: formatDate(entry.lastSeen),
        locationCount: entry.locations.size
      })).sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }
        if (right.lastSeen !== left.lastSeen) {
          return right.lastSeen.localeCompare(left.lastSeen);
        }
        return left.species.localeCompare(right.species, "zh-CN");
      });
      return {
        entries,
        summary: `筛选范围：${regionInput || "全部地区"} · ${formatDate(validStartDate)} 至 ${formatDate(validEndDate)}，共找到 ${entries.length} 个鸟种，匹配 ${filteredRecords.length} 条记录。`
      };
    }
    function buildSpeciesAggregate(records) {
      const grouped = /* @__PURE__ */ new Map();
      records.forEach((record) => {
        if (!grouped.has(record.species)) {
          grouped.set(record.species, {
            species: record.species,
            count: 0,
            firstSeen: record.date,
            lastSeen: record.date,
            locations: /* @__PURE__ */ new Set()
          });
        }
        const bucket = grouped.get(record.species);
        bucket.count += 1;
        bucket.firstSeen = record.date < bucket.firstSeen ? record.date : bucket.firstSeen;
        bucket.lastSeen = record.date > bucket.lastSeen ? record.date : bucket.lastSeen;
        bucket.locations.add(record.location);
      });
      return grouped;
    }
    function getRecordBoundaryDate(mode) {
      if (!state2.personalRecords.length) {
        return formatIsoDate(/* @__PURE__ */ new Date());
      }
      return state2.personalRecords.reduce((result, record) => {
        if (mode === "earliest") {
          return record.date < result ? record.date : result;
        }
        return record.date > result ? record.date : result;
      }, state2.personalRecords[0].date);
    }
    function normalizeDateInput(value) {
      const normalized = String(value || "").trim();
      return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
    }
    function initMap() {
      if (!window.L) {
        setMessage("地图组件未加载，地图热力图不可用。", true);
        return;
      }
      state2.map = L.map("map", {
        center: [31.23, 121.47],
        zoom: 5,
        scrollWheelZoom: true
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(state2.map);
    }
    function renderMap() {
      if (!state2.map || !window.L || !L.heatLayer) {
        return;
      }
      const points = buildHeatPoints(elements2.heatMetric.value);
      if (state2.heatLayer) {
        state2.map.removeLayer(state2.heatLayer);
        state2.heatLayer = null;
      }
      if (!points.length) {
        state2.map.setView([31.23, 121.47], 5);
        return;
      }
      state2.heatLayer = L.heatLayer(points, {
        radius: 28,
        blur: 22,
        maxZoom: 10,
        minOpacity: 0.4
      }).addTo(state2.map);
      const bounds = L.latLngBounds(points.map(([lat, lng]) => [lat, lng]));
      state2.map.fitBounds(bounds.pad(0.35));
    }
    function buildHeatPoints(metric) {
      const coordinateRecords = state2.personalRecords.filter((record) => record.lat != null && record.lng != null);
      if (!coordinateRecords.length) {
        return [];
      }
      const grouped = /* @__PURE__ */ new Map();
      coordinateRecords.forEach((record) => {
        const key = `${record.lat.toFixed(4)},${record.lng.toFixed(4)}`;
        if (!grouped.has(key)) {
          grouped.set(key, {
            lat: record.lat,
            lng: record.lng,
            count: 0,
            species: /* @__PURE__ */ new Set()
          });
        }
        const bucket = grouped.get(key);
        bucket.count += 1;
        bucket.species.add(record.species);
      });
      const rawPoints = [...grouped.values()].map((item) => [
        item.lat,
        item.lng,
        metric === "speciesRichness" ? item.species.size : item.count
      ]);
      const maxWeight = Math.max(...rawPoints.map((point) => point[2]), 1);
      return rawPoints.map(([lat, lng, weight]) => [lat, lng, weight / maxWeight]);
    }
    function renderCalendarHeatmap() {
      const days = buildCalendarDays();
      const counts = state2.personalRecords.reduce((result, record) => {
        result[record.date] = (result[record.date] || 0) + 1;
        return result;
      }, {});
      const maxCount = Math.max(...Object.values(counts), 0);
      renderLegend(maxCount);
      elements2.calendarHeatmap.innerHTML = "";
      const grid = document.createElement("div");
      grid.className = "calendar-grid";
      days.forEach((day) => {
        const cell = document.createElement("div");
        const count = day ? counts[day] || 0 : 0;
        cell.className = `day-cell${day ? "" : " empty"}`;
        if (day) {
          cell.style.background = calendarColor(count, maxCount);
          cell.title = `${day}：${count} 条记录`;
        }
        grid.append(cell);
      });
      elements2.calendarHeatmap.append(grid);
    }
    function renderLegend(maxCount) {
      const levels = [0, 0.25, 0.5, 0.75, 1];
      const scale = levels.map((level) => `<span class="legend-cell" style="background:${calendarColor(Math.round(maxCount * level), maxCount)}"></span>`).join("");
      elements2.calendarLegend.innerHTML = `
    <span>少</span>
    <span class="legend-scale">${scale}</span>
    <span>多</span>
  `;
    }
    function mergeRecords(existingRecords, incomingRecords) {
      const merged = [...existingRecords];
      const seen = new Set(existingRecords.map(createDedupKey));
      let addedCount = 0;
      let duplicateCount = 0;
      incomingRecords.forEach((record) => {
        const key = createDedupKey(record);
        if (seen.has(key)) {
          duplicateCount += 1;
          return;
        }
        seen.add(key);
        merged.push(record);
        addedCount += 1;
      });
      return {
        mergedRecords: normalizeRecords(merged),
        addedCount,
        duplicateCount
      };
    }
    function createDedupKey(record) {
      return [
        record.date,
        record.species,
        record.location,
        record.lat == null ? "" : Number(record.lat).toFixed(4),
        record.lng == null ? "" : Number(record.lng).toFixed(4)
      ].join("|");
    }
    function normalizeRecord(record) {
      const species = simplifyChineseText(String(record.species || "").trim());
      const sciName = String(record.sciName || record.scientificName || "").trim();
      const speciesCode = String(record.speciesCode || record.species_code || "").trim();
      const fallbackTaxonomy = getFallbackTaxonomy(species, speciesCode, sciName);
      const finalSciName = sciName || fallbackTaxonomy.sciName || "";
      const genusName = String(record.genusName || record.genus || extractGenus(finalSciName) || fallbackTaxonomy.genusName || "").trim();
      const familyCommonName = simplifyChineseText(
        String(record.familyCommonName || record.familyCommon || fallbackTaxonomy.familyCommonName || "").trim()
      );
      return {
        id: record.id || createId(),
        date: normalizeDate(record.date),
        species,
        location: String(record.location || "").trim(),
        lat: toNumber(record.lat),
        lng: toNumber(record.lng),
        notes: String(record.notes || "").trim(),
        speciesCode: speciesCode || fallbackTaxonomy.speciesCode || "",
        sciName: finalSciName,
        taxonOrder: toTaxonOrder(record.taxonOrder ?? record.taxon_order) ?? fallbackTaxonomy.taxonOrder ?? null,
        className: "Aves",
        orderName: String(record.orderName || record.order || fallbackTaxonomy.orderName || "").trim(),
        familyName: String(record.familyName || record.family || fallbackTaxonomy.familyName || "").trim(),
        familyCommonName,
        genusName
      };
    }
    function migrateExistingRecords() {
      const previousSnapshot = JSON.stringify(state2.personalRecords);
      const normalized = normalizeRecords(state2.personalRecords);
      const changed = countMigratedRecords(state2.personalRecords, normalized);
      if (previousSnapshot !== JSON.stringify(normalized)) {
        state2.personalRecords = normalized;
      }
      return { changed };
    }
    function countMigratedRecords(previousRecords, nextRecords) {
      const limit = Math.min(previousRecords.length, nextRecords.length);
      let changed = Math.abs(previousRecords.length - nextRecords.length);
      for (let index = 0; index < limit; index += 1) {
        const previous = previousRecords[index] || {};
        const next = nextRecords[index] || {};
        if (String(previous.species || "") !== String(next.species || "") || String(previous.orderName || previous.order || "") !== String(next.orderName || "") || String(previous.familyName || previous.family || "") !== String(next.familyName || "") || String(previous.familyCommonName || previous.familyCommon || "") !== String(next.familyCommonName || "") || String(previous.genusName || previous.genus || "") !== String(next.genusName || "") || String(previous.sciName || previous.scientificName || "") !== String(next.sciName || "") || String(previous.speciesCode || previous.species_code || "") !== String(next.speciesCode || "")) {
          changed += 1;
        }
      }
      return changed;
    }
    function buildInitialMessage() {
      if (!state2.personalRecords.length) {
        return "可以上传文件、粘贴内容，或先加载示例数据。";
      }
      if (state2.migrationSummary.changed > 0) {
        return `已加载 ${state2.personalRecords.length} 条个人记录，并自动更新了 ${state2.migrationSummary.changed} 条旧记录的鸟名/分类信息。`;
      }
      return `已加载 ${state2.personalRecords.length} 条个人记录。`;
    }
    function getFallbackTaxonomy(species, speciesCode, sciName) {
      if (species && COMMON_BIRD_TAXONOMY2[species]) {
        return COMMON_BIRD_TAXONOMY2[species];
      }
      if (sciName) {
        const entry = Object.values(COMMON_BIRD_TAXONOMY2).find((item) => item.sciName === sciName);
        if (entry) {
          return entry;
        }
      }
      if (speciesCode) {
        const entry = Object.values(COMMON_BIRD_TAXONOMY2).find((item) => item.speciesCode === speciesCode);
        if (entry) {
          return entry;
        }
      }
      return {};
    }
    function buildTaxonomyTree(records) {
      const root = createTaxonomyNode("class", "Aves", ROOT_CLASS_LABEL2);
      records.forEach((record) => {
        hydrateTaxonomyNode(root, record);
        const path = getTaxonomyPath(record);
        let current = root;
        path.forEach((segment) => {
          const nodeKey = `${segment.level}:${segment.key}`;
          if (!current.children.has(nodeKey)) {
            current.children.set(nodeKey, createTaxonomyNode(segment.level, segment.key, segment.label));
          }
          current = current.children.get(nodeKey);
          hydrateTaxonomyNode(current, record);
        });
      });
      return root.recordCount ? root : null;
    }
    function createTaxonomyNode(level, key, label) {
      return {
        level,
        key,
        label,
        recordCount: 0,
        speciesSet: /* @__PURE__ */ new Set(),
        sortValue: Number.POSITIVE_INFINITY,
        children: /* @__PURE__ */ new Map()
      };
    }
    function hydrateTaxonomyNode(node, record) {
      node.recordCount += 1;
      node.speciesSet.add(record.species);
      if (record.taxonOrder != null) {
        node.sortValue = Math.min(node.sortValue, record.taxonOrder);
      }
    }
    function getTaxonomyPath(record) {
      const orderKey = record.orderName || UNKNOWN_ORDER_LABEL2;
      const familyKey = record.familyName || UNKNOWN_FAMILY_LABEL2;
      const genusKey = record.genusName || UNKNOWN_GENUS_LABEL2;
      return [
        { level: "order", key: orderKey, label: formatTaxonLabel("order", orderKey) },
        { level: "family", key: familyKey, label: formatTaxonLabel("family", familyKey, record.familyCommonName) },
        { level: "genus", key: genusKey, label: formatTaxonLabel("genus", genusKey) },
        { level: "species", key: record.species, label: record.species }
      ];
    }
    function renderTaxonomyNode(node, depth, pathKey) {
      const item = document.createElement("li");
      item.className = `taxonomy-item level-${node.level}`;
      const hasChildren = node.children.size > 0;
      const isExpanded = state2.expandedTaxa.has(pathKey);
      const isActiveLeaf = node.level === "species" && elements2.speciesFilter.value === node.label;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `taxonomy-toggle${isExpanded ? " is-expanded" : ""}${hasChildren ? "" : " is-leaf"}${isActiveLeaf ? " is-active" : ""}`;
      button.style.setProperty("--depth", String(depth));
      button.setAttribute("aria-expanded", String(Boolean(hasChildren && isExpanded)));
      const caret = document.createElement("span");
      caret.className = "taxonomy-caret";
      caret.textContent = hasChildren ? isExpanded ? "▾" : "▸" : "•";
      const label = document.createElement("span");
      label.className = "taxonomy-label";
      label.textContent = node.label;
      const meta = document.createElement("span");
      meta.className = "taxonomy-meta";
      meta.textContent = node.level === "species" ? `${node.recordCount} 条` : `${node.speciesSet.size} 种 · ${node.recordCount} 条`;
      button.append(caret, label, meta);
      button.addEventListener("click", () => {
        if (hasChildren) {
          if (state2.expandedTaxa.has(pathKey)) {
            state2.expandedTaxa.delete(pathKey);
          } else {
            state2.expandedTaxa.add(pathKey);
          }
          renderRecordsOnly();
          return;
        }
        elements2.speciesFilter.value = elements2.speciesFilter.value === node.label ? "" : node.label;
        renderRecordsOnly();
      });
      item.append(button);
      if (hasChildren && isExpanded) {
        const list = document.createElement("ul");
        list.className = "taxonomy-list";
        getSortedTaxonomyChildren(node).forEach((child) => {
          const childPathKey = `${pathKey}/${child.level}:${child.key}`;
          list.append(renderTaxonomyNode(child, depth + 1, childPathKey));
        });
        item.append(list);
      }
      return item;
    }
    function getSortedTaxonomyChildren(node) {
      return [...node.children.values()].sort((left, right) => {
        if (left.sortValue !== right.sortValue) {
          return left.sortValue - right.sortValue;
        }
        return left.label.localeCompare(right.label, "zh-CN");
      });
    }
    function formatTaxonLabel(level, value, commonName = "") {
      if (!value) {
        return level === "order" ? UNKNOWN_ORDER_LABEL2 : level === "family" ? UNKNOWN_FAMILY_LABEL2 : UNKNOWN_GENUS_LABEL2;
      }
      if (level === "genus") {
        return /^[A-Z]/.test(value) ? `${value} 属` : value.endsWith("属") ? value : `${value}属`;
      }
      if (level === "family" && commonName) {
        const familyLabel = commonName.endsWith("科") ? commonName : `${commonName}科`;
        return `${familyLabel} (${value})`;
      }
      const zhStem = TAXON_ZH_MAP2[level]?.[value];
      if (zhStem) {
        const suffix = level === "order" ? "目" : "科";
        return `${zhStem}${suffix} (${value})`;
      }
      return value;
    }
    function buildCalendarDays() {
      const end = /* @__PURE__ */ new Date();
      end.setHours(0, 0, 0, 0);
      const start = new Date(end);
      start.setDate(end.getDate() - 364);
      start.setHours(0, 0, 0, 0);
      const days = [];
      const prefix = start.getDay();
      for (let index = 0; index < prefix; index += 1) {
        days.push(null);
      }
      const cursor = new Date(start);
      while (cursor <= end) {
        days.push(formatIsoDate(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      return days;
    }
    function calendarColor(count, maxCount) {
      if (!count || !maxCount) {
        return "#edf3ec";
      }
      const ratio = count / maxCount;
      if (ratio <= 0.25) {
        return "#cfe7d5";
      }
      if (ratio <= 0.5) {
        return "#92c9a0";
      }
      if (ratio <= 0.75) {
        return "#54a86c";
      }
      return "#2f7d4a";
    }
    function loadPersonalRecords2() {
      try {
        const personalRaw = safeLocalStorageGet(PERSONAL_STORAGE_KEY2, "");
        if (personalRaw) {
          return normalizeRecords(JSON.parse(personalRaw));
        }
        const legacyRaw = safeLocalStorageGet(LEGACY_STORAGE_KEY2, "");
        if (!legacyRaw) {
          return [];
        }
        return normalizeRecords(JSON.parse(legacyRaw)).filter((record) => !isLegacyRegionQueryRecord(record));
      } catch (error) {
        console.warn("Failed to load personal records:", error);
        return [];
      }
    }
    function savePersonalRecords(records) {
      safeLocalStorageSet(PERSONAL_STORAGE_KEY2, JSON.stringify(records));
    }
    function isLegacyRegionQueryRecord(record) {
      return String(record.notes || "").startsWith("eBird 同步");
    }
    Object.assign(runtime2, {
      importText,
      parseInput,
      parseJsonInput,
      parseDelimitedInput,
      parseLineInput,
      splitDelimitedLine,
      toRecord,
      getRawValue,
      normalizeHeaderName,
      normalizeRecords,
      persistAndRender,
      render,
      renderFilters,
      renderRecordsOnly,
      renderStats,
      renderTaxonomyBrowser,
      renderLifeList,
      renderSpeciesDiscovery,
      getVisibleRecords,
      getLifeListContext,
      getSpeciesDiscoveryContext,
      buildSpeciesAggregate,
      getRecordBoundaryDate,
      normalizeDateInput,
      initMap,
      renderMap,
      buildHeatPoints,
      renderCalendarHeatmap,
      renderLegend,
      mergeRecords,
      createDedupKey,
      normalizeRecord,
      migrateExistingRecords,
      countMigratedRecords,
      buildInitialMessage,
      getFallbackTaxonomy,
      buildTaxonomyTree,
      createTaxonomyNode,
      hydrateTaxonomyNode,
      getTaxonomyPath,
      renderTaxonomyNode,
      getSortedTaxonomyChildren,
      formatTaxonLabel,
      buildCalendarDays,
      calendarColor,
      loadPersonalRecords: loadPersonalRecords2,
      savePersonalRecords,
      isLegacyRegionQueryRecord
    });
  }

  // src/script/features/ebird/recent.js
  function installEbirdRecent(runtime2) {
    const { EBIRD_API_KEY_STORAGE: EBIRD_API_KEY_STORAGE2, EBIRD_REGION_STORAGE: EBIRD_REGION_STORAGE2, EBIRD_BACK_STORAGE: EBIRD_BACK_STORAGE2, EBIRD_SPECIES_LOCALE: EBIRD_SPECIES_LOCALE2, state: state2, elements: elements2 } = runtime2;
    const chunkArray = (...args) => runtime2.chunkArray(...args);
    const clampBackDays = (...args) => runtime2.clampBackDays(...args);
    const escapeHtml = (...args) => runtime2.escapeHtml(...args);
    const extractGenus = (...args) => runtime2.extractGenus(...args);
    const formatDate = (...args) => runtime2.formatDate(...args);
    const formatTaxonLabel = (...args) => runtime2.formatTaxonLabel(...args);
    const normalizeDate = (...args) => runtime2.normalizeDate(...args);
    const normalizeRecord = (...args) => runtime2.normalizeRecord(...args);
    const renderEmptyState = (...args) => runtime2.renderEmptyState(...args);
    const safeLocalStorageGet = (...args) => runtime2.safeLocalStorageGet(...args);
    const safeLocalStorageRemove = (...args) => runtime2.safeLocalStorageRemove(...args);
    const safeLocalStorageSet = (...args) => runtime2.safeLocalStorageSet(...args);
    const setEbirdLoading = (...args) => runtime2.setEbirdLoading(...args);
    const setEbirdMessage = (...args) => runtime2.setEbirdMessage(...args);
    const simplifyChineseText = (...args) => runtime2.simplifyChineseText(...args);
    const toNumber = (...args) => runtime2.toNumber(...args);
    const toTaxonOrder = (...args) => runtime2.toTaxonOrder(...args);
    function renderRegionQueryResults() {
      elements2.regionQuerySummary.textContent = "";
      elements2.regionQueryContainer.innerHTML = "";
      if (!state2.regionQueryRecords.length) {
        state2.activeRegionRecordId = null;
        renderRegionQueryDetail();
        renderEmptyState(elements2.regionQueryContainer, "ebird-region");
        return;
      }
      const speciesCount = new Set(state2.regionQueryRecords.map((record) => record.species)).size;
      elements2.regionQuerySummary.textContent = `当前区域查询结果共 ${state2.regionQueryRecords.length} 条，涉及 ${speciesCount} 个种类。这些结果不会保存到个人记录。`;
      if (!state2.regionQueryRecords.some((record) => record.id === state2.activeRegionRecordId)) {
        state2.activeRegionRecordId = null;
      }
      elements2.regionQueryContainer.innerHTML = `
    <div class="result-table" style="--table-columns: 72px minmax(210px, 1.4fr) minmax(260px, 1.9fr) 150px 116px;">
      <div class="result-table-header">
        <div class="result-table-cell">序号</div>
        <div class="result-table-cell">鸟种</div>
        <div class="result-table-cell">地点</div>
        <div class="result-table-cell">日期</div>
        <div class="result-table-cell">详情</div>
      </div>
      <div class="result-table-body">
        ${state2.regionQueryRecords.map((record, index) => {
        const isActive = record.id === state2.activeRegionRecordId;
        return `
              <div class="result-table-row${isActive ? " is-active" : ""}">
                <div class="result-table-cell result-table-index">${state2.regionQueryRecords.length - index}</div>
                <div class="result-table-cell">
                  <button
                    type="button"
                    class="result-table-name-btn"
                    data-region-record-id="${escapeHtml(String(record.id || ""))}"
                    aria-pressed="${isActive ? "true" : "false"}"
                  >
                    <strong>${escapeHtml(record.species)}</strong>
                    <span class="result-table-meta">${escapeHtml(record.sciName || "点击查看详情")}</span>
                  </button>
                </div>
                <div class="result-table-cell result-table-location">${escapeHtml(record.location || "未提供地点")}</div>
                <div class="result-table-cell result-table-date">${escapeHtml(formatDate(record.date))}</div>
                <div class="result-table-cell result-table-status">${isActive ? "已展开" : "查看详情"}</div>
              </div>
            `;
      }).join("")}
      </div>
    </div>
  `;
      elements2.regionQueryContainer.querySelectorAll("[data-region-record-id]").forEach((button) => {
        button.addEventListener("click", () => {
          const recordId = button.dataset.regionRecordId || "";
          state2.activeRegionRecordId = state2.activeRegionRecordId === recordId ? null : recordId;
          renderRegionQueryResults();
        });
      });
      renderRegionQueryDetail();
    }
    function renderRegionQueryDetail() {
      const record = state2.regionQueryRecords.find((entry) => entry.id === state2.activeRegionRecordId);
      if (!record) {
        elements2.regionQueryDetail.innerHTML = "";
        elements2.regionQueryDetail.classList.add("is-hidden");
        elements2.regionQueryBackdrop?.classList.add("is-hidden");
        document.body.classList.remove("query-detail-open");
        return;
      }
      const detailItems = [
        { label: "观测日期", value: formatDate(record.date) },
        { label: "观测地点", value: record.location },
        {
          label: "坐标",
          value: record.lat != null && record.lng != null ? `${record.lat.toFixed(4)}, ${record.lng.toFixed(4)}` : "未提供"
        },
        { label: "学名", value: record.sciName || "未提供" },
        { label: "物种代码", value: record.speciesCode || "未提供" },
        { label: "目", value: formatTaxonLabel("order", record.orderName) },
        { label: "科", value: formatTaxonLabel("family", record.familyName, record.familyCommonName) },
        { label: "属", value: formatTaxonLabel("genus", record.genusName) },
        { label: "备注", value: record.notes || "未提供" }
      ];
      elements2.regionQueryDetail.innerHTML = `
    <div class="query-detail-header">
      <div>
        <h3 class="query-detail-title">${escapeHtml(record.species)}</h3>
        <p class="query-detail-subtitle">详情固定显示在右侧，方便你连续点不同卡片快速对比。</p>
      </div>
      <button type="button" class="ghost query-detail-close">收起详情</button>
    </div>
    <div class="query-detail-grid">
      ${detailItems.map(
        (item) => `
            <div class="query-detail-item">
              <strong>${escapeHtml(item.label)}</strong>
              <span>${escapeHtml(item.value)}</span>
            </div>
          `
      ).join("")}
    </div>
  `;
      elements2.regionQueryDetail.classList.remove("is-hidden");
      elements2.regionQueryBackdrop?.classList.remove("is-hidden");
      document.body.classList.add("query-detail-open");
      elements2.regionQueryDetail.querySelector(".query-detail-close")?.addEventListener("click", closeRegionQueryDetail);
    }
    function closeRegionQueryDetail() {
      if (!state2.activeRegionRecordId) {
        return;
      }
      state2.activeRegionRecordId = null;
      renderRegionQueryResults();
    }
    async function syncEbirdRecords() {
      const apiKey = elements2.ebirdApiKey.value.trim();
      const regionCode = elements2.ebirdRegionCode.value.trim();
      const backDays = clampBackDays(elements2.ebirdBackDays.value);
      if (!apiKey) {
        setEbirdMessage("请先输入 eBird API 密钥。", true);
        elements2.ebirdApiKey.focus();
        return;
      }
      if (!regionCode) {
        setEbirdMessage("请先输入区域代码，例如 CN-31 或 L7884500。", true);
        elements2.ebirdRegionCode.focus();
        return;
      }
      elements2.ebirdBackDays.value = String(backDays);
      persistEbirdSettings();
      setEbirdLoading(true);
      setEbirdMessage("正在查询 eBird 区域最近观测...");
      try {
        const url = new URL(`https://api.ebird.org/v2/data/obs/${encodeURIComponent(regionCode)}/recent`);
        url.searchParams.set("back", String(backDays));
        url.searchParams.set("maxResults", "500");
        url.searchParams.set("sppLocale", EBIRD_SPECIES_LOCALE2);
        const response = await fetch(url, {
          headers: {
            "X-eBirdApiToken": apiKey
          }
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`eBird 返回 ${response.status}：${errorText || "请求失败"}`);
        }
        const payload = await response.json();
        let taxonomyMap = /* @__PURE__ */ new Map();
        try {
          taxonomyMap = await fetchEbirdTaxonomyMap(apiKey, payload.map((observation) => observation.speciesCode));
        } catch (taxonomyError) {
          console.warn("Failed to enrich taxonomy from eBird:", taxonomyError);
        }
        const imported = normalizeEbirdObservations(payload, taxonomyMap);
        state2.regionQueryRecords = imported;
        renderRegionQueryResults();
        if (!imported.length) {
          setEbirdMessage("eBird 已连接成功，但这个区域在所选天数内没有可显示的观测。");
          return;
        }
        setEbirdMessage(`eBird 区域查询完成：抓取 ${imported.length} 条结果。这些结果仅供查看，不会保存到个人记录。`);
      } catch (error) {
        state2.regionQueryRecords = [];
        renderRegionQueryResults();
        const extra = error instanceof TypeError ? " 这通常是浏览器跨域限制或网络拦截导致的；如果页面是纯静态部署，可能需要通过后端服务转发请求。" : "";
        setEbirdMessage(`查询失败：${error.message}${extra}`, true);
      } finally {
        setEbirdLoading(false);
      }
    }
    function hydrateEbirdInputs() {
      elements2.ebirdApiKey.value = safeLocalStorageGet(EBIRD_API_KEY_STORAGE2, "");
      elements2.ebirdRegionCode.value = safeLocalStorageGet(EBIRD_REGION_STORAGE2, "");
      elements2.ebirdBackDays.value = safeLocalStorageGet(EBIRD_BACK_STORAGE2, "14");
    }
    function persistEbirdSettings() {
      const backDays = clampBackDays(elements2.ebirdBackDays.value);
      elements2.ebirdBackDays.value = String(backDays);
      safeLocalStorageSet(EBIRD_API_KEY_STORAGE2, elements2.ebirdApiKey.value.trim());
      safeLocalStorageSet(EBIRD_REGION_STORAGE2, elements2.ebirdRegionCode.value.trim());
      safeLocalStorageSet(EBIRD_BACK_STORAGE2, String(backDays));
    }
    function clearEbirdApiKey() {
      elements2.ebirdApiKey.value = "";
      safeLocalStorageRemove(EBIRD_API_KEY_STORAGE2);
      setEbirdMessage("已清除本地保存的 eBird API 密钥。");
    }
    function getStoredEbirdApiKey() {
      return String(elements2.ebirdApiKey?.value || safeLocalStorageGet(EBIRD_API_KEY_STORAGE2, "")).trim();
    }
    function normalizeEbirdObservations(observations, taxonomyMap = /* @__PURE__ */ new Map()) {
      if (!Array.isArray(observations)) {
        return [];
      }
      return observations.map((observation, index) => {
        const taxonomy = taxonomyMap.get(observation.speciesCode) || {};
        return normalizeRecord({
          id: createEbirdObservationId(observation, index),
          date: normalizeDate(observation.obsDt),
          species: taxonomy.commonName || observation.comName || observation.sciName,
          location: String(observation.locName || observation.locId || "").trim(),
          lat: toNumber(observation.lat),
          lng: toNumber(observation.lng),
          notes: buildEbirdNotes(observation),
          speciesCode: observation.speciesCode,
          sciName: taxonomy.sciName || observation.sciName,
          taxonOrder: taxonomy.taxonOrder ?? null,
          orderName: taxonomy.orderName,
          familyName: taxonomy.familyName,
          familyCommonName: taxonomy.familyCommonName,
          genusName: taxonomy.genusName
        });
      }).filter((record) => record.date && record.species && record.location);
    }
    function createEbirdObservationId(observation, index) {
      const parts = [
        "ebird",
        observation.subId || "nosub",
        observation.speciesCode || "nospecies",
        normalizeDate(observation.obsDt) || "nodate",
        String(observation.locId || observation.locName || "").trim() || "nolocation",
        String(index)
      ];
      return parts.join("|");
    }
    function buildEbirdNotes(observation) {
      const parts = ["eBird 同步"];
      if (observation.howMany != null) {
        parts.push(`数量 ${observation.howMany}`);
      }
      if (observation.subId) {
        parts.push(`提交 ${observation.subId}`);
      }
      return parts.join(" · ");
    }
    async function fetchEbirdTaxonomyMap(apiKey, speciesCodes) {
      const uniqueCodes = [...new Set(speciesCodes.filter(Boolean))];
      const result = /* @__PURE__ */ new Map();
      if (!uniqueCodes.length) {
        return result;
      }
      const chunks = chunkArray(uniqueCodes, 80);
      await Promise.all(
        chunks.map(async (chunk) => {
          const url = new URL("https://api.ebird.org/v2/ref/taxonomy/ebird");
          url.searchParams.set("fmt", "json");
          url.searchParams.set("locale", EBIRD_SPECIES_LOCALE2);
          url.searchParams.set("species", chunk.join(","));
          const response = await fetch(url, {
            headers: {
              "X-eBirdApiToken": apiKey
            }
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`taxonomy 返回 ${response.status}：${errorText || "请求失败"}`);
          }
          const payload = await response.json();
          payload.forEach((item) => {
            result.set(item.speciesCode, {
              speciesCode: String(item.speciesCode || "").trim(),
              commonName: simplifyChineseText(item.comName || ""),
              sciName: String(item.sciName || "").trim(),
              taxonOrder: toTaxonOrder(item.taxonOrder),
              orderName: String(item.order || "").trim(),
              familyName: String(item.familySciName || item.family || "").trim(),
              familyCommonName: simplifyChineseText(item.familyComName || item.familyCommonName || ""),
              genusName: extractGenus(item.sciName)
            });
          });
        })
      );
      return result;
    }
    Object.assign(runtime2, {
      renderRegionQueryResults,
      renderRegionQueryDetail,
      closeRegionQueryDetail,
      syncEbirdRecords,
      hydrateEbirdInputs,
      persistEbirdSettings,
      clearEbirdApiKey,
      getStoredEbirdApiKey,
      normalizeEbirdObservations,
      createEbirdObservationId,
      buildEbirdNotes,
      fetchEbirdTaxonomyMap
    });
  }

  // src/script/features/ebird/seasonal.js
  function installEbirdSeasonal(runtime2) {
    const { EBIRD_SPECIES_LOCALE: EBIRD_SPECIES_LOCALE2, EBIRD_SEASONAL_CACHE_STORAGE: EBIRD_SEASONAL_CACHE_STORAGE2, EBIRD_SEASONAL_SETTINGS_STORAGE: EBIRD_SEASONAL_SETTINGS_STORAGE2, EBIRD_SEASONAL_REGION_CODE: EBIRD_SEASONAL_REGION_CODE2, EBIRD_SEASONAL_CACHE_TTL_MS: EBIRD_SEASONAL_CACHE_TTL_MS2, EBIRD_SEASONAL_CONCURRENCY: EBIRD_SEASONAL_CONCURRENCY2, state: state2, elements: elements2 } = runtime2;
    const clampEbirdSeasonalWindow = (...args) => runtime2.clampEbirdSeasonalWindow(...args);
    const clampEbirdSeasonalYears = (...args) => runtime2.clampEbirdSeasonalYears(...args);
    const escapeHtml = (...args) => runtime2.escapeHtml(...args);
    const fetchEbirdTaxonomyMap = (...args) => runtime2.fetchEbirdTaxonomyMap(...args);
    const formatDate = (...args) => runtime2.formatDate(...args);
    const formatIsoDate = (...args) => runtime2.formatIsoDate(...args);
    const normalizeDate = (...args) => runtime2.normalizeDate(...args);
    const normalizeDateInput = (...args) => runtime2.normalizeDateInput(...args);
    const renderEmptyState = (...args) => runtime2.renderEmptyState(...args);
    const safeLocalStorageGet = (...args) => runtime2.safeLocalStorageGet(...args);
    const safeLocalStorageRemove = (...args) => runtime2.safeLocalStorageRemove(...args);
    const safeLocalStorageSet = (...args) => runtime2.safeLocalStorageSet(...args);
    const setEbirdSeasonalLoading = (...args) => runtime2.setEbirdSeasonalLoading(...args);
    const setEbirdSeasonalMessage = (...args) => runtime2.setEbirdSeasonalMessage(...args);
    const simplifyChineseText = (...args) => runtime2.simplifyChineseText(...args);
    function hydrateEbirdSeasonalInputs() {
      let settings = {};
      try {
        settings = JSON.parse(safeLocalStorageGet(EBIRD_SEASONAL_SETTINGS_STORAGE2, "{}"));
      } catch (error) {
        settings = {};
      }
      if (elements2.ebirdSeasonalDate) {
        elements2.ebirdSeasonalDate.value = normalizeDateInput(settings.targetDate) || formatIsoDate(/* @__PURE__ */ new Date());
      }
      if (elements2.ebirdSeasonalYears) {
        elements2.ebirdSeasonalYears.value = String(clampEbirdSeasonalYears(settings.yearCount));
      }
      if (elements2.ebirdSeasonalWindow) {
        elements2.ebirdSeasonalWindow.value = String(clampEbirdSeasonalWindow(settings.windowDays));
      }
    }
    function persistEbirdSeasonalSettings() {
      const settings = getEbirdSeasonalSettings();
      safeLocalStorageSet(EBIRD_SEASONAL_SETTINGS_STORAGE2, JSON.stringify(settings));
    }
    function getEbirdSeasonalSettings() {
      const targetDate = normalizeDateInput(elements2.ebirdSeasonalDate?.value) || formatIsoDate(/* @__PURE__ */ new Date());
      const yearCount = clampEbirdSeasonalYears(elements2.ebirdSeasonalYears?.value);
      const windowDays = clampEbirdSeasonalWindow(elements2.ebirdSeasonalWindow?.value);
      if (elements2.ebirdSeasonalDate) {
        elements2.ebirdSeasonalDate.value = targetDate;
      }
      if (elements2.ebirdSeasonalYears) {
        elements2.ebirdSeasonalYears.value = String(yearCount);
      }
      if (elements2.ebirdSeasonalWindow) {
        elements2.ebirdSeasonalWindow.value = String(windowDays);
      }
      return {
        targetDate,
        yearCount,
        windowDays
      };
    }
    async function analyzeEbirdSeasonalPrediction() {
      const apiKey = elements2.ebirdApiKey.value.trim();
      if (!apiKey) {
        setEbirdSeasonalMessage("请先在上方输入 eBird API 密钥。", true);
        elements2.ebirdApiKey.focus();
        return;
      }
      const core = getEbirdSeasonalCore();
      if (!core) {
        setEbirdSeasonalMessage("eBird 季节分析模块未加载，请刷新页面后重试。", true);
        return;
      }
      const settings = getEbirdSeasonalSettings();
      persistEbirdSeasonalSettings();
      const requests = core.buildEbirdSeasonalDateRequests(settings.targetDate, settings.yearCount, settings.windowDays);
      if (!requests.length) {
        state2.ebirdSeasonalResults = [];
        state2.ebirdSeasonalMeta = null;
        renderEbirdSeasonalPrediction();
        setEbirdSeasonalMessage("这个目标日期在所选历史年份中没有可比日期，常见原因是 2 月 29 日且历史年份都不是闰年。", true);
        return;
      }
      setEbirdSeasonalLoading(true);
      setEbirdSeasonalMessage(`正在分析浙江 ${formatDate(settings.targetDate)} 前后 ${settings.windowDays} 天的多年历史记录...`);
      try {
        const dailyResult = await fetchEbirdSeasonalDailyEntries(apiKey, requests, (progress) => {
          setEbirdSeasonalMessage(
            `正在读取历史窗口：${progress.done}/${progress.total} 天，缓存 ${progress.cacheHits} 天，新拉取 ${progress.fetched} 天。`
          );
        });
        if (!dailyResult.dailyEntries.length) {
          state2.ebirdSeasonalResults = [];
          state2.ebirdSeasonalMeta = {
            ...settings,
            totalRequests: requests.length,
            successfulDays: 0,
            failedDays: dailyResult.failures.length,
            cacheHits: dailyResult.cacheHits,
            fetched: dailyResult.fetched,
            nonEmptyDays: dailyResult.nonEmptyDays,
            historicalObservationCount: dailyResult.historicalObservationCount,
            recentCount: 0,
            historicalYears: [...new Set(requests.map((entry) => entry.anchorYear))],
            generatedAt: (/* @__PURE__ */ new Date()).toISOString()
          };
          renderEbirdSeasonalPrediction();
          setEbirdSeasonalMessage("历史窗口没有成功读取到可分析数据，请稍后重试或检查网络。", true);
          return;
        }
        const recentObservations = await fetchEbirdRecentSeasonalObservations(apiKey);
        const speciesCodes = [
          .../* @__PURE__ */ new Set([
            ...dailyResult.dailyEntries.flatMap((entry) => entry.observations.map((observation) => observation.speciesCode).filter(Boolean)),
            ...recentObservations.map((observation) => observation.speciesCode).filter(Boolean)
          ])
        ];
        let taxonomyMap = /* @__PURE__ */ new Map();
        try {
          taxonomyMap = await fetchEbirdTaxonomyMap(apiKey, speciesCodes);
        } catch (taxonomyError) {
          console.warn("Failed to enrich seasonal taxonomy from eBird:", taxonomyError);
        }
        const successfulHistoricalYears = [...new Set(dailyResult.dailyEntries.map((entry) => entry.anchorYear))].sort((left, right) => left - right);
        const results = core.aggregateEbirdSeasonalPrediction({
          dailyEntries: dailyResult.dailyEntries,
          recentObservations,
          taxonomyMap,
          historicalYearCount: successfulHistoricalYears.length,
          totalHistoricalDays: dailyResult.dailyEntries.length
        });
        state2.ebirdSeasonalResults = results;
        state2.activeEbirdSeasonalSpeciesCode = "";
        state2.ebirdSeasonalMeta = {
          ...settings,
          totalRequests: requests.length,
          successfulDays: dailyResult.dailyEntries.length,
          failedDays: dailyResult.failures.length,
          cacheHits: dailyResult.cacheHits,
          fetched: dailyResult.fetched,
          nonEmptyDays: dailyResult.nonEmptyDays,
          historicalObservationCount: dailyResult.historicalObservationCount,
          recentCount: recentObservations.length,
          historicalYears: successfulHistoricalYears,
          generatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        renderEbirdSeasonalPrediction();
        const highCount = results.filter((entry) => entry.probabilityLevel === "高概率").length;
        setEbirdSeasonalMessage(
          `浙江当季分析完成：${results.length} 个候选鸟种，其中高概率 ${highCount} 种；历史读取成功 ${dailyResult.dailyEntries.length}/${requests.length} 天，其中 ${dailyResult.nonEmptyDays} 天有记录，共 ${dailyResult.historicalObservationCount} 条历史鸟种记录。`
        );
      } catch (error) {
        state2.ebirdSeasonalResults = [];
        state2.ebirdSeasonalMeta = null;
        renderEbirdSeasonalPrediction();
        const extra = error instanceof TypeError ? " 这通常是浏览器跨域限制或网络拦截导致的；如果页面是纯静态部署，可能需要通过后端服务转发请求。" : "";
        setEbirdSeasonalMessage(`浙江当季分析失败：${error.message}${extra}`, true);
      } finally {
        setEbirdSeasonalLoading(false);
      }
    }
    function renderEbirdSeasonalPrediction() {
      if (!elements2.ebirdSeasonalContainer || !elements2.ebirdSeasonalSummary) {
        return;
      }
      const results = state2.ebirdSeasonalResults || [];
      const meta = state2.ebirdSeasonalMeta;
      elements2.ebirdSeasonalContainer.innerHTML = "";
      elements2.ebirdSeasonalSummary.textContent = meta ? [
        `区域 ${EBIRD_SEASONAL_REGION_CODE2}`,
        `目标 ${formatDate(meta.targetDate)}`,
        `窗口 ±${meta.windowDays} 天`,
        `历史 ${formatSeasonalYearRange(meta.historicalYears)}`,
        `成功 ${meta.successfulDays}/${meta.totalRequests} 天`,
        `有记录 ${meta.nonEmptyDays || 0} 天`,
        `历史记录 ${meta.historicalObservationCount || 0} 条`,
        `近期记录 ${meta.recentCount} 条`
      ].join(" · ") : "尚未分析。结果会显示基于 eBird 历史提交记录推算出的当季候选鸟种。";
      if (!results.length) {
        renderEmptyState(elements2.ebirdSeasonalContainer, "ebird-seasonal");
        return;
      }
      const rows = results.map((entry, index) => {
        const isActive = entry.speciesCode === state2.activeEbirdSeasonalSpeciesCode;
        return `
        <div class="result-table-row seasonal-prediction-row${isActive ? " is-active" : ""}">
          <div class="result-table-cell result-table-index">${index + 1}</div>
          <div class="result-table-cell">
            <button type="button" class="result-table-name-btn" data-seasonal-species-code="${escapeHtml(entry.speciesCode)}" aria-expanded="${isActive ? "true" : "false"}">
              <strong>${escapeHtml(entry.commonName)}</strong>
              <span class="result-table-meta">${escapeHtml(entry.sciName || entry.speciesCode)}</span>
            </button>
          </div>
          <div class="result-table-cell result-table-status">
            <span class="seasonal-probability ${getSeasonalProbabilityClass(entry.probabilityLevel)}">${escapeHtml(entry.probabilityLevel)}</span>
            <small>${escapeHtml(entry.score.toFixed(2))}</small>
          </div>
          <div class="result-table-cell result-table-count">${escapeHtml(String(entry.yearsSeen))} 年</div>
          <div class="result-table-cell result-table-count">${escapeHtml(String(entry.hitDays))} 天</div>
          <div class="result-table-cell result-table-status">${entry.recentConfirmed ? "已确认" : "未确认"}</div>
          <div class="result-table-cell result-table-location">${escapeHtml(formatSeasonalRecentEvidence(entry))}</div>
        </div>
      `;
      }).join("");
      const activeEntry = results.find((entry) => entry.speciesCode === state2.activeEbirdSeasonalSpeciesCode);
      elements2.ebirdSeasonalContainer.innerHTML = `
    <div class="result-table seasonal-prediction-table" style="--table-columns: 56px minmax(180px, 1.3fr) 96px 90px 90px 96px minmax(180px, 1.2fr);">
      <div class="result-table-header">
        <div class="result-table-cell">排名</div>
        <div class="result-table-cell">鸟种</div>
        <div class="result-table-cell">概率</div>
        <div class="result-table-cell">命中年份</div>
        <div class="result-table-cell">命中天数</div>
        <div class="result-table-cell">近期</div>
        <div class="result-table-cell">近期证据</div>
      </div>
      <div class="result-table-body">
        ${rows}
      </div>
    </div>
    ${activeEntry ? renderEbirdSeasonalDetail(activeEntry) : ""}
  `;
      elements2.ebirdSeasonalContainer.querySelectorAll("[data-seasonal-species-code]").forEach((button) => {
        button.addEventListener("click", () => {
          const speciesCode = button.dataset.seasonalSpeciesCode || "";
          state2.activeEbirdSeasonalSpeciesCode = state2.activeEbirdSeasonalSpeciesCode === speciesCode ? "" : speciesCode;
          renderEbirdSeasonalPrediction();
        });
      });
    }
    function renderEbirdSeasonalDetail(entry) {
      const dates = entry.historicalDates.slice(0, 40).map((date) => formatDate(date)).join("、");
      const extraDates = entry.historicalDates.length > 40 ? ` 等 ${entry.historicalDates.length} 天` : "";
      return `
    <div class="seasonal-prediction-detail">
      <div class="seasonal-detail-card">
        <strong>历史年份</strong>
        <span>${escapeHtml(entry.historicalYears.join("、") || "暂无")}</span>
      </div>
      <div class="seasonal-detail-card">
        <strong>历史命中日期</strong>
        <span>${escapeHtml(dates || "暂无")}${escapeHtml(extraDates)}</span>
      </div>
      <div class="seasonal-detail-card">
        <strong>近期证据</strong>
        <span>${escapeHtml(formatSeasonalRecentEvidence(entry))}</span>
      </div>
      <div class="seasonal-detail-card">
        <strong>说明</strong>
        <span>这是基于 eBird 历史提交记录的出现可能性，不代表未列出的鸟种不会出现。</span>
      </div>
    </div>
  `;
    }
    function clearEbirdSeasonalCache() {
      safeLocalStorageRemove(EBIRD_SEASONAL_CACHE_STORAGE2);
      setEbirdSeasonalMessage("已清除浙江当季分析的历史缓存；下次分析会重新请求 eBird。");
    }
    async function fetchEbirdSeasonalDailyEntries(apiKey, requests, onProgress) {
      const cache = loadEbirdSeasonalCache();
      const entries = [];
      const failures = [];
      let cacheHits = 0;
      let fetched = 0;
      let done = 0;
      let nonEmptyDays = 0;
      let historicalObservationCount = 0;
      const tasks = requests.map((request) => async () => {
        const cached = getCachedEbirdSeasonalDay(cache, request.date);
        if (cached) {
          if (cached.length) {
            nonEmptyDays += 1;
            historicalObservationCount += cached.length;
          }
          cacheHits += 1;
          done += 1;
          onProgress?.({ done, total: requests.length, cacheHits, fetched });
          return {
            anchorYear: request.anchorYear,
            date: request.date,
            observations: cached
          };
        }
        try {
          const observations = await fetchEbirdHistoricSpeciesForDate(apiKey, request.date);
          if (observations.length) {
            setCachedEbirdSeasonalDay(cache, request.date, observations);
            nonEmptyDays += 1;
            historicalObservationCount += observations.length;
          }
          fetched += 1;
          done += 1;
          onProgress?.({ done, total: requests.length, cacheHits, fetched });
          return {
            anchorYear: request.anchorYear,
            date: request.date,
            observations
          };
        } catch (error) {
          failures.push({ ...request, error: error.message });
          done += 1;
          onProgress?.({ done, total: requests.length, cacheHits, fetched });
          return null;
        }
      });
      const results = await runLimitedConcurrency(tasks, EBIRD_SEASONAL_CONCURRENCY2);
      results.forEach((entry) => {
        if (entry) {
          entries.push(entry);
        }
      });
      saveEbirdSeasonalCache(cache);
      return {
        dailyEntries: entries,
        failures,
        cacheHits,
        fetched,
        nonEmptyDays,
        historicalObservationCount
      };
    }
    async function fetchEbirdHistoricSpeciesForDate(apiKey, date) {
      const { year, month, day } = parseIsoDateParts(date);
      const url = new URL(`https://api.ebird.org/v2/data/obs/${EBIRD_SEASONAL_REGION_CODE2}/historic/${year}/${month}/${day}`);
      url.searchParams.set("cat", "species");
      url.searchParams.set("sppLocale", EBIRD_SPECIES_LOCALE2);
      url.searchParams.set("maxResults", "500");
      const response = await fetch(url, {
        headers: {
          "X-eBirdApiToken": apiKey
        }
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`historic ${date} 返回 ${response.status}：${errorText || "请求失败"}`);
      }
      return normalizeEbirdSeasonalObservationList(await response.json());
    }
    async function fetchEbirdRecentSeasonalObservations(apiKey) {
      const url = new URL(`https://api.ebird.org/v2/data/obs/${EBIRD_SEASONAL_REGION_CODE2}/recent`);
      url.searchParams.set("back", "30");
      url.searchParams.set("cat", "species");
      url.searchParams.set("sppLocale", EBIRD_SPECIES_LOCALE2);
      url.searchParams.set("maxResults", "500");
      const response = await fetch(url, {
        headers: {
          "X-eBirdApiToken": apiKey
        }
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`recent 返回 ${response.status}：${errorText || "请求失败"}`);
      }
      return normalizeEbirdSeasonalObservationList(await response.json());
    }
    function normalizeEbirdSeasonalObservationList(payload) {
      const unique = /* @__PURE__ */ new Map();
      (Array.isArray(payload) ? payload : []).forEach((item) => {
        const speciesCode = String(item?.speciesCode || "").trim();
        if (!speciesCode) {
          return;
        }
        const existing = unique.get(speciesCode);
        if (existing && String(existing.obsDt || "") >= String(item?.obsDt || "")) {
          return;
        }
        unique.set(speciesCode, {
          speciesCode,
          comName: simplifyChineseText(item?.comName || ""),
          sciName: String(item?.sciName || "").trim(),
          obsDt: String(item?.obsDt || "").trim(),
          locName: String(item?.locName || item?.locId || "").trim()
        });
      });
      return [...unique.values()];
    }
    function loadEbirdSeasonalCache() {
      try {
        const parsed = JSON.parse(safeLocalStorageGet(EBIRD_SEASONAL_CACHE_STORAGE2, "{}"));
        return {
          version: 1,
          days: parsed?.days && typeof parsed.days === "object" ? parsed.days : {}
        };
      } catch (error) {
        console.warn("Failed to load eBird seasonal cache:", error);
        return { version: 1, days: {} };
      }
    }
    function saveEbirdSeasonalCache(cache) {
      safeLocalStorageSet(
        EBIRD_SEASONAL_CACHE_STORAGE2,
        JSON.stringify({
          version: 1,
          days: cache.days || {}
        })
      );
    }
    function getCachedEbirdSeasonalDay(cache, date) {
      const key = getEbirdSeasonalCacheKey(date);
      const cached = cache.days?.[key];
      if (!cached || !Array.isArray(cached.observations)) {
        return null;
      }
      if (!cached.observations.length) {
        delete cache.days[key];
        return null;
      }
      const savedAt = Date.parse(cached.savedAt || "");
      if (!Number.isFinite(savedAt) || Date.now() - savedAt > EBIRD_SEASONAL_CACHE_TTL_MS2) {
        delete cache.days[key];
        return null;
      }
      return cached.observations;
    }
    function setCachedEbirdSeasonalDay(cache, date, observations) {
      cache.days[getEbirdSeasonalCacheKey(date)] = {
        savedAt: (/* @__PURE__ */ new Date()).toISOString(),
        observations
      };
    }
    function getEbirdSeasonalCacheKey(date) {
      return `${EBIRD_SEASONAL_REGION_CODE2}|${date}`;
    }
    async function runLimitedConcurrency(tasks, limit) {
      const results = new Array(tasks.length);
      let nextIndex = 0;
      async function worker() {
        while (nextIndex < tasks.length) {
          const currentIndex = nextIndex;
          nextIndex += 1;
          results[currentIndex] = await tasks[currentIndex]();
        }
      }
      const workerCount = Math.min(Math.max(1, limit), tasks.length);
      await Promise.all(Array.from({ length: workerCount }, worker));
      return results;
    }
    function parseIsoDateParts(date) {
      const normalized = normalizeDateInput(date);
      if (!normalized) {
        throw new Error(`日期格式无效：${date}`);
      }
      const [year, month, day] = normalized.split("-").map(Number);
      return { year, month, day };
    }
    function getEbirdSeasonalCore() {
      return window.EBIRD_SEASONAL_CORE || null;
    }
    function formatSeasonalYearRange(years = []) {
      if (!years.length) {
        return "无";
      }
      if (years.length === 1) {
        return String(years[0]);
      }
      return `${years[0]}-${years[years.length - 1]}`;
    }
    function formatSeasonalRecentEvidence(entry) {
      if (!entry.recentConfirmed) {
        return "最近 30 天未确认";
      }
      const date = normalizeDate(entry.recentDate);
      const dateLabel = date ? formatDate(date) : "日期未知";
      return [dateLabel, entry.recentLocation].filter(Boolean).join(" · ");
    }
    function getSeasonalProbabilityClass(level) {
      if (level === "高概率") {
        return "is-high";
      }
      if (level === "中概率") {
        return "is-medium";
      }
      return "is-low";
    }
    Object.assign(runtime2, {
      hydrateEbirdSeasonalInputs,
      persistEbirdSeasonalSettings,
      getEbirdSeasonalSettings,
      analyzeEbirdSeasonalPrediction,
      renderEbirdSeasonalPrediction,
      renderEbirdSeasonalDetail,
      clearEbirdSeasonalCache,
      fetchEbirdSeasonalDailyEntries,
      fetchEbirdHistoricSpeciesForDate,
      fetchEbirdRecentSeasonalObservations,
      normalizeEbirdSeasonalObservationList,
      loadEbirdSeasonalCache,
      saveEbirdSeasonalCache,
      getCachedEbirdSeasonalDay,
      setCachedEbirdSeasonalDay,
      getEbirdSeasonalCacheKey,
      runLimitedConcurrency,
      parseIsoDateParts,
      getEbirdSeasonalCore,
      formatSeasonalYearRange,
      formatSeasonalRecentEvidence,
      getSeasonalProbabilityClass
    });
  }

  // src/script/features/birdreport/domain.js
  function installBirdreportDomain(runtime2) {
    const { BIRDREPORT_ZHEJIANG_SPECIES_DATA_URL: BIRDREPORT_ZHEJIANG_SPECIES_DATA_URL2, BIRDREPORT_ZHEJIANG_SPECIES_GLOBAL: BIRDREPORT_ZHEJIANG_SPECIES_GLOBAL2, BIRDREPORT_CORE: BIRDREPORT_CORE2, BIRDREPORT_RARE_SPECIES_THRESHOLD: BIRDREPORT_RARE_SPECIES_THRESHOLD2, state: state2 } = runtime2;
    function createBirdreportPayload({
      startTime = "",
      endTime = "",
      province = "",
      city = "",
      district = "",
      pointname = "",
      username = "",
      state: state3 = "",
      mode = 0
    } = {}) {
      return BIRDREPORT_CORE2.createBirdreportPayload({
        startTime,
        endTime,
        province,
        city,
        district,
        pointname,
        username,
        state: state3,
        mode
      });
    }
    function getBirdreportTaxonKey(item) {
      return BIRDREPORT_CORE2.getBirdreportTaxonKey(item);
    }
    function getBirdreportRarityFields(item) {
      const hasExplicitRarity = typeof item?.isRare === "boolean";
      const isRare = hasExplicitRarity ? item.isRare : (Number(item?.recordcount) || 0) <= BIRDREPORT_RARE_SPECIES_THRESHOLD2;
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
      return BIRDREPORT_CORE2.getBirdreportItems(payload);
    }
    function normalizeBirdreportTaxa(payload) {
      return getBirdreportTaxaArray(payload).map(serializeBirdreportTaxon).filter((item) => item.key);
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
      const embedded = window[BIRDREPORT_ZHEJIANG_SPECIES_GLOBAL2];
      if (embedded?.species?.length) {
        return embedded;
      }
      const response = await fetch(BIRDREPORT_ZHEJIANG_SPECIES_DATA_URL2, { cache: "no-store" });
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
      return BIRDREPORT_CORE2.sortBirdreportRecordsByObservationTimeDesc(left, right);
    }
    function sortBirdreportRecordsBySerialIdDesc(left, right) {
      return BIRDREPORT_CORE2.sortBirdreportRecordsBySerialIdDesc(left, right);
    }
    function getBirdreportReportCount(item) {
      const explicitReportCount = Number(item?.reportcount ?? item?.reportCount ?? item?.report_count);
      if (Number.isFinite(explicitReportCount) && explicitReportCount > 0) {
        return explicitReportCount;
      }
      return Number(item?.recordcount) || 0;
    }
    function dedupeBirdreportTaxa(items) {
      return BIRDREPORT_CORE2.dedupeBirdreportTaxa(items);
    }
    function sortBirdreportTaxaByRecordCount(items) {
      return BIRDREPORT_CORE2.sortBirdreportTaxaByRecordCount(items);
    }
    function sortBirdreportTaxaByRecordCountDesc(items) {
      return BIRDREPORT_CORE2.sortBirdreportTaxaByRecordCountDesc(items);
    }
    Object.assign(runtime2, {
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

  // src/script/features/birdreport/client.js
  function installBirdreportClient(runtime2) {
    const { BIRD_PREP_MACAULAY_MAX_IMAGE_BYTES: BIRD_PREP_MACAULAY_MAX_IMAGE_BYTES2, BIRD_PREP_MACAULAY_FETCH_TIMEOUT_MS: BIRD_PREP_MACAULAY_FETCH_TIMEOUT_MS2, BIRD_PREP_MACAULAY_FETCH_ATTEMPTS: BIRD_PREP_MACAULAY_FETCH_ATTEMPTS2, BIRDREPORT_CORE: BIRDREPORT_CORE2, BIRDREPORT_PARAM_PUBLIC_KEY: BIRDREPORT_PARAM_PUBLIC_KEY2, BIRDREPORT_AES_KEY_SOURCE: BIRDREPORT_AES_KEY_SOURCE2, BIRDREPORT_AES_IV_SOURCE: BIRDREPORT_AES_IV_SOURCE2, BIRDREPORT_RARE_SPECIES_PROVINCE: BIRDREPORT_RARE_SPECIES_PROVINCE2, state: state2, elements: elements2 } = runtime2;
    const createBirdreportPayload = (...args) => runtime2.createBirdreportPayload(...args);
    const dedupeBirdreportTaxa = (...args) => runtime2.dedupeBirdreportTaxa(...args);
    const fetchWithTimeoutAndRetry = (...args) => runtime2.fetchWithTimeoutAndRetry(...args);
    const formatBirdreportDateTime = (...args) => runtime2.formatBirdreportDateTime(...args);
    const getBirdreportProxyBaseUrl = (...args) => runtime2.getBirdreportProxyBaseUrl(...args);
    const getDefaultBirdreportProxyUrl = (...args) => runtime2.getDefaultBirdreportProxyUrl(...args);
    const loadBirdreportProvinces = (...args) => runtime2.loadBirdreportProvinces(...args);
    const readImageDimensions = (...args) => runtime2.readImageDimensions(...args);
    const setBirdPrepMessage = (...args) => runtime2.setBirdPrepMessage(...args);
    const setBirdreportMessage = (...args) => runtime2.setBirdreportMessage(...args);
    const sortBirdreportRecordsByObservationTimeDesc = (...args) => runtime2.sortBirdreportRecordsByObservationTimeDesc(...args);
    async function initBirdreportProxy() {
      if (!canUseBirdreportProxy()) {
        if (elements2.queryBirdreportProxyBtn) {
          elements2.queryBirdreportProxyBtn.disabled = true;
        }
        if (elements2.queryBirdPrepSpeciesBtn) {
          elements2.queryBirdPrepSpeciesBtn.disabled = true;
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
        province: BIRDREPORT_RARE_SPECIES_PROVINCE2,
        startTime: windowRange.startTime,
        endTime: windowRange.endTime,
        state: ""
      });
      const reportPayload = {
        ...basePayload,
        ...taxonId ? { taxonid: taxonId } : {},
        ...taxonName ? {
          taxonname: taxonName,
          taxon_name: taxonName,
          name: taxonName
        } : {}
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
      return BIRDREPORT_CORE2.createBirdreportRecordSearchPayload(basePayload, { taxonId, taxonName });
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
        }
        throw new Error(message);
      }
      const contentType = String(response.headers.get("content-type") || "").split(";")[0].toLowerCase();
      if (!["image/jpeg", "image/png"].includes(contentType)) {
        throw new Error(`Macaulay Library 返回了不支持的图片类型：${contentType || "unknown"}`);
      }
      const blob = await response.blob();
      if (!blob.size || blob.size > BIRD_PREP_MACAULAY_MAX_IMAGE_BYTES2) {
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
          attempts: BIRD_PREP_MACAULAY_FETCH_ATTEMPTS2,
          timeoutMs: BIRD_PREP_MACAULAY_FETCH_TIMEOUT_MS2
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
        province: BIRDREPORT_RARE_SPECIES_PROVINCE2,
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
      return BIRDREPORT_CORE2.normalizeBirdreportTaxonPage(response, { decodePayload: decodeBirdreportPayload });
    }
    function normalizeBirdreportRecordPage(response) {
      return BIRDREPORT_CORE2.normalizeBirdreportRecordPage(response, { decodePayload: decodeBirdreportPayload }).map((record) => ({
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
        const rawMessage = payload?.error || payload?.msg || (typeof payload === "string" ? payload : "") || `HTTP ${response.status}`;
        const message = String(rawMessage).trim() === "Unknown endpoint" ? `BirdReport 后台还没有 ${path}，请重启后台以加载最新接口` : rawMessage;
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
      encrypt.setPublicKey(BIRDREPORT_PARAM_PUBLIC_KEY2);
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
      return BIRDREPORT_CORE2.serializeBirdreportRequestData(data);
    }
    function parseBirdreportRequestData(serializedData) {
      return BIRDREPORT_CORE2.parseBirdreportRequestData(serializedData);
    }
    function sortBirdreportObjectKeys(source) {
      return BIRDREPORT_CORE2.sortBirdreportObjectKeys(source);
    }
    function generateBirdreportRequestId() {
      const hexDigits = "0123456789abcdef";
      const output = [];
      for (let index = 0; index < 32; index += 1) {
        output[index] = hexDigits[Math.floor(Math.random() * 16)];
      }
      output[14] = "4";
      output[19] = hexDigits[Number.parseInt(output[19], 16) & 3 | 8];
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
            errors.length ? "BirdReport 返回数据解码失败，请刷新页面后重试。" : "BirdReport 解码依赖未加载，请刷新页面后重试。"
          );
        }
      }
      return payload;
    }
    function decodeBirdreportPayloadWithCryptoJs(payload) {
      if (!window.CryptoJS?.AES || !window.CryptoJS?.enc) {
        throw new Error("BirdReport 解码依赖未加载，暂时不能读取返回结果。");
      }
      const keySource = decodeBirdreportDecimalPairs(BIRDREPORT_AES_KEY_SOURCE2);
      const ivSource = decodeBirdreportDecimalPairs(BIRDREPORT_AES_IV_SOURCE2);
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
    Object.assign(runtime2, {
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

  // src/script/features/birdreport/regions.js
  function installBirdreportRegions(runtime2) {
    const { elements: elements2 } = runtime2;
    const birdreportProxyPost = (...args) => runtime2.birdreportProxyPost(...args);
    const canUseBirdreportProxy = (...args) => runtime2.canUseBirdreportProxy(...args);
    const clearBirdPrepSpeciesResults = (...args) => runtime2.clearBirdPrepSpeciesResults(...args);
    const clearBirdreportSpeciesResults = (...args) => runtime2.clearBirdreportSpeciesResults(...args);
    const setBirdPrepMessage = (...args) => runtime2.setBirdPrepMessage(...args);
    const setBirdreportMessage = (...args) => runtime2.setBirdreportMessage(...args);
    async function handleBirdreportProvinceChange() {
      resetSelectOptions(elements2.birdreportCity, "请选择市");
      resetSelectOptions(elements2.birdreportDistrict, "请选择区");
      clearBirdreportSpeciesResults();
      const province = elements2.birdreportProvince.value;
      if (!province) {
        return;
      }
      try {
        const selectedOption = elements2.birdreportProvince.selectedOptions[0];
        const provinceCode = selectedOption?.dataset.code || "";
        const response = await birdreportProxyPost("/api/birdreport/city", { province_code: provinceCode });
        renderBirdreportRegionOptions(elements2.birdreportCity, response.data || [], "city_name", "city_code", "请选择市");
      } catch (error) {
        setBirdreportMessage(`加载城市失败：${error.message}`, true);
      }
    }
    async function handleBirdreportCityChange() {
      resetSelectOptions(elements2.birdreportDistrict, "请选择区");
      clearBirdreportSpeciesResults();
      const city = elements2.birdreportCity.value;
      if (!city) {
        return;
      }
      try {
        const selectedOption = elements2.birdreportCity.selectedOptions[0];
        const cityCode = selectedOption?.dataset.code || "";
        const response = await birdreportProxyPost("/api/birdreport/district", { city_code: cityCode });
        renderBirdreportRegionOptions(elements2.birdreportDistrict, response.data || [], "district_name", null, "请选择区");
      } catch (error) {
        setBirdreportMessage(`加载区县失败：${error.message}`, true);
      }
    }
    async function loadBirdreportProvinces() {
      resetSelectOptions(elements2.birdreportProvince, "省份加载中...");
      resetSelectOptions(elements2.birdreportCity, "请选择市");
      resetSelectOptions(elements2.birdreportDistrict, "请选择区");
      resetSelectOptions(elements2.birdPrepProvince, "省份加载中...");
      resetSelectOptions(elements2.birdPrepCity, "请选择市");
      resetSelectOptions(elements2.birdPrepDistrict, "请选择区");
      const response = await birdreportProxyPost("/api/birdreport/province");
      renderBirdreportRegionOptions(elements2.birdreportProvince, response.data || [], "province_name", "province_code", "请选择省");
      renderBirdreportRegionOptions(elements2.birdPrepProvince, response.data || [], "province_name", "province_code", "请选择省");
      setBirdreportMessage("BirdReport 已连接，可以开始查询。");
      setBirdPrepMessage("BirdReport 已连接，可以查询地区鸟种。");
    }
    async function handleBirdPrepProvinceChange() {
      resetSelectOptions(elements2.birdPrepCity, "请选择市");
      resetSelectOptions(elements2.birdPrepDistrict, "请选择区");
      clearBirdPrepSpeciesResults();
      const province = elements2.birdPrepProvince.value;
      if (!province) {
        return;
      }
      if (!canUseBirdreportProxy(setBirdPrepMessage)) {
        return;
      }
      try {
        const selectedOption = elements2.birdPrepProvince.selectedOptions[0];
        const provinceCode = selectedOption?.dataset.code || "";
        const response = await birdreportProxyPost("/api/birdreport/city", { province_code: provinceCode });
        renderBirdreportRegionOptions(elements2.birdPrepCity, response.data || [], "city_name", "city_code", "请选择市");
        setBirdPrepMessage(`已加载 ${province} 的城市列表。`);
      } catch (error) {
        setBirdPrepMessage(`加载城市失败：${error.message}`, true);
      }
    }
    async function handleBirdPrepCityChange() {
      resetSelectOptions(elements2.birdPrepDistrict, "请选择区");
      clearBirdPrepSpeciesResults();
      const city = elements2.birdPrepCity.value;
      if (!city) {
        return;
      }
      if (!canUseBirdreportProxy(setBirdPrepMessage)) {
        return;
      }
      try {
        const selectedOption = elements2.birdPrepCity.selectedOptions[0];
        const cityCode = selectedOption?.dataset.code || "";
        const response = await birdreportProxyPost("/api/birdreport/district", { city_code: cityCode });
        renderBirdreportRegionOptions(elements2.birdPrepDistrict, response.data || [], "district_name", null, "请选择区");
        setBirdPrepMessage(`已加载 ${city} 的区县列表。`);
      } catch (error) {
        setBirdPrepMessage(`加载区县失败：${error.message}`, true);
      }
    }
    function renderBirdreportRegionOptions(target, items, labelKey, codeKey, placeholder) {
      if (!target) {
        return;
      }
      resetSelectOptions(target, placeholder);
      items.forEach((item) => {
        const option = document.createElement("option");
        option.value = String(item[labelKey] || "").trim();
        option.textContent = option.value;
        if (codeKey) {
          option.dataset.code = String(item[codeKey] || "").trim();
        }
        target.append(option);
      });
    }
    function resetSelectOptions(target, placeholder) {
      if (!target) {
        return;
      }
      target.innerHTML = "";
      const option = document.createElement("option");
      option.value = "";
      option.textContent = placeholder;
      target.append(option);
    }
    Object.assign(runtime2, {
      handleBirdreportProvinceChange,
      handleBirdreportCityChange,
      loadBirdreportProvinces,
      handleBirdPrepProvinceChange,
      handleBirdPrepCityChange,
      renderBirdreportRegionOptions,
      resetSelectOptions
    });
  }

  // src/script/features/birdreport/query.js
  function installBirdreportQuery(runtime2) {
    const { BIRDREPORT_SEARCH_PAGE_URL: BIRDREPORT_SEARCH_PAGE_URL2, BIRDREPORT_TAXON_PAGE_URL: BIRDREPORT_TAXON_PAGE_URL2, BIRDREPORT_CORE: BIRDREPORT_CORE2, state: state2, elements: elements2 } = runtime2;
    const canUseBirdreportProxy = (...args) => runtime2.canUseBirdreportProxy(...args);
    const createBirdreportPayload = (...args) => runtime2.createBirdreportPayload(...args);
    const encodeBase64Utf8 = (...args) => runtime2.encodeBase64Utf8(...args);
    const escapeHtml = (...args) => runtime2.escapeHtml(...args);
    const fetchAllBirdreportTaxa = (...args) => runtime2.fetchAllBirdreportTaxa(...args);
    const fetchBirdreportRecordsForCurrentQuery = (...args) => runtime2.fetchBirdreportRecordsForCurrentQuery(...args);
    const getBirdreportTaxonKey = (...args) => runtime2.getBirdreportTaxonKey(...args);
    const isBirdreportCaptchaError = (...args) => runtime2.isBirdreportCaptchaError(...args);
    const loadBirdreportCaptchaImage = (...args) => runtime2.loadBirdreportCaptchaImage(...args);
    const normalizeDateInput = (...args) => runtime2.normalizeDateInput(...args);
    const renderEmptyState = (...args) => runtime2.renderEmptyState(...args);
    const setBirdreportMessage = (...args) => runtime2.setBirdreportMessage(...args);
    const setElementLoadingClass = (...args) => runtime2.setElementLoadingClass(...args);
    const sortBirdreportTaxaByRecordCount = (...args) => runtime2.sortBirdreportTaxaByRecordCount(...args);
    const verifyBirdreportCaptcha = (...args) => runtime2.verifyBirdreportCaptcha(...args);
    async function queryBirdreportSpeciesByProxy() {
      const payload = buildBirdreportQueryPayload();
      if (!payload) {
        return;
      }
      if (!canUseBirdreportProxy()) {
        return;
      }
      setBirdreportLoading(true);
      setBirdreportMessage("正在查询 BirdReport 鸟种...");
      clearBirdreportSpeciesDetail();
      renderBirdreportSpeciesDetail();
      try {
        const results = await fetchAllBirdreportTaxa(payload, {
          onProgress: (message) => setBirdreportMessage(message)
        });
        state2.birdreportLastQueryPayload = { ...payload };
        renderBirdreportSpeciesResults(results);
        const queryText = formatBirdreportQuerySummary(payload);
        setBirdreportMessage(`BirdReport 查询完成：${queryText} 共 ${results.length} 个鸟种。`);
      } catch (error) {
        clearBirdreportSpeciesResults();
        setBirdreportMessage(`BirdReport 查询失败：${error.message}`, true);
      } finally {
        setBirdreportLoading(false);
      }
    }
    function renderBirdreportSpeciesDetail() {
      const detailTarget = elements2.birdreportSpeciesDetail;
      if (!detailTarget) {
        return;
      }
      const species = state2.birdreportSpeciesDetailSpecies;
      if (!state2.activeBirdreportSpeciesKey || !species) {
        detailTarget.innerHTML = "";
        detailTarget.classList.add("is-hidden");
        elements2.birdreportSpeciesDetailBackdrop?.classList.add("is-hidden");
        document.body.classList.remove("birdreport-species-detail-open");
        return;
      }
      let content = "";
      if (state2.birdreportSpeciesDetailLoading) {
        content = '<div class="empty-state">正在加载当前筛选条件下的公开地点...</div>';
      } else if (state2.birdreportSpeciesDetailError === "captcha_required") {
        content = `
      <div class="birdreport-captcha-panel">
        <strong>BirdReport 需要验证码</strong>
        <span>输入图片里的验证码后，会自动继续加载这个鸟种的公开地点。</span>
        <div class="birdreport-captcha-row">
          ${state2.birdreportSpeciesCaptchaImageUrl ? `<img class="birdreport-captcha-image" src="${escapeHtml(state2.birdreportSpeciesCaptchaImageUrl)}" alt="BirdReport 验证码" />` : '<span class="empty-state">验证码加载中...</span>'}
          <button type="button" class="ghost birdreport-species-refresh-captcha-btn">换一张</button>
        </div>
        <div class="birdreport-captcha-row">
          <input class="birdreport-captcha-input birdreport-species-captcha-input" type="text" inputmode="text" maxlength="4" autocomplete="off" placeholder="输入验证码" />
          <button type="button" class="birdreport-species-submit-captcha-btn">${state2.birdreportSpeciesCaptchaLoading ? "验证中..." : "验证并重试"}</button>
        </div>
        ${state2.birdreportSpeciesCaptchaError ? `<div class="message error">${escapeHtml(state2.birdreportSpeciesCaptchaError)}</div>` : ""}
      </div>
    `;
      } else if (state2.birdreportSpeciesDetailError) {
        content = `<div class="empty-state">加载失败：${escapeHtml(state2.birdreportSpeciesDetailError)}</div>`;
      } else if (!state2.birdreportSpeciesDetailRecords.length) {
        content = '<div class="empty-state">当前筛选条件下没有可展示的公开地点。</div>';
      } else {
        content = `
      <div class="birdreport-rare-detail-list">
        ${state2.birdreportSpeciesDetailRecords.map(
          (record) => `
              <div class="birdreport-rare-detail-item">
                <strong>${escapeHtml(record.pointName || "未提供观测地点")}</strong>
                <div class="birdreport-rare-detail-meta">
                  <span>观测时间：${escapeHtml(record.startTimeLabel)} 至 ${escapeHtml(record.endTimeLabel)}</span>
                  <span>记录数量：${escapeHtml(String(record.taxonCount ?? 0))}</span>
                  <span>记录用户：${escapeHtml(record.username || "未提供")}</span>
                  <span>报告编号：${escapeHtml(record.serialId || "未提供")}</span>
                </div>
              </div>
            `
        ).join("")}
      </div>
    `;
      }
      detailTarget.innerHTML = `
    <div class="birdreport-rare-detail-header">
      <div>
        <h3 class="birdreport-rare-detail-title">${escapeHtml(species.taxonname || species.name || "未命名鸟种")} 的公开地点</h3>
        <p class="birdreport-rare-detail-subtitle">${escapeHtml(formatBirdreportQuerySummary(state2.birdreportLastQueryPayload || {}))} · 点击表格中的其他鸟种可快速切换</p>
      </div>
      <button type="button" class="ghost" id="closeBirdreportSpeciesDetailBtn">收起详情</button>
    </div>
    ${content}
  `;
      detailTarget.classList.remove("is-hidden");
      elements2.birdreportSpeciesDetailBackdrop?.classList.remove("is-hidden");
      document.body.classList.add("birdreport-species-detail-open");
      detailTarget.querySelector("#closeBirdreportSpeciesDetailBtn")?.addEventListener("click", closeBirdreportSpeciesDetail);
      const submit = detailTarget.querySelector(".birdreport-species-submit-captcha-btn");
      const input = detailTarget.querySelector(".birdreport-species-captcha-input");
      const refresh = detailTarget.querySelector(".birdreport-species-refresh-captcha-btn");
      if (submit) {
        submit.disabled = state2.birdreportSpeciesCaptchaLoading;
        submit.addEventListener("click", () => submitBirdreportSpeciesCaptcha(species, input?.value));
      }
      input?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          submitBirdreportSpeciesCaptcha(species, input.value);
        }
      });
      refresh?.addEventListener("click", () => refreshBirdreportSpeciesCaptcha());
    }
    async function toggleBirdreportSpeciesDetail(species) {
      const key = getBirdreportTaxonKey(species);
      if (!key) {
        setBirdreportMessage("这个鸟种缺少可用编号，暂时不能查询地点。", true);
        return;
      }
      if (!state2.birdreportLastQueryPayload) {
        setBirdreportMessage("请先重新执行一次 BirdReport 查询，再查看地点。", true);
        return;
      }
      if (state2.activeBirdreportSpeciesKey === key && !state2.birdreportSpeciesDetailLoading) {
        closeBirdreportSpeciesDetail();
        return;
      }
      state2.activeBirdreportSpeciesKey = key;
      state2.birdreportSpeciesDetailSpecies = species;
      state2.birdreportSpeciesDetailRecords = [];
      state2.birdreportSpeciesDetailError = "";
      state2.birdreportSpeciesDetailLoading = true;
      renderBirdreportSpeciesResults(state2.birdreportLastResults);
      setBirdreportMessage(`正在加载 ${species.taxonname || species.name || "该鸟种"} 在当前筛选条件下的公开地点...`);
      try {
        state2.birdreportSpeciesDetailRecords = await fetchBirdreportRecordsForCurrentQuery(species, state2.birdreportLastQueryPayload, {
          limit: 10,
          onProgress: (message) => setBirdreportMessage(message)
        });
        state2.birdreportSpeciesDetailError = "";
        setBirdreportMessage(
          state2.birdreportSpeciesDetailRecords.length ? `${species.taxonname || species.name || "该鸟种"} 的公开地点已加载 ${state2.birdreportSpeciesDetailRecords.length} 条。` : `${species.taxonname || species.name || "该鸟种"} 在当前筛选条件下没有可展示的公开地点。`
        );
      } catch (error) {
        if (isBirdreportCaptchaError(error)) {
          state2.birdreportSpeciesDetailError = "captcha_required";
          state2.birdreportSpeciesCaptchaError = "";
          await refreshBirdreportSpeciesCaptcha({ silent: true });
          setBirdreportMessage("BirdReport 要求输入验证码，验证后会自动重试地点查询。", true);
        } else {
          state2.birdreportSpeciesDetailError = error.message;
          setBirdreportMessage(`加载公开地点失败：${error.message}`, true);
        }
      } finally {
        state2.birdreportSpeciesDetailLoading = false;
        renderBirdreportSpeciesResults(state2.birdreportLastResults);
      }
    }
    async function submitBirdreportSpeciesCaptcha(species, rawCode) {
      const code = String(rawCode || "").trim();
      if (!code) {
        state2.birdreportSpeciesCaptchaError = "请先输入验证码。";
        renderBirdreportSpeciesDetail();
        return;
      }
      state2.birdreportSpeciesCaptchaLoading = true;
      state2.birdreportSpeciesCaptchaError = "";
      renderBirdreportSpeciesDetail();
      try {
        await verifyBirdreportCaptcha(code);
        state2.birdreportSpeciesCaptchaLoading = false;
        state2.birdreportSpeciesCaptchaError = "";
        state2.birdreportSpeciesDetailError = "";
        state2.birdreportSpeciesDetailLoading = true;
        state2.birdreportSpeciesDetailRecords = [];
        renderBirdreportSpeciesResults(state2.birdreportLastResults);
        setBirdreportMessage("验证码通过，正在重新加载公开地点...");
        state2.birdreportSpeciesDetailRecords = await fetchBirdreportRecordsForCurrentQuery(species, state2.birdreportLastQueryPayload, {
          limit: 10,
          onProgress: (message) => setBirdreportMessage(message)
        });
        state2.birdreportSpeciesDetailError = "";
        setBirdreportMessage(
          state2.birdreportSpeciesDetailRecords.length ? `${species.taxonname || species.name || "该鸟种"} 的公开地点已加载 ${state2.birdreportSpeciesDetailRecords.length} 条。` : `${species.taxonname || species.name || "该鸟种"} 在当前筛选条件下没有可展示的公开地点。`
        );
      } catch (error) {
        state2.birdreportSpeciesCaptchaLoading = false;
        state2.birdreportSpeciesDetailLoading = false;
        state2.birdreportSpeciesDetailError = "captcha_required";
        state2.birdreportSpeciesCaptchaError = error.message;
        await refreshBirdreportSpeciesCaptcha({ silent: true });
        setBirdreportMessage(`验证码验证失败：${error.message}`, true);
      } finally {
        state2.birdreportSpeciesCaptchaLoading = false;
        state2.birdreportSpeciesDetailLoading = false;
        renderBirdreportSpeciesResults(state2.birdreportLastResults);
      }
    }
    async function refreshBirdreportSpeciesCaptcha(options = {}) {
      const { silent = false } = options;
      try {
        const imageUrl = await loadBirdreportCaptchaImage();
        if (state2.birdreportSpeciesCaptchaImageUrl) {
          URL.revokeObjectURL(state2.birdreportSpeciesCaptchaImageUrl);
        }
        state2.birdreportSpeciesCaptchaImageUrl = imageUrl;
        if (!silent) {
          state2.birdreportSpeciesCaptchaError = "";
          renderBirdreportSpeciesDetail();
        }
      } catch (error) {
        state2.birdreportSpeciesCaptchaError = `验证码加载失败：${error.message}`;
        if (!silent) {
          renderBirdreportSpeciesDetail();
        }
      }
    }
    function clearBirdreportSpeciesDetail() {
      state2.activeBirdreportSpeciesKey = null;
      state2.birdreportSpeciesDetailSpecies = null;
      state2.birdreportSpeciesDetailRecords = [];
      state2.birdreportSpeciesDetailLoading = false;
      state2.birdreportSpeciesDetailError = "";
      if (state2.birdreportSpeciesCaptchaImageUrl) {
        URL.revokeObjectURL(state2.birdreportSpeciesCaptchaImageUrl);
      }
      state2.birdreportSpeciesCaptchaImageUrl = "";
      state2.birdreportSpeciesCaptchaLoading = false;
      state2.birdreportSpeciesCaptchaError = "";
    }
    function closeBirdreportSpeciesDetail() {
      if (!state2.activeBirdreportSpeciesKey) {
        return;
      }
      clearBirdreportSpeciesDetail();
      renderBirdreportSpeciesResults(state2.birdreportLastResults);
    }
    function renderBirdreportSpeciesResults(results) {
      elements2.birdreportSpeciesContainer.innerHTML = "";
      if (!results.length) {
        state2.birdreportLastResults = [];
        clearBirdreportSpeciesDetail();
        renderBirdreportSpeciesDetail();
        elements2.birdreportSpeciesSummary.textContent = "当前条件下没有查到鸟种。";
        renderEmptyState(elements2.birdreportSpeciesContainer, "birdreport", {
          title: "当前条件暂无鸟种",
          description: "调整时间、地区或观测地点后可以重新查询。"
        });
        return;
      }
      const sortedResults = sortBirdreportTaxaByRecordCount(results);
      state2.birdreportLastResults = sortedResults;
      if (!sortedResults.some((item) => getBirdreportTaxonKey(item) === state2.activeBirdreportSpeciesKey)) {
        clearBirdreportSpeciesDetail();
      }
      elements2.birdreportSpeciesSummary.textContent = `当前查询返回 ${sortedResults.length} 个鸟种，已按记录次数升序排列。点击鸟种名称可以查看当前筛选条件下的公开地点。`;
      elements2.birdreportSpeciesContainer.innerHTML = `
    <div class="result-table" style="--table-columns: 72px minmax(240px, 1.55fr) minmax(210px, 1.35fr) 120px 116px;">
      <div class="result-table-header">
        <div class="result-table-cell">序号</div>
        <div class="result-table-cell">鸟种</div>
        <div class="result-table-cell">分类</div>
        <div class="result-table-cell">记录数</div>
        <div class="result-table-cell">地点</div>
      </div>
      <div class="result-table-body">
        ${sortedResults.map((item, index) => {
        const key = getBirdreportTaxonKey(item);
        const isActive = key && key === state2.activeBirdreportSpeciesKey;
        const isLoading = isActive && state2.birdreportSpeciesDetailLoading;
        return `
              <div class="result-table-row${isActive ? " is-active" : ""}">
                <div class="result-table-cell result-table-index">${sortedResults.length - index}</div>
                <div class="result-table-cell">
                  <button
                    type="button"
                    class="result-table-name-btn"
                    data-birdreport-species-key="${escapeHtml(key)}"
                    ${key ? "" : "disabled"}
                    aria-pressed="${isActive ? "true" : "false"}"
                  >
                    <strong>${escapeHtml(item.taxonname || item.name || "未命名鸟种")}</strong>
                    <span class="result-table-meta">${escapeHtml(item.latinname || item.englishname || "未提供学名/英文名")}</span>
                  </button>
                </div>
                <div class="result-table-cell result-table-location">${escapeHtml(item.taxonordername || "未提供目")} · ${escapeHtml(item.taxonfamilyname || "未提供科")}</div>
                <div class="result-table-cell result-table-count">${escapeHtml((Number(item.recordcount) || 0).toLocaleString("zh-CN"))}</div>
                <div class="result-table-cell result-table-status">${!key ? "不可用" : isLoading ? "加载中..." : isActive ? "已展开" : "查看地点"}</div>
              </div>
            `;
      }).join("")}
      </div>
    </div>
  `;
      elements2.birdreportSpeciesContainer.querySelectorAll("[data-birdreport-species-key]").forEach((button) => {
        button.addEventListener("click", () => {
          const species = state2.birdreportLastResults.find((item) => getBirdreportTaxonKey(item) === button.dataset.birdreportSpeciesKey);
          if (species) {
            toggleBirdreportSpeciesDetail(species);
          }
        });
      });
      renderBirdreportSpeciesDetail();
    }
    function clearBirdreportSpeciesResults() {
      state2.birdreportLastQueryPayload = null;
      state2.birdreportLastResults = [];
      clearBirdreportSpeciesDetail();
      elements2.birdreportSpeciesSummary.textContent = "";
      elements2.birdreportSpeciesContainer.innerHTML = "";
      renderBirdreportSpeciesDetail();
    }
    function setBirdreportLoading(isLoading) {
      elements2.queryBirdreportProxyBtn.disabled = isLoading;
      elements2.openBirdreportTaxonBtn.disabled = isLoading;
      elements2.openBirdreportSearchBtn.disabled = isLoading;
      elements2.queryBirdreportProxyBtn.textContent = isLoading ? "查询中..." : "查询鸟种";
      setElementLoadingClass(elements2.queryBirdreportProxyBtn, isLoading);
      setElementLoadingClass(elements2.birdreportMessage, isLoading);
    }
    function openExternalUrl(url) {
      if (window.BeauBirdAndroid && typeof window.BeauBirdAndroid.openExternal === "function") {
        window.BeauBirdAndroid.openExternal(url);
        return;
      }
      window.open(url, "_blank", "noopener");
    }
    function openBirdreportTaxonPage() {
      const payload = buildBirdreportQueryPayload();
      if (!payload) {
        return;
      }
      const url = `${BIRDREPORT_TAXON_PAGE_URL2}?search=${encodeURIComponent(encodeBase64Utf8(JSON.stringify(payload)))}`;
      openExternalUrl(url);
      setBirdreportMessage("已打开 BirdReport 鸟种结果页。");
    }
    function openBirdreportSearchPage() {
      const payload = buildBirdreportQueryPayload();
      if (!payload) {
        return;
      }
      const url = new URL(BIRDREPORT_SEARCH_PAGE_URL2);
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== "") {
          url.searchParams.set(key, value);
        }
      });
      openExternalUrl(url.toString());
      setBirdreportMessage("已打开 BirdReport 查询页，并带入当前筛选条件。");
    }
    function buildBirdreportQueryPayload() {
      const startTime = normalizeDateInput(elements2.birdreportStartDate.value);
      const endTime = normalizeDateInput(elements2.birdreportEndDate.value);
      const province = String(elements2.birdreportProvince.value || "").trim();
      const city = String(elements2.birdreportCity.value || "").trim();
      const district = String(elements2.birdreportDistrict.value || "").trim();
      const pointname = String(elements2.birdreportPointName?.value || "").trim();
      if (![startTime, endTime, province, city, district, pointname].some(Boolean)) {
        setBirdreportMessage("请先选择区域、填写观测地点，或设置日期范围。", true);
        (elements2.birdreportPointName || elements2.birdreportProvince).focus();
        return null;
      }
      if (startTime && endTime && startTime > endTime) {
        setBirdreportMessage("开始日期不能晚于结束日期。", true);
        elements2.birdreportStartDate.focus();
        return null;
      }
      return createBirdreportPayload({ startTime, endTime, province, city, district, pointname });
    }
    function formatBirdreportQuerySummary(payload) {
      return BIRDREPORT_CORE2.formatBirdreportQuerySummary(payload);
    }
    function normalizeBirdreportAdministrativeArea(payload) {
      return BIRDREPORT_CORE2.normalizeBirdreportAdministrativeArea(payload);
    }
    Object.assign(runtime2, {
      queryBirdreportSpeciesByProxy,
      renderBirdreportSpeciesDetail,
      toggleBirdreportSpeciesDetail,
      submitBirdreportSpeciesCaptcha,
      refreshBirdreportSpeciesCaptcha,
      clearBirdreportSpeciesDetail,
      closeBirdreportSpeciesDetail,
      renderBirdreportSpeciesResults,
      clearBirdreportSpeciesResults,
      setBirdreportLoading,
      openExternalUrl,
      openBirdreportTaxonPage,
      openBirdreportSearchPage,
      buildBirdreportQueryPayload,
      formatBirdreportQuerySummary,
      normalizeBirdreportAdministrativeArea
    });
  }

  // src/script/features/birdreport/unlocked.js
  function installUnlockedSpecies(runtime2) {
    const { BIRDREPORT_UNLOCKED_SPECIES_CACHE_STORAGE: BIRDREPORT_UNLOCKED_SPECIES_CACHE_STORAGE2, BIRDREPORT_RARE_SPECIES_PROVINCE: BIRDREPORT_RARE_SPECIES_PROVINCE2, UNLOCKED_SPECIES_VISIBLE_ROW_COUNT: UNLOCKED_SPECIES_VISIBLE_ROW_COUNT2, formatCompactTimestamp: formatCompactTimestamp2, state: state2, elements: elements2 } = runtime2;
    const canUseBirdreportProxy = (...args) => runtime2.canUseBirdreportProxy(...args);
    const createBirdreportPayload = (...args) => runtime2.createBirdreportPayload(...args);
    const escapeHtml = (...args) => runtime2.escapeHtml(...args);
    const fetchAllBirdreportTaxa = (...args) => runtime2.fetchAllBirdreportTaxa(...args);
    const fetchRecentBirdreportRecordsByTaxon = (...args) => runtime2.fetchRecentBirdreportRecordsByTaxon(...args);
    const fetchZhejiangSpeciesCatalogFromJson = (...args) => runtime2.fetchZhejiangSpeciesCatalogFromJson(...args);
    const formatDateTime = (...args) => runtime2.formatDateTime(...args);
    const getBirdreportReportCount = (...args) => runtime2.getBirdreportReportCount(...args);
    const getBirdreportTaxaArray = (...args) => runtime2.getBirdreportTaxaArray(...args);
    const getBirdreportTaxonKey = (...args) => runtime2.getBirdreportTaxonKey(...args);
    const isBirdreportCaptchaError = (...args) => runtime2.isBirdreportCaptchaError(...args);
    const loadBirdreportCaptchaImage = (...args) => runtime2.loadBirdreportCaptchaImage(...args);
    const normalizeBirdreportTaxa = (...args) => runtime2.normalizeBirdreportTaxa(...args);
    const renderEmptyState = (...args) => runtime2.renderEmptyState(...args);
    const safeLocalStorageGet = (...args) => runtime2.safeLocalStorageGet(...args);
    const safeLocalStorageRemove = (...args) => runtime2.safeLocalStorageRemove(...args);
    const safeLocalStorageSet = (...args) => runtime2.safeLocalStorageSet(...args);
    const saveTextFile = (...args) => runtime2.saveTextFile(...args);
    const serializeBirdreportTaxon = (...args) => runtime2.serializeBirdreportTaxon(...args);
    const setElementLoadingClass = (...args) => runtime2.setElementLoadingClass(...args);
    const setStatusMessage = (...args) => runtime2.setStatusMessage(...args);
    const toCsvText = (...args) => runtime2.toCsvText(...args);
    const verifyBirdreportCaptcha = (...args) => runtime2.verifyBirdreportCaptcha(...args);
    async function queryUnlockedSpeciesByUser() {
      const username = String(elements2.birdreportUnlockedUsername?.value || "").trim();
      if (!username) {
        setUnlockedSpeciesMessage("请先输入记录用户姓名。", true);
        elements2.birdreportUnlockedUsername?.focus();
        return;
      }
      if (!canUseBirdreportProxy()) {
        setUnlockedSpeciesMessage("BirdReport 暂时不可用，无法查询记录用户。", true);
        return;
      }
      setUnlockedSpeciesLoading(true);
      setUnlockedSpeciesMessage(`正在查询 ${username} 的浙江鸟种...`);
      try {
        const catalog = normalizeBirdreportTaxa(await fetchZhejiangSpeciesCatalogForUnlocked({
          onProgress: (message) => setUnlockedSpeciesMessage(message)
        }));
        const observed = normalizeBirdreportTaxa(await fetchUserZhejiangSpecies(username, {
          onProgress: (message) => setUnlockedSpeciesMessage(message)
        }));
        if (catalog.length && !observed.length) {
          throw new Error(`BirdReport 没有查到「${username}」在浙江的鸟种记录；请确认输入的是记录页里显示的完整记录用户名。`);
        }
        const missing = buildUnlockedMissingSpecies(catalog, observed);
        state2.unlockedSpeciesCatalog = catalog;
        state2.unlockedObservedSpecies = observed;
        state2.unlockedMissingSpecies = missing;
        state2.unlockedTargetUsername = username;
        state2.unlockedSpeciesCacheSavedAt = (/* @__PURE__ */ new Date()).toISOString();
        state2.unlockedSpeciesTableVisible = true;
        clearUnlockedSpeciesDetail();
        saveUnlockedSpeciesCache();
        renderUnlockedSpeciesPanel();
        setUnlockedSpeciesMessage(
          `${username} 已解锁 ${observed.length} / ${catalog.length} 种浙江鸟种，还差 ${missing.length} 种。`
        );
      } catch (error) {
        setUnlockedSpeciesMessage(`未解锁鸟种查询失败：${error.message}`, true);
      } finally {
        setUnlockedSpeciesLoading(false);
      }
    }
    async function fetchZhejiangSpeciesCatalogForUnlocked(options = {}) {
      const { onProgress } = options;
      try {
        onProgress?.("正在刷新浙江鸟种名录和历史记录数...");
        const onlineCatalog = await fetchAllBirdreportTaxa(createBirdreportPayload({ province: BIRDREPORT_RARE_SPECIES_PROVINCE2 }), {
          onProgress: (message) => onProgress?.(message.replace("BirdReport 鸟种", "浙江鸟种名录"))
        });
        if (onlineCatalog.length) {
          return onlineCatalog.map(serializeBirdreportTaxon).sort(sortBirdreportTaxaByReportCountDesc);
        }
      } catch (error) {
        console.warn("Failed to refresh Zhejiang species catalog from BirdReport:", error);
        onProgress?.(`在线刷新浙江名录失败，使用本地缓存名录：${error.message}`);
      }
      return fetchZhejiangSpeciesCatalogFromJson();
    }
    async function fetchUserZhejiangSpecies(username, options = {}) {
      const { onProgress } = options;
      const primary = await fetchAllBirdreportTaxa(
        createBirdreportPayload({
          province: BIRDREPORT_RARE_SPECIES_PROVINCE2,
          username,
          mode: 1
        }),
        {
          onProgress: (message) => onProgress?.(message.replace("BirdReport 鸟种", "用户浙江鸟种"))
        }
      );
      if (primary.length) {
        return primary;
      }
      onProgress?.("按兼容模式重新核对记录用户鸟种...");
      return fetchAllBirdreportTaxa(
        createBirdreportPayload({
          province: BIRDREPORT_RARE_SPECIES_PROVINCE2,
          username
        }),
        {
          onProgress: (message) => onProgress?.(message.replace("BirdReport 鸟种", "用户浙江鸟种"))
        }
      );
    }
    function buildUnlockedMissingSpecies(catalog, observed) {
      const catalogItems = getBirdreportTaxaArray(catalog);
      const observedItems = getBirdreportTaxaArray(observed);
      const observedKeys = new Set(observedItems.map(getBirdreportTaxonKey).filter(Boolean));
      const observedNames = new Set(observedItems.map((item) => String(item?.taxonname || item?.name || "").trim()).filter(Boolean));
      return catalogItems.filter((item) => !observedKeys.has(getBirdreportTaxonKey(item)) && !observedNames.has(String(item?.taxonname || "").trim())).sort(sortBirdreportTaxaByReportCountDesc);
    }
    function sortBirdreportTaxaByReportCountDesc(left, right) {
      const countDiff = getBirdreportReportCount(right) - getBirdreportReportCount(left);
      if (countDiff !== 0) {
        return countDiff;
      }
      return String(left?.taxonname || "").localeCompare(String(right?.taxonname || ""), "zh-CN");
    }
    function renderUnlockedSpeciesPanel() {
      if (!elements2.unlockedSpeciesSummary || !elements2.unlockedSpeciesContainer) {
        return;
      }
      const catalog = getBirdreportTaxaArray(state2.unlockedSpeciesCatalog);
      const observed = getBirdreportTaxaArray(state2.unlockedObservedSpecies);
      const missing = getBirdreportTaxaArray(state2.unlockedMissingSpecies);
      const catalogCount = catalog.length || 0;
      const missingCount = missing.length || 0;
      const observedCount = observed.length || (catalogCount ? catalogCount - missingCount : 0);
      updateUnlockedSpeciesExportButton();
      if (!catalogCount) {
        elements2.unlockedSpeciesSummary.classList.remove("is-rich");
        elements2.unlockedSpeciesSummary.textContent = "输入记录用户后，可核对浙江 588 种名录中的未解锁鸟种。";
        renderEmptyState(elements2.unlockedSpeciesContainer, "unlocked");
        return;
      }
      renderUnlockedSpeciesSummary({
        observedCount,
        missingCount,
        catalogCount
      });
      renderUnlockedSpeciesList();
    }
    function renderUnlockedSpeciesSummary({ observedCount, missingCount, catalogCount }) {
      elements2.unlockedSpeciesSummary.classList.add("is-rich");
      elements2.unlockedSpeciesSummary.innerHTML = `
    <div class="unlocked-summary-toolbar">
      <div class="unlocked-summary-grid">
        ${renderUnlockedSpeciesSummaryCard("记录用户", state2.unlockedTargetUsername || "未填写", "info")}
        ${renderUnlockedSpeciesSummaryCard("已解锁", `${observedCount} 种`, "success")}
        ${renderUnlockedSpeciesSummaryCard("未解锁", `${missingCount} 种`, "warning")}
        ${renderUnlockedSpeciesSummaryCard("浙江名录", `${catalogCount} 种`, "catalog")}
        ${state2.unlockedSpeciesCacheSavedAt ? renderUnlockedSpeciesSummaryCard("缓存", formatDateTime(state2.unlockedSpeciesCacheSavedAt), "neutral") : ""}
      </div>
      <div class="unlocked-summary-actions">
        <button type="button" class="ghost unlocked-summary-toggle">${state2.unlockedSpeciesShowMeta ? "隐藏鸟种信息" : "显示鸟种信息"}</button>
      </div>
    </div>
  `;
      elements2.unlockedSpeciesSummary.querySelector(".unlocked-summary-toggle")?.addEventListener("click", toggleUnlockedSpeciesInfoVisibility);
    }
    function renderUnlockedSpeciesSummaryCard(label, value, tone = "neutral") {
      const toneClass = ["success", "warning", "info", "catalog", "neutral"].includes(tone) ? ` is-${tone}` : "";
      return `
    <div class="unlocked-summary-card${toneClass}">
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(label)}</span>
    </div>
  `;
    }
    function toggleUnlockedSpeciesInfoVisibility() {
      state2.unlockedSpeciesShowMeta = !state2.unlockedSpeciesShowMeta;
      renderUnlockedSpeciesPanel();
    }
    function toggleUnlockedSpeciesTableVisibility() {
      state2.unlockedSpeciesTableVisible = !state2.unlockedSpeciesTableVisible;
      if (!state2.unlockedSpeciesTableVisible) {
        clearUnlockedSpeciesDetail();
      }
      renderUnlockedSpeciesPanel();
    }
    function renderUnlockedSpeciesList() {
      const previousScrollTop = elements2.unlockedSpeciesContainer.querySelector(".unlocked-species-scroll")?.scrollTop || 0;
      elements2.unlockedSpeciesContainer.innerHTML = "";
      const missing = getBirdreportTaxaArray(state2.unlockedMissingSpecies);
      if (!missing.length) {
        elements2.unlockedSpeciesContainer.innerHTML = '<div class="empty-state">这个用户已经解锁浙江名录里的全部鸟种。</div>';
        return;
      }
      const module = document.createElement("section");
      module.className = "unlocked-species-module";
      module.style.setProperty("--unlocked-visible-rows", String(UNLOCKED_SPECIES_VISIBLE_ROW_COUNT2));
      module.setAttribute("aria-label", "全部未解锁鸟种列表");
      module.addEventListener("click", (event) => {
        const button = event.target.closest("[data-unlocked-map-taxon]");
        if (!button) return;
        event.stopPropagation();
        runtime2.openBirdMapForSpecies?.({
          taxonId: button.dataset.unlockedMapTaxon,
          commonName: button.dataset.unlockedMapName,
          latinname: button.dataset.unlockedMapScientific
        });
      });
      module.append(createUnlockedSpeciesModuleHeader(missing.length));
      if (!state2.unlockedSpeciesTableVisible) {
        const empty = document.createElement("div");
        empty.className = "empty-state unlocked-species-module-empty";
        empty.style.setProperty("--empty-icon", '"📋"');
        empty.textContent = `已隐藏 ${missing.length} 个未解锁鸟种，点击“展开列表”查看。`;
        module.append(empty);
        elements2.unlockedSpeciesContainer.append(module);
        return;
      }
      const totalReportCount = Math.max(
        1,
        missing.reduce(
          (sum, item) => sum + getBirdreportReportCount(item),
          0
        )
      );
      const table = document.createElement("div");
      table.className = "unlocked-species-table";
      table.innerHTML = `
    <div class="unlocked-species-table-head" role="row">
      <span class="unlocked-table-cell unlocked-cell-rank">序号</span>
      <span class="unlocked-table-cell unlocked-cell-code">编号</span>
      <span class="unlocked-table-cell unlocked-cell-name">中文名</span>
      <span class="unlocked-table-cell unlocked-cell-count">历史记录</span>
      <span class="unlocked-table-cell unlocked-cell-toggle">展开</span>
    </div>
  `;
      missing.forEach((item, index) => {
        const key = getBirdreportTaxonKey(item);
        const isActive = key === state2.activeUnlockedSpeciesKey;
        const reportCount = getBirdreportReportCount(item);
        const frequency = reportCount / totalReportCount * 100;
        const taxonId = String(item?.taxon_id || item?.taxonid || item?.id || "--").trim() || "--";
        const entry = document.createElement("article");
        entry.className = [
          "unlocked-species-entry",
          isActive ? "is-active" : ""
        ].filter(Boolean).join(" ");
        entry.innerHTML = `
      <button
        type="button"
        class="unlocked-species-row"
        aria-expanded="${isActive ? "true" : "false"}"
        aria-label="${isActive ? "收起" : "展开"} ${escapeHtml(item.taxonname || "未命名鸟种")} 的鸟种信息和公开地点"
      >
        <span class="unlocked-table-cell unlocked-cell-rank">${index + 1}</span>
        <span class="unlocked-table-cell unlocked-cell-code">${escapeHtml(taxonId)}</span>
        <span class="unlocked-table-cell unlocked-cell-name">
          <strong>${escapeHtml(item.taxonname || "未命名鸟种")}</strong>
          ${state2.unlockedSpeciesShowMeta ? `<small>${escapeHtml(buildUnlockedSpeciesMetaLine(item))}</small>` : ""}
        </span>
        <span class="unlocked-table-cell unlocked-cell-count">${escapeHtml(reportCount.toLocaleString("zh-CN"))}</span>
        <span class="unlocked-table-cell unlocked-cell-toggle" aria-hidden="true">${isActive ? "⌃" : "⌄"}</span>
      </button>
    `;
        entry.querySelector(".unlocked-species-row")?.addEventListener("click", () => toggleUnlockedSpeciesLocations(item));
        if (isActive) {
          entry.append(
            renderUnlockedSpeciesLocationPanel(item, {
              reportCount,
              frequency
            })
          );
        }
        table.append(entry);
      });
      const scroll = document.createElement("div");
      scroll.className = "unlocked-species-scroll";
      scroll.tabIndex = 0;
      scroll.append(table);
      module.append(scroll);
      elements2.unlockedSpeciesContainer.append(module);
      scroll.scrollTop = previousScrollTop;
    }
    function createUnlockedSpeciesModuleHeader(missingCount) {
      const header = document.createElement("div");
      header.className = "unlocked-species-module-header";
      const buttonLabel = state2.unlockedSpeciesTableVisible ? "隐藏列表" : "展开列表";
      const username = String(state2.unlockedTargetUsername || "").trim() || "未填写";
      header.innerHTML = `
    <div class="unlocked-species-module-title">
      <strong>全部未解锁鸟种</strong>
      <span>${escapeHtml(String(missingCount))} 种 · 记录用户：${escapeHtml(username)}</span>
    </div>
    <button type="button" class="ghost unlocked-module-toggle" aria-label="${escapeHtml(buttonLabel)}">
      ${escapeHtml(buttonLabel)}
    </button>
  `;
      header.querySelector(".unlocked-module-toggle")?.addEventListener("click", toggleUnlockedSpeciesTableVisibility);
      return header;
    }
    function buildUnlockedSpeciesMetaLine(item) {
      const taxonMeta = [item?.taxonordername, item?.taxonfamilyname].filter(Boolean).join(" · ");
      return [item?.latinname, taxonMeta].filter(Boolean).join(" · ") || "点击展开查看详情";
    }
    function renderUnlockedSpeciesLocationPanel(species, context = {}) {
      const panel = document.createElement("div");
      panel.className = "unlocked-location-panel";
      const reportCount = Number.isFinite(context.reportCount) ? context.reportCount : getBirdreportReportCount(species);
      const frequency = Number.isFinite(context.frequency) ? context.frequency : 0;
      const summaryBlock = `
    <div class="unlocked-detail-grid">
      <div class="unlocked-detail-card">
        <strong>学名</strong>
        <span>${escapeHtml(species.latinname || "未提供学名")}</span>
      </div>
      <div class="unlocked-detail-card">
        <strong>缺口频率</strong>
        <span>${escapeHtml(frequency.toFixed(5))}%</span>
      </div>
      <div class="unlocked-detail-card">
        <strong>目 / 科</strong>
        <span>${escapeHtml(formatUnlockedSpeciesTaxonomy(species))}</span>
      </div>
      <div class="unlocked-detail-card">
        <strong>浙江历史记录</strong>
        <span>${escapeHtml(reportCount.toLocaleString("zh-CN"))}</span>
      </div>
    </div>
    <div class="unlocked-map-action">
      <button
        type="button"
        class="ghost"
        data-unlocked-map-taxon="${escapeHtml(String(species?.taxon_id || species?.taxonid || ""))}"
        data-unlocked-map-name="${escapeHtml(species?.taxonname || "该鸟种")}"
        data-unlocked-map-scientific="${escapeHtml(species?.latinname || "")}"
      >在地图查看浙江近两年地点</button>
    </div>
  `;
      if (state2.unlockedSpeciesDetailLoading) {
        panel.innerHTML = `${summaryBlock}<div class="empty-state">正在按报告编号加载公开地点...</div>`;
        return panel;
      }
      if (state2.unlockedSpeciesDetailError) {
        if (state2.unlockedSpeciesDetailError === "captcha_required") {
          panel.innerHTML = `${summaryBlock}
        <div class="birdreport-captcha-panel">
          <strong>BirdReport 需要验证码</strong>
          <span>请输入图片里的验证码，验证通过后会自动重新加载这个鸟种的地点。</span>
          <div class="birdreport-captcha-row">
            ${state2.unlockedSpeciesCaptchaImageUrl ? `<img class="birdreport-captcha-image" src="${escapeHtml(state2.unlockedSpeciesCaptchaImageUrl)}" alt="BirdReport 验证码" />` : '<span class="empty-state">验证码加载中...</span>'}
            <button type="button" class="ghost birdreport-refresh-captcha-btn">换一张</button>
          </div>
          <div class="birdreport-captcha-row">
            <input class="birdreport-captcha-input" type="text" inputmode="text" maxlength="4" autocomplete="off" placeholder="输入验证码" />
            <button type="button" class="birdreport-submit-captcha-btn">${state2.unlockedSpeciesCaptchaLoading ? "验证中..." : "验证并重试"}</button>
          </div>
          ${state2.unlockedSpeciesCaptchaError ? `<div class="message error">${escapeHtml(state2.unlockedSpeciesCaptchaError)}</div>` : ""}
        </div>
      `;
          const input = panel.querySelector(".birdreport-captcha-input");
          const submit = panel.querySelector(".birdreport-submit-captcha-btn");
          const refresh = panel.querySelector(".birdreport-refresh-captcha-btn");
          if (submit) {
            submit.disabled = state2.unlockedSpeciesCaptchaLoading;
            submit.addEventListener("click", () => submitUnlockedSpeciesCaptcha(species, input?.value));
          }
          input?.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
              submitUnlockedSpeciesCaptcha(species, input.value);
            }
          });
          refresh?.addEventListener("click", () => refreshUnlockedSpeciesCaptcha());
          return panel;
        }
        panel.innerHTML = `${summaryBlock}<div class="empty-state">加载失败：${escapeHtml(state2.unlockedSpeciesDetailError)}</div>`;
        return panel;
      }
      if (!state2.unlockedSpeciesDetailRecords.length) {
        panel.innerHTML = `${summaryBlock}<div class="empty-state">BirdReport 暂时没有返回可展示的公开地点。</div>`;
        return panel;
      }
      panel.innerHTML = `
    ${summaryBlock}
    <div class="unlocked-location-title">
      <strong>${escapeHtml(species.taxonname || "未命名鸟种")} 公开地点</strong>
      <span>按记录中心活动报告默认顺序展示</span>
    </div>
    <div class="unlocked-location-list">
      ${state2.unlockedSpeciesDetailRecords.map(
        (record) => `
            <div class="unlocked-location-item">
              <strong>${escapeHtml(record.pointName || "未提供观测地点")}</strong>
              <span>${escapeHtml(record.startTimeLabel)} 至 ${escapeHtml(record.endTimeLabel)}</span>
              <span>记录用户：${escapeHtml(record.username || "未提供")} · 数量：${escapeHtml(String(record.taxonCount ?? 0))} · 报告编号：${escapeHtml(record.serialId || "未提供")}</span>
            </div>
          `
      ).join("")}
    </div>
  `;
      return panel;
    }
    function formatUnlockedSpeciesTaxonomy(species) {
      const orderName = String(species?.taxonordername || "").trim() || "未提供目";
      const familyName = String(species?.taxonfamilyname || "").trim() || "未提供科";
      return `${orderName} · ${familyName}`;
    }
    async function toggleUnlockedSpeciesLocations(species) {
      const key = getBirdreportTaxonKey(species);
      if (!key || !species.taxon_id) {
        setUnlockedSpeciesMessage("这个鸟种缺少 BirdReport 鸟种编号，暂时不能查询地点。", true);
        return;
      }
      if (state2.activeUnlockedSpeciesKey === key && !state2.unlockedSpeciesDetailLoading) {
        clearUnlockedSpeciesDetail();
        renderUnlockedSpeciesList();
        return;
      }
      state2.activeUnlockedSpeciesKey = key;
      state2.unlockedSpeciesDetailRecords = [];
      state2.unlockedSpeciesDetailError = "";
      state2.unlockedSpeciesDetailLoading = true;
      renderUnlockedSpeciesList();
      setUnlockedSpeciesMessage(`正在按记录中心默认顺序加载 ${species.taxonname || "该鸟种"} 在浙江的公开地点...`);
      try {
        state2.unlockedSpeciesDetailRecords = await fetchRecentBirdreportRecordsByTaxon(species, {
          limit: 10
        });
        state2.unlockedSpeciesDetailError = "";
        setUnlockedSpeciesMessage(
          state2.unlockedSpeciesDetailRecords.length ? `${species.taxonname || "该鸟种"} 公开地点已加载 ${state2.unlockedSpeciesDetailRecords.length} 条，按活动报告默认顺序展示。` : `${species.taxonname || "该鸟种"} 暂时没有可展示的公开地点。`
        );
      } catch (error) {
        if (isBirdreportCaptchaError(error)) {
          state2.unlockedSpeciesDetailError = "captcha_required";
          state2.unlockedSpeciesCaptchaError = "";
          await refreshUnlockedSpeciesCaptcha({ silent: true });
          setUnlockedSpeciesMessage("BirdReport 要求输入验证码，验证后会自动重试地点查询。", true);
        } else {
          state2.unlockedSpeciesDetailError = error.message;
          setUnlockedSpeciesMessage(`加载公开地点失败：${error.message}`, true);
        }
      } finally {
        state2.unlockedSpeciesDetailLoading = false;
        renderUnlockedSpeciesList();
      }
    }
    async function submitUnlockedSpeciesCaptcha(species, rawCode) {
      const code = String(rawCode || "").trim();
      if (!code) {
        state2.unlockedSpeciesCaptchaError = "请先输入验证码。";
        renderUnlockedSpeciesList();
        return;
      }
      state2.unlockedSpeciesCaptchaLoading = true;
      state2.unlockedSpeciesCaptchaError = "";
      renderUnlockedSpeciesList();
      try {
        await verifyBirdreportCaptcha(code);
        state2.unlockedSpeciesCaptchaLoading = false;
        state2.unlockedSpeciesCaptchaError = "";
        state2.unlockedSpeciesDetailError = "";
        state2.unlockedSpeciesDetailLoading = true;
        state2.unlockedSpeciesDetailRecords = [];
        renderUnlockedSpeciesList();
        setUnlockedSpeciesMessage("验证码通过，正在重新加载公开地点...");
        state2.unlockedSpeciesDetailRecords = await fetchRecentBirdreportRecordsByTaxon(species, {
          limit: 10
        });
        state2.unlockedSpeciesDetailError = "";
        setUnlockedSpeciesMessage(
          state2.unlockedSpeciesDetailRecords.length ? `${species.taxonname || "该鸟种"} 公开地点已加载 ${state2.unlockedSpeciesDetailRecords.length} 条，按活动报告默认顺序展示。` : `${species.taxonname || "该鸟种"} 暂时没有可展示的公开地点。`
        );
      } catch (error) {
        state2.unlockedSpeciesCaptchaLoading = false;
        state2.unlockedSpeciesDetailLoading = false;
        state2.unlockedSpeciesDetailError = "captcha_required";
        state2.unlockedSpeciesCaptchaError = error.message;
        await refreshUnlockedSpeciesCaptcha({ silent: true });
        setUnlockedSpeciesMessage(`验证码验证失败：${error.message}`, true);
      } finally {
        state2.unlockedSpeciesCaptchaLoading = false;
        state2.unlockedSpeciesDetailLoading = false;
        renderUnlockedSpeciesList();
      }
    }
    async function refreshUnlockedSpeciesCaptcha(options = {}) {
      const { silent = false } = options;
      try {
        const imageUrl = await loadBirdreportCaptchaImage();
        if (state2.unlockedSpeciesCaptchaImageUrl) {
          URL.revokeObjectURL(state2.unlockedSpeciesCaptchaImageUrl);
        }
        state2.unlockedSpeciesCaptchaImageUrl = imageUrl;
        if (!silent) {
          state2.unlockedSpeciesCaptchaError = "";
          renderUnlockedSpeciesList();
        }
      } catch (error) {
        state2.unlockedSpeciesCaptchaError = `验证码加载失败：${error.message}`;
        if (!silent) {
          renderUnlockedSpeciesList();
        }
      }
    }
    function clearUnlockedSpeciesDetail() {
      state2.activeUnlockedSpeciesKey = null;
      state2.unlockedSpeciesDetailRecords = [];
      state2.unlockedSpeciesDetailLoading = false;
      state2.unlockedSpeciesDetailError = "";
      if (state2.unlockedSpeciesCaptchaImageUrl) {
        URL.revokeObjectURL(state2.unlockedSpeciesCaptchaImageUrl);
      }
      state2.unlockedSpeciesCaptchaImageUrl = "";
      state2.unlockedSpeciesCaptchaLoading = false;
      state2.unlockedSpeciesCaptchaError = "";
    }
    function clearUnlockedSpeciesResults(options = {}) {
      const { keepUsername = false } = options;
      state2.unlockedSpeciesCatalog = [];
      state2.unlockedObservedSpecies = [];
      state2.unlockedMissingSpecies = [];
      state2.unlockedTargetUsername = "";
      state2.unlockedSpeciesCacheSavedAt = "";
      state2.unlockedSpeciesTableVisible = true;
      clearUnlockedSpeciesDetail();
      clearUnlockedSpeciesCache();
      if (!keepUsername && elements2.birdreportUnlockedUsername) {
        elements2.birdreportUnlockedUsername.value = "";
      }
      renderUnlockedSpeciesPanel();
      setUnlockedSpeciesMessage("已清空未解锁鸟种查询结果。");
    }
    async function exportUnlockedSpeciesTable() {
      const rows = buildUnlockedSpeciesExportRows();
      if (!rows.length) {
        setUnlockedSpeciesMessage("当前没有可导出的未解锁鸟种。", true);
        return;
      }
      try {
        document.querySelector("[data-unlocked-export-overlay]")?.remove();
        document.body.classList.remove("unlocked-export-open");
        const csvContent = toCsvText([
          ["鸟类名称", "目", "科"],
          ...rows
        ]);
        const filename = buildUnlockedSpeciesExportFilename("csv");
        const locationLabel = await saveTextFile(filename, "text/csv;charset=utf-8", `\uFEFF${csvContent}`);
        setUnlockedSpeciesMessage(`未解锁鸟种表格已导出：${locationLabel || filename}`);
      } catch (error) {
        setUnlockedSpeciesMessage(`导出未解锁鸟种失败：${error.message}`, true);
      }
    }
    function buildUnlockedSpeciesExportRows() {
      return [...getBirdreportTaxaArray(state2.unlockedMissingSpecies)].sort(sortBirdreportTaxaByReportCountDesc).map((item) => [
        String(item?.taxonname || item?.name || "未命名鸟种").trim() || "未命名鸟种",
        String(item?.taxonordername || "").trim() || "未提供",
        String(item?.taxonfamilyname || "").trim() || "未提供"
      ]);
    }
    function buildUnlockedSpeciesExportFilename(extension = "csv") {
      const username = String(state2.unlockedTargetUsername || "未命名用户").trim().replace(/[\\/:*?"<>|]/g, "_");
      const stamp = formatCompactTimestamp2(/* @__PURE__ */ new Date());
      return `${username}-未解锁鸟种-${stamp}.${extension}`;
    }
    function setUnlockedSpeciesMessage(message, isError = false) {
      setStatusMessage(elements2.unlockedSpeciesMessage, message, isError);
    }
    function updateUnlockedSpeciesExportButton(isLoading = false) {
      if (!elements2.exportUnlockedSpeciesBtn) {
        return;
      }
      elements2.exportUnlockedSpeciesBtn.disabled = isLoading;
    }
    function setUnlockedSpeciesLoading(isLoading) {
      if (elements2.queryUnlockedSpeciesBtn) {
        elements2.queryUnlockedSpeciesBtn.disabled = isLoading;
        elements2.queryUnlockedSpeciesBtn.textContent = isLoading ? "查询中..." : "查询未解锁鸟种";
        setElementLoadingClass(elements2.queryUnlockedSpeciesBtn, isLoading);
      }
      updateUnlockedSpeciesExportButton(isLoading);
      if (elements2.clearUnlockedSpeciesBtn) {
        elements2.clearUnlockedSpeciesBtn.disabled = isLoading;
      }
      if (elements2.birdreportUnlockedUsername) {
        elements2.birdreportUnlockedUsername.disabled = isLoading;
      }
      setElementLoadingClass(elements2.unlockedSpeciesMessage, isLoading);
    }
    function loadUnlockedSpeciesCache2() {
      try {
        const raw = safeLocalStorageGet(BIRDREPORT_UNLOCKED_SPECIES_CACHE_STORAGE2, "");
        if (!raw) {
          return createEmptyUnlockedSpeciesCache();
        }
        const parsed = JSON.parse(raw);
        const cache = {
          username: String(parsed?.username || "").trim(),
          savedAt: String(parsed?.savedAt || "").trim(),
          catalog: normalizeBirdreportTaxa(parsed?.catalog),
          observed: normalizeBirdreportTaxa(parsed?.observed),
          missing: normalizeBirdreportTaxa(parsed?.missing)
        };
        if (cache.username && !cache.catalog.length) {
          return createEmptyUnlockedSpeciesCache();
        }
        if (cache.username && cache.catalog.length && !cache.observed.length && cache.missing.length >= cache.catalog.length) {
          return createEmptyUnlockedSpeciesCache();
        }
        return cache;
      } catch (error) {
        console.warn("Failed to load unlocked species cache:", error);
        return createEmptyUnlockedSpeciesCache();
      }
    }
    function createEmptyUnlockedSpeciesCache() {
      return {
        username: "",
        savedAt: "",
        catalog: [],
        observed: [],
        missing: []
      };
    }
    function saveUnlockedSpeciesCache() {
      const payload = {
        username: state2.unlockedTargetUsername,
        savedAt: state2.unlockedSpeciesCacheSavedAt,
        catalog: normalizeBirdreportTaxa(state2.unlockedSpeciesCatalog),
        observed: normalizeBirdreportTaxa(state2.unlockedObservedSpecies),
        missing: normalizeBirdreportTaxa(state2.unlockedMissingSpecies)
      };
      safeLocalStorageSet(BIRDREPORT_UNLOCKED_SPECIES_CACHE_STORAGE2, JSON.stringify(payload));
    }
    function clearUnlockedSpeciesCache() {
      safeLocalStorageRemove(BIRDREPORT_UNLOCKED_SPECIES_CACHE_STORAGE2);
    }
    Object.assign(runtime2, {
      queryUnlockedSpeciesByUser,
      fetchZhejiangSpeciesCatalogForUnlocked,
      fetchUserZhejiangSpecies,
      buildUnlockedMissingSpecies,
      sortBirdreportTaxaByReportCountDesc,
      renderUnlockedSpeciesPanel,
      renderUnlockedSpeciesSummary,
      renderUnlockedSpeciesSummaryCard,
      toggleUnlockedSpeciesInfoVisibility,
      toggleUnlockedSpeciesTableVisibility,
      renderUnlockedSpeciesList,
      createUnlockedSpeciesModuleHeader,
      buildUnlockedSpeciesMetaLine,
      renderUnlockedSpeciesLocationPanel,
      formatUnlockedSpeciesTaxonomy,
      toggleUnlockedSpeciesLocations,
      submitUnlockedSpeciesCaptcha,
      refreshUnlockedSpeciesCaptcha,
      clearUnlockedSpeciesDetail,
      clearUnlockedSpeciesResults,
      exportUnlockedSpeciesTable,
      buildUnlockedSpeciesExportRows,
      buildUnlockedSpeciesExportFilename,
      setUnlockedSpeciesMessage,
      updateUnlockedSpeciesExportButton,
      setUnlockedSpeciesLoading,
      loadUnlockedSpeciesCache: loadUnlockedSpeciesCache2,
      createEmptyUnlockedSpeciesCache,
      saveUnlockedSpeciesCache,
      clearUnlockedSpeciesCache
    });
  }

  // src/script/features/birdreport/rare-monitor.js
  function installRareMonitor(runtime2) {
    const { BIRDREPORT_RARE_SPECIES_STORAGE: BIRDREPORT_RARE_SPECIES_STORAGE2, BIRDREPORT_RARE_MONITOR_STORAGE: BIRDREPORT_RARE_MONITOR_STORAGE2, BIRDREPORT_RARE_NOTIFICATION_LOG_STORAGE: BIRDREPORT_RARE_NOTIFICATION_LOG_STORAGE2, BIRDREPORT_RARE_SPECIES_PROVINCE: BIRDREPORT_RARE_SPECIES_PROVINCE2, BIRDREPORT_RARE_SPECIES_THRESHOLD: BIRDREPORT_RARE_SPECIES_THRESHOLD2, BIRDREPORT_MONITOR_INTERVAL_MS: BIRDREPORT_MONITOR_INTERVAL_MS2, state: state2, elements: elements2 } = runtime2;
    const canUseBirdreportProxy = (...args) => runtime2.canUseBirdreportProxy(...args);
    const createBirdreportPayload = (...args) => runtime2.createBirdreportPayload(...args);
    const escapeHtml = (...args) => runtime2.escapeHtml(...args);
    const fetchAllBirdreportTaxa = (...args) => runtime2.fetchAllBirdreportTaxa(...args);
    const fetchBirdreportRecordsByTaxon = (...args) => runtime2.fetchBirdreportRecordsByTaxon(...args);
    const fetchZhejiangSpeciesBaselineFromJson = (...args) => runtime2.fetchZhejiangSpeciesBaselineFromJson(...args);
    const formatDate = (...args) => runtime2.formatDate(...args);
    const formatDateTime = (...args) => runtime2.formatDateTime(...args);
    const formatIsoDate = (...args) => runtime2.formatIsoDate(...args);
    const getBirdreportTaxonKey = (...args) => runtime2.getBirdreportTaxonKey(...args);
    const normalizeDateInput = (...args) => runtime2.normalizeDateInput(...args);
    const renderEmptyState = (...args) => runtime2.renderEmptyState(...args);
    const safeLocalStorageGet = (...args) => runtime2.safeLocalStorageGet(...args);
    const safeLocalStorageSet = (...args) => runtime2.safeLocalStorageSet(...args);
    const serializeBirdreportTaxon = (...args) => runtime2.serializeBirdreportTaxon(...args);
    const setElementLoadingClass = (...args) => runtime2.setElementLoadingClass(...args);
    const setStatusMessage = (...args) => runtime2.setStatusMessage(...args);
    const sortBirdreportTaxaByRecordCount = (...args) => runtime2.sortBirdreportTaxaByRecordCount(...args);
    const toRareSpeciesHit = (...args) => runtime2.toRareSpeciesHit(...args);
    function hydrateZhejiangRareMonitorInputs() {
      const targetDate = formatIsoDate(/* @__PURE__ */ new Date());
      state2.zhejiangRareMonitor.targetDate = targetDate;
      if (elements2.zhejiangRareMonitorDate) {
        elements2.zhejiangRareMonitorDate.value = targetDate;
      }
      saveZhejiangRareMonitor(state2.zhejiangRareMonitor);
    }
    function handleZhejiangRareMonitorDateChange() {
      const targetDate = getSelectedZhejiangRareMonitorDate();
      state2.zhejiangRareMonitor.targetDate = targetDate;
      state2.zhejiangRareHits = [];
      clearZhejiangRareSpeciesDetail();
      saveZhejiangRareMonitor(state2.zhejiangRareMonitor);
      renderZhejiangRareSpeciesPanel();
      if (state2.zhejiangRareMonitor.enabled) {
        setZhejiangRareSpeciesMessage(`监测日期已改为 ${targetDate}，后续每小时检查会按这个日期执行。`);
      } else {
        setZhejiangRareSpeciesMessage(`已选择检查日期 ${targetDate}。`);
      }
    }
    function initZhejiangRareSpeciesMonitor() {
      if (!state2.zhejiangRareMonitor.enabled) {
        renderZhejiangRareSpeciesPanel();
        return;
      }
      startZhejiangRareMonitor({ silent: true });
    }
    async function initZhejiangRareSpeciesDailyQuery() {
      if (state2.zhejiangRareMonitor.enabled) {
        return;
      }
      if (!state2.zhejiangRareSpecies?.species?.length) {
        const saved = await saveZhejiangRareSpecies();
        if (!saved) {
          return;
        }
      }
      await checkZhejiangRareSpeciesToday({ source: "auto", notify: false });
    }
    function renderZhejiangRareSpeciesPanel() {
      const rareSpecies = state2.zhejiangRareSpecies?.species || [];
      const monitor = state2.zhejiangRareMonitor || {};
      const status = monitor.enabled ? "运行中" : "未启动";
      const targetDate = getSelectedZhejiangRareMonitorDate();
      const savedLabel = state2.zhejiangRareSpecies?.savedAt ? formatDateTime(state2.zhejiangRareSpecies.savedAt) : "尚未保存";
      const checkedLabel = monitor.lastCheckedAt ? `${formatDateTime(monitor.lastCheckedAt)}（检查 ${monitor.lastCheckedDate || targetDate}）` : "尚未检查";
      const hitLabel = monitor.lastHitAt ? formatDateTime(monitor.lastHitAt) : "所选日期暂无命中";
      const targetDateLabel = formatDate(targetDate);
      if (elements2.zhejiangRareMonitorDate && elements2.zhejiangRareMonitorDate.value !== targetDate) {
        elements2.zhejiangRareMonitorDate.value = targetDate;
      }
      elements2.zhejiangRareSpeciesSummary.textContent = [
        `名单 ${rareSpecies.length} 种`,
        `基线 ${BIRDREPORT_RARE_SPECIES_PROVINCE2} 全历史记录次数 <= ${BIRDREPORT_RARE_SPECIES_THRESHOLD2}`,
        `检查日期 ${targetDateLabel}`,
        `名单保存 ${savedLabel}`,
        `监测状态 ${status}`,
        `上次检查 ${checkedLabel}`,
        `最近命中 ${hitLabel}`
      ].join(" · ");
      elements2.toggleZhejiangRareMonitorBtn.textContent = monitor.enabled ? "停止每小时监测" : "开始每小时监测";
      renderZhejiangRareSpeciesHits(targetDateLabel, state2.zhejiangRareHits, rareSpecies.length > 0);
    }
    function renderZhejiangRareSpeciesHits(todayLabel, hits, hasBaseline) {
      elements2.zhejiangRareSpeciesContainer.innerHTML = "";
      if (!hits.length) {
        clearZhejiangRareSpeciesDetail();
        renderZhejiangRareSpeciesDetail();
        const emptyText = hasBaseline ? `${todayLabel} 暂未发现命中的浙江稀有鸟种。` : `保存浙江稀有鸟种名单后，这里会显示所选日期命中的稀有鸟种。`;
        renderEmptyState(elements2.zhejiangRareSpeciesContainer, "monitor", {
          title: hasBaseline ? "暂未命中稀有鸟种" : "等待检查稀有鸟种",
          description: emptyText
        });
        return;
      }
      hits.forEach((item) => {
        const isActive = item.key === state2.activeZhejiangRareSpeciesKey;
        const card = document.createElement("article");
        card.className = `record${isActive ? " is-active" : ""}`;
        card.innerHTML = `
      <div>
        <strong>${escapeHtml(item.taxonname || item.name || "未命名鸟种")}</strong>
        <small>${escapeHtml(item.latinname || item.englishname || "未提供学名/英文名")}</small>
      </div>
      <div>${escapeHtml(item.taxonordername || "未提供目")} · ${escapeHtml(item.taxonfamilyname || "未提供科")}</div>
      <div><small>所选日期记录次数：${escapeHtml(String(item.targetDateRecordCount ?? 0))}</small></div>
      <div><small>历史基线记录次数：${escapeHtml(String(item.baselineRecordCount ?? 0))}</small></div>
      <div><small>${isActive ? "已展开地点详情" : "点击查看观测地点"}</small></div>
    `;
        card.addEventListener("click", () => {
          toggleZhejiangRareSpeciesDetail(item);
        });
        elements2.zhejiangRareSpeciesContainer.append(card);
      });
      renderZhejiangRareSpeciesDetail();
    }
    async function saveZhejiangRareSpecies() {
      setZhejiangRareSpeciesLoading(true);
      setZhejiangRareSpeciesMessage(`正在读取本地 ${BIRDREPORT_RARE_SPECIES_PROVINCE2} 鸟种名录...`);
      try {
        let totalSpecies = 0;
        let rareSpecies = [];
        let sourceLabel = "本地 JSON";
        try {
          const baseline = await fetchZhejiangSpeciesBaselineFromJson();
          totalSpecies = baseline.totalSpecies;
          rareSpecies = baseline.rareSpecies;
        } catch (jsonError) {
          if (!canUseBirdreportProxy(setZhejiangRareSpeciesMessage)) {
            throw new Error(`读取本地浙江鸟种名录失败：${jsonError.message}`);
          }
          sourceLabel = "BirdReport 在线查询";
          setZhejiangRareSpeciesMessage(`读取本地名录失败，正在回退到 BirdReport 在线查询：${jsonError.message}`);
          const results = await fetchAllBirdreportTaxa(createBirdreportPayload({ province: BIRDREPORT_RARE_SPECIES_PROVINCE2 }), {
            onProgress: (message) => setZhejiangRareSpeciesMessage(message)
          });
          totalSpecies = results.length;
          rareSpecies = sortBirdreportTaxaByRecordCount(
            results.filter((item) => (Number(item?.recordcount) || 0) <= BIRDREPORT_RARE_SPECIES_THRESHOLD2)
          ).map(serializeBirdreportTaxon);
        }
        state2.zhejiangRareSpecies = {
          province: BIRDREPORT_RARE_SPECIES_PROVINCE2,
          threshold: BIRDREPORT_RARE_SPECIES_THRESHOLD2,
          savedAt: (/* @__PURE__ */ new Date()).toISOString(),
          totalSpecies,
          source: sourceLabel,
          species: rareSpecies
        };
        state2.zhejiangRareHits = [];
        state2.zhejiangRareNotificationLog = {};
        state2.zhejiangRareMonitor.lastHitAt = "";
        clearZhejiangRareSpeciesDetail();
        saveZhejiangRareSpeciesToStorage(state2.zhejiangRareSpecies);
        saveZhejiangRareNotificationLog(state2.zhejiangRareNotificationLog);
        saveZhejiangRareMonitor(state2.zhejiangRareMonitor);
        renderZhejiangRareSpeciesPanel();
        setZhejiangRareSpeciesMessage(`已保存 ${rareSpecies.length} 种浙江稀有鸟种，来源：${sourceLabel}。`);
        return true;
      } catch (error) {
        setZhejiangRareSpeciesMessage(`保存浙江稀有鸟种名单失败：${error.message}`, true);
        return false;
      } finally {
        setZhejiangRareSpeciesLoading(false);
      }
    }
    async function toggleZhejiangRareMonitor() {
      if (state2.zhejiangRareMonitor.enabled) {
        stopZhejiangRareMonitor();
        return;
      }
      await startZhejiangRareMonitor();
    }
    async function startZhejiangRareMonitor(options = {}) {
      if (!canUseBirdreportProxy(setZhejiangRareSpeciesMessage)) {
        return false;
      }
      const { silent = false } = options;
      state2.zhejiangRareMonitor.targetDate = getSelectedZhejiangRareMonitorDate();
      if (!state2.zhejiangRareSpecies?.species?.length) {
        if (!silent) {
          setZhejiangRareSpeciesMessage("本地还没有浙江稀有鸟种名单，先为你生成一次。");
        }
        const saved = await saveZhejiangRareSpecies();
        if (!saved) {
          return false;
        }
      }
      await ensureBrowserNotificationPermission({ prompt: !silent });
      state2.zhejiangRareMonitor.enabled = true;
      saveZhejiangRareMonitor(state2.zhejiangRareMonitor);
      scheduleZhejiangRareMonitor();
      renderZhejiangRareSpeciesPanel();
      if (!silent) {
        setZhejiangRareSpeciesMessage(`已开始每小时监测浙江 ${getSelectedZhejiangRareMonitorDate()} 的 BirdReport 数据。页面保持打开时会自动检查。`);
      }
      checkZhejiangRareSpeciesToday({ source: silent ? "resume" : "start", notify: true });
      return true;
    }
    function stopZhejiangRareMonitor() {
      if (state2.zhejiangRareMonitorTimerId) {
        window.clearInterval(state2.zhejiangRareMonitorTimerId);
        state2.zhejiangRareMonitorTimerId = null;
      }
      state2.zhejiangRareMonitor.enabled = false;
      saveZhejiangRareMonitor(state2.zhejiangRareMonitor);
      renderZhejiangRareSpeciesPanel();
      setZhejiangRareSpeciesMessage("已停止浙江稀有鸟种每小时监测。");
    }
    function scheduleZhejiangRareMonitor() {
      if (state2.zhejiangRareMonitorTimerId) {
        window.clearInterval(state2.zhejiangRareMonitorTimerId);
      }
      state2.zhejiangRareMonitorTimerId = window.setInterval(() => {
        checkZhejiangRareSpeciesToday({ source: "scheduled", notify: true });
      }, BIRDREPORT_MONITOR_INTERVAL_MS2);
    }
    async function toggleZhejiangRareSpeciesDetail(species) {
      const targetDate = getSelectedZhejiangRareMonitorDate();
      if (state2.activeZhejiangRareSpeciesKey === species.key && state2.zhejiangRareSpeciesDetailTargetDate === targetDate) {
        clearZhejiangRareSpeciesDetail();
        renderZhejiangRareSpeciesHits(formatDate(targetDate), state2.zhejiangRareHits, Boolean(state2.zhejiangRareSpecies?.species?.length));
        return;
      }
      state2.activeZhejiangRareSpeciesKey = species.key;
      state2.zhejiangRareSpeciesDetailTargetDate = targetDate;
      state2.zhejiangRareSpeciesDetailSpecies = species;
      state2.zhejiangRareSpeciesDetailRecords = [];
      state2.zhejiangRareSpeciesDetailError = "";
      state2.zhejiangRareSpeciesDetailLoading = true;
      renderZhejiangRareSpeciesHits(formatDate(targetDate), state2.zhejiangRareHits, Boolean(state2.zhejiangRareSpecies?.species?.length));
      setZhejiangRareSpeciesMessage(`正在加载 ${species.taxonname || species.name} 在 ${targetDate} 的观测地点...`);
      try {
        const records = await fetchBirdreportRecordsByTaxon(species, targetDate, {
          onProgress: (message) => setZhejiangRareSpeciesMessage(message)
        });
        state2.zhejiangRareSpeciesDetailRecords = records;
        state2.zhejiangRareSpeciesDetailError = "";
        setZhejiangRareSpeciesMessage(
          records.length ? `${species.taxonname || species.name} 在 ${targetDate} 共找到 ${records.length} 条观测记录。` : `${species.taxonname || species.name} 在 ${targetDate} 没有可展示的公开观测地点。`
        );
      } catch (error) {
        state2.zhejiangRareSpeciesDetailError = error.message;
        setZhejiangRareSpeciesMessage(`加载观测地点失败：${error.message}`, true);
      } finally {
        state2.zhejiangRareSpeciesDetailLoading = false;
        renderZhejiangRareSpeciesDetail();
      }
    }
    async function checkZhejiangRareSpeciesToday(options = {}) {
      const { source = "manual", notify = true } = options;
      if (!state2.zhejiangRareSpecies?.species?.length) {
        setZhejiangRareSpeciesMessage("请先保存浙江稀有鸟种名单。", true);
        return [];
      }
      if (!canUseBirdreportProxy(setZhejiangRareSpeciesMessage)) {
        return [];
      }
      if (state2.zhejiangRareMonitorInFlight) {
        if (source === "manual") {
          setZhejiangRareSpeciesMessage("浙江稀有鸟种检查进行中，请稍候。");
        }
        return state2.zhejiangRareHits;
      }
      state2.zhejiangRareMonitorInFlight = true;
      setZhejiangRareSpeciesLoading(true);
      const targetDate = getSelectedZhejiangRareMonitorDate();
      state2.zhejiangRareMonitor.targetDate = targetDate;
      const sourcePrefix = source === "manual" ? "正在检查" : "正在自动检查";
      setZhejiangRareSpeciesMessage(`${sourcePrefix} ${BIRDREPORT_RARE_SPECIES_PROVINCE2} ${targetDate} 的 BirdReport 数据...`);
      try {
        const results = await fetchAllBirdreportTaxa(
          createBirdreportPayload({ province: BIRDREPORT_RARE_SPECIES_PROVINCE2, startTime: targetDate, endTime: targetDate }),
          {
            onProgress: (message) => setZhejiangRareSpeciesMessage(message)
          }
        );
        const rareSpeciesMap = new Map((state2.zhejiangRareSpecies.species || []).map((item) => [item.key, item]));
        const hits = sortBirdreportTaxaByRecordCount(
          results.filter((item) => rareSpeciesMap.has(getBirdreportTaxonKey(item))).map((item) => toRareSpeciesHit(item, rareSpeciesMap.get(getBirdreportTaxonKey(item))))
        );
        state2.zhejiangRareHits = hits;
        state2.zhejiangRareMonitor.lastCheckedAt = (/* @__PURE__ */ new Date()).toISOString();
        state2.zhejiangRareMonitor.lastCheckedDate = targetDate;
        if (hits.length) {
          state2.zhejiangRareMonitor.lastHitAt = state2.zhejiangRareMonitor.lastCheckedAt;
        }
        if (!hits.some((item) => item.key === state2.activeZhejiangRareSpeciesKey) || state2.zhejiangRareSpeciesDetailTargetDate !== targetDate) {
          clearZhejiangRareSpeciesDetail();
        }
        saveZhejiangRareMonitor(state2.zhejiangRareMonitor);
        renderZhejiangRareSpeciesPanel();
        if (notify) {
          await notifyRareSpeciesHits(targetDate, hits, { prompt: source === "start" });
        }
        setZhejiangRareSpeciesMessage(
          hits.length ? `${BIRDREPORT_RARE_SPECIES_PROVINCE2} ${targetDate} 命中 ${hits.length} 种稀有鸟，已更新本地记录。` : `${BIRDREPORT_RARE_SPECIES_PROVINCE2} ${targetDate} 暂未发现命中的稀有鸟种。`
        );
        return hits;
      } catch (error) {
        setZhejiangRareSpeciesMessage(`检查浙江指定日期 BirdReport 数据失败：${error.message}`, true);
        return [];
      } finally {
        state2.zhejiangRareMonitorInFlight = false;
        setZhejiangRareSpeciesLoading(false);
      }
    }
    async function notifyRareSpeciesHits(date, hits, options = {}) {
      const { prompt = false } = options;
      if (!hits.length) {
        return;
      }
      const hasPermission = await ensureBrowserNotificationPermission({ prompt });
      if (!hasPermission) {
        return;
      }
      const notifiedKeys = new Set(state2.zhejiangRareNotificationLog[date] || []);
      const newHits = hits.filter((item) => !notifiedKeys.has(item.key));
      if (!newHits.length) {
        return;
      }
      const preview = newHits.slice(0, 3).map((item) => item.taxonname || item.name).join("、");
      const body = newHits.length === 1 ? `${preview} 出现在浙江 ${date} 的 BirdReport 结果里。` : `${preview} 等 ${newHits.length} 种稀有鸟出现在浙江 ${date} 的 BirdReport 结果里。`;
      const notification = new Notification("浙江稀有鸟种提醒", {
        body,
        tag: `zhejiang-rare-species-${date}`,
        renotify: true
      });
      notification.onclick = () => window.focus();
      state2.zhejiangRareNotificationLog[date] = [...notifiedKeys, ...newHits.map((item) => item.key)];
      saveZhejiangRareNotificationLog(state2.zhejiangRareNotificationLog);
    }
    function renderZhejiangRareSpeciesDetail() {
      const detailTarget = elements2.zhejiangRareSpeciesDetail;
      if (!detailTarget) {
        return;
      }
      const species = state2.zhejiangRareSpeciesDetailSpecies;
      if (!state2.activeZhejiangRareSpeciesKey || !species) {
        detailTarget.innerHTML = "";
        detailTarget.classList.add("is-hidden");
        elements2.zhejiangRareSpeciesDetailBackdrop?.classList.add("is-hidden");
        document.body.classList.remove("zhejiang-rare-detail-open");
        return;
      }
      const targetDate = state2.zhejiangRareSpeciesDetailTargetDate || getSelectedZhejiangRareMonitorDate();
      let content = "";
      if (state2.zhejiangRareSpeciesDetailLoading) {
        content = '<div class="empty-state">正在加载观测地点...</div>';
      } else if (state2.zhejiangRareSpeciesDetailError) {
        content = `<div class="empty-state">加载失败：${escapeHtml(state2.zhejiangRareSpeciesDetailError)}</div>`;
      } else if (!state2.zhejiangRareSpeciesDetailRecords.length) {
        content = '<div class="empty-state">当前条件下没有可展示的公开观测地点。</div>';
      } else {
        content = `
      <div class="birdreport-rare-detail-list">
        ${state2.zhejiangRareSpeciesDetailRecords.map(
          (record) => `
              <div class="birdreport-rare-detail-item">
                <strong>${escapeHtml(record.pointName || "未提供观测地点")}</strong>
                <div class="birdreport-rare-detail-meta">
                  <span>观测时间：${escapeHtml(record.startTimeLabel)} 至 ${escapeHtml(record.endTimeLabel)}</span>
                  <span>记录数量：${escapeHtml(String(record.taxonCount ?? 0))}</span>
                  <span>记录用户：${escapeHtml(record.username || "未提供")}</span>
                  <span>报告编号：${escapeHtml(record.serialId || "未提供")}</span>
                </div>
              </div>
            `
        ).join("")}
      </div>
    `;
      }
      detailTarget.innerHTML = `
    <div class="birdreport-rare-detail-header">
      <div>
        <h3 class="birdreport-rare-detail-title">${escapeHtml(species.taxonname || species.name || "未命名鸟种")} 的观测地点</h3>
        <p class="birdreport-rare-detail-subtitle">${escapeHtml(targetDate)} · ${escapeHtml(BIRDREPORT_RARE_SPECIES_PROVINCE2)} · 点击其他卡片可切换地点列表</p>
      </div>
      <button type="button" class="ghost" id="closeZhejiangRareSpeciesDetailBtn">收起详情</button>
    </div>
    ${content}
  `;
      detailTarget.classList.remove("is-hidden");
      elements2.zhejiangRareSpeciesDetailBackdrop?.classList.remove("is-hidden");
      document.body.classList.add("zhejiang-rare-detail-open");
      detailTarget.querySelector("#closeZhejiangRareSpeciesDetailBtn")?.addEventListener("click", closeZhejiangRareSpeciesDetail);
    }
    function clearZhejiangRareSpeciesDetail() {
      state2.activeZhejiangRareSpeciesKey = null;
      state2.zhejiangRareSpeciesDetailTargetDate = "";
      state2.zhejiangRareSpeciesDetailSpecies = null;
      state2.zhejiangRareSpeciesDetailRecords = [];
      state2.zhejiangRareSpeciesDetailLoading = false;
      state2.zhejiangRareSpeciesDetailError = "";
    }
    function closeZhejiangRareSpeciesDetail() {
      if (!state2.activeZhejiangRareSpeciesKey) {
        return;
      }
      clearZhejiangRareSpeciesDetail();
      renderZhejiangRareSpeciesHits(
        formatDate(getSelectedZhejiangRareMonitorDate()),
        state2.zhejiangRareHits,
        Boolean(state2.zhejiangRareSpecies?.species?.length)
      );
    }
    async function ensureBrowserNotificationPermission(options = {}) {
      const { prompt = false } = options;
      if (!("Notification" in window)) {
        setZhejiangRareSpeciesMessage("当前浏览器不支持桌面通知，仍会继续监测并在页面内显示结果。", true);
        return false;
      }
      if (Notification.permission === "granted") {
        return true;
      }
      if (Notification.permission === "denied") {
        setZhejiangRareSpeciesMessage("浏览器通知权限已被拒绝，仍会继续监测并在页面内显示结果。", true);
        return false;
      }
      if (!prompt) {
        return false;
      }
      const result = await Notification.requestPermission();
      if (result !== "granted") {
        setZhejiangRareSpeciesMessage("未开启浏览器通知权限，监测命中时只会在页面内显示。", true);
        return false;
      }
      return true;
    }
    function setZhejiangRareSpeciesLoading(isLoading) {
      elements2.saveZhejiangRareSpeciesBtn.disabled = isLoading;
      elements2.checkZhejiangRareSpeciesBtn.disabled = isLoading;
      elements2.toggleZhejiangRareMonitorBtn.disabled = isLoading;
      elements2.zhejiangRareMonitorDate.disabled = isLoading;
      elements2.saveZhejiangRareSpeciesBtn.textContent = isLoading ? "处理中..." : "保存浙江稀有鸟种名单";
      elements2.checkZhejiangRareSpeciesBtn.textContent = isLoading ? "检查中..." : "立即检查所选日期数据";
      setElementLoadingClass(elements2.saveZhejiangRareSpeciesBtn, isLoading);
      setElementLoadingClass(elements2.checkZhejiangRareSpeciesBtn, isLoading);
      setElementLoadingClass(elements2.zhejiangRareSpeciesMessage, isLoading);
    }
    function setZhejiangRareSpeciesMessage(message, isError = false) {
      setStatusMessage(elements2.zhejiangRareSpeciesMessage, message, isError);
    }
    function getSelectedZhejiangRareMonitorDate() {
      const selectedDate = normalizeDateInput(elements2.zhejiangRareMonitorDate?.value);
      return selectedDate || normalizeDateInput(state2.zhejiangRareMonitor?.targetDate) || formatIsoDate(/* @__PURE__ */ new Date());
    }
    function loadZhejiangRareSpecies2() {
      try {
        const raw = safeLocalStorageGet(BIRDREPORT_RARE_SPECIES_STORAGE2, "");
        if (!raw) {
          return {
            province: BIRDREPORT_RARE_SPECIES_PROVINCE2,
            threshold: BIRDREPORT_RARE_SPECIES_THRESHOLD2,
            savedAt: "",
            source: "",
            totalSpecies: 0,
            species: []
          };
        }
        const parsed = JSON.parse(raw);
        return {
          province: parsed?.province || BIRDREPORT_RARE_SPECIES_PROVINCE2,
          threshold: Number(parsed?.threshold) || BIRDREPORT_RARE_SPECIES_THRESHOLD2,
          savedAt: parsed?.savedAt || "",
          source: parsed?.source || "",
          totalSpecies: Number(parsed?.totalSpecies) || 0,
          species: Array.isArray(parsed?.species) ? parsed.species.map(serializeBirdreportTaxon) : []
        };
      } catch (error) {
        console.warn("Failed to load Zhejiang rare species:", error);
        return {
          province: BIRDREPORT_RARE_SPECIES_PROVINCE2,
          threshold: BIRDREPORT_RARE_SPECIES_THRESHOLD2,
          savedAt: "",
          source: "",
          totalSpecies: 0,
          species: []
        };
      }
    }
    function saveZhejiangRareSpeciesToStorage(payload) {
      safeLocalStorageSet(BIRDREPORT_RARE_SPECIES_STORAGE2, JSON.stringify(payload));
    }
    function loadZhejiangRareMonitor2() {
      try {
        const raw = safeLocalStorageGet(BIRDREPORT_RARE_MONITOR_STORAGE2, "");
        if (!raw) {
          return { enabled: false, targetDate: formatIsoDate(/* @__PURE__ */ new Date()), lastCheckedAt: "", lastCheckedDate: "", lastHitAt: "" };
        }
        const parsed = JSON.parse(raw);
        return {
          enabled: Boolean(parsed?.enabled),
          targetDate: normalizeDateInput(parsed?.targetDate) || formatIsoDate(/* @__PURE__ */ new Date()),
          lastCheckedAt: parsed?.lastCheckedAt || "",
          lastCheckedDate: parsed?.lastCheckedDate || "",
          lastHitAt: parsed?.lastHitAt || ""
        };
      } catch (error) {
        console.warn("Failed to load Zhejiang rare species monitor:", error);
        return { enabled: false, targetDate: formatIsoDate(/* @__PURE__ */ new Date()), lastCheckedAt: "", lastCheckedDate: "", lastHitAt: "" };
      }
    }
    function saveZhejiangRareMonitor(payload) {
      safeLocalStorageSet(BIRDREPORT_RARE_MONITOR_STORAGE2, JSON.stringify(payload));
    }
    function loadZhejiangRareNotificationLog2() {
      try {
        const raw = safeLocalStorageGet(BIRDREPORT_RARE_NOTIFICATION_LOG_STORAGE2, "");
        if (!raw) {
          return {};
        }
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch (error) {
        console.warn("Failed to load Zhejiang rare species notification log:", error);
        return {};
      }
    }
    function saveZhejiangRareNotificationLog(payload) {
      safeLocalStorageSet(BIRDREPORT_RARE_NOTIFICATION_LOG_STORAGE2, JSON.stringify(payload));
    }
    Object.assign(runtime2, {
      hydrateZhejiangRareMonitorInputs,
      handleZhejiangRareMonitorDateChange,
      initZhejiangRareSpeciesMonitor,
      initZhejiangRareSpeciesDailyQuery,
      renderZhejiangRareSpeciesPanel,
      renderZhejiangRareSpeciesHits,
      saveZhejiangRareSpecies,
      toggleZhejiangRareMonitor,
      startZhejiangRareMonitor,
      stopZhejiangRareMonitor,
      scheduleZhejiangRareMonitor,
      toggleZhejiangRareSpeciesDetail,
      checkZhejiangRareSpeciesToday,
      notifyRareSpeciesHits,
      renderZhejiangRareSpeciesDetail,
      clearZhejiangRareSpeciesDetail,
      closeZhejiangRareSpeciesDetail,
      ensureBrowserNotificationPermission,
      setZhejiangRareSpeciesLoading,
      setZhejiangRareSpeciesMessage,
      getSelectedZhejiangRareMonitorDate,
      loadZhejiangRareSpecies: loadZhejiangRareSpecies2,
      saveZhejiangRareSpeciesToStorage,
      loadZhejiangRareMonitor: loadZhejiangRareMonitor2,
      saveZhejiangRareMonitor,
      loadZhejiangRareNotificationLog: loadZhejiangRareNotificationLog2,
      saveZhejiangRareNotificationLog
    });
  }

  // src/script/features/bird-map.js
  function installBirdMap(runtime2) {
    const { state: state2, elements: elements2 } = runtime2;
    let initialized = false;
    let initializationPromise = null;
    let amap = null;
    let map = null;
    let cluster = null;
    let mapStatus = null;
    let activeMode = "zhejiang";
    let activeSpecies = null;
    let visiblePoints = [];
    let personalPlaces = /* @__PURE__ */ new Map();
    let refreshTimer = null;
    let requestSequence = 0;
    let fitSpeciesOnNextRefresh = false;
    async function fetchJson(url) {
      const response = await fetch(url, { headers: { accept: "application/json" } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `请求失败（${response.status}）`);
      return payload;
    }
    function setMapMessage(message, isError = false) {
      if (!elements2.birdMapMessage) return;
      elements2.birdMapMessage.textContent = message;
      elements2.birdMapMessage.classList.toggle("error", isError);
    }
    function setCanvasState(title, description, hidden = false) {
      if (!elements2.birdMapCanvasState) return;
      elements2.birdMapCanvasState.hidden = hidden;
      if (!hidden) {
        elements2.birdMapCanvasState.innerHTML = `<strong>${runtime2.escapeHtml(title)}</strong><span>${runtime2.escapeHtml(description)}</span>`;
      }
    }
    function formatDateTime(value) {
      const text = String(value || "").trim();
      if (!text) return "未知时间";
      return text.replace("T", " ").slice(0, 16);
    }
    async function loadAmap(config) {
      window._AMapSecurityConfig = {
        serviceHost: new URL(config.securityServiceHost, window.location.origin).href
      };
      if (!window.AMapLoader) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://webapi.amap.com/loader.js";
          script.async = true;
          script.onload = resolve;
          script.onerror = () => reject(new Error("高德地图加载器无法访问。"));
          document.head.append(script);
        });
      }
      const loadedAmap = await window.AMapLoader.load({
        key: config.key,
        version: "2.0",
        plugins: ["AMap.MarkerCluster", "AMap.Scale", "AMap.ToolBar"]
      });
      await ensureAmapPlugins(loadedAmap, ["AMap.MarkerCluster", "AMap.Scale", "AMap.ToolBar"]);
      return loadedAmap;
    }
    async function ensureAmapPlugins(amapNamespace, pluginNames) {
      const constructorNames = pluginNames.map((name) => name.split(".").pop());
      if (constructorNames.every((name) => typeof amapNamespace[name] === "function")) return;
      if (typeof amapNamespace.plugin !== "function") {
        throw new Error("高德地图控件插件加载失败。");
      }
      await new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error("高德地图控件插件加载超时。")), 1e4);
        amapNamespace.plugin(pluginNames, () => {
          window.clearTimeout(timeout);
          const missingPlugin = constructorNames.find((name) => typeof amapNamespace[name] !== "function");
          if (missingPlugin) {
            reject(new Error(`高德地图控件 ${missingPlugin} 加载失败。`));
            return;
          }
          resolve();
        });
      });
    }
    async function initBirdMap() {
      if (initialized) return initializationPromise;
      initialized = true;
      bindMapEvents();
      initializationPromise = (async () => {
        try {
          const [config, status] = await Promise.all([
            fetchJson("/api/map/config"),
            fetchJson("/api/map/status")
          ]);
          mapStatus = status;
          renderDatasetStatus();
          if (!status.available) {
            setCanvasState("地图数据尚未就绪", "请先生成 data/bird-map.sqlite，再重新加载页面。");
            setMapMessage("地图数据尚未生成。", true);
            return;
          }
          if (!config.enabled) {
            setCanvasState("高德地图尚未配置", "在站点环境中填写 Web JS API Key 和安全密钥后即可显示地图。");
            setMapMessage("数据已就绪，但高德地图 Key 或安全密钥尚未配置。", true);
            return;
          }
          amap = await loadAmap(config);
          map = new amap.Map("birdMapCanvas", {
            center: [120.25, 29.25],
            zoom: 7,
            viewMode: "2D",
            resizeEnable: true,
            scrollWheel: true
          });
          map.addControl(new amap.Scale());
          map.addControl(new amap.ToolBar({ position: "RB" }));
          map.on("moveend", scheduleVisiblePointRefresh);
          map.on("zoomend", scheduleVisiblePointRefresh);
          setCanvasState("", "", true);
          await refreshVisiblePoints();
        } catch (error) {
          setCanvasState("地图加载失败", error.message || "请检查网络与高德地图配置。");
          setMapMessage(`地图加载失败：${error.message}`, true);
        }
      })();
      return initializationPromise;
    }
    function bindMapEvents() {
      elements2.birdMapModeControls?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-map-mode]");
        if (button) setMapMode(button.dataset.mapMode);
      });
      elements2.birdMapSpeciesSearch?.addEventListener("input", scheduleSpeciesSearch);
      elements2.birdMapSpeciesSearch?.addEventListener("keydown", (event) => {
        if (event.key === "Escape") clearSpeciesSuggestions();
        if (event.key === "Enter") {
          event.preventDefault();
          elements2.birdMapSpeciesResults?.querySelector("button")?.click();
        }
      });
      elements2.birdMapSpeciesResults?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-taxon-id]");
        if (!button) return;
        selectSpeciesFilter({
          taxonId: button.dataset.taxonId,
          commonName: button.dataset.commonName,
          scientificName: button.dataset.scientificName || ""
        }, { fit: true });
      });
      elements2.birdMapClearSpecies?.addEventListener("click", clearSpeciesFilter);
      elements2.birdMapVisibleList?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-place-id]");
        if (button) selectPlace(button.dataset.placeId);
      });
    }
    function setMapMode(mode) {
      const nextMode = mode === "personal" ? "personal" : "zhejiang";
      if (activeMode === nextMode) return;
      activeMode = nextMode;
      activeSpecies = null;
      clearSpeciesSuggestions();
      if (elements2.birdMapSpeciesSearch) elements2.birdMapSpeciesSearch.value = "";
      updateSpeciesFilterUi();
      elements2.birdMapModeControls?.querySelectorAll("[data-map-mode]").forEach((button) => {
        const active = button.dataset.mapMode === activeMode;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      renderDatasetStatus();
      fitSpeciesOnNextRefresh = nextMode === "personal";
      refreshVisiblePoints();
    }
    function renderDatasetStatus() {
      if (!elements2.birdMapDatasetStatus) return;
      if (activeMode === "personal") {
        const coordinateCount = state2.personalRecords.filter((record) => record.lat != null && record.lng != null).length;
        elements2.birdMapDatasetStatus.textContent = `个人全国 · ${state2.personalRecords.length.toLocaleString("zh-CN")} 条记录 · ${coordinateCount.toLocaleString("zh-CN")} 条有坐标`;
        return;
      }
      if (!mapStatus?.available) {
        elements2.birdMapDatasetStatus.textContent = "浙江点位数据未就绪";
        return;
      }
      elements2.birdMapDatasetStatus.textContent = `浙江 ${mapStatus.windowStartDate} 至 ${mapStatus.windowEndDate} · ${mapStatus.placeCount.toLocaleString("zh-CN")} 个点位 · 静态快照`;
    }
    function scheduleVisiblePointRefresh() {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(refreshVisiblePoints, 260);
    }
    async function refreshVisiblePoints() {
      if (!map || !amap) return;
      const sequence = ++requestSequence;
      setMapMessage("正在加载当前地图范围内的鸟点...");
      try {
        let points;
        if (activeMode === "personal") {
          points = buildPersonalPoints();
        } else {
          const bounds = fitSpeciesOnNextRefresh ? { west: 118, south: 27, east: 123.5, north: 31.5 } : getMapBounds();
          const params = new URLSearchParams({
            west: String(bounds.west),
            south: String(bounds.south),
            east: String(bounds.east),
            north: String(bounds.north),
            limit: "10000"
          });
          if (activeSpecies?.taxonId) params.set("taxonId", activeSpecies.taxonId);
          const payload = await fetchJson(`/api/map/points?${params}`);
          points = payload.points || [];
          if (payload.truncated) setMapMessage("当前范围点位超过上限，请放大地图后查看。", true);
        }
        if (sequence !== requestSequence) return;
        visiblePoints = points;
        renderMarkers(points);
        renderVisibleList(points);
        if (fitSpeciesOnNextRefresh && points.length) fitMapToPoints(points);
        fitSpeciesOnNextRefresh = false;
        setMapMessage(points.length ? `当前范围显示 ${points.length.toLocaleString("zh-CN")} 个鸟点。` : "当前范围没有符合条件的鸟点。", false);
      } catch (error) {
        if (sequence !== requestSequence) return;
        visiblePoints = [];
        renderMarkers([]);
        renderVisibleList([]);
        setMapMessage(`鸟点加载失败：${error.message}`, true);
      }
    }
    function getMapBounds() {
      const bounds = map.getBounds();
      const southwest = bounds.getSouthWest();
      const northeast = bounds.getNorthEast();
      return { west: southwest.lng, south: southwest.lat, east: northeast.lng, north: northeast.lat };
    }
    function renderMarkers(points) {
      const data = points.map((point) => ({ lnglat: [point.longitude, point.latitude], point }));
      if (cluster?.setData) {
        cluster.setData(data);
        return;
      }
      cluster?.setMap?.(null);
      cluster = new amap.MarkerCluster(map, data, {
        gridSize: 66,
        renderMarker(context) {
          const point = context.data[0].point;
          const button = document.createElement("button");
          button.type = "button";
          button.className = "bird-map-marker";
          button.setAttribute("aria-label", `${point.name}，${point.speciesCount} 种，最近 ${formatDateTime(point.latestAt)}`);
          button.innerHTML = '<span aria-hidden="true"></span>';
          button.addEventListener("click", () => selectPlace(point.placeId));
          context.marker.setContent(button);
          context.marker.setOffset(new amap.Pixel(-14, -14));
        },
        renderClusterMarker(context) {
          const marker = document.createElement("div");
          marker.className = "bird-map-cluster";
          marker.textContent = String(context.count);
          marker.setAttribute("aria-label", `${context.count} 个聚合鸟点`);
          context.marker.setContent(marker);
          context.marker.setOffset(new amap.Pixel(-18, -18));
        }
      });
    }
    function renderVisibleList(points) {
      if (!elements2.birdMapVisibleList) return;
      if (!points.length) {
        elements2.birdMapVisibleList.innerHTML = '<div class="empty-state"><strong>当前没有鸟点</strong><span>移动或缩放地图，或清除鸟种筛选。</span></div>';
        return;
      }
      elements2.birdMapVisibleList.innerHTML = points.slice(0, 12).map((point) => `
      <button type="button" class="bird-map-place-row" data-place-id="${runtime2.escapeHtml(point.placeId)}">
        <span><strong>${runtime2.escapeHtml(point.name)}</strong><small>${runtime2.escapeHtml([point.cityName, point.districtName].filter(Boolean).join(" · ") || "个人记录")}</small></span>
        <span class="bird-map-place-meta">${Number(point.speciesCount).toLocaleString("zh-CN")} 种<small>${runtime2.escapeHtml(formatDateTime(point.speciesLastSeenAt || point.latestAt))}</small></span>
      </button>
    `).join("");
    }
    async function selectPlace(placeId) {
      const point = visiblePoints.find((item) => item.placeId === placeId);
      if (point && map) map.panTo([point.longitude, point.latitude]);
      if (activeMode === "personal") {
        renderPersonalPlaceDetail(personalPlaces.get(placeId));
        return;
      }
      if (!elements2.birdMapDetail) return;
      elements2.birdMapDetail.innerHTML = '<div class="bird-map-detail-loading" role="status">正在加载鸟点详情...</div>';
      try {
        const payload = await fetchJson(`/api/map/points/${encodeURIComponent(placeId)}`);
        renderPlaceDetail(payload.place);
      } catch (error) {
        elements2.birdMapDetail.innerHTML = `<div class="empty-state"><strong>详情加载失败</strong><span>${runtime2.escapeHtml(error.message)}</span></div>`;
      }
    }
    function renderPlaceDetail(place) {
      if (!place || !elements2.birdMapDetail) return;
      elements2.birdMapDetail.innerHTML = `
      <header class="bird-map-detail-header">
        <span class="bird-map-detail-kicker">观鸟点</span>
        <h3>${runtime2.escapeHtml(place.name)}</h3>
        <p>${runtime2.escapeHtml([place.cityName, place.districtName].filter(Boolean).join(" · "))}</p>
        <div class="bird-map-detail-stats"><span>${place.reportCount.toLocaleString("zh-CN")} 份记录</span><span>${place.speciesCount.toLocaleString("zh-CN")} 种</span><span>最近 ${runtime2.escapeHtml(formatDateTime(place.latestAt))}</span></div>
      </header>
      <section class="bird-map-detail-section" aria-labelledby="birdMapRecentRecordsTitle">
        <h4 id="birdMapRecentRecordsTitle">最近记录</h4>
        <div class="bird-map-record-list">${place.recentRecords.map(renderRecord).join("") || '<span class="hint">暂无记录</span>'}</div>
      </section>
      <section class="bird-map-detail-section" aria-labelledby="birdMapRecentSpeciesTitle">
        <h4 id="birdMapRecentSpeciesTitle">最近出现的鸟</h4>
        <div class="bird-map-species-list">${place.recentSpecies.map((species) => `<button type="button" data-detail-taxon="${runtime2.escapeHtml(species.taxonId)}" title="筛选这个鸟种"><strong>${runtime2.escapeHtml(species.commonName)}</strong><span>${runtime2.escapeHtml(formatDateTime(species.lastSeenAt))} · ${species.recordCount} 次</span></button>`).join("")}</div>
      </section>
    `;
      elements2.birdMapDetail.querySelectorAll("[data-detail-taxon]").forEach((button) => {
        button.addEventListener("click", () => selectSpeciesFilter({
          taxonId: button.dataset.detailTaxon,
          commonName: button.querySelector("strong")?.textContent || "该鸟种"
        }, { fit: true }));
      });
    }
    function renderRecord(record) {
      const names = record.species.slice(0, 16).map((species) => species.commonName).join("、");
      return `<article class="bird-map-record"><div><strong>${runtime2.escapeHtml(formatDateTime(record.observedAt))}</strong><span>${record.speciesCount} 种</span></div><p>${runtime2.escapeHtml(names)}${record.species.length > 16 ? "等" : ""}</p></article>`;
    }
    function buildPersonalPoints() {
      const groups = /* @__PURE__ */ new Map();
      const speciesFilter = activeSpecies?.commonName || "";
      for (const record of state2.personalRecords) {
        if (record.lat == null || record.lng == null) continue;
        if (speciesFilter && record.species !== speciesFilter) continue;
        const projected = wgs84ToGcj02(Number(record.lng), Number(record.lat));
        const key = `${record.location}|${projected.longitude.toFixed(4)},${projected.latitude.toFixed(4)}`;
        if (!groups.has(key)) groups.set(key, { records: [], species: /* @__PURE__ */ new Set(), projected });
        const group = groups.get(key);
        group.records.push(record);
        group.species.add(record.species);
      }
      personalPlaces = /* @__PURE__ */ new Map();
      return [...groups.entries()].map(([key, group], index) => {
        group.records.sort((left, right) => right.date.localeCompare(left.date));
        const latest = group.records[0];
        const point = {
          placeId: `personal:${index}:${key}`,
          name: latest.location,
          cityName: "",
          districtName: "",
          longitude: group.projected.longitude,
          latitude: group.projected.latitude,
          reportCount: group.records.length,
          speciesCount: group.species.size,
          latestAt: latest.date,
          speciesLastSeenAt: speciesFilter ? latest.date : null
        };
        personalPlaces.set(point.placeId, { ...point, records: group.records });
        return point;
      });
    }
    function renderPersonalPlaceDetail(place) {
      if (!elements2.birdMapDetail || !place) return;
      const species = /* @__PURE__ */ new Map();
      for (const record of place.records) {
        if (!species.has(record.species)) species.set(record.species, { name: record.species, lastSeen: record.date, count: 0 });
        species.get(record.species).count += 1;
      }
      elements2.birdMapDetail.innerHTML = `
      <header class="bird-map-detail-header"><span class="bird-map-detail-kicker">个人地点</span><h3>${runtime2.escapeHtml(place.name)}</h3><div class="bird-map-detail-stats"><span>${place.reportCount} 条记录</span><span>${place.speciesCount} 种</span><span>最近 ${runtime2.escapeHtml(formatDateTime(place.latestAt))}</span></div></header>
      <section class="bird-map-detail-section"><h4>最近记录</h4><div class="bird-map-record-list">${place.records.slice(0, 12).map((record) => `<article class="bird-map-record"><div><strong>${runtime2.escapeHtml(formatDateTime(record.date))}</strong><span>${runtime2.escapeHtml(record.species)}</span></div>${record.notes ? `<p>${runtime2.escapeHtml(record.notes)}</p>` : ""}</article>`).join("")}</div></section>
      <section class="bird-map-detail-section"><h4>这里看过的鸟</h4><div class="bird-map-species-list">${[...species.values()].map((item) => `<button type="button" data-personal-species="${runtime2.escapeHtml(item.name)}"><strong>${runtime2.escapeHtml(item.name)}</strong><span>${item.count} 次 · ${runtime2.escapeHtml(item.lastSeen)}</span></button>`).join("")}</div></section>
    `;
      elements2.birdMapDetail.querySelectorAll("[data-personal-species]").forEach((button) => {
        button.addEventListener("click", () => selectSpeciesFilter({ commonName: button.dataset.personalSpecies, taxonId: button.dataset.personalSpecies }, { fit: true }));
      });
    }
    let speciesSearchTimer = null;
    function scheduleSpeciesSearch() {
      window.clearTimeout(speciesSearchTimer);
      speciesSearchTimer = window.setTimeout(searchSpecies, 180);
    }
    async function searchSpecies() {
      const query = String(elements2.birdMapSpeciesSearch?.value || "").trim();
      if (!query) return clearSpeciesSuggestions();
      try {
        let results;
        if (activeMode === "personal") {
          results = [...new Set(state2.personalRecords.map((record) => record.species))].filter((name) => name.includes(query)).slice(0, 12).map((name) => ({ taxonId: name, commonName: name, scientificName: "", placeCount: null }));
        } else {
          results = (await fetchJson(`/api/map/species?q=${encodeURIComponent(query)}&limit=12`)).species;
        }
        renderSpeciesSuggestions(results);
      } catch (error) {
        setMapMessage(`鸟种搜索失败：${error.message}`, true);
        clearSpeciesSuggestions();
      }
    }
    function renderSpeciesSuggestions(results) {
      if (!elements2.birdMapSpeciesResults) return;
      elements2.birdMapSpeciesResults.hidden = false;
      elements2.birdMapSpeciesResults.innerHTML = results.length ? results.map((species) => `
      <button type="button" role="option" data-taxon-id="${runtime2.escapeHtml(species.taxonId)}" data-common-name="${runtime2.escapeHtml(species.commonName)}" data-scientific-name="${runtime2.escapeHtml(species.scientificName || "")}">
        <span><strong>${runtime2.escapeHtml(species.commonName)}</strong>${species.scientificName ? `<small>${runtime2.escapeHtml(species.scientificName)}</small>` : ""}</span>
        ${species.placeCount == null ? "" : `<span>${species.placeCount} 个点</span>`}
      </button>
    `).join("") : '<div class="bird-map-search-empty">没有匹配鸟种</div>';
    }
    function clearSpeciesSuggestions() {
      if (!elements2.birdMapSpeciesResults) return;
      elements2.birdMapSpeciesResults.hidden = true;
      elements2.birdMapSpeciesResults.innerHTML = "";
    }
    function selectSpeciesFilter(species, options = {}) {
      activeSpecies = species;
      if (elements2.birdMapSpeciesSearch) elements2.birdMapSpeciesSearch.value = species.commonName || "";
      clearSpeciesSuggestions();
      updateSpeciesFilterUi();
      fitSpeciesOnNextRefresh = Boolean(options.fit);
      refreshVisiblePoints();
    }
    function clearSpeciesFilter() {
      activeSpecies = null;
      if (elements2.birdMapSpeciesSearch) elements2.birdMapSpeciesSearch.value = "";
      updateSpeciesFilterUi();
      refreshVisiblePoints();
    }
    function updateSpeciesFilterUi() {
      if (!elements2.birdMapActiveSpecies || !elements2.birdMapClearSpecies) return;
      elements2.birdMapActiveSpecies.hidden = !activeSpecies;
      elements2.birdMapClearSpecies.hidden = !activeSpecies;
      elements2.birdMapActiveSpecies.textContent = activeSpecies ? `鸟种：${activeSpecies.commonName}` : "";
    }
    function fitMapToPoints(points) {
      if (!points.length || !map) return;
      const markers = points.map((point) => new amap.Marker({ position: [point.longitude, point.latitude] }));
      map.setFitView(markers, false, [64, 64, 64, 64], 14);
    }
    async function openBirdMapForSpecies(species) {
      activeMode = "zhejiang";
      elements2.birdMapModeControls?.querySelectorAll("[data-map-mode]").forEach((button) => {
        const active = button.dataset.mapMode === "zhejiang";
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      const section = document.getElementById("birdMapSection");
      runtime2.setActiveQuickNav("birdMapSection");
      runtime2.markJumpTarget(section);
      section?.scrollIntoView({ behavior: "smooth", block: "start" });
      await initBirdMap();
      const taxonId = String(species?.taxonId || species?.taxon_id || species?.taxonid || "").trim();
      const commonName = String(species?.commonName || species?.taxonname || species?.name || "该鸟种").trim();
      selectSpeciesFilter({ taxonId, commonName, scientificName: species?.latinname || "" }, { fit: true });
    }
    function wgs84ToGcj02(longitude, latitude) {
      if (longitude < 72.004 || longitude > 137.8347 || latitude < 0.8293 || latitude > 55.8271) return { longitude, latitude };
      const a = 6378245;
      const ee = 0.006693421622965943;
      const transformLat = (lng, lat) => -100 + 2 * lng + 3 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng)) + (20 * Math.sin(6 * lng * Math.PI) + 20 * Math.sin(2 * lng * Math.PI)) * 2 / 3 + (20 * Math.sin(lat * Math.PI) + 40 * Math.sin(lat / 3 * Math.PI)) * 2 / 3 + (160 * Math.sin(lat / 12 * Math.PI) + 320 * Math.sin(lat * Math.PI / 30)) * 2 / 3;
      const transformLng = (lng, lat) => 300 + lng + 2 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng)) + (20 * Math.sin(6 * lng * Math.PI) + 20 * Math.sin(2 * lng * Math.PI)) * 2 / 3 + (20 * Math.sin(lng * Math.PI) + 40 * Math.sin(lng / 3 * Math.PI)) * 2 / 3 + (150 * Math.sin(lng / 12 * Math.PI) + 300 * Math.sin(lng / 30 * Math.PI)) * 2 / 3;
      const deltaLat = transformLat(longitude - 105, latitude - 35);
      const deltaLng = transformLng(longitude - 105, latitude - 35);
      const radLat = latitude / 180 * Math.PI;
      const magic = 1 - ee * Math.sin(radLat) * Math.sin(radLat);
      return {
        longitude: longitude + deltaLng * 180 / (a / Math.sqrt(magic) * Math.cos(radLat) * Math.PI),
        latitude: latitude + deltaLat * 180 / (a * (1 - ee) / (magic * Math.sqrt(magic)) * Math.PI)
      };
    }
    Object.assign(runtime2, { initBirdMap, openBirdMapForSpecies });
  }

  // src/script/features/bird-prep/media.js
  function installBirdPrepMedia(runtime2) {
    const { BIRD_PREP_MACAULAY_MAX_TOTAL_IMAGE_BYTES: BIRD_PREP_MACAULAY_MAX_TOTAL_IMAGE_BYTES2, BIRD_PREP_IMAGE_DIMENSION_TIMEOUT_MS: BIRD_PREP_IMAGE_DIMENSION_TIMEOUT_MS2, state: state2, elements: elements2 } = runtime2;
    const birdreportProxyGetImage = (...args) => runtime2.birdreportProxyGetImage(...args);
    const birdreportProxyGetJson = (...args) => runtime2.birdreportProxyGetJson(...args);
    const getBirdPrepTaxonName = (...args) => runtime2.getBirdPrepTaxonName(...args);
    const setBirdPrepMessage = (...args) => runtime2.setBirdPrepMessage(...args);
    function shouldUseBirdPrepMacaulayImages() {
      return Boolean(elements2.birdPrepMacaulayImages?.checked);
    }
    async function loadBirdPrepMacaulayPhotos(selectedSpecies, slides, options = {}) {
      const { onProgress } = options;
      const taxaByName = /* @__PURE__ */ new Map();
      selectedSpecies.forEach((taxon) => {
        const name = getBirdPrepTaxonName(taxon);
        if (name) {
          taxaByName.set(window.BeauBirdPrepPpt.normalizeBirdName(name), taxon);
        }
      });
      const scientificNames = slides.map((slide) => {
        const taxon = taxaByName.get(window.BeauBirdPrepPpt.normalizeBirdName(slide.speciesName));
        return getBirdPrepTaxonScientificName(taxon) || String(slide?.latinName || "").trim();
      }).filter(Boolean);
      onProgress?.({
        phase: "taxonomy",
        done: 0,
        total: slides.length,
        label: "准备图片索引",
        detail: "正在匹配 eBird taxonomy 和 Macaulay 图片来源。"
      });
      const taxonomyBySciName = await loadBirdPrepMacaulayTaxonomyBySciName(scientificNames);
      let attachedCount = 0;
      let attachedImageBytes = 0;
      let missingCount = 0;
      let firstErrorMessage = "";
      for (let index = 0; index < slides.length; index += 1) {
        const slide = slides[index];
        const taxon = taxaByName.get(window.BeauBirdPrepPpt.normalizeBirdName(slide.speciesName));
        setBirdPrepMessage(`正在匹配 Macaulay 图片 ${index + 1}/${slides.length}：${slide.speciesName}`);
        onProgress?.({
          phase: "image-download",
          done: index,
          total: slides.length,
          label: "匹配/下载图片",
          detail: `正在下载图片 ${index + 1}/${slides.length}：${slide.speciesName}`
        });
        try {
          const photo = await fetchBirdPrepMacaulayPhoto(taxon, taxonomyBySciName, slide);
          if (photo) {
            const imageBytes = Number(photo.bytes?.byteLength || photo.bytes?.length) || 0;
            if (attachedImageBytes + imageBytes > BIRD_PREP_MACAULAY_MAX_TOTAL_IMAGE_BYTES2) {
              firstErrorMessage = firstErrorMessage || "Macaulay Library 图片总大小超过限制。";
              missingCount += 1;
              continue;
            }
            slide.photo = photo;
            attachedImageBytes += imageBytes;
            attachedCount += 1;
          } else {
            missingCount += 1;
          }
        } catch (error) {
          console.warn("Failed to attach Macaulay Library photo:", slide.speciesName, error);
          firstErrorMessage = firstErrorMessage || error.message;
          missingCount += 1;
        }
        onProgress?.({
          phase: "image-download",
          done: index + 1,
          total: slides.length,
          label: "匹配/下载图片",
          detail: `正在下载图片 ${index + 1}/${slides.length}：${slide.speciesName}`
        });
      }
      return { attachedCount, missingCount, firstErrorMessage, attachedImageBytes };
    }
    async function loadBirdPrepMacaulayTaxonomyBySciName(scientificNames) {
      void scientificNames;
      return /* @__PURE__ */ new Map();
    }
    async function fetchBirdPrepMacaulayPhoto(taxon, taxonomyBySciName, slide) {
      const scientificName = getBirdPrepTaxonScientificName(taxon) || String(slide?.latinName || "").trim();
      const taxonCode = getBirdPrepMacaulayTaxonCode(taxon, taxonomyBySciName, scientificName);
      const cacheKey = taxonCode || scientificName || getBirdPrepTaxonName(taxon);
      if (!cacheKey) {
        return null;
      }
      if (state2.birdPrepMacaulayPhotoCache.has(cacheKey)) {
        return state2.birdPrepMacaulayPhotoCache.get(cacheKey);
      }
      const searchPath = taxonCode ? `/api/media/macaulay/search?taxonCode=${encodeURIComponent(taxonCode)}` : `/api/media/macaulay/search?q=${encodeURIComponent(scientificName || getBirdPrepTaxonName(taxon))}`;
      const searchPayload = await birdreportProxyGetJson(searchPath);
      const media = Array.isArray(searchPayload?.results) ? searchPayload.results[0] : null;
      if (!media?.assetId && !media?.mlId) {
        state2.birdPrepMacaulayPhotoCache.set(cacheKey, null);
        return null;
      }
      const assetId = media.mlId || media.assetId;
      const image = await birdreportProxyGetImage(`/api/media/macaulay/asset/${encodeURIComponent(assetId)}`);
      const photo = {
        bytes: image.bytes,
        contentType: image.contentType,
        extension: getImageExtensionFromContentType(image.contentType),
        width: image.width,
        height: image.height,
        attribution: formatBirdPrepMacaulayAttribution(media),
        sourceUrl: media.sourceUrl || `https://macaulaylibrary.org/asset/${String(assetId).replace(/^ML/i, "")}`,
        mlId: media.mlId || `ML${String(assetId).replace(/^ML/i, "")}`
      };
      state2.birdPrepMacaulayPhotoCache.set(cacheKey, photo);
      return photo;
    }
    function getBirdPrepMacaulayTaxonCode(taxon, taxonomyBySciName, scientificName) {
      const directCode = String(taxon?.taxonCode || taxon?.speciesCode || taxon?.species_code || taxon?.ebirdCode || "").trim();
      if (directCode) {
        return directCode;
      }
      const key = normalizeScientificName(scientificName);
      return key ? String(taxonomyBySciName?.get?.(key) || "").trim() : "";
    }
    function getBirdPrepTaxonScientificName(taxon) {
      return String(taxon?.latinname || taxon?.scientificName || taxon?.sciName || "").trim();
    }
    function normalizeScientificName(value) {
      return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
    }
    async function fetchWithTimeoutAndRetry(url, init = {}, options = {}) {
      const attempts = Math.max(1, Number(options.attempts) || 1);
      const timeoutMs = Math.max(1, Number(options.timeoutMs) || 0);
      let lastError = null;
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const controller = timeoutMs && typeof AbortController === "function" ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
        try {
          const response = await fetch(url, {
            ...init,
            signal: controller?.signal || init.signal
          });
          if (response.ok || response.status < 500 || attempt === attempts) {
            return response;
          }
          lastError = new Error(`HTTP ${response.status}`);
        } catch (error) {
          lastError = error;
          if (attempt === attempts) {
            throw formatFetchTimeoutError(error, timeoutMs);
          }
        } finally {
          clearTimeout(timeoutId);
        }
      }
      throw formatFetchTimeoutError(lastError, timeoutMs);
    }
    function formatFetchTimeoutError(error, timeoutMs) {
      if (error?.name === "AbortError") {
        return new Error(`请求超时（${Math.round(timeoutMs / 1e3)} 秒）`);
      }
      return error instanceof Error ? error : new Error(String(error || "请求失败"));
    }
    function readImageDimensions(blob) {
      if (typeof Image !== "function" || !window.URL?.createObjectURL) {
        return Promise.resolve({ width: 0, height: 0 });
      }
      return new Promise((resolve) => {
        const url = URL.createObjectURL(blob);
        const image = new Image();
        let settled = false;
        let timeoutId = null;
        const finish = (dimensions) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timeoutId);
          URL.revokeObjectURL(url);
          resolve(dimensions);
        };
        timeoutId = setTimeout(() => finish({ width: 0, height: 0 }), BIRD_PREP_IMAGE_DIMENSION_TIMEOUT_MS2);
        image.onload = () => {
          finish({ width: image.naturalWidth || 0, height: image.naturalHeight || 0 });
        };
        image.onerror = () => {
          finish({ width: 0, height: 0 });
        };
        image.src = url;
      });
    }
    function getImageExtensionFromContentType(contentType) {
      if (contentType === "image/png") {
        return "png";
      }
      return "jpg";
    }
    function formatBirdPrepMacaulayAttribution(media) {
      const mlId = media?.mlId || (media?.assetId ? `ML${media.assetId}` : "");
      return [`Macaulay Library ${mlId}`.trim(), media?.attribution || "", media?.checklistId || ""].filter(Boolean).join(" · ");
    }
    Object.assign(runtime2, {
      shouldUseBirdPrepMacaulayImages,
      loadBirdPrepMacaulayPhotos,
      loadBirdPrepMacaulayTaxonomyBySciName,
      fetchBirdPrepMacaulayPhoto,
      getBirdPrepMacaulayTaxonCode,
      getBirdPrepTaxonScientificName,
      normalizeScientificName,
      fetchWithTimeoutAndRetry,
      formatFetchTimeoutError,
      readImageDimensions,
      getImageExtensionFromContentType,
      formatBirdPrepMacaulayAttribution
    });
  }

  // src/script/features/bird-prep/profiles.js
  function installBirdPrepProfiles(runtime2) {
    const { BIRD_PROFILE_SHARD_BASE_URL: BIRD_PROFILE_SHARD_BASE_URL2, BIRD_PROFILE_SHARD_INDEX_URL: BIRD_PROFILE_SHARD_INDEX_URL2, BIRD_PROFILE_SHARD_INDEX_SCRIPT_URL: BIRD_PROFILE_SHARD_INDEX_SCRIPT_URL2, BIRD_PROFILE_SHARD_INDEX_GLOBAL: BIRD_PROFILE_SHARD_INDEX_GLOBAL2, BIRD_PROFILE_SHARDS_GLOBAL: BIRD_PROFILE_SHARDS_GLOBAL2, ALL_BIRDS_FULL_DATA_URL: ALL_BIRDS_FULL_DATA_URL2, ALL_BIRDS_FULL_SCRIPT_URL: ALL_BIRDS_FULL_SCRIPT_URL2, ALL_BIRDS_FULL_GLOBAL: ALL_BIRDS_FULL_GLOBAL2, BIRD_PREP_LOGIN_EXPIRED_MESSAGE: BIRD_PREP_LOGIN_EXPIRED_MESSAGE2, state: state2 } = runtime2;
    const getBirdPrepTaxonName = (...args) => runtime2.getBirdPrepTaxonName(...args);
    async function loadBirdPrepProfileIndex() {
      if (state2.birdPrepProfileIndex) {
        return state2.birdPrepProfileIndex;
      }
      const existingIndex = buildBirdPrepProfileIndexFromEmbeddedData();
      if (existingIndex) {
        return existingIndex;
      }
      if (state2.birdPrepProfileIndexLoading) {
        return state2.birdPrepProfileIndexLoading;
      }
      state2.birdPrepProfileIndexLoading = fetch(ALL_BIRDS_FULL_DATA_URL2, { cache: "no-store" }).then(async (response) => {
        assertBirdPrepProfileResponse(response);
        return response.json();
      }).then((payload) => {
        const index = window.BeauBirdPrepPpt.buildBirdProfileIndex(payload);
        if (!index.size) {
          throw new Error("本地鸟类简介 JSON 中没有可用鸟种。");
        }
        state2.birdPrepProfileIndex = index;
        return index;
      }).catch(async (error) => {
        if (window.location.protocol !== "file:") {
          throw error;
        }
        await loadBirdPrepEmbeddedDataScript();
        const fallbackIndex = buildBirdPrepProfileIndexFromEmbeddedData();
        if (!fallbackIndex) {
          throw new Error("读取本地鸟类简介失败。请确认 all_birds_full.js 与 index.html 在同一目录后刷新页面。");
        }
        return fallbackIndex;
      }).finally(() => {
        state2.birdPrepProfileIndexLoading = null;
      });
      return state2.birdPrepProfileIndexLoading;
    }
    async function loadBirdPrepProfileIndexForSpecies(selectedSpecies) {
      if (state2.birdPrepProfileIndex) {
        return state2.birdPrepProfileIndex;
      }
      try {
        const shardIndex = await loadBirdPrepProfileIndexFromShards(selectedSpecies);
        if (shardIndex?.size) {
          return shardIndex;
        }
      } catch {
      }
      return loadBirdPrepProfileIndex();
    }
    async function loadBirdPrepProfileIndexFromShards(selectedSpecies) {
      try {
        const indexPayload2 = await loadBirdPrepProfileShardIndexFromJson();
        const profiles2 = await loadBirdPrepProfileShardsFromJson(indexPayload2, selectedSpecies);
        return getBirdPrepProfileIndexFromProfiles(profiles2);
      } catch (error) {
        if (window.location.protocol !== "file:") {
          throw error;
        }
      }
      const indexPayload = await loadBirdPrepProfileShardIndexFromScript();
      const profiles = await loadBirdPrepProfileShardsFromScripts(indexPayload, selectedSpecies);
      return getBirdPrepProfileIndexFromProfiles(profiles);
    }
    async function loadBirdPrepProfileShardIndexFromJson() {
      if (state2.birdPrepProfileShardIndex) {
        return state2.birdPrepProfileShardIndex;
      }
      if (state2.birdPrepProfileShardIndexLoading) {
        return state2.birdPrepProfileShardIndexLoading;
      }
      state2.birdPrepProfileShardIndexLoading = fetch(BIRD_PROFILE_SHARD_INDEX_URL2, { cache: "no-store" }).then(async (response) => {
        assertBirdPrepProfileResponse(response);
        return response.json();
      }).then((payload) => {
        assertBirdPrepProfileShardIndex(payload);
        state2.birdPrepProfileShardIndex = payload;
        return payload;
      }).finally(() => {
        state2.birdPrepProfileShardIndexLoading = null;
      });
      return state2.birdPrepProfileShardIndexLoading;
    }
    async function loadBirdPrepProfileShardsFromJson(indexPayload, selectedSpecies) {
      const shardFiles = getBirdPrepNeededShardFiles(indexPayload, selectedSpecies);
      const profileGroups = await Promise.all(
        shardFiles.map(async (file) => {
          if (state2.birdPrepProfileShardProfileCache.has(file)) {
            return state2.birdPrepProfileShardProfileCache.get(file);
          }
          const response = await fetch(`${BIRD_PROFILE_SHARD_BASE_URL2}${file}`, { cache: "no-store" });
          assertBirdPrepProfileResponse(response);
          const profiles = await response.json();
          if (!Array.isArray(profiles)) {
            throw new Error("鸟类简介分片格式不正确。");
          }
          state2.birdPrepProfileShardProfileCache.set(file, profiles);
          return profiles;
        })
      );
      return profileGroups.flat();
    }
    async function loadBirdPrepProfileShardIndexFromScript() {
      if (window[BIRD_PROFILE_SHARD_INDEX_GLOBAL2]) {
        const payload2 = window[BIRD_PROFILE_SHARD_INDEX_GLOBAL2];
        assertBirdPrepProfileShardIndex(payload2);
        state2.birdPrepProfileShardIndex = payload2;
        return payload2;
      }
      await loadBirdPrepProfileScript(BIRD_PROFILE_SHARD_INDEX_SCRIPT_URL2, BIRD_PROFILE_SHARD_INDEX_GLOBAL2);
      const payload = window[BIRD_PROFILE_SHARD_INDEX_GLOBAL2];
      assertBirdPrepProfileShardIndex(payload);
      state2.birdPrepProfileShardIndex = payload;
      return payload;
    }
    async function loadBirdPrepProfileShardsFromScripts(indexPayload, selectedSpecies) {
      const shardFiles = getBirdPrepNeededShardFiles(indexPayload, selectedSpecies);
      await Promise.all(
        shardFiles.map(async (file) => {
          if (state2.birdPrepProfileShardProfileCache.has(file)) {
            return;
          }
          const scriptName = getBirdPrepShardScriptName(indexPayload, file);
          await loadBirdPrepProfileScript(`${BIRD_PROFILE_SHARD_BASE_URL2}${scriptName}`, `profile-shard-${scriptName}`);
          const profiles = window[BIRD_PROFILE_SHARDS_GLOBAL2]?.[file];
          if (!Array.isArray(profiles)) {
            throw new Error("鸟类简介分片脚本格式不正确。");
          }
          state2.birdPrepProfileShardProfileCache.set(file, profiles);
        })
      );
      return shardFiles.flatMap((file) => state2.birdPrepProfileShardProfileCache.get(file) || []);
    }
    function getBirdPrepNeededShardFiles(indexPayload, selectedSpecies) {
      const names = indexPayload?.names || {};
      const files = /* @__PURE__ */ new Set();
      (Array.isArray(selectedSpecies) ? selectedSpecies : []).forEach((item) => {
        const normalizedName = window.BeauBirdPrepPpt.normalizeBirdName(getBirdPrepTaxonName(item));
        const file = names[normalizedName]?.shard;
        if (file) {
          files.add(file);
        }
      });
      return [...files].sort();
    }
    function getBirdPrepProfileIndexFromProfiles(profiles) {
      const index = window.BeauBirdPrepPpt.buildBirdProfileIndex(profiles);
      if (!index.size) {
        throw new Error("鸟类简介分片中没有匹配的鸟种。");
      }
      return index;
    }
    function getBirdPrepShardScriptName(indexPayload, file) {
      const shard = (indexPayload?.shards || []).find((entry) => entry?.file === file);
      return shard?.script || file.replace(/\.json$/i, ".js");
    }
    function assertBirdPrepProfileShardIndex(payload) {
      if (!payload || typeof payload !== "object" || !payload.names || typeof payload.names !== "object") {
        throw new Error("鸟类简介分片索引格式不正确。");
      }
    }
    function loadBirdPrepProfileScript(src, cacheKey) {
      if (state2.birdPrepProfileShardScriptLoading.has(cacheKey)) {
        return state2.birdPrepProfileShardScriptLoading.get(cacheKey);
      }
      const promise = new Promise((resolve, reject) => {
        let existingScript = document.querySelector(`script[data-bird-prep-profile-script="${cacheKey}"]`);
        if (existingScript) {
          if (existingScript.dataset.loaded === "true") {
            resolve();
            return;
          }
          if (existingScript.dataset.failed === "true") {
            existingScript.remove();
            existingScript = null;
          }
        }
        if (existingScript) {
          existingScript.addEventListener("load", resolve, { once: true });
          existingScript.addEventListener("error", () => reject(new Error("鸟类简介分片脚本加载失败。")), { once: true });
          return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.dataset.birdPrepProfileScript = cacheKey;
        script.addEventListener(
          "load",
          () => {
            script.dataset.loaded = "true";
            resolve();
          },
          { once: true }
        );
        script.addEventListener(
          "error",
          () => {
            script.dataset.failed = "true";
            reject(new Error("鸟类简介分片脚本加载失败。"));
          },
          { once: true }
        );
        document.head.append(script);
      }).finally(() => {
        state2.birdPrepProfileShardScriptLoading.delete(cacheKey);
      });
      state2.birdPrepProfileShardScriptLoading.set(cacheKey, promise);
      return promise;
    }
    function assertBirdPrepProfileResponse(response) {
      const responseUrl = String(response.url || "");
      const isLoginResponse = response.redirected || /\/login(?:[?#]|$)/.test(responseUrl);
      if (isLoginResponse) {
        throw new Error(BIRD_PREP_LOGIN_EXPIRED_MESSAGE2);
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const contentType = String(response.headers?.get?.("content-type") || "").toLowerCase();
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(BIRD_PREP_LOGIN_EXPIRED_MESSAGE2);
      }
    }
    function buildBirdPrepProfileIndexFromEmbeddedData() {
      const embeddedPayload = window[ALL_BIRDS_FULL_GLOBAL2];
      if (Array.isArray(embeddedPayload)) {
        const index = window.BeauBirdPrepPpt.buildBirdProfileIndex(embeddedPayload);
        if (!index.size) {
          throw new Error("本地鸟类简介数据中没有可用鸟种。");
        }
        state2.birdPrepProfileIndex = index;
        return index;
      }
      return null;
    }
    function loadBirdPrepEmbeddedDataScript() {
      if (Array.isArray(window[ALL_BIRDS_FULL_GLOBAL2])) {
        return Promise.resolve();
      }
      return new Promise((resolve, reject) => {
        let existingScript = document.querySelector(`script[data-bird-prep-data-script="${ALL_BIRDS_FULL_GLOBAL2}"]`);
        if (existingScript) {
          if (existingScript.dataset.loaded === "true") {
            resolve();
            return;
          }
          if (existingScript.dataset.failed === "true") {
            existingScript.remove();
            existingScript = null;
          }
        }
        if (existingScript) {
          existingScript.addEventListener("load", resolve, { once: true });
          existingScript.addEventListener("error", () => reject(new Error("鸟类简介数据脚本加载失败。")), { once: true });
          return;
        }
        const script = document.createElement("script");
        script.src = ALL_BIRDS_FULL_SCRIPT_URL2;
        script.async = true;
        script.dataset.birdPrepDataScript = ALL_BIRDS_FULL_GLOBAL2;
        script.addEventListener(
          "load",
          () => {
            script.dataset.loaded = "true";
            resolve();
          },
          { once: true }
        );
        script.addEventListener(
          "error",
          () => {
            script.dataset.failed = "true";
            reject(new Error("鸟类简介数据脚本加载失败。"));
          },
          { once: true }
        );
        document.head.append(script);
      });
    }
    Object.assign(runtime2, {
      loadBirdPrepProfileIndex,
      loadBirdPrepProfileIndexForSpecies,
      loadBirdPrepProfileIndexFromShards,
      loadBirdPrepProfileShardIndexFromJson,
      loadBirdPrepProfileShardsFromJson,
      loadBirdPrepProfileShardIndexFromScript,
      loadBirdPrepProfileShardsFromScripts,
      getBirdPrepNeededShardFiles,
      getBirdPrepProfileIndexFromProfiles,
      getBirdPrepShardScriptName,
      assertBirdPrepProfileShardIndex,
      loadBirdPrepProfileScript,
      assertBirdPrepProfileResponse,
      buildBirdPrepProfileIndexFromEmbeddedData,
      loadBirdPrepEmbeddedDataScript
    });
  }

  // src/script/features/bird-prep/workflow.js
  function installBirdPrepWorkflow(runtime2) {
    const { BIRDREPORT_CORE: BIRDREPORT_CORE2, state: state2, elements: elements2 } = runtime2;
    const canUseBirdreportProxy = (...args) => runtime2.canUseBirdreportProxy(...args);
    const createBirdreportPayload = (...args) => runtime2.createBirdreportPayload(...args);
    const fetchAllBirdreportTaxa = (...args) => runtime2.fetchAllBirdreportTaxa(...args);
    const getBirdreportTaxaArray = (...args) => runtime2.getBirdreportTaxaArray(...args);
    const getBirdreportTaxonKey = (...args) => runtime2.getBirdreportTaxonKey(...args);
    const isEmbeddedAndroidApp = (...args) => runtime2.isEmbeddedAndroidApp(...args);
    const loadBirdPrepMacaulayPhotos = (...args) => runtime2.loadBirdPrepMacaulayPhotos(...args);
    const loadBirdPrepProfileIndexForSpecies = (...args) => runtime2.loadBirdPrepProfileIndexForSpecies(...args);
    const normalizeBirdreportTaxa = (...args) => runtime2.normalizeBirdreportTaxa(...args);
    const normalizeDateInput = (...args) => runtime2.normalizeDateInput(...args);
    const renderEmptyState = (...args) => runtime2.renderEmptyState(...args);
    const setBirdPrepMessage = (...args) => runtime2.setBirdPrepMessage(...args);
    const setElementLoadingClass = (...args) => runtime2.setElementLoadingClass(...args);
    const shouldUseBirdPrepMacaulayImages = (...args) => runtime2.shouldUseBirdPrepMacaulayImages(...args);
    const sortBirdreportTaxaByRecordCountDesc = (...args) => runtime2.sortBirdreportTaxaByRecordCountDesc(...args);
    const triggerFileDownload = (...args) => runtime2.triggerFileDownload(...args);
    async function queryBirdPrepSpecies() {
      const payload = buildBirdPrepQueryPayload();
      if (!payload) {
        return;
      }
      if (!canUseBirdreportProxy(setBirdPrepMessage)) {
        return;
      }
      setBirdPrepLoading(true);
      setBirdPrepMessage("正在通过 BirdReport 查询地区鸟种...");
      state2.birdPrepSpeciesResults = [];
      state2.birdPrepSelectedSpeciesKeys.clear();
      state2.birdPrepLastQueryPayload = null;
      state2.birdPrepUnlockedFilterUsername = "";
      state2.birdPrepUnlockedFilteredCount = 0;
      state2.birdPrepUnlockedFilterWarning = "";
      renderBirdPrepSpeciesOptions();
      try {
        const username = getBirdPrepUnlockedUsername();
        let unlockedLookup = null;
        let unlockedWarning = "";
        if (username) {
          try {
            const unlockedSpecies = await getBirdPrepUnlockedSpeciesForUser(username, {
              onProgress: (message) => setBirdPrepMessage(message)
            });
            if (unlockedSpecies.length) {
              unlockedLookup = buildBirdPrepUnlockedTaxonLookup(unlockedSpecies);
              state2.birdPrepUnlockedFilterUsername = username;
            } else {
              unlockedWarning = `没有查到「${username}」的全国已解锁鸟种，当前列表未过滤。`;
            }
          } catch (filterError) {
            console.warn("Failed to filter BirdPrep species by unlocked user:", filterError);
            unlockedWarning = `记录用户「${username}」已解锁鸟种查询失败：${filterError.message}，当前列表未过滤。`;
          }
        }
        setBirdPrepMessage("正在通过 BirdReport 查询地区鸟种...");
        const results = await fetchAllBirdreportTaxa(payload, {
          onProgress: (message) => setBirdPrepMessage(message)
        });
        const filterResult = unlockedLookup ? filterBirdPrepSpeciesByUnlocked(results, unlockedLookup) : { species: results, removedCount: 0 };
        const sortedResults = sortBirdreportTaxaByRecordCountDesc(filterResult.species);
        state2.birdPrepSpeciesResults = sortedResults;
        state2.birdPrepLastQueryPayload = { ...payload };
        state2.birdPrepUnlockedFilteredCount = filterResult.removedCount;
        state2.birdPrepUnlockedFilterWarning = unlockedWarning;
        if (elements2.birdPrepSpeciesSearch) {
          elements2.birdPrepSpeciesSearch.value = "";
        }
        renderBirdPrepSpeciesOptions();
        setBirdPrepMessage(formatBirdPrepQueryCompleteMessage(payload, results.length, sortedResults.length, username, filterResult.removedCount, unlockedWarning));
      } catch (error) {
        clearBirdPrepSpeciesResults();
        setBirdPrepMessage(`地区鸟种查询失败：${error.message}`, true);
      } finally {
        setBirdPrepLoading(false);
      }
    }
    function buildBirdPrepQueryPayload() {
      const startTime = normalizeDateInput(elements2.birdPrepStartDate?.value);
      const endTime = normalizeDateInput(elements2.birdPrepEndDate?.value);
      const province = String(elements2.birdPrepProvince?.value || "").trim();
      const city = String(elements2.birdPrepCity?.value || "").trim();
      const district = String(elements2.birdPrepDistrict?.value || "").trim();
      const pointname = String(elements2.birdPrepPointName?.value || "").trim();
      if (!province) {
        setBirdPrepMessage("请先选择省份；城市、区县、观测地点和日期可以留空。", true);
        elements2.birdPrepProvince?.focus();
        return null;
      }
      if (startTime && endTime && startTime > endTime) {
        setBirdPrepMessage("开始日期不能晚于结束日期。", true);
        elements2.birdPrepStartDate?.focus();
        return null;
      }
      return createBirdreportPayload({ startTime, endTime, province, city, district, pointname });
    }
    function formatBirdPrepQuerySummary(payload) {
      const areaText = [payload.province, payload.city, payload.district].filter(Boolean).join(" / ");
      const pointText = payload.pointname ? `观测地点“${payload.pointname}”` : "";
      const dateText = [payload.startTime, payload.endTime].filter(Boolean).join(" 至 ");
      return [areaText, pointText, dateText].filter(Boolean).join(" · ") || "当前筛选条件";
    }
    function formatBirdPrepQueryCompleteMessage(payload, originalCount, filteredCount, username, removedCount, warning) {
      const queryText = formatBirdPrepQuerySummary(payload);
      if (!username) {
        return `地区鸟种查询完成：${queryText} 共 ${filteredCount} 个鸟种。`;
      }
      if (warning) {
        return `地区鸟种查询完成：${queryText} 共 ${filteredCount} 个鸟种。${warning}`;
      }
      return `地区鸟种查询完成：${queryText} 原始 ${originalCount} 个鸟种，已剔除「${username}」已解锁 ${removedCount} 种，剩余 ${filteredCount} 个。`;
    }
    function getBirdPrepUnlockedUsername() {
      return String(elements2.birdPrepUnlockedUsername?.value || "").trim();
    }
    async function fetchUserNationalBirdPrepSpecies(username, options = {}) {
      const { onProgress } = options;
      const primary = await fetchAllBirdreportTaxa(
        createBirdreportPayload({ username, mode: 1 }),
        {
          onProgress: (message) => onProgress?.(message.replace("BirdReport 鸟种", "用户全国已解锁鸟种"))
        }
      );
      if (primary.length) {
        return primary;
      }
      onProgress?.("按兼容模式重新核对记录用户全国已解锁鸟种...");
      return fetchAllBirdreportTaxa(
        createBirdreportPayload({ username }),
        {
          onProgress: (message) => onProgress?.(message.replace("BirdReport 鸟种", "用户全国已解锁鸟种"))
        }
      );
    }
    async function getBirdPrepUnlockedSpeciesForUser(username, options = {}) {
      username = String(username || "").trim();
      if (!username) {
        return [];
      }
      if (state2.birdPrepUnlockedSpeciesCache.has(username)) {
        return state2.birdPrepUnlockedSpeciesCache.get(username);
      }
      const species = normalizeBirdreportTaxa(await fetchUserNationalBirdPrepSpecies(username, options));
      state2.birdPrepUnlockedSpeciesCache.set(username, species);
      return species;
    }
    function buildBirdPrepUnlockedTaxonLookup(items) {
      const lookup = {
        keys: /* @__PURE__ */ new Set(),
        names: /* @__PURE__ */ new Set()
      };
      getBirdreportTaxaArray(items).forEach((item) => {
        const key = getBirdreportTaxonKey(item);
        const name = getBirdPrepTaxonName(item);
        if (key) {
          lookup.keys.add(key);
        }
        if (name) {
          lookup.names.add(name);
        }
      });
      return lookup;
    }
    function getBirdPrepTaxonName(item) {
      return BIRDREPORT_CORE2.getBirdreportTaxonName(item);
    }
    function filterBirdPrepSpeciesByUnlocked(species, lookup) {
      const sourceSpecies = getBirdreportTaxaArray(species);
      const filteredSpecies = sourceSpecies.filter(
        (item) => !lookup.keys.has(getBirdreportTaxonKey(item)) && !lookup.names.has(getBirdPrepTaxonName(item))
      );
      return {
        species: filteredSpecies,
        removedCount: sourceSpecies.length - filteredSpecies.length
      };
    }
    function renderBirdPrepSpeciesOptions() {
      const container = elements2.birdPrepSpeciesOptions;
      if (!container) {
        return;
      }
      const previousSelection = state2.birdPrepSelectedSpeciesKeys;
      const filter = String(elements2.birdPrepSpeciesSearch?.value || "").trim().toLowerCase();
      const species = state2.birdPrepSpeciesResults || [];
      const filtered = species.filter((item) => {
        if (!filter) {
          return true;
        }
        return [
          item.taxonname,
          item.name,
          item.latinname,
          item.englishname,
          item.taxonordername,
          item.taxonfamilyname
        ].filter(Boolean).join(" ").toLowerCase().includes(filter);
      });
      container.innerHTML = "";
      if (!species.length) {
        renderEmptyState(elements2.birdPrepSpeciesOptions, "bird-prep-picker");
      } else if (!filtered.length) {
        renderEmptyState(container, "bird-prep-picker", {
          title: "没有匹配鸟种",
          description: "换一个中文名、学名、目或科再试。"
        });
      } else {
        filtered.forEach((item) => {
          const key = getBirdreportTaxonKey(item);
          const label = document.createElement("label");
          label.className = "bird-prep-species-option";
          label.setAttribute("role", "option");
          label.setAttribute("aria-selected", previousSelection.has(key) ? "true" : "false");
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.value = key;
          checkbox.checked = previousSelection.has(key);
          checkbox.setAttribute("data-bird-prep-species-key", key);
          const text = document.createElement("span");
          text.textContent = formatBirdPrepSpeciesOption(item);
          label.append(checkbox, text);
          container.append(label);
        });
      }
      updateBirdPrepPptButton();
    }
    function handleBirdPrepSpeciesSelectionChange() {
      const container = elements2.birdPrepSpeciesOptions;
      if (!container) {
        return;
      }
      container.querySelectorAll("[data-bird-prep-species-key]").forEach((checkbox) => {
        const key = checkbox.dataset.birdPrepSpeciesKey || checkbox.value;
        if (!key) {
          return;
        }
        if (checkbox.checked) {
          state2.birdPrepSelectedSpeciesKeys.add(key);
          checkbox.closest(".bird-prep-species-option")?.setAttribute("aria-selected", "true");
        } else {
          state2.birdPrepSelectedSpeciesKeys.delete(key);
          checkbox.closest(".bird-prep-species-option")?.setAttribute("aria-selected", "false");
        }
      });
      updateBirdPrepPptButton();
    }
    function formatBirdPrepSpeciesOption(item) {
      const name = item.taxonname || item.name || "未命名鸟种";
      const latinName = item.latinname || item.englishname || "";
      const taxonomy = [item.taxonordername, item.taxonfamilyname].filter(Boolean).join(" / ");
      const count = Number(item.recordcount) || 0;
      return [name, latinName, taxonomy, `${count.toLocaleString("zh-CN")} 条记录`].filter(Boolean).join(" · ");
    }
    function getSelectedBirdPrepSpecies() {
      if (!elements2.birdPrepSpeciesOptions) {
        return [];
      }
      return (state2.birdPrepSpeciesResults || []).filter((item) => state2.birdPrepSelectedSpeciesKeys.has(getBirdreportTaxonKey(item)));
    }
    function selectAllVisibleBirdPrepSpecies() {
      const container = elements2.birdPrepSpeciesOptions;
      if (!container || !state2.birdPrepSpeciesResults.length) {
        return;
      }
      container.querySelectorAll("[data-bird-prep-species-key]").forEach((checkbox) => {
        checkbox.checked = true;
        state2.birdPrepSelectedSpeciesKeys.add(checkbox.dataset.birdPrepSpeciesKey || checkbox.value);
        checkbox.closest(".bird-prep-species-option")?.setAttribute("aria-selected", "true");
      });
      updateBirdPrepPptButton();
    }
    function clearBirdPrepSpeciesSelection() {
      const container = elements2.birdPrepSpeciesOptions;
      if (!container) {
        return;
      }
      state2.birdPrepSelectedSpeciesKeys.clear();
      container.querySelectorAll("[data-bird-prep-species-key]").forEach((checkbox) => {
        checkbox.checked = false;
        checkbox.closest(".bird-prep-species-option")?.setAttribute("aria-selected", "false");
      });
      updateBirdPrepPptButton();
    }
    function clearBirdPrepSpeciesResults() {
      state2.birdPrepSpeciesResults = [];
      state2.birdPrepSelectedSpeciesKeys.clear();
      state2.birdPrepLastQueryPayload = null;
      state2.birdPrepUnlockedFilterUsername = "";
      state2.birdPrepUnlockedFilteredCount = 0;
      state2.birdPrepUnlockedFilterWarning = "";
      if (elements2.birdPrepSpeciesSearch) {
        elements2.birdPrepSpeciesSearch.value = "";
      }
      resetBirdPrepProgress();
      renderBirdPrepSpeciesOptions();
    }
    async function generateBirdPrepPpt() {
      if (isEmbeddedAndroidApp()) {
        setBirdPrepMessage("APK 版第一版暂不支持保存 PPTX，请在网页版生成。", true);
        return;
      }
      const selectedSpecies = getSelectedBirdPrepSpecies();
      if (!selectedSpecies.length) {
        setBirdPrepMessage("请先从鸟种下拉框选择至少 1 个鸟种。", true);
        elements2.birdPrepSpeciesOptions?.focus();
        return;
      }
      if (!window.BeauBirdPrepPpt) {
        setBirdPrepMessage("PPT 生成模块未加载，请刷新页面后重试。", true);
        return;
      }
      if (shouldUseBirdPrepMacaulayImages() && !elements2.birdPrepMacaulayRights?.checked) {
        setBirdPrepMessage("请先确认 Macaulay Library 图片仅用于你有权使用的 PPT，并保留署名。", true);
        elements2.birdPrepMacaulayRights?.focus();
        return;
      }
      setBirdPrepGenerating(true);
      setBirdPrepProgress({ label: "读取鸟类简介", value: 8, detail: "正在读取所选鸟种简介。" });
      setBirdPrepMessage("正在读取鸟类简介并生成 PPT...");
      try {
        await yieldToBrowserFrame();
        const profileIndex = await loadBirdPrepProfileIndexForSpecies(selectedSpecies);
        const { slides, skippedNames } = window.BeauBirdPrepPpt.buildBirdPrepSlides(selectedSpecies, profileIndex);
        if (!slides.length) {
          const skippedText2 = skippedNames.length ? `已跳过：${skippedNames.join("、")}` : "";
          throw new Error(`所选鸟种在本地简介中都没有匹配项。${skippedText2}`);
        }
        setBirdPrepProgress({ label: "准备幻灯片", value: 22, detail: `已匹配 ${slides.length} 个鸟种简介。` });
        await yieldToBrowserFrame();
        const photoResult = shouldUseBirdPrepMacaulayImages() ? await loadBirdPrepMacaulayPhotos(selectedSpecies, slides, {
          onProgress: (progress) => {
            const total = Math.max(Number(progress.total) || slides.length || 1, 1);
            const done = Math.max(Number(progress.done) || 0, 0);
            const ratio = Math.min(done / total, 1);
            const value = progress.phase === "taxonomy" ? 28 : 30 + Math.round(ratio * 55);
            setBirdPrepProgress({
              label: progress.label || "匹配/下载图片",
              value,
              detail: progress.detail || `正在下载图片 ${done}/${total}。`
            });
          }
        }) : { attachedCount: 0, missingCount: 0 };
        if (!shouldUseBirdPrepMacaulayImages()) {
          setBirdPrepProgress({ label: "跳过图片", value: 82, detail: "未启用 Macaulay Library 图片，直接打包 PPT。" });
          await yieldToBrowserFrame();
        }
        setBirdPrepProgress({ label: "打包 PPT", value: 92, detail: "正在写入幻灯片和图片资源。" });
        await yieldToBrowserFrame();
        const bytes = window.BeauBirdPrepPpt.createBirdPrepPptx(slides, {
          title: `${formatBirdPrepQuerySummary(state2.birdPrepLastQueryPayload || {})} 鸟类预习`
        });
        const filename = window.BeauBirdPrepPpt.buildBirdPrepPptxFilename({
          province: state2.birdPrepLastQueryPayload?.province || elements2.birdPrepProvince?.value || "",
          city: state2.birdPrepLastQueryPayload?.city || elements2.birdPrepCity?.value || "",
          district: state2.birdPrepLastQueryPayload?.district || elements2.birdPrepDistrict?.value || "",
          pointname: state2.birdPrepLastQueryPayload?.pointname || elements2.birdPrepPointName?.value || ""
        });
        const blob = new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        });
        setBirdPrepProgress({ label: "触发下载", value: 98, detail: "正在准备浏览器下载。" });
        await yieldToBrowserFrame();
        const url = URL.createObjectURL(blob);
        triggerFileDownload(filename, url, () => URL.revokeObjectURL(url));
        const skippedText = skippedNames.length ? `；跳过 ${skippedNames.length} 个无简介鸟种：${skippedNames.join("、")}` : "";
        const photoText = photoResult.attachedCount ? `；已添加 ${photoResult.attachedCount} 张 Macaulay Library 图片` : shouldUseBirdPrepMacaulayImages() ? photoResult.firstErrorMessage ? `；Macaulay Library 图片全部失败：${photoResult.firstErrorMessage}` : "；没有匹配到可嵌入的 Macaulay Library 图片" : "";
        setBirdPrepProgress({ label: "已完成", value: 100, detail: `已生成 ${slides.length} 页 PPT。`, status: "complete" });
        setBirdPrepMessage(`已生成 ${slides.length} 页鸟类预习 PPT：${filename}${photoText}${skippedText}`);
      } catch (error) {
        setBirdPrepProgress({ label: "生成失败", value: Number(elements2.birdPrepProgressBar?.value) || 0, detail: error.message, status: "error" });
        setBirdPrepMessage(`生成 PPT 失败：${error.message}`, true);
      } finally {
        setBirdPrepGenerating(false);
      }
    }
    function syncBirdPrepMacaulayOptions() {
      if (!elements2.birdPrepMacaulayRights) {
        return;
      }
      const enabled = Boolean(elements2.birdPrepMacaulayImages?.checked);
      elements2.birdPrepMacaulayRights.disabled = !enabled || state2.birdPrepGenerating;
    }
    function setBirdPrepProgress({ label, value, max, detail, status } = {}) {
      const target = elements2.birdPrepProgress;
      if (!target) {
        return;
      }
      const maxValue = Number.isFinite(Number(max)) && Number(max) > 0 ? Number(max) : 100;
      const rawValue = Number.isFinite(Number(value)) ? Number(value) : 0;
      const progressValue = Math.min(Math.max(rawValue, 0), maxValue);
      const percent = Math.round(progressValue / maxValue * 100);
      target.classList.remove("is-hidden", "is-complete", "is-error");
      target.removeAttribute("aria-hidden");
      if (status === "complete") {
        target.classList.add("is-complete");
      } else if (status === "error") {
        target.classList.add("is-error");
      }
      if (elements2.birdPrepProgressBar) {
        elements2.birdPrepProgressBar.max = maxValue;
        elements2.birdPrepProgressBar.value = progressValue;
        elements2.birdPrepProgressBar.textContent = `${percent}%`;
      }
      if (elements2.birdPrepProgressLabel) {
        elements2.birdPrepProgressLabel.textContent = label || "正在生成";
      }
      if (elements2.birdPrepProgressPercent) {
        elements2.birdPrepProgressPercent.textContent = `${percent}%`;
      }
      if (elements2.birdPrepProgressDetail) {
        elements2.birdPrepProgressDetail.textContent = detail || "正在制作鸟类预习 PPT。";
      }
    }
    function resetBirdPrepProgress() {
      const target = elements2.birdPrepProgress;
      if (!target) {
        return;
      }
      target.classList.add("is-hidden");
      target.classList.remove("is-complete", "is-error");
      target.setAttribute("aria-hidden", "true");
      if (elements2.birdPrepProgressBar) {
        elements2.birdPrepProgressBar.max = 100;
        elements2.birdPrepProgressBar.value = 0;
        elements2.birdPrepProgressBar.textContent = "0%";
      }
      if (elements2.birdPrepProgressLabel) {
        elements2.birdPrepProgressLabel.textContent = "等待生成";
      }
      if (elements2.birdPrepProgressPercent) {
        elements2.birdPrepProgressPercent.textContent = "0%";
      }
      if (elements2.birdPrepProgressDetail) {
        elements2.birdPrepProgressDetail.textContent = "选择鸟种后生成 PPT。";
      }
    }
    function yieldToBrowserFrame() {
      return new Promise((resolve) => {
        if (typeof window.requestAnimationFrame === "function") {
          window.requestAnimationFrame(() => resolve());
          return;
        }
        window.setTimeout(resolve, 0);
      });
    }
    function setBirdPrepLoading(isLoading) {
      state2.birdPrepLoading = isLoading;
      if (elements2.queryBirdPrepSpeciesBtn) {
        elements2.queryBirdPrepSpeciesBtn.disabled = isLoading;
        elements2.queryBirdPrepSpeciesBtn.textContent = isLoading ? "查询中..." : "查询地区鸟种";
        setElementLoadingClass(elements2.queryBirdPrepSpeciesBtn, isLoading);
      }
      [elements2.birdPrepProvince, elements2.birdPrepCity, elements2.birdPrepDistrict, elements2.birdPrepPointName, elements2.birdPrepUnlockedUsername, elements2.birdPrepStartDate, elements2.birdPrepEndDate].forEach((element) => {
        if (element) {
          element.disabled = isLoading;
        }
      });
      [elements2.birdPrepMacaulayImages].forEach((element) => {
        if (element) {
          element.disabled = isLoading;
        }
      });
      syncBirdPrepMacaulayOptions();
      setElementLoadingClass(elements2.birdPrepMessage, isLoading);
      updateBirdPrepPptButton();
    }
    function setBirdPrepGenerating(isGenerating) {
      state2.birdPrepGenerating = isGenerating;
      if (elements2.generateBirdPrepPptBtn) {
        elements2.generateBirdPrepPptBtn.textContent = isGenerating ? "生成中..." : "生成 PPT";
        setElementLoadingClass(elements2.generateBirdPrepPptBtn, isGenerating);
      }
      syncBirdPrepMacaulayOptions();
      setElementLoadingClass(elements2.birdPrepMessage, isGenerating);
      updateBirdPrepPptButton();
    }
    function updateBirdPrepPptButton() {
      const selectedCount = getSelectedBirdPrepSpecies().length;
      const totalCount = state2.birdPrepSpeciesResults.length;
      if (elements2.generateBirdPrepPptBtn) {
        elements2.generateBirdPrepPptBtn.disabled = state2.birdPrepLoading || state2.birdPrepGenerating || !selectedCount || isEmbeddedAndroidApp();
      }
      if (elements2.selectAllBirdPrepSpeciesBtn) {
        elements2.selectAllBirdPrepSpeciesBtn.disabled = state2.birdPrepLoading || state2.birdPrepGenerating || !totalCount;
      }
      if (elements2.clearBirdPrepSpeciesBtn) {
        elements2.clearBirdPrepSpeciesBtn.disabled = state2.birdPrepLoading || state2.birdPrepGenerating || !selectedCount;
      }
      if (elements2.birdPrepSummary) {
        const visibleCount = elements2.birdPrepSpeciesOptions?.querySelectorAll("[data-bird-prep-species-key]").length || 0;
        elements2.birdPrepSummary.textContent = totalCount ? `当前地区鸟种 ${totalCount} 种，列表展示 ${visibleCount} 种，已选择 ${selectedCount} 种。` : "查询地区鸟种后，可在这里多选要生成 PPT 的鸟种。";
      }
    }
    Object.assign(runtime2, {
      queryBirdPrepSpecies,
      buildBirdPrepQueryPayload,
      formatBirdPrepQuerySummary,
      formatBirdPrepQueryCompleteMessage,
      getBirdPrepUnlockedUsername,
      fetchUserNationalBirdPrepSpecies,
      getBirdPrepUnlockedSpeciesForUser,
      buildBirdPrepUnlockedTaxonLookup,
      getBirdPrepTaxonName,
      filterBirdPrepSpeciesByUnlocked,
      renderBirdPrepSpeciesOptions,
      handleBirdPrepSpeciesSelectionChange,
      formatBirdPrepSpeciesOption,
      getSelectedBirdPrepSpecies,
      selectAllVisibleBirdPrepSpecies,
      clearBirdPrepSpeciesSelection,
      clearBirdPrepSpeciesResults,
      generateBirdPrepPpt,
      syncBirdPrepMacaulayOptions,
      setBirdPrepProgress,
      resetBirdPrepProgress,
      yieldToBrowserFrame,
      setBirdPrepLoading,
      setBirdPrepGenerating,
      updateBirdPrepPptButton
    });
  }

  // src/script/app/bootstrap.js
  function installBootstrap(runtime2) {
    const { SAMPLE_RECORDS: SAMPLE_RECORDS2, state: state2, elements: elements2 } = runtime2;
    const analyzeEbirdSeasonalPrediction = (...args) => runtime2.analyzeEbirdSeasonalPrediction(...args);
    const applyRuntimeEnvironment = (...args) => runtime2.applyRuntimeEnvironment(...args);
    const checkZhejiangRareSpeciesToday = (...args) => runtime2.checkZhejiangRareSpeciesToday(...args);
    const clearBirdPrepSpeciesResults = (...args) => runtime2.clearBirdPrepSpeciesResults(...args);
    const clearBirdPrepSpeciesSelection = (...args) => runtime2.clearBirdPrepSpeciesSelection(...args);
    const clearBirdreportSpeciesResults = (...args) => runtime2.clearBirdreportSpeciesResults(...args);
    const clearEbirdApiKey = (...args) => runtime2.clearEbirdApiKey(...args);
    const clearEbirdSeasonalCache = (...args) => runtime2.clearEbirdSeasonalCache(...args);
    const clearUnlockedSpeciesResults = (...args) => runtime2.clearUnlockedSpeciesResults(...args);
    const closeBirdreportSpeciesDetail = (...args) => runtime2.closeBirdreportSpeciesDetail(...args);
    const closeRegionQueryDetail = (...args) => runtime2.closeRegionQueryDetail(...args);
    const closeZhejiangRareSpeciesDetail = (...args) => runtime2.closeZhejiangRareSpeciesDetail(...args);
    const exportUnlockedSpeciesTable = (...args) => runtime2.exportUnlockedSpeciesTable(...args);
    const generateBirdPrepPpt = (...args) => runtime2.generateBirdPrepPpt(...args);
    const handleBirdPrepCityChange = (...args) => runtime2.handleBirdPrepCityChange(...args);
    const handleBirdPrepProvinceChange = (...args) => runtime2.handleBirdPrepProvinceChange(...args);
    const handleBirdPrepSpeciesSelectionChange = (...args) => runtime2.handleBirdPrepSpeciesSelectionChange(...args);
    const handleBirdreportCityChange = (...args) => runtime2.handleBirdreportCityChange(...args);
    const handleBirdreportProvinceChange = (...args) => runtime2.handleBirdreportProvinceChange(...args);
    const handleQuickNavClick = (...args) => runtime2.handleQuickNavClick(...args);
    const handleZhejiangRareMonitorDateChange = (...args) => runtime2.handleZhejiangRareMonitorDateChange(...args);
    const hydrateEbirdInputs = (...args) => runtime2.hydrateEbirdInputs(...args);
    const hydrateEbirdSeasonalInputs = (...args) => runtime2.hydrateEbirdSeasonalInputs(...args);
    const hydrateZhejiangRareMonitorInputs = (...args) => runtime2.hydrateZhejiangRareMonitorInputs(...args);
    const importText = (...args) => runtime2.importText(...args);
    const initBirdreportProxy = (...args) => runtime2.initBirdreportProxy(...args);
    const initEmbeddedAndroidQuickNav = (...args) => runtime2.initEmbeddedAndroidQuickNav(...args);
    const initBirdMap = (...args) => runtime2.initBirdMap(...args);
    const initZhejiangRareSpeciesDailyQuery = (...args) => runtime2.initZhejiangRareSpeciesDailyQuery(...args);
    const initZhejiangRareSpeciesMonitor = (...args) => runtime2.initZhejiangRareSpeciesMonitor(...args);
    const isEmbeddedAndroidApp = (...args) => runtime2.isEmbeddedAndroidApp(...args);
    const lockEmbeddedAndroidViewport = (...args) => runtime2.lockEmbeddedAndroidViewport(...args);
    const normalizeRecords = (...args) => runtime2.normalizeRecords(...args);
    const openBirdreportSearchPage = (...args) => runtime2.openBirdreportSearchPage(...args);
    const openBirdreportTaxonPage = (...args) => runtime2.openBirdreportTaxonPage(...args);
    const persistAndRender = (...args) => runtime2.persistAndRender(...args);
    const persistEbirdSeasonalSettings = (...args) => runtime2.persistEbirdSeasonalSettings(...args);
    const persistEbirdSettings = (...args) => runtime2.persistEbirdSettings(...args);
    const queryBirdPrepSpecies = (...args) => runtime2.queryBirdPrepSpecies(...args);
    const queryBirdreportSpeciesByProxy = (...args) => runtime2.queryBirdreportSpeciesByProxy(...args);
    const queryUnlockedSpeciesByUser = (...args) => runtime2.queryUnlockedSpeciesByUser(...args);
    const render = (...args) => runtime2.render(...args);
    const renderBirdPrepSpeciesOptions = (...args) => runtime2.renderBirdPrepSpeciesOptions(...args);
    const renderEbirdSeasonalPrediction = (...args) => runtime2.renderEbirdSeasonalPrediction(...args);
    const renderLifeList = (...args) => runtime2.renderLifeList(...args);
    const renderMap = (...args) => runtime2.renderMap(...args);
    const renderRecordsOnly = (...args) => runtime2.renderRecordsOnly(...args);
    const renderRegionQueryResults = (...args) => runtime2.renderRegionQueryResults(...args);
    const renderSpeciesDiscovery = (...args) => runtime2.renderSpeciesDiscovery(...args);
    const renderUnlockedSpeciesPanel = (...args) => runtime2.renderUnlockedSpeciesPanel(...args);
    const renderZhejiangRareSpeciesPanel = (...args) => runtime2.renderZhejiangRareSpeciesPanel(...args);
    const savePersonalRecords = (...args) => runtime2.savePersonalRecords(...args);
    const saveZhejiangRareSpecies = (...args) => runtime2.saveZhejiangRareSpecies(...args);
    const selectAllVisibleBirdPrepSpecies = (...args) => runtime2.selectAllVisibleBirdPrepSpecies(...args);
    const setBirdPrepMessage = (...args) => runtime2.setBirdPrepMessage(...args);
    const setBirdreportMessage = (...args) => runtime2.setBirdreportMessage(...args);
    const setEbirdMessage = (...args) => runtime2.setEbirdMessage(...args);
    const setEbirdSeasonalMessage = (...args) => runtime2.setEbirdSeasonalMessage(...args);
    const setMessage = (...args) => runtime2.setMessage(...args);
    const setUnlockedSpeciesMessage = (...args) => runtime2.setUnlockedSpeciesMessage(...args);
    const setZhejiangRareSpeciesMessage = (...args) => runtime2.setZhejiangRareSpeciesMessage(...args);
    const syncBirdPrepMacaulayOptions = (...args) => runtime2.syncBirdPrepMacaulayOptions(...args);
    const syncEbirdRecords = (...args) => runtime2.syncEbirdRecords(...args);
    const toggleZhejiangRareMonitor = (...args) => runtime2.toggleZhejiangRareMonitor(...args);
    const updateBirdPrepPptButton = (...args) => runtime2.updateBirdPrepPptButton(...args);
    function bootstrap() {
      applyRuntimeEnvironment();
      lockEmbeddedAndroidViewport();
      hydrateEbirdInputs();
      hydrateEbirdSeasonalInputs();
      hydrateZhejiangRareMonitorInputs();
      bindEvents();
      syncBirdPrepMacaulayOptions();
      initBirdreportProxy();
      initEmbeddedAndroidQuickNav();
      initBirdMap();
      renderRegionQueryResults();
      renderEbirdSeasonalPrediction();
      renderZhejiangRareSpeciesPanel();
      renderUnlockedSpeciesPanel();
      setEbirdMessage("填入 API 密钥和区域代码后，可以查询 eBird 区域最近观测。查询结果不会保存到个人记录。");
      setEbirdSeasonalMessage("选择目标日期后，可按浙江多年同期历史记录分析当季可能出现鸟种。");
      setBirdreportMessage("选择时间和省 / 市 / 区后，可以查询 BirdReport 鸟种。");
      setBirdPrepMessage(
        isEmbeddedAndroidApp() ? "APK 版暂不支持保存 PPTX；网页版可查询地区鸟种并生成预习 PPT。" : "选择省份和城市后查询地区鸟种，再多选鸟种生成预习 PPT。"
      );
      updateBirdPrepPptButton();
      if (elements2.birdreportUnlockedUsername && state2.unlockedTargetUsername) {
        elements2.birdreportUnlockedUsername.value = state2.unlockedTargetUsername;
      }
      setUnlockedSpeciesMessage(
        state2.unlockedTargetUsername ? `已恢复 ${state2.unlockedTargetUsername} 的未解锁鸟种缓存；重新查询会刷新记录。` : "输入记录用户姓名后，可以核对该用户在浙江名录里还缺哪些鸟种。"
      );
      if (state2.zhejiangRareMonitor.enabled) {
        setZhejiangRareSpeciesMessage("浙江稀有鸟种监测已恢复运行，页面保持打开时会继续每小时检查。");
      } else {
        setZhejiangRareSpeciesMessage("");
      }
      initZhejiangRareSpeciesMonitor();
      initZhejiangRareSpeciesDailyQuery();
    }
    function bindIfPresent(element, eventName, handler) {
      element?.addEventListener(eventName, handler);
    }
    function bindEvents() {
      bindIfPresent(elements2.importPasteBtn, "click", () => {
        importText(elements2.pasteInput.value, "粘贴内容");
      });
      bindIfPresent(elements2.loadSampleBtn, "click", () => {
        state2.personalRecords = normalizeRecords(SAMPLE_RECORDS2);
        persistAndRender();
        setMessage(`已加载 ${state2.personalRecords.length} 条示例记录。`);
      });
      bindIfPresent(elements2.clearAllBtn, "click", () => {
        state2.personalRecords = [];
        savePersonalRecords(state2.personalRecords);
        render();
        setMessage("已清空全部个人记录。");
      });
      bindIfPresent(elements2.fileInput, "change", async (event) => {
        const [file] = event.target.files || [];
        if (!file) {
          return;
        }
        try {
          const text = await file.text();
          importText(text, `文件 ${file.name}`);
        } catch (error) {
          setMessage(`读取文件失败：${error.message}`, true);
        } finally {
          elements2.fileInput.value = "";
        }
      });
      bindIfPresent(elements2.syncEbirdBtn, "click", syncEbirdRecords);
      bindIfPresent(elements2.clearEbirdKeyBtn, "click", clearEbirdApiKey);
      bindIfPresent(elements2.ebirdApiKey, "change", persistEbirdSettings);
      bindIfPresent(elements2.ebirdRegionCode, "change", persistEbirdSettings);
      bindIfPresent(elements2.ebirdBackDays, "change", persistEbirdSettings);
      bindIfPresent(elements2.analyzeEbirdSeasonalBtn, "click", analyzeEbirdSeasonalPrediction);
      bindIfPresent(elements2.clearEbirdSeasonalCacheBtn, "click", clearEbirdSeasonalCache);
      bindIfPresent(elements2.ebirdSeasonalDate, "change", persistEbirdSeasonalSettings);
      bindIfPresent(elements2.ebirdSeasonalYears, "change", persistEbirdSeasonalSettings);
      bindIfPresent(elements2.ebirdSeasonalWindow, "change", persistEbirdSeasonalSettings);
      bindIfPresent(elements2.birdreportStartDate, "change", clearBirdreportSpeciesResults);
      bindIfPresent(elements2.birdreportEndDate, "change", clearBirdreportSpeciesResults);
      bindIfPresent(elements2.birdreportProvince, "change", handleBirdreportProvinceChange);
      bindIfPresent(elements2.birdreportCity, "change", handleBirdreportCityChange);
      bindIfPresent(elements2.birdreportDistrict, "change", clearBirdreportSpeciesResults);
      bindIfPresent(elements2.birdreportPointName, "input", clearBirdreportSpeciesResults);
      bindIfPresent(elements2.queryBirdreportProxyBtn, "click", queryBirdreportSpeciesByProxy);
      bindIfPresent(elements2.openBirdreportTaxonBtn, "click", openBirdreportTaxonPage);
      bindIfPresent(elements2.openBirdreportSearchBtn, "click", openBirdreportSearchPage);
      bindIfPresent(elements2.queryUnlockedSpeciesBtn, "click", queryUnlockedSpeciesByUser);
      bindIfPresent(elements2.exportUnlockedSpeciesBtn, "click", exportUnlockedSpeciesTable);
      bindIfPresent(elements2.clearUnlockedSpeciesBtn, "click", clearUnlockedSpeciesResults);
      bindIfPresent(elements2.birdreportUnlockedUsername, "keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          queryUnlockedSpeciesByUser();
        }
      });
      bindIfPresent(elements2.saveZhejiangRareSpeciesBtn, "click", saveZhejiangRareSpecies);
      bindIfPresent(elements2.checkZhejiangRareSpeciesBtn, "click", () => {
        checkZhejiangRareSpeciesToday({ source: "manual", notify: true });
      });
      bindIfPresent(elements2.toggleZhejiangRareMonitorBtn, "click", toggleZhejiangRareMonitor);
      bindIfPresent(elements2.zhejiangRareMonitorDate, "change", handleZhejiangRareMonitorDateChange);
      bindIfPresent(elements2.speciesFilter, "change", renderRecordsOnly);
      bindIfPresent(elements2.sortOrder, "change", renderRecordsOnly);
      bindIfPresent(elements2.viewMode, "change", renderRecordsOnly);
      bindIfPresent(elements2.lifeRegionFilter, "input", renderLifeList);
      bindIfPresent(elements2.lifeBackDays, "input", renderLifeList);
      bindIfPresent(elements2.speciesDiscoveryRegion, "input", renderSpeciesDiscovery);
      bindIfPresent(elements2.speciesDiscoveryStart, "change", renderSpeciesDiscovery);
      bindIfPresent(elements2.speciesDiscoveryEnd, "change", renderSpeciesDiscovery);
      bindIfPresent(elements2.heatMetric, "change", renderMap);
      bindIfPresent(elements2.regionQueryBackdrop, "click", closeRegionQueryDetail);
      bindIfPresent(elements2.birdreportSpeciesDetailBackdrop, "click", closeBirdreportSpeciesDetail);
      bindIfPresent(elements2.zhejiangRareSpeciesDetailBackdrop, "click", closeZhejiangRareSpeciesDetail);
      bindIfPresent(elements2.birdPrepProvince, "change", handleBirdPrepProvinceChange);
      bindIfPresent(elements2.birdPrepCity, "change", handleBirdPrepCityChange);
      bindIfPresent(elements2.birdPrepDistrict, "change", clearBirdPrepSpeciesResults);
      bindIfPresent(elements2.birdPrepPointName, "input", clearBirdPrepSpeciesResults);
      bindIfPresent(elements2.birdPrepUnlockedUsername, "input", clearBirdPrepSpeciesResults);
      bindIfPresent(elements2.birdPrepStartDate, "change", clearBirdPrepSpeciesResults);
      bindIfPresent(elements2.birdPrepEndDate, "change", clearBirdPrepSpeciesResults);
      bindIfPresent(elements2.birdPrepMacaulayImages, "change", syncBirdPrepMacaulayOptions);
      bindIfPresent(elements2.queryBirdPrepSpeciesBtn, "click", queryBirdPrepSpecies);
      bindIfPresent(elements2.birdPrepSpeciesSearch, "input", renderBirdPrepSpeciesOptions);
      bindIfPresent(elements2.birdPrepSpeciesOptions, "change", handleBirdPrepSpeciesSelectionChange);
      bindIfPresent(elements2.selectAllBirdPrepSpeciesBtn, "click", selectAllVisibleBirdPrepSpecies);
      bindIfPresent(elements2.clearBirdPrepSpeciesBtn, "click", clearBirdPrepSpeciesSelection);
      bindIfPresent(elements2.generateBirdPrepPptBtn, "click", generateBirdPrepPpt);
      document.addEventListener("keydown", handleRegionQueryDetailHotkeys);
      document.querySelectorAll(".app-quicknav-btn").forEach((button) => {
        button.addEventListener("click", handleQuickNavClick);
      });
    }
    function handleRegionQueryDetailHotkeys(event) {
      if (event.key !== "Escape") {
        return;
      }
      if (state2.activeRegionRecordId) {
        closeRegionQueryDetail();
      }
      if (state2.activeBirdreportSpeciesKey) {
        closeBirdreportSpeciesDetail();
      }
      if (state2.activeZhejiangRareSpeciesKey) {
        closeZhejiangRareSpeciesDetail();
      }
      if (state2.activeEbirdSeasonalSpeciesCode) {
        state2.activeEbirdSeasonalSpeciesCode = "";
        renderEbirdSeasonalPrediction();
      }
    }
    Object.assign(runtime2, {
      bootstrap,
      bindIfPresent,
      bindEvents,
      handleRegionQueryDetailHotkeys
    });
  }

  // src/script/main.js
  var runtime = { ...config_exports };
  var stateTarget = null;
  var elementsTarget = null;
  function createDeferredObjectRef(label, getTarget) {
    return new Proxy({}, {
      get(_target, property) {
        const target = getTarget();
        if (!target) throw new Error(`${label} was accessed before initialization.`);
        return Reflect.get(target, property, target);
      },
      set(_target, property, value) {
        const target = getTarget();
        if (!target) throw new Error(`${label} was mutated before initialization.`);
        return Reflect.set(target, property, value, target);
      },
      has(_target, property) {
        return getTarget() ? property in getTarget() : false;
      },
      ownKeys() {
        return getTarget() ? Reflect.ownKeys(getTarget()) : [];
      },
      getOwnPropertyDescriptor(_target, property) {
        const target = getTarget();
        return target ? Object.getOwnPropertyDescriptor(target, property) : void 0;
      }
    });
  }
  var stateRef = createDeferredObjectRef("state", () => stateTarget);
  var elementsRef = createDeferredObjectRef("elements", () => elementsTarget);
  var emptyStateCopyRef = {};
  Object.assign(runtime, { state: stateRef, elements: elementsRef, EMPTY_STATE_COPY: emptyStateCopyRef });
  installStorage(runtime);
  installSharedUtils(runtime);
  installSharedUi(runtime);
  installDownloads(runtime);
  installRuntime(runtime);
  installRecords(runtime);
  installEbirdRecent(runtime);
  installEbirdSeasonal(runtime);
  installBirdreportDomain(runtime);
  installBirdreportClient(runtime);
  installBirdreportRegions(runtime);
  installBirdreportQuery(runtime);
  installUnlockedSpecies(runtime);
  installRareMonitor(runtime);
  installBirdMap(runtime);
  installBirdPrepMedia(runtime);
  installBirdPrepProfiles(runtime);
  installBirdPrepWorkflow(runtime);
  installBootstrap(runtime);
  var { loadPersonalRecords, loadUnlockedSpeciesCache, loadZhejiangRareSpecies, loadZhejiangRareMonitor, loadZhejiangRareNotificationLog } = runtime;
  var unlockedSpeciesCache = loadUnlockedSpeciesCache();
  var state = {
    personalRecords: loadPersonalRecords(),
    regionQueryRecords: [],
    activeRegionRecordId: null,
    ebirdSeasonalResults: [],
    ebirdSeasonalMeta: null,
    activeEbirdSeasonalSpeciesCode: "",
    birdreportLastQueryPayload: null,
    birdreportLastResults: [],
    activeBirdreportSpeciesKey: null,
    birdreportSpeciesDetailSpecies: null,
    birdreportSpeciesDetailRecords: [],
    birdreportSpeciesDetailLoading: false,
    birdreportSpeciesDetailError: "",
    birdreportSpeciesCaptchaImageUrl: "",
    birdreportSpeciesCaptchaLoading: false,
    birdreportSpeciesCaptchaError: "",
    map: null,
    heatLayer: null,
    expandedTaxa: /* @__PURE__ */ new Set(),
    migrationSummary: { changed: 0 },
    zhejiangRareSpecies: loadZhejiangRareSpecies(),
    zhejiangRareMonitor: loadZhejiangRareMonitor(),
    zhejiangRareNotificationLog: loadZhejiangRareNotificationLog(),
    zhejiangRareHits: [],
    activeZhejiangRareSpeciesKey: null,
    zhejiangRareSpeciesDetailTargetDate: "",
    zhejiangRareSpeciesDetailSpecies: null,
    zhejiangRareSpeciesDetailRecords: [],
    zhejiangRareSpeciesDetailLoading: false,
    zhejiangRareSpeciesDetailError: "",
    zhejiangRareMonitorTimerId: null,
    zhejiangRareMonitorInFlight: false,
    unlockedSpeciesCatalog: unlockedSpeciesCache.catalog,
    unlockedObservedSpecies: unlockedSpeciesCache.observed,
    unlockedMissingSpecies: unlockedSpeciesCache.missing,
    unlockedTargetUsername: unlockedSpeciesCache.username,
    unlockedSpeciesCacheSavedAt: unlockedSpeciesCache.savedAt,
    unlockedSpeciesShowMeta: false,
    unlockedSpeciesTableVisible: true,
    activeUnlockedSpeciesKey: null,
    unlockedSpeciesDetailRecords: [],
    unlockedSpeciesDetailLoading: false,
    unlockedSpeciesDetailError: "",
    unlockedSpeciesCaptchaImageUrl: "",
    unlockedSpeciesCaptchaLoading: false,
    unlockedSpeciesCaptchaError: "",
    birdPrepLastQueryPayload: null,
    birdPrepSpeciesResults: [],
    birdPrepSelectedSpeciesKeys: /* @__PURE__ */ new Set(),
    birdPrepUnlockedSpeciesCache: /* @__PURE__ */ new Map(),
    birdPrepUnlockedFilterUsername: "",
    birdPrepUnlockedFilteredCount: 0,
    birdPrepUnlockedFilterWarning: "",
    birdPrepProfileIndex: null,
    birdPrepProfileIndexLoading: null,
    birdPrepProfileShardIndex: null,
    birdPrepProfileShardIndexLoading: null,
    birdPrepProfileShardProfileCache: /* @__PURE__ */ new Map(),
    birdPrepProfileShardScriptLoading: /* @__PURE__ */ new Map(),
    birdPrepMacaulayPhotoCache: /* @__PURE__ */ new Map(),
    birdPrepMacaulayTaxonomyBySciName: null,
    birdPrepMacaulayTaxonomyLoading: null,
    birdPrepLoading: false,
    birdPrepGenerating: false
  };
  var elements = {
    fileInput: document.querySelector("#fileInput"),
    pasteInput: document.querySelector("#pasteInput"),
    importPasteBtn: document.querySelector("#importPasteBtn"),
    loadSampleBtn: document.querySelector("#loadSampleBtn"),
    clearAllBtn: document.querySelector("#clearAllBtn"),
    importMessage: document.querySelector("#importMessage"),
    ebirdApiKey: document.querySelector("#ebirdApiKey"),
    ebirdRegionCode: document.querySelector("#ebirdRegionCode"),
    ebirdBackDays: document.querySelector("#ebirdBackDays"),
    syncEbirdBtn: document.querySelector("#syncEbirdBtn"),
    clearEbirdKeyBtn: document.querySelector("#clearEbirdKeyBtn"),
    ebirdMessage: document.querySelector("#ebirdMessage"),
    regionQuerySummary: document.querySelector("#regionQuerySummary"),
    regionQueryContainer: document.querySelector("#regionQueryContainer"),
    regionQueryBackdrop: document.querySelector("#regionQueryBackdrop"),
    regionQueryDetail: document.querySelector("#regionQueryDetail"),
    ebirdSeasonalDate: document.querySelector("#ebirdSeasonalDate"),
    ebirdSeasonalYears: document.querySelector("#ebirdSeasonalYears"),
    ebirdSeasonalWindow: document.querySelector("#ebirdSeasonalWindow"),
    analyzeEbirdSeasonalBtn: document.querySelector("#analyzeEbirdSeasonalBtn"),
    clearEbirdSeasonalCacheBtn: document.querySelector("#clearEbirdSeasonalCacheBtn"),
    ebirdSeasonalMessage: document.querySelector("#ebirdSeasonalMessage"),
    ebirdSeasonalSummary: document.querySelector("#ebirdSeasonalSummary"),
    ebirdSeasonalContainer: document.querySelector("#ebirdSeasonalContainer"),
    birdreportStartDate: document.querySelector("#birdreportStartDate"),
    birdreportEndDate: document.querySelector("#birdreportEndDate"),
    birdreportProvince: document.querySelector("#birdreportProvince"),
    birdreportCity: document.querySelector("#birdreportCity"),
    birdreportDistrict: document.querySelector("#birdreportDistrict"),
    birdreportPointName: document.querySelector("#birdreportPointName"),
    queryBirdreportProxyBtn: document.querySelector("#queryBirdreportProxyBtn"),
    openBirdreportTaxonBtn: document.querySelector("#openBirdreportTaxonBtn"),
    openBirdreportSearchBtn: document.querySelector("#openBirdreportSearchBtn"),
    birdreportMessage: document.querySelector("#birdreportMessage"),
    birdreportSpeciesSummary: document.querySelector("#birdreportSpeciesSummary"),
    birdreportSpeciesContainer: document.querySelector("#birdreportSpeciesContainer"),
    birdreportSpeciesDetailBackdrop: document.querySelector("#birdreportSpeciesDetailBackdrop"),
    birdreportSpeciesDetail: document.querySelector("#birdreportSpeciesDetail"),
    birdPrepProvince: document.querySelector("#birdPrepProvince"),
    birdPrepCity: document.querySelector("#birdPrepCity"),
    birdPrepDistrict: document.querySelector("#birdPrepDistrict"),
    birdPrepPointName: document.querySelector("#birdPrepPointName"),
    birdPrepUnlockedUsername: document.querySelector("#birdPrepUnlockedUsername"),
    birdPrepStartDate: document.querySelector("#birdPrepStartDate"),
    birdPrepEndDate: document.querySelector("#birdPrepEndDate"),
    birdPrepMacaulayImages: document.querySelector("#birdPrepMacaulayImages"),
    birdPrepMacaulayRights: document.querySelector("#birdPrepMacaulayRights"),
    queryBirdPrepSpeciesBtn: document.querySelector("#queryBirdPrepSpeciesBtn"),
    selectAllBirdPrepSpeciesBtn: document.querySelector("#selectAllBirdPrepSpeciesBtn"),
    clearBirdPrepSpeciesBtn: document.querySelector("#clearBirdPrepSpeciesBtn"),
    generateBirdPrepPptBtn: document.querySelector("#generateBirdPrepPptBtn"),
    birdPrepSpeciesSearch: document.querySelector("#birdPrepSpeciesSearch"),
    birdPrepSpeciesOptions: document.querySelector("#birdPrepSpeciesOptions"),
    birdPrepMessage: document.querySelector("#birdPrepMessage"),
    birdPrepProgress: document.querySelector("#birdPrepProgress"),
    birdPrepProgressBar: document.querySelector("#birdPrepProgressBar"),
    birdPrepProgressLabel: document.querySelector("#birdPrepProgressLabel"),
    birdPrepProgressPercent: document.querySelector("#birdPrepProgressPercent"),
    birdPrepProgressDetail: document.querySelector("#birdPrepProgressDetail"),
    birdPrepSummary: document.querySelector("#birdPrepSummary"),
    birdreportUnlockedUsername: document.querySelector("#birdreportUnlockedUsername"),
    queryUnlockedSpeciesBtn: document.querySelector("#queryUnlockedSpeciesBtn"),
    exportUnlockedSpeciesBtn: document.querySelector("#exportUnlockedSpeciesBtn"),
    clearUnlockedSpeciesBtn: document.querySelector("#clearUnlockedSpeciesBtn"),
    unlockedSpeciesMessage: document.querySelector("#unlockedSpeciesMessage"),
    unlockedSpeciesSummary: document.querySelector("#unlockedSpeciesSummary"),
    unlockedSpeciesContainer: document.querySelector("#unlockedSpeciesContainer"),
    saveZhejiangRareSpeciesBtn: document.querySelector("#saveZhejiangRareSpeciesBtn"),
    checkZhejiangRareSpeciesBtn: document.querySelector("#checkZhejiangRareSpeciesBtn"),
    toggleZhejiangRareMonitorBtn: document.querySelector("#toggleZhejiangRareMonitorBtn"),
    zhejiangRareMonitorDate: document.querySelector("#zhejiangRareMonitorDate"),
    zhejiangRareSpeciesMessage: document.querySelector("#zhejiangRareSpeciesMessage"),
    zhejiangRareSpeciesSummary: document.querySelector("#zhejiangRareSpeciesSummary"),
    zhejiangRareSpeciesContainer: document.querySelector("#zhejiangRareSpeciesContainer"),
    zhejiangRareSpeciesDetailBackdrop: document.querySelector("#zhejiangRareSpeciesDetailBackdrop"),
    zhejiangRareSpeciesDetail: document.querySelector("#zhejiangRareSpeciesDetail"),
    speciesFilter: document.querySelector("#speciesFilter"),
    sortOrder: document.querySelector("#sortOrder"),
    viewMode: document.querySelector("#viewMode"),
    lifeRegionFilter: document.querySelector("#lifeRegionFilter"),
    lifeBackDays: document.querySelector("#lifeBackDays"),
    speciesDiscoveryRegion: document.querySelector("#speciesDiscoveryRegion"),
    speciesDiscoveryStart: document.querySelector("#speciesDiscoveryStart"),
    speciesDiscoveryEnd: document.querySelector("#speciesDiscoveryEnd"),
    heatMetric: document.querySelector("#heatMetric"),
    statsSummary: document.querySelector("#statsSummary"),
    taxonomyBrowser: document.querySelector("#taxonomyBrowser"),
    recordsContainer: document.querySelector("#recordsContainer"),
    lifeSummary: document.querySelector("#lifeSummary"),
    lifeListContainer: document.querySelector("#lifeListContainer"),
    speciesDiscoverySummary: document.querySelector("#speciesDiscoverySummary"),
    speciesDiscoveryContainer: document.querySelector("#speciesDiscoveryContainer"),
    calendarLegend: document.querySelector("#calendarLegend"),
    calendarHeatmap: document.querySelector("#calendarHeatmap"),
    birdMapModeControls: document.querySelector("#birdMapModeControls"),
    birdMapDatasetStatus: document.querySelector("#birdMapDatasetStatus"),
    birdMapSpeciesSearch: document.querySelector("#birdMapSpeciesSearch"),
    birdMapSpeciesResults: document.querySelector("#birdMapSpeciesResults"),
    birdMapActiveSpecies: document.querySelector("#birdMapActiveSpecies"),
    birdMapClearSpecies: document.querySelector("#birdMapClearSpecies"),
    birdMapMessage: document.querySelector("#birdMapMessage"),
    birdMapCanvas: document.querySelector("#birdMapCanvas"),
    birdMapCanvasState: document.querySelector("#birdMapCanvasState"),
    birdMapVisibleList: document.querySelector("#birdMapVisibleList"),
    birdMapDetail: document.querySelector("#birdMapDetail")
  };
  var EMPTY_STATE_COPY = {
    monitor: {
      title: "等待检查稀有鸟种",
      description: "保存基线名单或立即检查所选日期后，命中结果会显示在这里。"
    },
    unlocked: {
      title: "等待查询记录用户",
      description: "输入记录中心用户名后，会显示浙江名录中还未解锁的鸟种。"
    },
    "bird-prep-picker": {
      title: "等待地区鸟种",
      description: "选择地区和日期后查询，再多选要生成 PPT 的鸟种。"
    },
    "ebird-region": {
      title: "等待 eBird 区域记录",
      description: "填入 API Key、区域代码和回溯天数后，最近观测会显示在这里。"
    },
    "ebird-seasonal": {
      title: "等待当季分析",
      description: "选择目标日期并开始分析后，会列出浙江当季候选鸟种。"
    },
    birdreport: {
      title: "等待 BirdReport 查询",
      description: "选择时间和地区后，符合条件的鸟种结果会显示在这里。"
    }
  };
  stateTarget = state;
  elementsTarget = elements;
  Object.assign(emptyStateCopyRef, EMPTY_STATE_COPY);
  Object.assign(runtime, { state, elements, EMPTY_STATE_COPY });
  var LEGACY_GLOBAL_DATA_NAMES = Object.freeze([
    "STORAGE_KEY",
    "PERSONAL_STORAGE_KEY",
    "LEGACY_STORAGE_KEY",
    "EBIRD_API_KEY_STORAGE",
    "EBIRD_REGION_STORAGE",
    "EBIRD_BACK_STORAGE",
    "EBIRD_SPECIES_LOCALE",
    "EBIRD_SEASONAL_CACHE_STORAGE",
    "EBIRD_SEASONAL_SETTINGS_STORAGE",
    "EBIRD_SEASONAL_REGION_CODE",
    "EBIRD_SEASONAL_DEFAULT_YEARS",
    "EBIRD_SEASONAL_DEFAULT_WINDOW_DAYS",
    "EBIRD_SEASONAL_CACHE_TTL_MS",
    "EBIRD_SEASONAL_CONCURRENCY",
    "BIRDREPORT_RARE_SPECIES_STORAGE",
    "BIRDREPORT_RARE_MONITOR_STORAGE",
    "BIRDREPORT_RARE_NOTIFICATION_LOG_STORAGE",
    "BIRDREPORT_UNLOCKED_SPECIES_CACHE_STORAGE",
    "BIRDREPORT_SEARCH_PAGE_URL",
    "BIRDREPORT_TAXON_PAGE_URL",
    "BIRDREPORT_ZHEJIANG_SPECIES_DATA_URL",
    "BIRDREPORT_ZHEJIANG_SPECIES_GLOBAL",
    "BIRD_PROFILE_SHARD_BASE_URL",
    "BIRD_PROFILE_SHARD_INDEX_URL",
    "BIRD_PROFILE_SHARD_INDEX_SCRIPT_URL",
    "BIRD_PROFILE_SHARD_INDEX_GLOBAL",
    "BIRD_PROFILE_SHARDS_GLOBAL",
    "ALL_BIRDS_FULL_DATA_URL",
    "ALL_BIRDS_FULL_SCRIPT_URL",
    "ALL_BIRDS_FULL_GLOBAL",
    "BIRD_PREP_LOGIN_EXPIRED_MESSAGE",
    "BIRD_PREP_MACAULAY_MAX_IMAGE_BYTES",
    "BIRD_PREP_MACAULAY_MAX_TOTAL_IMAGE_BYTES",
    "BIRD_PREP_MACAULAY_FETCH_TIMEOUT_MS",
    "BIRD_PREP_MACAULAY_FETCH_ATTEMPTS",
    "BIRD_PREP_IMAGE_DIMENSION_TIMEOUT_MS",
    "BIRDREPORT_CORE",
    "BIRDREPORT_VERSION",
    "ANDROID_APP_USER_AGENT_TOKEN",
    "BIRDREPORT_PARAM_PUBLIC_KEY",
    "BIRDREPORT_AES_KEY_SOURCE",
    "BIRDREPORT_AES_IV_SOURCE",
    "DEFAULT_BIRDREPORT_PROXY_URL",
    "ANDROID_BIRDREPORT_PROXY_URL",
    "BIRDREPORT_RARE_SPECIES_PROVINCE",
    "BIRDREPORT_RARE_SPECIES_THRESHOLD",
    "BIRDREPORT_MONITOR_INTERVAL_MS",
    "UNLOCKED_SPECIES_VISIBLE_ROW_COUNT",
    "BEAUBIRD_UTILS",
    "BEAUBIRD_DATA",
    "formatCompactTimestamp",
    "TRADITIONAL_PHRASE_REPLACEMENTS",
    "TRADITIONAL_CHAR_MAP",
    "COMMON_BIRD_TAXONOMY",
    "SAMPLE_RECORDS",
    "ROOT_CLASS_LABEL",
    "UNKNOWN_ORDER_LABEL",
    "UNKNOWN_FAMILY_LABEL",
    "UNKNOWN_GENUS_LABEL",
    "TAXON_ZH_MAP",
    "unlockedSpeciesCache",
    "state",
    "elements",
    "EMPTY_STATE_COPY"
  ]);
  var LEGACY_GLOBAL_FUNCTION_NAMES = Object.freeze([
    "safeLocalStorageGet",
    "safeLocalStorageSet",
    "safeLocalStorageRemove",
    "bootstrap",
    "bindIfPresent",
    "bindEvents",
    "handleQuickNavClick",
    "markJumpTarget",
    "setActiveQuickNav",
    "initEmbeddedAndroidQuickNav",
    "importText",
    "parseInput",
    "parseJsonInput",
    "parseDelimitedInput",
    "parseLineInput",
    "splitDelimitedLine",
    "toRecord",
    "getRawValue",
    "normalizeHeaderName",
    "normalizeRecords",
    "persistAndRender",
    "render",
    "renderFilters",
    "renderRecordsOnly",
    "renderStats",
    "renderTaxonomyBrowser",
    "renderLifeList",
    "renderSpeciesDiscovery",
    "renderEmptyState",
    "renderRegionQueryResults",
    "renderRegionQueryDetail",
    "closeRegionQueryDetail",
    "handleRegionQueryDetailHotkeys",
    "getVisibleRecords",
    "getLifeListContext",
    "getSpeciesDiscoveryContext",
    "buildSpeciesAggregate",
    "getRecordBoundaryDate",
    "normalizeDateInput",
    "initMap",
    "renderMap",
    "buildHeatPoints",
    "renderCalendarHeatmap",
    "renderLegend",
    "syncEbirdRecords",
    "hydrateEbirdInputs",
    "persistEbirdSettings",
    "clearEbirdApiKey",
    "hydrateEbirdSeasonalInputs",
    "persistEbirdSeasonalSettings",
    "getEbirdSeasonalSettings",
    "analyzeEbirdSeasonalPrediction",
    "renderEbirdSeasonalPrediction",
    "renderEbirdSeasonalDetail",
    "clearEbirdSeasonalCache",
    "fetchEbirdSeasonalDailyEntries",
    "fetchEbirdHistoricSpeciesForDate",
    "fetchEbirdRecentSeasonalObservations",
    "normalizeEbirdSeasonalObservationList",
    "loadEbirdSeasonalCache",
    "saveEbirdSeasonalCache",
    "getCachedEbirdSeasonalDay",
    "setCachedEbirdSeasonalDay",
    "getEbirdSeasonalCacheKey",
    "runLimitedConcurrency",
    "parseIsoDateParts",
    "getEbirdSeasonalCore",
    "formatSeasonalYearRange",
    "formatSeasonalRecentEvidence",
    "getSeasonalProbabilityClass",
    "isEmbeddedAndroidApp",
    "getDefaultBirdreportProxyUrl",
    "applyRuntimeEnvironment",
    "lockEmbeddedAndroidViewport",
    "getBirdreportProxyBaseUrl",
    "hydrateZhejiangRareMonitorInputs",
    "handleZhejiangRareMonitorDateChange",
    "initBirdreportProxy",
    "canUseBirdreportProxy",
    "initZhejiangRareSpeciesMonitor",
    "initZhejiangRareSpeciesDailyQuery",
    "renderZhejiangRareSpeciesPanel",
    "renderZhejiangRareSpeciesHits",
    "saveZhejiangRareSpecies",
    "queryUnlockedSpeciesByUser",
    "fetchZhejiangSpeciesCatalogForUnlocked",
    "fetchUserZhejiangSpecies",
    "buildUnlockedMissingSpecies",
    "sortBirdreportTaxaByReportCountDesc",
    "renderUnlockedSpeciesPanel",
    "renderUnlockedSpeciesSummary",
    "renderUnlockedSpeciesSummaryCard",
    "toggleUnlockedSpeciesInfoVisibility",
    "toggleUnlockedSpeciesTableVisibility",
    "renderUnlockedSpeciesList",
    "createUnlockedSpeciesModuleHeader",
    "buildUnlockedSpeciesMetaLine",
    "renderUnlockedSpeciesLocationPanel",
    "formatUnlockedSpeciesTaxonomy",
    "toggleUnlockedSpeciesLocations",
    "submitUnlockedSpeciesCaptcha",
    "refreshUnlockedSpeciesCaptcha",
    "fetchRecentBirdreportRecordsByTaxon",
    "fetchBirdreportRecordWindowByTaxon",
    "isBirdreportCaptchaResponse",
    "createBirdreportCaptchaError",
    "isBirdreportCaptchaError",
    "loadBirdreportCaptchaImage",
    "verifyBirdreportCaptcha",
    "createBirdreportRecordSearchPayload",
    "clearUnlockedSpeciesDetail",
    "clearUnlockedSpeciesResults",
    "exportUnlockedSpeciesTable",
    "buildUnlockedSpeciesExportRows",
    "buildUnlockedSpeciesExportFilename",
    "toCsvText",
    "escapeCsvField",
    "saveTextFile",
    "triggerFileDownload",
    "toggleZhejiangRareMonitor",
    "startZhejiangRareMonitor",
    "stopZhejiangRareMonitor",
    "scheduleZhejiangRareMonitor",
    "toggleZhejiangRareSpeciesDetail",
    "checkZhejiangRareSpeciesToday",
    "notifyRareSpeciesHits",
    "renderZhejiangRareSpeciesDetail",
    "clearZhejiangRareSpeciesDetail",
    "closeZhejiangRareSpeciesDetail",
    "ensureBrowserNotificationPermission",
    "setZhejiangRareSpeciesLoading",
    "setZhejiangRareSpeciesMessage",
    "setUnlockedSpeciesMessage",
    "updateUnlockedSpeciesExportButton",
    "setUnlockedSpeciesLoading",
    "createBirdreportPayload",
    "getSelectedZhejiangRareMonitorDate",
    "getBirdreportTaxonKey",
    "getBirdreportRarityFields",
    "serializeBirdreportTaxon",
    "getBirdreportTaxaArray",
    "normalizeBirdreportTaxa",
    "fetchZhejiangSpeciesBaselineFromJson",
    "fetchZhejiangSpeciesCatalogFromJson",
    "loadZhejiangSpeciesData",
    "normalizeZhejiangSpeciesCatalog",
    "toRareSpeciesHit",
    "handleBirdreportProvinceChange",
    "handleBirdreportCityChange",
    "loadBirdreportProvinces",
    "handleBirdPrepProvinceChange",
    "handleBirdPrepCityChange",
    "queryBirdPrepSpecies",
    "buildBirdPrepQueryPayload",
    "formatBirdPrepQuerySummary",
    "formatBirdPrepQueryCompleteMessage",
    "getBirdPrepUnlockedUsername",
    "fetchUserNationalBirdPrepSpecies",
    "getBirdPrepUnlockedSpeciesForUser",
    "buildBirdPrepUnlockedTaxonLookup",
    "getBirdPrepTaxonName",
    "filterBirdPrepSpeciesByUnlocked",
    "renderBirdPrepSpeciesOptions",
    "handleBirdPrepSpeciesSelectionChange",
    "formatBirdPrepSpeciesOption",
    "getSelectedBirdPrepSpecies",
    "selectAllVisibleBirdPrepSpecies",
    "clearBirdPrepSpeciesSelection",
    "clearBirdPrepSpeciesResults",
    "generateBirdPrepPpt",
    "shouldUseBirdPrepMacaulayImages",
    "loadBirdPrepMacaulayPhotos",
    "loadBirdPrepMacaulayTaxonomyBySciName",
    "fetchBirdPrepMacaulayPhoto",
    "getBirdPrepMacaulayTaxonCode",
    "getBirdPrepTaxonScientificName",
    "normalizeScientificName",
    "getStoredEbirdApiKey",
    "birdreportProxyGetJson",
    "birdreportProxyGetImage",
    "birdreportProxyGet",
    "fetchWithTimeoutAndRetry",
    "formatFetchTimeoutError",
    "readImageDimensions",
    "getImageExtensionFromContentType",
    "formatBirdPrepMacaulayAttribution",
    "loadBirdPrepProfileIndex",
    "loadBirdPrepProfileIndexForSpecies",
    "loadBirdPrepProfileIndexFromShards",
    "loadBirdPrepProfileShardIndexFromJson",
    "loadBirdPrepProfileShardsFromJson",
    "loadBirdPrepProfileShardIndexFromScript",
    "loadBirdPrepProfileShardsFromScripts",
    "getBirdPrepNeededShardFiles",
    "getBirdPrepProfileIndexFromProfiles",
    "getBirdPrepShardScriptName",
    "assertBirdPrepProfileShardIndex",
    "loadBirdPrepProfileScript",
    "assertBirdPrepProfileResponse",
    "buildBirdPrepProfileIndexFromEmbeddedData",
    "loadBirdPrepEmbeddedDataScript",
    "syncBirdPrepMacaulayOptions",
    "setBirdPrepProgress",
    "resetBirdPrepProgress",
    "yieldToBrowserFrame",
    "setBirdPrepLoading",
    "setBirdPrepGenerating",
    "updateBirdPrepPptButton",
    "queryBirdreportSpeciesByProxy",
    "fetchAllBirdreportTaxa",
    "fetchBirdreportRecordsByTaxon",
    "fetchBirdreportRecordsForCurrentQuery",
    "fetchBirdreportReportPages",
    "fetchBirdreportRecordPages",
    "isPublicBirdreportLocationRecord",
    "normalizeBirdreportTaxonPage",
    "normalizeBirdreportRecordPage",
    "renderBirdreportSpeciesDetail",
    "toggleBirdreportSpeciesDetail",
    "submitBirdreportSpeciesCaptcha",
    "refreshBirdreportSpeciesCaptcha",
    "clearBirdreportSpeciesDetail",
    "closeBirdreportSpeciesDetail",
    "sortBirdreportRecordsByObservationTimeDesc",
    "sortBirdreportRecordsBySerialIdDesc",
    "getBirdreportReportCount",
    "dedupeBirdreportTaxa",
    "sortBirdreportTaxaByRecordCount",
    "sortBirdreportTaxaByRecordCountDesc",
    "birdreportProxyPost",
    "buildBirdreportSignedRequest",
    "serializeBirdreportRequestData",
    "parseBirdreportRequestData",
    "sortBirdreportObjectKeys",
    "generateBirdreportRequestId",
    "renderBirdreportRegionOptions",
    "resetSelectOptions",
    "renderBirdreportSpeciesResults",
    "clearBirdreportSpeciesResults",
    "decodeBirdreportPayload",
    "decodeBirdreportPayloadWithCryptoJs",
    "decodeBirdreportDecimalPairs",
    "setBirdreportLoading",
    "normalizeProxyBaseUrl",
    "openExternalUrl",
    "openBirdreportTaxonPage",
    "openBirdreportSearchPage",
    "buildBirdreportQueryPayload",
    "formatBirdreportQuerySummary",
    "normalizeBirdreportAdministrativeArea",
    "normalizeEbirdObservations",
    "createEbirdObservationId",
    "buildEbirdNotes",
    "fetchEbirdTaxonomyMap",
    "mergeRecords",
    "createDedupKey",
    "normalizeRecord",
    "migrateExistingRecords",
    "countMigratedRecords",
    "buildInitialMessage",
    "getFallbackTaxonomy",
    "buildTaxonomyTree",
    "createTaxonomyNode",
    "hydrateTaxonomyNode",
    "getTaxonomyPath",
    "renderTaxonomyNode",
    "getSortedTaxonomyChildren",
    "formatTaxonLabel",
    "buildCalendarDays",
    "calendarColor",
    "loadPersonalRecords",
    "loadUnlockedSpeciesCache",
    "createEmptyUnlockedSpeciesCache",
    "saveUnlockedSpeciesCache",
    "clearUnlockedSpeciesCache",
    "loadZhejiangRareSpecies",
    "saveZhejiangRareSpeciesToStorage",
    "loadZhejiangRareMonitor",
    "saveZhejiangRareMonitor",
    "loadZhejiangRareNotificationLog",
    "saveZhejiangRareNotificationLog",
    "savePersonalRecords",
    "isLegacyRegionQueryRecord",
    "normalizeDate",
    "formatIsoDate",
    "addDays",
    "formatDate",
    "formatDateTime",
    "formatBirdreportDateTime",
    "toNumber",
    "parsePositiveInteger",
    "toTaxonOrder",
    "createId",
    "extractGenus",
    "simplifyChineseText",
    "chunkArray",
    "clampBackDays",
    "clampEbirdSeasonalYears",
    "clampEbirdSeasonalWindow",
    "setMessage",
    "setEbirdMessage",
    "setEbirdSeasonalMessage",
    "setBirdreportMessage",
    "setBirdPrepMessage",
    "setStatusMessage",
    "setElementLoadingClass",
    "setEbirdLoading",
    "setEbirdSeasonalLoading",
    "escapeHtml",
    "encodeBase64Utf8"
  ]);
  var legacyGlobalData = {
    ...config_exports,
    unlockedSpeciesCache,
    state,
    elements,
    EMPTY_STATE_COPY
  };
  for (const name of LEGACY_GLOBAL_DATA_NAMES) {
    if (!(name in legacyGlobalData)) {
      throw new Error(`Missing legacy global data binding: ${name}`);
    }
    globalThis[name] = legacyGlobalData[name];
  }
  for (const name of LEGACY_GLOBAL_FUNCTION_NAMES) {
    const legacyFunction = runtime[name];
    if (typeof legacyFunction !== "function") {
      throw new Error(`Missing legacy global function: ${name}`);
    }
    globalThis[name] = legacyFunction;
  }
  runtime.bootstrap();
})();
