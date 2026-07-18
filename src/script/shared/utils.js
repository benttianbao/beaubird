// Functions extracted from the legacy script.js shared/utils domain.
export function installSharedUtils(runtime) {
  const { EBIRD_SEASONAL_DEFAULT_YEARS, EBIRD_SEASONAL_DEFAULT_WINDOW_DAYS, TRADITIONAL_PHRASE_REPLACEMENTS, TRADITIONAL_CHAR_MAP } = runtime;

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
  TRADITIONAL_PHRASE_REPLACEMENTS.forEach(([source, target]) => {
    result = result.replaceAll(source, target);
  });
  return [...result].map((char) => TRADITIONAL_CHAR_MAP[char] || char).join("");
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
    return EBIRD_SEASONAL_DEFAULT_YEARS;
  }

  return Math.min(15, Math.max(1, Math.round(number)));
}

function clampEbirdSeasonalWindow(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return EBIRD_SEASONAL_DEFAULT_WINDOW_DAYS;
  }

  return Math.min(14, Math.max(0, Math.round(number)));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function encodeBase64Utf8(value) {
  return btoa(unescape(encodeURIComponent(String(value))));
}

  Object.assign(runtime, {
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
