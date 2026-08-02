"use strict";

const {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} = require("node:fs");
const { basename, dirname, resolve } = require("node:path");

const {
  aggregateHoldoutMetrics,
  crossFitSpatialCalibrators,
  predictionImplementationSha256
} = require("./build-zhejiang-prediction-model");
const {
  loadTerrainFeatureSet
} = require("../server/prediction/terrain-features");
const {
  openTerrainOofCache,
  readTerrainOofRows,
  generationImplementationSha256:
    terrainOofCacheGenerationImplementationSha256
} = require("../server/prediction/terrain-oof-cache");
const {
  FROZEN_TERRAIN_QUALITY_GATES,
  terrainOofScorerImplementationSha256,
  validatePreregistration
} = require("../server/prediction/terrain-preregistration");
const {
  sha256File
} = require("../server/prediction/spatial-oof-cache");

class TerrainOofScoringError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "TerrainOofScoringError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = () => {
      index += 1;
      if (index >= argv.length) {
        throw new TerrainOofScoringError(
          "TERRAIN_OOF_SCORE_OPTIONS_INVALID",
          `${argument} 缺少值。`
        );
      }
      return argv[index];
    };
    if (argument === "--cache") {
      options.cachePath = value();
    } else if (argument === "--snapshot") {
      options.snapshotPath = value();
    } else if (argument === "--spatial-split-manifest") {
      options.spatialSplitManifestPath = value();
    } else if (argument === "--terrain-features") {
      options.terrainFeaturesPath = value();
    } else if (argument === "--preregistration") {
      options.preregistrationPath = value();
    } else if (argument === "--v10-report") {
      options.v10ReportPath = value();
    } else if (argument === "--output") {
      options.outputPath = value();
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new TerrainOofScoringError(
        "TERRAIN_OOF_SCORE_OPTIONS_INVALID",
        `未知参数：${argument}`
      );
    }
  }
  return options;
}

function usage() {
  return "node tools/score-zhejiang-terrain-oof-v11.js --cache data/prediction-models/development-cache/zhejiang-v1-20260715-terrain-oof-v11.sqlite --snapshot data/prediction-snapshots/zhejiang-v1-20260715.sqlite --spatial-split-manifest docs/zhejiang-v1-20260715-spatial-splits.json --terrain-features data/prediction-features/zhejiang-v1-20260715-terrain-h3-r6-v1.json --preregistration docs/zhejiang-v1-20260715-terrain-v11-preregistration.json --v10-report data/prediction-models/zhejiang-v1-20260715-development-multiscale-spatial-feature-v10.sqlite.report.json --output data/prediction-models/development-cache/zhejiang-v1-20260715-terrain-oof-v11.decision.json";
}

function safeUnlink(path) {
  if (!path || !existsSync(path)) return;
  try {
    chmodSync(path, 0o666);
  } catch {
    // Windows ACLs may ignore POSIX mode bits.
  }
  unlinkSync(path);
}

function assertPaths(options) {
  const required = [
    "cachePath",
    "snapshotPath",
    "spatialSplitManifestPath",
    "terrainFeaturesPath",
    "preregistrationPath",
    "v10ReportPath",
    "outputPath"
  ];
  const missing = required.filter((key) => !options[key]);
  if (missing.length) {
    throw new TerrainOofScoringError(
      "TERRAIN_OOF_SCORE_OPTIONS_INVALID",
      "真实 v11 OOF 评分缺少必需路径。",
      { missing }
    );
  }
  const paths = Object.fromEntries(
    required.map((key) => [key, resolve(options[key])])
  );
  const outputSidecarPath = `${paths.outputPath}.sha256`;
  const inputPaths = new Set(
    required
      .filter((key) => key !== "outputPath")
      .map((key) => paths[key].toLowerCase())
  );
  if (
    inputPaths.has(paths.outputPath.toLowerCase()) ||
    existsSync(paths.outputPath) ||
    existsSync(outputSidecarPath)
  ) {
    throw new TerrainOofScoringError(
      "TERRAIN_OOF_SCORE_OUTPUT_EXISTS",
      "OOF 决策报告不得覆盖输入或已有输出。"
    );
  }
  return { ...paths, outputSidecarPath };
}

function foldsForRows(rows) {
  const byFold = new Map();
  for (const row of rows) {
    if (!byFold.has(row.outerFoldId)) {
      byFold.set(row.outerFoldId, []);
    }
    byFold.get(row.outerFoldId).push(row);
  }
  return [...byFold].sort(
    (left, right) => left[0] - right[0]
  ).map(([foldId, scoreRows]) => ({
    foldId: String(foldId),
    scoreRows
  }));
}

function scoredChannel(rows) {
  const folds = foldsForRows(rows);
  if (
    folds.length !== 5 ||
    folds.some((fold) => !fold.scoreRows.length)
  ) {
    throw new TerrainOofScoringError(
      "TERRAIN_OOF_OUTER_ROWS_INCOMPLETE",
      "OOF 评分必须包含完整的 5 个 outer 折。"
    );
  }
  const crossFit = crossFitSpatialCalibrators(folds);
  const scoredFolds = folds.map((fold, index) => ({
    foldId: fold.foldId,
    metrics: crossFit.foldMetrics[index]
  }));
  return {
    metrics: aggregateHoldoutMetrics(scoredFolds),
    folds: scoredFolds,
    spatialCalibration: crossFit.summary
  };
}

function scoredInnerChannel(rows) {
  const byOuter = new Map();
  for (const row of rows) {
    if (!row.innerFoldId) continue;
    if (!byOuter.has(row.outerFoldId)) {
      byOuter.set(row.outerFoldId, new Map());
    }
    const byInner = byOuter.get(row.outerFoldId);
    if (!byInner.has(row.innerFoldId)) {
      byInner.set(row.innerFoldId, []);
    }
    byInner.get(row.innerFoldId).push(row);
  }
  if (
    byOuter.size !== 5 ||
    [...byOuter.values()].some(
      (byInner) => byInner.size !== 4
    )
  ) {
    throw new TerrainOofScoringError(
      "TERRAIN_OOF_INNER_ROWS_INCOMPLETE",
      "Terrain OOF diagnostics require 5 outer groups and 20 fresh inner folds."
    );
  }
  const outerGroups = [];
  const allScoredFolds = [];
  for (const [outerFoldId, byInner] of [
    ...byOuter
  ].sort((left, right) => left[0] - right[0])) {
    const folds = [...byInner]
      .sort((left, right) => left[0] - right[0])
      .map(([innerFoldId, scoreRows]) => ({
        foldId: String(innerFoldId),
        scoreRows
      }));
    const crossFit = crossFitSpatialCalibrators(folds);
    const scoredFolds = folds.map((fold, index) => ({
      foldId:
        `${outerFoldId}:${fold.foldId}`,
      metrics: crossFit.foldMetrics[index]
    }));
    allScoredFolds.push(...scoredFolds);
    outerGroups.push({
      outerFoldId: String(outerFoldId),
      innerFoldCount: scoredFolds.length,
      metrics: metricProjection(
        aggregateHoldoutMetrics(scoredFolds)
      )
    });
  }
  return {
    outerGroupCount: outerGroups.length,
    innerFoldCount: allScoredFolds.length,
    metrics: metricProjection(
      aggregateHoldoutMetrics(allScoredFolds)
    ),
    outerGroups
  };
}

function metricProjection(metrics) {
  return {
    brier: metrics?.brier ?? null,
    baselineBrier: metrics?.baselineBrier ?? null,
    brierSkill: metrics?.brierSkill ?? null,
    ece: metrics?.ece ?? null,
    recallAt20: metrics?.recallAt20 ?? null,
    recallAt20Delta: metrics?.recallAt20Delta ?? null,
    maximumSpeciesEce:
      metrics?.calibrationEce?.species?.maximumEce ??
      null,
    maximumGroupEce:
      metrics?.calibrationEce?.group?.maximumEce ??
      null,
    evaluatedWeight: metrics?.evaluatedWeight ?? null,
    validationContexts:
      metrics?.validationContexts ?? null
  };
}

function absoluteDifferences(actual, expected) {
  return Object.fromEntries(
    Object.keys(expected).map((key) => [
      key,
      Number.isFinite(Number(actual?.[key])) &&
      Number.isFinite(Number(expected?.[key]))
        ? Math.abs(
            Number(actual[key]) - Number(expected[key])
          )
        : Number.POSITIVE_INFINITY
    ])
  );
}

function relativeDegradation(candidate, control) {
  return control > 1e-12
    ? (candidate - control) / control
    : candidate <= control + 1e-12
      ? 0
      : Number.POSITIVE_INFINITY;
}

function run(options) {
  const paths = assertPaths(options);
  const snapshotSha256 = sha256File(paths.snapshotPath);
  const splitSha256 = sha256File(
    paths.spatialSplitManifestPath
  );
  const preregistrationFileSha256 = sha256File(
    paths.preregistrationPath
  );
  const controlReportFileSha256 = sha256File(
    paths.v10ReportPath
  );
  const preregistration = JSON.parse(
    readFileSync(paths.preregistrationPath, "utf8")
  );
  const terrainFeatureSet = loadTerrainFeatureSet(
    paths.terrainFeaturesPath,
    { expectedSnapshotSha256: snapshotSha256 }
  );
  validatePreregistration(preregistration, {
    requireFrozen: true,
    terrainFeatureSet,
    preregistrationFileSha256,
    controlReportFileSha256,
    implementation: {
      predictionImplementationSha256:
        predictionImplementationSha256(),
      terrainOofCacheGenerationImplementationSha256:
        terrainOofCacheGenerationImplementationSha256(),
      terrainOofScorerImplementationSha256:
        terrainOofScorerImplementationSha256()
    }
  });
  const cache = openTerrainOofCache({
    cachePath: paths.cachePath,
    expectedSnapshotSha256: snapshotSha256,
    expectedSpatialSplitFileSha256: splitSha256,
    expectedTerrainFeatureFileSha256:
      terrainFeatureSet.fileSha256
  });
  try {
    if (
      cache.metadata.preregistrationFileSha256 !==
        preregistrationFileSha256 ||
      cache.metadata.controlReportFileSha256 !==
        controlReportFileSha256 ||
      cache.metadata.predictionImplementationSha256 !==
        preregistration.implementation
          .predictionImplementationSha256 ||
      cache.metadata.generationImplementationSha256 !==
        preregistration.implementation
          .terrainOofCacheGenerationImplementationSha256
    ) {
      throw new TerrainOofScoringError(
        "TERRAIN_OOF_SCORE_BINDING_MISMATCH",
        "OOF 缓存未绑定当前冻结预登记或 v10 control 报告。"
      );
    }
    const candidate = scoredChannel(
      readTerrainOofRows(cache, {
        outerOnly: true,
        channel: "candidate"
      })
    );
    const control = scoredChannel(
      readTerrainOofRows(cache, {
        outerOnly: true,
        channel: "control"
      })
    );
    const candidateInnerDiagnostics =
      scoredInnerChannel(
        readTerrainOofRows(cache, {
          channel: "candidate"
        })
      );
    const controlInnerDiagnostics =
      scoredInnerChannel(
        readTerrainOofRows(cache, {
          channel: "control"
        })
      );
    const v10Report = JSON.parse(
      readFileSync(paths.v10ReportPath, "utf8")
    );
    const expectedControl = {
      pooled: metricProjection(v10Report.spatial?.metrics),
      folds: (v10Report.spatial?.folds || []).map(
        (fold) => ({
          foldId: String(fold.foldId),
          metrics: metricProjection(fold.metrics)
        })
      )
    };
    const actualControl = {
      pooled: metricProjection(control.metrics),
      folds: control.folds.map((fold) => ({
        foldId: fold.foldId,
        metrics: metricProjection(fold.metrics)
      }))
    };
    const controlComparisons = [
      {
        scope: "pooled",
        differences: absoluteDifferences(
          actualControl.pooled,
          expectedControl.pooled
        )
      },
      ...actualControl.folds.map((fold) => {
        const expected = expectedControl.folds.find(
          (item) => item.foldId === fold.foldId
        );
        return {
          scope: `fold-${fold.foldId}`,
          differences: absoluteDifferences(
            fold.metrics,
            expected?.metrics || {}
          )
        };
      })
    ];
    const controlTolerance =
      preregistration.controlReproduction
        .absoluteTolerance;
    const controlFailures = controlComparisons.flatMap(
      (comparison) =>
        Object.entries(comparison.differences)
          .filter(([, difference]) =>
            difference > controlTolerance
          )
          .map(
            ([metric, difference]) =>
              `${comparison.scope}.${metric}:${difference}`
          )
    );
    const candidatePooled = metricProjection(
      candidate.metrics
    );
    const gates = FROZEN_TERRAIN_QUALITY_GATES;
    const candidateFailures = [];
    if (
      !(candidatePooled.maximumSpeciesEce <=
        gates.maximumSpeciesEce)
    ) candidateFailures.push("maximumSpeciesEce");
    if (
      !(candidatePooled.maximumGroupEce <=
        gates.maximumGroupEce)
    ) candidateFailures.push("maximumGroupEce");
    if (
      !(candidatePooled.ece <= gates.maximumOverallEce)
    ) candidateFailures.push("overallEce");
    if (
      !(candidatePooled.brierSkill >
        gates.minimumBrierSkillExclusive)
    ) candidateFailures.push("brierSkill");
    if (
      !(candidatePooled.recallAt20Delta >=
        gates.minimumRecallAt20Delta)
    ) candidateFailures.push("recallAt20Delta");
    const degradationComparisons = [
      {
        scope: "pooled",
        candidate: candidatePooled,
        v10: expectedControl.pooled
      },
      ...candidate.folds.map((fold) => ({
        scope: `fold-${fold.foldId}`,
        candidate: metricProjection(fold.metrics),
        v10: expectedControl.folds.find(
          (item) => item.foldId === fold.foldId
        )?.metrics
      }))
    ].map((comparison) => ({
      scope: comparison.scope,
      relativeBrierDegradation:
        relativeDegradation(
          comparison.candidate.brier,
          comparison.v10.brier
        ),
      eceDegradation:
        comparison.candidate.ece -
        comparison.v10.ece
    }));
    for (const comparison of degradationComparisons) {
      if (
        comparison.relativeBrierDegradation >
        gates
          .maximumRelativeBrierDegradationVsV10PerFoldAndPooled
      ) {
        candidateFailures.push(
          `${comparison.scope}.relativeBrierDegradation`
        );
      }
      if (
        comparison.eceDegradation >
        gates.maximumEceDegradationVsV10PerFoldAndPooled
      ) {
        candidateFailures.push(
          `${comparison.scope}.eceDegradation`
        );
      }
    }
    const passed =
      controlFailures.length === 0 &&
      candidateFailures.length === 0;
    const report = {
      schemaVersion: 1,
      kind: "zhejiang_true_terrain_v11_oof_decision",
      modelVersion:
        preregistration.modelVersion,
      generatedAt: new Date().toISOString(),
      developmentOnly: true,
      diagnosticOnly: true,
      publishEligible: false,
      sealedPanelViewed: false,
      inputs: {
        cacheFileSha256: cache.fileSha256,
        snapshotSha256,
        spatialSplitFileSha256: splitSha256,
        terrainFeatureFileSha256:
          terrainFeatureSet.fileSha256,
        terrainFeatureSetSha256:
          terrainFeatureSet.featureSetSha256,
        preregistrationFileSha256,
        v10ControlReportFileSha256:
          controlReportFileSha256,
        predictionImplementationSha256:
          cache.metadata.predictionImplementationSha256,
        terrainOofCacheGenerationImplementationSha256:
          cache.metadata.generationImplementationSha256,
        terrainOofScorerImplementationSha256:
          terrainOofScorerImplementationSha256()
      },
      protocol: {
        outerFoldCount: 5,
        innerFoldCount: 20,
        innerFoldRole:
          "fresh_strict_nested_completeness_and_diagnostics_only_no_candidate_selection_or_gate_tuning",
        candidateCount: 1,
        parameterSearch: false,
        postHocSpeciesCalibrationAdded: false
      },
      control: {
        tolerance: controlTolerance,
        passed: controlFailures.length === 0,
        failures: controlFailures,
        expected: expectedControl,
        actual: actualControl,
        comparisons: controlComparisons
      },
      candidate: {
        metrics: candidatePooled,
        folds: candidate.folds.map((fold) => ({
          foldId: fold.foldId,
          metrics: metricProjection(fold.metrics)
        })),
        spatialCalibration:
          candidate.spatialCalibration,
        gates,
        degradationComparisons,
        passed: candidateFailures.length === 0,
        failures: candidateFailures
      },
      innerDiagnostics: {
        gateApplied: false,
        parameterSelectionApplied: false,
        candidate: candidateInnerDiagnostics,
        control: controlInnerDiagnostics
      },
      decision: passed ? "Go" : "No-Go",
      goForFullSqliteBuild: passed,
      goForPublication: false,
      failurePolicy: passed
        ? "await_explicit_approval_before_full_sqlite_build"
        : "stop_true_v11_without_v12_v13_or_parameter_search"
    };
    const temporaryOutput =
      `${paths.outputPath}.building-${process.pid}`;
    const temporarySidecar =
      `${paths.outputSidecarPath}.building-${process.pid}`;
    safeUnlink(temporaryOutput);
    safeUnlink(temporarySidecar);
    mkdirSync(dirname(paths.outputPath), {
      recursive: true
    });
    try {
      writeFileSync(
        temporaryOutput,
        `${JSON.stringify(report, null, 2)}\n`,
        "utf8"
      );
      const reportSha256 = sha256File(temporaryOutput);
      writeFileSync(
        temporarySidecar,
        `${reportSha256}  ${basename(paths.outputPath)}\n`,
        "utf8"
      );
      let outputPublished = false;
      let sidecarPublished = false;
      try {
        renameSync(temporaryOutput, paths.outputPath);
        outputPublished = true;
        renameSync(
          temporarySidecar,
          paths.outputSidecarPath
        );
        sidecarPublished = true;
      } catch (error) {
        if (sidecarPublished) {
          safeUnlink(paths.outputSidecarPath);
        }
        if (outputPublished) {
          safeUnlink(paths.outputPath);
        }
        throw error;
      }
      return {
        ok: true,
        outputPath: paths.outputPath,
        reportSha256,
        decision: report.decision,
        goForFullSqliteBuild:
          report.goForFullSqliteBuild,
        goForPublication: false,
        controlPassed: report.control.passed,
        candidatePassed: report.candidate.passed
      };
    } catch (error) {
      safeUnlink(temporaryOutput);
      safeUnlink(temporarySidecar);
      throw error;
    }
  } finally {
    cache.close();
  }
}

if (require.main === module) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${usage()}\n`);
    } else {
      process.stdout.write(
        `${JSON.stringify(run(options), null, 2)}\n`
      );
    }
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({
        ok: false,
        code:
          error.code || "TERRAIN_OOF_SCORE_FAILED",
        message: error.message,
        details: error.details
      }, null, 2)}\n`
    );
    process.exitCode = 1;
  }
}

module.exports = {
  TerrainOofScoringError,
  foldsForRows,
  metricProjection,
  parseArguments,
  run,
  scoredChannel,
  scoredInnerChannel,
  usage
};
