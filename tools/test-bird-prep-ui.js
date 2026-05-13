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

test("bird prep query controls include district and point name filters", () => {
  assert.match(html, /id="birdPrepDistrict"/);
  assert.match(html, /id="birdPrepPointName"/);
  assert.match(script, /birdPrepDistrict: document\.querySelector\("#birdPrepDistrict"\)/);
  assert.match(script, /birdPrepPointName: document\.querySelector\("#birdPrepPointName"\)/);
});

test("bird prep query controls include optional unlocked username filter", () => {
  assert.match(html, /id="birdPrepUnlockedUsername"/);
  assert.match(script, /birdPrepUnlockedUsername: document\.querySelector\("#birdPrepUnlockedUsername"\)/);
  assert.match(script, /birdPrepUnlockedSpeciesCache: new Map\(\)/);
});

test("bird prep city changes load district options", () => {
  assert.match(script, /bindIfPresent\(elements\.birdPrepCity, "change", handleBirdPrepCityChange\)/);
  assert.match(script, /function handleBirdPrepCityChange\(\)/);
  assert.match(script, /resetSelectOptions\(elements\.birdPrepDistrict, "请选择区"\)/);
  assert.match(script, /birdreportProxyPost\("\/api\/birdreport\/district", \{ city_code: cityCode \}\)/);
  assert.match(script, /renderBirdreportRegionOptions\(elements\.birdPrepDistrict/);
});

test("bird prep query payload includes district and point name", () => {
  assert.match(script, /const district = String\(elements\.birdPrepDistrict\?\.value \|\| ""\)\.trim\(\);/);
  assert.match(script, /const pointname = String\(elements\.birdPrepPointName\?\.value \|\| ""\)\.trim\(\);/);
  assert.match(script, /return createBirdreportPayload\(\{ startTime, endTime, province, city, district, pointname \}\);/);
  assert.match(script, /payload\.pointname \? `观测地点“\$\{payload\.pointname\}”` : ""/);
});

test("bird prep username changes clear current species results", () => {
  assert.match(script, /bindIfPresent\(elements\.birdPrepUnlockedUsername, "input", clearBirdPrepSpeciesResults\)/);
});

test("bird prep query filters species unlocked by username but keeps unfiltered results on lookup failure", () => {
  assert.match(script, /function getBirdPrepUnlockedUsername\(\)/);
  assert.match(script, /async function fetchUserNationalBirdPrepSpecies\(username, options = \{\}\)/);
  assert.match(script, /createBirdreportPayload\(\{ username, mode: 1 \}\)/);
  assert.match(script, /createBirdreportPayload\(\{ username \}\)/);
  assert.match(script, /async function getBirdPrepUnlockedSpeciesForUser\(username, options = \{\}\)/);
  assert.match(script, /state\.birdPrepUnlockedSpeciesCache\.has\(username\)/);
  assert.match(script, /filterBirdPrepSpeciesByUnlocked\(results, unlockedLookup\)/);
  assert.match(script, /catch \(filterError\)[\s\S]*当前列表未过滤/);
});

test("bird prep unlocked filtering matches taxon keys and Chinese names", () => {
  assert.match(script, /function buildBirdPrepUnlockedTaxonLookup\(items\)/);
  assert.match(script, /keys: new Set\(\)/);
  assert.match(script, /names: new Set\(\)/);
  assert.match(script, /lookup\.keys\.has\(getBirdreportTaxonKey\(item\)\)/);
  assert.match(script, /lookup\.names\.has\(getBirdPrepTaxonName\(item\)\)/);
  assert.match(script, /removedCount: sourceSpecies\.length - filteredSpecies\.length/);
});

test("bird prep loading state disables all query filters", () => {
  assert.match(
    script,
    /\[elements\.birdPrepProvince, elements\.birdPrepCity, elements\.birdPrepDistrict, elements\.birdPrepPointName, elements\.birdPrepUnlockedUsername, elements\.birdPrepStartDate, elements\.birdPrepEndDate\]/
  );
});

test("bird prep profile data is lazy-loaded instead of blocking the initial page", () => {
  assert.doesNotMatch(html, /src="\.\/china_bird_results\.js[^"]*"/);
  assert.match(script, /const CHINA_BIRD_RESULTS_GLOBAL = "BEAUBIRD_CHINA_BIRD_RESULTS";/);
  assert.match(script, /window\[CHINA_BIRD_RESULTS_GLOBAL\]/);
  assert.match(script, /function loadBirdPrepEmbeddedDataScript\(\)/);
  assert.match(script, /script\.src = CHINA_BIRD_RESULTS_SCRIPT_URL;/);
});

test("bird prep profile fetch reports expired login before parsing HTML as JSON", () => {
  assert.match(script, /const BIRD_PREP_LOGIN_EXPIRED_MESSAGE = "登录已过期，请重新登录后再生成 PPT。";/);
  assert.match(script, /function assertBirdPrepProfileResponse\(response\)/);
  assert.match(script, /response\.redirected/);
  assert.match(script, /\/login/);
  assert.match(script, /content-type/);
  assert.match(script, /throw new Error\(BIRD_PREP_LOGIN_EXPIRED_MESSAGE\);/);
});

test("bird prep embedded data script can retry after a failed load", () => {
  assert.match(script, /existingScript\.dataset\.loaded === "true"/);
  assert.match(script, /existingScript\.dataset\.failed === "true"[\s\S]*existingScript\.remove\(\)/);
  assert.match(script, /script\.dataset\.loaded = "true";/);
  assert.match(script, /script\.dataset\.failed = "true";/);
});
