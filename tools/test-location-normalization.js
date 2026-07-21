"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  finalizePointLocationNormalization,
  locationNormalizationReport,
  observePointLocation
} = require("../server/prediction/location-normalization");

function normalize(records) {
  const profiles = new Map();
  const pointStats = new Map();
  for (const record of records) {
    observePointLocation(profiles, record, { valid: record.valid !== false });
    const pointId = String(record.point_id);
    pointStats.set(pointId, { stable: record.stable !== false });
  }
  return finalizePointLocationNormalization(profiles, pointStats);
}

function location(pointId, overrides = {}) {
  return {
    point_id: pointId,
    city_name: "宁波市",
    district_name: "镇海区",
    point_name: "岚山水库",
    longitude: 121.63869,
    latitude: 30.02833,
    start_time: "2025-01-01 08:00:00",
    ...overrides
  };
}

test("岚山水库两个来源 point_id 合并且报告总数守恒", () => {
  const records = [
    ...Array.from({ length: 90 }, (_, index) => location("16431", {
      start_time: `2020-07-${String((index % 14) + 17).padStart(2, "0")} 08:00:00`
    })),
    ...Array.from({ length: 75 }, (_, index) => location("211370", {
      start_time: `2025-09-${String((index % 28) + 1).padStart(2, "0")} 08:00:00`
    }))
  ];
  const normalized = normalize(records);
  const group = normalized.automaticMergeGroups.find((candidate) =>
    candidate.memberPointIds.includes("16431")
  );
  assert.deepEqual(group.memberPointIds, ["16431", "211370"]);
  assert.equal(group.canonicalPointId, "16431");
  assert.equal(group.reportCount, 165);
  assert.equal(normalized.canonicalPointIdByPointId.get("16431"), "16431");
  assert.equal(normalized.canonicalPointIdByPointId.get("211370"), "16431");
});

test("同名远距、近距异名和跨行政区同名均不自动合并", () => {
  const records = [
    location("far-a", { point_name: "同名公园", longitude: 120.1, latitude: 30.1 }),
    location("far-b", { point_name: "同名公园", longitude: 120.2, latitude: 30.2 }),
    location("near-a", { point_name: "东入口", longitude: 120.3, latitude: 30.3 }),
    location("near-b", { point_name: "西入口", longitude: 120.30001, latitude: 30.30001 }),
    location("city-a", { point_name: "人民公园", city_name: "宁波市", district_name: "镇海区" }),
    location("city-b", { point_name: "人民公园", city_name: "杭州市", district_name: "西湖区" })
  ];
  const normalized = normalize(records);
  for (const pointId of records.map((record) => record.point_id)) {
    assert.equal(normalized.canonicalPointIdByPointId.get(pointId), pointId);
  }
  assert.ok(normalized.summary.farSameNamePairCount >= 1);
  assert.ok(normalized.summary.nearbyDifferentNamePairCount >= 1);
  assert.ok(normalized.summary.crossAdministrativeSameNameGroupCount >= 1);
});

test("规范 ID、别名哈希和审计结果不受输入顺序或 worker 数影响", () => {
  const records = [
    location("211370"),
    location("16431"),
    location("point-z", { point_name: "另一个地点", longitude: 120.2, latitude: 30.2 })
  ];
  const projections = [1, 2, 4].map((workers) => {
    const ordered = workers === 1
      ? records
      : workers === 2
        ? [records[2], records[0], records[1]]
        : [...records].reverse();
    const result = normalize(ordered);
    return {
      aliasMapSha256: result.aliasMapSha256,
      auditSha256: result.auditSha256,
      report: locationNormalizationReport(result),
      mappings: [...result.canonicalPointIdByPointId.entries()].sort()
    };
  });
  assert.deepEqual(projections[1], projections[0]);
  assert.deepEqual(projections[2], projections[0]);
});

test("坐标无效或来源 point_id 不稳定时即使身份完全相同也拒绝自动合并", () => {
  const invalid = normalize([
    location("invalid-a", { valid: false }),
    location("invalid-b", { valid: false })
  ]);
  assert.equal(invalid.summary.automaticMergeGroupCount, 0);
  assert.equal(invalid.summary.rejectedExactIdentityGroupCount, 1);
  assert.deepEqual(
    invalid.rejectedExactIdentityGroups[0].reasons,
    ["coordinate_not_valid_for_every_report"]
  );

  const unstable = normalize([
    location("unstable-a", { stable: false }),
    location("unstable-b", { stable: false })
  ]);
  assert.equal(unstable.summary.automaticMergeGroupCount, 0);
  assert.equal(unstable.summary.rejectedExactIdentityGroupCount, 1);
});
