"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { gridDisk } = require("h3-js");

const {
  analyzeTaxonDetections,
  analyzeVagrantEvents,
  clearVagrantEventCaches,
  deduplicateTaxonDetections,
  getVagrantEventCacheStats
} = require("../server/prediction/vagrant-events");
const { gridCell, neighboringGridCellIds, parseGridId } = require("../server/prediction/geo");

const CENTER = gridCell(120.15, 30.25, "grid_r7").id;
const ONE_RING = neighboringGridCellIds(CENTER).find((id) => id !== CENTER);
const CENTER_PARSED = parseGridId(CENTER);
const ONE_RING_SET = new Set(neighboringGridCellIds(CENTER));
const TWO_RING = gridDisk(CENTER_PARSED.h3Index, 2)
  .map((index) => `grid_r7:${index}`)
  .find((id) => !ONE_RING_SET.has(id));

function detection({
  taxonId = "taxon-a",
  reportId,
  observerHash,
  reportDate,
  gridR7 = CENTER,
  baseWeight = 1
}) {
  return { taxonId, reportId, observerHash, reportDate, gridR7, baseWeight };
}

function observations(count, options = {}) {
  return Array.from({ length: count }, (_, index) =>
    detection({
      taxonId: options.taxonId,
      reportId: `${options.prefix || "r"}-${index + 1}`,
      observerHash: `${options.prefix || "o"}-${index + 1}`,
      reportDate: options.reportDate,
      gridR7: options.gridR7,
      baseWeight: options.baseWeight ?? 1
    })
  );
}

test("日期差 3 天合并，4 天不合并", () => {
  const within = analyzeTaxonDetections([
    detection({ reportId: "a", observerHash: "oa", reportDate: "2025-01-01" }),
    detection({ reportId: "b", observerHash: "ob", reportDate: "2025-01-04" })
  ]);
  assert.equal(within.eventCount, 1);

  const outside = analyzeTaxonDetections([
    detection({ reportId: "a", observerHash: "oa", reportDate: "2025-01-01" }),
    detection({ reportId: "b", observerHash: "ob", reportDate: "2025-01-05" })
  ]);
  assert.equal(outside.eventCount, 2);
});

test("并查集保留 3 天间隔的链式传递聚类", () => {
  const result = analyzeTaxonDetections([
    detection({ reportId: "a", observerHash: "oa", reportDate: "2025-01-01", gridR7: CENTER }),
    detection({ reportId: "b", observerHash: "ob", reportDate: "2025-01-04", gridR7: ONE_RING }),
    detection({ reportId: "c", observerHash: "oc", reportDate: "2025-01-07", gridR7: CENTER })
  ]);
  assert.equal(result.eventCount, 1);
  assert.equal(result.events[0].startDate, "2025-01-01");
  assert.equal(result.events[0].endDate, "2025-01-07");
});

test("H3 同格和一环相连，两环不直接相连", () => {
  const oneRing = analyzeTaxonDetections([
    detection({ reportId: "a", observerHash: "oa", reportDate: "2025-02-01", gridR7: CENTER }),
    detection({ reportId: "b", observerHash: "ob", reportDate: "2025-02-01", gridR7: ONE_RING })
  ]);
  assert.equal(oneRing.eventCount, 1);

  const twoRing = analyzeTaxonDetections([
    detection({ reportId: "a", observerHash: "oa", reportDate: "2025-02-01", gridR7: CENTER }),
    detection({ reportId: "b", observerHash: "ob", reportDate: "2025-02-01", gridR7: TWO_RING })
  ]);
  assert.equal(twoRing.eventCount, 2);
});

test("同鸟种 observer×date×H3 重复记录只算一份独立证据", () => {
  const source = [
    detection({ reportId: "b", observerHash: "same", reportDate: "2025-03-01" }),
    detection({ reportId: "a", observerHash: "same", reportDate: "2025-03-01" }),
    detection({ reportId: "c", observerHash: "other", reportDate: "2025-03-01" })
  ];
  const deduplicated = deduplicateTaxonDetections(source);
  assert.equal(deduplicated.normalizedDetections.length, 3);
  assert.equal(deduplicated.independentGroups.length, 2);
  const repeatedGroup = deduplicated.independentGroups.find(
    (group) => group.representative.observerHash === "same"
  );
  assert.equal(repeatedGroup.representative.reportId, "a");

  const result = analyzeTaxonDetections(source);
  assert.equal(result.rawPositiveCount, 3);
  assert.equal(result.independentPositiveCount, 2);
  assert.equal(result.events[0].independentCount, 2);
  assert.equal(result.events[0].rawCount, 3);
});

test("dominant share 的 8/10 达标，7/10 不达标", () => {
  const eightOfTen = analyzeTaxonDetections([
    ...observations(8, { prefix: "main", reportDate: "2025-04-01" }),
    ...observations(2, { prefix: "other", reportDate: "2026-09-01" })
  ]);
  assert.equal(eightOfTen.dominantEventShare, 0.8);
  assert.equal(eightOfTen.eventDominated, true);
  assert.equal(eightOfTen.vagrantCandidate, true);

  const sevenOfTen = analyzeTaxonDetections([
    ...observations(7, { prefix: "main", reportDate: "2025-04-01" }),
    ...observations(3, { prefix: "other", reportDate: "2026-09-01" })
  ]);
  assert.equal(sevenOfTen.dominantEventShare, 0.7);
  assert.equal(sevenOfTen.eventDominated, false);
  assert.equal(sevenOfTen.singleSupportYear, false);
  assert.equal(sevenOfTen.vagrantCandidate, false);
});

test("仅一个支持年份单独触发候选，多年份不会误触发", () => {
  const oneYear = analyzeTaxonDetections([
    ...observations(2, { prefix: "spring", reportDate: "2025-04-01" }),
    ...observations(2, { prefix: "autumn", reportDate: "2025-10-01" })
  ]);
  assert.equal(oneYear.dominantEventShare, 0.5);
  assert.equal(oneYear.singleSupportYear, true);
  assert.equal(oneYear.vagrantCandidate, true);
  assert.equal(oneYear.classificationReason, "single_support_year");

  const twoYears = analyzeTaxonDetections([
    ...observations(2, { prefix: "spring", reportDate: "2025-04-01" }),
    ...observations(2, { prefix: "autumn", reportDate: "2026-10-01" })
  ]);
  assert.equal(twoYears.singleSupportYear, false);
  assert.equal(twoYears.eventDominated, false);
  assert.equal(twoYears.vagrantCandidate, false);
});

test("跨年相隔不超过 3 天仍属于同一事件，但支持年份为两个", () => {
  const result = analyzeTaxonDetections([
    detection({ reportId: "a", observerHash: "oa", reportDate: "2025-12-31" }),
    detection({ reportId: "b", observerHash: "ob", reportDate: "2026-01-02", gridR7: ONE_RING })
  ]);
  assert.equal(result.eventCount, 1);
  assert.deepEqual(result.supportYears, [2025, 2026]);
  assert.equal(result.singleSupportYear, false);
});

test("候选鸟每个事件的训练权重封顶为 1", () => {
  const result = analyzeTaxonDetections([
    detection({ reportId: "a", observerHash: "oa", reportDate: "2025-05-01", baseWeight: 0.75 }),
    detection({ reportId: "b", observerHash: "ob", reportDate: "2025-05-01", baseWeight: 0.75 })
  ]);
  assert.equal(result.vagrantCandidate, true);
  assert.equal(result.events[0].baseTrainingWeight, 1.5);
  assert.ok(Math.abs(result.events[0].effectiveTrainingWeight - 1) < 1e-12);
  assert.ok(result.weightAdjustments.every((row) => Math.abs(row.weightMultiplier - 2 / 3) < 1e-12));
  assert.ok(
    Math.abs(result.weightAdjustments.reduce((sum, row) => sum + row.effectiveWeight, 0) - 1) < 1e-12
  );
});

test("非候选鸟不应用事件 cap", () => {
  const result = analyzeTaxonDetections([
    ...observations(4, { prefix: "first", reportDate: "2025-05-01", baseWeight: 0.75 }),
    ...observations(4, { prefix: "second", reportDate: "2026-10-01", baseWeight: 0.75 })
  ]);
  assert.equal(result.vagrantCandidate, false);
  assert.ok(result.events.every((event) => event.baseTrainingWeight === 3));
  assert.ok(result.events.every((event) => event.effectiveTrainingWeight === 3));
  assert.ok(result.weightAdjustments.every((row) => row.weightMultiplier === 1));
});

test("分析结果与输入顺序无关，混合鸟种按 taxonId 稳定排序", () => {
  const source = [
    detection({ taxonId: "z", reportId: "z2", observerHash: "oz2", reportDate: "2025-01-04", gridR7: ONE_RING }),
    detection({ taxonId: "a", reportId: "a1", observerHash: "oa1", reportDate: "2024-06-01" }),
    detection({ taxonId: "z", reportId: "z1", observerHash: "oz1", reportDate: "2025-01-01" }),
    detection({ taxonId: "a", reportId: "a2", observerHash: "oa2", reportDate: "2026-06-01" })
  ];
  const reversed = [...source].reverse();
  const left = analyzeVagrantEvents(source);
  const right = analyzeVagrantEvents(reversed);
  assert.deepEqual(left.taxa, right.taxa);
  assert.deepEqual(left.weightAdjustments, right.weightAdjustments);
  assert.deepEqual(left.taxa.map((row) => row.taxonId), ["a", "z"]);
});

test("H3 规范化和一环查询按唯一网格缓存，预热不改变分析结果", () => {
  clearVagrantEventCaches();
  const source = Array.from({ length: 200 }, (_, index) =>
    detection({
      reportId: `cache-${index}`,
      observerHash: `cache-observer-${index}`,
      reportDate: index % 2 === 0 ? "2025-08-01" : "2025-08-02",
      gridR7: index % 2 === 0 ? CENTER : ONE_RING
    })
  );

  const coldResult = analyzeTaxonDetections(source);
  const coldStats = getVagrantEventCacheStats();
  assert.equal(coldStats.gridNormalizationCacheSize, 2);
  assert.equal(coldStats.gridNormalizationMisses, 2);
  assert.equal(coldStats.neighborCacheSize, 2);
  assert.equal(coldStats.neighborMisses, 2);

  const warmResult = analyzeTaxonDetections([...source].reverse());
  const warmStats = getVagrantEventCacheStats();
  assert.deepEqual(warmResult, coldResult);
  assert.equal(warmStats.gridNormalizationMisses, coldStats.gridNormalizationMisses);
  assert.equal(warmStats.neighborMisses, coldStats.neighborMisses);
  assert.ok(warmStats.gridNormalizationHits > coldStats.gridNormalizationHits);
  assert.ok(warmStats.neighborHits > coldStats.neighborHits);
});
