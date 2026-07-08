import assert from "node:assert/strict";
import { mkdir, readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { test } from "node:test";

import { handleCaptchaChallenge } from "./crawl-zhejiang-birdreport.mjs";

const TEST_ROOT = resolve(".tmp/crawl-zhejiang-birdreport-captcha-test");

async function removeFileIfExists(path) {
  await rm(path, { force: true });
}

test("handleCaptchaChallenge saves verified captcha image to the training dataset", async () => {
  const imageBody = Buffer.from("verified-captcha-image");
  const captchaPath = resolve(TEST_ROOT, "success", "captcha.png");
  const trainingPath = resolve(TEST_ROOT, "success", "dataset", "1234.png");
  await mkdir(dirname(captchaPath), { recursive: true });
  await mkdir(dirname(trainingPath), { recursive: true });
  await removeFileIfExists(captchaPath);
  await removeFileIfExists(trainingPath);

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
      captchaTrainingDatasetPath: dirname(trainingPath),
      promptCaptchaCode: async () => "1234"
    },
    "test captcha"
  );

  assert.equal(result.captchaPath, captchaPath);
  assert.equal(result.captchaTrainingPath, trainingPath);
  assert.deepEqual(await readFile(trainingPath), imageBody);
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
