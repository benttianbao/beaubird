const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");

const script = readFileSync("script.js", "utf8");

test("direct file usage keeps the local BirdReport proxy default", () => {
  assert.match(
    script,
    /window\.location\.protocol === "file:"[\s\S]*?return DEFAULT_BIRDREPORT_PROXY_URL;/,
    "direct webpage usage should prefill the local BirdReport proxy"
  );
});

test("hosted web usage defaults to same-origin BirdReport proxy", () => {
  assert.match(
    script,
    /return window\.location\.origin;/,
    "hosted pages should use the current site origin for /api/birdreport requests"
  );
});

test("hosted web usage ignores stale local proxy storage", () => {
  assert.match(
    script,
    /getUsableStoredBirdreportProxyUrl\(stored\) \|\| getDefaultBirdreportProxyUrl\(\)/,
    "hydration should filter stale local proxy values before falling back"
  );
  assert.match(
    script,
    /LOCAL_BIRDREPORT_PROXY_HOSTS\.has\(url\.hostname\) && url\.port === "8787"[\s\S]*?return "";/,
    "stored http://127.0.0.1:8787 should not break hosted deployments"
  );
});
