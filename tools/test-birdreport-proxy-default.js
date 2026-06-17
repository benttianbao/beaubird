const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");

const script = readFileSync("script.js", "utf8");

test("direct file usage keeps the local BirdReport backend default", () => {
  assert.match(
    script,
    /window\.location\.protocol === "file:"[\s\S]*?return DEFAULT_BIRDREPORT_PROXY_URL;/,
    "direct webpage usage should keep the local BirdReport backend fallback"
  );
});

test("hosted web usage defaults to same-origin BirdReport backend", () => {
  assert.match(
    script,
    /return window\.location\.origin;/,
    "hosted pages should use the current site origin for /api/birdreport requests"
  );
});

test("birdreport requests always use the default backend instead of proxy address inputs", () => {
  assert.match(
    script,
    /function getBirdreportProxyBaseUrl\(\) \{[\s\S]*?return normalizeProxyBaseUrl\(getDefaultBirdreportProxyUrl\(\)\);[\s\S]*?\}/,
    "BirdReport requests should resolve their base URL from the default backend"
  );
  assert.doesNotMatch(script, /getUsableStoredBirdreportProxyUrl/);
  assert.doesNotMatch(script, /elements\.birdreportProxyUrl\.value/);
  assert.doesNotMatch(script, /elements\.birdPrepProxyUrl\.value/);
});

test("local proxy exposes read-only Macaulay Library media endpoints", () => {
  const proxy = readFileSync("birdreport-proxy.ps1", "utf8");
  assert.match(proxy, /\/api\/media\/macaulay\/search/);
  assert.match(proxy, /\/api\/media\/macaulay\/asset/);
  assert.match(proxy, /media\.ebird\.org\/api\/v1\/search/);
  assert.match(proxy, /cdn\.download\.ams\.birds\.cornell\.edu\/api\/v1\/asset/);
  assert.match(proxy, /\/1200/);
  assert.match(proxy, /Invalid Macaulay Library asset id/);
});

test("local Macaulay asset proxy only requests PPT-supported image formats", () => {
  const proxy = readFileSync("birdreport-proxy.ps1", "utf8");
  assert.match(proxy, /\$assetResponse = Invoke-MacaulayCurlRequest -RemotePath \$assetUrl -Accept "image\/jpeg,image\/png,image\/webp"/);
  assert.doesNotMatch(proxy, /\$assetResponse = Invoke-MacaulayCurlRequest -RemotePath \$assetUrl -Accept "image\/avif/);
});

test("local Macaulay proxy uses JSON search and filters empty search bodies", () => {
  const proxy = readFileSync("birdreport-proxy.ps1", "utf8");
  assert.match(proxy, /Accept "application\/json"/);
  assert.match(proxy, /ConvertFrom-Json/);
  assert.match(proxy, /Test-MacaulayMediaMatch/);
  assert.match(proxy, /\$searchBytes = @\(\$searchResponse\.BodyBytes\)/);
});

test("local Macaulay proxy can fall back to catalog HTML search results", () => {
  const proxy = readFileSync("birdreport-proxy.ps1", "utf8");
  assert.match(proxy, /Get-MacaulayCatalogSearchResults/);
  assert.match(proxy, /media\.ebird\.org\/catalog/);
  assert.match(proxy, /assetId:\(\\d\+\)/);
  assert.match(proxy, /Accept "text\/html"/);
});

test("local Macaulay proxy resolves scientific-name queries to eBird taxon codes", () => {
  const proxy = readFileSync("birdreport-proxy.ps1", "utf8");
  assert.match(proxy, /Resolve-MacaulayQueryTaxonCode/);
  assert.match(proxy, /api\.ebird\.org\/v2\/ref\/taxonomy\/ebird/);
  assert.match(proxy, /species=\$\(\[uri\]::EscapeDataString\(\$Query\)\)/);
  assert.match(proxy, /catalog\?taxonCode=\$\(\[uri\]::EscapeDataString\(\$resolvedTaxonCode\)\)/);
});
