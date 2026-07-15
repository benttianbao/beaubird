"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { cellToLatLng } = require("h3-js");

const { gridCell, neighboringGridCellIds } = require("../server/prediction/geo");
const {
  SPATIAL_SPLIT_ALGORITHM_VERSION,
  SpatialSplitError,
  generateSpatialSplitManifest
} = require("../server/prediction/spatial-splits");

const SYNTHETIC_CITIES = Object.freeze(Array.from({ length: 11 }, (_, index) => `测试市${String(index + 1).padStart(2, "0")}`));

function candidateForCell(unitId, city, checklists, observers) {
  const h3Index = unitId.slice("grid_r6:".length);
  const [latitude, longitude] = cellToLatLng(h3Index);
  return {
    unitId,
    city,
    checklists,
    observers,
    centroid: { longitude, latitude },
    // The split generator must ignore target-bearing or unknown fields.
    taxonHits: { "synthetic-taxon": checklists }
  };
}

function syntheticCandidates(candidatesPerCity = 7) {
  const rows = [];
  for (let cityIndex = 0; cityIndex < SYNTHETIC_CITIES.length; cityIndex += 1) {
    const baseLongitude = 80 + (cityIndex % 4) * 4;
    const baseLatitude = 10 + Math.floor(cityIndex / 4) * 4;
    for (let candidateIndex = 0; candidateIndex < candidatesPerCity; candidateIndex += 1) {
      const cell = gridCell(baseLongitude + candidateIndex * 0.25, baseLatitude, "grid_r6");
      rows.push(
        candidateForCell(
          cell.id,
          SYNTHETIC_CITIES[cityIndex],
          30 + candidateIndex * 35 + cityIndex,
          10 + candidateIndex * 3 + cityIndex
        )
      );
    }
  }
  return rows;
}

function generate(candidates, overrides = {}) {
  return generateSpatialSplitManifest({
    candidates,
    viewedAnchorIds: overrides.viewedAnchorIds || [],
    snapshotSha256: overrides.snapshotSha256 || "a".repeat(64),
    expectedCities: SYNTHETIC_CITIES,
    releaseFoldCount: 5,
    developmentFoldCount: 5,
    ...overrides
  });
}

function assertPairwiseDisjointBuffers(anchors) {
  for (let leftIndex = 0; leftIndex < anchors.length; leftIndex += 1) {
    const left = new Set(anchors[leftIndex].bufferCellIds);
    for (let rightIndex = leftIndex + 1; rightIndex < anchors.length; rightIndex += 1) {
      const overlap = anchors[rightIndex].bufferCellIds.filter((cellId) => left.has(cellId));
      assert.deepEqual(
        overlap,
        [],
        `${anchors[leftIndex].unitId} 与 ${anchors[rightIndex].unitId} 的一环缓冲不应重叠`
      );
    }
  }
}

test("空间 split manifest 对输入顺序和鸟种结果字段不敏感且完全确定", () => {
  const candidates = syntheticCandidates();
  const viewedAnchorIds = [candidates[0].unitId, candidates[1].unitId, candidates[7].unitId];
  const first = generate(candidates, { viewedAnchorIds });
  const reordered = [...candidates]
    .reverse()
    .map((candidate) => ({ ...candidate, taxonHits: { changed: 999_999 }, arbitraryOutcome: Math.random() }));
  const second = generate(reordered, { viewedAnchorIds: [...viewedAnchorIds].reverse() });

  assert.deepEqual(second, first);
  assert.equal(first.algorithmVersion, SPATIAL_SPLIT_ALGORITHM_VERSION);
  assert.equal(first.constraints.targetIndependent, true);
  assert.deepEqual(first.constraints.taxonOutcomeFieldsRead, []);
  assert.match(first.inputHash, /^[0-9a-f]{64}$/);
  assert.match(first.manifestHash, /^[0-9a-f]{64}$/);
});

test("开发和封存面板覆盖全部 11 市，既有锚点固定在开发面板且所有缓冲隔离", () => {
  const candidates = syntheticCandidates();
  const viewedAnchorIds = [candidates[0].unitId, candidates[1].unitId, candidates[7].unitId];
  const manifest = generate(candidates, { viewedAnchorIds });
  const expectedCoverage = [...SYNTHETIC_CITIES].sort();

  assert.equal(manifest.development.coversExpectedCities, true);
  assert.equal(manifest.sealedRelease.coversExpectedCities, true);
  assert.deepEqual(manifest.development.cityCoverage, expectedCoverage);
  assert.deepEqual(manifest.sealedRelease.cityCoverage, expectedCoverage);
  assert.equal(manifest.sealedRelease.anchorCount, 11);
  assert.equal(manifest.development.anchorCount, 12);

  const developmentIds = new Set(manifest.development.anchors.map((anchor) => anchor.unitId));
  const sealedIds = new Set(manifest.sealedRelease.anchors.map((anchor) => anchor.unitId));
  for (const viewedAnchorId of viewedAnchorIds) {
    assert.equal(developmentIds.has(viewedAnchorId), true);
    assert.equal(sealedIds.has(viewedAnchorId), false);
    assert.equal(
      manifest.development.anchors.find((anchor) => anchor.unitId === viewedAnchorId).selectionReason,
      "previously_viewed_development_anchor"
    );
  }

  const allAnchors = [...manifest.development.anchors, ...manifest.sealedRelease.anchors];
  assertPairwiseDisjointBuffers(allAnchors);
  assert.equal(manifest.isolation.overlapCellCount, 0);
  assert.deepEqual(manifest.isolation.overlapCellIds, []);
});

test("封存面板确定性分成 5 个数量平衡的折且每个锚点只出现一次", () => {
  const manifest = generate(syntheticCandidates());
  assert.equal(manifest.sealedRelease.folds.length, 5);
  assert.deepEqual(
    manifest.sealedRelease.folds.map((fold) => fold.anchorCount).sort((left, right) => left - right),
    [2, 2, 2, 2, 3]
  );
  assert.equal(
    manifest.sealedRelease.balance.maximumAnchorsPerFold - manifest.sealedRelease.balance.minimumAnchorsPerFold,
    1
  );
  const foldedIds = manifest.sealedRelease.folds.flatMap((fold) => fold.anchorIds);
  assert.equal(new Set(foldedIds).size, manifest.sealedRelease.anchorCount);
  assert.deepEqual(
    [...foldedIds].sort(),
    manifest.sealedRelease.anchors.map((anchor) => anchor.unitId).sort()
  );
  for (const anchor of manifest.sealedRelease.anchors) {
    assert.equal(
      manifest.sealedRelease.folds.find((fold) => fold.foldId === anchor.foldId).anchorIds.includes(anchor.unitId),
      true
    );
  }
});

test("快照 SHA 改变时 seed、输入哈希和 manifest 哈希都会改变", () => {
  const candidates = syntheticCandidates();
  const first = generate(candidates, { snapshotSha256: "1".repeat(64) });
  const second = generate(candidates, { snapshotSha256: "2".repeat(64) });
  assert.notEqual(first.seed, second.seed);
  assert.notEqual(first.inputHash, second.inputHash);
  assert.notEqual(first.manifestHash, second.manifestHash);
});

test("某地市只有一环重叠候选时 fail closed", () => {
  const candidates = syntheticCandidates(4).filter((candidate) => candidate.city !== SYNTHETIC_CITIES[0]);
  const base = gridCell(100, 40, "grid_r6").id;
  const adjacent = neighboringGridCellIds(base).find((unitId) => unitId !== base);
  candidates.push(candidateForCell(base, SYNTHETIC_CITIES[0], 50, 20));
  candidates.push(candidateForCell(adjacent, SYNTHETIC_CITIES[0], 60, 25));

  assert.throws(
    () => generate(candidates),
    (error) => error instanceof SpatialSplitError && error.code === "NO_FEASIBLE_SPLIT"
  );
});

test("未知既有锚点会明确失败而不会静默进入封存面板", () => {
  assert.throws(
    () => generate(syntheticCandidates(), { viewedAnchorIds: [gridCell(10, 50, "grid_r6").id] }),
    (error) => error instanceof SpatialSplitError && error.code === "UNKNOWN_VIEWED_ANCHOR"
  );
});

