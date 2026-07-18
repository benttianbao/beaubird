import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = resolve(repoRoot, "script.js");

const scriptSource = readFileSync(scriptPath, "utf8");
const mainSource = readFileSync(resolve(repoRoot, "src", "script", "main.js"), "utf8");
const indexSource = readFileSync(resolve(repoRoot, "index.html"), "utf8");
const siteSource = readFileSync(resolve(repoRoot, "server", "site", "app.js"), "utf8");
const androidBuildSource = readFileSync(resolve(repoRoot, "android", "app", "build.gradle"), "utf8");
const androidServerSource = readFileSync(
  resolve(repoRoot, "android", "app", "src", "main", "java", "cn", "beaubird", "app", "BeauBirdLocalServer.kt"),
  "utf8"
);

const LEGACY_GLOBAL_DATA_NAMES = `
STORAGE_KEY PERSONAL_STORAGE_KEY LEGACY_STORAGE_KEY EBIRD_API_KEY_STORAGE EBIRD_REGION_STORAGE EBIRD_BACK_STORAGE
EBIRD_SPECIES_LOCALE EBIRD_SEASONAL_CACHE_STORAGE EBIRD_SEASONAL_SETTINGS_STORAGE EBIRD_SEASONAL_REGION_CODE
EBIRD_SEASONAL_DEFAULT_YEARS EBIRD_SEASONAL_DEFAULT_WINDOW_DAYS EBIRD_SEASONAL_CACHE_TTL_MS EBIRD_SEASONAL_CONCURRENCY
BIRDREPORT_RARE_SPECIES_STORAGE BIRDREPORT_RARE_MONITOR_STORAGE BIRDREPORT_RARE_NOTIFICATION_LOG_STORAGE
BIRDREPORT_UNLOCKED_SPECIES_CACHE_STORAGE BIRDREPORT_SEARCH_PAGE_URL BIRDREPORT_TAXON_PAGE_URL
BIRDREPORT_ZHEJIANG_SPECIES_DATA_URL BIRDREPORT_ZHEJIANG_SPECIES_GLOBAL BIRD_PROFILE_SHARD_BASE_URL
BIRD_PROFILE_SHARD_INDEX_URL BIRD_PROFILE_SHARD_INDEX_SCRIPT_URL BIRD_PROFILE_SHARD_INDEX_GLOBAL BIRD_PROFILE_SHARDS_GLOBAL
ALL_BIRDS_FULL_DATA_URL ALL_BIRDS_FULL_SCRIPT_URL ALL_BIRDS_FULL_GLOBAL BIRD_PREP_LOGIN_EXPIRED_MESSAGE
BIRD_PREP_MACAULAY_MAX_IMAGE_BYTES BIRD_PREP_MACAULAY_MAX_TOTAL_IMAGE_BYTES BIRD_PREP_MACAULAY_FETCH_TIMEOUT_MS
BIRD_PREP_MACAULAY_FETCH_ATTEMPTS BIRD_PREP_IMAGE_DIMENSION_TIMEOUT_MS BIRDREPORT_CORE BIRDREPORT_VERSION
ANDROID_APP_USER_AGENT_TOKEN BIRDREPORT_PARAM_PUBLIC_KEY BIRDREPORT_AES_KEY_SOURCE BIRDREPORT_AES_IV_SOURCE
DEFAULT_BIRDREPORT_PROXY_URL ANDROID_BIRDREPORT_PROXY_URL BIRDREPORT_RARE_SPECIES_PROVINCE
BIRDREPORT_RARE_SPECIES_THRESHOLD BIRDREPORT_MONITOR_INTERVAL_MS UNLOCKED_SPECIES_VISIBLE_ROW_COUNT BEAUBIRD_UTILS
BEAUBIRD_DATA formatCompactTimestamp TRADITIONAL_PHRASE_REPLACEMENTS TRADITIONAL_CHAR_MAP COMMON_BIRD_TAXONOMY
SAMPLE_RECORDS ROOT_CLASS_LABEL UNKNOWN_ORDER_LABEL UNKNOWN_FAMILY_LABEL UNKNOWN_GENUS_LABEL TAXON_ZH_MAP
unlockedSpeciesCache state elements EMPTY_STATE_COPY
`.trim().split(/\s+/);

const LEGACY_GLOBAL_FUNCTION_NAMES = `
safeLocalStorageGet safeLocalStorageSet safeLocalStorageRemove bootstrap bindIfPresent bindEvents handleQuickNavClick
markJumpTarget setActiveQuickNav initEmbeddedAndroidQuickNav importText parseInput parseJsonInput parseDelimitedInput
parseLineInput splitDelimitedLine toRecord getRawValue normalizeHeaderName normalizeRecords persistAndRender render
renderFilters renderRecordsOnly renderStats renderTaxonomyBrowser renderLifeList renderSpeciesDiscovery renderEmptyState
renderRegionQueryResults renderRegionQueryDetail closeRegionQueryDetail handleRegionQueryDetailHotkeys getVisibleRecords
getLifeListContext getSpeciesDiscoveryContext buildSpeciesAggregate getRecordBoundaryDate normalizeDateInput initMap renderMap
buildHeatPoints renderCalendarHeatmap renderLegend syncEbirdRecords hydrateEbirdInputs persistEbirdSettings clearEbirdApiKey
hydrateEbirdSeasonalInputs persistEbirdSeasonalSettings getEbirdSeasonalSettings analyzeEbirdSeasonalPrediction
renderEbirdSeasonalPrediction renderEbirdSeasonalDetail clearEbirdSeasonalCache fetchEbirdSeasonalDailyEntries
fetchEbirdHistoricSpeciesForDate fetchEbirdRecentSeasonalObservations normalizeEbirdSeasonalObservationList
loadEbirdSeasonalCache saveEbirdSeasonalCache getCachedEbirdSeasonalDay setCachedEbirdSeasonalDay getEbirdSeasonalCacheKey
runLimitedConcurrency parseIsoDateParts getEbirdSeasonalCore formatSeasonalYearRange formatSeasonalRecentEvidence
getSeasonalProbabilityClass isEmbeddedAndroidApp getDefaultBirdreportProxyUrl applyRuntimeEnvironment lockEmbeddedAndroidViewport
getBirdreportProxyBaseUrl hydrateZhejiangRareMonitorInputs handleZhejiangRareMonitorDateChange initBirdreportProxy
canUseBirdreportProxy initZhejiangRareSpeciesMonitor initZhejiangRareSpeciesDailyQuery renderZhejiangRareSpeciesPanel
renderZhejiangRareSpeciesHits saveZhejiangRareSpecies queryUnlockedSpeciesByUser fetchZhejiangSpeciesCatalogForUnlocked
fetchUserZhejiangSpecies buildUnlockedMissingSpecies sortBirdreportTaxaByReportCountDesc renderUnlockedSpeciesPanel
renderUnlockedSpeciesSummary renderUnlockedSpeciesSummaryCard toggleUnlockedSpeciesInfoVisibility
toggleUnlockedSpeciesTableVisibility renderUnlockedSpeciesList createUnlockedSpeciesModuleHeader buildUnlockedSpeciesMetaLine
renderUnlockedSpeciesLocationPanel formatUnlockedSpeciesTaxonomy toggleUnlockedSpeciesLocations submitUnlockedSpeciesCaptcha
refreshUnlockedSpeciesCaptcha fetchRecentBirdreportRecordsByTaxon fetchBirdreportRecordWindowByTaxon isBirdreportCaptchaResponse
createBirdreportCaptchaError isBirdreportCaptchaError loadBirdreportCaptchaImage verifyBirdreportCaptcha
createBirdreportRecordSearchPayload clearUnlockedSpeciesDetail clearUnlockedSpeciesResults exportUnlockedSpeciesTable
buildUnlockedSpeciesExportRows buildUnlockedSpeciesExportFilename toCsvText escapeCsvField saveTextFile triggerFileDownload
toggleZhejiangRareMonitor startZhejiangRareMonitor stopZhejiangRareMonitor scheduleZhejiangRareMonitor
toggleZhejiangRareSpeciesDetail checkZhejiangRareSpeciesToday notifyRareSpeciesHits renderZhejiangRareSpeciesDetail
clearZhejiangRareSpeciesDetail closeZhejiangRareSpeciesDetail ensureBrowserNotificationPermission setZhejiangRareSpeciesLoading
setZhejiangRareSpeciesMessage setUnlockedSpeciesMessage updateUnlockedSpeciesExportButton setUnlockedSpeciesLoading
createBirdreportPayload getSelectedZhejiangRareMonitorDate getBirdreportTaxonKey getBirdreportRarityFields
serializeBirdreportTaxon getBirdreportTaxaArray normalizeBirdreportTaxa fetchZhejiangSpeciesBaselineFromJson
fetchZhejiangSpeciesCatalogFromJson loadZhejiangSpeciesData normalizeZhejiangSpeciesCatalog toRareSpeciesHit
handleBirdreportProvinceChange handleBirdreportCityChange loadBirdreportProvinces handleBirdPrepProvinceChange
handleBirdPrepCityChange queryBirdPrepSpecies buildBirdPrepQueryPayload formatBirdPrepQuerySummary
formatBirdPrepQueryCompleteMessage getBirdPrepUnlockedUsername fetchUserNationalBirdPrepSpecies
getBirdPrepUnlockedSpeciesForUser buildBirdPrepUnlockedTaxonLookup getBirdPrepTaxonName filterBirdPrepSpeciesByUnlocked
renderBirdPrepSpeciesOptions handleBirdPrepSpeciesSelectionChange formatBirdPrepSpeciesOption getSelectedBirdPrepSpecies
selectAllVisibleBirdPrepSpecies clearBirdPrepSpeciesSelection clearBirdPrepSpeciesResults generateBirdPrepPpt
shouldUseBirdPrepMacaulayImages loadBirdPrepMacaulayPhotos loadBirdPrepMacaulayTaxonomyBySciName
fetchBirdPrepMacaulayPhoto getBirdPrepMacaulayTaxonCode getBirdPrepTaxonScientificName normalizeScientificName
getStoredEbirdApiKey birdreportProxyGetJson birdreportProxyGetImage birdreportProxyGet fetchWithTimeoutAndRetry
formatFetchTimeoutError readImageDimensions getImageExtensionFromContentType formatBirdPrepMacaulayAttribution
loadBirdPrepProfileIndex loadBirdPrepProfileIndexForSpecies loadBirdPrepProfileIndexFromShards
loadBirdPrepProfileShardIndexFromJson loadBirdPrepProfileShardsFromJson loadBirdPrepProfileShardIndexFromScript
loadBirdPrepProfileShardsFromScripts getBirdPrepNeededShardFiles getBirdPrepProfileIndexFromProfiles
getBirdPrepShardScriptName assertBirdPrepProfileShardIndex loadBirdPrepProfileScript assertBirdPrepProfileResponse
buildBirdPrepProfileIndexFromEmbeddedData loadBirdPrepEmbeddedDataScript syncBirdPrepMacaulayOptions setBirdPrepProgress
resetBirdPrepProgress yieldToBrowserFrame setBirdPrepLoading setBirdPrepGenerating updateBirdPrepPptButton
queryBirdreportSpeciesByProxy fetchAllBirdreportTaxa fetchBirdreportRecordsByTaxon
fetchBirdreportRecordsForCurrentQuery fetchBirdreportReportPages fetchBirdreportRecordPages isPublicBirdreportLocationRecord
normalizeBirdreportTaxonPage normalizeBirdreportRecordPage renderBirdreportSpeciesDetail toggleBirdreportSpeciesDetail
submitBirdreportSpeciesCaptcha refreshBirdreportSpeciesCaptcha clearBirdreportSpeciesDetail closeBirdreportSpeciesDetail
sortBirdreportRecordsByObservationTimeDesc sortBirdreportRecordsBySerialIdDesc getBirdreportReportCount
dedupeBirdreportTaxa sortBirdreportTaxaByRecordCount sortBirdreportTaxaByRecordCountDesc birdreportProxyPost
buildBirdreportSignedRequest serializeBirdreportRequestData parseBirdreportRequestData sortBirdreportObjectKeys
generateBirdreportRequestId renderBirdreportRegionOptions resetSelectOptions renderBirdreportSpeciesResults
clearBirdreportSpeciesResults decodeBirdreportPayload decodeBirdreportPayloadWithCryptoJs decodeBirdreportDecimalPairs
setBirdreportLoading normalizeProxyBaseUrl openExternalUrl openBirdreportTaxonPage openBirdreportSearchPage
buildBirdreportQueryPayload formatBirdreportQuerySummary normalizeBirdreportAdministrativeArea normalizeEbirdObservations
createEbirdObservationId buildEbirdNotes fetchEbirdTaxonomyMap mergeRecords createDedupKey normalizeRecord
migrateExistingRecords countMigratedRecords buildInitialMessage getFallbackTaxonomy buildTaxonomyTree createTaxonomyNode
hydrateTaxonomyNode getTaxonomyPath renderTaxonomyNode getSortedTaxonomyChildren formatTaxonLabel buildCalendarDays
calendarColor loadPersonalRecords loadUnlockedSpeciesCache createEmptyUnlockedSpeciesCache saveUnlockedSpeciesCache
clearUnlockedSpeciesCache loadZhejiangRareSpecies saveZhejiangRareSpeciesToStorage loadZhejiangRareMonitor
saveZhejiangRareMonitor loadZhejiangRareNotificationLog saveZhejiangRareNotificationLog savePersonalRecords
isLegacyRegionQueryRecord normalizeDate formatIsoDate addDays formatDate formatDateTime formatBirdreportDateTime
toNumber parsePositiveInteger toTaxonOrder createId extractGenus simplifyChineseText chunkArray clampBackDays
clampEbirdSeasonalYears clampEbirdSeasonalWindow setMessage setEbirdMessage setEbirdSeasonalMessage setBirdreportMessage
setBirdPrepMessage setStatusMessage setElementLoadingClass setEbirdLoading setEbirdSeasonalLoading escapeHtml encodeBase64Utf8
`.trim().split(/\s+/);

function formatCheckFailure(result) {
  return [result.error?.message, result.stdout, result.stderr].filter(Boolean).join("\n");
}

function readManifest(source, declarationName) {
  const match = source.match(
    new RegExp(`const\\s+${declarationName}\\s*=\\s*Object\\.freeze\\(\\s*\\[([\\s\\S]*?)\\]\\s*\\)`)
  );
  assert.ok(match, `src/script/main.js must declare ${declarationName}`);
  return [...match[1].matchAll(/["']([A-Za-z_$][\w$]*)["']/g)].map((entry) => entry[1]);
}

test("root script.js is an explicitly generated classic-script artifact", () => {
  const check = spawnSync(process.execPath, ["--check", scriptPath], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  assert.equal(check.status, 0, `node --check script.js failed:\n${formatCheckFailure(check)}`);
  assert.doesNotThrow(
    () => new Script(scriptSource, { filename: "script.js" }),
    "script.js must parse as a classic script, not only as an ES module"
  );

  const generatedHeader = scriptSource.slice(0, 4096);
  assert.match(
    generatedHeader,
    /(?:@generated\b|auto[- ]generated|generated (?:file|artifact|bundle)|自动生成)/i,
    "script.js must start with an explicit generated-file marker"
  );
  assert.match(
    generatedHeader,
    /(?:do not edit|do not modify|请勿(?:手工|直接)?编辑|禁止(?:手工|直接)?编辑)/i,
    "the generated marker must make it clear that script.js is not hand-edited"
  );
});

test("root script.js does not depend on generated external chunks", () => {
  const forbiddenRuntimeLoaders = [
    ["dynamic import()", /\bimport\s*\(/],
    ["worker importScripts()", /\bimportScripts\s*\(/],
    ["Webpack async chunk loader", /\b__webpack_require__\s*\.\s*e\s*\(/],
    ["Vite dependency map", /\b__vite__mapDeps\b/],
    ["SystemJS dynamic loader", /\bSystem\s*\.\s*import\s*\(/],
    [
      "generated chunk filename",
      /["'`](?:[^"'`\r\n]*[\\/])?(?:chunk|chunks)[-_.\\/][^"'`\r\n]*\.m?js(?:\?[^"'`\r\n]*)?["'`]/i
    ]
  ];

  for (const [description, pattern] of forbiddenRuntimeLoaders) {
    assert.doesNotMatch(scriptSource, pattern, `script.js must be self-contained; found ${description}`);
  }
});

test("classic compatibility bridge exposes the complete legacy top-level surface before bootstrap", () => {
  const dataManifest = readManifest(mainSource, "LEGACY_GLOBAL_DATA_NAMES");
  const functionManifest = readManifest(mainSource, "LEGACY_GLOBAL_FUNCTION_NAMES");
  const allExpectedNames = [...LEGACY_GLOBAL_DATA_NAMES, ...LEGACY_GLOBAL_FUNCTION_NAMES];

  assert.deepEqual(
    dataManifest,
    LEGACY_GLOBAL_DATA_NAMES,
    "data manifest must exactly match all 64 top-level const/let/var bindings from the legacy script"
  );
  assert.deepEqual(
    functionManifest,
    LEGACY_GLOBAL_FUNCTION_NAMES,
    "function manifest must exactly match all 310 top-level function declarations from the legacy script"
  );
  assert.equal(
    new Set(allExpectedNames).size,
    allExpectedNames.length,
    "legacy data and function manifests must not contain duplicate names"
  );

  const dataBridge = mainSource.match(
    /for\s*\(\s*const\s+name\s+of\s+LEGACY_GLOBAL_DATA_NAMES\s*\)\s*\{([\s\S]*?)\n\}/
  );
  const functionBridge = mainSource.match(
    /for\s*\(\s*const\s+name\s+of\s+LEGACY_GLOBAL_FUNCTION_NAMES\s*\)\s*\{([\s\S]*?)\n\}/
  );

  assert.ok(dataBridge, "main.js must iterate the complete legacy data manifest");
  assert.match(
    dataBridge[1],
    /globalThis\s*\[\s*name\s*\]\s*=\s*legacyGlobalData\s*\[\s*name\s*\]/,
    "every legacy data binding must be assigned to globalThis"
  );
  assert.ok(functionBridge, "main.js must iterate the complete legacy function manifest");
  assert.match(
    functionBridge[1],
    /globalThis\s*\[\s*name\s*\]\s*=\s*legacyFunction/,
    "every legacy function must be assigned to globalThis"
  );
  assert.match(
    functionBridge[1],
    /typeof\s+legacyFunction\s*!==\s*["']function["']/,
    "the bridge must fail fast if an extracted legacy function is absent from runtime"
  );

  const dataBridgeIndex = mainSource.indexOf("for (const name of LEGACY_GLOBAL_DATA_NAMES)");
  const functionBridgeIndex = mainSource.indexOf("for (const name of LEGACY_GLOBAL_FUNCTION_NAMES)");
  const bootstrapIndex = mainSource.indexOf("runtime.bootstrap();");
  assert.ok(dataBridgeIndex >= 0 && dataBridgeIndex < bootstrapIndex, "data globals must be exposed before bootstrap");
  assert.ok(
    functionBridgeIndex >= 0 && functionBridgeIndex < bootstrapIndex,
    "function globals must be exposed before bootstrap"
  );

  for (const name of allExpectedNames) {
    assert.match(
      scriptSource,
      new RegExp(`["']${name}["']`),
      `generated script.js must retain the compatibility-manifest entry for ${name}`
    );
  }
});

test("index.html keeps loading the root bundle as a classic script", () => {
  const scriptTags = [...indexSource.matchAll(/<script\b[^>]*>/gi)].map((match) => match[0]);
  const rootBundleTags = scriptTags.filter((tag) =>
    /\bsrc\s*=\s*(["'])\.\/script\.js(?:\?[^"']*)?\1/i.test(tag)
  );

  assert.equal(rootBundleTags.length, 1, "index.html must load exactly one ./script.js bundle");
  assert.doesNotMatch(rootBundleTags[0], /\btype\s*=\s*(["'])module\1/i, "./script.js must remain a classic script");
  assert.equal(
    scriptTags.filter((tag) => /\btype\s*=\s*(["'])module\1/i.test(tag)).length,
    0,
    "index.html must not add a second module entry point alongside ./script.js"
  );
});

test("Node serves script.js directly from the project root", () => {
  const publicRootFiles = siteSource.match(
    /const\s+PUBLIC_ROOT_FILES\s*=\s*new Set\s*\(\s*\[([\s\S]*?)\]\s*\)/
  );

  assert.ok(publicRootFiles, "server/site/app.js must retain its root-file public allowlist");
  assert.match(publicRootFiles[1], /["']script\.js["']/, "Node public allowlist must include root script.js");
  assert.match(
    siteSource,
    /const\s+root\s*=\s*normalize\s*\(\s*context\.projectRoot\s*\)/,
    "Node static serving must resolve assets from the project root"
  );
  assert.match(
    siteSource,
    /PUBLIC_ROOT_FILES\.has\s*\(\s*normalizedRelative\s*\)/,
    "Node static serving must apply the root-file allowlist"
  );
});

test("Android packages and routes the same root script.js artifact", () => {
  assert.match(
    androidBuildSource,
    /def\s+webRootDir\s*=\s*rootProject\.projectDir\.parentFile/,
    "Android web assets must originate at the repository root"
  );
  assert.match(
    androidBuildSource,
    /from\s*\(\s*webRootDir\s*\)\s*\{[\s\S]*?include[^\r\n]*["']script\.js["']/,
    "Android syncWebAssets must copy the root script.js"
  );
  assert.match(
    androidServerSource,
    /["']\/script\.js["']\s+to\s+["']script\.js["']/,
    "Android local server must route /script.js to the packaged root artifact"
  );
});
