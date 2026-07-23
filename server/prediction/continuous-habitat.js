"use strict";

const { canonicalJson } = require("./spatial-splits");

const CONTINUOUS_HABITAT_GROUPS = Object.freeze([
  "forest",
  "open",
  "cropland",
  "urban",
  "water_wetland"
]);

const CONTINUOUS_HABITAT_KERNEL_CONTRACT = Object.freeze({
  id: "zhejiang_worldcover_hellinger_kernel_v1",
  featureContractId: "zhejiang_esa_worldcover_h3_r6_continuous_v2",
  featureGroups: CONTINUOUS_HABITAT_GROUPS,
  featureProjection: Object.freeze({
    forest: Object.freeze([10]),
    open: Object.freeze([20, 30, 60, 70, 100]),
    cropland: Object.freeze([40]),
    urban: Object.freeze([50]),
    water_wetland: Object.freeze([80, 90, 95])
  }),
  distance: "hellinger",
  neighborSelection: "same_city_first_then_zhejiang_fallback",
  neighborCount: 24,
  minimumSameCityNeighbors: 8,
  maximumDistance: 0.35,
  kernelBandwidth: 0.18,
  evidenceExposureCap: 10,
  evidencePriorStrength: 30,
  excludeTargetCell: true,
  applyAsIntermediateEvidence: true,
  cachePolicy:
    "only_aggregated_exposure_detection_strength_and_neighbor_count_without_features_or_spatial_ids"
});

class ContinuousHabitatError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "ContinuousHabitatError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function finiteFraction(value, path) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw new ContinuousHabitatError(
      "CONTINUOUS_HABITAT_FRACTION_INVALID",
      `${path} 必须是 0..1 的有限数。`,
      { path, value }
    );
  }
  return number;
}

function continuousHabitatVector(classFractions) {
  if (!classFractions || typeof classFractions !== "object" || Array.isArray(classFractions)) {
    throw new ContinuousHabitatError(
      "CONTINUOUS_HABITAT_FRACTIONS_INVALID",
      "WorldCover 分类占比必须是对象。"
    );
  }
  const projection = CONTINUOUS_HABITAT_KERNEL_CONTRACT.featureProjection;
  const vector = CONTINUOUS_HABITAT_GROUPS.map((group) =>
    projection[group].reduce(
      (sum, code) =>
        sum + finiteFraction(classFractions[String(code)] ?? classFractions[code] ?? 0, `${group}.${code}`),
      0
    )
  );
  const total = vector.reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 1) > 1e-6) {
    throw new ContinuousHabitatError(
      "CONTINUOUS_HABITAT_FRACTIONS_NOT_CONSERVED",
      "连续生境五维投影必须守恒为 1。",
      { total }
    );
  }
  return Object.freeze(vector);
}

function normalizeVector(value, path = "vector") {
  if (!Array.isArray(value) || value.length !== CONTINUOUS_HABITAT_GROUPS.length) {
    throw new ContinuousHabitatError(
      "CONTINUOUS_HABITAT_VECTOR_INVALID",
      `${path} 必须包含 ${CONTINUOUS_HABITAT_GROUPS.length} 个占比。`
    );
  }
  const vector = value.map((entry, index) => finiteFraction(entry, `${path}[${index}]`));
  const total = vector.reduce((sum, entry) => sum + entry, 0);
  if (Math.abs(total - 1) > 1e-6) {
    throw new ContinuousHabitatError(
      "CONTINUOUS_HABITAT_VECTOR_NOT_CONSERVED",
      `${path} 必须守恒为 1。`,
      { total }
    );
  }
  return vector;
}

function hellingerDistance(left, right) {
  const normalizedLeft = normalizeVector(left, "left");
  const normalizedRight = normalizeVector(right, "right");
  const squared = normalizedLeft.reduce(
    (sum, value, index) =>
      sum + (Math.sqrt(value) - Math.sqrt(normalizedRight[index])) ** 2,
    0
  );
  return Math.sqrt(Math.max(0, squared)) / Math.sqrt(2);
}

function kernelWeight(distance, bandwidth = CONTINUOUS_HABITAT_KERNEL_CONTRACT.kernelBandwidth) {
  const numericDistance = Number(distance);
  const numericBandwidth = Number(bandwidth);
  if (
    !Number.isFinite(numericDistance) ||
    numericDistance < 0 ||
    !Number.isFinite(numericBandwidth) ||
    numericBandwidth <= 0
  ) {
    throw new ContinuousHabitatError(
      "CONTINUOUS_HABITAT_KERNEL_ARGUMENT_INVALID",
      "生境距离和核带宽必须是有效正数。",
      { distance, bandwidth }
    );
  }
  return Math.exp(-0.5 * (numericDistance / numericBandwidth) ** 2);
}

function normalizeCandidate(candidate, index) {
  const unitId = String(candidate?.unitId || "");
  if (!unitId) {
    throw new ContinuousHabitatError(
      "CONTINUOUS_HABITAT_CANDIDATE_INVALID",
      "候选训练网格缺少 unitId。",
      { index }
    );
  }
  return {
    unitId,
    cityName: String(candidate.cityName || ""),
    vector: normalizeVector(candidate.vector, `candidates[${index}].vector`)
  };
}

function selectContinuousHabitatNeighbors({
  targetUnitId,
  targetCityName,
  targetVector,
  candidates,
  contract = CONTINUOUS_HABITAT_KERNEL_CONTRACT
}) {
  const normalizedTarget = normalizeVector(targetVector, "targetVector");
  const targetId = String(targetUnitId || "");
  const targetCity = String(targetCityName || "");
  const normalizedCandidates = (candidates || [])
    .map(normalizeCandidate)
    .filter((candidate) => !contract.excludeTargetCell || candidate.unitId !== targetId)
    .map((candidate) => {
      const distance = hellingerDistance(normalizedTarget, candidate.vector);
      return {
        unitId: candidate.unitId,
        cityName: candidate.cityName,
        distance,
        weight: kernelWeight(distance, contract.kernelBandwidth)
      };
    })
    .filter((candidate) => candidate.distance <= Number(contract.maximumDistance))
    .sort(
      (left, right) =>
        left.distance - right.distance ||
        left.unitId.localeCompare(right.unitId)
    );
  const sameCity = targetCity
    ? normalizedCandidates.filter((candidate) => candidate.cityName === targetCity)
    : [];
  const pool = sameCity.length >= Number(contract.minimumSameCityNeighbors)
    ? sameCity
    : normalizedCandidates;
  const neighbors = pool.slice(0, Number(contract.neighborCount));
  return {
    scope:
      sameCity.length >= Number(contract.minimumSameCityNeighbors)
        ? "same_city"
        : "zhejiang_fallback",
    eligibleCandidateCount: pool.length,
    sameCityCandidateCount: sameCity.length,
    neighbors,
    nearestDistance: neighbors[0]?.distance ?? null,
    farthestDistance: neighbors.at(-1)?.distance ?? null,
    effectiveNeighborCount: neighbors.reduce((sum, neighbor) => sum + neighbor.weight, 0)
  };
}

function continuousHabitatContractProjection() {
  return JSON.parse(canonicalJson(CONTINUOUS_HABITAT_KERNEL_CONTRACT));
}

module.exports = {
  CONTINUOUS_HABITAT_GROUPS,
  CONTINUOUS_HABITAT_KERNEL_CONTRACT,
  ContinuousHabitatError,
  continuousHabitatContractProjection,
  continuousHabitatVector,
  hellingerDistance,
  kernelWeight,
  selectContinuousHabitatNeighbors
};
