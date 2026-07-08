import assert from "node:assert/strict";
import { mkdir, readFile, rm } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { test } from "node:test";

import { handleCaptchaChallenge, openCrawlerDatabase, writeReportWithObservations } from "./crawl-zhejiang-birdreport.mjs";

const TEST_ROOT = resolve(".tmp/crawl-zhejiang-birdreport-captcha-test");

async function removeFileIfExists(path) {
  await rm(path, { force: true });
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

test("handleCaptchaChallenge does not save failed captcha attempts to the training dataset", async () => {
  const captchaPath = resolve(TEST_ROOT, "failure", "captcha.png");
  const trainingPath = resolve(TEST_ROOT, "failure", "dataset", "9999.png");
  await mkdir(dirname(captchaPath), { recursive: true });
  await mkdir(dirname(trainingPath), { recursive: true });
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
          promptCaptchaCode: async () => "9999"
        },
        "test captcha"
      ),
    /验证码不正确/
  );

  await assert.rejects(() => readFile(trainingPath), { code: "ENOENT" });
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
