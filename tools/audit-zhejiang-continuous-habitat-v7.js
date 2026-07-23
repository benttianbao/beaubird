"use strict";

const { createHash } = require("node:crypto");
const {
  closeSync,
  openSync,
  readSync,
  writeFileSync
} = require("node:fs");
const { resolve } = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const {
  CONTINUOUS_HABITAT_KERNEL_CONTRACT,
  continuousHabitatVector,
  selectContinuousHabitatNeighbors
} = require("../server/prediction/continuous-habitat");
const { bd09ToWgs84, gridCell, isWithinZhejiang } = require("../server/prediction/geo");
const {
  CONTINUOUS_HABITAT_FEATURE_CONTRACT,
  loadHabitatFeatureSet
} = require("../server/prediction/habitat-features");
const { verifySpatialSplitManifest } = require("../server/prediction/spatial-transfer");

class ContinuousHabitatAuditError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "ContinuousHabitatAuditError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function sha256File(path) {
  const hash = createHash("sha256");
  const descriptor = openSync(path, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    while (true) {
      const bytesRead = readSync(descriptor, buffer, 0, buffer.length, null);
      if (!bytesRead) break;
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    closeSync(descriptor);
  }
  return hash.digest("hex");
}

function percentile(values, probability) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return null;
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(probability * sorted.length) - 1));
  return sorted[index];
}

function distribution(values) {
  const finite = values.filter(Number.isFinite);
  return {
    count: finite.length,
    minimum: finite.length ? Math.min(...finite) : null,
    p25: percentile(finite, 0.25),
    median: percentile(finite, 0.5),
    p75: percentile(finite, 0.75),
    p90: percentile(finite, 0.9),
    maximum: finite.length ? Math.max(...finite) : null
  };
}

function collectObservedCellCities(snapshotPath) {
  const database = new DatabaseSync(snapshotPath, { readOnly: true });
  try {
    database.exec("PRAGMA query_only = ON");
    const sourceCardinality = {
      reportRows: Number(
        database.prepare("SELECT COUNT(*) AS count FROM reports").get().count
      ) || 0,
      observationRows: Number(
        database.prepare("SELECT COUNT(*) AS count FROM observations").get().count
      ) || 0,
      distinctObservationKeys: Number(
        database.prepare(`
          SELECT COUNT(*) AS count
          FROM (
            SELECT report_id, taxon_key
            FROM observations
            GROUP BY report_id, taxon_key
          )
        `).get().count
      ) || 0,
      publicTaxonKeys: Number(
        database.prepare("SELECT COUNT(DISTINCT taxon_key) AS count FROM observations").get().count
      ) || 0,
      orphanObservationRows: Number(
        database.prepare(`
          SELECT COUNT(*) AS count
          FROM observations
          LEFT JOIN reports USING (report_id)
          WHERE reports.report_id IS NULL
        `).get().count
      ) || 0
    };
    sourceCardinality.duplicateObservationRows =
      sourceCardinality.observationRows - sourceCardinality.distinctObservationKeys;
    const votes = new Map();
    let usableReports = 0;
    for (const row of database.prepare(`
      SELECT report_id, city_name, longitude, latitude
      FROM reports
      WHERE longitude IS NOT NULL AND latitude IS NOT NULL
      ORDER BY report_id
    `).iterate()) {
      const coordinate = bd09ToWgs84(row.longitude, row.latitude);
      if (
        !coordinate.valid ||
        coordinate.swapped ||
        !isWithinZhejiang(coordinate.longitude, coordinate.latitude)
      ) continue;
      usableReports += 1;
      const unitId = gridCell(coordinate.longitude, coordinate.latitude, "grid_r6").id;
      const cityName = String(row.city_name || "");
      if (!votes.has(unitId)) votes.set(unitId, new Map());
      const cellVotes = votes.get(unitId);
      cellVotes.set(cityName, (cellVotes.get(cityName) || 0) + 1);
    }
    const cells = [...votes].map(([unitId, cityVotes]) => {
      const rankedVotes = [...cityVotes]
        .map(([cityName, reportCount]) => ({ cityName, reportCount }))
        .sort(
          (left, right) =>
            right.reportCount - left.reportCount ||
            left.cityName.localeCompare(right.cityName)
        );
      return {
        unitId,
        h3Index: unitId.slice("grid_r6:".length),
        cityName: rankedVotes[0]?.cityName || "",
        reportCount: rankedVotes.reduce((sum, row) => sum + row.reportCount, 0),
        cityVoteCount: rankedVotes.length
      };
    }).sort((left, right) => left.unitId.localeCompare(right.unitId));
    return { cells, usableReports, sourceCardinality };
  } finally {
    database.close();
  }
}

function foldAudit({
  fold,
  anchorsById,
  observedCells,
  featureSet,
  sealedBufferIds
}) {
  const targetAnchors = fold.anchorIds.map((unitId) => anchorsById.get(unitId));
  if (targetAnchors.some((anchor) => !anchor)) {
    throw new ContinuousHabitatAuditError(
      "V7_AUDIT_SPLIT_INVALID",
      `development fold ${fold.foldId} 引用了未知 anchor。`
    );
  }
  const excludedIds = new Set(
    targetAnchors.flatMap((anchor) => anchor.bufferCellIds || [anchor.unitId])
  );
  const candidates = observedCells
    .filter((cell) => !excludedIds.has(cell.unitId) && !sealedBufferIds.has(cell.unitId))
    .map((cell) => {
      const feature = featureSet.cellsByH3.get(cell.h3Index);
      return feature
        ? {
            unitId: cell.unitId,
            cityName: cell.cityName,
            vector: continuousHabitatVector(feature.classFractions)
          }
        : null;
    })
    .filter(Boolean);
  const targets = targetAnchors.map((anchor) => {
    const h3Index = String(anchor.unitId).slice("grid_r6:".length);
    const feature = featureSet.cellsByH3.get(h3Index);
    if (!feature) {
      throw new ContinuousHabitatAuditError(
        "V7_AUDIT_FEATURE_MISSING",
        `development anchor 缺少连续生境特征：${anchor.unitId}`
      );
    }
    const selection = selectContinuousHabitatNeighbors({
      targetUnitId: anchor.unitId,
      targetCityName: anchor.city,
      targetVector: continuousHabitatVector(feature.classFractions),
      candidates
    });
    return {
      unitId: anchor.unitId,
      city: anchor.city,
      checklistCount: anchor.checklists,
      scope: selection.scope,
      eligibleCandidateCount: selection.eligibleCandidateCount,
      sameCityCandidateCount: selection.sameCityCandidateCount,
      selectedNeighborCount: selection.neighbors.length,
      effectiveNeighborCount: selection.effectiveNeighborCount,
      nearestDistance: selection.nearestDistance,
      farthestDistance: selection.farthestDistance
    };
  });
  return {
    foldId: String(fold.foldId),
    candidateCellCount: candidates.length,
    excludedBufferCellCount: excludedIds.size,
    targetCount: targets.length,
    targets
  };
}

function auditContinuousHabitatV7({
  snapshotPath,
  featurePath,
  splitPath
}) {
  const absoluteSnapshotPath = resolve(snapshotPath);
  const absoluteFeaturePath = resolve(featurePath);
  const absoluteSplitPath = resolve(splitPath);
  const snapshotSha256 = sha256File(absoluteSnapshotPath);
  const verifiedSplit = verifySpatialSplitManifest({
    manifestPath: absoluteSplitPath,
    sourceSnapshotSha256: snapshotSha256,
    panelName: "development"
  });
  const featureSet = loadHabitatFeatureSet(absoluteFeaturePath, {
    expectedSnapshotSha256: snapshotSha256,
    expectedContractId: CONTINUOUS_HABITAT_FEATURE_CONTRACT.id
  });
  const observed = collectObservedCellCities(absoluteSnapshotPath);
  const missingObservedCells = observed.cells
    .filter((cell) => !featureSet.cellsByH3.has(cell.h3Index))
    .map((cell) => cell.unitId);
  if (missingObservedCells.length) {
    throw new ContinuousHabitatAuditError(
      "V7_AUDIT_FEATURE_COVERAGE_INCOMPLETE",
      "连续生境特征没有覆盖全部快照训练网格。",
      { missingCount: missingObservedCells.length, firstMissing: missingObservedCells.slice(0, 20) }
    );
  }
  const anchorsById = new Map(
    verifiedSplit.panel.anchors.map((anchor) => [anchor.unitId, anchor])
  );
  const sealedBufferIds = new Set(
    verifiedSplit.manifest.sealedRelease.anchors.flatMap(
      (anchor) => anchor.bufferCellIds || [anchor.unitId]
    )
  );
  const folds = verifiedSplit.panel.folds
    .map((fold) => foldAudit({
      fold,
      anchorsById,
      observedCells: observed.cells,
      featureSet,
      sealedBufferIds
    }))
    .sort((left, right) => Number(left.foldId) - Number(right.foldId));
  const targets = folds.flatMap((fold) => fold.targets);
  const developmentCities = [...new Set(
    verifiedSplit.panel.anchors.map((anchor) => String(anchor.city || ""))
  )].filter(Boolean).sort();
  const foldedAnchorIds = verifiedSplit.panel.folds.flatMap((fold) => fold.anchorIds);
  if (
    verifiedSplit.panel.folds.length !== 5 ||
    developmentCities.length !== 11 ||
    foldedAnchorIds.length !== verifiedSplit.panel.anchors.length ||
    new Set(foldedAnchorIds).size !== foldedAnchorIds.length
  ) {
    throw new ContinuousHabitatAuditError(
      "V7_AUDIT_DEVELOPMENT_SPLIT_INVALID",
      "v7 预登记必须保持冻结的 11 市、5 折 development split。",
      {
        foldCount: verifiedSplit.panel.folds.length,
        developmentCityCount: developmentCities.length,
        anchorCount: verifiedSplit.panel.anchors.length,
        foldedAnchorCount: foldedAnchorIds.length,
        distinctFoldedAnchorCount: new Set(foldedAnchorIds).size
      }
    );
  }
  return {
    schemaVersion: 1,
    kind: "zhejiang_continuous_habitat_v7_target_independent_preregistration_audit",
    bindings: {
      snapshotSha256,
      featureFileSha256: featureSet.fileSha256,
      featureSetSha256: featureSet.featureSetSha256,
      featureContractId: featureSet.contract.id,
      tileManifestSha256: featureSet.tileManifestSha256,
      spatialSplitFileSha256: verifiedSplit.fileSha256,
      spatialSplitManifestHash: verifiedSplit.manifestHash
    },
    contract: CONTINUOUS_HABITAT_KERNEL_CONTRACT,
    targetIndependence: {
      taxonOutcomeFieldsReadForKernelSelection: [],
      cardinalityOnlyFieldsRead: [
        "observations.report_id",
        "observations.taxon_key"
      ],
      inputs:
        "snapshot coordinates and city names, frozen development/sealed buffers, WorldCover fractions",
      sealedLabelsRead: false,
      sourceCardinalityUsedForParameterSelection: false
    },
    sourceCardinality: observed.sourceCardinality,
    splitIntegrity: {
      panel: "development",
      cityCount: developmentCities.length,
      cities: developmentCities,
      foldCount: verifiedSplit.panel.folds.length,
      anchorCount: verifiedSplit.panel.anchors.length,
      foldedAnchorCount: foldedAnchorIds.length,
      eachAnchorAppearsExactlyOnce: new Set(foldedAnchorIds).size === foldedAnchorIds.length
    },
    coverage: {
      usableCoordinateReports: observed.usableReports,
      observedH3R6Count: observed.cells.length,
      featureH3R6Count: featureSet.summary.cellCount,
      missingObservedH3R6Count: missingObservedCells.length,
      sealedBufferCellCount: sealedBufferIds.size
    },
    folds,
    summary: {
      targetCount: targets.length,
      sameCityTargetCount: targets.filter((target) => target.scope === "same_city").length,
      zhejiangFallbackTargetCount:
        targets.filter((target) => target.scope === "zhejiang_fallback").length,
      selectedNeighborCount: distribution(targets.map((target) => target.selectedNeighborCount)),
      effectiveNeighborCount: distribution(targets.map((target) => target.effectiveNeighborCount)),
      nearestDistance: distribution(targets.map((target) => target.nearestDistance)),
      farthestDistance: distribution(targets.map((target) => target.farthestDistance)),
      allTargetsHaveMinimumNeighbors: targets.every(
        (target) =>
          target.selectedNeighborCount >=
          CONTINUOUS_HABITAT_KERNEL_CONTRACT.minimumSameCityNeighbors
      ),
      allTargetsWithinMaximumDistance: targets.every(
        (target) =>
          Number.isFinite(target.farthestDistance) &&
          target.farthestDistance <= CONTINUOUS_HABITAT_KERNEL_CONTRACT.maximumDistance
      )
    }
  };
}

function parseCliArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = () => {
      index += 1;
      if (index >= argv.length) {
        throw new ContinuousHabitatAuditError("INVALID_OPTIONS", `${argument} 缺少值。`);
      }
      return argv[index];
    };
    if (argument === "--snapshot") options.snapshotPath = value();
    else if (argument === "--features") options.featurePath = value();
    else if (argument === "--spatial-split-manifest") options.splitPath = value();
    else if (argument === "--output") options.outputPath = value();
    else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new ContinuousHabitatAuditError("INVALID_OPTIONS", `未知参数：${argument}`);
  }
  return options;
}

function usage() {
  return "node tools/audit-zhejiang-continuous-habitat-v7.js --snapshot data/prediction-snapshots/zhejiang-v1-20260715.sqlite --features data/prediction-features/zhejiang-v1-20260715-worldcover-h3-r6-continuous-v2.json --spatial-split-manifest docs/zhejiang-v1-20260715-spatial-splits.json --output data/prediction-models/development-cache/zhejiang-v1-20260715-continuous-habitat-v7-preregister-audit.json";
}

if (require.main === module) {
  try {
    const options = parseCliArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${usage()}\n`);
    } else {
      if (!options.snapshotPath || !options.featurePath || !options.splitPath || !options.outputPath) {
        throw new ContinuousHabitatAuditError(
          "INVALID_OPTIONS",
          "必须提供 snapshot、features、spatial-split-manifest 和 output。"
        );
      }
      const outputPath = resolve(options.outputPath);
      const audit = auditContinuousHabitatV7(options);
      const bytes = `${JSON.stringify(audit, null, 2)}\n`;
      writeFileSync(outputPath, bytes, { encoding: "utf8", flag: "wx" });
      const outputSha256 = sha256File(outputPath);
      writeFileSync(
        `${outputPath}.sha256`,
        `${outputSha256}  ${outputPath.split(/[\\/]/).pop()}\n`,
        { encoding: "utf8", flag: "wx" }
      );
      process.stdout.write(`${JSON.stringify({
        ok: true,
        outputPath,
        outputSha256,
        summary: audit.summary
      }, null, 2)}\n`);
    }
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      ok: false,
      code: error.code || "V7_CONTINUOUS_HABITAT_AUDIT_FAILED",
      message: error.message,
      details: error.details
    }, null, 2)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  ContinuousHabitatAuditError,
  auditContinuousHabitatV7,
  collectObservedCellCities,
  distribution,
  foldAudit,
  parseCliArguments,
  percentile,
  usage
};
