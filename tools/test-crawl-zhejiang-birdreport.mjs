import assert from "node:assert/strict";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

import {
  fetchReportDetail,
  fetchReportTaxa,
  handleCaptchaChallenge,
  mergeReportDetail,
  normalizeReportDetail,
  openCrawlerDatabase,
  parseArgs,
  parseLocationCoordinates,
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

test("handleCaptchaChallenge fetches a new captcha for each failed automatic prediction", async () => {
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
      autoCaptchaMaxAttempts: 2,
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
  assert.equal(defaults.autoCaptchaMaxAttempts, 10);
  assert.equal(options.autoCaptcha, true);
  assert.equal(options.captchaModelPath, resolve(modelPath));
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
