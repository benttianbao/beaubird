"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  CONTINUOUS_HABITAT_KERNEL_CONTRACT,
  continuousHabitatVector,
  hellingerDistance,
  kernelWeight,
  selectContinuousHabitatNeighbors
} = require("../server/prediction/continuous-habitat");

function fractions(overrides = {}) {
  return {
    "10": 0,
    "20": 0,
    "30": 0,
    "40": 0,
    "50": 0,
    "60": 0,
    "70": 0,
    "80": 0,
    "90": 0,
    "95": 0,
    "100": 0,
    ...overrides
  };
}

test("连续 WorldCover 投影保持五类组成守恒", () => {
  const vector = continuousHabitatVector(fractions({
    "10": 0.2,
    "20": 0.05,
    "30": 0.05,
    "40": 0.3,
    "50": 0.1,
    "80": 0.2,
    "90": 0.1
  }));
  assert.deepEqual(vector, [0.2, 0.1, 0.3, 0.1, 0.30000000000000004]);
  assert.ok(Math.abs(vector.reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
});

test("Hellinger 距离和核权重对称、确定且有界", () => {
  const forest = [1, 0, 0, 0, 0];
  const water = [0, 0, 0, 0, 1];
  assert.equal(hellingerDistance(forest, forest), 0);
  assert.equal(hellingerDistance(forest, water), 1);
  assert.equal(hellingerDistance(forest, water), hellingerDistance(water, forest));
  assert.equal(kernelWeight(0), 1);
  assert.ok(kernelWeight(0.2) < 1);
  assert.ok(kernelWeight(0.3) < kernelWeight(0.2));
});

test("邻居选择优先同市、排除目标网格且不受输入顺序影响", () => {
  const target = [0.7, 0.1, 0.1, 0.05, 0.05];
  const candidates = Array.from({ length: 12 }, (_, index) => ({
    unitId: `grid:${String(index).padStart(2, "0")}`,
    cityName: index < 9 ? "杭州市" : "宁波市",
    vector: [
      0.7 - index * 0.005,
      0.1 + index * 0.002,
      0.1 + index * 0.001,
      0.05 + index * 0.001,
      0.05 + index * 0.001
    ]
  }));
  candidates.push({ unitId: "target", cityName: "杭州市", vector: target });
  const forward = selectContinuousHabitatNeighbors({
    targetUnitId: "target",
    targetCityName: "杭州市",
    targetVector: target,
    candidates
  });
  const reverse = selectContinuousHabitatNeighbors({
    targetUnitId: "target",
    targetCityName: "杭州市",
    targetVector: target,
    candidates: [...candidates].reverse()
  });
  assert.equal(forward.scope, "same_city");
  assert.equal(forward.neighbors.some((neighbor) => neighbor.unitId === "target"), false);
  assert.equal(forward.neighbors.every((neighbor) => neighbor.cityName === "杭州市"), true);
  assert.deepEqual(forward, reverse);
  assert.equal(CONTINUOUS_HABITAT_KERNEL_CONTRACT.evidenceExposureCap, 10);
});

test("同市候选不足时只按连续距离回退全省", () => {
  const result = selectContinuousHabitatNeighbors({
    targetUnitId: "target",
    targetCityName: "舟山市",
    targetVector: [0, 0, 0, 0, 1],
    candidates: [
      { unitId: "a", cityName: "舟山市", vector: [0, 0, 0, 0.01, 0.99] },
      { unitId: "b", cityName: "宁波市", vector: [0, 0, 0, 0.02, 0.98] }
    ]
  });
  assert.equal(result.scope, "zhejiang_fallback");
  assert.deepEqual(result.neighbors.map((neighbor) => neighbor.unitId), ["a", "b"]);
});
