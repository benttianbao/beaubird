"use strict";

const assert = require("node:assert/strict");
const { mkdirSync, unlinkSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { randomUUID } = require("node:crypto");
const test = require("node:test");

const {
  freezeSpatialParametersFromDevelopmentReport,
  loadSpatialParameterArtifact,
  SpatialParameterError
} = require("../server/prediction/spatial-parameters");
const {
  FROZEN_NOVEL_GRID_ADMIN_EXPOSURE_CAPS_V1,
  verifySpatialSplitManifest
} = require("../server/prediction/spatial-transfer");

const SNAPSHOT_SHA = "92602be9b9c3aeb3d7c6cf966c459710a5a9bf6bc078e604a3805ab05fc0b16a";
const SPLIT_PATH = resolve(__dirname, "..", "docs", "zhejiang-v1-20260715-spatial-splits.json");

function developmentReport(failures = []) {
  const split = verifySpatialSplitManifest({
    manifestPath: SPLIT_PATH,
    sourceSnapshotSha256: SNAPSHOT_SHA,
    panelName: "development"
  });
  return {
    model: { artifactSha256: "a".repeat(64) },
    source: { snapshotSha256: SNAPSHOT_SHA },
    releaseQuality: { failures },
    spatial: {
      foldCount: split.panel.folds.length,
      splitManifest: {
        panel: "development",
        sealedPanelViewed: false,
        manifestHash: split.manifestHash
      },
      adminCapTuning: { selectedMatrix: FROZEN_NOVEL_GRID_ADMIN_EXPOSURE_CAPS_V1 },
      metrics: { brierSkill: 0.02, ece: 0.01 },
      spatialCalibration: {
        strategy: "development_spatial_oof_cross_fit_with_scope_guard",
        maximumRelativeBrierDegradation: 0.01,
        maximumEceDegradation: 0.01,
        productionCalibrators: [
          { scope: "species:4356", fit: { a: 1.2, b: 0.8, c: -0.1, fitted: true, iterations: 4 } },
          { scope: "group:positive_30_59", fit: { a: 1.1, b: 0.9, c: 0, fitted: true, iterations: 3 } }
        ]
      }
    }
  };
}

test("development 参数冻结绑定快照、split、报告哈希且可严格重载", () => {
  const directory = resolve(__dirname, "..", ".tmp", "spatial-parameters");
  mkdirSync(directory, { recursive: true });
  const id = randomUUID();
  const reportPath = resolve(directory, `${id}.report.json`);
  const outputPath = resolve(directory, `${id}.parameters.json`);
  writeFileSync(reportPath, `${JSON.stringify(developmentReport(), null, 2)}\n`, "utf8");
  try {
    const frozen = freezeSpatialParametersFromDevelopmentReport({
      reportPath,
      splitManifestPath: SPLIT_PATH,
      outputPath
    });
    assert.match(frozen.fileSha256, /^[a-f0-9]{64}$/);
    assert.equal(frozen.artifact.sealedPanelViewed, false);
    assert.equal(frozen.artifact.calibrators.length, 2);
    const loaded = loadSpatialParameterArtifact(outputPath, {
      sourceSnapshotSha256: SNAPSHOT_SHA,
      spatialSplitManifestHash: frozen.artifact.spatialSplitManifestHash
    });
    assert.equal(loaded.fileSha256, frozen.fileSha256);
    assert.throws(
      () => loadSpatialParameterArtifact(outputPath, { sourceSnapshotSha256: "b".repeat(64) }),
      (error) => error instanceof SpatialParameterError && error.code === "SPATIAL_SNAPSHOT_MISMATCH"
    );
  } finally {
    for (const path of [reportPath, outputPath, `${outputPath}.sha256`]) {
      try {
        unlinkSync(path);
      } catch {
        // Individual test files may not exist after an expected failure.
      }
    }
  }
});

test("development 空间质量门槛失败时拒绝冻结", () => {
  const directory = resolve(__dirname, "..", ".tmp", "spatial-parameters");
  mkdirSync(directory, { recursive: true });
  const id = randomUUID();
  const reportPath = resolve(directory, `${id}.report.json`);
  const outputPath = resolve(directory, `${id}.parameters.json`);
  writeFileSync(
    reportPath,
    `${JSON.stringify(developmentReport(["spatial.species_calibration.maximumEce"]), null, 2)}\n`,
    "utf8"
  );
  try {
    assert.throws(
      () => freezeSpatialParametersFromDevelopmentReport({
        reportPath,
        splitManifestPath: SPLIT_PATH,
        outputPath
      }),
      (error) => error instanceof SpatialParameterError && error.code === "DEVELOPMENT_SPATIAL_GATE_FAILED"
    );
  } finally {
    try {
      unlinkSync(reportPath);
    } catch {
      // Ignore cleanup failure for an already absent individual file.
    }
  }
});
