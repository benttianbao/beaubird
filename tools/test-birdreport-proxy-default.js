const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");

const script = readFileSync("script.js", "utf8");

test("web BirdReport defaults to the local proxy for direct index.html usage", () => {
  assert.match(
    script,
    /const DEFAULT_BIRDREPORT_PROXY_URL = "http:\/\/127\.0\.0\.1:8787";/,
    "direct webpage usage should prefill the local BirdReport proxy"
  );
});

test("stored local proxy URL is not discarded as legacy", () => {
  assert.doesNotMatch(
    script,
    /stored !== LEGACY_WEB_BIRDREPORT_PROXY_URL/,
    "the saved http://127.0.0.1:8787 proxy should remain valid"
  );
});
