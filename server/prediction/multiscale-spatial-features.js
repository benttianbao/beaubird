"use strict";

const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { gridRing } = require("h3-js");

const {
  CONTINUOUS_HABITAT_FEATURE_CONTRACT,
  WORLDCOVER_CLASS_CODES
} = require("./habitat-features");
const { canonicalJson } = require("./spatial-splits");

const MULTISCALE_SPATIAL_FEATURE_FILES = Object.freeze([
  "server/prediction/habitat-features.js",
  "server/prediction/multiscale-spatial-features.js"
]);
const MULTISCALE_SPATIAL_FEATURE_SCHEMA_VERSION = 1;
const MULTISCALE_SPATIAL_FEATURE_PROFILE_COUNT = 24;
const MULTISCALE_SPATIAL_FEATURE_MINIMUM_PUBLIC_CELLS = 32;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const entry of Object.values(value)) deepFreeze(entry);
  return Object.freeze(value);
}

const MULTISCALE_SPATIAL_FEATURE_NAMES = Object.freeze([
  ...["local", "ring_1", "ring_2"].flatMap((scale) =>
    WORLDCOVER_CLASS_CODES.map((code) => `${scale}.worldcover_${code}`)
  ),
  "local.entropy",
  "ring_1.entropy",
  "ring_2.entropy",
  "contrast.local_to_ring_1_hellinger",
  "contrast.local_to_ring_2_hellinger",
  "availability.ring_1",
  "availability.ring_2"
]);

const MULTISCALE_SPATIAL_FEATURE_CONTRACT = deepFreeze({
  id: "zhejiang_worldcover_h3_r6_multiscale_profiles_v1",
  schemaVersion: MULTISCALE_SPATIAL_FEATURE_SCHEMA_VERSION,
  sourceFeatureContractId: CONTINUOUS_HABITAT_FEATURE_CONTRACT.id,
  sourceDataset: CONTINUOUS_HABITAT_FEATURE_CONTRACT.sourceDataset,
  targetIndependent: true,
  labelIndependent: true,
  h3Resolution: 6,
  classCodes: [...WORLDCOVER_CLASS_CODES],
  scales: [
    {
      id: "local",
      ringDistance: 0,
      expectedCellCount: 1,
      aggregation: "target_cell_fraction"
    },
    {
      id: "ring_1",
      ringDistance: 1,
      expectedCellCount: 6,
      aggregation: "coverage_weighted_mean_over_available_exact_ring_cells"
    },
    {
      id: "ring_2",
      ringDistance: 2,
      expectedCellCount: 12,
      aggregation: "coverage_weighted_mean_over_available_exact_ring_cells"
    }
  ],
  featureOrder: [...MULTISCALE_SPATIAL_FEATURE_NAMES],
  derivedFeatures: {
    entropy: "normalized_shannon_entropy_over_11_worldcover_classes",
    contrast: "hellinger_distance_between_local_and_ring_composition",
    availability: "available_feature_cells_divided_by_expected_ring_cells"
  },
  standardization: {
    population: "all_cells_in_frozen_public_worldcover_feature_set",
    method: "population_mean_and_standard_deviation",
    minimumStandardDeviation: 1e-8,
    standardizedClip: 6
  },
  profiling: {
    algorithm: "deterministic_farthest_seed_kmeans_then_small_cluster_merge_v1",
    requestedProfileCount: MULTISCALE_SPATIAL_FEATURE_PROFILE_COUNT,
    maximumIterations: 30,
    distance: "squared_euclidean_on_standardized_features",
    minimumPublicCellsPerProfile:
      MULTISCALE_SPATIAL_FEATURE_MINIMUM_PUBLIC_CELLS,
    tieBreak: "lexicographic_h3_then_original_cluster_index"
  },
  temporalContext: {
    cacheField: "season_week",
    allowedRange: [0, 52],
    spatialProfileMustRemainSeasonIndependent: true
  },
  cacheRepresentation: {
    exactH3: false,
    exactCoordinates: false,
    exactPerContextFeatureVector: false,
    storedPerContext: ["profile_id", "season_week"],
    storedPerProfile: [
      "public_cell_count",
      "standardized_centroid"
    ]
  }
});

class MultiscaleSpatialFeatureError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "MultiscaleSpatialFeatureError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function canonicalSha256(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function multiscaleSpatialFeatureContractSha256() {
  return canonicalSha256(MULTISCALE_SPATIAL_FEATURE_CONTRACT);
}

function multiscaleSpatialFeatureGenerationImplementationSha256(
  projectRoot = resolve(__dirname, "..", "..")
) {
  const hash = createHash("sha256");
  for (const relativePath of [...MULTISCALE_SPATIAL_FEATURE_FILES].sort()) {
    hash.update(relativePath, "utf8");
    hash.update("\0", "utf8");
    hash.update(readFileSync(resolve(projectRoot, relativePath)));
    hash.update("\0", "utf8");
  }
  return hash.digest("hex");
}

function finiteFraction(value, path) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw new MultiscaleSpatialFeatureError(
      "MULTISCALE_SPATIAL_FEATURE_VALUE_INVALID",
      `${path} 必须是 0..1 的有限数。`,
      { path, value }
    );
  }
  return number;
}

function normalizedEntropy(composition) {
  const entropy = composition.reduce(
    (sum, value) => value > 0 ? sum - value * Math.log(value) : sum,
    0
  );
  return entropy / Math.log(WORLDCOVER_CLASS_CODES.length);
}

function hellingerDistance(left, right) {
  const squared = left.reduce(
    (sum, value, index) =>
      sum + (Math.sqrt(value) - Math.sqrt(right[index])) ** 2,
    0
  );
  return Math.sqrt(squared) / Math.sqrt(2);
}

function featureSetCells(featureSet) {
  if (
    !featureSet ||
    featureSet.contract?.id !==
      MULTISCALE_SPATIAL_FEATURE_CONTRACT.sourceFeatureContractId ||
    !(featureSet.cellsByH3 instanceof Map) ||
    !Array.isArray(featureSet.cells) ||
    !featureSet.cells.length
  ) {
    throw new MultiscaleSpatialFeatureError(
      "MULTISCALE_SPATIAL_FEATURE_SOURCE_INVALID",
      "多尺度空间特征必须绑定已验证的连续 WorldCover v2 特征集。"
    );
  }
  return featureSet.cells;
}

function compositionForCells(cells, path) {
  if (!cells.length) {
    throw new MultiscaleSpatialFeatureError(
      "MULTISCALE_SPATIAL_FEATURE_RING_EMPTY",
      `${path} 没有任何可用的公开 WorldCover 单元。`,
      { path }
    );
  }
  const totals = Array(WORLDCOVER_CLASS_CODES.length).fill(0);
  let weightSum = 0;
  for (const cell of cells) {
    const weight = finiteFraction(cell.coverage, `${path}.coverage`);
    weightSum += weight;
    for (let index = 0; index < WORLDCOVER_CLASS_CODES.length; index += 1) {
      const code = WORLDCOVER_CLASS_CODES[index];
      totals[index] +=
        weight *
        finiteFraction(
          cell.classFractions[String(code)],
          `${path}.classFractions.${code}`
        );
    }
  }
  if (weightSum <= 0) {
    throw new MultiscaleSpatialFeatureError(
      "MULTISCALE_SPATIAL_FEATURE_RING_EMPTY",
      `${path} 的有效覆盖权重为零。`,
      { path }
    );
  }
  const composition = totals.map((value) => value / weightSum);
  const total = composition.reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 1) > 1e-6) {
    throw new MultiscaleSpatialFeatureError(
      "MULTISCALE_SPATIAL_FEATURE_NOT_CONSERVED",
      `${path} 的 WorldCover 占比之和必须为 1。`,
      { path, total }
    );
  }
  return composition;
}

function multiscaleSpatialFeatureVector(h3Index, featureSet) {
  featureSetCells(featureSet);
  const target = String(h3Index || "").toLowerCase();
  const localCell = featureSet.cellsByH3.get(target);
  if (!localCell) {
    throw new MultiscaleSpatialFeatureError(
      "MULTISCALE_SPATIAL_FEATURE_TARGET_MISSING",
      "目标 H3 不在冻结的公开 WorldCover 特征集中。"
    );
  }
  const local = compositionForCells([localCell], "local");
  const rings = [];
  const availability = [];
  for (const distance of [1, 2]) {
    const expected = gridRing(target, distance);
    const available = expected
      .map((cell) => featureSet.cellsByH3.get(String(cell).toLowerCase()))
      .filter(Boolean);
    rings.push(
      compositionForCells(available, `ring_${distance}`)
    );
    availability.push(available.length / expected.length);
  }
  const values = [
    ...local,
    ...rings[0],
    ...rings[1],
    normalizedEntropy(local),
    normalizedEntropy(rings[0]),
    normalizedEntropy(rings[1]),
    hellingerDistance(local, rings[0]),
    hellingerDistance(local, rings[1]),
    ...availability
  ];
  if (values.length !== MULTISCALE_SPATIAL_FEATURE_NAMES.length) {
    throw new MultiscaleSpatialFeatureError(
      "MULTISCALE_SPATIAL_FEATURE_DIMENSION_MISMATCH",
      "多尺度空间特征维数与冻结契约不一致。"
    );
  }
  return values;
}

function squaredDistance(left, right) {
  let sum = 0;
  for (let index = 0; index < left.length; index += 1) {
    const difference = left[index] - right[index];
    sum += difference * difference;
  }
  return sum;
}

function nearestCentroid(vector, centroids, allowedIndexes = null) {
  const indexes = allowedIndexes || centroids.map((_, index) => index);
  let bestIndex = indexes[0];
  let bestDistance = squaredDistance(vector, centroids[bestIndex]);
  for (let offset = 1; offset < indexes.length; offset += 1) {
    const index = indexes[offset];
    const distance = squaredDistance(vector, centroids[index]);
    if (
      distance < bestDistance - 1e-12 ||
      (Math.abs(distance - bestDistance) <= 1e-12 && index < bestIndex)
    ) {
      bestIndex = index;
      bestDistance = distance;
    }
  }
  return { index: bestIndex, distance: bestDistance };
}

function meanVector(rows, indexes, dimension) {
  const centroid = Array(dimension).fill(0);
  for (const rowIndex of indexes) {
    const vector = rows[rowIndex].standardized;
    for (let index = 0; index < dimension; index += 1) {
      centroid[index] += vector[index];
    }
  }
  return centroid.map((value) => value / indexes.length);
}

function deterministicKMeans(rows, requestedProfileCount, maximumIterations) {
  const dimension = rows[0].standardized.length;
  const count = Math.min(requestedProfileCount, rows.length);
  const origin = Array(dimension).fill(0);
  const firstSeed = rows.reduce((best, row, index) => {
    const distance = squaredDistance(row.standardized, origin);
    if (
      !best ||
      distance < best.distance - 1e-12 ||
      (
        Math.abs(distance - best.distance) <= 1e-12 &&
        row.h3Index.localeCompare(rows[best.index].h3Index) < 0
      )
    ) {
      return { index, distance };
    }
    return best;
  }, null).index;
  const seedIndexes = [firstSeed];
  while (seedIndexes.length < count) {
    let next = null;
    for (let index = 0; index < rows.length; index += 1) {
      if (seedIndexes.includes(index)) continue;
      const distance = Math.min(
        ...seedIndexes.map((seed) =>
          squaredDistance(rows[index].standardized, rows[seed].standardized)
        )
      );
      if (
        !next ||
        distance > next.distance + 1e-12 ||
        (
          Math.abs(distance - next.distance) <= 1e-12 &&
          rows[index].h3Index.localeCompare(rows[next.index].h3Index) < 0
        )
      ) {
        next = { index, distance };
      }
    }
    seedIndexes.push(next.index);
  }
  let centroids = seedIndexes.map((index) => [...rows[index].standardized]);
  let assignments = Array(rows.length).fill(-1);
  for (let iteration = 0; iteration < maximumIterations; iteration += 1) {
    const nextAssignments = rows.map(
      (row) => nearestCentroid(row.standardized, centroids).index
    );
    const groups = Array.from({ length: count }, () => []);
    nextAssignments.forEach((cluster, rowIndex) => groups[cluster].push(rowIndex));
    for (let cluster = 0; cluster < count; cluster += 1) {
      if (groups[cluster].length) continue;
      const replacement = rows.reduce((best, row, rowIndex) => {
        const assigned = nextAssignments[rowIndex];
        if (groups[assigned].length <= 1) return best;
        const distance = squaredDistance(row.standardized, centroids[assigned]);
        if (
          !best ||
          distance > best.distance + 1e-12 ||
          (
            Math.abs(distance - best.distance) <= 1e-12 &&
            row.h3Index.localeCompare(rows[best.rowIndex].h3Index) < 0
          )
        ) {
          return { rowIndex, distance, assigned };
        }
        return best;
      }, null);
      if (!replacement) continue;
      nextAssignments[replacement.rowIndex] = cluster;
      groups[cluster].push(replacement.rowIndex);
      const prior = groups[replacement.assigned];
      if (prior) {
        const offset = prior.indexOf(replacement.rowIndex);
        if (offset >= 0) prior.splice(offset, 1);
      }
    }
    const stable = nextAssignments.every(
      (cluster, index) => cluster === assignments[index]
    );
    assignments = nextAssignments;
    centroids = Array.from({ length: count }, (_, cluster) => {
      const indexes = assignments
        .map((assignment, rowIndex) =>
          assignment === cluster ? rowIndex : -1
        )
        .filter((rowIndex) => rowIndex >= 0);
      return indexes.length
        ? meanVector(rows, indexes, dimension)
        : centroids[cluster];
    });
    if (stable) break;
  }
  return { assignments, centroids };
}

function mergeSmallProfiles(rows, fitted, minimumPublicCells) {
  const counts = Array(fitted.centroids.length).fill(0);
  for (const cluster of fitted.assignments) counts[cluster] += 1;
  const retained = counts
    .map((count, index) => ({ count, index }))
    .filter((entry) => entry.count >= minimumPublicCells)
    .map((entry) => entry.index);
  if (!retained.length) {
    throw new MultiscaleSpatialFeatureError(
      "MULTISCALE_SPATIAL_FEATURE_PROFILE_SUPPORT_INSUFFICIENT",
      "没有空间特征原型达到冻结的公共单元支持度。"
    );
  }
  const assignments = fitted.assignments.map((cluster, rowIndex) =>
    retained.includes(cluster)
      ? cluster
      : nearestCentroid(
          rows[rowIndex].standardized,
          fitted.centroids,
          retained
        ).index
  );
  const remap = new Map(retained.map((cluster, index) => [cluster, index]));
  const normalizedAssignments = assignments.map((cluster) => remap.get(cluster));
  const centroids = retained.map((_, profileIndex) => {
    const indexes = normalizedAssignments
      .map((assignment, rowIndex) =>
        assignment === profileIndex ? rowIndex : -1
      )
      .filter((rowIndex) => rowIndex >= 0);
    return meanVector(rows, indexes, rows[0].standardized.length);
  });
  return { assignments: normalizedAssignments, centroids };
}

function stableNumber(value) {
  return Number(Number(value).toFixed(12));
}

function buildMultiscaleSpatialFeatureProfiles(featureSet) {
  const cells = featureSetCells(featureSet);
  if (
    cells.length <
    MULTISCALE_SPATIAL_FEATURE_PROFILE_COUNT *
      MULTISCALE_SPATIAL_FEATURE_MINIMUM_PUBLIC_CELLS
  ) {
    throw new MultiscaleSpatialFeatureError(
      "MULTISCALE_SPATIAL_FEATURE_PUBLIC_SUPPORT_INSUFFICIENT",
      "公开 WorldCover 单元不足以满足冻结的特征原型隐私支持度。",
      {
        cellCount: cells.length,
        required:
          MULTISCALE_SPATIAL_FEATURE_PROFILE_COUNT *
          MULTISCALE_SPATIAL_FEATURE_MINIMUM_PUBLIC_CELLS
      }
    );
  }
  const rows = [...cells]
    .sort((left, right) => left.h3Index.localeCompare(right.h3Index))
    .map((cell) => ({
      h3Index: cell.h3Index,
      raw: multiscaleSpatialFeatureVector(cell.h3Index, featureSet)
    }));
  const dimension = MULTISCALE_SPATIAL_FEATURE_NAMES.length;
  const means = Array.from({ length: dimension }, (_, featureIndex) =>
    rows.reduce((sum, row) => sum + row.raw[featureIndex], 0) / rows.length
  );
  const standardDeviations = Array.from(
    { length: dimension },
    (_, featureIndex) => {
      const variance =
        rows.reduce((sum, row) => {
          const difference = row.raw[featureIndex] - means[featureIndex];
          return sum + difference * difference;
        }, 0) / rows.length;
      const standardDeviation = Math.sqrt(variance);
      return standardDeviation <
        MULTISCALE_SPATIAL_FEATURE_CONTRACT.standardization
          .minimumStandardDeviation
        ? 1
        : standardDeviation;
    }
  );
  const clip =
    MULTISCALE_SPATIAL_FEATURE_CONTRACT.standardization.standardizedClip;
  for (const row of rows) {
    row.standardized = row.raw.map((value, index) =>
      Math.max(
        -clip,
        Math.min(clip, (value - means[index]) / standardDeviations[index])
      )
    );
  }
  const fitted = deterministicKMeans(
    rows,
    MULTISCALE_SPATIAL_FEATURE_PROFILE_COUNT,
    MULTISCALE_SPATIAL_FEATURE_CONTRACT.profiling.maximumIterations
  );
  const merged = mergeSmallProfiles(
    rows,
    fitted,
    MULTISCALE_SPATIAL_FEATURE_MINIMUM_PUBLIC_CELLS
  );
  const profileCounts = Array(merged.centroids.length).fill(0);
  for (const profile of merged.assignments) profileCounts[profile] += 1;
  const profiles = merged.centroids.map((centroid, index) => ({
    profileId: `profile_${String(index + 1).padStart(2, "0")}`,
    publicCellCount: profileCounts[index],
    standardizedCentroid: centroid.map(stableNumber)
  }));
  if (
    profiles.some(
      (profile) =>
        profile.publicCellCount <
        MULTISCALE_SPATIAL_FEATURE_MINIMUM_PUBLIC_CELLS
    )
  ) {
    throw new MultiscaleSpatialFeatureError(
      "MULTISCALE_SPATIAL_FEATURE_PROFILE_SUPPORT_INSUFFICIENT",
      "合并后的空间特征原型仍未达到隐私支持度。"
    );
  }
  const profileByH3 = new Map(
    rows.map((row, index) => [
      row.h3Index,
      profiles[merged.assignments[index]].profileId
    ])
  );
  const normalization = {
    featureNames: [...MULTISCALE_SPATIAL_FEATURE_NAMES],
    means: means.map(stableNumber),
    standardDeviations: standardDeviations.map(stableNumber),
    standardizedClip: clip
  };
  const serializable = {
    schemaVersion: MULTISCALE_SPATIAL_FEATURE_SCHEMA_VERSION,
    contractSha256: multiscaleSpatialFeatureContractSha256(),
    sourceFeatureContractId: featureSet.contract.id,
    sourceFeatureSetSha256: featureSet.featureSetSha256,
    publicCellCount: rows.length,
    normalization,
    profiles
  };
  return {
    ...serializable,
    profileModelSha256: canonicalSha256(serializable),
    profileByH3,
    summary: {
      featureCount: dimension,
      requestedProfileCount: MULTISCALE_SPATIAL_FEATURE_PROFILE_COUNT,
      retainedProfileCount: profiles.length,
      minimumPublicCellCount: Math.min(
        ...profiles.map((profile) => profile.publicCellCount)
      ),
      maximumPublicCellCount: Math.max(
        ...profiles.map((profile) => profile.publicCellCount)
      )
    }
  };
}

function serializableMultiscaleSpatialFeatureProfiles(profileModel) {
  if (
    !profileModel ||
    !(profileModel.profileByH3 instanceof Map) ||
    !Array.isArray(profileModel.profiles)
  ) {
    throw new MultiscaleSpatialFeatureError(
      "MULTISCALE_SPATIAL_FEATURE_PROFILE_MODEL_INVALID",
      "空间特征原型模型无效。"
    );
  }
  const serializable = {
    schemaVersion: profileModel.schemaVersion,
    contractSha256: profileModel.contractSha256,
    sourceFeatureContractId: profileModel.sourceFeatureContractId,
    sourceFeatureSetSha256: profileModel.sourceFeatureSetSha256,
    publicCellCount: profileModel.publicCellCount,
    normalization: profileModel.normalization,
    profiles: profileModel.profiles
  };
  const profileModelSha256 = canonicalSha256(serializable);
  if (profileModel.profileModelSha256 !== profileModelSha256) {
    throw new MultiscaleSpatialFeatureError(
      "MULTISCALE_SPATIAL_FEATURE_PROFILE_HASH_MISMATCH",
      "空间特征原型模型哈希不匹配。"
    );
  }
  return {
    ...serializable,
    profileModelSha256,
    summary: profileModel.summary
  };
}

module.exports = {
  MULTISCALE_SPATIAL_FEATURE_CONTRACT,
  MULTISCALE_SPATIAL_FEATURE_FILES,
  MULTISCALE_SPATIAL_FEATURE_MINIMUM_PUBLIC_CELLS,
  MULTISCALE_SPATIAL_FEATURE_NAMES,
  MULTISCALE_SPATIAL_FEATURE_PROFILE_COUNT,
  MULTISCALE_SPATIAL_FEATURE_SCHEMA_VERSION,
  MultiscaleSpatialFeatureError,
  buildMultiscaleSpatialFeatureProfiles,
  multiscaleSpatialFeatureContractSha256,
  multiscaleSpatialFeatureGenerationImplementationSha256,
  multiscaleSpatialFeatureVector,
  serializableMultiscaleSpatialFeatureProfiles
};
