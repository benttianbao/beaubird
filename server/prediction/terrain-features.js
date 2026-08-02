"use strict";

const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { getResolution, isValidCell } = require("h3-js");

const { canonicalJson } = require("./spatial-splits");

const TERRAIN_FEATURE_SCHEMA_VERSION = 1;
const TERRAIN_FEATURE_KIND = "zhejiang_h3_r6_terrain_features";
const TERRAIN_FEATURE_NAMES = Object.freeze([
  "mean_elevation_m",
  "elevation_stddev_m",
  "mean_slope_deg"
]);
const TERRAIN_FEATURE_SET_KEYS = Object.freeze([
  "cellCatalogFeatureSetSha256",
  "cellCatalogFileSha256",
  "cells",
  "contract",
  "featureSetSha256",
  "generationImplementationSha256",
  "kind",
  "normalization",
  "schemaVersion",
  "snapshotSha256",
  "tileManifestSha256"
]);

const TERRAIN_FEATURE_CONTRACT = Object.freeze({
  id: "zhejiang_copernicus_dem_glo30_h3_r6_terrain_v1",
  sourceDataset: "Copernicus DEM GLO-30",
  sourceDatasetId: "COP-DEM_GLO-30-DGED",
  sourceDatasetRelease: "2024_1",
  sourcePortal: "Copernicus Data Space Ecosystem",
  sourceHorizontalCrs: "EPSG:4326",
  sourceVerticalCrs: "EPSG:3855",
  sourceVerticalUnit: "metre",
  sourceGridAlignment: "RasterPixelIsPoint",
  sourceGridSpacingArcSeconds: 1,
  sourceTileDegrees: 1,
  sourceTilePosts: 3601,
  sourceDataType: "float32",
  sourceAvailabilityPolicy:
    "use_only_source_published_glo30_dged_2024_1_tiles; do_not_fill_unpublished_tiles_with_glo90_or_zero; cells_below_sample_support_follow_the_frozen_missing_value_policy",
  sourceNotice:
    "produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved",
  targetIndependent: true,
  labelIndependent: true,
  h3Resolution: 6,
  extent:
    "exact_h3_catalog_of_zhejiang_esa_worldcover_h3_r6_continuous_v2",
  sampling: Object.freeze({
    method:
      "deterministic_source_post_center_systematic_sample_within_h3_r6",
    stridePosts: 3,
    offsetPosts: 1,
    tileEdgePolicy:
      "exclude_outermost_source_post_before_horn_slope",
    expectedNominalSpacingMetres: 90
  }),
  slope: Object.freeze({
    method: "horn_3x3_on_source_posts",
    units: "degrees",
    horizontalDistance:
      "wgs84_ellipsoid_meridional_and_prime_vertical_radii_at_sample_latitude",
    noDataPolicy: "require_all_nine_posts_finite_and_not_nodata"
  }),
  aggregation: Object.freeze({
    meanElevation: "arithmetic_mean_of_valid_sampled_posts",
    elevationStandardDeviation:
      "population_standard_deviation_of_valid_sampled_posts",
    meanSlope: "arithmetic_mean_of_valid_sampled_horn_slopes"
  }),
  minimumAvailableSampleCount: 32,
  missingValuePolicy:
    "if_elevation_or_slope_support_below_32_store_null_raw_values_and_use_zero_standardized_vector",
  standardization: Object.freeze({
    population:
      "all_available_cells_in_frozen_target_independent_terrain_feature_set",
    method: "population_mean_and_standard_deviation",
    minimumStandardDeviation: 1e-8,
    belowMinimumStandardDeviationDenominator: 1,
    standardizedClip: 6,
    missingVector: [0, 0, 0]
  }),
  runtimeConsistency:
    "training_and_service_must_read_the_same_precomputed_h3_r6_feature_rows_and_frozen_normalization",
  cachePolicy:
    "raw_terrain_exact_h3_and_neighbor_identities_must_not_enter_oof_cache"
});

class TerrainFeatureError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "TerrainFeatureError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function canonicalSha256(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function normalizeSha256(value, path) {
  const normalized = String(value || "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new TerrainFeatureError(
      "TERRAIN_FEATURE_BINDING_INVALID",
      `${path} 必须是 SHA-256。`
    );
  }
  return normalized;
}

function finiteInteger(value, path, minimum = 0) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum) {
    throw new TerrainFeatureError(
      "TERRAIN_FEATURE_VALUE_INVALID",
      `${path} 必须是大于等于 ${minimum} 的整数。`
    );
  }
  return number;
}

function finiteNumber(value, path, minimum = -Infinity) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum) {
    throw new TerrainFeatureError(
      "TERRAIN_FEATURE_VALUE_INVALID",
      `${path} 必须是大于等于 ${minimum} 的有限数。`
    );
  }
  return number;
}

function normalizeCell(cell, index) {
  const path = `cells[${index}]`;
  const actualKeys = Object.keys(cell || {}).sort();
  const expectedKeys = [
    "available",
    "elevationSampleCount",
    "elevationStdDevMeters",
    "h3Index",
    "meanElevationMeters",
    "meanSlopeDegrees",
    "slopeSampleCount"
  ];
  if (canonicalJson(actualKeys) !== canonicalJson(expectedKeys)) {
    throw new TerrainFeatureError(
      "TERRAIN_FEATURE_FIELDS_INVALID",
      `${path} 字段不符合严格白名单。`,
      { expected: expectedKeys, actual: actualKeys }
    );
  }
  const h3Index = String(cell?.h3Index || "").toLowerCase();
  if (
    !isValidCell(h3Index) ||
    getResolution(h3Index) !== TERRAIN_FEATURE_CONTRACT.h3Resolution
  ) {
    throw new TerrainFeatureError(
      "TERRAIN_FEATURE_H3_INVALID",
      `${path}.h3Index 不是合法 H3 r6。`,
      { h3Index }
    );
  }
  if (typeof cell.available !== "boolean") {
    throw new TerrainFeatureError(
      "TERRAIN_FEATURE_VALUE_INVALID",
      `${path}.available 必须是布尔值。`
    );
  }
  const elevationSampleCount = finiteInteger(
    cell.elevationSampleCount,
    `${path}.elevationSampleCount`
  );
  const slopeSampleCount = finiteInteger(
    cell.slopeSampleCount,
    `${path}.slopeSampleCount`
  );
  const minimum = TERRAIN_FEATURE_CONTRACT.minimumAvailableSampleCount;
  if (!cell.available) {
    if (
      cell.meanElevationMeters !== null ||
      cell.elevationStdDevMeters !== null ||
      cell.meanSlopeDegrees !== null ||
      (elevationSampleCount >= minimum && slopeSampleCount >= minimum)
    ) {
      throw new TerrainFeatureError(
        "TERRAIN_FEATURE_MISSING_POLICY_INVALID",
        `${path} 不符合冻结缺失值规则。`
      );
    }
    return {
      h3Index,
      available: false,
      elevationSampleCount,
      slopeSampleCount,
      meanElevationMeters: null,
      elevationStdDevMeters: null,
      meanSlopeDegrees: null
    };
  }
  if (elevationSampleCount < minimum || slopeSampleCount < minimum) {
    throw new TerrainFeatureError(
      "TERRAIN_FEATURE_SUPPORT_INSUFFICIENT",
      `${path} 可用但样本数不足。`
    );
  }
  return {
    h3Index,
    available: true,
    elevationSampleCount,
    slopeSampleCount,
    meanElevationMeters: finiteNumber(
      cell.meanElevationMeters,
      `${path}.meanElevationMeters`
    ),
    elevationStdDevMeters: finiteNumber(
      cell.elevationStdDevMeters,
      `${path}.elevationStdDevMeters`,
      0
    ),
    meanSlopeDegrees: finiteNumber(
      cell.meanSlopeDegrees,
      `${path}.meanSlopeDegrees`,
      0
    )
  };
}

function rawVector(cell) {
  return [
    cell.meanElevationMeters,
    cell.elevationStdDevMeters,
    cell.meanSlopeDegrees
  ];
}

function stableNumber(value) {
  return Number(Number(value).toFixed(12));
}

function normalizationForCells(cells) {
  const available = cells.filter((cell) => cell.available);
  if (!available.length) {
    throw new TerrainFeatureError(
      "TERRAIN_FEATURE_CELLS_MISSING",
      "地形特征没有任何可用 H3 r6 单元。"
    );
  }
  const means = TERRAIN_FEATURE_NAMES.map((_, featureIndex) =>
    available.reduce(
      (sum, cell) => sum + rawVector(cell)[featureIndex],
      0
    ) / available.length
  );
  const standardDeviations = TERRAIN_FEATURE_NAMES.map(
    (_, featureIndex) => {
      const variance =
        available.reduce((sum, cell) => {
          const difference = rawVector(cell)[featureIndex] - means[featureIndex];
          return sum + difference * difference;
        }, 0) / available.length;
      const standardDeviation = Math.sqrt(variance);
      return standardDeviation <
        TERRAIN_FEATURE_CONTRACT.standardization.minimumStandardDeviation
        ? 1
        : standardDeviation;
    }
  );
  return {
    featureNames: [...TERRAIN_FEATURE_NAMES],
    means: means.map(stableNumber),
    standardDeviations: standardDeviations.map(stableNumber),
    standardizedClip:
      TERRAIN_FEATURE_CONTRACT.standardization.standardizedClip
  };
}

function normalizeNormalization(value, cells) {
  const expected = normalizationForCells(cells);
  const actualKeys = Object.keys(value || {}).sort();
  const expectedKeys = Object.keys(expected).sort();
  if (
    canonicalJson(actualKeys) !== canonicalJson(expectedKeys) ||
    canonicalJson(value?.featureNames) !==
      canonicalJson(expected.featureNames) ||
    Number(value?.standardizedClip) !== expected.standardizedClip
  ) {
    throw new TerrainFeatureError(
      "TERRAIN_FEATURE_NORMALIZATION_INVALID",
      "地形标准化字段或冻结参数不匹配。"
    );
  }
  for (const key of ["means", "standardDeviations"]) {
    if (!Array.isArray(value[key]) || value[key].length !== expected[key].length) {
      throw new TerrainFeatureError(
        "TERRAIN_FEATURE_NORMALIZATION_INVALID",
        `normalization.${key} 维数不匹配。`
      );
    }
    for (let index = 0; index < expected[key].length; index += 1) {
      const actual = finiteNumber(
        value[key][index],
        `normalization.${key}[${index}]`,
        key === "standardDeviations" ? Number.MIN_VALUE : -Infinity
      );
      if (Math.abs(actual - expected[key][index]) > 1e-12) {
        throw new TerrainFeatureError(
          "TERRAIN_FEATURE_NORMALIZATION_MISMATCH",
          `normalization.${key}[${index}] 不是由冻结公共地形单元确定性计算。`,
          { expected: expected[key][index], actual }
        );
      }
    }
  }
  return expected;
}

function validateTerrainFeatureSet(value, {
  expectedSnapshotSha256 = null,
  expectedCellCatalogFileSha256 = null,
  expectedCellCatalogFeatureSetSha256 = null,
  requiredH3Indexes = null
} = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TerrainFeatureError(
      "TERRAIN_FEATURE_SET_INVALID",
      "地形特征文件必须是 JSON 对象。"
    );
  }
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = value.featureSetSha256 == null
    ? TERRAIN_FEATURE_SET_KEYS.filter((key) => key !== "featureSetSha256")
    : TERRAIN_FEATURE_SET_KEYS;
  if (canonicalJson(actualKeys) !== canonicalJson(expectedKeys)) {
    throw new TerrainFeatureError(
      "TERRAIN_FEATURE_FIELDS_INVALID",
      "地形特征文件字段不符合严格白名单。",
      { expected: expectedKeys, actual: actualKeys }
    );
  }
  if (
    Number(value.schemaVersion) !== TERRAIN_FEATURE_SCHEMA_VERSION ||
    value.kind !== TERRAIN_FEATURE_KIND ||
    canonicalJson(value.contract) !== canonicalJson(TERRAIN_FEATURE_CONTRACT)
  ) {
    throw new TerrainFeatureError(
      "TERRAIN_FEATURE_CONTRACT_MISMATCH",
      "地形特征 schema、kind 或冻结契约不匹配。"
    );
  }
  const snapshotSha256 = normalizeSha256(
    value.snapshotSha256,
    "snapshotSha256"
  );
  const cellCatalogFileSha256 = normalizeSha256(
    value.cellCatalogFileSha256,
    "cellCatalogFileSha256"
  );
  const cellCatalogFeatureSetSha256 = normalizeSha256(
    value.cellCatalogFeatureSetSha256,
    "cellCatalogFeatureSetSha256"
  );
  const tileManifestSha256 = normalizeSha256(
    value.tileManifestSha256,
    "tileManifestSha256"
  );
  const generationImplementationSha256 = normalizeSha256(
    value.generationImplementationSha256,
    "generationImplementationSha256"
  );
  const expectedBindings = [
    ["snapshotSha256", expectedSnapshotSha256, snapshotSha256],
    [
      "cellCatalogFileSha256",
      expectedCellCatalogFileSha256,
      cellCatalogFileSha256
    ],
    [
      "cellCatalogFeatureSetSha256",
      expectedCellCatalogFeatureSetSha256,
      cellCatalogFeatureSetSha256
    ]
  ];
  for (const [path, expected, actual] of expectedBindings) {
    if (expected && String(expected).toLowerCase() !== actual) {
      throw new TerrainFeatureError(
        "TERRAIN_FEATURE_BINDING_MISMATCH",
        `${path} 与冻结输入不匹配。`,
        { expected, actual }
      );
    }
  }
  if (!Array.isArray(value.cells) || !value.cells.length) {
    throw new TerrainFeatureError(
      "TERRAIN_FEATURE_CELLS_MISSING",
      "地形特征没有 H3 r6 单元。"
    );
  }
  const cells = value.cells.map(normalizeCell).sort((left, right) =>
    left.h3Index.localeCompare(right.h3Index)
  );
  for (let index = 1; index < cells.length; index += 1) {
    if (cells[index - 1].h3Index === cells[index].h3Index) {
      throw new TerrainFeatureError(
        "TERRAIN_FEATURE_H3_DUPLICATE",
        "地形特征不得重复定义同一 H3 r6 单元。",
        { h3Index: cells[index].h3Index }
      );
    }
  }
  const normalization = normalizeNormalization(value.normalization, cells);
  const cellsByH3 = new Map(cells.map((cell) => [cell.h3Index, cell]));
  const required = requiredH3Indexes == null
    ? []
    : [...new Set(
        [...requiredH3Indexes].map((h3Index) =>
          String(h3Index).toLowerCase()
        )
      )].sort();
  const missingRequiredH3Indexes = required.filter(
    (h3Index) => !cellsByH3.has(h3Index)
  );
  const requiredSet = new Set(required);
  const unexpectedH3Indexes = required.length
    ? cells
        .map((cell) => cell.h3Index)
        .filter((h3Index) => !requiredSet.has(h3Index))
    : [];
  if (
    missingRequiredH3Indexes.length ||
    unexpectedH3Indexes.length
  ) {
    throw new TerrainFeatureError(
      "TERRAIN_FEATURE_COVERAGE_EXACT_MISMATCH",
      "地形特征没有覆盖全部冻结 H3 r6 单元。",
      {
        missingCount: missingRequiredH3Indexes.length,
        firstMissingH3Indexes:
          missingRequiredH3Indexes.slice(0, 20),
        unexpectedCount: unexpectedH3Indexes.length,
        firstUnexpectedH3Indexes:
          unexpectedH3Indexes.slice(0, 20)
      }
    );
  }
  const payload = {
    schemaVersion: TERRAIN_FEATURE_SCHEMA_VERSION,
    kind: TERRAIN_FEATURE_KIND,
    contract: TERRAIN_FEATURE_CONTRACT,
    snapshotSha256,
    cellCatalogFileSha256,
    cellCatalogFeatureSetSha256,
    tileManifestSha256,
    generationImplementationSha256,
    normalization,
    cells
  };
  const featureSetSha256 = canonicalSha256(payload);
  if (
    value.featureSetSha256 &&
    String(value.featureSetSha256).toLowerCase() !== featureSetSha256
  ) {
    throw new TerrainFeatureError(
      "TERRAIN_FEATURE_SHA_MISMATCH",
      "地形特征规范化 SHA-256 不匹配。",
      { expected: value.featureSetSha256, actual: featureSetSha256 }
    );
  }
  const availableCells = cells.filter((cell) => cell.available);
  return {
    ...payload,
    featureSetSha256,
    cellsByH3,
    summary: {
      cellCount: cells.length,
      availableCellCount: availableCells.length,
      missingCellCount: cells.length - availableCells.length,
      minimumElevationSampleCount: Math.min(
        ...availableCells.map((cell) => cell.elevationSampleCount)
      ),
      minimumSlopeSampleCount: Math.min(
        ...availableCells.map((cell) => cell.slopeSampleCount)
      )
    }
  };
}

function loadTerrainFeatureSet(path, options = {}) {
  const absolutePath = resolve(path);
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch (error) {
    throw new TerrainFeatureError(
      "TERRAIN_FEATURE_READ_FAILED",
      `无法读取地形特征：${error.message}`,
      { path: absolutePath }
    );
  }
  return {
    ...validateTerrainFeatureSet(parsed, options),
    path: absolutePath,
    fileSha256: sha256File(absolutePath)
  };
}

function terrainVector(cell, featureSet) {
  if (!cell || !featureSet?.normalization) {
    throw new TerrainFeatureError(
      "TERRAIN_FEATURE_VECTOR_INVALID",
      "地形标准化需要有效单元和冻结特征集。"
    );
  }
  if (!cell.available) {
    return [...TERRAIN_FEATURE_CONTRACT.standardization.missingVector];
  }
  const vector = rawVector(cell);
  const clip = featureSet.normalization.standardizedClip;
  return vector.map((value, index) =>
    Math.max(
      -clip,
      Math.min(
        clip,
        (value - featureSet.normalization.means[index]) /
          featureSet.normalization.standardDeviations[index]
      )
    )
  );
}

function terrainManifestSummary(featureSet) {
  if (!featureSet) return null;
  return {
    contractId: TERRAIN_FEATURE_CONTRACT.id,
    sourceDataset: TERRAIN_FEATURE_CONTRACT.sourceDataset,
    sourceDatasetId: TERRAIN_FEATURE_CONTRACT.sourceDatasetId,
    sourceDatasetRelease:
      TERRAIN_FEATURE_CONTRACT.sourceDatasetRelease,
    sourceNotice: TERRAIN_FEATURE_CONTRACT.sourceNotice,
    fileSha256: featureSet.fileSha256 || null,
    featureSetSha256: featureSet.featureSetSha256,
    generationImplementationSha256:
      featureSet.generationImplementationSha256,
    tileManifestSha256: featureSet.tileManifestSha256,
    snapshotSha256: featureSet.snapshotSha256,
    cellCatalogFileSha256: featureSet.cellCatalogFileSha256,
    cellCatalogFeatureSetSha256:
      featureSet.cellCatalogFeatureSetSha256,
    normalization: featureSet.normalization,
    ...featureSet.summary
  };
}

module.exports = {
  TERRAIN_FEATURE_CONTRACT,
  TERRAIN_FEATURE_KIND,
  TERRAIN_FEATURE_NAMES,
  TERRAIN_FEATURE_SCHEMA_VERSION,
  TERRAIN_FEATURE_SET_KEYS,
  TerrainFeatureError,
  loadTerrainFeatureSet,
  normalizationForCells,
  terrainManifestSummary,
  terrainVector,
  validateTerrainFeatureSet
};
