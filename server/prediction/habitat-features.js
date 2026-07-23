"use strict";

const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { getResolution, isValidCell } = require("h3-js");

const { canonicalJson } = require("./spatial-splits");

const HABITAT_FEATURE_SCHEMA_VERSION = 1;
const HABITAT_FEATURE_KIND = "zhejiang_h3_r6_habitat_features";
const HABITAT_FEATURE_SET_KEYS = Object.freeze([
  "cells",
  "contract",
  "featureSetSha256",
  "generationImplementationSha256",
  "kind",
  "schemaVersion",
  "snapshotSha256",
  "tileManifestSha256"
]);
const HABITAT_FEATURE_CONTRACT = Object.freeze({
  id: "zhejiang_esa_worldcover_h3_r6_v1",
  sourceDataset: "ESA WorldCover 2021 v200",
  sourceDatasetYear: 2021,
  sourceDatasetVersion: "v200",
  sourceLicense: "CC-BY-4.0",
  sourceCrs: "EPSG:4326",
  h3Resolution: 6,
  aggregation: "deterministic_10x10_source_pixel_center_systematic_sample_within_h3_r6",
  sourceTileDegrees: 3,
  sourceTilePixels: 36_000,
  sampleStridePixels: 10,
  samplePixelOffset: 4,
  minimumCellCoverage: 0.9,
  privateBuildInput: true,
  cachePolicy: "derived_habitat_identity_and_exact_h3_must_not_enter_spatial_oof_cache"
});
const WORLDCOVER_CLASS_CODES = Object.freeze([10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100]);
const HABITAT_CLUSTERS = Object.freeze([
  "water_wetland",
  "urban",
  "forest",
  "cropland",
  "open",
  "mixed"
]);

class HabitatFeatureError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "HabitatFeatureError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function sha256File(path) {
  const hash = createHash("sha256");
  hash.update(readFileSync(path));
  return hash.digest("hex");
}

function canonicalSha256(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function normalizedFractions(fractions) {
  if (!fractions || typeof fractions !== "object" || Array.isArray(fractions)) {
    throw new HabitatFeatureError(
      "HABITAT_FEATURE_FRACTIONS_INVALID",
      "WorldCover 分类占比必须是对象。"
    );
  }
  const normalized = {};
  let total = 0;
  for (const code of WORLDCOVER_CLASS_CODES) {
    const value = Number(fractions[String(code)] ?? fractions[code] ?? 0);
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new HabitatFeatureError(
        "HABITAT_FEATURE_FRACTIONS_INVALID",
        "WorldCover 分类占比必须是 0..1 的有限数。",
        { code, value: fractions[String(code)] ?? fractions[code] }
      );
    }
    normalized[String(code)] = value;
    total += value;
  }
  const unknownCodes = Object.keys(fractions)
    .filter((code) => !WORLDCOVER_CLASS_CODES.includes(Number(code)));
  if (unknownCodes.length) {
    throw new HabitatFeatureError(
      "HABITAT_FEATURE_CLASS_UNKNOWN",
      "生境特征包含未知 WorldCover 分类。",
      { unknownCodes: unknownCodes.sort() }
    );
  }
  if (Math.abs(total - 1) > 1e-6) {
    throw new HabitatFeatureError(
      "HABITAT_FEATURE_FRACTIONS_NOT_CONSERVED",
      "WorldCover 分类占比之和必须为 1。",
      { total }
    );
  }
  return normalized;
}

function habitatClusterForFractions(fractions) {
  const values = normalizedFractions(fractions);
  const waterWetland = values["80"] + values["90"] + values["95"];
  const open = values["20"] + values["30"] + values["60"] + values["70"] + values["100"];
  if (waterWetland >= 0.25) return "water_wetland";
  if (values["50"] >= 0.3) return "urban";
  if (values["10"] >= 0.5) return "forest";
  if (values["40"] >= 0.4) return "cropland";
  if (open >= 0.5) return "open";
  return "mixed";
}

function normalizeCell(cell) {
  const h3Index = String(cell?.h3Index || "").toLowerCase();
  if (!isValidCell(h3Index) || getResolution(h3Index) !== HABITAT_FEATURE_CONTRACT.h3Resolution) {
    throw new HabitatFeatureError(
      "HABITAT_FEATURE_H3_INVALID",
      "生境特征只接受合法 H3 r6 单元。",
      { h3Index: cell?.h3Index ?? null }
    );
  }
  const coverage = Number(cell.coverage);
  if (
    !Number.isFinite(coverage) ||
    coverage < HABITAT_FEATURE_CONTRACT.minimumCellCoverage ||
    coverage > 1
  ) {
    throw new HabitatFeatureError(
      "HABITAT_FEATURE_COVERAGE_INVALID",
      "H3 r6 生境像元覆盖率未达到固定门槛。",
      { h3Index, coverage, minimum: HABITAT_FEATURE_CONTRACT.minimumCellCoverage }
    );
  }
  const fractions = normalizedFractions(cell.classFractions);
  const derivedCluster = habitatClusterForFractions(fractions);
  if (cell.habitatCluster != null && String(cell.habitatCluster) !== derivedCluster) {
    throw new HabitatFeatureError(
      "HABITAT_FEATURE_CLUSTER_MISMATCH",
      "生境类别必须由固定 WorldCover 占比规则确定。",
      { h3Index, expected: derivedCluster, actual: cell.habitatCluster }
    );
  }
  return {
    h3Index,
    coverage,
    classFractions: fractions,
    habitatCluster: derivedCluster
  };
}

function validateHabitatFeatureSet(value, {
  expectedSnapshotSha256 = null
} = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HabitatFeatureError("HABITAT_FEATURE_SET_INVALID", "生境特征文件必须是 JSON 对象。");
  }
  if (
    Number(value.schemaVersion) !== HABITAT_FEATURE_SCHEMA_VERSION ||
    value.kind !== HABITAT_FEATURE_KIND ||
    canonicalJson(value.contract) !== canonicalJson(HABITAT_FEATURE_CONTRACT)
  ) {
    throw new HabitatFeatureError(
      "HABITAT_FEATURE_CONTRACT_MISMATCH",
      "生境特征 schema、kind 或固定契约不匹配。"
    );
  }
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = value.featureSetSha256 == null
    ? HABITAT_FEATURE_SET_KEYS.filter((key) => key !== "featureSetSha256")
    : HABITAT_FEATURE_SET_KEYS;
  if (canonicalJson(actualKeys) !== canonicalJson(expectedKeys)) {
    throw new HabitatFeatureError(
      "HABITAT_FEATURE_FIELDS_INVALID",
      "生境特征文件字段不符合严格白名单。",
      { expected: expectedKeys, actual: actualKeys }
    );
  }
  const snapshotSha256 = String(value.snapshotSha256 || "").toLowerCase();
  const tileManifestSha256 = String(value.tileManifestSha256 || "").toLowerCase();
  const generationImplementationSha256 =
    String(value.generationImplementationSha256 || "").toLowerCase();
  if (
    !/^[0-9a-f]{64}$/.test(snapshotSha256) ||
    !/^[0-9a-f]{64}$/.test(tileManifestSha256) ||
    !/^[0-9a-f]{64}$/.test(generationImplementationSha256)
  ) {
    throw new HabitatFeatureError(
      "HABITAT_FEATURE_BINDING_INVALID",
      "生境特征必须绑定快照、WorldCover tile manifest 和生成实现 SHA-256。"
    );
  }
  if (
    expectedSnapshotSha256 &&
    snapshotSha256 !== String(expectedSnapshotSha256).toLowerCase()
  ) {
    throw new HabitatFeatureError(
      "HABITAT_FEATURE_SNAPSHOT_MISMATCH",
      "生境特征绑定的快照与训练快照不一致。",
      { expectedSnapshotSha256, actualSnapshotSha256: snapshotSha256 }
    );
  }
  if (!Array.isArray(value.cells) || !value.cells.length) {
    throw new HabitatFeatureError("HABITAT_FEATURE_CELLS_MISSING", "生境特征没有 H3 r6 单元。");
  }
  const cells = value.cells.map(normalizeCell)
    .sort((left, right) => left.h3Index.localeCompare(right.h3Index));
  for (let index = 1; index < cells.length; index += 1) {
    if (cells[index - 1].h3Index === cells[index].h3Index) {
      throw new HabitatFeatureError(
        "HABITAT_FEATURE_H3_DUPLICATE",
        "生境特征不得重复定义同一 H3 r6 单元。",
        { h3Index: cells[index].h3Index }
      );
    }
  }
  const payload = {
    schemaVersion: HABITAT_FEATURE_SCHEMA_VERSION,
    kind: HABITAT_FEATURE_KIND,
    contract: HABITAT_FEATURE_CONTRACT,
    snapshotSha256,
    tileManifestSha256,
    generationImplementationSha256,
    cells
  };
  const featureSetSha256 = canonicalSha256(payload);
  if (
    value.featureSetSha256 &&
    String(value.featureSetSha256).toLowerCase() !== featureSetSha256
  ) {
    throw new HabitatFeatureError(
      "HABITAT_FEATURE_SHA_MISMATCH",
      "生境特征规范化 SHA-256 不匹配。",
      { expected: value.featureSetSha256, actual: featureSetSha256 }
    );
  }
  const cellsByH3 = new Map(cells.map((cell) => [cell.h3Index, cell]));
  const clusterCounts = Object.fromEntries(HABITAT_CLUSTERS.map((cluster) => [cluster, 0]));
  for (const cell of cells) clusterCounts[cell.habitatCluster] += 1;
  return {
    ...payload,
    featureSetSha256,
    cellsByH3,
    summary: {
      cellCount: cells.length,
      clusterCounts,
      minimumCoverage: Math.min(...cells.map((cell) => cell.coverage)),
      meanCoverage: cells.reduce((sum, cell) => sum + cell.coverage, 0) / cells.length
    }
  };
}

function loadHabitatFeatureSet(path, options = {}) {
  const absolutePath = resolve(path);
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch (error) {
    throw new HabitatFeatureError(
      "HABITAT_FEATURE_READ_FAILED",
      `无法读取生境特征：${error.message}`,
      { path: absolutePath }
    );
  }
  return {
    ...validateHabitatFeatureSet(parsed, options),
    path: absolutePath,
    fileSha256: sha256File(absolutePath)
  };
}

function habitatManifestSummary(featureSet) {
  if (!featureSet) return null;
  return {
    contractId: HABITAT_FEATURE_CONTRACT.id,
    sourceDataset: HABITAT_FEATURE_CONTRACT.sourceDataset,
    sourceDatasetYear: HABITAT_FEATURE_CONTRACT.sourceDatasetYear,
    sourceDatasetVersion: HABITAT_FEATURE_CONTRACT.sourceDatasetVersion,
    sourceLicense: HABITAT_FEATURE_CONTRACT.sourceLicense,
    fileSha256: featureSet.fileSha256 || null,
    featureSetSha256: featureSet.featureSetSha256,
    generationImplementationSha256: featureSet.generationImplementationSha256,
    tileManifestSha256: featureSet.tileManifestSha256,
    snapshotSha256: featureSet.snapshotSha256,
    ...featureSet.summary
  };
}

module.exports = {
  HABITAT_CLUSTERS,
  HABITAT_FEATURE_CONTRACT,
  HABITAT_FEATURE_KIND,
  HABITAT_FEATURE_SCHEMA_VERSION,
  HABITAT_FEATURE_SET_KEYS,
  HabitatFeatureError,
  WORLDCOVER_CLASS_CODES,
  habitatClusterForFractions,
  habitatManifestSummary,
  loadHabitatFeatureSet,
  validateHabitatFeatureSet
};
