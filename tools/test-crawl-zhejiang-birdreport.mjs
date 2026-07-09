import assert from "node:assert/strict";
import { mkdir, readFile, rm } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { test } from "node:test";

import { handleCaptchaChallenge, openCrawlerDatabase, parseArgs, writeReportWithObservations } from "./crawl-zhejiang-birdreport.mjs";

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
  const images = [Buffer.from("wrong-image"), Buffer.from("right-image")];
  let fetchCount = 0;
  let verifyCount = 0;
  await mkdir(dirname(captchaPath), { recursive: true });
  await mkdir(trainingDir, { recursive: true });
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
      predictCaptchaCode: async () => (fetchCount === 1 ? "1111" : "2468")
    },
    "test captcha"
  );

  assert.equal(fetchCount, 2);
  assert.equal(verifyCount, 2);
  assert.match(basename(result.captchaTrainingPath), /^2468_[0-9T-]+_[a-f0-9]+\.png$/);
  assert.deepEqual(await readFile(result.captchaTrainingPath), images[1]);
});

test("parseArgs enables automatic captcha prediction with an overrideable model path", () => {
  const defaults = parseArgs(["--auto-captcha"]);
  const modelPath = "pytorch-captcha-recognition/model-custom.pkl";
  const options = parseArgs(["--auto-captcha", "--captcha-model-path", modelPath, "--auto-captcha-max-attempts", "0"]);

  assert.equal(defaults.autoCaptcha, true);
  assert.equal(basename(defaults.captchaModelPath), "model-finetune1.pkl");
  assert.equal(defaults.autoCaptchaMaxAttempts, 3);
  assert.equal(options.autoCaptcha, true);
  assert.equal(options.captchaModelPath, resolve(modelPath));
  assert.equal(options.autoCaptchaMaxAttempts, 0);
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
