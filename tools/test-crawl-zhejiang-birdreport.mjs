import assert from "node:assert/strict";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

import {
  createContinuousWatermark,
  createReportClaimer,
  createSerialQueue,
  createStopController,
  crawlZhejiangBirdreport,
  fetchReportDetail,
  fetchReportTaxa,
  getFastResumeStartPage,
  getWorkerCaptchaPath,
  handleCaptchaChallenge,
  isTransientBirdreportError,
  mergeReportDetail,
  normalizeReportDetail,
  openCrawlerDatabase,
  parseArgs,
  parseLocationCoordinates,
  runCaptchaChallengeOnce,
  runPageWorkerPool,
  writeReportWithObservations
} from "./crawl-zhejiang-birdreport.mjs";

const TEST_ROOT = resolve(".tmp/crawl-zhejiang-birdreport-captcha-test");

async function removeFileIfExists(path) {
  await rm(path, { force: true });
}

async function clearDirectoryFiles(path) {
  await mkdir(path, { recursive: true });
  const entries = await readdir(path);
  await Promise.all(entries.map((entry) => rm(resolve(path, entry), { force: true })));
}

test("handleCaptchaChallenge saves verified captcha image to the training dataset", async () => {
  const imageBody = Buffer.from("verified-captcha-image");
  const captchaPath = resolve(TEST_ROOT, "success", "captcha.png");
  const trainingDir = resolve(TEST_ROOT, "success", "dataset");
  await mkdir(dirname(captchaPath), { recursive: true });
  await mkdir(trainingDir, { recursive: true });
  await removeFileIfExists(captchaPath);

  const result = await handleCaptchaChallenge(
    {
      async fetchCaptchaImage() {
        return { body: imageBody, contentType: "image/png" };
      },
      async verifyCaptcha(code) {
        assert.equal(code, "1234");
      }
    },
    {
      manualCaptcha: true,
      captchaPath,
      captchaTrainingDatasetPath: trainingDir,
      promptCaptchaCode: async () => "1234"
    },
    "test captcha"
  );

  assert.equal(result.captchaPath, captchaPath);
  assert.match(basename(result.captchaTrainingPath), /^1234_[0-9T-]+_[a-f0-9]+\.png$/);
  assert.deepEqual(await readFile(result.captchaTrainingPath), imageBody);
});

test("handleCaptchaChallenge verifies model-predicted captcha before prompting", async () => {
  const imageBody = Buffer.from("auto-captcha-image");
  const captchaPath = resolve(TEST_ROOT, "auto", "captcha.png");
  const trainingDir = resolve(TEST_ROOT, "auto", "dataset");
  let prompted = false;
  await mkdir(dirname(captchaPath), { recursive: true });
  await mkdir(trainingDir, { recursive: true });
  await removeFileIfExists(captchaPath);

  const result = await handleCaptchaChallenge(
    {
      async fetchCaptchaImage() {
        return { body: imageBody, contentType: "image/png" };
      },
      async verifyCaptcha(code) {
        assert.equal(code, "2468");
      }
    },
    {
      autoCaptcha: true,
      manualCaptcha: true,
      captchaPath,
      captchaTrainingDatasetPath: trainingDir,
      predictCaptchaCode: async (receivedPath) => {
        assert.equal(receivedPath, captchaPath);
        return "2468";
      },
      promptCaptchaCode: async () => {
        prompted = true;
        return "0000";
      }
    },
    "test captcha"
  );

  assert.equal(prompted, false);
  assert.equal(result.captchaPath, captchaPath);
  assert.match(basename(result.captchaTrainingPath), /^2468_[0-9T-]+_[a-f0-9]+\.png$/);
  assert.deepEqual(await readFile(result.captchaTrainingPath), imageBody);
});

test("handleCaptchaChallenge keeps fetching new captchas with unlimited automatic prediction", async () => {
  const captchaPath = resolve(TEST_ROOT, "auto-retry", "captcha.png");
  const trainingDir = resolve(TEST_ROOT, "auto-retry", "dataset");
  const failedDir = resolve(TEST_ROOT, "auto-retry", "dataset_false");
  const images = [Buffer.from("wrong-image"), Buffer.from("right-image")];
  let fetchCount = 0;
  let verifyCount = 0;
  await mkdir(dirname(captchaPath), { recursive: true });
  await mkdir(trainingDir, { recursive: true });
  await clearDirectoryFiles(failedDir);
  await removeFileIfExists(captchaPath);

  const result = await handleCaptchaChallenge(
    {
      async fetchCaptchaImage() {
        const body = images[fetchCount];
        fetchCount += 1;
        return { body, contentType: "image/png" };
      },
      async verifyCaptcha(code) {
        verifyCount += 1;
        if (code === "1111") {
          throw new Error("验证码不正确");
        }
        assert.equal(code, "2468");
      }
    },
    {
      autoCaptcha: true,
      autoCaptchaMaxAttempts: 0,
      manualCaptcha: false,
      captchaPath,
      captchaTrainingDatasetPath: trainingDir,
      failedCaptchaDatasetPath: failedDir,
      predictCaptchaCode: async () => (fetchCount === 1 ? "1111" : "2468")
    },
    "test captcha"
  );

  assert.equal(fetchCount, 2);
  assert.equal(verifyCount, 2);
  assert.match(basename(result.captchaTrainingPath), /^2468_[0-9T-]+_[a-f0-9]+\.png$/);
  assert.deepEqual(await readFile(result.captchaTrainingPath), images[1]);
  const failedFiles = await readdir(failedDir);
  assert.equal(failedFiles.length, 1);
  assert.match(failedFiles[0], /^1111_[0-9T-]+\.png$/);
  assert.deepEqual(await readFile(resolve(failedDir, failedFiles[0])), images[0]);
});

test("parseArgs enables automatic captcha prediction with an overrideable model path", () => {
  const defaults = parseArgs(["--auto-captcha"]);
  const modelPath = "ml/captcha-recognition/model-custom.pkl";
  const options = parseArgs(["--auto-captcha", "--captcha-model-path", modelPath, "--auto-captcha-max-attempts", "0"]);

  assert.equal(defaults.autoCaptcha, true);
  assert.equal(basename(defaults.captchaModelPath), "model-finetune1.pkl");
  assert.equal(defaults.autoCaptchaMaxAttempts, 0);
  assert.equal(options.autoCaptcha, true);
  assert.equal(options.captchaModelPath, resolve(modelPath));
  assert.equal(options.autoCaptchaMaxAttempts, 0);
});

test("parseArgs configures 1-5 independent workers and keeps the legacy alias", () => {
  const defaults = parseArgs([]);
  const explicit = parseArgs(["--workers", "5"]);
  const legacy = parseArgs(["--detail-concurrency", "2"]);

  assert.equal(defaults.workers, 3);
  assert.equal(defaults.detailConcurrency, 3);
  assert.equal(defaults.autoCaptcha, true);
  assert.equal(defaults.manualCaptcha, false);
  assert.equal(defaults.transientRetryMaxAttempts, 0);
  assert.equal(explicit.workers, 5);
  assert.equal(explicit.detailConcurrency, 5);
  assert.equal(legacy.workers, 2);
  assert.equal(legacy.detailConcurrency, 2);
  assert.throws(() => parseArgs(["--workers", "6"]), /1 到 5/);
  assert.throws(
    () => parseArgs(["--workers", "3", "--detail-concurrency", "2"]),
    /不能设置为不同的值/
  );
});

test("transient BirdReport gateway errors retry beyond the ordinary retry limit", async () => {
  let attempts = 0;
  const client = {
    async postBirdreport() {
      attempts += 1;
      if (attempts <= 4) {
        const error = new Error("BirdReport HTTP 504: Gateway Time-out");
        error.status = 504;
        throw error;
      }
      return { data: { pointId: "point-after-retry", location: "120,30" } };
    }
  };
  const options = {
    maxRetries: 1,
    transientRetryMaxAttempts: 0,
    retryBaseMs: 1,
    requestDelayMs: 0,
    manualCaptcha: false,
    autoCaptcha: false
  };

  assert.equal(isTransientBirdreportError({ message: "BirdReport HTTP 504: timeout" }), true);
  assert.deepEqual(await fetchReportDetail(client, options, { report_id: "retry-report", serial_id: "retry" }), {
    pointId: "point-after-retry",
    location: "120,30"
  });
  assert.equal(attempts, 5);
});

test("worker captcha paths are stable and isolated", () => {
  const basePath = resolve(TEST_ROOT, "workers", "captcha.png");
  assert.equal(getWorkerCaptchaPath(basePath, 0), resolve(TEST_ROOT, "workers", "captcha.worker-01.png"));
  assert.equal(getWorkerCaptchaPath(basePath, 4), resolve(TEST_ROOT, "workers", "captcha.worker-05.png"));
});

test("simultaneous workers solve their own captcha instead of sharing a challenge", async () => {
  const calls = [];
  const makeChallenge = (workerId) => {
    const captchaPath = resolve(TEST_ROOT, "parallel-captcha", `worker-${workerId}.png`);
    return runCaptchaChallengeOnce(
      {
        async fetchCaptchaImage() {
          calls.push(`fetch-${workerId}`);
          return { body: Buffer.from(`image-${workerId}`), contentType: "image/png" };
        },
        async verifyCaptcha(code) {
          calls.push(`verify-${workerId}-${code}`);
          assert.equal(code, `100${workerId}`);
        }
      },
      {
        autoCaptcha: true,
        autoCaptchaMaxAttempts: 0,
        manualCaptcha: false,
        captchaPath,
        captchaTrainingDatasetPath: resolve(TEST_ROOT, "parallel-captcha", "dataset"),
        predictCaptchaCode: async () => `100${workerId}`
      },
      `worker ${workerId}`
    );
  };

  await Promise.all([makeChallenge(1), makeChallenge(2)]);
  assert.ok(calls.includes("fetch-1"));
  assert.ok(calls.includes("fetch-2"));
  assert.ok(calls.includes("verify-1-1001"));
  assert.ok(calls.includes("verify-2-1002"));
});

test("report claimer atomically deduplicates existing and repeated report ids", () => {
  const db = openCrawlerDatabase(":memory:");
  try {
    const report = {
      report_id: "existing-report",
      serial_id: "1",
      report_kind: "normal",
      source_outside_type: 0,
      is_flagged_report: 0,
      start_time: "",
      end_time: "",
      province_name: "",
      city_name: "",
      district_name: "",
      point_name: "",
      point_id: "",
      location: "",
      longitude: null,
      latitude: null,
      location_metadata_fetched: 0,
      location_text: "",
      state: 0,
      taxon_count_reported: 0,
      outside_count: 0,
      fetched_at: new Date().toISOString(),
      raw_report_json: "{}"
    };
    db.prepare(`INSERT INTO reports (
      report_id, serial_id, report_kind, source_outside_type, is_flagged_report,
      start_time, end_time, province_name, city_name, district_name, point_name,
      point_id, location, longitude, latitude, location_metadata_fetched,
      location_text, state, taxon_count_reported, outside_count, fetched_at, raw_report_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(...Object.values(report));

    const claim = createReportClaimer(db, { resume: true });
    assert.deepEqual(claim("new-report"), { claimed: true, reason: "claimed" });
    assert.deepEqual(claim("new-report"), { claimed: false, reason: "duplicate" });
    assert.deepEqual(claim("existing-report"), { claimed: false, reason: "existing" });
    assert.deepEqual(claim("existing-report"), { claimed: false, reason: "duplicate" });
  } finally {
    db.close();
  }
});

test("continuous watermark never advances across an unfinished page", () => {
  const advances = [];
  const watermark = createContinuousWatermark(2, (page) => advances.push(page));
  assert.equal(watermark.markComplete(4), 2);
  assert.equal(watermark.markComplete(5), 2);
  assert.equal(watermark.markComplete(3), 5);
  assert.deepEqual(advances, [5]);
  assert.equal(getFastResumeStartPage({ completedPage: 20 }, { fastResumeOverlapPages: 5 }), 16);
});

test("page worker pool dynamically assigns each page once", async () => {
  const seen = [];
  await runPageWorkerPool(
    [{ id: 1 }, { id: 2 }, { id: 3 }],
    [1, 2, 3, 4, 5],
    async (worker, page) => {
      seen.push({ worker: worker.id, page });
      await new Promise((resolveDelay) => setTimeout(resolveDelay, page % 2));
    }
  );
  assert.deepEqual(seen.map((item) => item.page).sort((a, b) => a - b), [1, 2, 3, 4, 5]);
  assert.ok(new Set(seen.map((item) => item.worker)).size > 1);
});

test("serial queue preserves write order and stop controller is idempotent", async () => {
  const queue = createSerialQueue();
  const order = [];
  await Promise.all([
    queue.enqueue(async () => {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 2));
      order.push(1);
    }),
    queue.enqueue(async () => order.push(2))
  ]);
  await queue.drain();
  assert.deepEqual(order, [1, 2]);

  const stop = createStopController();
  stop.request("SIGINT");
  stop.request("other");
  assert.equal(stop.requested, true);
  assert.equal(stop.reason, "SIGINT");
});

test("crawler workers deduplicate overlapping pages and persist a continuous watermark", async () => {
  const root = resolve(TEST_ROOT, "worker-integration");
  const jsonlPath = resolve(root, "crawler.jsonl");
  await mkdir(root, { recursive: true });
  await removeFileIfExists(jsonlPath);
  const db = openCrawlerDatabase(":memory:");
  const calls = [];
  const pages = {
    1: [
      { reportId: "report-a", serial_id: "a" },
      { reportId: "report-b", serial_id: "b" }
    ],
    2: [
      { reportId: "report-b", serial_id: "b" },
      { reportId: "report-c", serial_id: "c" }
    ]
  };
  const makeClient = (workerId) => ({
    async postBirdreport(url, _referer, payload) {
      calls.push({ workerId, url, payload });
      if (url.endsWith("/chart/summary")) {
        return { data: { report_num_1: 3, report_num_2: 0 } };
      }
      if (url.endsWith("/activity/search")) {
        if (payload.outside_type === 1) {
          return { count: 0, data: [] };
        }
        return { count: 3, data: pages[payload.page] || [] };
      }
      if (url.endsWith("/activity/get")) {
        return { data: { pointId: `point-${payload.reportId}`, location: "120,30" } };
      }
      if (url.endsWith("/activity/taxon")) {
        return { data: [] };
      }
      throw new Error(`unexpected URL: ${url}`);
    }
  });

  try {
    const result = await crawlZhejiangBirdreport({
      db,
      jsonlPath,
      runId: "worker-integration-run",
      workers: 2,
      workerClients: [makeClient(1), makeClient(2)],
      reportPageLimit: 2,
      maxRetries: 1,
      requestDelayMs: 0,
      autoCaptcha: false,
      manualCaptcha: false,
      installSignalHandlers: false
    });

    assert.equal(result.status, "completed");
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM reports").get().count, 3);
    assert.equal(calls.filter((call) => call.url.endsWith("/activity/get") && call.payload.reportId === "report-b").length, 1);
    assert.equal(
      db.prepare("SELECT completed_page AS page FROM crawl_progress WHERE report_kind = 'normal'").get().page,
      2
    );
    const events = (await readFile(jsonlPath, "utf8")).trim().split(/\r?\n/).map(JSON.parse);
    assert.equal(events.filter((event) => event.event === "report-detail").length, 3);
    assert.ok(calls.some((call) => call.workerId === 2));
    const meta = db.prepare("SELECT status, worker_stats_json FROM crawl_meta WHERE run_id = ?").get("worker-integration-run");
    assert.equal(meta.status, "completed");
    assert.equal(JSON.parse(meta.worker_stats_json).length, 2);
  } finally {
    db.close();
  }
});

test("pause request stops new work and does not advance across an incomplete page", async () => {
  const root = resolve(TEST_ROOT, "pause-integration");
  const jsonlPath = resolve(root, "crawler.jsonl");
  await mkdir(root, { recursive: true });
  await removeFileIfExists(jsonlPath);
  const db = openCrawlerDatabase(":memory:");
  const stopController = createStopController();
  const client = {
    async postBirdreport(url, _referer, payload) {
      if (url.endsWith("/chart/summary")) {
        return { data: { report_num_1: 4, report_num_2: 0 } };
      }
      if (url.endsWith("/activity/search")) {
        return payload.outside_type === 1
          ? { count: 0, data: [] }
          : {
              count: 4,
              data: payload.page === 1
                ? [{ reportId: "pause-a" }, { reportId: "pause-b" }]
                : [{ reportId: "pause-c" }, { reportId: "pause-d" }]
            };
      }
      if (url.endsWith("/activity/get")) {
        return { data: { pointId: payload.reportId, location: "120,30" } };
      }
      if (url.endsWith("/activity/taxon")) {
        stopController.request("test-pause");
        return { data: [] };
      }
      throw new Error(`unexpected URL: ${url}`);
    }
  };

  try {
    const result = await crawlZhejiangBirdreport({
      db,
      jsonlPath,
      runId: "pause-integration-run",
      workers: 1,
      workerClients: [client],
      reportPageLimit: 2,
      maxRetries: 1,
      autoCaptcha: false,
      manualCaptcha: false,
      stopController,
      installSignalHandlers: false
    });

    assert.equal(result.status, "paused_signal");
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM reports").get().count, 1);
    assert.equal(
      db.prepare("SELECT completed_page AS page FROM crawl_progress WHERE report_kind = 'normal'").get().page,
      0
    );
    assert.equal(
      db.prepare("SELECT status FROM crawl_meta WHERE run_id = ?").get("pause-integration-run").status,
      "paused_signal"
    );
  } finally {
    db.close();
  }
});

test("parseArgs configures the full rebuild command with unlimited automatic captcha prediction", () => {
  const options = parseArgs([
    "--auto-captcha",
    "--manual-captcha",
    "--open-captcha",
    "--detail-concurrency",
    "1",
    "--no-resume",
    "--auto-captcha-max-attempts",
    "0"
  ]);

  assert.equal(options.autoCaptcha, true);
  assert.equal(options.manualCaptcha, true);
  assert.equal(options.openCaptcha, true);
  assert.equal(options.detailConcurrency, 1);
  assert.equal(options.resume, false);
  assert.equal(options.autoCaptchaMaxAttempts, 0);
});

test("report detail requests preserve point metadata and fetch all taxa", async () => {
  const calls = [];
  const client = {
    async postBirdreport(url, referer, payload) {
      calls.push({ url, referer, payload });
      return {
        data: url.endsWith("/get")
          ? { pointId: "point-42", location: "120.1234,30.5678" }
          : []
      };
    }
  };
  const options = {
    maxRetries: 1,
    retryBaseMs: 1,
    requestDelayMs: 0,
    manualCaptcha: false,
    autoCaptcha: false
  };
  const report = { report_id: "report-42", serial_id: "42" };

  assert.deepEqual(await fetchReportDetail(client, options, report), {
    pointId: "point-42",
    location: "120.1234,30.5678"
  });
  assert.deepEqual(await fetchReportTaxa(client, options, report), []);
  assert.deepEqual(calls.map((call) => ({ url: call.url, payload: call.payload })), [
    {
      url: "https://api.birdreport.cn/front/activity/get",
      payload: { reportId: "report-42" }
    },
    {
      url: "https://api.birdreport.cn/front/activity/taxon",
      payload: { reportId: "report-42", limit: 1500 }
    }
  ]);
});

test("normalizeReportDetail retains pointId and parses longitude and latitude", () => {
  assert.deepEqual(parseLocationCoordinates("120.1234,30.5678"), {
    longitude: 120.1234,
    latitude: 30.5678
  });
  assert.deepEqual(normalizeReportDetail({ pointId: 0, location: "120.1234,30.5678" }), {
    point_id: "0",
    location: "120.1234,30.5678",
    longitude: 120.1234,
    latitude: 30.5678,
    location_metadata_fetched: 1
  });
  assert.deepEqual(parseLocationCoordinates("not-a-coordinate"), {
    longitude: null,
    latitude: null
  });
});

test("handleCaptchaChallenge keeps repeated verified captcha samples instead of overwriting", async () => {
  const captchaPath = resolve(TEST_ROOT, "repeat", "captcha.png");
  const trainingDir = resolve(TEST_ROOT, "repeat", "dataset");
  await mkdir(dirname(captchaPath), { recursive: true });
  await mkdir(trainingDir, { recursive: true });
  await removeFileIfExists(captchaPath);

  const first = await handleCaptchaChallenge(
    {
      async fetchCaptchaImage() {
        return { body: Buffer.from("first-image"), contentType: "image/png" };
      },
      async verifyCaptcha() {}
    },
    {
      manualCaptcha: true,
      captchaPath,
      captchaTrainingDatasetPath: trainingDir,
      promptCaptchaCode: async () => "1234"
    },
    "test captcha"
  );
  const second = await handleCaptchaChallenge(
    {
      async fetchCaptchaImage() {
        return { body: Buffer.from("second-image"), contentType: "image/png" };
      },
      async verifyCaptcha() {}
    },
    {
      manualCaptcha: true,
      captchaPath,
      captchaTrainingDatasetPath: trainingDir,
      promptCaptchaCode: async () => "1234"
    },
    "test captcha"
  );

  assert.notEqual(first.captchaTrainingPath, second.captchaTrainingPath);
  assert.deepEqual(await readFile(first.captchaTrainingPath), Buffer.from("first-image"));
  assert.deepEqual(await readFile(second.captchaTrainingPath), Buffer.from("second-image"));
});

test("handleCaptchaChallenge saves failed captcha attempts outside the verified training dataset", async () => {
  const captchaPath = resolve(TEST_ROOT, "failure", "captcha.png");
  const trainingPath = resolve(TEST_ROOT, "failure", "dataset", "9999.png");
  const failedDir = resolve(TEST_ROOT, "failure", "dataset_false");
  await mkdir(dirname(captchaPath), { recursive: true });
  await mkdir(dirname(trainingPath), { recursive: true });
  await clearDirectoryFiles(failedDir);
  await removeFileIfExists(captchaPath);
  await removeFileIfExists(trainingPath);

  await assert.rejects(
    () =>
      handleCaptchaChallenge(
        {
          async fetchCaptchaImage() {
            return { body: Buffer.from("failed-captcha-image"), contentType: "image/png" };
          },
          async verifyCaptcha() {
            throw new Error("验证码不正确");
          }
        },
        {
          manualCaptcha: true,
          captchaPath,
          captchaTrainingDatasetPath: dirname(trainingPath),
          failedCaptchaDatasetPath: failedDir,
          promptCaptchaCode: async () => "9999"
        },
        "test captcha"
      ),
    /验证码不正确/
  );

  await assert.rejects(() => readFile(trainingPath), { code: "ENOENT" });
  const failedFiles = await readdir(failedDir);
  assert.equal(failedFiles.length, 1);
  assert.match(failedFiles[0], /^9999_[0-9T-]+\.png$/);
  assert.deepEqual(await readFile(resolve(failedDir, failedFiles[0])), Buffer.from("failed-captcha-image"));
});

test("openCrawlerDatabase migrates a legacy reports table with point metadata columns", async () => {
  const dbPath = resolve(TEST_ROOT, "schema-migration", "crawler.sqlite");
  await mkdir(dirname(dbPath), { recursive: true });
  await removeFileIfExists(dbPath);

  const legacyDb = new DatabaseSync(dbPath);
  legacyDb.exec(`
    CREATE TABLE crawl_meta (
      run_id TEXT PRIMARY KEY,
      province TEXT NOT NULL,
      version TEXT NOT NULL,
      started_at TEXT NOT NULL,
      status TEXT NOT NULL
    );

    CREATE TABLE reports (
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
    )
  `);
  legacyDb.close();

  const db = openCrawlerDatabase(dbPath);
  try {
    const columns = db.prepare("PRAGMA table_info(reports)").all().map((column) => column.name);
    assert.ok(["point_id", "location", "longitude", "latitude", "location_metadata_fetched"].every((column) => columns.includes(column)));
    const crawlMetaColumns = db.prepare("PRAGMA table_info(crawl_meta)").all().map((column) => column.name);
    assert.ok(crawlMetaColumns.includes("worker_stats_json"));
  } finally {
    db.close();
  }
});

test("writeReportWithObservations stores point metadata in SQLite and JSONL", async () => {
  const dbPath = resolve(TEST_ROOT, "point-metadata", "crawler.sqlite");
  const jsonlPath = resolve(TEST_ROOT, "point-metadata", "crawler.jsonl");
  await mkdir(dirname(dbPath), { recursive: true });
  await removeFileIfExists(dbPath);
  await removeFileIfExists(jsonlPath);
  const db = openCrawlerDatabase(dbPath);

  try {
    const report = mergeReportDetail(
      {
        report_id: "report-point-1",
        serial_id: "serial-point-1",
        report_kind: "normal",
        source_outside_type: 0,
        is_flagged_report: 0,
        start_time: "2026-05-07",
        end_time: "2026-05-07",
        province_name: "Zhejiang",
        city_name: "Hangzhou",
        district_name: "",
        point_name: "Wetland",
        location_text: "ZhejiangHangzhouWetland",
        state: 2,
        taxon_count_reported: 1,
        outside_count: 0,
        fetched_at: "2026-05-07T00:00:00.000Z",
        raw_report_json: "{}"
      },
      { pointId: "point-77", location: "120.1234,30.5678" }
    );

    await writeReportWithObservations({
      db,
      jsonlPath,
      runId: "run-point-1",
      report,
      rawTaxa: [{ taxon_id: "100", taxonname: "Test Bird", outside_type: 0 }]
    });

    assert.deepEqual(
      { ...db.prepare("SELECT point_id, location, longitude, latitude, location_metadata_fetched FROM reports WHERE report_id = ?").get("report-point-1") },
      {
        point_id: "point-77",
        location: "120.1234,30.5678",
        longitude: 120.1234,
        latitude: 30.5678,
        location_metadata_fetched: 1
      }
    );
    const jsonlRecord = JSON.parse(await readFile(jsonlPath, "utf8"));
    assert.equal(jsonlRecord.report.point_id, "point-77");
    assert.equal(jsonlRecord.report.longitude, 120.1234);
    assert.equal(jsonlRecord.report.latitude, 30.5678);
  } finally {
    db.close();
  }
});

test("writeReportWithObservations rolls back SQLite writes when JSONL append fails", async () => {
  const dbPath = resolve(TEST_ROOT, "jsonl-rollback", "crawler.sqlite");
  const jsonlPath = resolve(TEST_ROOT, "jsonl-rollback", "jsonl-directory");
  await mkdir(dirname(dbPath), { recursive: true });
  await mkdir(jsonlPath, { recursive: true });
  await removeFileIfExists(dbPath);
  const db = openCrawlerDatabase(dbPath);

  try {
    await assert.rejects(
      () =>
        writeReportWithObservations({
          db,
          jsonlPath,
          runId: "run-1",
          report: {
            report_id: "report-1",
            serial_id: "serial-1",
            report_kind: "normal",
            source_outside_type: 0,
            is_flagged_report: 0,
            start_time: "2026-05-07",
            end_time: "2026-05-07",
            province_name: "Zhejiang",
            city_name: "Hangzhou",
            district_name: "",
            point_name: "Wetland",
            location_text: "ZhejiangHangzhouWetland",
            state: 2,
            taxon_count_reported: 1,
            outside_count: 0,
            fetched_at: "2026-05-07T00:00:00.000Z",
            raw_report_json: "{}"
          },
          rawTaxa: [{ taxon_id: "100", taxonname: "Test Bird", outside_type: 0 }]
        }),
      { code: "EISDIR" }
    );

    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM reports WHERE report_id = ?").get("report-1").count, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM observations WHERE report_id = ?").get("report-1").count, 0);
  } finally {
    db.close();
  }
});
