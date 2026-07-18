// Functions extracted from the legacy script.js features/bird-prep/profiles domain.
export function installBirdPrepProfiles(runtime) {
  const { BIRD_PROFILE_SHARD_BASE_URL, BIRD_PROFILE_SHARD_INDEX_URL, BIRD_PROFILE_SHARD_INDEX_SCRIPT_URL, BIRD_PROFILE_SHARD_INDEX_GLOBAL, BIRD_PROFILE_SHARDS_GLOBAL, ALL_BIRDS_FULL_DATA_URL, ALL_BIRDS_FULL_SCRIPT_URL, ALL_BIRDS_FULL_GLOBAL, BIRD_PREP_LOGIN_EXPIRED_MESSAGE, state } = runtime;
  const getBirdPrepTaxonName = (...args) => runtime.getBirdPrepTaxonName(...args);

async function loadBirdPrepProfileIndex() {
  if (state.birdPrepProfileIndex) {
    return state.birdPrepProfileIndex;
  }

  const existingIndex = buildBirdPrepProfileIndexFromEmbeddedData();
  if (existingIndex) {
    return existingIndex;
  }

  if (state.birdPrepProfileIndexLoading) {
    return state.birdPrepProfileIndexLoading;
  }

  state.birdPrepProfileIndexLoading = fetch(ALL_BIRDS_FULL_DATA_URL, { cache: "no-store" })
    .then(async (response) => {
      assertBirdPrepProfileResponse(response);
      return response.json();
    })
    .then((payload) => {
      const index = window.BeauBirdPrepPpt.buildBirdProfileIndex(payload);
      if (!index.size) {
        throw new Error("本地鸟类简介 JSON 中没有可用鸟种。");
      }
      state.birdPrepProfileIndex = index;
      return index;
    })
    .catch(async (error) => {
      if (window.location.protocol !== "file:") {
        throw error;
      }
      await loadBirdPrepEmbeddedDataScript();
      const fallbackIndex = buildBirdPrepProfileIndexFromEmbeddedData();
      if (!fallbackIndex) {
        throw new Error("读取本地鸟类简介失败。请确认 all_birds_full.js 与 index.html 在同一目录后刷新页面。");
      }
      return fallbackIndex;
    })
    .finally(() => {
      state.birdPrepProfileIndexLoading = null;
    });

  return state.birdPrepProfileIndexLoading;
}

async function loadBirdPrepProfileIndexForSpecies(selectedSpecies) {
  if (state.birdPrepProfileIndex) {
    return state.birdPrepProfileIndex;
  }

  try {
    const shardIndex = await loadBirdPrepProfileIndexFromShards(selectedSpecies);
    if (shardIndex?.size) {
      return shardIndex;
    }
  } catch {
    // Fall through to the existing full-data loader.
  }

  return loadBirdPrepProfileIndex();
}

async function loadBirdPrepProfileIndexFromShards(selectedSpecies) {
  try {
    const indexPayload = await loadBirdPrepProfileShardIndexFromJson();
    const profiles = await loadBirdPrepProfileShardsFromJson(indexPayload, selectedSpecies);
    return getBirdPrepProfileIndexFromProfiles(profiles);
  } catch (error) {
    if (window.location.protocol !== "file:") {
      throw error;
    }
  }

  const indexPayload = await loadBirdPrepProfileShardIndexFromScript();
  const profiles = await loadBirdPrepProfileShardsFromScripts(indexPayload, selectedSpecies);
  return getBirdPrepProfileIndexFromProfiles(profiles);
}

async function loadBirdPrepProfileShardIndexFromJson() {
  if (state.birdPrepProfileShardIndex) {
    return state.birdPrepProfileShardIndex;
  }

  if (state.birdPrepProfileShardIndexLoading) {
    return state.birdPrepProfileShardIndexLoading;
  }

  state.birdPrepProfileShardIndexLoading = fetch(BIRD_PROFILE_SHARD_INDEX_URL, { cache: "no-store" })
    .then(async (response) => {
      assertBirdPrepProfileResponse(response);
      return response.json();
    })
    .then((payload) => {
      assertBirdPrepProfileShardIndex(payload);
      state.birdPrepProfileShardIndex = payload;
      return payload;
    })
    .finally(() => {
      state.birdPrepProfileShardIndexLoading = null;
    });

  return state.birdPrepProfileShardIndexLoading;
}

async function loadBirdPrepProfileShardsFromJson(indexPayload, selectedSpecies) {
  const shardFiles = getBirdPrepNeededShardFiles(indexPayload, selectedSpecies);
  const profileGroups = await Promise.all(
    shardFiles.map(async (file) => {
      if (state.birdPrepProfileShardProfileCache.has(file)) {
        return state.birdPrepProfileShardProfileCache.get(file);
      }

      const response = await fetch(`${BIRD_PROFILE_SHARD_BASE_URL}${file}`, { cache: "no-store" });
      assertBirdPrepProfileResponse(response);
      const profiles = await response.json();
      if (!Array.isArray(profiles)) {
        throw new Error("鸟类简介分片格式不正确。");
      }
      state.birdPrepProfileShardProfileCache.set(file, profiles);
      return profiles;
    })
  );

  return profileGroups.flat();
}

async function loadBirdPrepProfileShardIndexFromScript() {
  if (window[BIRD_PROFILE_SHARD_INDEX_GLOBAL]) {
    const payload = window[BIRD_PROFILE_SHARD_INDEX_GLOBAL];
    assertBirdPrepProfileShardIndex(payload);
    state.birdPrepProfileShardIndex = payload;
    return payload;
  }

  await loadBirdPrepProfileScript(BIRD_PROFILE_SHARD_INDEX_SCRIPT_URL, BIRD_PROFILE_SHARD_INDEX_GLOBAL);
  const payload = window[BIRD_PROFILE_SHARD_INDEX_GLOBAL];
  assertBirdPrepProfileShardIndex(payload);
  state.birdPrepProfileShardIndex = payload;
  return payload;
}

async function loadBirdPrepProfileShardsFromScripts(indexPayload, selectedSpecies) {
  const shardFiles = getBirdPrepNeededShardFiles(indexPayload, selectedSpecies);

  await Promise.all(
    shardFiles.map(async (file) => {
      if (state.birdPrepProfileShardProfileCache.has(file)) {
        return;
      }

      const scriptName = getBirdPrepShardScriptName(indexPayload, file);
      await loadBirdPrepProfileScript(`${BIRD_PROFILE_SHARD_BASE_URL}${scriptName}`, `profile-shard-${scriptName}`);
      const profiles = window[BIRD_PROFILE_SHARDS_GLOBAL]?.[file];
      if (!Array.isArray(profiles)) {
        throw new Error("鸟类简介分片脚本格式不正确。");
      }
      state.birdPrepProfileShardProfileCache.set(file, profiles);
    })
  );

  return shardFiles.flatMap((file) => state.birdPrepProfileShardProfileCache.get(file) || []);
}

function getBirdPrepNeededShardFiles(indexPayload, selectedSpecies) {
  const names = indexPayload?.names || {};
  const files = new Set();

  (Array.isArray(selectedSpecies) ? selectedSpecies : []).forEach((item) => {
    const normalizedName = window.BeauBirdPrepPpt.normalizeBirdName(getBirdPrepTaxonName(item));
    const file = names[normalizedName]?.shard;
    if (file) {
      files.add(file);
    }
  });

  return [...files].sort();
}

function getBirdPrepProfileIndexFromProfiles(profiles) {
  const index = window.BeauBirdPrepPpt.buildBirdProfileIndex(profiles);
  if (!index.size) {
    throw new Error("鸟类简介分片中没有匹配的鸟种。");
  }
  return index;
}

function getBirdPrepShardScriptName(indexPayload, file) {
  const shard = (indexPayload?.shards || []).find((entry) => entry?.file === file);
  return shard?.script || file.replace(/\.json$/i, ".js");
}

function assertBirdPrepProfileShardIndex(payload) {
  if (!payload || typeof payload !== "object" || !payload.names || typeof payload.names !== "object") {
    throw new Error("鸟类简介分片索引格式不正确。");
  }
}

function loadBirdPrepProfileScript(src, cacheKey) {
  if (state.birdPrepProfileShardScriptLoading.has(cacheKey)) {
    return state.birdPrepProfileShardScriptLoading.get(cacheKey);
  }

  const promise = new Promise((resolve, reject) => {
    let existingScript = document.querySelector(`script[data-bird-prep-profile-script="${cacheKey}"]`);
    if (existingScript) {
      if (existingScript.dataset.loaded === "true") {
        resolve();
        return;
      }
      if (existingScript.dataset.failed === "true") {
        existingScript.remove();
        existingScript = null;
      }
    }

    if (existingScript) {
      existingScript.addEventListener("load", resolve, { once: true });
      existingScript.addEventListener("error", () => reject(new Error("鸟类简介分片脚本加载失败。")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.birdPrepProfileScript = cacheKey;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true }
    );
    script.addEventListener(
      "error",
      () => {
        script.dataset.failed = "true";
        reject(new Error("鸟类简介分片脚本加载失败。"));
      },
      { once: true }
    );
    document.head.append(script);
  }).finally(() => {
    state.birdPrepProfileShardScriptLoading.delete(cacheKey);
  });

  state.birdPrepProfileShardScriptLoading.set(cacheKey, promise);
  return promise;
}

function assertBirdPrepProfileResponse(response) {
  const responseUrl = String(response.url || "");
  const isLoginResponse = response.redirected || /\/login(?:[?#]|$)/.test(responseUrl);
  if (isLoginResponse) {
    throw new Error(BIRD_PREP_LOGIN_EXPIRED_MESSAGE);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = String(response.headers?.get?.("content-type") || "").toLowerCase();
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error(BIRD_PREP_LOGIN_EXPIRED_MESSAGE);
  }
}

function buildBirdPrepProfileIndexFromEmbeddedData() {
  const embeddedPayload = window[ALL_BIRDS_FULL_GLOBAL];
  if (Array.isArray(embeddedPayload)) {
    const index = window.BeauBirdPrepPpt.buildBirdProfileIndex(embeddedPayload);
    if (!index.size) {
      throw new Error("本地鸟类简介数据中没有可用鸟种。");
    }
    state.birdPrepProfileIndex = index;
    return index;
  }

  return null;
}

function loadBirdPrepEmbeddedDataScript() {
  if (Array.isArray(window[ALL_BIRDS_FULL_GLOBAL])) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let existingScript = document.querySelector(`script[data-bird-prep-data-script="${ALL_BIRDS_FULL_GLOBAL}"]`);
    if (existingScript) {
      if (existingScript.dataset.loaded === "true") {
        resolve();
        return;
      }
      if (existingScript.dataset.failed === "true") {
        existingScript.remove();
        existingScript = null;
      }
    }

    if (existingScript) {
      existingScript.addEventListener("load", resolve, { once: true });
      existingScript.addEventListener("error", () => reject(new Error("鸟类简介数据脚本加载失败。")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = ALL_BIRDS_FULL_SCRIPT_URL;
    script.async = true;
    script.dataset.birdPrepDataScript = ALL_BIRDS_FULL_GLOBAL;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true }
    );
    script.addEventListener(
      "error",
      () => {
        script.dataset.failed = "true";
        reject(new Error("鸟类简介数据脚本加载失败。"));
      },
      { once: true }
    );
    document.head.append(script);
  });
}

  Object.assign(runtime, {
    loadBirdPrepProfileIndex,
    loadBirdPrepProfileIndexForSpecies,
    loadBirdPrepProfileIndexFromShards,
    loadBirdPrepProfileShardIndexFromJson,
    loadBirdPrepProfileShardsFromJson,
    loadBirdPrepProfileShardIndexFromScript,
    loadBirdPrepProfileShardsFromScripts,
    getBirdPrepNeededShardFiles,
    getBirdPrepProfileIndexFromProfiles,
    getBirdPrepShardScriptName,
    assertBirdPrepProfileShardIndex,
    loadBirdPrepProfileScript,
    assertBirdPrepProfileResponse,
    buildBirdPrepProfileIndexFromEmbeddedData,
    loadBirdPrepEmbeddedDataScript
  });
}
