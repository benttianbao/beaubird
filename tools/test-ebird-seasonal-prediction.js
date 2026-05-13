const assert = require("assert");
const fs = require("fs");
const path = require("path");

const {
  aggregateEbirdSeasonalPrediction,
  buildEbirdSeasonalDateRequests,
  getEbirdSeasonalHistoricalYears
} = require("../ebird-seasonal-core.js");

const repoRoot = path.resolve(__dirname, "..");
const scriptSource = fs.readFileSync(path.join(repoRoot, "script.js"), "utf8");
const indexSource = fs.readFileSync(path.join(repoRoot, "index.html"), "utf8");
const readmeSource = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");

assert.match(
  scriptSource,
  /const EBIRD_SEASONAL_REGION_CODE = "CN-33";/,
  "uses the eBird Zhejiang subnational region code"
);

assert.ok(
  indexSource.includes("固定分析 <code>CN-33</code>") && !indexSource.includes("固定分析 <code>CN-ZJ</code>"),
  "documents the fixed Zhejiang eBird region code in the UI"
);

assert.ok(
  readmeSource.includes("`CN-33`") && !readmeSource.includes("`CN-ZJ`"),
  "documents the fixed Zhejiang eBird region code in README"
);

assert.match(
  scriptSource,
  /if \(observations\.length\) \{[\s\S]*?setCachedEbirdSeasonalDay\(cache, request\.date, observations\);[\s\S]*?\}/,
  "does not cache empty seasonal history responses"
);

assert.ok(
  scriptSource.includes("nonEmptyDays") && scriptSource.includes("historicalObservationCount"),
  "tracks successful days separately from days with historical observations"
);

assert.deepStrictEqual(
  getEbirdSeasonalHistoricalYears("2026-05-07", 10),
  [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
  "uses the last 10 complete years before the target year"
);

assert.deepStrictEqual(
  buildEbirdSeasonalDateRequests("2026-05-07", 2, 1).map((entry) => `${entry.anchorYear}:${entry.date}`),
  [
    "2024:2024-05-06",
    "2024:2024-05-07",
    "2024:2024-05-08",
    "2025:2025-05-06",
    "2025:2025-05-07",
    "2025:2025-05-08"
  ],
  "builds same month-day windows for each historical anchor year"
);

assert.deepStrictEqual(
  buildEbirdSeasonalDateRequests("2026-01-02", 1, 3).map((entry) => `${entry.anchorYear}:${entry.date}`),
  [
    "2025:2024-12-30",
    "2025:2024-12-31",
    "2025:2025-01-01",
    "2025:2025-01-02",
    "2025:2025-01-03",
    "2025:2025-01-04",
    "2025:2025-01-05"
  ],
  "keeps cross-year dates attached to their historical anchor year"
);

assert.deepStrictEqual(
  buildEbirdSeasonalDateRequests("2024-02-29", 2, 1),
  [],
  "skips non-leap historical years when the target date is Feb 29"
);

const prediction = aggregateEbirdSeasonalPrediction({
  dailyEntries: [
    {
      anchorYear: 2024,
      date: "2024-05-06",
      observations: [{ speciesCode: "fairpi1", comName: "仙八色鸫", sciName: "Pitta nympha" }]
    },
    {
      anchorYear: 2024,
      date: "2024-05-07",
      observations: [{ speciesCode: "fairpi1", comName: "仙八色鸫", sciName: "Pitta nympha" }]
    },
    {
      anchorYear: 2025,
      date: "2025-05-07",
      observations: [
        { speciesCode: "fairpi1", comName: "仙八色鸫", sciName: "Pitta nympha" },
        { speciesCode: "lowbir1", comName: "偶见鸟", sciName: "Lowus birdus" }
      ]
    }
  ],
  recentObservations: [
    {
      speciesCode: "fairpi1",
      comName: "仙八色鸫",
      sciName: "Pitta nympha",
      obsDt: "2026-05-06 08:11",
      locName: "杭州植物园"
    }
  ],
  taxonomyMap: new Map([
    ["fairpi1", { commonName: "仙八色鸫", sciName: "Pitta nympha", taxonOrder: 1200 }],
    ["lowbir1", { commonName: "偶见鸟", sciName: "Lowus birdus", taxonOrder: 1300 }]
  ]),
  historicalYearCount: 2,
  totalHistoricalDays: 6
});

assert.strictEqual(prediction.length, 2, "returns species seen in the historical window");
assert.strictEqual(prediction[0].speciesCode, "fairpi1", "sorts the strongest candidate first");
assert.strictEqual(prediction[0].probabilityLevel, "高概率", "assigns high probability to repeated historical and recent species");
assert.strictEqual(prediction[0].yearsSeen, 2, "counts distinct historical anchor years");
assert.strictEqual(prediction[0].hitDays, 3, "counts distinct historical hit dates");
assert.strictEqual(prediction[0].recentConfirmed, true, "marks species confirmed by recent observations");
assert.strictEqual(prediction[0].recentLocation, "杭州植物园", "keeps recent evidence location");
assert.strictEqual(prediction[1].probabilityLevel, "中概率", "uses the fixed score thresholds");

const lowProbability = aggregateEbirdSeasonalPrediction({
  dailyEntries: [
    {
      anchorYear: 2025,
      date: "2025-05-07",
      observations: [{ speciesCode: "rare1", comName: "低频鸟" }]
    }
  ],
  recentObservations: [],
  taxonomyMap: new Map(),
  historicalYearCount: 10,
  totalHistoricalDays: 150
});

assert.strictEqual(lowProbability[0].probabilityLevel, "低概率", "keeps single-year historical species as low probability");

const emptySuccessfulHistory = aggregateEbirdSeasonalPrediction({
  dailyEntries: Array.from({ length: 29 }, (_, index) => ({
    anchorYear: 2025,
    date: `2025-05-${String(index + 1).padStart(2, "0")}`,
    observations: []
  })),
  recentObservations: [],
  taxonomyMap: new Map(),
  historicalYearCount: 1,
  totalHistoricalDays: 29
});

assert.strictEqual(
  emptySuccessfulHistory.length,
  0,
  "empty successful history days produce no candidates, so callers must surface the empty-data signal"
);

console.log("eBird seasonal prediction contract OK");
