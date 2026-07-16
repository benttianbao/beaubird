"use strict";

const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const { canonicalJson } = require("./spatial-splits");

const ADMIN_TRANSFER_LEVELS = Object.freeze(["city", "district"]);
const ADMIN_EXPOSURE_CAP_CANDIDATES = Object.freeze({
  city: Object.freeze([0, 30, 100, 300, null]),
  district: Object.freeze([0, 10, 30, 100, 300])
});
const FROZEN_NOVEL_GRID_ADMIN_EXPOSURE_CAPS_V1 = Object.freeze({
  group_30_79: Object.freeze({ city: 100, district: 300 }),
  group_80_199: Object.freeze({ city: 100, district: 10 }),
  species_200_plus: Object.freeze({ city: 100, district: 10 })
});

class SpatialTransferError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "SpatialTransferError";
    this.code = code;
    this.details = details;
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeExposureCap(value, field = "cap") {
  if (value === null || value === undefined || value === "infinite" || value === "Infinity") return null;
  const cap = Number(value);
  if (!Number.isFinite(cap) || cap < 0) {
    throw new SpatialTransferError("INVALID_EXPOSURE_CAP", `${field} 必须是非负有限数或 null（表示不封顶）。`, {
      field,
      value
    });
  }
  return cap;
}

function capEffectiveEvidence(exposure, detections, cap) {
  const rawExposure = Math.max(0, Number(exposure) || 0);
  const rawDetections = Math.max(0, Math.min(rawExposure, Number(detections) || 0));
  const normalizedCap = normalizeExposureCap(cap);
  if (normalizedCap === null || rawExposure <= normalizedCap) {
    return { exposure: rawExposure, detections: rawDetections, capped: false };
  }
  if (normalizedCap === 0 || rawExposure === 0) {
    return { exposure: 0, detections: 0, capped: rawExposure > 0 };
  }
  const rate = rawDetections / rawExposure;
  return {
    exposure: normalizedCap,
    detections: rate * normalizedCap,
    capped: true
  };
}

function adminCapForTaxon(matrix, prevalence, level) {
  if (!ADMIN_TRANSFER_LEVELS.includes(level) || !matrix) return null;
  const group = matrix[prevalence] || matrix.default || null;
  if (!group || !Object.prototype.hasOwnProperty.call(group, level)) return null;
  return normalizeExposureCap(group[level], `${prevalence}.${level}`);
}

function buildAdminExposureCapCandidates() {
  const candidates = [];
  for (const city of ADMIN_EXPOSURE_CAP_CANDIDATES.city) {
    for (const district of ADMIN_EXPOSURE_CAP_CANDIDATES.district) {
      const label = (value) => value === null ? "infinite" : String(value);
      candidates.push({
        id: `city=${label(city)},district=${label(district)}`,
        caps: { city, district }
      });
    }
  }
  return candidates;
}

function panelByName(manifest, panelName) {
  if (panelName === "development") return manifest.development;
  if (panelName === "sealed-release") return manifest.sealedRelease;
  throw new SpatialTransferError(
    "INVALID_SPATIAL_PANEL",
    "空间评估面板只能是 development 或 sealed-release。",
    { panelName }
  );
}

function verifySpatialSplitManifest({
  manifestPath,
  sourceSnapshotSha256,
  panelName = "development",
  sealedPanelConfirmation = null
}) {
  const absolutePath = resolve(manifestPath);
  const bytes = readFileSync(absolutePath);
  const fileSha256 = sha256(bytes);
  const sidecarPath = `${absolutePath}.sha256`;
  const sidecar = String(readFileSync(sidecarPath, "utf8")).trim();
  const expectedFileSha256 = sidecar.split(/\s+/)[0]?.toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(expectedFileSha256 || "") || expectedFileSha256 !== fileSha256) {
    throw new SpatialTransferError("SPATIAL_SPLIT_FILE_HASH_MISMATCH", "冻结空间切分文件的 SHA-256 校验失败。", {
      manifestPath: absolutePath,
      sidecarPath,
      expectedFileSha256,
      actualFileSha256: fileSha256
    });
  }

  const manifest = JSON.parse(bytes.toString("utf8"));
  const { manifestHash, ...unsignedManifest } = manifest;
  const actualManifestHash = sha256(Buffer.from(canonicalJson(unsignedManifest), "utf8"));
  if (!/^[0-9a-f]{64}$/.test(String(manifestHash || "")) || actualManifestHash !== manifestHash) {
    throw new SpatialTransferError("SPATIAL_SPLIT_MANIFEST_HASH_MISMATCH", "冻结空间切分清单的内容哈希校验失败。", {
      manifestPath: absolutePath,
      expectedManifestHash: manifestHash || null,
      actualManifestHash
    });
  }
  if (String(manifest.sourceSnapshotSha256 || "").toLowerCase() !== String(sourceSnapshotSha256 || "").toLowerCase()) {
    throw new SpatialTransferError("SPATIAL_SPLIT_SNAPSHOT_MISMATCH", "冻结空间切分与当前训练快照不匹配。", {
      expectedSnapshotSha256: manifest.sourceSnapshotSha256 || null,
      actualSnapshotSha256: sourceSnapshotSha256 || null
    });
  }
  if (
    manifest.constraints?.targetIndependent !== true ||
    (manifest.constraints?.taxonOutcomeFieldsRead || []).length !== 0 ||
    manifest.isolation?.overlapCellCount !== 0
  ) {
    throw new SpatialTransferError("UNSAFE_SPATIAL_SPLIT", "冻结空间切分不满足目标独立或缓冲隔离约束。", {
      targetIndependent: manifest.constraints?.targetIndependent,
      taxonOutcomeFieldsRead: manifest.constraints?.taxonOutcomeFieldsRead,
      overlapCellCount: manifest.isolation?.overlapCellCount
    });
  }
  const panel = panelByName(manifest, panelName);
  if (panelName === "sealed-release" && sealedPanelConfirmation !== manifestHash) {
    throw new SpatialTransferError(
      "SEALED_SPATIAL_PANEL_CONFIRMATION_REQUIRED",
      "首次查看密封空间面板前，必须显式提供其 manifestHash；查看后不得再据此调参。",
      { manifestHash }
    );
  }
  if (!panel?.folds?.length || !panel?.anchors?.length || panel.coversExpectedCities !== true) {
    throw new SpatialTransferError("INCOMPLETE_SPATIAL_PANEL", "冻结空间评估面板不完整。", { panelName });
  }
  return {
    manifest,
    panel,
    panelName,
    manifestPath: absolutePath,
    fileSha256,
    manifestHash
  };
}

module.exports = {
  ADMIN_EXPOSURE_CAP_CANDIDATES,
  ADMIN_TRANSFER_LEVELS,
  FROZEN_NOVEL_GRID_ADMIN_EXPOSURE_CAPS_V1,
  SpatialTransferError,
  adminCapForTaxon,
  buildAdminExposureCapCandidates,
  capEffectiveEvidence,
  normalizeExposureCap,
  verifySpatialSplitManifest
};
