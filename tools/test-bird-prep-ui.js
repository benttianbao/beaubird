const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");

const html = readFileSync("index.html", "utf8");
const script = readFileSync("script.js", "utf8");

test("bird prep species picker uses checkboxes instead of native multi-select", () => {
  assert.match(html, /id="birdPrepSpeciesOptions"/);
  assert.doesNotMatch(html, /id="birdPrepSpeciesSelect"[^>]*multiple/);
  assert.match(script, /type = "checkbox"/);
  assert.match(script, /data-bird-prep-species-key/);
});

test("bird prep profiles are available without fetch when opening index.html directly", () => {
  assert.match(html, /src="\.\/china_bird_results\.js[^"]*"/);
  assert.match(html, /china_bird_results\.js[\s\S]+script\.js/);
  assert.match(script, /const CHINA_BIRD_RESULTS_GLOBAL = "BEAUBIRD_CHINA_BIRD_RESULTS";/);
  assert.match(script, /window\[CHINA_BIRD_RESULTS_GLOBAL\]/);
});
