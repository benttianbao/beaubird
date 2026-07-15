"use strict";

const { getResolution, gridDisk, isValidCell } = require("h3-js");
const { isoDateParts } = require("./geo");

const MILLISECONDS_PER_DAY = 86400000;
const GRID_R7_PATTERN = /^grid_r7:([0-9a-f]{15})$/i;
const gridR7NormalizationCache = new Map();
const gridR7NeighborCache = new Map();
const cacheStatistics = {
  gridNormalizationHits: 0,
  gridNormalizationMisses: 0,
  neighborHits: 0,
  neighborMisses: 0
};

const DEFAULT_VAGRANT_EVENT_OPTIONS = Object.freeze({
  maximumGapDays: 3,
  dominantEventShareThreshold: 0.8,
  eventWeightCap: 1
});

class DisjointSet {
  constructor(size) {
    this.parent = Array.from({ length: size }, (_, index) => index);
    this.rank = new Uint8Array(size);
  }

  find(index) {
    let root = index;
    while (this.parent[root] !== root) root = this.parent[root];
    while (this.parent[index] !== index) {
      const next = this.parent[index];
      this.parent[index] = root;
      index = next;
    }
    return root;
  }

  union(left, right) {
    let leftRoot = this.find(left);
    let rightRoot = this.find(right);
    if (leftRoot === rightRoot) return leftRoot;
    if (this.rank[leftRoot] < this.rank[rightRoot]) [leftRoot, rightRoot] = [rightRoot, leftRoot];
    this.parent[rightRoot] = leftRoot;
    if (this.rank[leftRoot] === this.rank[rightRoot]) this.rank[leftRoot] += 1;
    return leftRoot;
  }
}

function normalizeOptions(options = {}) {
  const normalized = {
    maximumGapDays: Number(options.maximumGapDays ?? DEFAULT_VAGRANT_EVENT_OPTIONS.maximumGapDays),
    dominantEventShareThreshold: Number(
      options.dominantEventShareThreshold ?? DEFAULT_VAGRANT_EVENT_OPTIONS.dominantEventShareThreshold
    ),
    eventWeightCap: Number(options.eventWeightCap ?? DEFAULT_VAGRANT_EVENT_OPTIONS.eventWeightCap)
  };
  if (!Number.isInteger(normalized.maximumGapDays) || normalized.maximumGapDays < 0) {
    throw new TypeError("maximumGapDays 必须是非负整数");
  }
  if (!(normalized.dominantEventShareThreshold > 0 && normalized.dominantEventShareThreshold <= 1)) {
    throw new TypeError("dominantEventShareThreshold 必须在 (0, 1] 范围内");
  }
  if (!(normalized.eventWeightCap > 0)) {
    throw new TypeError("eventWeightCap 必须大于 0");
  }
  return normalized;
}

function canonicalText(value) {
  return String(value ?? "").trim();
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function detectionKey(taxonId, reportId) {
  return `${canonicalText(taxonId)}\u0000${canonicalText(reportId)}`;
}

/**
 * geo.parseGridId also calculates a centroid and polygon boundary. Those values
 * are useful at the API boundary, but occurrence clustering only needs a valid
 * canonical r7 index. Cache by canonical H3 value so 1.3M detections pay the H3
 * validation cost once per distinct grid rather than once per row.
 */
function normalizeGridR7(value) {
  const match = GRID_R7_PATTERN.exec(String(value || ""));
  if (!match) return null;
  const h3Index = match[1].toLowerCase();
  const canonicalId = `grid_r7:${h3Index}`;
  if (gridR7NormalizationCache.has(canonicalId)) {
    cacheStatistics.gridNormalizationHits += 1;
    return gridR7NormalizationCache.get(canonicalId);
  }
  cacheStatistics.gridNormalizationMisses += 1;
  const normalized = isValidCell(h3Index) && getResolution(h3Index) === 7 ? canonicalId : null;
  gridR7NormalizationCache.set(canonicalId, normalized);
  return normalized;
}

function cachedNeighboringGridCellIds(gridR7) {
  if (gridR7NeighborCache.has(gridR7)) {
    cacheStatistics.neighborHits += 1;
    return gridR7NeighborCache.get(gridR7);
  }
  cacheStatistics.neighborMisses += 1;
  const h3Index = gridR7.slice("grid_r7:".length);
  const neighbors = Object.freeze(gridDisk(h3Index, 1).map((index) => `grid_r7:${index}`));
  gridR7NeighborCache.set(gridR7, neighbors);
  return neighbors;
}

function clearVagrantEventCaches() {
  gridR7NormalizationCache.clear();
  gridR7NeighborCache.clear();
  cacheStatistics.gridNormalizationHits = 0;
  cacheStatistics.gridNormalizationMisses = 0;
  cacheStatistics.neighborHits = 0;
  cacheStatistics.neighborMisses = 0;
}

function getVagrantEventCacheStats() {
  return {
    gridNormalizationCacheSize: gridR7NormalizationCache.size,
    neighborCacheSize: gridR7NeighborCache.size,
    ...cacheStatistics
  };
}

function normalizeDetectionNode(node, sourceIndex) {
  if (!node || typeof node !== "object") {
    throw new TypeError(`detection[${sourceIndex}] 必须是对象`);
  }
  const taxonId = canonicalText(node.taxonId);
  const reportId = canonicalText(node.reportId);
  if (!taxonId) throw new TypeError(`detection[${sourceIndex}].taxonId 不能为空`);
  if (!reportId) throw new TypeError(`detection[${sourceIndex}].reportId 不能为空`);

  const dateParts = isoDateParts(node.reportDate);
  if (!dateParts) throw new TypeError(`detection[${sourceIndex}].reportDate 不是有效 ISO 日期`);
  const normalizedGridR7 = normalizeGridR7(node.gridR7);
  if (!normalizedGridR7) {
    throw new TypeError(`detection[${sourceIndex}].gridR7 不是有效的 H3 r7 单元`);
  }
  const baseWeight = Number(node.baseWeight);
  if (!Number.isFinite(baseWeight) || baseWeight < 0) {
    throw new TypeError(`detection[${sourceIndex}].baseWeight 必须是非负有限数`);
  }
  const observerHash = canonicalText(node.observerHash) || `report:${reportId}`;
  const epochDay = Math.floor(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day) / MILLISECONDS_PER_DAY);
  return {
    taxonId,
    reportId,
    observerHash,
    reportDate: dateParts.iso,
    reportYear: dateParts.year,
    gridR7: normalizedGridR7,
    baseWeight,
    epochDay,
    sourceIndex
  };
}

function compareNormalizedNodes(left, right) {
  return (
    compareText(left.taxonId, right.taxonId) ||
    left.epochDay - right.epochDay ||
    compareText(left.gridR7, right.gridR7) ||
    compareText(left.observerHash, right.observerHash) ||
    compareText(left.reportId, right.reportId) ||
    left.sourceIndex - right.sourceIndex
  );
}

function independentEvidenceKey(node) {
  return `${node.observerHash}\u0000${node.reportDate}\u0000${node.gridR7}`;
}

/**
 * Observer × date × H3 r7 is one independent occurrence signal. The returned
 * groups preserve all source reports so an event cap can later be distributed
 * without making the result depend on input order.
 */
function deduplicateTaxonDetections(nodes) {
  const normalized = nodes.map(normalizeDetectionNode);
  const taxonIds = new Set(normalized.map((node) => node.taxonId));
  if (taxonIds.size > 1) throw new TypeError("deduplicateTaxonDetections 每次只能处理一个鸟种");
  normalized.sort(compareNormalizedNodes);

  const groupsByKey = new Map();
  for (const node of normalized) {
    const key = independentEvidenceKey(node);
    let group = groupsByKey.get(key);
    if (!group) {
      group = { key, representative: node, members: [] };
      groupsByKey.set(key, group);
    }
    group.members.push(node);
  }
  const groups = [...groupsByKey.values()].sort((left, right) =>
    compareNormalizedNodes(left.representative, right.representative)
  );
  return {
    taxonId: normalized[0]?.taxonId ?? null,
    normalizedDetections: normalized,
    independentGroups: groups
  };
}

function clusterIndependentGroups(independentGroups, options) {
  if (independentGroups.length === 0) return [];
  const disjointSet = new DisjointSet(independentGroups.length);
  const buckets = new Map();

  for (let index = 0; index < independentGroups.length; index += 1) {
    const node = independentGroups[index].representative;
    const bucketKey = `${node.epochDay}\u0000${node.gridR7}`;
    const existingIndex = buckets.get(bucketKey);
    if (existingIndex == null) buckets.set(bucketKey, index);
    else disjointSet.union(existingIndex, index);
  }

  for (const [bucketKey, index] of buckets) {
    const node = independentGroups[index].representative;
    const neighborIds = cachedNeighboringGridCellIds(node.gridR7);
    for (let dayOffset = 0; dayOffset <= options.maximumGapDays; dayOffset += 1) {
      const comparisonDay = node.epochDay + dayOffset;
      for (const neighborId of neighborIds) {
        const otherIndex = buckets.get(`${comparisonDay}\u0000${neighborId}`);
        if (otherIndex != null) disjointSet.union(index, otherIndex);
      }
    }
    // Retain the variable to make it explicit that each bucket is visited once.
    void bucketKey;
  }

  const clustered = new Map();
  for (let index = 0; index < independentGroups.length; index += 1) {
    const root = disjointSet.find(index);
    let indexes = clustered.get(root);
    if (!indexes) {
      indexes = [];
      clustered.set(root, indexes);
    }
    indexes.push(index);
  }
  return [...clustered.values()];
}

function classifyReason(eventDominated, singleSupportYear) {
  if (eventDominated && singleSupportYear) return "event_dominated_and_single_support_year";
  if (eventDominated) return "event_dominated";
  if (singleSupportYear) return "single_support_year";
  return null;
}

/**
 * Analyze one taxon. Event identity is deterministic: events are sorted by
 * date/grid/report content after union-find, so shuffling input cannot alter IDs.
 */
function analyzeTaxonDetections(nodes, options = {}) {
  if (!Array.isArray(nodes)) throw new TypeError("nodes 必须是数组");
  const normalizedOptions = normalizeOptions(options);
  const deduplicated = deduplicateTaxonDetections(nodes);
  const { taxonId, normalizedDetections, independentGroups } = deduplicated;
  if (!taxonId) {
    return {
      taxonId: null,
      rawPositiveCount: 0,
      independentPositiveCount: 0,
      independentObserverCount: 0,
      supportYears: [],
      supportYearCount: 0,
      eventCount: 0,
      dominantEventShare: 0,
      eventDominated: false,
      singleSupportYear: false,
      vagrantCandidate: false,
      classificationReason: null,
      events: [],
      independentDetections: [],
      weightAdjustments: []
    };
  }

  const clusteredIndexes = clusterIndependentGroups(independentGroups, normalizedOptions);
  const eventDrafts = clusteredIndexes.map((groupIndexes) => {
    const groups = groupIndexes.map((index) => independentGroups[index]);
    const representatives = groups.map((group) => group.representative).sort(compareNormalizedNodes);
    const rawMembers = groups.flatMap((group) => group.members).sort(compareNormalizedNodes);
    const reportIds = [...new Set(rawMembers.map((node) => node.reportId))].sort(compareText);
    const gridIds = [...new Set(representatives.map((node) => node.gridR7))].sort(compareText);
    const observers = new Set(representatives.map((node) => node.observerHash));
    return {
      groups,
      representatives,
      rawMembers,
      reportIds,
      gridIds,
      observerCount: observers.size,
      startDate: representatives[0].reportDate,
      endDate: representatives[representatives.length - 1].reportDate,
      independentCount: representatives.length,
      rawCount: rawMembers.length,
      baseTrainingWeight: rawMembers.reduce((sum, node) => sum + node.baseWeight, 0)
    };
  });
  eventDrafts.sort(
    (left, right) =>
      compareText(left.startDate, right.startDate) ||
      compareText(left.endDate, right.endDate) ||
      compareText(left.gridIds[0] || "", right.gridIds[0] || "") ||
      compareText(left.reportIds[0] || "", right.reportIds[0] || "")
  );

  const supportYears = [...new Set(independentGroups.map((group) => group.representative.reportYear))].sort(
    (left, right) => left - right
  );
  const independentPositiveCount = independentGroups.length;
  const dominantIndependentCount = eventDrafts.reduce(
    (maximum, event) => Math.max(maximum, event.independentCount),
    0
  );
  const dominantEventShare = independentPositiveCount > 0 ? dominantIndependentCount / independentPositiveCount : 0;
  const eventDominated =
    independentPositiveCount > 0 && dominantEventShare >= normalizedOptions.dominantEventShareThreshold;
  const singleSupportYear = supportYears.length === 1;
  const vagrantCandidate = eventDominated || singleSupportYear;

  const adjustmentBySourceIndex = new Map();
  const events = eventDrafts.map((draft, eventIndex) => {
    const eventId = `${taxonId}:event:${String(eventIndex + 1).padStart(4, "0")}`;
    const multiplier =
      vagrantCandidate && draft.baseTrainingWeight > normalizedOptions.eventWeightCap
        ? normalizedOptions.eventWeightCap / draft.baseTrainingWeight
        : 1;
    for (const member of draft.rawMembers) {
      adjustmentBySourceIndex.set(member.sourceIndex, {
        taxonId,
        reportId: member.reportId,
        eventId,
        baseWeight: member.baseWeight,
        weightMultiplier: multiplier,
        effectiveWeight: member.baseWeight * multiplier
      });
    }
    return {
      eventId,
      startDate: draft.startDate,
      endDate: draft.endDate,
      independentCount: draft.independentCount,
      rawCount: draft.rawCount,
      observerCount: draft.observerCount,
      gridR7Count: draft.gridIds.length,
      gridR7Ids: draft.gridIds,
      reportIds: draft.reportIds,
      baseTrainingWeight: draft.baseTrainingWeight,
      effectiveTrainingWeight: draft.baseTrainingWeight * multiplier,
      weightMultiplier: multiplier
    };
  });

  const independentDetections = independentGroups.map((group) => ({
    taxonId,
    observerHash: group.representative.observerHash,
    reportDate: group.representative.reportDate,
    gridR7: group.representative.gridR7,
    representativeReportId: group.representative.reportId,
    reportIds: group.members.map((node) => node.reportId).sort(compareText),
    duplicateCount: group.members.length - 1
  }));
  const weightAdjustments = normalizedDetections
    .map((node) => adjustmentBySourceIndex.get(node.sourceIndex))
    .sort(
      (left, right) =>
        compareText(left.taxonId, right.taxonId) ||
        compareText(left.reportId, right.reportId) ||
        compareText(left.eventId, right.eventId)
    );

  return {
    taxonId,
    rawPositiveCount: normalizedDetections.length,
    independentPositiveCount,
    independentObserverCount: new Set(independentGroups.map((group) => group.representative.observerHash)).size,
    supportYears,
    supportYearCount: supportYears.length,
    eventCount: events.length,
    dominantEventShare,
    eventDominated,
    singleSupportYear,
    vagrantCandidate,
    classificationReason: classifyReason(eventDominated, singleSupportYear),
    events,
    independentDetections,
    weightAdjustments
  };
}

/** Analyze a mixed list by taxon and return serializable builder-friendly rows. */
function analyzeVagrantEvents(nodes, options = {}) {
  if (!Array.isArray(nodes)) throw new TypeError("nodes 必须是数组");
  const grouped = new Map();
  nodes.forEach((node, index) => {
    const normalized = normalizeDetectionNode(node, index);
    let taxonNodes = grouped.get(normalized.taxonId);
    if (!taxonNodes) {
      taxonNodes = [];
      grouped.set(normalized.taxonId, taxonNodes);
    }
    // Keep the public input shape; analyzeTaxonDetections validates it again and
    // assigns local source indexes used only inside that taxon.
    taxonNodes.push(node);
  });
  const taxa = [...grouped.keys()]
    .sort(compareText)
    .map((taxonId) => analyzeTaxonDetections(grouped.get(taxonId), options));
  return {
    options: normalizeOptions(options),
    taxa,
    weightAdjustments: taxa.flatMap((taxon) => taxon.weightAdjustments)
  };
}

module.exports = {
  DEFAULT_VAGRANT_EVENT_OPTIONS,
  analyzeTaxonDetections,
  analyzeVagrantEvents,
  clearVagrantEventCaches,
  deduplicateTaxonDetections,
  detectionKey,
  getVagrantEventCacheStats
};
