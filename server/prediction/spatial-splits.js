"use strict";

const { createHash } = require("node:crypto");

const { neighboringGridCellIds, parseGridId } = require("./geo");

const SPATIAL_SPLIT_ALGORITHM_VERSION = "zhejiang-spatial-split-v1";
const DEFAULT_RELEASE_FOLD_COUNT = 5;
const DEFAULT_MINIMUM_CHECKLISTS = 30;
const DEFAULT_MINIMUM_OBSERVERS = 10;
const DEFAULT_MAXIMUM_SEARCH_STATES = 500_000;
const SUPPORT_QUANTILE_TARGETS = Object.freeze([0.25, 0.5, 0.75]);
const ZHEJIANG_PREFECTURE_CITIES = Object.freeze([
  "杭州市",
  "宁波市",
  "温州市",
  "嘉兴市",
  "湖州市",
  "绍兴市",
  "金华市",
  "衢州市",
  "舟山市",
  "台州市",
  "丽水市"
]);

class SpatialSplitError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "SpatialSplitError";
    this.code = code;
    this.details = details;
  }
}

function lexicalCompare(left, right) {
  const a = String(left);
  const b = String(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

function sha256(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort(lexicalCompare)
      .map((key) => [key, canonicalize(value[key])])
  );
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function finiteNumber(value, field, unitId) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new SpatialSplitError("INVALID_CANDIDATE", `候选网格 ${unitId || "<unknown>"} 的 ${field} 不是有限数值。`, {
      unitId: unitId || null,
      field,
      value
    });
  }
  return number;
}

function normalizeViewedAnchorId(value) {
  const unitId = typeof value === "string" ? value : value?.unitId ?? value?.unit_id;
  return String(unitId || "").trim();
}

function normalizeCandidate(row, thresholds) {
  const unitId = String(row?.unitId ?? row?.unit_id ?? "").trim();
  const parsed = parseGridId(unitId);
  if (!parsed || parsed.level !== "grid_r6") {
    throw new SpatialSplitError("INVALID_CANDIDATE", `空间切分只接受 H3 r6 候选：${unitId || "<empty>"}`, {
      unitId: unitId || null,
      field: "unitId"
    });
  }
  const city = String(row?.city ?? row?.cityName ?? row?.city_name ?? "").trim();
  if (!city) {
    throw new SpatialSplitError("INVALID_CANDIDATE", `候选网格 ${unitId} 缺少地市。`, {
      unitId,
      field: "city"
    });
  }
  const checklists = finiteNumber(row?.checklists ?? row?.checklistCount ?? row?.checklist_count, "checklists", unitId);
  const observers = finiteNumber(row?.observers ?? row?.observerCount ?? row?.observer_count, "observers", unitId);
  if (checklists < thresholds.minimumChecklists || observers < thresholds.minimumObservers) {
    throw new SpatialSplitError("INELIGIBLE_CANDIDATE", `候选网格 ${unitId} 未达到空间切分支持门槛。`, {
      unitId,
      checklists,
      observers,
      minimumChecklists: thresholds.minimumChecklists,
      minimumObservers: thresholds.minimumObservers
    });
  }
  const centroidSource = row?.centroid || {};
  const longitude = finiteNumber(
    centroidSource.longitude ?? row?.centroidLongitude ?? row?.centroid_longitude ?? row?.longitude,
    "centroid.longitude",
    unitId
  );
  const latitude = finiteNumber(
    centroidSource.latitude ?? row?.centroidLatitude ?? row?.centroid_latitude ?? row?.latitude,
    "centroid.latitude",
    unitId
  );
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new SpatialSplitError("INVALID_CANDIDATE", `候选网格 ${unitId} 的中心坐标超出范围。`, {
      unitId,
      longitude,
      latitude
    });
  }
  const bufferCellIds = neighboringGridCellIds(unitId).sort(lexicalCompare);
  if (!bufferCellIds.includes(unitId)) {
    throw new SpatialSplitError("INVALID_CANDIDATE", `候选网格 ${unitId} 无法生成 H3 一环缓冲。`, {
      unitId
    });
  }
  return {
    unitId,
    city,
    checklists,
    observers,
    centroid: { longitude, latitude },
    bufferCellIds,
    supportQuantile: null
  };
}

function supportBand(quantile) {
  if (quantile <= 1 / 3) return "low";
  if (quantile <= 2 / 3) return "medium";
  return "high";
}

function assignSupportQuantiles(candidatesByCity) {
  for (const candidates of candidatesByCity.values()) {
    const ranked = [...candidates].sort(
      (left, right) =>
        left.checklists - right.checklists ||
        left.observers - right.observers ||
        lexicalCompare(left.unitId, right.unitId)
    );
    for (let index = 0; index < ranked.length; index += 1) {
      ranked[index].supportQuantile = ranked.length === 1 ? 0.5 : index / (ranked.length - 1);
    }
  }
}

function buffersIntersect(bufferCellIds, occupiedCells) {
  return bufferCellIds.some((cellId) => occupiedCells.has(cellId));
}

function occupy(occupiedCells, candidate) {
  const next = new Set(occupiedCells);
  for (const cellId of candidate.bufferCellIds) next.add(cellId);
  return next;
}

function targetMaps(cities, seed) {
  const targetOrder = [...cities].sort(
    (left, right) =>
      lexicalCompare(sha256(`${seed}\u0000city-target\u0000${left}`), sha256(`${seed}\u0000city-target\u0000${right}`)) ||
      lexicalCompare(left, right)
  );
  const sealed = new Map();
  const development = new Map();
  targetOrder.forEach((city, index) => {
    const targetIndex = index % SUPPORT_QUANTILE_TARGETS.length;
    sealed.set(city, SUPPORT_QUANTILE_TARGETS[targetIndex]);
    development.set(city, SUPPORT_QUANTILE_TARGETS[(targetIndex + 1) % SUPPORT_QUANTILE_TARGETS.length]);
  });
  return { targetOrder, sealed, development };
}

function rankCandidates(candidates, target, seed, panel, city) {
  return [...candidates].sort((left, right) => {
    const distance = Math.abs(left.supportQuantile - target) - Math.abs(right.supportQuantile - target);
    if (distance) return distance;
    return (
      lexicalCompare(
        sha256(`${seed}\u0000${panel}\u0000${city}\u0000${left.unitId}`),
        sha256(`${seed}\u0000${panel}\u0000${city}\u0000${right.unitId}`)
      ) || lexicalCompare(left.unitId, right.unitId)
    );
  });
}

function findPanels({
  candidatesByCity,
  cities,
  viewedCandidates,
  targets,
  seed,
  maximumSearchStates
}) {
  let searchStates = 0;
  const incrementSearchState = () => {
    searchStates += 1;
    if (searchStates > maximumSearchStates) {
      throw new SpatialSplitError("SEARCH_LIMIT_EXCEEDED", "空间切分搜索超过确定性状态上限。", {
        maximumSearchStates
      });
    }
  };

  let initialOccupied = new Set();
  for (const candidate of viewedCandidates) {
    if (buffersIntersect(candidate.bufferCellIds, initialOccupied)) {
      throw new SpatialSplitError("VIEWED_BUFFER_OVERLAP", "既有已查看锚点的一环缓冲相互重叠。", {
        unitId: candidate.unitId
      });
    }
    initialOccupied = occupy(initialOccupied, candidate);
  }
  const development = [...viewedCandidates];
  const coveredDevelopmentCities = new Set(development.map((candidate) => candidate.city));
  const missingDevelopmentCities = cities
    .filter((city) => !coveredDevelopmentCities.has(city))
    .sort(
      (left, right) =>
        candidatesByCity.get(left).length - candidatesByCity.get(right).length ||
        lexicalCompare(sha256(`${seed}\u0000development-order\u0000${left}`), sha256(`${seed}\u0000development-order\u0000${right}`))
    );

  function searchSealed(remainingCities, selected, occupiedCells) {
    incrementSearchState();
    if (!remainingCities.length) return selected;
    const choices = remainingCities.map((city) => ({
      city,
      candidates: rankCandidates(
        candidatesByCity.get(city).filter((candidate) => !buffersIntersect(candidate.bufferCellIds, occupiedCells)),
        targets.sealed.get(city),
        seed,
        "sealed-release",
        city
      )
    }));
    choices.sort(
      (left, right) =>
        left.candidates.length - right.candidates.length ||
        lexicalCompare(sha256(`${seed}\u0000sealed-order\u0000${left.city}`), sha256(`${seed}\u0000sealed-order\u0000${right.city}`))
    );
    const choice = choices[0];
    if (!choice.candidates.length) return null;
    const nextRemaining = remainingCities.filter((city) => city !== choice.city);
    for (const candidate of choice.candidates) {
      const result = searchSealed(nextRemaining, [...selected, candidate], occupy(occupiedCells, candidate));
      if (result) return result;
    }
    return null;
  }

  function searchDevelopment(index, selected, occupiedCells) {
    incrementSearchState();
    if (index >= missingDevelopmentCities.length) {
      const sealed = searchSealed(cities, [], occupiedCells);
      return sealed ? { development: selected, sealed, searchStates } : null;
    }
    const city = missingDevelopmentCities[index];
    const candidates = rankCandidates(
      candidatesByCity.get(city).filter((candidate) => !buffersIntersect(candidate.bufferCellIds, occupiedCells)),
      targets.development.get(city),
      seed,
      "development",
      city
    );
    for (const candidate of candidates) {
      const nextOccupied = occupy(occupiedCells, candidate);
      const hasPotentialSealedPeer = candidatesByCity
        .get(city)
        .some((peer) => peer.unitId !== candidate.unitId && !buffersIntersect(peer.bufferCellIds, nextOccupied));
      if (!hasPotentialSealedPeer) continue;
      const result = searchDevelopment(index + 1, [...selected, candidate], nextOccupied);
      if (result) return result;
    }
    return null;
  }

  const result = searchDevelopment(0, development, initialOccupied);
  if (!result) {
    throw new SpatialSplitError("NO_FEASIBLE_SPLIT", "无法在当前候选和缓冲约束下生成开发与封存空间面板。", {
      cities,
      viewedAnchorIds: viewedCandidates.map((candidate) => candidate.unitId),
      searchStates
    });
  }
  return result;
}

function anchorRecord(candidate, panel, target, seed, viewedAnchorIds) {
  const viewed = viewedAnchorIds.has(candidate.unitId);
  return {
    unitId: candidate.unitId,
    city: candidate.city,
    checklists: candidate.checklists,
    observers: candidate.observers,
    centroid: candidate.centroid,
    supportQuantile: Number(candidate.supportQuantile.toFixed(6)),
    supportBand: supportBand(candidate.supportQuantile),
    targetSupportQuantile: target,
    selectionReason: viewed ? "previously_viewed_development_anchor" : "target_independent_stratified_selection",
    selectionHash: sha256(`${seed}\u0000${panel}\u0000${candidate.city}\u0000${candidate.unitId}`),
    bufferRing: 1,
    bufferCellIds: [...candidate.bufferCellIds]
  };
}

function assignBalancedFolds(anchors, foldCount, seed, panel) {
  if (!Number.isInteger(foldCount) || foldCount < 2 || foldCount > anchors.length) {
    throw new SpatialSplitError("INVALID_FOLD_COUNT", "空间折数必须至少为 2 且不超过锚点数。", {
      foldCount,
      anchorCount: anchors.length
    });
  }
  const folds = Array.from({ length: foldCount }, (_, index) => ({
    foldId: index + 1,
    anchors: [],
    checklistCount: 0,
    observerCount: 0
  }));
  const ordered = [...anchors].sort(
    (left, right) =>
      right.checklists - left.checklists ||
      right.observers - left.observers ||
      lexicalCompare(
        sha256(`${seed}\u0000${panel}\u0000fold-anchor\u0000${left.unitId}`),
        sha256(`${seed}\u0000${panel}\u0000fold-anchor\u0000${right.unitId}`)
      )
  );
  for (const anchor of ordered) {
    const minimumSize = Math.min(...folds.map((fold) => fold.anchors.length));
    const fold = folds
      .filter((candidate) => candidate.anchors.length === minimumSize)
      .sort(
        (left, right) =>
          left.checklistCount - right.checklistCount ||
          left.observerCount - right.observerCount ||
          lexicalCompare(
            sha256(`${seed}\u0000${panel}\u0000fold\u0000${left.foldId}\u0000${anchor.unitId}`),
            sha256(`${seed}\u0000${panel}\u0000fold\u0000${right.foldId}\u0000${anchor.unitId}`)
          )
      )[0];
    fold.anchors.push(anchor);
    fold.checklistCount += anchor.checklists;
    fold.observerCount += anchor.observers;
  }
  const foldByUnit = new Map();
  for (const fold of folds) {
    for (const anchor of fold.anchors) foldByUnit.set(anchor.unitId, fold.foldId);
  }
  const assignedAnchors = anchors
    .map((anchor) => ({ ...anchor, foldId: foldByUnit.get(anchor.unitId) }))
    .sort((left, right) => lexicalCompare(left.city, right.city) || lexicalCompare(left.unitId, right.unitId));
  const summarizedFolds = folds.map((fold) => ({
    foldId: fold.foldId,
    anchorCount: fold.anchors.length,
    checklistCount: fold.checklistCount,
    observerCount: fold.observerCount,
    cities: [...new Set(fold.anchors.map((anchor) => anchor.city))].sort(lexicalCompare),
    anchorIds: fold.anchors.map((anchor) => anchor.unitId).sort(lexicalCompare)
  }));
  const checklistTotals = summarizedFolds.map((fold) => fold.checklistCount);
  return {
    anchors: assignedAnchors,
    folds: summarizedFolds,
    balance: {
      minimumAnchorsPerFold: Math.min(...summarizedFolds.map((fold) => fold.anchorCount)),
      maximumAnchorsPerFold: Math.max(...summarizedFolds.map((fold) => fold.anchorCount)),
      minimumChecklistsPerFold: Math.min(...checklistTotals),
      maximumChecklistsPerFold: Math.max(...checklistTotals),
      checklistMaximumToMinimumRatio:
        Math.min(...checklistTotals) > 0 ? Math.max(...checklistTotals) / Math.min(...checklistTotals) : null
    }
  };
}

function panelSummary(anchors, folds, balance, expectedCities) {
  const cityCoverage = [...new Set(anchors.map((anchor) => anchor.city))].sort(lexicalCompare);
  return {
    anchorCount: anchors.length,
    cityCount: cityCoverage.length,
    cityCoverage,
    coversExpectedCities: expectedCities.every((city) => cityCoverage.includes(city)),
    anchors,
    folds,
    balance
  };
}

function unionBufferCells(anchors) {
  const cells = new Set();
  for (const anchor of anchors) {
    for (const cellId of anchor.bufferCellIds) cells.add(cellId);
  }
  return cells;
}

function generateSpatialSplitManifest(input = {}) {
  const snapshotSha256 = String(input.snapshotSha256 || "").trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(snapshotSha256)) {
    throw new SpatialSplitError("INVALID_SNAPSHOT_SHA256", "snapshotSha256 必须是 64 位十六进制 SHA-256。", {
      snapshotSha256
    });
  }
  const expectedCities = [...new Set(input.expectedCities || ZHEJIANG_PREFECTURE_CITIES)].map((city) =>
    String(city || "").trim()
  );
  if (expectedCities.length !== 11 || expectedCities.some((city) => !city)) {
    throw new SpatialSplitError("INVALID_EXPECTED_CITIES", "空间切分必须明确覆盖 11 个非空地市。", {
      expectedCities
    });
  }
  const releaseFoldCount = Number(input.releaseFoldCount ?? DEFAULT_RELEASE_FOLD_COUNT);
  const developmentFoldCount = Number(input.developmentFoldCount ?? releaseFoldCount);
  const minimumChecklists = Number(input.minimumChecklists ?? DEFAULT_MINIMUM_CHECKLISTS);
  const minimumObservers = Number(input.minimumObservers ?? DEFAULT_MINIMUM_OBSERVERS);
  const maximumSearchStates = Number(input.maximumSearchStates ?? DEFAULT_MAXIMUM_SEARCH_STATES);
  const thresholds = { minimumChecklists, minimumObservers };
  if (!Array.isArray(input.candidates) || !input.candidates.length) {
    throw new SpatialSplitError("NO_CANDIDATES", "空间切分缺少候选 H3 r6。", {});
  }
  const candidates = input.candidates.map((row) => normalizeCandidate(row, thresholds));
  const candidatesById = new Map();
  for (const candidate of candidates) {
    if (candidatesById.has(candidate.unitId)) {
      throw new SpatialSplitError("DUPLICATE_CANDIDATE", `候选 H3 r6 重复：${candidate.unitId}`, {
        unitId: candidate.unitId
      });
    }
    if (!expectedCities.includes(candidate.city)) {
      throw new SpatialSplitError("UNEXPECTED_CITY", `候选网格 ${candidate.unitId} 属于未声明地市：${candidate.city}`, {
        unitId: candidate.unitId,
        city: candidate.city
      });
    }
    candidatesById.set(candidate.unitId, candidate);
  }
  const candidatesByCity = new Map(expectedCities.map((city) => [city, []]));
  for (const candidate of candidates) candidatesByCity.get(candidate.city).push(candidate);
  const missingCities = expectedCities.filter((city) => candidatesByCity.get(city).length < 2);
  if (missingCities.length) {
    throw new SpatialSplitError("INSUFFICIENT_CITY_CANDIDATES", "至少一个地市没有两个可隔离候选网格。", {
      missingCities,
      candidateCounts: Object.fromEntries(expectedCities.map((city) => [city, candidatesByCity.get(city).length]))
    });
  }
  assignSupportQuantiles(candidatesByCity);

  const viewedAnchorIds = [...new Set((input.viewedAnchors || input.viewedAnchorIds || []).map(normalizeViewedAnchorId))]
    .filter(Boolean)
    .sort(lexicalCompare);
  const unknownViewedAnchorIds = viewedAnchorIds.filter((unitId) => !candidatesById.has(unitId));
  if (unknownViewedAnchorIds.length) {
    throw new SpatialSplitError("UNKNOWN_VIEWED_ANCHOR", "既有已查看锚点不在候选池中。", {
      unknownViewedAnchorIds
    });
  }
  const viewedCandidates = viewedAnchorIds.map((unitId) => candidatesById.get(unitId));
  const seed = sha256(`${SPATIAL_SPLIT_ALGORITHM_VERSION}\u0000${snapshotSha256}`);
  const targets = targetMaps(expectedCities, seed);
  const panels = findPanels({
    candidatesByCity,
    cities: expectedCities,
    viewedCandidates,
    targets,
    seed,
    maximumSearchStates
  });
  const viewedIdSet = new Set(viewedAnchorIds);
  const developmentAnchors = panels.development.map((candidate) =>
    anchorRecord(candidate, "development", targets.development.get(candidate.city), seed, viewedIdSet)
  );
  const sealedAnchors = panels.sealed.map((candidate) =>
    anchorRecord(candidate, "sealed-release", targets.sealed.get(candidate.city), seed, viewedIdSet)
  );
  const developmentAssignment = assignBalancedFolds(developmentAnchors, developmentFoldCount, seed, "development");
  const sealedAssignment = assignBalancedFolds(sealedAnchors, releaseFoldCount, seed, "sealed-release");
  const developmentBuffers = unionBufferCells(developmentAssignment.anchors);
  const sealedBuffers = unionBufferCells(sealedAssignment.anchors);
  const overlapCellIds = [...developmentBuffers].filter((cellId) => sealedBuffers.has(cellId)).sort(lexicalCompare);
  if (overlapCellIds.length) {
    throw new SpatialSplitError("PANEL_BUFFER_OVERLAP", "开发与封存面板的一环缓冲发生重叠。", {
      overlapCellIds
    });
  }

  const normalizedCandidateRows = candidates
    .map((candidate) => ({
      unitId: candidate.unitId,
      city: candidate.city,
      checklists: candidate.checklists,
      observers: candidate.observers,
      centroid: candidate.centroid
    }))
    .sort((left, right) => lexicalCompare(left.unitId, right.unitId));
  const manifest = {
    schemaVersion: 1,
    algorithmVersion: SPATIAL_SPLIT_ALGORITHM_VERSION,
    seed,
    sourceSnapshotSha256: snapshotSha256,
    inputHash: sha256(
      canonicalJson({
        snapshotSha256,
        candidates: normalizedCandidateRows,
        viewedAnchorIds,
        expectedCities: [...expectedCities].sort(lexicalCompare)
      })
    ),
    constraints: {
      targetIndependent: true,
      taxonOutcomeFieldsRead: [],
      expectedCityCount: 11,
      minimumChecklists,
      minimumObservers,
      bufferRing: 1,
      allSelectedBuffersMutuallyDisjoint: true,
      releaseFoldCount,
      developmentFoldCount,
      maximumSearchStates
    },
    candidateSummary: {
      candidateCount: candidates.length,
      cityCount: expectedCities.length,
      candidateCountByCity: Object.fromEntries(
        [...expectedCities].sort(lexicalCompare).map((city) => [city, candidatesByCity.get(city).length])
      ),
      supportQuantileTargets: [...SUPPORT_QUANTILE_TARGETS],
      targetAssignmentCityOrder: targets.targetOrder
    },
    viewedAnchors: {
      anchorCount: viewedAnchorIds.length,
      anchorIds: viewedAnchorIds,
      policy: "pinned_to_development_and_excluded_with_one_ring_from_sealed_release"
    },
    development: panelSummary(
      developmentAssignment.anchors,
      developmentAssignment.folds,
      developmentAssignment.balance,
      expectedCities
    ),
    sealedRelease: panelSummary(
      sealedAssignment.anchors,
      sealedAssignment.folds,
      sealedAssignment.balance,
      expectedCities
    ),
    isolation: {
      developmentBufferCellCount: developmentBuffers.size,
      sealedReleaseBufferCellCount: sealedBuffers.size,
      overlapCellCount: overlapCellIds.length,
      overlapCellIds
    },
    search: {
      statesVisited: panels.searchStates,
      maximumStates: maximumSearchStates
    }
  };
  return { ...manifest, manifestHash: sha256(canonicalJson(manifest)) };
}

module.exports = {
  DEFAULT_RELEASE_FOLD_COUNT,
  SPATIAL_SPLIT_ALGORITHM_VERSION,
  SUPPORT_QUANTILE_TARGETS,
  SpatialSplitError,
  ZHEJIANG_PREFECTURE_CITIES,
  canonicalJson,
  generateSpatialSplitManifest
};

