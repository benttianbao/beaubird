"use strict";

const assert = require("node:assert/strict");
const { mkdtempSync, readFileSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const test = require("node:test");

const {
  SpatialTransferError,
  adminCapForTaxon,
  buildAdminExposureCapCandidates,
  capEffectiveEvidence,
  verifySpatialSplitManifest
} = require("../server/prediction/spatial-transfer");

const SPLIT_PATH = join(__dirname, "..", "docs", "zhejiang-v1-20260715-spatial-splits.json");
const SNAPSHOT_SHA = "92602be9b9c3aeb3d7c6cf966c459710a5a9bf6bc078e604a3805ab05fc0b16a";

test("行政层暴露封顶保持原始检出率", () => {
  assert.deepEqual(capEffectiveEvidence(1_000, 250, 100), {
    exposure: 100,
    detections: 25,
    capped: true
  });
  assert.deepEqual(capEffectiveEvidence(20, 3, 100), {
    exposure: 20,
    detections: 3,
    capped: false
  });
});

test("cap=0 跳过行政层证据，null 表示不封顶", () => {
  assert.deepEqual(capEffectiveEvidence(50, 10, 0), { exposure: 0, detections: 0, capped: true });
  assert.deepEqual(capEffectiveEvidence(50, 10, null), { exposure: 50, detections: 10, capped: false });
});

test("行政层封顶按流行度组解析", () => {
  const matrix = {
    "30-79": { city: 30, district: 10 },
    default: { city: null, district: 100 }
  };
  assert.equal(adminCapForTaxon(matrix, "30-79", "city"), 30);
  assert.equal(adminCapForTaxon(matrix, ">=200", "district"), 100);
  assert.equal(adminCapForTaxon(matrix, ">=200", "grid_r6"), null);
});

test("行政层调参候选一次生成完整且确定的 25 组笛卡尔积", () => {
  const candidates = buildAdminExposureCapCandidates();
  assert.equal(candidates.length, 25);
  assert.equal(new Set(candidates.map((candidate) => candidate.id)).size, 25);
  assert.deepEqual(candidates[0], {
    id: "city=0,district=0",
    caps: { city: 0, district: 0 }
  });
  assert.deepEqual(candidates.at(-1), {
    id: "city=infinite,district=300",
    caps: { city: null, district: 300 }
  });
});

test("冻结空间切分同时校验文件哈希、内容哈希、快照和面板", () => {
  const verified = verifySpatialSplitManifest({
    manifestPath: SPLIT_PATH,
    sourceSnapshotSha256: SNAPSHOT_SHA,
    panelName: "development"
  });
  assert.equal(verified.manifestHash, "400bcc27bde3bd30f03ef022b9f76175cd6093ea5afc98fcbfccb79bde234e4d");
  assert.equal(verified.panel.anchorCount, 12);
  assert.equal(verified.panel.folds.length, 5);
});

test("冻结空间切分不能用于其他快照", () => {
  assert.throws(
    () => verifySpatialSplitManifest({
      manifestPath: SPLIT_PATH,
      sourceSnapshotSha256: "0".repeat(64),
      panelName: "development"
    }),
    (error) => error instanceof SpatialTransferError && error.code === "SPATIAL_SPLIT_SNAPSHOT_MISMATCH"
  );
});

test("密封空间面板必须用 manifestHash 显式解封", () => {
  assert.throws(
    () => verifySpatialSplitManifest({
      manifestPath: SPLIT_PATH,
      sourceSnapshotSha256: SNAPSHOT_SHA,
      panelName: "sealed-release"
    }),
    (error) => error instanceof SpatialTransferError && error.code === "SEALED_SPATIAL_PANEL_CONFIRMATION_REQUIRED"
  );
  const verified = verifySpatialSplitManifest({
    manifestPath: SPLIT_PATH,
    sourceSnapshotSha256: SNAPSHOT_SHA,
    panelName: "sealed-release",
    sealedPanelConfirmation: "400bcc27bde3bd30f03ef022b9f76175cd6093ea5afc98fcbfccb79bde234e4d"
  });
  assert.equal(verified.panelName, "sealed-release");
});

test("冻结空间切分文件被改动时 fail closed", () => {
  const directory = mkdtempSync(join(tmpdir(), "beaubird-spatial-transfer-"));
  const path = join(directory, "split.json");
  writeFileSync(path, readFileSync(SPLIT_PATH));
  writeFileSync(`${path}.sha256`, readFileSync(`${SPLIT_PATH}.sha256`, "utf8"));
  writeFileSync(path, `${readFileSync(path, "utf8")}\n`);
  assert.throws(
    () => verifySpatialSplitManifest({ manifestPath: path, sourceSnapshotSha256: SNAPSHOT_SHA }),
    (error) => error instanceof SpatialTransferError && error.code === "SPATIAL_SPLIT_FILE_HASH_MISMATCH"
  );
});
