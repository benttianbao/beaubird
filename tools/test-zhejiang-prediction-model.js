"use strict";

const assert = require("node:assert/strict");
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const test = require("node:test");

const {
  bd09ToWgs84,
  gridCell,
  isWithinZhejiang,
  seasonWeek,
  seasonalDay
} = require("../server/prediction/geo");
const { betaInterval, fitBetaCalibration, regularizedIncompleteBeta } = require("../server/prediction/math");
const { PredictionError, PredictionModel } = require("../server/prediction/model");
const {
  PredictionBuildError,
  buildPredictionArtifact,
  cliResultSummary,
  createArtifactSchema,
  createTrainingSnapshot,
  evaluateReleaseQuality,
  guardCalibrationCandidates,
  inspectSnapshotQuality,
  publishModelPointer,
  selectTemporalFoldReports
} = require("./build-zhejiang-prediction-model");

function testDirectory(name) {
  const directory = resolve(__dirname, "..", ".tmp", `prediction-${name}-${randomUUID()}`);
  mkdirSync(directory, { recursive: true });
  return directory;
}

function createSourceDatabase(path, options = {}) {
  const database = new DatabaseSync(path);
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE public_output_safety (
      generation TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    );
    CREATE TABLE crawl_meta (
      run_id TEXT PRIMARY KEY,
      province TEXT NOT NULL,
      version TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      status TEXT NOT NULL,
      summary_json TEXT,
      options_json TEXT,
      normal_report_total INTEGER DEFAULT 0,
      flagged_report_total INTEGER DEFAULT 0,
      saved_report_count INTEGER DEFAULT 0,
      saved_observation_count INTEGER DEFAULT 0,
      filtered_red_species_count INTEGER DEFAULT 0,
      failed_report_count INTEGER DEFAULT 0
    );
    CREATE TABLE reports (
      report_id TEXT PRIMARY KEY,
      serial_id TEXT,
      report_kind TEXT NOT NULL,
      source_outside_type INTEGER NOT NULL,
      is_flagged_report INTEGER NOT NULL,
      start_time TEXT,
      end_time TEXT,
      province_name TEXT,
      city_name TEXT,
      district_name TEXT,
      point_name TEXT,
      point_id TEXT,
      location TEXT,
      longitude REAL,
      latitude REAL,
      location_metadata_fetched INTEGER NOT NULL,
      location_text TEXT,
      state INTEGER,
      taxon_count_reported INTEGER,
      outside_count INTEGER,
      observation_count_stored INTEGER NOT NULL DEFAULT 0,
      sensitive_observation_count INTEGER NOT NULL DEFAULT 0,
      fetched_at TEXT NOT NULL,
      raw_report_json TEXT NOT NULL
    );
    CREATE TABLE observations (
      report_id TEXT NOT NULL,
      taxon_key TEXT NOT NULL,
      taxon_id TEXT,
      taxon_name TEXT,
      latinname TEXT,
      englishname TEXT,
      taxon_order_name TEXT,
      taxon_family_name TEXT,
      taxon_count INTEGER,
      is_red_species INTEGER NOT NULL,
      source_outside_type INTEGER NOT NULL,
      record_image_num INTEGER,
      raw_index INTEGER NOT NULL,
      raw_taxon_json TEXT NOT NULL,
      PRIMARY KEY (report_id, taxon_key),
      FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE
    );
  `);
  if (!options.omitSafetyMarker) {
    database
      .prepare("INSERT INTO public_output_safety(generation, created_at) VALUES (?, ?)")
      .run("beaubird-public-sqlite-sensitive-safe-v3", "2026-01-01T00:00:00Z");
  }
  const reportCount = options.reportCount ?? 72;
  database
    .prepare(
      `INSERT INTO crawl_meta
       (run_id, province, version, started_at, completed_at, status,
        normal_report_total, saved_report_count, saved_observation_count)
       VALUES ('fixture', '浙江省', 'CH4', '2023-01-01T00:00:00Z', ?, ?, ?, ?, ?)`
    )
    .run(
      options.running ? null : "2026-01-02T00:00:00Z",
      options.running ? "running" : "completed",
      reportCount,
      reportCount,
      reportCount * 2
    );
  if (options.staleRunning) {
    database
      .prepare(
        `INSERT INTO crawl_meta
         (run_id, province, version, started_at, completed_at, status, normal_report_total)
         VALUES ('stale-running', '浙江省', 'CH4', '2022-01-01T00:00:00Z', NULL, 'running', 0)`
      )
      .run();
  }
  const insertReport = database.prepare(
    `INSERT INTO reports
     (report_id, serial_id, report_kind, source_outside_type, is_flagged_report,
      start_time, end_time, province_name, city_name, district_name, point_name,
      point_id, location, longitude, latitude, location_metadata_fetched,
      location_text, state, taxon_count_reported, outside_count, fetched_at, raw_report_json)
     VALUES (?, ?, 'normal', 0, 0, ?, ?, '浙江省', '杭州市', '西湖区', '测试湿地',
             'point-1', '120.1300,30.2700', ?, ?, ?, '浙江省杭州市西湖区', 1, ?, 0, ?, ?)`
  );
  const insertObservation = database.prepare(
    `INSERT INTO observations
     (report_id, taxon_key, taxon_id, taxon_name, latinname, englishname,
      taxon_order_name, taxon_family_name, taxon_count, is_red_species,
      source_outside_type, record_image_num, raw_index, raw_taxon_json)
     VALUES (?, ?, ?, ?, ?, ?, '', '', 1, ?, ?, 0, ?, '{}')`
  );
  const updateReportLocation = database.prepare(
    "UPDATE reports SET point_id = ?, longitude = ?, latitude = ? WHERE report_id = ?"
  );
  const multiGridCoordinates = [
    [120.13, 30.27],
    [120.75, 30.77],
    [121.45, 29.88],
    [119.65, 29.08]
  ];
  database.exec("BEGIN");
  for (let index = 0; index < reportCount; index += 1) {
    const year = 2023 + (index % (options.yearSpan || 3));
    const month = (index % 12) + 1;
    const day = (index % 24) + 1;
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const taxa = [
      { id: "100", name: "白鹭", latin: "Egretta garzetta", english: "Little Egret", red: 0 }
    ];
    if (month >= 4 && month <= 8) {
      taxa.push({ id: "200", name: "夏候鸟", latin: "Testus aestivus", english: "Summer Test Bird", red: 0 });
    }
    if (index === 0 && options.includeSensitive) {
      taxa.push({ id: "999", name: "敏感鸟", latin: "Secretus birdus", english: "Secret Bird", red: 1 });
    }
    const reported = options.incomplete && index === reportCount - 1 ? taxa.length + 1 : taxa.length;
    insertReport.run(
      `report-${index}`,
      `serial-${index}`,
      `${date} 06:00:00`,
      `${date} 08:00:00`,
      120.13,
      30.27,
      options.missingCoordinate && index === 0 ? 0 : 1,
      reported,
      `${date}T12:00:00Z`,
      JSON.stringify({ userId: `observer-${index % (options.observerModulo || 18)}` })
    );
    if (options.multiGrid) {
      const gridIndex = index % multiGridCoordinates.length;
      const [longitude, latitude] = multiGridCoordinates[gridIndex];
      updateReportLocation.run(`point-${gridIndex + 1}`, longitude, latitude, `report-${index}`);
    }
    taxa.forEach((taxon, taxonIndex) => {
      insertObservation.run(
        `report-${index}`,
        taxon.id,
        taxon.id,
        taxon.name,
        taxon.latin,
        taxon.english,
        taxon.red,
        taxon.red,
        taxonIndex
      );
    });
  }
  database.exec("COMMIT");
  database.close();
}

test("BD-09 conversion, stable grids, leap day and cyclic weeks are deterministic", () => {
  const wgs = bd09ToWgs84(120.13, 30.27);
  assert.equal(wgs.valid, true);
  assert.ok(wgs.longitude > 120.11 && wgs.longitude < 120.13);
  assert.ok(wgs.latitude > 30.25 && wgs.latitude < 30.27);
  const gridA = gridCell(wgs.longitude, wgs.latitude, "grid_r7");
  const gridB = gridCell(wgs.longitude, wgs.latitude, "grid_r7");
  assert.equal(gridA.id, gridB.id);
  assert.equal(seasonalDay("2024-02-29"), 59.5);
  assert.equal(seasonWeek("2024-12-31"), 52);
  assert.equal(isWithinZhejiang(120.15, 30.27), true);
  assert.equal(isWithinZhejiang(121.47, 31.23), false);
});

test("beta posterior interval and beta calibration remain finite and monotone", () => {
  assert.ok(Math.abs(regularizedIncompleteBeta(0.5, 2, 2) - 0.5) < 1e-9);
  const interval = betaInterval(8, 4);
  assert.ok(interval.lower < 8 / 12 && interval.upper > 8 / 12);
  const fitted = fitBetaCalibration([
    { probability: 0.05, positives: 1, total: 100 },
    { probability: 0.2, positives: 15, total: 100 },
    { probability: 0.6, positives: 70, total: 100 },
    { probability: 0.9, positives: 95, total: 100 }
  ]);
  assert.equal(fitted.fitted, true);
  assert.ok(fitted.a > 0 && fitted.b > 0);
});

test("nested calibration guard rejects harmful scopes and retains non-degrading scopes", () => {
  const guardPoints = new Map([
    ["bad", [
      { probability: 0.1, positives: 10, total: 100 },
      { probability: 0.2, positives: 20, total: 100 },
      { probability: 0.3, positives: 30, total: 100 }
    ]],
    ["good", [
      { probability: 0.1, positives: 10, total: 100 },
      { probability: 0.2, positives: 20, total: 100 },
      { probability: 0.3, positives: 30, total: 100 }
    ]]
  ]);
  const guarded = guardCalibrationCandidates([
    {
      scope: "species",
      scopeId: "bad",
      taxonIds: ["bad"],
      points: [],
      fit: { a: 10, b: 10, c: 10, fitted: true, iterations: 1 }
    },
    {
      scope: "species",
      scopeId: "good",
      taxonIds: ["good"],
      points: [],
      fit: { a: 1, b: 1, c: 0, fitted: true, iterations: 1 }
    }
  ], guardPoints, {
    maximumRelativeBrierDegradation: 0.01,
    maximumEceDegradation: 0.01
  });
  const bad = guarded.calibrators.find((calibrator) => calibrator.scopeId === "bad");
  const good = guarded.calibrators.find((calibrator) => calibrator.scopeId === "good");
  assert.equal(bad.guard.status, "rejected_by_guard");
  assert.deepEqual(bad.fit, { a: 1, b: 1, c: 0, fitted: false, iterations: 0 });
  assert.equal(good.guard.status, "accepted");
  assert.equal(good.fit.fitted, true);
  assert.equal(guarded.summary.acceptedCount, 1);
  assert.equal(guarded.summary.rejectedCount, 1);
  assert.equal(guarded.summary.identityCount, 1);
});

test("temporal folds recompute recency weights and recent windows without decaying validation", () => {
  const database = new DatabaseSync(":memory:");
  createArtifactSchema(database);
  const productionCutoff = "2026-07-15";
  const millisecondsPerYear = 365.2425 * 86400000;
  const baseWeight = (date) =>
    2 ** (-(Date.parse(`${productionCutoff}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) /
      (millisecondsPerYear * 3));
  const insert = database.prepare(`
    INSERT INTO training_reports
      (report_id, report_kind, observer_hash, observer_known, group_key, report_date,
       report_year, season_week, base_weight, weight, is_recent, province_unit,
       city_unit, district_unit, grid_r6_unit, grid_r7_unit, point_unit)
    VALUES (?, 'normal', ?, 1, ?, ?, ?, ?, ?, ?, ?, 'province:zhejiang', NULL, NULL, NULL, NULL, NULL)
  `);
  const rows = [
    { id: "old-2018", observer: "o-2018", group: "g-2018", date: "2018-12-31", groupSize: 1 },
    { id: "edge-2019", observer: "o-2019", group: "g-2019", date: "2019-01-01", groupSize: 1 },
    { id: "edge-2020", observer: "o-2020", group: "g-2020", date: "2020-01-01", groupSize: 1 },
    { id: "train-a", observer: "o-train", group: "g-train", date: "2023-06-01", groupSize: 2 },
    { id: "train-b", observer: "o-train", group: "g-train", date: "2023-06-01", groupSize: 2 },
    { id: "validation-a", observer: "o-validation", group: "g-validation", date: "2024-06-01", groupSize: 2 },
    { id: "validation-b", observer: "o-validation", group: "g-validation", date: "2024-06-01", groupSize: 2 }
  ];
  for (const row of rows) {
    const base = baseWeight(row.date);
    insert.run(
      row.id,
      row.observer,
      row.group,
      row.date,
      Number(row.date.slice(0, 4)),
      seasonWeek(row.date),
      base,
      base / row.groupSize,
      row.date >= "2021-07-15" ? 1 : 0
    );
  }

  const options = {
    dataCutoffDate: productionCutoff,
    recencyHalfLifeYears: 3,
    localHistoryYears: 5
  };
  const selection2024 = selectTemporalFoldReports(database, 2024, options);
  assert.equal(selection2024.trainingCutoffDate, "2024-01-01");
  assert.equal(selection2024.recentFromDate, "2019-01-01");
  assert.equal(
    database.prepare("SELECT local_recent FROM evaluation_training_reports WHERE report_id='old-2018'").get().local_recent,
    0
  );
  assert.equal(
    database.prepare("SELECT local_recent FROM evaluation_training_reports WHERE report_id='edge-2019'").get().local_recent,
    1
  );
  const validationWeight2024 = Number(
    database.prepare(`
      SELECT SUM(selected.evaluation_weight) AS value
      FROM evaluation_validation_reports selected
      JOIN training_reports reports USING (report_id)
      WHERE reports.group_key = 'g-validation'
    `).get().value
  );
  assert.ok(Math.abs(validationWeight2024 - 1) < 1e-12);
  const foldTrainingWeight = Number(
    database.prepare(`
      SELECT SUM(selected.evaluation_weight) AS value
      FROM evaluation_training_reports selected
      JOIN training_reports reports USING (report_id)
      WHERE reports.group_key = 'g-train'
    `).get().value
  );
  const expectedFoldTrainingWeight =
    2 ** (-(Date.parse("2024-01-01T00:00:00Z") - Date.parse("2023-06-01T00:00:00Z")) /
      (millisecondsPerYear * 3));
  const productionTrainingWeight = Number(
    database.prepare("SELECT SUM(weight) AS value FROM training_reports WHERE group_key='g-train'").get().value
  );
  assert.ok(Math.abs(foldTrainingWeight - expectedFoldTrainingWeight) < 1e-12);
  assert.ok(foldTrainingWeight > productionTrainingWeight);

  selectTemporalFoldReports(database, 2024, { ...options, dataCutoffDate: "2027-07-15" });
  const validationWeightWithDifferentCutoff = Number(
    database.prepare(`
      SELECT SUM(selected.evaluation_weight) AS value
      FROM evaluation_validation_reports selected
      JOIN training_reports reports USING (report_id)
      WHERE reports.group_key = 'g-validation'
    `).get().value
  );
  assert.equal(validationWeightWithDifferentCutoff, validationWeight2024);

  const selection2025 = selectTemporalFoldReports(database, 2025, options);
  assert.equal(selection2025.recentFromDate, "2020-01-01");
  assert.equal(
    database.prepare("SELECT local_recent FROM evaluation_training_reports WHERE report_id='edge-2019'").get().local_recent,
    0
  );
  assert.equal(
    database.prepare("SELECT local_recent FROM evaluation_training_reports WHERE report_id='edge-2020'").get().local_recent,
    1
  );
  database.close();
});

test("CLI summary omits large in-memory OOF details after artifact completion", () => {
  const hugeDetails = Array.from({ length: 10_000 }, (_, index) => ({ index, payload: "x".repeat(100) }));
  const summary = cliResultSummary({
    outputPath: "model.sqlite",
    artifactSha256: "artifact-hash",
    reportPath: "model.sqlite.report.json",
    reportSha256: "report-hash",
    snapshotPath: "snapshot.sqlite",
    snapshotSha256: "snapshot-hash",
    modelVersion: "fixture-v1",
    dataCutoffDate: "2026-07-15",
    releaseEligible: false,
    releaseQuality: {
      failures: ["time.brierSkill"],
      time: { metrics: { brier: 0.1, calibrationScopeBins: hugeDetails } },
      spatial: { metrics: null },
      observer: { metrics: null },
      folds: hugeDetails
    },
    temporal: { calibrators: hugeDetails },
    occurrenceEvents: { candidateTaxa: 66, candidates: hugeDetails },
    forward: { insertedRows: 123 },
    reverse: { insertedRows: 45 },
    validation: { taxonCount: 2 },
    published: null
  });
  const serialized = JSON.stringify(summary);
  assert.ok(serialized.length < 2_000);
  assert.equal(serialized.includes("calibrationScopeBins"), false);
  assert.equal(serialized.includes("payload"), false);
  assert.equal(summary.forwardRows, 123);
  assert.equal(summary.releaseEligible, false);
});

test("release calibration gates use the worst species and shared group instead of pooled ECE", () => {
  const metrics = {
    brierSkill: 0.1,
    ece: 0.01,
    recallAt20Delta: 0,
    reverseNdcgLift: 0.1,
    calibrationEce: {
      species: { scopeCount: 2, maximumEce: 0.06, worstScopeId: "species-bad" },
      group: { scopeCount: 2, maximumEce: 0.09, worstScopeId: "group-ok" }
    }
  };
  const temporal = {
    timeFoldCount: 3,
    calibrationFoldCount: 2,
    validationYears: [2024, 2025, 2026],
    calibrationYears: [2024, 2025],
    finalHoldoutYear: 2026,
    metrics,
    folds: [],
    finalHoldout: { metrics }
  };
  const options = {
    qualityGate: {
      minimumTimeFolds: 3,
      minimumCalibrationFolds: 2,
      requireFinalHoldout: true,
      requireSpatialHoldout: false,
      requireObserverHoldout: false,
      minimumBrierSkill: 0,
      maximumEce: 0.1,
      maximumSpeciesEce: 0.05,
      maximumGroupEce: 0.1,
      minimumRecallAt20Delta: -0.02,
      minimumReverseNdcgLift: 0.05
    }
  };
  const speciesFailure = evaluateReleaseQuality({ temporal, spatial: null, observer: null }, options);
  assert.equal(speciesFailure.passed, false);
  assert.ok(speciesFailure.failures.includes("time.species_calibration.maximumEce"));
  const groupMetrics = JSON.parse(JSON.stringify(metrics));
  groupMetrics.calibrationEce.species.maximumEce = 0.04;
  groupMetrics.calibrationEce.group.maximumEce = 0.11;
  const groupFailure = evaluateReleaseQuality({
    temporal: { ...temporal, metrics: groupMetrics, finalHoldout: { metrics: groupMetrics } },
    spatial: null,
    observer: null
  }, options);
  assert.equal(groupFailure.passed, false);
  assert.ok(groupFailure.failures.includes("time.group_calibration.maximumEce"));
});

test("time, space and observer Brier Skill must each be finite and strictly positive", () => {
  const baseMetrics = {
    brierSkill: 0.01,
    ece: 0.01,
    recallAt20Delta: 0,
    reverseNdcgLift: 0.1,
    calibrationEce: {
      species: { scopeCount: 0, maximumEce: null },
      group: { scopeCount: 0, maximumEce: null }
    }
  };
  const options = {
    qualityGate: {
      minimumTimeFolds: 1,
      minimumCalibrationFolds: 1,
      minimumSpatialFolds: 1,
      minimumObserverFolds: 1,
      requireFinalHoldout: true,
      requireSpatialHoldout: true,
      requireObserverHoldout: true,
      minimumBrierSkill: 0,
      maximumEce: 1,
      maximumSpeciesEce: 1,
      maximumGroupEce: 1,
      minimumRecallAt20Delta: -1,
      minimumReverseNdcgLift: -1
    }
  };
  const makeEvaluation = (metrics) => ({ status: "evaluated", foldCount: 1, metrics, folds: [] });
  const evaluate = (scope, value) => {
    const metrics = { ...baseMetrics, brierSkill: value };
    const temporal = {
      timeFoldCount: 1,
      calibrationFoldCount: 1,
      finalHoldoutYear: 2026,
      metrics: scope === "time" ? metrics : baseMetrics,
      finalHoldout: { metrics: scope === "time" ? metrics : baseMetrics },
      folds: []
    };
    const spatial = makeEvaluation(scope === "spatial" ? metrics : baseMetrics);
    const observer = makeEvaluation(scope === "observer" ? metrics : baseMetrics);
    return evaluateReleaseQuality({ temporal, spatial, observer }, options);
  };
  for (const scope of ["time", "spatial", "observer"]) {
    for (const value of [0, -0.01, Number.NaN]) {
      assert.equal(evaluate(scope, value).passed, false, `${scope}=${value}`);
    }
  }
  assert.equal(evaluate("time", 0.01).passed, true);
});

test("snapshot creation accepts a running crawler and freezes a versioned cutoff", async () => {
  const directory = testDirectory("active-crawl");
  const sourcePath = join(directory, "source.sqlite");
  const snapshotPath = join(directory, "snapshot.sqlite");
  createSourceDatabase(sourcePath, { running: true, reportCount: 3 });
  const result = await createTrainingSnapshot({
    sourcePath,
    snapshotPath,
    stabilityWindowMs: 0,
    requireCompletedCrawl: false,
    allowSourceChangesDuringSnapshot: true
  });
  assert.equal(existsSync(snapshotPath), true);
  assert.equal(existsSync(`${snapshotPath}.sha256`), true);
  assert.equal(existsSync(`${snapshotPath}.manifest.json`), true);
  assert.equal(result.metadata.crawlStateAtStart.running, 1);
  const source = new DatabaseSync(sourcePath);
  source.prepare("UPDATE reports SET point_name='快照之后新增的变化' WHERE report_id='report-0'").run();
  source.close();
  const snapshot = new DatabaseSync(snapshotPath, { readOnly: true });
  assert.equal(snapshot.prepare("SELECT point_name FROM reports WHERE report_id='report-0'").get().point_name, "测试湿地");
  snapshot.close();
});

test("unified contract accepts valid unmarked data and includes clean observations from flagged reports", async () => {
  const directory = testDirectory("snapshot-unified-contract");
  const sourcePath = join(directory, "source.sqlite");
  const snapshotPath = join(directory, "snapshot.sqlite");
  createSourceDatabase(sourcePath, { reportCount: 6, includeSensitive: true, omitSafetyMarker: true });
  const source = new DatabaseSync(sourcePath);
  source.prepare(`
    UPDATE reports
    SET report_kind='flagged', is_flagged_report=1, outside_count=1
    WHERE report_id='report-0'
  `).run();
  source.prepare(`
    DELETE FROM observations
    WHERE report_id='report-0' AND (is_red_species=1 OR source_outside_type=1)
  `).run();
  source.close();
  const snapshotResult = await createTrainingSnapshot({
    sourcePath,
    snapshotPath,
    stabilityWindowMs: 0
  });
  assert.equal(snapshotResult.metadata.sourceContract.sourceGeneration, null);
  const snapshot = new DatabaseSync(snapshotPath, { readOnly: true });
  const quality = inspectSnapshotQuality(snapshot, {
    minimumNormalReports: 1,
    minimumCompleteCoverage: 1,
    minimumCoordinateCoverage: 0,
    minimumDateCoverage: 0,
    coordinateSystemConfirmed: true
  });
  assert.equal(quality.report.normalCount, 5);
  assert.equal(quality.report.eligibleFlaggedCount, 1);
  assert.equal(quality.report.excludedRedCount, 1);
  snapshot.close();
});

test("quality gate rejects incomplete checklists", () => {
  const directory = testDirectory("quality-gate");
  const sourcePath = join(directory, "source.sqlite");
  createSourceDatabase(sourcePath, { incomplete: true, reportCount: 10 });
  const database = new DatabaseSync(sourcePath, { readOnly: true });
  assert.throws(
    () =>
      inspectSnapshotQuality(database, {
        minimumNormalReports: 1,
        minimumCompleteCoverage: 1,
        minimumRefreshCoverage: 0,
        minimumCoordinateCoverage: 0,
        minimumDateCoverage: 0,
        coordinateSystemConfirmed: true
      }),
    (error) => error instanceof PredictionBuildError && error.code === "DATA_QUALITY_GATE_FAILED"
  );
  database.close();
});

test("production thresholds cannot be relaxed and test-only artifacts cannot publish", async () => {
  const directory = testDirectory("test-only-safety");
  const base = {
    sourcePath: join(directory, "missing-source.sqlite"),
    snapshotPath: join(directory, "snapshot.sqlite"),
    outputPath: join(directory, "model.sqlite"),
    coordinateSystemConfirmed: true
  };
  await assert.rejects(
    () => buildPredictionArtifact({ ...base, pointerPath: null, minimumNormalReports: 1 }),
    (error) => error instanceof PredictionBuildError && error.code === "UNSAFE_RELEASE_THRESHOLDS"
  );
  await assert.rejects(
    () => buildPredictionArtifact({
      ...base,
      pointerPath: null,
      qualityGate: { maximumSpeciesEce: 0.06, minimumCalibrationFolds: 1 }
    }),
    (error) => error instanceof PredictionBuildError
      && error.code === "UNSAFE_RELEASE_THRESHOLDS"
      && error.details.failures.includes("qualityGate.maximumSpeciesEce")
      && error.details.failures.includes("qualityGate.minimumCalibrationFolds")
  );
  await assert.rejects(
    () => buildPredictionArtifact({
      ...base,
      testOnly: true,
      pointerPath: join(directory, "current.json"),
      minimumNormalReports: 1
    }),
    (error) => error instanceof PredictionBuildError && error.code === "TEST_ONLY_PUBLICATION_FORBIDDEN"
  );
});

test("PredictionModel rejects an artifact whose quality gate did not pass", () => {
  const directory = testDirectory("runtime-quality-gate");
  const artifactPath = join(directory, "failed.sqlite");
  const database = new DatabaseSync(artifactPath);
  database.exec("CREATE TABLE manifest (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  const insert = database.prepare("INSERT INTO manifest(key, value) VALUES (?, ?)");
  insert.run("schema_version", JSON.stringify("2"));
  insert.run("quality_gate", JSON.stringify({ passed: false, failures: ["time.brierSkill"] }));
  database.close();
  assert.throws(
    () => new PredictionModel({ databasePath: artifactPath }),
    (error) => error instanceof PredictionError && error.code === "MODEL_UNAVAILABLE"
  );

  const internalPath = join(directory, "internal-building.sqlite");
  const internal = new DatabaseSync(internalPath);
  internal.exec("CREATE TABLE manifest (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  const insertInternal = internal.prepare("INSERT INTO manifest(key, value) VALUES (?, ?)");
  insertInternal.run("schema_version", JSON.stringify("2"));
  insertInternal.run("quality_gate", JSON.stringify({ passed: true, internalBuild: true }));
  internal.close();
  assert.throws(
    () => new PredictionModel({ databasePath: internalPath }),
    (error) => error instanceof PredictionError && error.code === "MODEL_UNAVAILABLE"
  );
});

test("model pointer switches atomically and a failed publication preserves the old pointer", async () => {
  const directory = testDirectory("pointer");
  const pointerPath = join(directory, "prediction", "current.json");
  const outputPath = join(directory, "models", "model.sqlite");
  mkdirSync(join(directory, "prediction"), { recursive: true });
  mkdirSync(join(directory, "models"), { recursive: true });
  const artifact = new DatabaseSync(outputPath);
  artifact.exec("CREATE TABLE manifest (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  const insertManifest = artifact.prepare("INSERT INTO manifest(key, value) VALUES (?, ?)");
  insertManifest.run("schema_version", JSON.stringify("2"));
  insertManifest.run("model_version", JSON.stringify("fixture-v1"));
  insertManifest.run("quality_gate", JSON.stringify({ passed: true, failures: [] }));
  insertManifest.run("test_only", JSON.stringify(false));
  artifact.close();
  writeFileSync(pointerPath, '{"schemaVersion":1,"database":"old.sqlite"}\n', "utf8");
  const published = publishModelPointer(pointerPath, outputPath, {
    modelVersion: "fixture-v1",
    artifactSha256: createHash("sha256").update(readFileSync(outputPath)).digest("hex")
  });
  assert.equal(published.pointer.database, "../models/model.sqlite");
  assert.equal(JSON.parse(readFileSync(pointerPath, "utf8")).modelVersion, "fixture-v1");
  const sensitivePath = join(directory, "models", "sensitive.bbsp");
  writeFileSync(sensitivePath, "encrypted-sensitive-fixture", "utf8");
  publishModelPointer(pointerPath, outputPath, {
    modelVersion: "fixture-v1",
    artifactSha256: createHash("sha256").update(readFileSync(outputPath)).digest("hex"),
    sensitiveArtifactPath: sensitivePath,
    sensitiveSha256: createHash("sha256").update(readFileSync(sensitivePath)).digest("hex")
  });
  const stableContents = readFileSync(pointerPath, "utf8");
  assert.throws(
    () => publishModelPointer(pointerPath, outputPath, {
      modelVersion: "fixture-v2",
      artifactSha256: createHash("sha256").update(readFileSync(outputPath)).digest("hex")
    }),
    (error) => error instanceof PredictionBuildError && error.code === "POINTER_UPDATE_FAILED"
  );
  assert.equal(readFileSync(pointerPath, "utf8"), stableContents);
  assert.throws(
    () => publishModelPointer(pointerPath, join(directory, "missing-parent", "model.sqlite"), {
      modelVersion: "should-not-publish"
    }),
    (error) => error instanceof PredictionBuildError && error.code === "POINTER_UPDATE_FAILED"
  );
  assert.equal(readFileSync(pointerPath, "utf8"), stableContents);
});

test("end-to-end safe public artifact supports location and species queries", async () => {
  const directory = testDirectory("end-to-end");
  const sourcePath = join(directory, "source.sqlite");
  const snapshotPath = join(directory, "snapshot.sqlite");
  const outputPath = join(directory, "model.sqlite");
  createSourceDatabase(sourcePath, { reportCount: 96, yearSpan: 4, staleRunning: true });
  const result = await buildPredictionArtifact({
    sourcePath,
    snapshotPath,
    outputPath,
    pointerPath: null,
    testOnly: true,
    stabilityWindowMs: 0,
    minimumNormalReports: 1,
    minimumCompleteCoverage: 1,
    minimumRefreshCoverage: 1,
    minimumCoordinateCoverage: 1,
    minimumDateCoverage: 1,
    coordinateSystemConfirmed: true,
    sensitiveTaxonIds: new Set(["999"]),
    forwardTopK: 10,
    reverseTopK: 20,
    qualityGate: {
      minimumTimeFolds: 0,
      requireSpatialHoldout: false,
      requireObserverHoldout: false,
      minimumBrierSkill: -1e9,
      maximumEce: 1,
      maximumSpeciesEce: 1,
      maximumGroupEce: 1,
      minimumRecallAt20Delta: -1,
      minimumReverseNdcgLift: -1
    },
    holdoutEvaluation: {
      minimumTaxonPositives: 1
    },
    unitThresholds: {
      province: { checklists: 1, observers: 1 },
      city: { checklists: 1, observers: 1 },
      district: { checklists: 1, observers: 1 },
      grid_r6: { checklists: 1, observers: 1 },
      grid_r7: { checklists: 1, observers: 1 },
      point: { checklists: 1, observers: 1 }
    }
  });
  assert.equal(result.validation.taxonCount, 2);
  assert.equal(result.quality.excludedInvalidDetections, 0);
  assert.ok(result.temporal.timeFoldCount >= 3);
  assert.ok(result.temporal.calibrationFoldCount >= 2);
  assert.ok(result.temporal.folds.some((fold) => fold.role === "calibration_oof"));
  assert.equal(result.temporal.folds.at(-1).role, "final_holdout");
  assert.ok(
    result.temporal.calibrationYears.every((year) => year < result.temporal.finalHoldoutYear),
    "calibration years must precede the final temporal holdout"
  );
  assert.equal(typeof result.releaseEligible, "boolean");
  assert.equal(result.published, null);
  const artifact = new DatabaseSync(outputPath, { readOnly: true });
  assert.equal(artifact.prepare("SELECT COUNT(*) AS count FROM taxa WHERE taxon_id = '999'").get().count, 0);
  assert.equal(artifact.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
  for (const privateTable of [
    "training_reports",
    "training_detections",
    "training_taxon_event_summary",
    "occurrence_events"
  ]) {
    assert.equal(
      artifact.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name=?").get(privateTable).count,
      0,
      `${privateTable} must not survive in the public model artifact`
    );
  }
  assert.equal(
    JSON.parse(
      artifact.prepare("SELECT value FROM manifest WHERE key='release_evaluation_occurrence_policy'").get().value
    ),
    "raw_detections_all_taxa_without_full_data_event_filter"
  );
  assert.equal(
    JSON.parse(
      artifact.prepare("SELECT value FROM manifest WHERE key='temporal_evaluation_weighting_policy'").get().value
    ),
    "fold_cutoff_half_life_training_and_group_capped_unweighted_validation"
  );
  assert.equal(
    JSON.parse(
      artifact.prepare("SELECT value FROM manifest WHERE key='coordinate_qc_evaluation_scope'").get().value
    ),
    "fixed_snapshot_coordinate_qc_target_independent_not_refit_per_fold"
  );
  const priorMatrix = JSON.parse(
    artifact.prepare("SELECT value FROM manifest WHERE key='prior_strengths_by_prevalence'").get().value
  );
  for (const level of ["city", "district", "grid_r6", "grid_r7", "point"]) {
    assert.ok(Number(priorMatrix[level].group_30_79) > 0);
    assert.ok(Number(priorMatrix[level].species_200_plus) > 0);
  }
  assert.equal(result.temporal.priorTuning.diagnostics.length, 20);
  assert.ok(result.temporal.priorTuning.tuningYears.every((year) => year < result.temporal.finalHoldoutYear));
  assert.ok(
    result.temporal.priorTuning.diagnostics
      .filter((entry) => entry.prevalenceGroup === "rare_under_30")
      .some((entry) => entry.candidates.some((candidate) => candidate.evaluatedWeight > 0))
  );
  const calibrationTraining = JSON.parse(
    artifact.prepare("SELECT value FROM manifest WHERE key='calibration_training'").get().value
  );
  assert.ok([
    "all_years_rolling_oof_after_release_gate",
    "pre_final_oof_for_unreleased_artifact"
  ].includes(calibrationTraining.strategy));
  artifact.close();

  assert.throws(
    () => publishModelPointer(join(directory, "forbidden-current.json"), outputPath, {
      modelVersion: result.modelVersion,
      artifactSha256: result.artifactSha256,
      sourceSnapshotSha256: result.snapshotSha256
    }),
    (error) => error instanceof PredictionBuildError && error.code === "POINTER_UPDATE_FAILED"
  );
  assert.throws(
    () => new PredictionModel({ databasePath: outputPath }),
    (error) => error instanceof PredictionError && error.code === "MODEL_UNAVAILABLE"
  );
  const model = new PredictionModel({ databasePath: outputPath, testOnly: true });
  const meta = model.meta();
  assert.equal(meta.modelVersion, result.modelVersion);
  const byLocation = model.byLocation({ date: "2026-06-15", pointId: "point-1", limit: 10, role: "user" });
  assert.ok(byLocation.results.some((row) => row.taxonId === "100"));
  assert.ok(byLocation.results[0].support.effectiveChecklists > 0);
  assert.equal(byLocation.results[0].sensitive, false);
  assert.throws(
    () => model.byLocation({ date: "2026-06-15" }),
    (error) => error instanceof PredictionError && error.code === "INVALID_REQUEST"
  );
  const bySpecies = model.bySpecies({
    taxonId: "200",
    region: { level: "city", code: "杭州市" },
    limit: 10,
    role: "admin"
  });
  assert.ok(bySpecies.hotspots.length > 0);
  assert.equal(bySpecies.hotspots[0].region.level, "city");
  assert.match(bySpecies.hotspots[0].timeWindow.startDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.throws(
    () => model.bySpecies({ taxonId: "missing" }),
    (error) => error instanceof PredictionError && error.code === "UNKNOWN_TAXON"
  );
  model.close();
});

test("materialized predictions expose the actual fallback unit and reverse hotspots never promote parent scores to child H3 cells", async () => {
  const directory = testDirectory("resolved-fallback-unit");
  const sourcePath = join(directory, "source.sqlite");
  const outputPath = join(directory, "model.sqlite");
  createSourceDatabase(sourcePath, { reportCount: 144, yearSpan: 4, observerModulo: 144 });
  const source = new DatabaseSync(sourcePath);
  source.exec(`
    UPDATE reports
    SET point_id = CASE WHEN CAST(substr(start_time, 6, 2) AS INTEGER) <= 2 THEN 'winter-point' ELSE 'summer-point' END,
        point_name = CASE WHEN CAST(substr(start_time, 6, 2) AS INTEGER) <= 2 THEN 'Winter point' ELSE 'Summer point' END,
        longitude = CASE WHEN CAST(substr(start_time, 6, 2) AS INTEGER) <= 2 THEN 120.13 ELSE 120.15 END,
        latitude = 30.27;
    UPDATE reports
    SET raw_report_json = '{}'
    WHERE CAST(substr(report_id, 8) AS INTEGER) < 24;
  `);
  source.close();
  await buildPredictionArtifact({
    sourcePath,
    snapshotPath: join(directory, "snapshot.sqlite"),
    outputPath,
    testOnly: true,
    stabilityWindowMs: 0,
    minimumNormalReports: 1,
    minimumCompleteCoverage: 1,
    minimumRefreshCoverage: 1,
    minimumCoordinateCoverage: 1,
    minimumDateCoverage: 1,
    coordinateSystemConfirmed: true,
    sensitiveTaxonIds: new Set(),
    forwardTopK: 20,
    reverseTopK: 100,
    qualityGate: {
      minimumTimeFolds: 0,
      requireSpatialHoldout: false,
      requireObserverHoldout: false,
      minimumBrierSkill: -1e9,
      maximumEce: 1,
      maximumSpeciesEce: 1,
      maximumGroupEce: 1,
      minimumRecallAt20Delta: -1,
      minimumReverseNdcgLift: -1e9
    },
    holdoutEvaluation: { minimumTaxonPositives: 1 },
    unitThresholds: {
      province: { checklists: 1, observers: 1 },
      city: { checklists: 1, observers: 1 },
      district: { checklists: 1, observers: 1 },
      grid_r6: { checklists: 1, observers: 1 },
      grid_r7: { checklists: 1, observers: 1 },
      point: { checklists: 1, observers: 1 }
    }
  });

  const artifact = new DatabaseSync(outputPath, { readOnly: true });
  const publicTaxon = artifact.prepare("SELECT positive_count, calibration_scope FROM taxa WHERE taxon_id='100'").get();
  assert.equal(publicTaxon.positive_count, 144);
  assert.equal(publicTaxon.calibration_scope, "group:positive_60_119");
  assert.equal(
    artifact.prepare("SELECT COUNT(*) AS count FROM calibration_parameters WHERE scope='group' AND scope_id='positive_60_119'").get().count,
    1
  );
  const requested = artifact
    .prepare("SELECT space_unit_id FROM location_lookup WHERE lookup_type='point_id' AND lookup_key='winter-point'")
    .get().space_unit_id;
  const winterR7 = artifact.prepare("SELECT parent_id FROM space_units WHERE id = ?").get(requested).parent_id;
  const summerWeek = seasonWeek("2026-06-15");
  const pointPrediction = artifact
    .prepare(
      `SELECT predictions.space_unit_id, predictions.resolved_space_unit_id, resolved.level
       FROM location_predictions predictions
       JOIN space_units resolved ON resolved.id = predictions.resolved_space_unit_id
       WHERE predictions.space_unit_id = ? AND predictions.season_bucket = ? AND predictions.taxon_id = '100'`
    )
    .get(requested, summerWeek);
  assert.equal(pointPrediction.space_unit_id, requested);
  assert.notEqual(pointPrediction.resolved_space_unit_id, requested);
  assert.equal(pointPrediction.level, "grid_r6");

  const r7Prediction = artifact
    .prepare(
      `SELECT resolved_space_unit_id FROM location_predictions
       WHERE space_unit_id = ? AND season_bucket = ? AND taxon_id = '100'`
    )
    .get(winterR7, summerWeek);
  assert.notEqual(r7Prediction.resolved_space_unit_id, winterR7);
  const fakeSummerHotspots = artifact
    .prepare(
      `SELECT season_start_day, season_end_day FROM reverse_hotspots
       WHERE taxon_id = '100' AND space_unit_id = ?`
    )
    .all(winterR7)
    .filter((row) => row.season_start_day <= row.season_end_day
      ? 166 >= row.season_start_day && 166 <= row.season_end_day
      : 166 >= row.season_start_day || 166 <= row.season_end_day);
  assert.deepEqual(fakeSummerHotspots, []);
  const mergedHotspot = artifact
    .prepare(
      `SELECT member_space_unit_ids_json, hotspot_boundary_json
       FROM reverse_hotspots WHERE taxon_id='100'`
    )
    .all()
    .find((row) => JSON.parse(row.member_space_unit_ids_json).length > 1);
  assert.ok(mergedHotspot, "adjacent H3 cells with touching seasonal windows must form one hotspot component");
  assert.ok(JSON.parse(mergedHotspot.hotspot_boundary_json).length >= 4);
  artifact.close();

  assert.throws(
    () => new PredictionModel({ databasePath: outputPath, testOnly: true }),
    (error) => error instanceof PredictionError && error.code === "MODEL_UNAVAILABLE"
  );
});

test("spatial H3 r6 buffers and observer groups produce leakage-free holdout folds", async () => {
  const directory = testDirectory("holdout-folds");
  const sourcePath = join(directory, "source.sqlite");
  const outputPath = join(directory, "model.sqlite");
  createSourceDatabase(sourcePath, { reportCount: 240, yearSpan: 4, multiGrid: true, observerModulo: 120 });
  const result = await buildPredictionArtifact({
    sourcePath,
    snapshotPath: join(directory, "snapshot.sqlite"),
    outputPath,
    testOnly: true,
    stabilityWindowMs: 0,
    minimumNormalReports: 1,
    minimumCompleteCoverage: 1,
    minimumRefreshCoverage: 1,
    minimumCoordinateCoverage: 1,
    minimumDateCoverage: 1,
    coordinateSystemConfirmed: true,
    sensitiveTaxonIds: new Set(),
    forwardTopK: 10,
    reverseTopK: 20,
    qualityGate: {
      minimumTimeFolds: 0,
      minimumSpatialFolds: 3,
      minimumObserverFolds: 3,
      requireSpatialHoldout: true,
      requireObserverHoldout: true,
      minimumBrierSkill: -1e9,
      maximumEce: 1,
      maximumSpeciesEce: 1,
      maximumGroupEce: 1,
      minimumRecallAt20Delta: -1,
      minimumReverseNdcgLift: -1e9
    },
    holdoutEvaluation: {
      spatialMaximumFolds: 4,
      spatialMinimumChecklists: 10,
      spatialMinimumObservers: 5,
      observerFoldCount: 3,
      minimumTaxonPositives: 10
    },
    unitThresholds: {
      province: { checklists: 1, observers: 1 },
      city: { checklists: 1, observers: 1 },
      district: { checklists: 1, observers: 1 },
      grid_r6: { checklists: 1, observers: 1 },
      grid_r7: { checklists: 1, observers: 1 },
      point: { checklists: 1, observers: 1 }
    }
  });
  assert.equal(result.releaseEligible, false, "负或零 Brier Skill 必须触发 no-go");
  assert.ok(result.releaseQuality.failures.some((failure) => failure.endsWith("brierSkill")));
  assert.ok(result.quality.observerIdCoverage >= 0 && result.quality.observerIdCoverage <= 1);
  assert.equal(result.releaseQuality.time.foldCount, 3);
  assert.equal(result.releaseQuality.time.calibrationFoldCount, 2);
  assert.deepEqual(result.releaseQuality.time.validationYears, [2024, 2025, 2026]);
  assert.deepEqual(result.releaseQuality.time.calibrationYears, [2024, 2025]);
  assert.equal(result.releaseQuality.time.finalHoldoutYear, 2026);
  assert.equal(result.releaseQuality.time.calibrationYears.includes(result.releaseQuality.time.finalHoldoutYear), false);
  for (const fold of result.releaseQuality.time.folds) {
    assert.equal(fold.trainingThroughYear, fold.validationYear - 1);
  }
  assert.equal(result.releaseQuality.time.folds[0].role, "calibration_oof");
  assert.equal(result.releaseQuality.time.folds[0].includedInCalibrationFit, true);
  assert.equal(result.releaseQuality.time.finalHoldout.role, "final_holdout");
  assert.equal(result.releaseQuality.time.finalHoldout.includedInBandwidthTuning, false);
  assert.equal(result.releaseQuality.time.finalHoldout.includedInCalibrationFit, false);
  assert.equal(result.temporal.evaluationModel, "hierarchical_spatiotemporal_oof");
  assert.equal(result.temporal.baselineModel, "province_week");
  for (const fold of result.releaseQuality.time.folds) {
    assert.equal(fold.metrics.evaluationModel, "hierarchical_spatiotemporal_oof");
    assert.equal(fold.metrics.baselineModel, "province_week");
    assert.ok(Number.isFinite(fold.metrics.reverseNdcgAt10));
    assert.ok(Number.isFinite(fold.metrics.baselineReverseNdcgAt10));
    assert.ok(
      Object.entries(fold.metrics.fallbackLevels || {}).some(
        ([level, count]) => level !== "province" && Number(count) > 0
      )
    );
  }
  assert.equal(result.releaseQuality.spatial.status, "evaluated");
  assert.ok(result.releaseQuality.spatial.foldCount >= 3);
  assert.ok(Number.isFinite(result.releaseQuality.spatial.rawMetrics.brier));
  assert.ok(Object.values(result.releaseQuality.spatial.metrics.fallbackLevels).some((count) => Number(count) > 0));
  for (const fold of result.releaseQuality.spatial.folds) {
    assert.equal(fold.diagnostics.reportOverlap, 0);
    assert.equal(fold.diagnostics.bufferLeakage, 0);
    assert.ok(fold.excludedR6Units.includes(fold.foldId));
    assert.equal(fold.nestedCalibration.strategy, "nested_hierarchical_spatiotemporal_oof_within_outer_training");
    assert.equal(fold.nestedCalibration.calibrationScoreModel, "hierarchical_spatiotemporal_oof");
    assert.equal(fold.nestedCalibration.calibrationContextSampleModulo, 10);
    assert.ok(Object.values(fold.nestedCalibration.calibrationFallbackLevels).some((count) => Number(count) > 0));
    assert.ok(fold.nestedCalibration.calibrationGuard.candidateCount >= 1);
    assert.ok(Number.isFinite(fold.rawMetrics.brier));
    assert.equal(fold.rawMetrics.evaluationModel, "hierarchical_spatiotemporal_oof");
    assert.ok(fold.nestedCalibration.foldCount >= 1);
    assert.ok(Number(fold.nestedCalibration.bandwidthDays) > 0);
    assert.ok(fold.nestedCalibration.hyperparameterSelectionYears.length >= 1);
    assert.ok(Number(fold.nestedCalibration.priorStrengthsByPrevalence.grid_r7.group_30_79) > 0);
    assert.equal(fold.nestedCalibration.priorTuning.contextSampleModulo, 20);
  }
  assert.equal(result.releaseQuality.observer.status, "evaluated");
  assert.equal(result.releaseQuality.observer.foldCount, 3);
  assert.ok(Number.isFinite(result.releaseQuality.observer.rawMetrics.brier));
  assert.ok(Object.values(result.releaseQuality.observer.metrics.fallbackLevels).some((count) => Number(count) > 0));
  for (const fold of result.releaseQuality.observer.folds) {
    assert.equal(fold.diagnostics.reportOverlap, 0);
    assert.equal(fold.diagnostics.observerOverlap, 0);
    assert.equal(fold.nestedCalibration.strategy, "nested_hierarchical_spatiotemporal_oof_within_outer_training");
    assert.equal(fold.nestedCalibration.calibrationScoreModel, "hierarchical_spatiotemporal_oof");
    assert.equal(fold.nestedCalibration.calibrationContextSampleModulo, 10);
    assert.ok(Object.values(fold.nestedCalibration.calibrationFallbackLevels).some((count) => Number(count) > 0));
    assert.ok(fold.nestedCalibration.calibrationGuard.candidateCount >= 1);
    assert.ok(Number.isFinite(fold.rawMetrics.brier));
    assert.equal(fold.rawMetrics.evaluationModel, "hierarchical_spatiotemporal_oof");
    assert.ok(fold.nestedCalibration.foldCount >= 1);
    assert.ok(Number(fold.nestedCalibration.bandwidthDays) > 0);
    assert.ok(fold.nestedCalibration.hyperparameterSelectionYears.length >= 1);
    assert.ok(Number(fold.nestedCalibration.priorStrengthsByPrevalence.grid_r7.group_30_79) > 0);
    assert.equal(fold.nestedCalibration.priorTuning.contextSampleModulo, 20);
  }
  const artifact = new DatabaseSync(outputPath, { readOnly: true });
  const district = artifact.prepare("SELECT * FROM space_units WHERE level='district' AND supported=1 LIMIT 1").get();
  let unseen = null;
  for (let x = 1; x < 10 && !unseen; x += 1) {
    for (let y = 1; y < 10 && !unseen; y += 1) {
      const longitude = district.min_longitude + (district.max_longitude - district.min_longitude) * (x / 10);
      const latitude = district.min_latitude + (district.max_latitude - district.min_latitude) * (y / 10);
      if (!isWithinZhejiang(longitude, latitude)) continue;
      const r6 = gridCell(longitude, latitude, "grid_r6");
      const r7 = gridCell(longitude, latitude, "grid_r7");
      const exists = artifact.prepare("SELECT COUNT(*) AS count FROM space_units WHERE id IN (?, ?)").get(r6.id, r7.id).count;
      if (!exists) unseen = { longitude, latitude };
    }
  }
  assert.ok(unseen, "fixture must contain an unseen H3 cell inside district coverage");
  artifact.close();
  assert.throws(
    () => new PredictionModel({ databasePath: outputPath, testOnly: true }),
    (error) => error instanceof PredictionError && error.code === "MODEL_UNAVAILABLE"
  );
});

test("an unavailable required spatial holdout blocks pointer publication", async () => {
  const directory = testDirectory("holdout-blocks-pointer");
  const sourcePath = join(directory, "source.sqlite");
  const snapshotPath = join(directory, "snapshot.sqlite");
  const outputPath = join(directory, "model.sqlite");
  const pointerPath = join(directory, "prediction", "current.json");
  createSourceDatabase(sourcePath, { reportCount: 72 });
  mkdirSync(join(directory, "prediction"), { recursive: true });
  writeFileSync(pointerPath, '{"schemaVersion":1,"database":"old.sqlite"}\n', "utf8");
  const previousPointer = readFileSync(pointerPath, "utf8");
  const result = await buildPredictionArtifact({
    sourcePath,
    snapshotPath,
    outputPath,
    pointerPath: null,
    testOnly: true,
    stabilityWindowMs: 0,
    minimumNormalReports: 1,
    minimumCompleteCoverage: 1,
    minimumRefreshCoverage: 1,
    minimumCoordinateCoverage: 1,
    minimumDateCoverage: 1,
    coordinateSystemConfirmed: true,
    sensitiveTaxonIds: new Set(),
    qualityGate: {
      minimumTimeFolds: 0,
      minimumSpatialFolds: 1,
      requireSpatialHoldout: true,
      requireObserverHoldout: false,
      minimumBrierSkill: -1e9,
      maximumEce: 1,
      maximumSpeciesEce: 1,
      maximumGroupEce: 1,
      minimumRecallAt20Delta: -1,
      minimumReverseNdcgLift: -1e9
    },
    holdoutEvaluation: {
      spatialMaximumFolds: 1,
      spatialMinimumChecklists: 1,
      spatialMinimumObservers: 1,
      minimumTaxonPositives: 1
    },
    unitThresholds: {
      province: { checklists: 1, observers: 1 },
      city: { checklists: 1, observers: 1 },
      district: { checklists: 1, observers: 1 },
      grid_r6: { checklists: 1, observers: 1 },
      grid_r7: { checklists: 1, observers: 1 },
      point: { checklists: 1, observers: 1 }
    }
  });
  assert.equal(result.releaseEligible, false);
  assert.equal(result.published, null);
  assert.ok(result.releaseQuality.failures.includes("spatial.fold_count"));
  assert.equal(readFileSync(pointerPath, "utf8"), previousPointer);
});

test("fewer than two calibration folds plus a final holdout blocks publication", async () => {
  const directory = testDirectory("temporal-folds-block-pointer");
  const sourcePath = join(directory, "source.sqlite");
  const pointerPath = join(directory, "prediction", "current.json");
  createSourceDatabase(sourcePath, { reportCount: 120, yearSpan: 2, observerModulo: 120 });
  mkdirSync(join(directory, "prediction"), { recursive: true });
  writeFileSync(pointerPath, '{"schemaVersion":1,"database":"old.sqlite"}\n', "utf8");
  const previousPointer = readFileSync(pointerPath, "utf8");
  const result = await buildPredictionArtifact({
    sourcePath,
    snapshotPath: join(directory, "snapshot.sqlite"),
    outputPath: join(directory, "model.sqlite"),
    pointerPath: null,
    testOnly: true,
    stabilityWindowMs: 0,
    minimumNormalReports: 1,
    minimumCompleteCoverage: 1,
    minimumRefreshCoverage: 1,
    minimumCoordinateCoverage: 1,
    minimumDateCoverage: 1,
    coordinateSystemConfirmed: true,
    sensitiveTaxonIds: new Set(),
    qualityGate: {
      requireSpatialHoldout: false,
      requireObserverHoldout: false,
      minimumBrierSkill: -1e9,
      maximumEce: 1,
      maximumSpeciesEce: 1,
      maximumGroupEce: 1,
      minimumRecallAt20Delta: -1,
      minimumReverseNdcgLift: -1e9
    },
    unitThresholds: {
      province: { checklists: 1, observers: 1 },
      city: { checklists: 1, observers: 1 },
      district: { checklists: 1, observers: 1 },
      grid_r6: { checklists: 1, observers: 1 },
      grid_r7: { checklists: 1, observers: 1 },
      point: { checklists: 1, observers: 1 }
    }
  });
  assert.equal(result.releaseQuality.thresholds.minimumTimeFolds, 3);
  assert.equal(result.releaseQuality.thresholds.minimumCalibrationFolds, 2);
  assert.equal(result.releaseQuality.time.foldCount, 1);
  assert.equal(result.releaseQuality.time.calibrationFoldCount, 0);
  assert.deepEqual(result.releaseQuality.time.validationYears, [2024]);
  assert.ok(result.releaseQuality.failures.includes("time.fold_count"));
  assert.ok(result.releaseQuality.failures.includes("time.calibration_fold_count"));
  assert.equal(result.releaseEligible, false);
  assert.equal(result.published, null);
  assert.equal(readFileSync(pointerPath, "utf8"), previousPointer);
});
