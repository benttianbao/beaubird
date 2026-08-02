"use strict";

const assert = require("node:assert/strict");
const {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmdirSync,
  unlinkSync
} = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

const {
  EXPECTED_TERRAIN_OOF_LAYOUT,
  generationImplementationSha256,
  openTerrainOofCache,
  readTerrainOofRows,
  writeTerrainOofCache
} = require("../server/prediction/terrain-oof-cache");
const {
  TERRAIN_FEATURE_CONTRACT
} = require("../server/prediction/terrain-features");
const {
  scoredInnerChannel
} = require("./score-zhejiang-terrain-oof-v11");

const sha = (character) => character.repeat(64);
const temporaryDirectory = mkdtempSync(
  join(tmpdir(), "beaubird-terrain-oof-")
);
const cachePath = join(
  temporaryDirectory,
  "terrain-oof.sqlite"
);

function scoreRow(contextIndex, offset = 0) {
  return {
    contextIndex,
    taxonId: "4004",
    positiveCount: 240,
    actualPositive: 1,
    total: 10,
    baselineProbability: 0.05,
    rawProbability: 0.08 + offset,
    terrainControlProbability: 0.07,
    deepestLevel: "habitat_continuous",
    habitatEvidence: {
      exposure: 4,
      detections: 0.5,
      strength: 30,
      neighborCount: 24
    },
    terrainControlHabitatEvidence: {
      exposure: 5,
      detections: 0.4,
      strength: 30,
      neighborCount: 24
    }
  };
}

const folds = [1, 2, 3, 4, 5].map((outerFoldId) => ({
  foldId: String(outerFoldId),
  evidenceConfiguration: {
    bandwidthDays: 14
  },
  scoreRows: [scoreRow(0, outerFoldId / 1000)],
  innerFolds: [1, 2, 3, 4, 5]
    .filter((innerFoldId) => innerFoldId !== outerFoldId)
    .map((innerFoldId) => ({
      innerFoldId: String(innerFoldId),
      trainingFoldIds: [1, 2, 3, 4, 5]
        .filter(
          (foldId) =>
            foldId !== outerFoldId &&
            foldId !== innerFoldId
        )
        .map(String),
      evidenceConfiguration: {
        bandwidthDays: 14
      },
      scoreRows: [
        scoreRow(0, (outerFoldId + innerFoldId) / 1000)
      ]
    }))
}));

try {
  const result = writeTerrainOofCache({
    cachePath,
    folds,
    verifiedSpatialSplit: {
      panelName: "development",
      fileSha256: sha("b"),
      manifestHash: sha("c"),
      manifest: {
        sourceSnapshotSha256: sha("a")
      }
    },
    sourceSnapshotSha256: sha("a"),
    habitatFeatures: {
      fileSha256: sha("d"),
      featureSetSha256: sha("e")
    },
    terrainFeatures: {
      contractId: TERRAIN_FEATURE_CONTRACT.id,
      fileSha256: sha("f"),
      featureSetSha256: sha("1"),
      tileManifestSha256: sha("2"),
      cellCatalogFileSha256: sha("d"),
      cellCatalogFeatureSetSha256: sha("e")
    },
    preregistrationFileSha256: sha("3"),
    controlReportFileSha256: sha("4"),
    generationImplementationSha256:
      generationImplementationSha256(),
    predictionImplementationSha256: sha("5"),
    qualityThresholds: {
      maximumSpeciesEce: 0.05
    }
  });
  assert.equal(
    result.foldSetCount,
    EXPECTED_TERRAIN_OOF_LAYOUT.foldSetCount
  );
  assert.equal(result.scoreCount, 25);
  const cache = openTerrainOofCache({
    cachePath,
    expectedSnapshotSha256: sha("a"),
    expectedSpatialSplitFileSha256: sha("b"),
    expectedTerrainFeatureFileSha256: sha("f")
  });
  try {
    assert.equal(
      readTerrainOofRows(cache).length,
      25
    );
    assert.equal(
      readTerrainOofRows(cache, {
        outerOnly: true,
        channel: "control"
      }).length,
      5
    );
    const innerDiagnostics = scoredInnerChannel(
      readTerrainOofRows(cache, {
        channel: "candidate"
      })
    );
    assert.equal(innerDiagnostics.outerGroupCount, 5);
    assert.equal(innerDiagnostics.innerFoldCount, 20);
    const schemaText = cache.database.prepare(
      "SELECT GROUP_CONCAT(sql, ' ') AS sql FROM sqlite_master"
    ).get().sql;
    for (const forbidden of [
      "longitude",
      "latitude",
      "h3_r6",
      "report_id",
      "observer_id",
      "neighbor_id"
    ]) {
      assert.equal(
        schemaText.toLowerCase().includes(forbidden),
        false
      );
    }
  } finally {
    cache.close();
  }
  assert.match(
    readFileSync(`${cachePath}.sha256`, "utf8"),
    /^[a-f0-9]{64}\s+terrain-oof\.sqlite/
  );
  process.stdout.write(
    "terrain OOF cache tests passed\n"
  );
} finally {
  for (const path of [cachePath, `${cachePath}.sha256`]) {
    try {
      chmodSync(path, 0o666);
      unlinkSync(path);
    } catch {
      // Test cleanup is best effort.
    }
  }
  try {
    rmdirSync(temporaryDirectory);
  } catch {
    // Test cleanup is best effort.
  }
}
