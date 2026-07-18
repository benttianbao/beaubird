// Functions extracted from the legacy script.js features/bird-prep/media domain.
export function installBirdPrepMedia(runtime) {
  const { BIRD_PREP_MACAULAY_MAX_TOTAL_IMAGE_BYTES, BIRD_PREP_IMAGE_DIMENSION_TIMEOUT_MS, state, elements } = runtime;
  const birdreportProxyGetImage = (...args) => runtime.birdreportProxyGetImage(...args);
  const birdreportProxyGetJson = (...args) => runtime.birdreportProxyGetJson(...args);
  const getBirdPrepTaxonName = (...args) => runtime.getBirdPrepTaxonName(...args);
  const setBirdPrepMessage = (...args) => runtime.setBirdPrepMessage(...args);

function shouldUseBirdPrepMacaulayImages() {
  return Boolean(elements.birdPrepMacaulayImages?.checked);
}

async function loadBirdPrepMacaulayPhotos(selectedSpecies, slides, options = {}) {
  const { onProgress } = options;
  const taxaByName = new Map();
  selectedSpecies.forEach((taxon) => {
    const name = getBirdPrepTaxonName(taxon);
    if (name) {
      taxaByName.set(window.BeauBirdPrepPpt.normalizeBirdName(name), taxon);
    }
  });

  const scientificNames = slides
    .map((slide) => {
      const taxon = taxaByName.get(window.BeauBirdPrepPpt.normalizeBirdName(slide.speciesName));
      return getBirdPrepTaxonScientificName(taxon) || String(slide?.latinName || "").trim();
    })
    .filter(Boolean);
  onProgress?.({
    phase: "taxonomy",
    done: 0,
    total: slides.length,
    label: "准备图片索引",
    detail: "正在匹配 eBird taxonomy 和 Macaulay 图片来源。"
  });
  const taxonomyBySciName = await loadBirdPrepMacaulayTaxonomyBySciName(scientificNames);
  let attachedCount = 0;
  let attachedImageBytes = 0;
  let missingCount = 0;
  let firstErrorMessage = "";

  for (let index = 0; index < slides.length; index += 1) {
    const slide = slides[index];
    const taxon = taxaByName.get(window.BeauBirdPrepPpt.normalizeBirdName(slide.speciesName));
    setBirdPrepMessage(`正在匹配 Macaulay 图片 ${index + 1}/${slides.length}：${slide.speciesName}`);
    onProgress?.({
      phase: "image-download",
      done: index,
      total: slides.length,
      label: "匹配/下载图片",
      detail: `正在下载图片 ${index + 1}/${slides.length}：${slide.speciesName}`
    });
    try {
      const photo = await fetchBirdPrepMacaulayPhoto(taxon, taxonomyBySciName, slide);
      if (photo) {
        const imageBytes = Number(photo.bytes?.byteLength || photo.bytes?.length) || 0;
        if (attachedImageBytes + imageBytes > BIRD_PREP_MACAULAY_MAX_TOTAL_IMAGE_BYTES) {
          firstErrorMessage = firstErrorMessage || "Macaulay Library 图片总大小超过限制。";
          missingCount += 1;
          continue;
        }
        slide.photo = photo;
        attachedImageBytes += imageBytes;
        attachedCount += 1;
      } else {
        missingCount += 1;
      }
    } catch (error) {
      console.warn("Failed to attach Macaulay Library photo:", slide.speciesName, error);
      firstErrorMessage = firstErrorMessage || error.message;
      missingCount += 1;
    }
    onProgress?.({
      phase: "image-download",
      done: index + 1,
      total: slides.length,
      label: "匹配/下载图片",
      detail: `正在下载图片 ${index + 1}/${slides.length}：${slide.speciesName}`
    });
  }

  return { attachedCount, missingCount, firstErrorMessage, attachedImageBytes };
}

async function loadBirdPrepMacaulayTaxonomyBySciName(scientificNames) {
  void scientificNames;
  return new Map();
}

async function fetchBirdPrepMacaulayPhoto(taxon, taxonomyBySciName, slide) {
  const scientificName = getBirdPrepTaxonScientificName(taxon) || String(slide?.latinName || "").trim();
  const taxonCode = getBirdPrepMacaulayTaxonCode(taxon, taxonomyBySciName, scientificName);
  const cacheKey = taxonCode || scientificName || getBirdPrepTaxonName(taxon);
  if (!cacheKey) {
    return null;
  }
  if (state.birdPrepMacaulayPhotoCache.has(cacheKey)) {
    return state.birdPrepMacaulayPhotoCache.get(cacheKey);
  }

  const searchPath = taxonCode
    ? `/api/media/macaulay/search?taxonCode=${encodeURIComponent(taxonCode)}`
    : `/api/media/macaulay/search?q=${encodeURIComponent(scientificName || getBirdPrepTaxonName(taxon))}`;
  const searchPayload = await birdreportProxyGetJson(searchPath);
  const media = Array.isArray(searchPayload?.results) ? searchPayload.results[0] : null;
  if (!media?.assetId && !media?.mlId) {
    state.birdPrepMacaulayPhotoCache.set(cacheKey, null);
    return null;
  }

  const assetId = media.mlId || media.assetId;
  const image = await birdreportProxyGetImage(`/api/media/macaulay/asset/${encodeURIComponent(assetId)}`);
  const photo = {
    bytes: image.bytes,
    contentType: image.contentType,
    extension: getImageExtensionFromContentType(image.contentType),
    width: image.width,
    height: image.height,
    attribution: formatBirdPrepMacaulayAttribution(media),
    sourceUrl: media.sourceUrl || `https://macaulaylibrary.org/asset/${String(assetId).replace(/^ML/i, "")}`,
    mlId: media.mlId || `ML${String(assetId).replace(/^ML/i, "")}`
  };
  state.birdPrepMacaulayPhotoCache.set(cacheKey, photo);
  return photo;
}

function getBirdPrepMacaulayTaxonCode(taxon, taxonomyBySciName, scientificName) {
  const directCode = String(taxon?.taxonCode || taxon?.speciesCode || taxon?.species_code || taxon?.ebirdCode || "").trim();
  if (directCode) {
    return directCode;
  }
  const key = normalizeScientificName(scientificName);
  return key ? String(taxonomyBySciName?.get?.(key) || "").trim() : "";
}

function getBirdPrepTaxonScientificName(taxon) {
  return String(taxon?.latinname || taxon?.scientificName || taxon?.sciName || "").trim();
}

function normalizeScientificName(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

async function fetchWithTimeoutAndRetry(url, init = {}, options = {}) {
  const attempts = Math.max(1, Number(options.attempts) || 1);
  const timeoutMs = Math.max(1, Number(options.timeoutMs) || 0);
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = timeoutMs && typeof AbortController === "function" ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller?.signal || init.signal
      });
      if (response.ok || response.status < 500 || attempt === attempts) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) {
        throw formatFetchTimeoutError(error, timeoutMs);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw formatFetchTimeoutError(lastError, timeoutMs);
}

function formatFetchTimeoutError(error, timeoutMs) {
  if (error?.name === "AbortError") {
    return new Error(`请求超时（${Math.round(timeoutMs / 1000)} 秒）`);
  }
  return error instanceof Error ? error : new Error(String(error || "请求失败"));
}

function readImageDimensions(blob) {
  if (typeof Image !== "function" || !window.URL?.createObjectURL) {
    return Promise.resolve({ width: 0, height: 0 });
  }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    let settled = false;
    let timeoutId = null;
    const finish = (dimensions) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      URL.revokeObjectURL(url);
      resolve(dimensions);
    };
    timeoutId = setTimeout(() => finish({ width: 0, height: 0 }), BIRD_PREP_IMAGE_DIMENSION_TIMEOUT_MS);
    image.onload = () => {
      finish({ width: image.naturalWidth || 0, height: image.naturalHeight || 0 });
    };
    image.onerror = () => {
      finish({ width: 0, height: 0 });
    };
    image.src = url;
  });
}

function getImageExtensionFromContentType(contentType) {
  if (contentType === "image/png") {
    return "png";
  }
  return "jpg";
}

function formatBirdPrepMacaulayAttribution(media) {
  const mlId = media?.mlId || (media?.assetId ? `ML${media.assetId}` : "");
  return [`Macaulay Library ${mlId}`.trim(), media?.attribution || "", media?.checklistId || ""]
    .filter(Boolean)
    .join(" · ");
}

  Object.assign(runtime, {
    shouldUseBirdPrepMacaulayImages,
    loadBirdPrepMacaulayPhotos,
    loadBirdPrepMacaulayTaxonomyBySciName,
    fetchBirdPrepMacaulayPhoto,
    getBirdPrepMacaulayTaxonCode,
    getBirdPrepTaxonScientificName,
    normalizeScientificName,
    fetchWithTimeoutAndRetry,
    formatFetchTimeoutError,
    readImageDimensions,
    getImageExtensionFromContentType,
    formatBirdPrepMacaulayAttribution
  });
}
