const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const { test } = require("node:test");

const html = readFileSync("index.html", "utf8");
const css = readFileSync("style.css", "utf8");
const script = readFileSync("script.js", "utf8");
const birdreportCore = readFileSync("beaubird-birdreport-core.js", "utf8");
const siteApp = readFileSync("server/site/app.js", "utf8");
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

test("main workspace is organized into reusable display components", () => {
  assert.match(html, /<section id="monitorSection" class="panel workspace-panel workspace-panel--priority birdreport-monitor-panel" aria-labelledby="monitorSectionTitle">/);
  assert.match(html, /<header class="workspace-panel-header">[\s\S]*<p class="workspace-panel-kicker">监测<\/p>[\s\S]*<h2 id="monitorSectionTitle">浙江稀有鸟种监测<\/h2>/);
  assert.match(html, /<div class="workspace-panel-body">[\s\S]*<div class="controls control-grid birdreport-monitor-controls">/);
  assert.match(html, /<div class="actions action-bar birdreport-monitor-actions">/);
  assert.match(html, /<div class="result-zone" aria-live="polite">[\s\S]*id="zhejiangRareSpeciesMessage"/);
  assert.match(html, /<section id="birdPrepSection" class="panel workspace-panel bird-prep-panel" aria-labelledby="birdPrepSectionTitle">/);
  assert.match(html, /<section id="ebirdSection" class="panel workspace-panel" aria-labelledby="ebirdSectionTitle">/);
  assert.match(html, /<div class="sub-panel ebird-seasonal-panel" id="ebirdSeasonalPanel">/);
  assert.match(css, /\.workspace-panel-header\s*\{/);
  assert.match(css, /\.workspace-panel--priority\s*\{/);
  assert.match(css, /\.workspace-panel-body\s*\{/);
  assert.match(css, /\.control-grid\s*\{/);
  assert.match(css, /\.action-bar\s*\{/);
  assert.match(css, /\.result-zone\s*\{/);
  assert.match(css, /\.sub-panel\s*\{/);
});

test("zhejiang rare bird monitor starts without instructional placeholder copy", () => {
  assert.doesNotMatch(script, /先保存一次浙江稀有鸟种名单，再开启每小时监测。/);
});

test("zhejiang rare bird monitor automatically runs one daily query on startup", () => {
  const bootstrapIndex = indexOfRequired(script, "function bootstrap()");
  const autoQueryCallIndex = indexOfRequired(script, "initZhejiangRareSpeciesDailyQuery();");
  const monitorResumeIndex = indexOfRequired(script, "initZhejiangRareSpeciesMonitor();");
  const unlockedMessageIndex = indexOfRequired(script, "setUnlockedSpeciesMessage(");

  assert.ok(monitorResumeIndex < autoQueryCallIndex);
  assert.ok(unlockedMessageIndex < autoQueryCallIndex);
  assert.match(script, /function hydrateZhejiangRareMonitorInputs\(\) \{[\s\S]*const targetDate = formatIsoDate\(new Date\(\)\);[\s\S]*state\.zhejiangRareMonitor\.targetDate = targetDate;/);
  assert.match(script, /async function initZhejiangRareSpeciesDailyQuery\(\) \{[\s\S]*state\.zhejiangRareMonitor\.enabled[\s\S]*return;[\s\S]*await saveZhejiangRareSpecies\(\);[\s\S]*checkZhejiangRareSpeciesToday\(\{ source: "auto", notify: false \}\);/);
  assert.match(script, /checkZhejiangRareSpeciesToday\(\{ source: "auto", notify: false \}\);/);
  assert.ok(bootstrapIndex < autoQueryCallIndex);
});

test("desktop workspace uses a sticky sidebar navigation", () => {
  assert.match(css, /\.workspace-shell\s*\{[\s\S]*grid-template-columns: 248px minmax\(0, 1fr\);/);
  assert.match(css, /\.workspace-sidebar\s*\{[\s\S]*position: sticky;[\s\S]*top: 0;/);
  assert.match(css, /\.app-quicknav\s*\{[\s\S]*display: grid;[\s\S]*position: static;/);
  assert.doesNotMatch(css, /\.app-quicknav\s*\{\s*display: none;\s*\}/);
});

test("main page uses a layered product visual system", () => {
  assert.match(css, /--bg: oklch\(96\.8% 0\.006 190\);/);
  assert.match(css, /--surface: oklch\(99% 0\.004 190\);/);
  assert.match(css, /--sidebar: oklch\(94\.8% 0\.008 190\);/);
  assert.match(css, /--sidebar-shell: oklch\(40% 0\.052 168\);/);
  assert.match(css, /--radius-panel: 12px;/);
  assert.match(css, /--shadow-panel: 0 1px 3px rgba\(24, 36, 38, 0\.04\), 0 4px 12px rgba\(24, 36, 38, 0\.03\);/);
  assert.match(css, /\.workspace-sidebar\s*\{[\s\S]*background: linear-gradient\(180deg, var\(--sidebar-shell\) 0%, var\(--sidebar-shell-strong\) 100%\);/);
  assert.match(css, /\.panel\s*\{[\s\S]*border-radius: var\(--radius-panel\);[\s\S]*box-shadow: var\(--shadow-panel\);/);
  assert.match(css, /\.panel::before\s*\{/);
  assert.match(css, /\.panel h2::before\s*\{/);
  assert.match(css, /\.controls\s*\{[\s\S]*background: var\(--controls-surface\);[\s\S]*border: 1px solid var\(--controls-border\);/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("workspace sections expose distinct visual accents", () => {
  assert.match(css, /#monitorSection\s*\{[\s\S]*--section-accent: var\(--accent-monitor\);/);
  assert.match(css, /#unlockedSection\s*\{[\s\S]*--section-accent: var\(--accent-unlocked\);/);
  assert.match(css, /#birdPrepSection\s*\{[\s\S]*--section-accent: var\(--accent-ppt\);/);
  assert.match(css, /#ebirdSection\s*\{[\s\S]*--section-accent: var\(--accent-ebird\);/);
  assert.match(css, /#birdreportSection\s*\{[\s\S]*--section-accent: var\(--accent-birdreport\);/);
  assert.match(css, /\.panel\.is-jump-target\s*\{/);
});

test("quick navigation uses icons and stronger active affordances", () => {
  assert.match(html, /<div class="hero-logo" aria-hidden="true">[\s\S]*<svg viewBox="0 0 24 24"/);
  assert.match(html, /data-target="monitorSection" aria-current="true"[\s\S]*<span class="quicknav-icon" aria-hidden="true">[\s\S]*<circle cx="11" cy="11" r="8"\/>[\s\S]*<\/span>/);
  assert.match(html, /data-target="unlockedSection"[\s\S]*<span class="quicknav-icon" aria-hidden="true">[\s\S]*<rect x="9" y="3" width="6" height="4" rx="1"\/>[\s\S]*<\/span>/);
  assert.match(html, /data-target="birdPrepSection"[\s\S]*<span class="quicknav-icon" aria-hidden="true">[\s\S]*<rect x="2" y="3" width="20" height="14" rx="2"\/>[\s\S]*<\/span>/);
  assert.match(html, /data-target="ebirdSection"[\s\S]*<span class="quicknav-icon" aria-hidden="true">[\s\S]*<circle cx="12" cy="12" r="10"\/>[\s\S]*<\/span>/);
  assert.match(html, /data-target="birdreportSection"[\s\S]*<span class="quicknav-icon" aria-hidden="true">[\s\S]*<path d="M3 3v18h18"\/>[\s\S]*<\/span>/);
  assert.match(css, /\.app-quicknav-btn::before\s*\{/);
  assert.match(css, /\.app-quicknav-btn\.is-active\s*\{[\s\S]*border-color: color-mix\(in oklch, var\(--nav-accent\) 42%, var\(--sidebar-line\)\);[\s\S]*box-shadow: var\(--shadow-nav-active\);/);
  assert.match(css, /\.app-quicknav-btn\.is-active\s+\.quicknav-text\s*\{[\s\S]*font-weight: 800;/);
  assert.match(css, /\.quicknav-icon svg\s*\{[\s\S]*stroke: var\(--nav-accent\);/);
  assert.match(script, /button\.toggleAttribute\("aria-current", isActive\)/);
});

test("result modules add clearer empty states and summary tones", () => {
  assert.match(html, /id="zhejiangRareSpeciesContainer" class="records cards"[\s\S]*data-empty-state="monitor"/);
  assert.match(html, /id="regionQueryContainer" class="records cards"[\s\S]*data-empty-state="ebird-region"/);
  assert.match(html, /id="birdreportSpeciesContainer" class="records cards"[\s\S]*data-empty-state="birdreport"/);
  assert.match(css, /\.result-empty\s*\{/);
  assert.match(css, /\.empty-state-title\s*\{/);
  assert.match(css, /\.empty-state::before\s*\{[\s\S]*content: "";[\s\S]*border: 2px solid color-mix\(in oklch, var\(--section-accent\) 46%, transparent\);/);
  assert.match(css, /\.unlocked-summary-card::before\s*\{/);
  assert.match(css, /\.unlocked-summary-card\.is-success\s*\{/);
  assert.match(css, /\.unlocked-summary-card\.is-warning\s*\{/);
  assert.match(css, /\.result-table-row:hover\s*\{/);
  assert.match(css, /\.unlocked-species-row:hover\s*\{/);
  assert.match(script, /renderUnlockedSpeciesSummaryCard\("已解锁", `\$\{observedCount\} 种`, "success"\)/);
  assert.match(script, /renderUnlockedSpeciesSummaryCard\("未解锁", `\$\{missingCount\} 种`, "warning"\)/);
  assert.match(script, /renderEmptyState\(elements\.regionQueryContainer, "ebird-region"\)/);
  assert.match(script, /renderEmptyState\(elements\.birdPrepSpeciesOptions, "bird-prep-picker"\)/);
});

test("visual system replaces legacy green literals with section-aware tokens", () => {
  assert.match(css, /--section-surface: color-mix\(in oklch, var\(--section-accent\) 3%, var\(--panel\)\);/);
  assert.match(css, /--section-surface-strong: color-mix\(in oklch, var\(--section-accent\) 8%, var\(--panel-muted\)\);/);
  assert.match(css, /--section-divider: color-mix\(in oklch, var\(--section-accent\) 14%, var\(--border\)\);/);
  assert.match(css, /--section-link: color-mix\(in oklch, var\(--section-accent\) 70%, var\(--text\)\);/);
  assert.match(css, /--state-success-bg: oklch\(94% 0\.026 148\);/);
  assert.match(css, /--state-warning-bg: oklch\(94\.5% 0\.038 82\);/);
  assert.match(css, /\.panel\s*\{[\s\S]*background: var\(--section-surface\);/);
  assert.match(css, /\.workspace-content\s*\{[\s\S]*gap: 20px;/);
  [
    "#edf7f7",
    "#fbfdfa",
    "#edf4ee",
    "#2b6f8d",
    "#dfebe1",
    "#bdd9c4",
    "#dfe9df",
    "#c9dce2",
    "rgba(15, 118, 110, 0.24)"
  ].forEach((legacyColor) => {
    assert.doesNotMatch(css, new RegExp(legacyColor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
});

test("form controls, stats, and loading states are polished", () => {
  assert.match(css, /--control-padding-y: 7px;/);
  assert.match(css, /--control-grid-gap: 8px;/);
  assert.match(
    css,
    /input\[type="text"\],[\s\S]*input\[type="file"\]\s*\{[\s\S]*padding: var\(--control-padding-y\) var\(--control-padding-x\);[\s\S]*transition:[\s\S]*border-color 150ms var\(--ease-out-quart\),[\s\S]*box-shadow 150ms var\(--ease-out-quart\),[\s\S]*background-color 150ms var\(--ease-out-quart\);/
  );
  assert.match(css, /input\[type="text"\]:focus,[\s\S]*select:focus\s*\{[\s\S]*border-color: var\(--section-accent\);/);
  assert.match(css, /\.checkbox-control\s*\{[\s\S]*background: var\(--section-surface-strong\);/);
  assert.match(css, /\.stats\s*\{[\s\S]*background: var\(--stats-surface\);[\s\S]*border: 1px solid var\(--section-divider\);/);
  assert.match(css, /\.message\.is-loading::before\s*\{/);
  assert.match(css, /\.message\.error\s*\{/);
  assert.match(css, /@keyframes button-loading-pulse/);
  assert.match(css, /button\.is-loading\s*\{[\s\S]*animation: button-loading-pulse/);
  assert.match(script, /function setElementLoadingClass\(element, isLoading\)/);
  assert.match(script, /element\.setAttribute\("aria-busy", "true"\)/);
  assert.match(script, /element\.removeAttribute\("aria-busy"\)/);
  assert.match(script, /target\.classList\.toggle\("error", Boolean\(isError\)\)/);
  assert.match(script, /setElementLoadingClass\(elements\.queryBirdPrepSpeciesBtn, isLoading\)/);
  assert.match(script, /setElementLoadingClass\(elements\.generateBirdPrepPptBtn, isGenerating\)/);
  assert.match(script, /setElementLoadingClass\(elements\.ebirdMessage, isLoading\)/);
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

test("bird prep species query sorts options by record count descending", () => {
  assert.match(script, /function sortBirdreportTaxaByRecordCountDesc\(items\) \{/);
  assert.match(script, /return BIRDREPORT_CORE\.sortBirdreportTaxaByRecordCountDesc\(items\);/);
  assert.match(script, /const sortedResults = sortBirdreportTaxaByRecordCountDesc\(filterResult\.species\);/);
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
  assert.match(script, /\/api\/media\/macaulay\/search\?q=\$\{encodeURIComponent\(scientificName \|\| getBirdPrepTaxonName\(taxon\)\)\}/);
  assert.match(script, /正在匹配 Macaulay 图片/);
});

test("bird prep PPT generation exposes staged progress", () => {
  assert.match(html, /id="birdPrepProgress" class="bird-prep-progress is-hidden" aria-live="polite"/);
  assert.match(html, /<progress id="birdPrepProgressBar" class="bird-prep-progress-bar" max="100" value="0"/);
  assert.match(html, /id="birdPrepProgressLabel"/);
  assert.match(html, /id="birdPrepProgressPercent"/);
  assert.match(html, /id="birdPrepProgressDetail"/);
  assert.match(script, /birdPrepProgress: document\.querySelector\("#birdPrepProgress"\)/);
  assert.match(script, /birdPrepProgressBar: document\.querySelector\("#birdPrepProgressBar"\)/);
  assert.match(script, /function setBirdPrepProgress\(\{ label, value, max, detail, status \} = \{\}\)/);
  assert.match(script, /function resetBirdPrepProgress\(\)/);
  assert.match(script, /function yieldToBrowserFrame\(\)/);
  assert.match(script, /setBirdPrepProgress\(\{ label: "读取鸟类简介", value: 8, detail: "正在读取所选鸟种简介。" \}\)/);
  assert.match(script, /setBirdPrepProgress\(\{ label: "准备幻灯片", value: 22, detail: `已匹配 \$\{slides\.length\} 个鸟种简介。` \}\)/);
  assert.match(script, /loadBirdPrepMacaulayPhotos\(selectedSpecies, slides, \{[\s\S]*onProgress: \(progress\) =>/);
  assert.match(script, /setBirdPrepProgress\(\{ label: "打包 PPT", value: 92, detail: "正在写入幻灯片和图片资源。" \}\)/);
  assert.match(script, /setBirdPrepProgress\(\{ label: "触发下载", value: 98, detail: "正在准备浏览器下载。" \}\)/);
  assert.match(script, /setBirdPrepProgress\(\{ label: "已完成", value: 100, detail: `已生成 \$\{slides\.length\} 页 PPT。`, status: "complete" \}\)/);
  assert.match(script, /async function loadBirdPrepMacaulayPhotos\(selectedSpecies, slides, options = \{\}\)/);
  assert.match(script, /const \{ onProgress \} = options;/);
  assert.match(script, /onProgress\?\.\(\{[\s\S]*phase: "image-download"[\s\S]*done: index \+ 1,[\s\S]*total: slides\.length/);
  assert.match(css, /\.bird-prep-progress\s*\{/);
  assert.match(css, /\.bird-prep-progress\.is-hidden\s*\{/);
  assert.match(css, /\.bird-prep-progress-bar\s*\{/);
  assert.match(css, /\.bird-prep-progress\.is-complete\s*\{/);
  assert.match(css, /\.bird-prep-progress\.is-error\s*\{/);
});

test("bird prep PPT reports the first Macaulay image failure when all downloads fail", () => {
  assert.match(script, /let firstErrorMessage = "";/);
  assert.match(script, /firstErrorMessage = firstErrorMessage \|\| error\.message;/);
  assert.match(script, /return \{ attachedCount, missingCount, firstErrorMessage \};/);
  assert.match(script, /photoResult\.firstErrorMessage/);
  assert.match(script, /Macaulay Library 图片全部失败：\$\{photoResult\.firstErrorMessage\}/);
});

test("bird prep PPT image lookup falls back to slide scientific names", () => {
  assert.match(script, /fetchBirdPrepMacaulayPhoto\(taxon, taxonomyBySciName, slide\)/);
  assert.match(script, /getBirdPrepTaxonScientificName\(taxon\) \|\| String\(slide\?\.latinName \|\| ""\)\.trim\(\)/);
});

test("bird prep PPT image dimension probing cannot block downloads forever", () => {
  assert.match(script, /BIRD_PREP_IMAGE_DIMENSION_TIMEOUT_MS/);
  assert.match(script, /setTimeout\(\(\) => finish\(\{ width: 0, height: 0 \}\), BIRD_PREP_IMAGE_DIMENSION_TIMEOUT_MS\)/);
});

test("bird prep PPT Macaulay requests time out and retry", () => {
  assert.match(script, /BIRD_PREP_MACAULAY_FETCH_TIMEOUT_MS/);
  assert.match(script, /BIRD_PREP_MACAULAY_FETCH_ATTEMPTS/);
  assert.match(script, /new AbortController\(\)/);
  assert.match(script, /for \(let attempt = 1; attempt <= attempts; attempt \+= 1\)/);
});

test("bird prep PPT skips browser eBird taxonomy fetch before Macaulay image fallback", () => {
  assert.match(
    script,
    /async function loadBirdPrepMacaulayTaxonomyBySciName\(scientificNames\) \{[\s\S]*void scientificNames;[\s\S]*return new Map\(\);[\s\S]*\}/
  );
  assert.doesNotMatch(script, /state\.birdPrepMacaulayTaxonomyLoading = fetchBirdPrepEbirdTaxonomy/);
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
  assert.match(script, /BIRDREPORT_CORE\.formatBirdreportQuerySummary\(payload\)/);
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

test("unlocked species locations use the BirdReport report page default first page", () => {
  const functionStart = indexOfRequired(script, "async function fetchBirdreportRecordWindowByTaxon");
  const functionEnd = indexOfRequired(script.slice(functionStart), "function isBirdreportCaptchaResponse");
  const functionBody = script.slice(functionStart, functionStart + functionEnd);
  assert.match(functionBody, /Number\(options\.displayLimit\) \|\| 10/);
  assert.match(functionBody, /fetchBirdreportReportPages/);
  assert.match(functionBody, /maxPages:\s*1/);
  assert.match(functionBody, /pageLimit:\s*displayLimit/);
  assert.match(functionBody, /stopAtDisplayLimit:\s*true/);
  assert.doesNotMatch(functionBody, /pageLimit:\s*500/);
  assert.doesNotMatch(functionBody, /Number\.POSITIVE_INFINITY/);
  assert.doesNotMatch(functionBody, /sortBirdreportRecordsBySerialIdDesc/);
  assert.doesNotMatch(functionBody, /sortBirdreportRecordsByObservationTimeDesc/);
  assert.doesNotMatch(script, /fetchRecentBirdreportRecordsByTaxon\(species,[\s\S]{0,80}limit:\s*8/);
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
  assert.match(script, /const BIRD_PROFILE_SHARD_INDEX_URL = "\.\/data\/bird-profiles\/index\.json";/);
  assert.match(script, /const BIRD_PROFILE_SHARD_INDEX_SCRIPT_URL = "\.\/data\/bird-profiles\/index\.js";/);
  assert.match(script, /const BIRD_PROFILE_SHARDS_GLOBAL = "BEAUBIRD_BIRD_PROFILE_SHARDS";/);
  assert.match(script, /const ALL_BIRDS_FULL_DATA_URL = "\.\/all_birds_full\.json";/);
  assert.match(script, /const ALL_BIRDS_FULL_SCRIPT_URL = "\.\/all_birds_full\.js";/);
  assert.match(script, /const ALL_BIRDS_FULL_GLOBAL = "BEAUBIRD_ALL_BIRDS_FULL";/);
  assert.match(script, /function loadBirdPrepProfileIndexForSpecies\(selectedSpecies\)/);
  assert.match(script, /function loadBirdPrepProfileShardsFromJson/);
  assert.match(script, /function loadBirdPrepProfileShardsFromScripts/);
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

test("shared data, utility, and BirdReport core modules load before the app script", () => {
  assert.ok(existsSync("beaubird-utils.js"));
  assert.ok(existsSync("beaubird-data.js"));
  assert.ok(existsSync("beaubird-birdreport-core.js"));
  const utils = readFileSync("beaubird-utils.js", "utf8");
  const data = readFileSync("beaubird-data.js", "utf8");

  const utilsIndex = indexOfRequired(html, 'src="./beaubird-utils.js');
  const dataIndex = indexOfRequired(html, 'src="./beaubird-data.js');
  const birdreportCoreIndex = indexOfRequired(html, 'src="./beaubird-birdreport-core.js');
  const scriptIndex = indexOfRequired(html, 'src="./script.js');
  assert.ok(utilsIndex < scriptIndex);
  assert.ok(dataIndex < scriptIndex);
  assert.ok(dataIndex < birdreportCoreIndex);
  assert.ok(birdreportCoreIndex < scriptIndex);
  assert.match(utils, /formatCompactTimestamp/);
  assert.match(data, /birdreportMunicipalityAreas/);
  assert.match(data, /traditionalPhraseReplacements/);
  assert.match(data, /traditionalCharMap/);
  assert.match(data, /commonBirdTaxonomy/);
  assert.match(birdreportCore, /BeauBirdBirdreportCore/);
  assert.match(birdreportCore, /createBirdreportPayload/);
  assert.match(birdreportCore, /normalizeBirdreportTaxonPage/);
});

test("frontend shared assets use the current deployment cache version", () => {
  assert.match(html, /style\.css\?v=20260613-0001/);
  assert.match(html, /beaubird-birdreport-core\.js\?v=20260622-0001/);
  assert.match(html, /script\.js\?v=20260622-0001/);
});

test("main script consumes shared modules and removes the unused unlocked export overlay", () => {
  assert.match(script, /window\.BeauBirdUtils/);
  assert.match(script, /window\.BeauBirdData/);
  assert.match(script, /window\.BeauBirdBirdreportCore/);
  assert.doesNotMatch(script, /const BIRDREPORT_MUNICIPALITY_AREAS = \[/);
  assert.doesNotMatch(script, /const TRADITIONAL_CHAR_MAP = \{/);
  assert.doesNotMatch(script, /const COMMON_BIRD_TAXONOMY = \{/);
  assert.doesNotMatch(script, /function normalizeBirdreportRecordItem/);
  assert.doesNotMatch(script, /function renderUnlockedSpeciesExportOverlay/);
});

test("Android assets include current shared modules and all birds profile data", () => {
  for (const source of [androidBuildGradle, androidBuildGradleKts, androidLocalServer]) {
    assert.match(source, /beaubird-utils\.js/);
    assert.match(source, /beaubird-data\.js/);
    assert.match(source, /beaubird-birdreport-core\.js/);
    assert.match(source, /all_birds_full\.json/);
    assert.match(source, /all_birds_full\.js/);
    assert.match(source, /data\/bird-profiles/);
    assert.doesNotMatch(source, /china_bird_results\.js/);
  }
  assert.match(androidBuildGradle, /data\/bird-profiles\/\*\*/);
  assert.match(androidBuildGradleKts, /data\/bird-profiles\/\*\*/);
  assert.match(androidLocalServer, /\/data\/bird-profiles\/index\.json/);
  assert.match(androidLocalServer, /serveBirdProfileAsset/);
});

test("site server serves the shared BirdReport core as a public root asset", () => {
  assert.match(siteApp, /"beaubird-birdreport-core\.js"/);
  assert.match(siteApp, /data\/bird-profiles\//);
});

test("Android local server rejects oversized request bodies", () => {
  assert.match(androidLocalServer, /MAX_REQUEST_BODY_BYTES = 1024 \* 1024/);
  assert.match(androidLocalServer, /Request body too large/);
  assert.match(androidLocalServer, /413 -> "Payload Too Large"/);
});
