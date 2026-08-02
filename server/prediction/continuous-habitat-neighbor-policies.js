"use strict";

const { createHash } = require("node:crypto");

const {
  CONTINUOUS_HABITAT_KERNEL_CONTRACT,
  ContinuousHabitatError,
  hellingerDistance,
  kernelWeight,
  selectContinuousHabitatNeighbors
} = require("./continuous-habitat");
const { canonicalJson } = require("./spatial-splits");
const {
  V9_NEIGHBOR_POLICY_CANDIDATES
} = require("./continuous-habitat-prebuild");

const NEIGHBOR_POLICY_DIAGNOSTIC_SCHEMA_VERSION = 1;
const NEIGHBOR_POLICY_DIAGNOSTIC_CONTRACT = Object.freeze({
  id: "zhejiang_continuous_habitat_neighbor_policy_diagnostic_v1",
  structuralCandidatePlanId:
    "zhejiang_continuous_habitat_v9_structural_candidates_v1",
  featureContractId: "zhejiang_esa_worldcover_h3_r6_continuous_v2",
  featureProjection: "worldcover_five_group_r6_v2",
  distance: "hellinger",
  maximumDistance: 0.35,
  kernelBandwidth: 0.18,
  evidenceExposureCap: 10,
  evidencePriorStrength: 30,
  excludeTargetCell: true,
  policies: Object.freeze([
    Object.freeze({
      id: "same_city_exclusive_v1",
      role: "control",
      channels: Object.freeze([
        Object.freeze({
          id: "habitat",
          applicationOrder: 0,
          selection:
            "same_city_when_at_least_8_otherwise_all_zhejiang",
          maximumNeighbors: 24,
          evidenceExposureCap: 10,
          evidencePriorStrength: 30
        })
      ])
    }),
    Object.freeze({
      id: "same_city_min8_fill_zhejiang_v1",
      role: "challenger",
      channels: Object.freeze([
        Object.freeze({
          id: "habitat",
          applicationOrder: 0,
          selection:
            "up_to_8_nearest_same_city_then_nearest_out_of_city_then_any_remaining_zhejiang",
          maximumNeighbors: 24,
          reservedSameCityNeighbors: 8,
          evidenceExposureCap: 10,
          evidencePriorStrength: 30
        })
      ])
    }),
    Object.freeze({
      id: "dual_channel_same_city_zhejiang_v1",
      role: "challenger",
      channels: Object.freeze([
        Object.freeze({
          id: "zhejiang_out_of_city",
          applicationOrder: 0,
          selection: "nearest_out_of_city",
          maximumNeighbors: 24,
          evidenceExposureCap: 10,
          evidencePriorStrength: 30
        }),
        Object.freeze({
          id: "same_city",
          applicationOrder: 1,
          selection: "nearest_same_city",
          maximumNeighbors: 24,
          evidenceExposureCap: 10,
          evidencePriorStrength: 30
        })
      ])
    })
  ]),
  selectionPolicy: Object.freeze({
    selectionEvidence: "four_inner_oof_folds_for_each_outer_fold",
    validationEvidence: "one_untouched_outer_fold",
    requireEveryInnerFoldGuard: true,
    maximumRelativeBrierDegradation: 0.01,
    maximumEceDegradation: 0.01,
    objectiveOrder: Object.freeze([
      "minimum_worst_inner_fold_species_ece",
      "minimum_pooled_inner_species_ece",
      "minimum_pooled_inner_brier",
      "minimum_pooled_inner_ece",
      "policy_id"
    ]),
    currentPolicyId: "same_city_exclusive_v1"
  }),
  privacyPolicy:
    "cache_only_anonymous_fold_context_public_taxon_and_aggregated_channel_sufficient_statistics"
});

const NEIGHBOR_POLICY_IDS = Object.freeze(
  NEIGHBOR_POLICY_DIAGNOSTIC_CONTRACT.policies.map((policy) => policy.id)
);

function neighborPolicyDiagnosticContractProjection() {
  return JSON.parse(canonicalJson(NEIGHBOR_POLICY_DIAGNOSTIC_CONTRACT));
}

function neighborPolicyDiagnosticContractSha256() {
  return createHash("sha256")
    .update(canonicalJson(NEIGHBOR_POLICY_DIAGNOSTIC_CONTRACT))
    .digest("hex");
}

function assertStructuralCandidateAlignment() {
  const structuralIds = V9_NEIGHBOR_POLICY_CANDIDATES.map(
    (candidate) => candidate.id
  );
  if (canonicalJson(structuralIds) !== canonicalJson(NEIGHBOR_POLICY_IDS)) {
    throw new ContinuousHabitatError(
      "NEIGHBOR_POLICY_STRUCTURAL_CANDIDATE_MISMATCH",
      "可执行邻居策略与已冻结 v9 结构候选不一致。",
      { structuralIds, executableIds: NEIGHBOR_POLICY_IDS }
    );
  }
  return true;
}

function normalizedCandidate(candidate, index) {
  const unitId = String(candidate?.unitId || "");
  if (!unitId) {
    throw new ContinuousHabitatError(
      "CONTINUOUS_HABITAT_CANDIDATE_INVALID",
      "邻居候选缺少 unitId。",
      { index }
    );
  }
  return {
    unitId,
    cityName: String(candidate.cityName || ""),
    vector: candidate.vector
  };
}

function rankCandidates({
  targetUnitId,
  targetVector,
  candidates
}) {
  const targetId = String(targetUnitId || "");
  return (candidates || [])
    .map(normalizedCandidate)
    .filter((candidate) => candidate.unitId !== targetId)
    .map((candidate) => {
      const distance = hellingerDistance(targetVector, candidate.vector);
      return {
        unitId: candidate.unitId,
        cityName: candidate.cityName,
        distance,
        weight: kernelWeight(
          distance,
          NEIGHBOR_POLICY_DIAGNOSTIC_CONTRACT.kernelBandwidth
        )
      };
    })
    .filter(
      (candidate) =>
        candidate.distance <=
        NEIGHBOR_POLICY_DIAGNOSTIC_CONTRACT.maximumDistance
    )
    .sort(
      (left, right) =>
        left.distance - right.distance ||
        left.unitId.localeCompare(right.unitId)
    );
}

function channelSelection(channel, neighbors, scope) {
  return {
    channelId: channel.id,
    applicationOrder: channel.applicationOrder,
    evidenceExposureCap: channel.evidenceExposureCap,
    evidencePriorStrength: channel.evidencePriorStrength,
    scope,
    neighbors: neighbors.map(({ unitId, distance, weight }) => ({
      unitId,
      distance,
      weight
    }))
  };
}

function selectContinuousHabitatNeighborPolicies({
  targetUnitId,
  targetCityName,
  targetVector,
  candidates
}) {
  assertStructuralCandidateAlignment();
  const targetCity = String(targetCityName || "");
  const ranked = rankCandidates({
    targetUnitId,
    targetVector,
    candidates
  });
  const sameCity = targetCity
    ? ranked.filter((candidate) => candidate.cityName === targetCity)
    : [];
  const outOfCity = targetCity
    ? ranked.filter((candidate) => candidate.cityName !== targetCity)
    : ranked;
  const controlContract =
    NEIGHBOR_POLICY_DIAGNOSTIC_CONTRACT.policies[0].channels[0];
  const control = selectContinuousHabitatNeighbors({
    targetUnitId,
    targetCityName,
    targetVector,
    candidates,
    contract: CONTINUOUS_HABITAT_KERNEL_CONTRACT
  });
  const fillContract =
    NEIGHBOR_POLICY_DIAGNOSTIC_CONTRACT.policies[1].channels[0];
  const reservedSameCity = sameCity.slice(
    0,
    fillContract.reservedSameCityNeighbors
  );
  const reservedIds = new Set(
    reservedSameCity.map((neighbor) => neighbor.unitId)
  );
  const fillNeighbors = [
    ...reservedSameCity,
    ...outOfCity.filter((neighbor) => !reservedIds.has(neighbor.unitId)),
    ...ranked.filter((neighbor) => !reservedIds.has(neighbor.unitId))
  ].filter(
    (neighbor, index, values) =>
      values.findIndex((entry) => entry.unitId === neighbor.unitId) === index
  ).slice(0, fillContract.maximumNeighbors);
  const dualContract =
    NEIGHBOR_POLICY_DIAGNOSTIC_CONTRACT.policies[2].channels;
  return [
    {
      policyId: "same_city_exclusive_v1",
      role: "control",
      channels: [
        channelSelection(
          controlContract,
          control.neighbors,
          control.scope
        )
      ]
    },
    {
      policyId: "same_city_min8_fill_zhejiang_v1",
      role: "challenger",
      channels: [
        channelSelection(
          fillContract,
          fillNeighbors,
          "same_city_reserved_then_zhejiang_fill"
        )
      ]
    },
    {
      policyId: "dual_channel_same_city_zhejiang_v1",
      role: "challenger",
      channels: [
        channelSelection(
          dualContract[0],
          outOfCity.slice(0, dualContract[0].maximumNeighbors),
          "zhejiang_out_of_city"
        ),
        channelSelection(
          dualContract[1],
          sameCity.slice(0, dualContract[1].maximumNeighbors),
          "same_city"
        )
      ]
    }
  ];
}

function aggregateContinuousHabitatNeighborPolicyEvidence(
  policySelections,
  {
    exposureForNeighbor,
    detectionsForNeighbor
  }
) {
  if (
    typeof exposureForNeighbor !== "function" ||
    typeof detectionsForNeighbor !== "function"
  ) {
    throw new ContinuousHabitatError(
      "NEIGHBOR_POLICY_EVIDENCE_CALLBACK_INVALID",
      "邻居策略证据聚合需要 exposure 与 detections 回调。"
    );
  }
  return (policySelections || []).map((policy) => ({
    policyId: policy.policyId,
    channels: policy.channels.map((channel) => {
      let exposure = 0;
      let detections = 0;
      let weightSum = 0;
      for (const neighbor of channel.neighbors) {
        const neighborExposure = Math.max(
          0,
          Number(exposureForNeighbor(neighbor.unitId)) || 0
        );
        const neighborDetections = Math.min(
          neighborExposure,
          Math.max(
            0,
            Number(detectionsForNeighbor(neighbor.unitId)) || 0
          )
        );
        exposure += Number(neighbor.weight) * neighborExposure;
        detections += Number(neighbor.weight) * neighborDetections;
        weightSum += Number(neighbor.weight);
      }
      return {
        channelId: channel.channelId,
        applicationOrder: channel.applicationOrder,
        exposure,
        detections: Math.min(exposure, detections),
        neighborCount: channel.neighbors.length,
        weightSum,
        evidenceExposureCap: channel.evidenceExposureCap,
        evidencePriorStrength: channel.evidencePriorStrength
      };
    })
  }));
}

module.exports = {
  NEIGHBOR_POLICY_DIAGNOSTIC_CONTRACT,
  NEIGHBOR_POLICY_DIAGNOSTIC_SCHEMA_VERSION,
  NEIGHBOR_POLICY_IDS,
  aggregateContinuousHabitatNeighborPolicyEvidence,
  assertStructuralCandidateAlignment,
  neighborPolicyDiagnosticContractProjection,
  neighborPolicyDiagnosticContractSha256,
  selectContinuousHabitatNeighborPolicies
};
