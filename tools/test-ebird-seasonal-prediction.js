const assert = require("assert");

const {
  aggregateEbirdSeasonalPrediction,
  buildEbirdSeasonalDateRequests,
  getEbirdSeasonalHistoricalYears
} = require("../ebird-seasonal-core.js");

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

console.log("eBird seasonal prediction contract OK");
