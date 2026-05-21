# Bird Profile Shards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate and use small bird-profile data shards so PPT generation loads only the selected birds' profile shards before falling back to the existing full profile files.

**Architecture:** Add a Node generator that derives `data/bird-profiles/index.*` and `shard-*.*` from `all_birds_full.json` without deleting files. Update `script.js` to prefer shard loading for selected taxa while preserving the existing `all_birds_full.json` and `all_birds_full.js` fallback path. Add static-resource wiring for the Node site and Android WebView.

**Tech Stack:** Plain Node.js scripts/tests, browser JavaScript, existing Node HTTP server, Android Gradle/Kotlin static asset mapping.

---

### Task 1: Shard Generator

**Files:**
- Create: `tools/build-bird-profile-shards.mjs`
- Create: `tools/test-bird-profile-shards.js`
- Generate: `data/bird-profiles/index.json`
- Generate: `data/bird-profiles/index.js`
- Generate: `data/bird-profiles/shard-*.json`
- Generate: `data/bird-profiles/shard-*.js`

- [ ] **Step 1: Write the failing generator test**

Add a `node:test` file that writes a tiny source JSON to a temp directory, calls `writeBirdProfileShards()`, and asserts:

```js
assert.deepEqual(index.names["白鹭"], { name: "白鹭", shard: "shard-000.json", script: "shard-000.js" });
assert.equal(shard[0].overview, "常见涉禽。");
assert.match(indexScript, /window\.BEAUBIRD_BIRD_PROFILE_SHARDS_INDEX/);
assert.match(shardScript, /window\.BEAUBIRD_BIRD_PROFILE_SHARDS\["shard-000\.json"\]/);
```

- [ ] **Step 2: Run the failing test**

Run: `node tools\test-bird-profile-shards.js`

Expected: FAIL because `tools/build-bird-profile-shards.mjs` does not exist.

- [ ] **Step 3: Implement the generator**

Create `tools/build-bird-profile-shards.mjs` exporting:

```js
export const DEFAULT_PROFILE_SOURCE_PATH = resolve("all_birds_full.json");
export const DEFAULT_PROFILE_OUTPUT_DIR = resolve("data/bird-profiles");
export const DEFAULT_SHARD_SIZE = 200;
export const PROFILE_INDEX_GLOBAL = "BEAUBIRD_BIRD_PROFILE_SHARDS_INDEX";
export const PROFILE_SHARDS_GLOBAL = "BEAUBIRD_BIRD_PROFILE_SHARDS";
export function normalizeBirdProfileName(value) { ... }
export function buildBirdProfileShardPayload(profiles, options = {}) { ... }
export async function writeBirdProfileShards(options = {}) { ... }
```

The implementation must create directories, overwrite generated files, and never delete old files.

- [ ] **Step 4: Verify generator test passes**

Run: `node tools\test-bird-profile-shards.js`

Expected: PASS.

- [ ] **Step 5: Generate real shards**

Run: `node tools\build-bird-profile-shards.mjs`

Expected: `data/bird-profiles/index.json` and shard files are written.

### Task 2: Browser Shard Loading

**Files:**
- Modify: `script.js`
- Modify: `tools/test-bird-prep-ui.js`

- [ ] **Step 1: Write failing UI structure tests**

Add assertions that `script.js` contains:

```js
const BIRD_PROFILE_SHARD_INDEX_URL = "./data/bird-profiles/index.json";
const BIRD_PROFILE_SHARD_INDEX_SCRIPT_URL = "./data/bird-profiles/index.js";
const BIRD_PROFILE_SHARDS_GLOBAL = "BEAUBIRD_BIRD_PROFILE_SHARDS";
function loadBirdPrepProfileIndexForSpecies(selectedSpecies)
function loadBirdPrepProfileShardsFromJson
function loadBirdPrepProfileShardsFromScripts
```

- [ ] **Step 2: Run failing UI test**

Run: `node tools\test-bird-prep-ui.js`

Expected: FAIL because shard loading constants/functions are absent.

- [ ] **Step 3: Update PPT generation call site**

In `generateBirdPrepPpt()`, change:

```js
const profileIndex = await loadBirdPrepProfileIndex();
```

to:

```js
const profileIndex = await loadBirdPrepProfileIndexForSpecies(selectedSpecies);
```

- [ ] **Step 4: Add shard-first loader**

Add helpers near the existing profile loader:

```js
async function loadBirdPrepProfileIndexForSpecies(selectedSpecies) { ... }
async function loadBirdPrepProfileIndexFromShards(selectedSpecies) { ... }
async function loadBirdPrepProfileShardIndexFromJson() { ... }
async function loadBirdPrepProfileShardsFromJson(indexPayload, selectedSpecies) { ... }
async function loadBirdPrepProfileShardIndexFromScript() { ... }
async function loadBirdPrepProfileShardsFromScripts(indexPayload, selectedSpecies) { ... }
function getBirdPrepNeededShardFiles(indexPayload, selectedSpecies) { ... }
function getBirdPrepProfileIndexFromProfiles(profiles) { ... }
```

On any shard-path failure, call the existing full-data `loadBirdPrepProfileIndex()` fallback.

- [ ] **Step 5: Verify UI test passes**

Run: `node tools\test-bird-prep-ui.js`

Expected: PASS.

### Task 3: Static Asset Wiring

**Files:**
- Modify: `server/site/app.js`
- Modify: `server/site/site.test.js`
- Modify: `android/app/build.gradle`
- Modify: `android/app/build.gradle.kts`
- Modify: `android/app/src/main/java/cn/beaubird/app/BeauBirdLocalServer.kt`
- Modify: `tools/test-bird-prep-ui.js`

- [ ] **Step 1: Write failing static tests**

Add tests that require:

```js
assert.match(siteApp, /data\/bird-profiles\//);
assert.match(androidBuildGradle, /data\/bird-profiles\/\*\*/);
assert.match(androidBuildGradleKts, /data\/bird-profiles\/\*\*/);
assert.match(androidLocalServer, /\/data\/bird-profiles\/index\.json/);
assert.match(androidLocalServer, /serveBirdProfileAsset/);
```

In `server/site/site.test.js`, add an authenticated request for `/data/bird-profiles/index.json` from a temp project root.

- [ ] **Step 2: Run failing tests**

Run: `node tools\test-bird-prep-ui.js`

Expected: FAIL on missing strings.

Run: `node server\site\site.test.js`

Expected: FAIL if `data/bird-profiles/index.json` is not served.

- [ ] **Step 3: Wire static resources**

Keep `PUBLIC_PREFIXES` safe and explicit:

```js
const PUBLIC_PREFIXES = ["data/", "vendor/"];
```

If existing `data/` prefix already serves the files, add a named `PUBLIC_BIRD_PROFILE_PREFIX` constant and tests for clarity without changing access semantics.

Add Android Gradle include:

```gradle
include 'data/bird-profiles/**'
```

Add Kotlin dynamic serving for `/data/bird-profiles/*.json` and `*.js` through a helper that maps the request path to the same asset path.

- [ ] **Step 4: Verify static tests pass**

Run:

```powershell
node tools\test-bird-prep-ui.js
node server\site\site.test.js
```

Expected: PASS.

### Task 4: Documentation and Full Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README**

Document `data/bird-profiles/`, `tools/build-bird-profile-shards.mjs`, and the new test command while noting the full data files remain as fallback.

- [ ] **Step 2: Run final checks**

Run:

```powershell
node --check script.js
node tools\test-bird-profile-shards.js
node tools\test-bird-prep-ui.js
node tools\test-bird-prep-ppt-core.js
node server\site\site.test.js
git diff --check
```

Expected: all pass. SQLite experimental warnings from Node site tests are acceptable if tests pass.
