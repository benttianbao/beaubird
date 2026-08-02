"use strict";

const { createHash } = require("node:crypto");

const {
  CONTINUOUS_HABITAT_KERNEL_CONTRACT,
  hellingerDistance,
  kernelWeight
} = require("./continuous-habitat");
const { TERRAIN_FEATURE_CONTRACT } = require("./terrain-features");
const { canonicalJson } = require("./spatial-splits");

const TERRAIN_SPATIAL_EVIDENCE_CONTRACT = Object.freeze({
  id: "zhejiang_worldcover_terrain_neighbor_kernel_v11",
  role: "single_preregistered_terrain_challenger",
  controlKernelId: CONTINUOUS_HABITAT_KERNEL_CONTRACT.id,
  habitatFeatureContractId:
    CONTINUOUS_HABITAT_KERNEL_CONTRACT.featureContractId,
  terrainFeatureContractId: TERRAIN_FEATURE_CONTRACT.id,
  targetIndependent: true,
  labelIndependent: true,
  neighborSelection:
    CONTINUOUS_HABITAT_KERNEL_CONTRACT.neighborSelection,
  neighborCount: CONTINUOUS_HABITAT_KERNEL_CONTRACT.neighborCount,
  minimumSameCityNeighbors:
    CONTINUOUS_HABITAT_KERNEL_CONTRACT.minimumSameCityNeighbors,
  excludeTargetCell: true,
  habitatEligibility: Object.freeze({
    distance: "hellinger",
    maximumDistance:
      CONTINUOUS_HABITAT_KERNEL_CONTRACT.maximumDistance
  }),
  weight: Object.freeze({
    habitatKernel: Object.freeze({
      distance: "hellinger",
      bandwidth:
        CONTINUOUS_HABITAT_KERNEL_CONTRACT.kernelBandwidth
    }),
    terrainKernel: Object.freeze({
      distance:
        "root_mean_square_euclidean_on_three_frozen_standardized_terrain_features",
      bandwidth: 1
    }),
    combination: "habitat_kernel_weight_times_terrain_kernel_weight",
    ranking:
      "ascending_negative_two_log_combined_weight_then_lexicographic_unit_id"
  }),
  evidenceExposureCap:
    CONTINUOUS_HABITAT_KERNEL_CONTRACT.evidenceExposureCap,
  evidencePriorStrength:
    CONTINUOUS_HABITAT_KERNEL_CONTRACT.evidencePriorStrength,
  applyAsIntermediateEvidence: true,
  parameterPolicy:
    "no_label_based_bins_thresholds_bandwidths_or_feature_search",
  cachePolicy:
    "only_control_and_candidate_aggregated_sufficient_statistics_without_features_coordinates_or_spatial_ids"
});

class TerrainSpatialEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "TerrainSpatialEvidenceError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function terrainSpatialEvidenceContractSha256() {
  return createHash("sha256")
    .update(canonicalJson(TERRAIN_SPATIAL_EVIDENCE_CONTRACT))
    .digest("hex");
}

function normalizeTerrainVector(value, path) {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new TerrainSpatialEvidenceError(
      "TERRAIN_SPATIAL_VECTOR_INVALID",
      `${path} 必须包含三个冻结标准化地形特征。`
    );
  }
  return value.map((entry, index) => {
    const number = Number(entry);
    if (!Number.isFinite(number)) {
      throw new TerrainSpatialEvidenceError(
        "TERRAIN_SPATIAL_VECTOR_INVALID",
        `${path}[${index}] 必须是有限数。`
      );
    }
    return number;
  });
}

function terrainRmsDistance(left, right) {
  const normalizedLeft = normalizeTerrainVector(left, "leftTerrainVector");
  const normalizedRight = normalizeTerrainVector(
    right,
    "rightTerrainVector"
  );
  const meanSquared =
    normalizedLeft.reduce((sum, value, index) => {
      const difference = value - normalizedRight[index];
      return sum + difference * difference;
    }, 0) / normalizedLeft.length;
  return Math.sqrt(meanSquared);
}

function terrainKernelWeight(distance) {
  const numeric = Number(distance);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new TerrainSpatialEvidenceError(
      "TERRAIN_SPATIAL_DISTANCE_INVALID",
      "地形距离必须是非负有限数。"
    );
  }
  return Math.exp(-0.5 * numeric * numeric);
}

function normalizeCandidate(candidate, index) {
  const unitId = String(candidate?.unitId || "");
  if (!unitId) {
    throw new TerrainSpatialEvidenceError(
      "TERRAIN_SPATIAL_CANDIDATE_INVALID",
      "地形邻居候选缺少 unitId。",
      { index }
    );
  }
  return {
    unitId,
    cityName: String(candidate.cityName || ""),
    habitatVector: candidate.habitatVector,
    terrainVector: normalizeTerrainVector(
      candidate.terrainVector,
      `candidates[${index}].terrainVector`
    )
  };
}

function selectTerrainAugmentedNeighbors({
  targetUnitId,
  targetCityName,
  targetHabitatVector,
  targetTerrainVector,
  candidates,
  contract = TERRAIN_SPATIAL_EVIDENCE_CONTRACT
}) {
  if (
    canonicalJson(contract) !==
    canonicalJson(TERRAIN_SPATIAL_EVIDENCE_CONTRACT)
  ) {
    throw new TerrainSpatialEvidenceError(
      "TERRAIN_SPATIAL_CONTRACT_MISMATCH",
      "地形邻居选择只允许预登记的冻结 v11 契约。"
    );
  }
  const targetId = String(targetUnitId || "");
  const targetCity = String(targetCityName || "");
  const normalizedTargetTerrain = normalizeTerrainVector(
    targetTerrainVector,
    "targetTerrainVector"
  );
  const eligible = (candidates || [])
    .map(normalizeCandidate)
    .filter((candidate) => candidate.unitId !== targetId)
    .map((candidate) => {
      const habitatDistance = hellingerDistance(
        targetHabitatVector,
        candidate.habitatVector
      );
      const terrainDistance = terrainRmsDistance(
        normalizedTargetTerrain,
        candidate.terrainVector
      );
      const habitatWeight = kernelWeight(
        habitatDistance,
        contract.weight.habitatKernel.bandwidth
      );
      const terrainWeight = terrainKernelWeight(terrainDistance);
      const weight = habitatWeight * terrainWeight;
      return {
        unitId: candidate.unitId,
        cityName: candidate.cityName,
        habitatDistance,
        terrainDistance,
        jointDistance: Math.sqrt(
          -2 * Math.log(Math.max(Number.MIN_VALUE, weight))
        ),
        weight
      };
    })
    .filter(
      (candidate) =>
        candidate.habitatDistance <=
        contract.habitatEligibility.maximumDistance
    )
    .sort(
      (left, right) =>
        left.jointDistance - right.jointDistance ||
        left.unitId.localeCompare(right.unitId)
    );
  const sameCity = targetCity
    ? eligible.filter((candidate) => candidate.cityName === targetCity)
    : [];
  const pool =
    sameCity.length >= contract.minimumSameCityNeighbors
      ? sameCity
      : eligible;
  const neighbors = pool.slice(0, contract.neighborCount);
  return {
    scope:
      sameCity.length >= contract.minimumSameCityNeighbors
        ? "same_city"
        : "zhejiang_fallback",
    eligibleCandidateCount: pool.length,
    sameCityCandidateCount: sameCity.length,
    neighbors,
    nearestJointDistance: neighbors[0]?.jointDistance ?? null,
    farthestJointDistance: neighbors.at(-1)?.jointDistance ?? null,
    effectiveNeighborCount: neighbors.reduce(
      (sum, neighbor) => sum + neighbor.weight,
      0
    )
  };
}

module.exports = {
  TERRAIN_SPATIAL_EVIDENCE_CONTRACT,
  TerrainSpatialEvidenceError,
  selectTerrainAugmentedNeighbors,
  terrainKernelWeight,
  terrainRmsDistance,
  terrainSpatialEvidenceContractSha256
};
