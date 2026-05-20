const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const { test } = require("node:test");

const html = readFileSync("index.html", "utf8");
const css = readFileSync("style.css", "utf8");
const script = readFileSync("script.js", "utf8");
const sitePages = readFileSync("server/site/pages.js", "utf8");
const androidBuildGradle = readFileSync("android/app/build.gradle", "utf8");
const androidBuildGradleKts = readFileSync("android/app/build.gradle.kts", "utf8");
const androidLocalServer = readFileSync("android/app/src/main/java/cn/beaubird/app/BeauBirdLocalServer.kt", "utf8");

function indexOfRequired(source, needle) {
  const index = source.indexOf(needle);
  assert.notEqual(index, -1, `Expected to find ${needle}`);
  return index;
}

test("main page presents BeauBird as a professional split workspace", () => {
  assert.match(html, /<header class="hero workspace-hero">/);
  assert.match(html, /BeauBird Workspace/);
  assert.match(html, /<div class="workspace-shell">/);
  assert.match(html, /<aside class="workspace-sidebar" aria-label="工作台工具导航">/);
  assert.match(html, /<main class="container workspace-content">/);
  assert.doesNotMatch(html, /class="hero-status-grid"/);
  assert.doesNotMatch(html, /class="hero-status-list"/);
  assert.doesNotMatch(html, /BirdReport 同源查询/);
  assert.doesNotMatch(html, /地区鸟种预习/);
  assert.doesNotMatch(html, /浙江稀有记录/);
  assert.doesNotMatch(html, /基线规则固定为/);
  assert.doesNotMatch(html, /每隔 1 小时自动检查/);
  assert.doesNotMatch(html, /输入记录用户姓名，按浙江 588 种鸟种名录核对该用户还缺哪些鸟种。/);
  assert.doesNotMatch(html, /缺口列表按浙江历史记录数从多到少排列/);
  assert.match(html, /class="workspace-nav-label">工具导航<\/span>/);
});

test("zhejiang rare bird monitor starts without instructional placeholder copy", () => {
  assert.doesNotMatch(script, /先保存一次浙江稀有鸟种名单，再开启每小时监测。/);
});

test("desktop workspace uses a sticky sidebar navigation", () => {
  assert.match(css, /\.workspace-shell\s*\{[\s\S]*grid-template-columns: 224px minmax\(0, 1fr\);/);
  assert.match(css, /\.workspace-sidebar\s*\{[\s\S]*position: sticky;[\s\S]*top: 0;/);
  assert.match(css, /\.app-quicknav\s*\{[\s\S]*display: grid;[\s\S]*position: static;/);
  assert.doesNotMatch(css, /\.app-quicknav\s*\{\s*display: none;\s*\}/);
});

test("main page uses a restrained product visual system", () => {
  assert.match(css, /--bg: oklch\(96\.8% 0\.006 190\);/);
  assert.match(css, /--surface: oklch\(99% 0\.004 190\);/);
  assert.match(css, /--sidebar: oklch\(94\.8% 0\.008 190\);/);
  assert.match(css, /--radius: 8px;/);
  assert.match(css, /--shadow-subtle: 0 1px 2px rgba\(24, 36, 38, 0\.06\);/);
  assert.match(css, /\.panel\s*\{[\s\S]*border-radius: var\(--radius\);[\s\S]*box-shadow: none;/);
});

test("mobile workspace falls back to a horizontal sticky tool navigation", () => {
  assert.match(css, /@media \(max-width: 860px\) \{[\s\S]*\.workspace-shell\s*\{[\s\S]*grid-template-columns: 1fr;/);
  assert.match(css, /@media \(max-width: 860px\) \{[\s\S]*\.workspace-sidebar\s*\{[\s\S]*position: sticky;[\s\S]*top: 0;/);
  assert.match(css, /@media \(max-width: 860px\) \{[\s\S]*\.workspace-nav-items\s*\{[\s\S]*grid-auto-flow: column;[\s\S]*overflow-x: auto;/);
});

test("unlocked species results render as a contained scroll module", () => {
  assert.match(script, /const UNLOCKED_SPECIES_VISIBLE_ROW_COUNT = 15;/);
  assert.match(script, /unlocked-species-module/);
  assert.match(script, /unlocked-species-scroll/);
  assert.match(script, /unlocked-module-toggle/);
  assert.doesNotMatch(script, /unlocked-floating-table-toggle/);
  assert.match(css, /\.unlocked-species-module\s*\{/);
  assert.match(css, /--unlocked-visible-rows: 15;/);
  assert.match(
    css,
    /\.unlocked-species-scroll\s*\{[\s\S]*max-height: calc\([\s\S]*overflow-y: auto;[\s\S]*overscroll-behavior: contain;/
  );
});

test("birdreport tools use the default backend without proxy address controls", () => {
  assert.doesNotMatch(html, /birdPrepProxyUrl/);
  assert.doesNotMatch(html, /birdreportProxyUrl/);
  assert.doesNotMatch(html, /代理地址/);
  assert.doesNotMatch(html, /通过代理查询鸟种/);
  assert.doesNotMatch(html, /网页版需要先在本机运行代理脚本/);
  assert.doesNotMatch(html, /BirdReport 代理查询/);
  assert.doesNotMatch(script, /elements\.birdreportProxyUrl\.value/);
  assert.doesNotMatch(script, /elements\.birdPrepProxyUrl\.value/);
  assert.doesNotMatch(script, /通过代理查询鸟种/);
  assert.match(script, /function getBirdreportProxyBaseUrl\(\)/);
});

test("site auth and admin pages share the BeauBird product shell", () => {
  assert.match(sitePages, /auth-shell/);
  assert.match(sitePages, /auth-card/);
  assert.match(sitePages, /admin-shell/);
  assert.match(sitePages, /admin-table-wrap/);
  assert.match(sitePages, /--surface:oklch\(99% 0\.004 190\);/);
  assert.match(sitePages, /--sidebar:oklch\(94\.8% 0\.008 190\);/);
  assert.match(sitePages, /button\.danger/);
});

test("main tool modules follow the monitoring-first workflow order", () => {
  const order = [
    indexOfRequired(html, 'id="monitorSection"'),
    indexOfRequired(html, 'id="unlockedSection"'),
    indexOfRequired(html, 'id="birdPrepSection"'),
    indexOfRequired(html, 'id="ebirdSection"'),
    indexOfRequired(html, 'id="ebirdSeasonalPanel"'),
    indexOfRequired(html, 'id="birdreportSection"')
  ];

  assert.deepEqual([...order].sort((left, right) => left - right), order);
});

test("quick navigation follows the same monitoring-first workflow order", () => {
  const nav = html.match(/<nav class="app-quicknav workspace-nav"[\s\S]*?<\/nav>/);
  assert.ok(nav);

  const targets = Array.from(nav[0].matchAll(/data-target="([^"]+)"/g), (match) => match[1]);
  assert.deepEqual(targets, [
    "monitorSection",
    "unlockedSection",
    "birdPrepSection",
    "ebirdSection",
    "birdreportSection"
  ]);

  assert.match(
    script,
    /const sections = \["monitorSection", "unlockedSection", "birdPrepSection", "ebirdSection", "birdreportSection"\]/
  );
});

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

test("bird prep PPT can opt into Macaulay Library images with usage confirmation", () => {
  assert.match(html, /id="birdPrepMacaulayImages"/);
  assert.match(html, /id="birdPrepMacaulayRights"/);
  assert.match(html, /Macaulay Library/);
  assert.match(script, /birdPrepMacaulayImages: document\.querySelector\("#birdPrepMacaulayImages"\)/);
  assert.match(script, /birdPrepMacaulayRights: document\.querySelector\("#birdPrepMacaulayRights"\)/);
  assert.match(script, /loadBirdPrepMacaulayPhotos\(selectedSpecies, slides/);
  assert.doesNotMatch(script, /if \(!apiKey\) \{\s*return new Map\(\);\s*\}/);
  assert.match(script, /const headers = apiKey \?/);
  assert.match(script, /正在匹配 Macaulay 图片/);
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
  assert.doesNotMatch(html, /src="\.\/all_birds_full\.js[^"]*"/);
  assert.match(script, /const ALL_BIRDS_FULL_DATA_URL = "\.\/all_birds_full\.json";/);
  assert.match(script, /const ALL_BIRDS_FULL_SCRIPT_URL = "\.\/all_birds_full\.js";/);
  assert.match(script, /const ALL_BIRDS_FULL_GLOBAL = "BEAUBIRD_ALL_BIRDS_FULL";/);
  assert.match(script, /window\[ALL_BIRDS_FULL_GLOBAL\]/);
  assert.match(script, /function loadBirdPrepEmbeddedDataScript\(\)/);
  assert.match(script, /script\.src = ALL_BIRDS_FULL_SCRIPT_URL;/);
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

test("shared data and utility modules load before the app script", () => {
  assert.ok(existsSync("beaubird-utils.js"));
  assert.ok(existsSync("beaubird-data.js"));
  const utils = readFileSync("beaubird-utils.js", "utf8");
  const data = readFileSync("beaubird-data.js", "utf8");

  const utilsIndex = indexOfRequired(html, 'src="./beaubird-utils.js');
  const dataIndex = indexOfRequired(html, 'src="./beaubird-data.js');
  const scriptIndex = indexOfRequired(html, 'src="./script.js');
  assert.ok(utilsIndex < scriptIndex);
  assert.ok(dataIndex < scriptIndex);
  assert.match(utils, /formatCompactTimestamp/);
  assert.match(data, /birdreportMunicipalityAreas/);
  assert.match(data, /traditionalPhraseReplacements/);
  assert.match(data, /traditionalCharMap/);
  assert.match(data, /commonBirdTaxonomy/);
});

test("main script consumes shared data and removes the unused unlocked export overlay", () => {
  assert.match(script, /window\.BeauBirdUtils/);
  assert.match(script, /window\.BeauBirdData/);
  assert.doesNotMatch(script, /const BIRDREPORT_MUNICIPALITY_AREAS = \[/);
  assert.doesNotMatch(script, /const TRADITIONAL_CHAR_MAP = \{/);
  assert.doesNotMatch(script, /const COMMON_BIRD_TAXONOMY = \{/);
  assert.doesNotMatch(script, /function renderUnlockedSpeciesExportOverlay/);
});

test("Android assets include current shared modules and all birds profile data", () => {
  for (const source of [androidBuildGradle, androidBuildGradleKts, androidLocalServer]) {
    assert.match(source, /beaubird-utils\.js/);
    assert.match(source, /beaubird-data\.js/);
    assert.match(source, /all_birds_full\.json/);
    assert.match(source, /all_birds_full\.js/);
    assert.doesNotMatch(source, /china_bird_results\.js/);
  }
});

test("Android local server rejects oversized request bodies", () => {
  assert.match(androidLocalServer, /MAX_REQUEST_BODY_BYTES = 1024 \* 1024/);
  assert.match(androidLocalServer, /Request body too large/);
  assert.match(androidLocalServer, /413 -> "Payload Too Large"/);
});
