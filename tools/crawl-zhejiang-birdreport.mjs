import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

import birdreportClientModule from "../server/wecom-rare-bot/birdreport-client.js";

const { createBirdreportClient, decodeBirdreportPayload } = birdreportClientModule;

const DEFAULT_DB_PATH = resolve("data/birdreport-zhejiang.sqlite");
const DEFAULT_JSONL_PATH = resolve("data/birdreport-zhejiang.jsonl");
const DEFAULT_CAPTCHA_PATH = resolve("data/birdreport-captcha.png");
const DEFAULT_CAPTCHA_TRAINING_DATASET_PATH = resolve("pytorch-captcha-recognition/dataset/yanzhengma");
const DEFAULT_PROVINCE = "浙江省";
const DEFAULT_VERSION = "CH4";
const DEFAULT_REPORT_PAGE_LIMIT = 50;
const DEFAULT_DETAIL_CONCURRENCY = 3;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_MS = 1000;
const DEFAULT_REQUEST_DELAY_MS = 0;
const DEFAULT_FAST_RESUME_OVERLAP_PAGES = 5;

const SUMMARY_URL = "https://api.birdreport.cn/front/record/chart/summary";
const REPORT_LIST_URL = "https://api.birdreport.cn/front/record/activity/search";
const REPORT_TAXA_URL = "https://api.birdreport.cn/front/activity/taxon";
const PAGE_REFERER = "https://www.birdreport.cn/home/search/page.html";
const REPORT_REFERER = "https://www.birdreport.cn/home/search/report.html";
const RECORD_REFERER = "https://www.birdreport.cn/home/record/page.html";

const REPORT_KIND_TO_OUTSIDE_TYPE = {
  normal: 0,
  flagged: 1
};

function text(value) {
  return String(value ?? "").trim();
}

function integer(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildLocationText(report) {
  return [report.province_name, report.city_name, report.district_name, report.point_name].filter(Boolean).join("");
}

function stringifyJson(value) {
  return JSON.stringify(value ?? {});
}

export function normalizeReportRow(row, reportKind, fetchedAt = new Date().toISOString()) {
  const report = {
    report_id: text(row?.reportId || row?.request_id || row?.id || row?.activity_id),
    serial_id: text(row?.serial_id || row?.serialId),
    report_kind: reportKind,
    source_outside_type: REPORT_KIND_TO_OUTSIDE_TYPE[reportKind] ?? 0,
    is_flagged_report: reportKind === "flagged" ? 1 : 0,
    start_time: text(row?.start_time || row?.startTime),
    end_time: text(row?.end_time || row?.endTime),
    province_name: text(row?.province_name || row?.provinceName || row?.province),
    city_name: text(row?.city_name || row?.cityName || row?.city),
    district_name: text(row?.district_name || row?.districtName || row?.district),
    point_name: text(row?.point_name || row?.pointName || row?.pointname),
    state: integer(row?.state),
    taxon_count_reported: integer(row?.taxoncount ?? row?.taxon_count ?? row?.taxonCount),
    outside_count: integer(row?.outside_count ?? row?.outsideCount),
    fetched_at: fetchedAt,
    raw_report_json: stringifyJson(row)
  };
  report.location_text = buildLocationText(report);
  return report;
}

export function normalizeObservation(report, row, rawIndex = 0) {
  const taxonId = text(row?.taxon_id || row?.taxonid || row?.id);
  const taxonName = text(row?.taxon_name || row?.taxonname || row?.name);
  const sourceOutsideType = integer(row?.outside_type);
  return {
    report_id: report.report_id,
    taxon_key: taxonId || taxonName || String(rawIndex),
    taxon_id: taxonId,
    taxon_name: taxonName,
    latinname: text(row?.latinname || row?.scientificName || row?.sciName),
    englishname: text(row?.englishname || row?.englishName),
    taxon_order_name: text(row?.taxonordername || row?.taxon_order_name || row?.orderName),
    taxon_family_name: text(row?.taxonfamilyname || row?.taxon_family_name || row?.familyName),
    taxon_count: integer(row?.taxon_count ?? row?.taxonCount ?? row?.count ?? row?.number),
    is_red_species: sourceOutsideType === 1 ? 1 : 0,
    source_outside_type: sourceOutsideType,
    record_image_num: integer(row?.record_image_num ?? row?.recordImageNum),
    raw_index: rawIndex,
    raw_taxon_json: stringifyJson(row)
  };
}

export function prepareObservationsForReport(report, rawTaxa) {
  let filteredRedSpeciesCount = 0;
  const observations = [];

  (Array.isArray(rawTaxa) ? rawTaxa : []).forEach((taxon, rawIndex) => {
    if (report.report_kind === "flagged" && integer(taxon?.outside_type) === 1) {
      filteredRedSpeciesCount += 1;
      return;
    }
    observations.push(normalizeObservation(report, taxon, rawIndex));
  });

  return {
    filteredRedSpeciesCount,
    observations
  };
}

export function openCrawlerDatabase(dbPath = DEFAULT_DB_PATH) {
  const database = new DatabaseSync(dbPath);
  initializeDatabase(database);
  return database;
}

export function initializeDatabase(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS crawl_meta (
      run_id TEXT PRIMARY KEY,
      province TEXT NOT NULL,
      version TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      status TEXT NOT NULL,
      summary_json TEXT,
      options_json TEXT,
      normal_report_total INTEGER DEFAULT 0,
      flagged_report_total INTEGER DEFAULT 0,
      saved_report_count INTEGER DEFAULT 0,
      saved_observation_count INTEGER DEFAULT 0,
      filtered_red_species_count INTEGER DEFAULT 0,
      failed_report_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS reports (
      report_id TEXT PRIMARY KEY,
      serial_id TEXT,
      report_kind TEXT NOT NULL,
      source_outside_type INTEGER NOT NULL,
      is_flagged_report INTEGER NOT NULL,
      start_time TEXT,
      end_time TEXT,
      province_name TEXT,
      city_name TEXT,
      district_name TEXT,
      point_name TEXT,
      location_text TEXT,
      state INTEGER,
      taxon_count_reported INTEGER,
      outside_count INTEGER,
      fetched_at TEXT NOT NULL,
      raw_report_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS observations (
      report_id TEXT NOT NULL,
      taxon_key TEXT NOT NULL,
      taxon_id TEXT,
      taxon_name TEXT,
      latinname TEXT,
      englishname TEXT,
      taxon_order_name TEXT,
      taxon_family_name TEXT,
      taxon_count INTEGER,
      is_red_species INTEGER NOT NULL,
      source_outside_type INTEGER NOT NULL,
      record_image_num INTEGER,
      raw_index INTEGER NOT NULL,
      raw_taxon_json TEXT NOT NULL,
      PRIMARY KEY (report_id, taxon_key),
      FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS crawl_progress (
      province TEXT NOT NULL,
      version TEXT NOT NULL,
      report_kind TEXT NOT NULL,
      report_page_limit INTEGER NOT NULL,
      completed_page INTEGER NOT NULL DEFAULT 0,
      completed_rows INTEGER NOT NULL DEFAULT 0,
      total_rows INTEGER DEFAULT 0,
      source TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (province, version, report_kind, report_page_limit)
    );

    CREATE INDEX IF NOT EXISTS idx_reports_time ON reports(start_time);
    CREATE INDEX IF NOT EXISTS idx_reports_location ON reports(province_name, city_name, district_name);
    CREATE INDEX IF NOT EXISTS idx_observations_taxon_name ON observations(taxon_name);
    CREATE INDEX IF NOT EXISTS idx_observations_taxon_id ON observations(taxon_id);
  `);
}

export function reportAlreadyCrawled(db, reportId) {
  if (!reportId) {
    return false;
  }
  const row = db.prepare("SELECT 1 AS found FROM reports WHERE report_id = ?").get(reportId);
  return Boolean(row?.found);
}

export function getCrawlProgress(db, options, reportKind) {
  return db.prepare(`
    SELECT
      province,
      version,
      report_kind AS reportKind,
      report_page_limit AS reportPageLimit,
      completed_page AS completedPage,
      completed_rows AS completedRows,
      total_rows AS totalRows,
      source,
      updated_at AS updatedAt
    FROM crawl_progress
    WHERE province = ?
      AND version = ?
      AND report_kind = ?
      AND report_page_limit = ?
  `).get(options.province, options.version, reportKind, options.reportPageLimit) || null;
}

export function markProgressPageComplete(db, options, reportKind, completedPage, completedRows, totalRows = 0, source = "crawler") {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO crawl_progress (
      province,
      version,
      report_kind,
      report_page_limit,
      completed_page,
      completed_rows,
      total_rows,
      source,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(province, version, report_kind, report_page_limit) DO UPDATE SET
      completed_page = CASE
        WHEN excluded.completed_page > crawl_progress.completed_page THEN excluded.completed_page
        ELSE crawl_progress.completed_page
      END,
      completed_rows = CASE
        WHEN excluded.completed_page > crawl_progress.completed_page THEN excluded.completed_rows
        ELSE crawl_progress.completed_rows
      END,
      total_rows = excluded.total_rows,
      source = CASE
        WHEN excluded.completed_page > crawl_progress.completed_page THEN excluded.source
        ELSE crawl_progress.source
      END,
      updated_at = excluded.updated_at
  `).run(
    options.province,
    options.version,
    reportKind,
    options.reportPageLimit,
    Math.max(0, integer(completedPage)),
    Math.max(0, integer(completedRows)),
    Math.max(0, integer(totalRows)),
    source,
    now
  );
  return getCrawlProgress(db, options, reportKind);
}

export function bootstrapProgressFromDb(db, options, reportKind) {
  const row = db.prepare("SELECT COUNT(*) AS count FROM reports WHERE report_kind = ?").get(reportKind);
  const savedCount = Math.max(0, integer(row?.count));
  const completedPage = Math.floor(savedCount / options.reportPageLimit);
  return markProgressPageComplete(
    db,
    options,
    reportKind,
    completedPage,
    savedCount,
    0,
    "db-bootstrap"
  );
}

export function getFastResumeStartPage(progress, options) {
  if (!progress?.completedPage) {
    return 1;
  }
  const overlapPages = Math.max(0, integer(options.fastResumeOverlapPages));
  return Math.max(1, progress.completedPage - overlapPages + 1);
}

function shouldUseFastResume(options, reportKind) {
  return Boolean(
    options.resume &&
    options.fastResume &&
    !options.limitReports &&
    !getReportLimit(options, reportKind)
  );
}

function allReportsAlreadyCrawled(db, reports) {
  return reports.length > 0 && reports.every((report) => report.report_id && reportAlreadyCrawled(db, report.report_id));
}

function runInTransaction(db, callback) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = callback();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function upsertReport(db, report) {
  db.prepare(`
    INSERT INTO reports (
      report_id,
      serial_id,
      report_kind,
      source_outside_type,
      is_flagged_report,
      start_time,
      end_time,
      province_name,
      city_name,
      district_name,
      point_name,
      location_text,
      state,
      taxon_count_reported,
      outside_count,
      fetched_at,
      raw_report_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(report_id) DO UPDATE SET
      serial_id = excluded.serial_id,
      report_kind = excluded.report_kind,
      source_outside_type = excluded.source_outside_type,
      is_flagged_report = excluded.is_flagged_report,
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      province_name = excluded.province_name,
      city_name = excluded.city_name,
      district_name = excluded.district_name,
      point_name = excluded.point_name,
      location_text = excluded.location_text,
      state = excluded.state,
      taxon_count_reported = excluded.taxon_count_reported,
      outside_count = excluded.outside_count,
      fetched_at = excluded.fetched_at,
      raw_report_json = excluded.raw_report_json
  `).run(
    report.report_id,
    report.serial_id,
    report.report_kind,
    report.source_outside_type,
    report.is_flagged_report,
    report.start_time,
    report.end_time,
    report.province_name,
    report.city_name,
    report.district_name,
    report.point_name,
    report.location_text,
    report.state,
    report.taxon_count_reported,
    report.outside_count,
    report.fetched_at,
    report.raw_report_json
  );
}

export function replaceObservations(db, reportId, observations) {
  db.prepare("DELETE FROM observations WHERE report_id = ?").run(reportId);
  const insert = db.prepare(`
    INSERT INTO observations (
      report_id,
      taxon_key,
      taxon_id,
      taxon_name,
      latinname,
      englishname,
      taxon_order_name,
      taxon_family_name,
      taxon_count,
      is_red_species,
      source_outside_type,
      record_image_num,
      raw_index,
      raw_taxon_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  observations.forEach((observation) => {
    insert.run(
      observation.report_id,
      observation.taxon_key,
      observation.taxon_id,
      observation.taxon_name,
      observation.latinname,
      observation.englishname,
      observation.taxon_order_name,
      observation.taxon_family_name,
      observation.taxon_count,
      observation.is_red_species,
      observation.source_outside_type,
      observation.record_image_num,
      observation.raw_index,
      observation.raw_taxon_json
    );
  });
}

export async function appendJsonlRecord(jsonlPath, record) {
  await mkdir(dirname(jsonlPath), { recursive: true });
  await appendFile(jsonlPath, `${JSON.stringify(record)}\n`, "utf8");
}

export async function writeReportWithObservations({ db, jsonlPath, report, rawTaxa, runId }) {
  if (!report?.report_id) {
    throw new Error("报告缺少 report_id，无法写入。");
  }

  const { observations, filteredRedSpeciesCount } = prepareObservationsForReport(report, rawTaxa);
  runInTransaction(db, () => {
    upsertReport(db, report);
    replaceObservations(db, report.report_id, observations);
  });

  await appendJsonlRecord(jsonlPath, {
    event: "report-detail",
    runId,
    reportKind: report.report_kind,
    reportId: report.report_id,
    serialId: report.serial_id,
    rawTaxaCount: Array.isArray(rawTaxa) ? rawTaxa.length : 0,
    savedTaxaCount: observations.length,
    filteredRedSpeciesCount,
    report,
    rawTaxa
  });

  return {
    savedTaxaCount: observations.length,
    filteredRedSpeciesCount
  };
}

function createRunId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function printHelp() {
  console.log(`Usage: node tools/crawl-zhejiang-birdreport.mjs [options]

Options:
  --db <path>                       SQLite output path (default: data/birdreport-zhejiang.sqlite)
  --jsonl <path>                    JSONL output path (default: data/birdreport-zhejiang.jsonl)
  --province <name>                 Province query (default: 浙江省)
  --version <version>               BirdReport taxon version (default: CH4)
  --limit-reports <n>               Limit normal and flagged report list sizes separately
  --limit-normal-reports <n>        Limit normal report details
  --limit-flagged-reports <n>       Limit flagged report details
  --report-page-limit <n>           Report list page size (default: 50)
  --detail-concurrency <n>          Detail request concurrency (default: 3)
  --max-retries <n>                 Retry count per request (default: 3)
  --retry-base-ms <n>               Base retry delay in milliseconds (default: 1000)
  --request-delay-ms <n>            Minimum delay between API requests in milliseconds (default: 0)
  --fast-resume-overlap-pages <n>   Re-check this many pages before the saved progress (default: 5)
  --bootstrap-progress-from-db      Initialize fast-resume progress from existing SQLite rows
  --no-fast-resume                  Disable progress fast-forward and check from page 1
  --manual-captcha                  Save captcha image and prompt for code when blocked
  --open-captcha                    Open captcha image with the default image viewer
  --no-manual-captcha               Pause instead of prompting for captcha
  --captcha-path <path>             Captcha image path (default: data/birdreport-captcha.png)
  --no-resume                       Re-fetch reports already present in SQLite
  --help                            Show this help
`);
}

export function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    dbPath: DEFAULT_DB_PATH,
    jsonlPath: DEFAULT_JSONL_PATH,
    province: DEFAULT_PROVINCE,
    version: DEFAULT_VERSION,
    reportPageLimit: DEFAULT_REPORT_PAGE_LIMIT,
    detailConcurrency: DEFAULT_DETAIL_CONCURRENCY,
    maxRetries: DEFAULT_MAX_RETRIES,
    retryBaseMs: DEFAULT_RETRY_BASE_MS,
    requestDelayMs: DEFAULT_REQUEST_DELAY_MS,
    fastResume: true,
    fastResumeOverlapPages: DEFAULT_FAST_RESUME_OVERLAP_PAGES,
    bootstrapProgressFromDb: false,
    manualCaptcha: Boolean(stdin.isTTY),
    openCaptcha: false,
    captchaPath: DEFAULT_CAPTCHA_PATH,
    resume: true,
    limitReports: null,
    limitNormalReports: null,
    limitFlaggedReports: null,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const readValue = () => {
      const value = argv[index + 1];
      if (value == null || value.startsWith("--")) {
        throw new Error(`${arg} 需要一个参数值。`);
      }
      index += 1;
      return value;
    };
    const readPositiveInteger = () => {
      const value = integer(readValue(), NaN);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`${arg} 必须是正整数。`);
      }
      return value;
    };
    const readNonNegativeInteger = () => {
      const value = integer(readValue(), NaN);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`${arg} 必须是 0 或正整数。`);
      }
      return value;
    };

    switch (arg) {
      case "--db":
        options.dbPath = resolve(readValue());
        break;
      case "--jsonl":
        options.jsonlPath = resolve(readValue());
        break;
      case "--province":
        options.province = readValue();
        break;
      case "--version":
        options.version = readValue();
        break;
      case "--limit-reports":
        options.limitReports = readPositiveInteger();
        break;
      case "--limit-normal-reports":
        options.limitNormalReports = readPositiveInteger();
        break;
      case "--limit-flagged-reports":
        options.limitFlaggedReports = readPositiveInteger();
        break;
      case "--report-page-limit":
        options.reportPageLimit = readPositiveInteger();
        break;
      case "--detail-concurrency":
        options.detailConcurrency = readPositiveInteger();
        break;
      case "--max-retries":
        options.maxRetries = readPositiveInteger();
        break;
      case "--retry-base-ms":
        options.retryBaseMs = readPositiveInteger();
        break;
      case "--request-delay-ms":
        options.requestDelayMs = readNonNegativeInteger();
        break;
      case "--fast-resume-overlap-pages":
        options.fastResumeOverlapPages = readNonNegativeInteger();
        break;
      case "--bootstrap-progress-from-db":
        options.bootstrapProgressFromDb = true;
        break;
      case "--no-fast-resume":
        options.fastResume = false;
        break;
      case "--manual-captcha":
        options.manualCaptcha = true;
        break;
      case "--open-captcha":
        options.openCaptcha = true;
        options.manualCaptcha = true;
        break;
      case "--no-manual-captcha":
        options.manualCaptcha = false;
        break;
      case "--captcha-path":
        options.captchaPath = resolve(readValue());
        break;
      case "--no-resume":
        options.resume = false;
        break;
      case "--help":
        options.help = true;
        break;
      default:
        throw new Error(`未知参数：${arg}`);
    }
  }

  options.detailConcurrency = Math.max(1, Math.min(10, options.detailConcurrency));
  options.reportPageLimit = Math.max(1, Math.min(50, options.reportPageLimit));
  return options;
}

async function ensureOutputDirectories(options) {
  await mkdir(dirname(options.dbPath), { recursive: true });
  await mkdir(dirname(options.jsonlPath), { recursive: true });
}

async function promptCaptchaCode(captchaPath, label) {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(`BirdReport 要求验证码（${label}）。图片已保存到 ${captchaPath}，请输入验证码：`);
    return answer.trim();
  } finally {
    rl.close();
  }
}

export function getVerifiedCaptchaTrainingPath(code, datasetPath = DEFAULT_CAPTCHA_TRAINING_DATASET_PATH) {
  const normalizedCode = String(code || "").trim();
  if (!/^[A-Za-z0-9]+$/.test(normalizedCode)) {
    throw new Error("验证码只能包含字母或数字，无法保存为训练集文件名。");
  }
  return resolve(datasetPath || DEFAULT_CAPTCHA_TRAINING_DATASET_PATH, `${normalizedCode}.png`);
}

export async function saveVerifiedCaptchaImage(captchaBody, code, datasetPath = DEFAULT_CAPTCHA_TRAINING_DATASET_PATH) {
  const captchaTrainingPath = getVerifiedCaptchaTrainingPath(code, datasetPath);
  await mkdir(dirname(captchaTrainingPath), { recursive: true });
  await writeFile(captchaTrainingPath, captchaBody);
  return captchaTrainingPath;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function createCaptchaStats() {
  return {
    triggerCount: 0,
    promptCount: 0,
    sharedWaitCount: 0,
    firstPromptAt: null,
    lastPromptAt: null
  };
}

function getCaptchaStats(options) {
  if (!options.captchaStats) {
    options.captchaStats = createCaptchaStats();
  }
  return options.captchaStats;
}

function snapshotCaptchaStats(options) {
  const stats = getCaptchaStats(options);
  return { ...stats };
}

function formatDuration(ms) {
  const seconds = Math.max(1, Math.round(ms / 1000));
  if (seconds < 60) {
    return `${seconds} 秒`;
  }
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;
  if (minutes < 60) {
    return restSeconds ? `${minutes} 分 ${restSeconds} 秒` : `${minutes} 分`;
  }
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes ? `${hours} 小时 ${restMinutes} 分` : `${hours} 小时`;
}

async function waitForRequestSlot(options) {
  const delayMs = Math.max(0, integer(options.requestDelayMs));
  if (delayMs <= 0) {
    return;
  }

  const previous = options.requestDelayQueue || Promise.resolve();
  const current = previous.catch(() => {}).then(async () => {
    const nextAt = options.nextRequestAt || 0;
    const waitMs = Math.max(0, nextAt - Date.now());
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    options.nextRequestAt = Date.now() + delayMs;
  });
  options.requestDelayQueue = current;
  await current;
}

export async function openCaptchaFile(captchaPath) {
  const platform = process.platform;
  const command =
    platform === "win32"
      ? ["cmd", ["/c", "start", "", captchaPath]]
      : platform === "darwin"
        ? ["open", [captchaPath]]
        : ["xdg-open", [captchaPath]];

  await new Promise((resolveOpen, rejectOpen) => {
    const child = spawn(command[0], command[1], {
      detached: true,
      stdio: "ignore",
      windowsHide: true
    });
    child.once("error", rejectOpen);
    child.unref();
    resolveOpen();
  });
}

let activeCaptchaChallenge = null;

export async function runCaptchaChallengeOnce(client, options = {}, label = "BirdReport 请求") {
  const captchaStats = getCaptchaStats(options);
  captchaStats.triggerCount += 1;

  if (!activeCaptchaChallenge) {
    activeCaptchaChallenge = handleCaptchaChallenge(client, options, label).finally(() => {
      activeCaptchaChallenge = null;
    });
  } else {
    captchaStats.sharedWaitCount += 1;
    console.warn(`已有验证码正在处理，${label} 等待当前验证码通过后继续。`);
  }
  return activeCaptchaChallenge;
}

export async function handleCaptchaChallenge(client, options = {}, label = "BirdReport 请求") {
  if (!options.manualCaptcha) {
    throw new Error("BirdReport 触发验证码或访问限制，已暂停并保留断点。可加 --manual-captcha 手动输入验证码后继续。");
  }
  if (typeof client.fetchCaptchaImage !== "function" || typeof client.verifyCaptcha !== "function") {
    throw new Error("BirdReport 客户端不支持验证码图片获取或验证码校验。");
  }

  const captchaPath = resolve(options.captchaPath || DEFAULT_CAPTCHA_PATH);
  const captcha = await client.fetchCaptchaImage();
  await mkdir(dirname(captchaPath), { recursive: true });
  await writeFile(captchaPath, captcha.body);

  const captchaStats = getCaptchaStats(options);
  const now = Date.now();
  const previousPromptAt = captchaStats.lastPromptAt ? Date.parse(captchaStats.lastPromptAt) : null;
  captchaStats.promptCount += 1;
  captchaStats.firstPromptAt ||= new Date(now).toISOString();
  captchaStats.lastPromptAt = new Date(now).toISOString();

  console.warn(`BirdReport 触发验证码：${label}`);
  console.warn(`验证码图片已保存：${captchaPath}`);
  console.warn(
    previousPromptAt
      ? `验证码频率：第 ${captchaStats.promptCount} 次输入提示，距上次 ${formatDuration(now - previousPromptAt)}；累计触发 ${captchaStats.triggerCount} 次，合并等待 ${captchaStats.sharedWaitCount} 次。`
      : `验证码频率：本次运行第 1 次输入提示；累计触发 ${captchaStats.triggerCount} 次，合并等待 ${captchaStats.sharedWaitCount} 次。`
  );
  if (options.openCaptcha) {
    try {
      const openFile = options.openCaptchaFile || openCaptchaFile;
      await openFile(captchaPath);
      console.warn("已用系统默认图片查看器打开验证码图片。");
    } catch (error) {
      console.warn(`验证码图片自动打开失败，请手动打开：${captchaPath}（${error.message}）`);
    }
  }

  const askCode = options.promptCaptchaCode || promptCaptchaCode;
  const code = String(await askCode(captchaPath, label, captcha.contentType) || "").trim();
  if (!code) {
    throw new Error("未输入验证码，已暂停并保留断点。");
  }
  await client.verifyCaptcha(code);
  const captchaTrainingPath = await saveVerifiedCaptchaImage(captcha.body, code, options.captchaTrainingDatasetPath);
  console.warn(`验证码图片已保存到训练集：${captchaTrainingPath}`);
  console.warn("验证码已通过，继续重试当前请求。");
  return { captchaPath, captchaTrainingPath };
}

export async function fetchSignedJson(client, url, referer, payload, options, label) {
  return retryAsync(
    async () => {
      await waitForRequestSlot(options);
      return client.postBirdreport(url, referer, payload);
    },
    {
      maxRetries: options.maxRetries,
      retryBaseMs: options.retryBaseMs,
      label,
      handleCaptcha: options.manualCaptcha ? () => runCaptchaChallengeOnce(client, options, label) : null
    }
  );
}

function isCaptchaError(error) {
  return error?.name === "BirdreportCaptchaError" || error?.code === 405 || error?.code === 505;
}

async function retryAsync(operation, options) {
  let lastError;
  for (let attempt = 1; attempt <= options.maxRetries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (isCaptchaError(error) || attempt >= options.maxRetries) {
        if (isCaptchaError(error) && typeof options.handleCaptcha === "function" && attempt < options.maxRetries) {
          await options.handleCaptcha(error);
          continue;
        }
        throw error;
      }
      const delayMs = options.retryBaseMs * 2 ** (attempt - 1);
      console.warn(`${options.label} 失败，${delayMs}ms 后重试 ${attempt}/${options.maxRetries}：${error.message}`);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
    }
  }
  throw lastError;
}

async function fetchSummary(client, options) {
  const payload = {
    province: options.province,
    version: options.version,
    mode: 0
  };
  return fetchSignedJson(client, SUMMARY_URL, PAGE_REFERER, payload, options, "统计摘要");
}

async function fetchReportListPage(client, options, reportKind, page) {
  const outsideType = REPORT_KIND_TO_OUTSIDE_TYPE[reportKind];
  const payload = {
    province: options.province,
    version: options.version,
    mode: 0,
    outside_type: outsideType,
    page,
    limit: options.reportPageLimit
  };
  const response = await fetchSignedJson(client, REPORT_LIST_URL, REPORT_REFERER, payload, options, `${reportKind} 报告第 ${page} 页`);
  return {
    count: integer(response?.count),
    rows: decodeBirdreportPayload(response?.data)
  };
}

async function fetchReportList(client, options, reportKind) {
  const limitOption = reportKind === "normal" ? options.limitNormalReports : options.limitFlaggedReports;
  const maxRows = limitOption ?? options.limitReports ?? Infinity;
  const firstPage = await fetchReportListPage(client, options, reportKind, 1);
  const totalRows = Math.min(firstPage.count || firstPage.rows.length, maxRows);
  const totalPages = Math.max(1, Math.ceil(totalRows / options.reportPageLimit));
  const rows = firstPage.rows.slice(0, totalRows).map((row) => normalizeReportRow(row, reportKind));

  for (let page = 2; page <= totalPages; page += 1) {
    const result = await fetchReportListPage(client, options, reportKind, page);
    const remaining = totalRows - rows.length;
    rows.push(...result.rows.slice(0, remaining).map((row) => normalizeReportRow(row, reportKind)));
    console.log(`${reportKind} 报告列表：${rows.length}/${totalRows}`);
  }

  return {
    total: firstPage.count,
    rows
  };
}

async function fetchReportTaxa(client, options, report) {
  const response = await fetchSignedJson(
    client,
    REPORT_TAXA_URL,
    RECORD_REFERER,
    { reportId: report.report_id },
    options,
    `报告 ${report.serial_id || report.report_id} 详情`
  );
  return decodeBirdreportPayload(response?.data);
}

function getReportLimit(options, reportKind) {
  return reportKind === "normal" ? options.limitNormalReports : options.limitFlaggedReports;
}

async function processReportDetails({ client, options, db, jsonlPath, runId, stats, reports }) {
  const pageStats = {
    savedReports: 0,
    skippedReports: 0,
    failedReports: 0
  };
  stats.discoveredReports += reports.length;
  await mapWithConcurrency(reports, options.detailConcurrency, async (report) => {
    if (options.resume && reportAlreadyCrawled(db, report.report_id)) {
      stats.skippedReports += 1;
      pageStats.skippedReports += 1;
      return;
    }

    try {
      const rawTaxa = await fetchReportTaxa(client, options, report);
      const result = await writeReportWithObservations({
        db,
        jsonlPath,
        report,
        rawTaxa,
        runId
      });
      stats.savedReports += 1;
      stats.savedObservations += result.savedTaxaCount;
      stats.filteredRedSpecies += result.filteredRedSpeciesCount;
      pageStats.savedReports += 1;

      const completed = stats.savedReports + stats.skippedReports + stats.failedReports;
      if (completed % 25 === 0 || completed === stats.discoveredReports) {
        console.log(
          `详情进度：${completed}/${stats.discoveredReports}，保存报告 ${stats.savedReports}，跳过 ${stats.skippedReports}，失败 ${stats.failedReports}`
        );
      }
    } catch (error) {
      if (isCaptchaError(error)) {
        throw error;
      }
      stats.failedReports += 1;
      pageStats.failedReports += 1;
      stats.failures.push({
        reportId: report.report_id,
        serialId: report.serial_id,
        message: error.message
      });
      await appendJsonlRecord(options.jsonlPath, {
        event: "report-error",
        runId,
        reportId: report.report_id,
        serialId: report.serial_id,
        message: error.message
      });
    }
  });
  return pageStats;
}

async function crawlReportKind({ client, options, db, runId, stats, reportKind }) {
  const limitOption = getReportLimit(options, reportKind);
  const maxRows = limitOption ?? options.limitReports ?? Infinity;
  let totalRows = null;
  let selectedRows = null;
  let progressBlockedByFailure = false;

  const processListPage = async (page, result, { stopWhenAlreadyCrawled = false, updateProgress = true } = {}) => {
    if (selectedRows == null) {
      totalRows = result.count || result.rows.length;
      selectedRows = Math.min(totalRows, maxRows);
    }

    const pageStartRow = (page - 1) * options.reportPageLimit;
    if (pageStartRow >= selectedRows) {
      return { rows: [], stopCatchup: true };
    }

    const remaining = selectedRows - pageStartRow;
    const rows = result.rows.slice(0, remaining).map((row) => normalizeReportRow(row, reportKind));
    const reports = rows.filter((report) => report.report_id);
    const processedRows = Math.min(selectedRows, pageStartRow + rows.length);
    console.log(`${reportKind} 报告列表：${processedRows}/${selectedRows}`);

    if (stopWhenAlreadyCrawled && allReportsAlreadyCrawled(db, reports)) {
      console.log(`${reportKind} 首页补新：第 ${page} 页已全部入库，停止首页扫描并快进。`);
      return { rows, stopCatchup: true };
    }

    const pageStats = await processReportDetails({
      client,
      options,
      db,
      jsonlPath: options.jsonlPath,
      runId,
      stats,
      reports
    });

    if (pageStats.failedReports > 0) {
      progressBlockedByFailure = true;
    }

    if (updateProgress && !progressBlockedByFailure && pageStats.failedReports === 0 && rows.length > 0) {
      markProgressPageComplete(db, options, reportKind, page, processedRows, totalRows || 0);
    }

    return { rows, stopCatchup: rows.length === 0 };
  };

  let startPage = 1;
  if (shouldUseFastResume(options, reportKind)) {
    let progress = getCrawlProgress(db, options, reportKind);
    if (options.bootstrapProgressFromDb || !progress) {
      progress = bootstrapProgressFromDb(db, options, reportKind);
    }
    startPage = getFastResumeStartPage(progress, options);

    if (startPage > 1) {
      console.log(
        `${reportKind} 快进续跑：水位线第 ${progress.completedPage} 页，从第 ${startPage} 页重叠续跑；先扫描首页补新。`
      );
      for (let page = 1; page < startPage; page += 1) {
        const result = await fetchReportListPage(client, options, reportKind, page);
        const outcome = await processListPage(page, result, {
          stopWhenAlreadyCrawled: true,
          updateProgress: false
        });
        if (outcome.stopCatchup) {
          break;
        }
      }
    }
  }

  for (let page = startPage; selectedRows == null || (page - 1) * options.reportPageLimit < selectedRows; page += 1) {
    const result = await fetchReportListPage(client, options, reportKind, page);
    const outcome = await processListPage(page, result);
    if (outcome.rows.length === 0) {
      break;
    }
  }

  return {
    total: totalRows || 0,
    selected: selectedRows || 0
  };
}

async function mapWithConcurrency(items, concurrency, worker) {
  let index = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length || 1)) }, async () => {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      await worker(items[currentIndex], currentIndex);
    }
  });
  await Promise.all(workers);
}

function startCrawlMeta(db, runId, options, summary, normalTotal, flaggedTotal) {
  db.prepare(`
    INSERT INTO crawl_meta (
      run_id,
      province,
      version,
      started_at,
      status,
      summary_json,
      options_json,
      normal_report_total,
      flagged_report_total
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    runId,
    options.province,
    options.version,
    new Date().toISOString(),
    "running",
    stringifyJson(summary),
    stringifyJson({
      reportPageLimit: options.reportPageLimit,
      detailConcurrency: options.detailConcurrency,
      requestDelayMs: options.requestDelayMs,
      fastResume: options.fastResume,
      fastResumeOverlapPages: options.fastResumeOverlapPages,
      bootstrapProgressFromDb: options.bootstrapProgressFromDb,
      manualCaptcha: options.manualCaptcha,
      openCaptcha: options.openCaptcha,
      captchaPath: options.captchaPath,
      resume: options.resume,
      limitReports: options.limitReports,
      limitNormalReports: options.limitNormalReports,
      limitFlaggedReports: options.limitFlaggedReports
    }),
    normalTotal,
    flaggedTotal
  );
}

function finishCrawlMeta(db, runId, status, stats) {
  db.prepare(`
    UPDATE crawl_meta
    SET completed_at = ?,
        status = ?,
        saved_report_count = ?,
        saved_observation_count = ?,
        filtered_red_species_count = ?,
        failed_report_count = ?
    WHERE run_id = ?
  `).run(
    new Date().toISOString(),
    status,
    stats.savedReports,
    stats.savedObservations,
    stats.filteredRedSpecies,
    stats.failedReports,
    runId
  );
}

export async function crawlZhejiangBirdreport(options = {}) {
  const resolvedOptions = { ...parseArgs([]), ...options };
  await ensureOutputDirectories(resolvedOptions);

  const runId = resolvedOptions.runId || createRunId();
  const db = resolvedOptions.db || openCrawlerDatabase(resolvedOptions.dbPath);
  const client = resolvedOptions.client || createBirdreportClient();
  const stats = {
    discoveredReports: 0,
    skippedReports: 0,
    savedReports: 0,
    savedObservations: 0,
    filteredRedSpecies: 0,
    failedReports: 0,
    failures: [],
    captcha: snapshotCaptchaStats(resolvedOptions)
  };

  console.log(`开始抓取 BirdReport 浙江数据，runId=${runId}`);
  const summary = await fetchSummary(client, resolvedOptions);
  const normalSummaryTotal = integer(summary?.data?.report_num_1);
  const flaggedSummaryTotal = integer(summary?.data?.report_num_2);

  startCrawlMeta(db, runId, resolvedOptions, summary, normalSummaryTotal, flaggedSummaryTotal);
  await appendJsonlRecord(resolvedOptions.jsonlPath, {
    event: "crawl-start",
    runId,
    province: resolvedOptions.province,
    version: resolvedOptions.version,
    summary,
    normalReportTotal: normalSummaryTotal,
    flaggedReportTotal: flaggedSummaryTotal,
    selectedReportCount: null
  });

  try {
    const normalResult = await crawlReportKind({
      client,
      options: resolvedOptions,
      db,
      runId,
      stats,
      reportKind: "normal"
    });
    const flaggedResult = await crawlReportKind({
      client,
      options: resolvedOptions,
      db,
      runId,
      stats,
      reportKind: "flagged"
    });

    stats.captcha = snapshotCaptchaStats(resolvedOptions);
    finishCrawlMeta(db, runId, "completed", stats);
    await appendJsonlRecord(resolvedOptions.jsonlPath, {
      event: "crawl-complete",
      runId,
      selectedReportCount: normalResult.selected + flaggedResult.selected,
      captcha: snapshotCaptchaStats(resolvedOptions),
      stats
    });
  } catch (error) {
    const status = isCaptchaError(error) ? "paused_captcha" : "failed";
    stats.captcha = snapshotCaptchaStats(resolvedOptions);
    finishCrawlMeta(db, runId, status, stats);
    await appendJsonlRecord(resolvedOptions.jsonlPath, {
      event: "crawl-paused",
      runId,
      status,
      message: error.message,
      captcha: snapshotCaptchaStats(resolvedOptions),
      stats
    });

    if (isCaptchaError(error)) {
      throw new Error(`BirdReport 触发验证码或访问限制，已暂停并保留断点。请稍后重跑脚本继续。原始错误：${error.message}`);
    }
    throw error;
  }

  stats.captcha = snapshotCaptchaStats(resolvedOptions);
  console.log(`抓取完成：保存报告 ${stats.savedReports}，跳过 ${stats.skippedReports}，鸟种记录 ${stats.savedObservations}`);
  console.log(`标红报告中过滤红色鸟种 ${stats.filteredRedSpecies} 条，失败报告 ${stats.failedReports} 条。`);
  console.log(`验证码统计：输入提示 ${stats.captcha.promptCount} 次，累计触发 ${stats.captcha.triggerCount} 次，合并等待 ${stats.captcha.sharedWaitCount} 次。`);
  if (!resolvedOptions.db) {
    db.close();
  }
  return {
    runId,
    stats
  };
}

async function main() {
  const options = parseArgs();
  if (options.help) {
    printHelp();
    return;
  }
  await crawlZhejiangBirdreport(options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
