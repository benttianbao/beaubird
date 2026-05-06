(function initEbirdSeasonalCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.EBIRD_SEASONAL_CORE = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function createEbirdSeasonalCore() {
  function parseIsoDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      throw new Error("Expected date in YYYY-MM-DD format.");
    }

    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3])
    };
  }

  function isValidDateParts(year, month, day) {
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }

  function formatIsoDate(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function addDays(date, amount) {
    const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    copy.setDate(copy.getDate() + amount);
    return copy;
  }

  function getEbirdSeasonalHistoricalYears(targetDate, historicalYearCount) {
    const { year } = parseIsoDate(targetDate);
    const count = Math.max(0, Math.floor(Number(historicalYearCount) || 0));
    const startYear = year - count;
    const years = [];

    for (let currentYear = startYear; currentYear < year; currentYear += 1) {
      years.push(currentYear);
    }

    return years;
  }

  function buildEbirdSeasonalDateRequests(targetDate, historicalYearCount, windowRadiusDays) {
    const { month, day } = parseIsoDate(targetDate);
    const radius = Math.max(0, Math.floor(Number(windowRadiusDays) || 0));

    return getEbirdSeasonalHistoricalYears(targetDate, historicalYearCount).flatMap((anchorYear) => {
      if (!isValidDateParts(anchorYear, month, day)) {
        return [];
      }

      const anchorDate = new Date(anchorYear, month - 1, day);
      const dates = [];
      for (let offset = -radius; offset <= radius; offset += 1) {
        dates.push({
          anchorYear,
          date: formatIsoDate(addDays(anchorDate, offset))
        });
      }
      return dates;
    });
  }

  function getObservationSpeciesCode(observation) {
    return String(observation?.speciesCode || observation?.species_code || observation?.code || "").trim();
  }

  function getObservationName(observation) {
    return String(observation?.comName || observation?.commonName || observation?.name || observation?.sciName || "").trim();
  }

  function normalizeTaxonomy(taxonomyMap, speciesCode) {
    if (!taxonomyMap) {
      return {};
    }
    if (typeof taxonomyMap.get === "function") {
      return taxonomyMap.get(speciesCode) || {};
    }
    return taxonomyMap[speciesCode] || {};
  }

  function normalizeObsDateTime(value) {
    return String(value || "").trim();
  }

  function chooseLatestRecentObservation(current, incoming) {
    if (!current) {
      return incoming;
    }

    const currentDate = normalizeObsDateTime(current.obsDt || current.date);
    const incomingDate = normalizeObsDateTime(incoming.obsDt || incoming.date);
    return incomingDate > currentDate ? incoming : current;
  }

  function getProbabilityLevel(score) {
    if (score >= 55) {
      return "高概率";
    }
    if (score >= 25) {
      return "中概率";
    }
    return "低概率";
  }

  function aggregateEbirdSeasonalPrediction({
    dailyEntries = [],
    recentObservations = [],
    taxonomyMap = new Map(),
    historicalYearCount = 0,
    totalHistoricalDays = 0
  } = {}) {
    const buckets = new Map();
    const recentBySpecies = new Map();

    recentObservations.forEach((observation) => {
      const speciesCode = getObservationSpeciesCode(observation);
      if (!speciesCode) {
        return;
      }
      recentBySpecies.set(speciesCode, chooseLatestRecentObservation(recentBySpecies.get(speciesCode), observation));
    });

    dailyEntries.forEach((entry) => {
      const date = String(entry?.date || "").trim();
      const anchorYear = Number(entry?.anchorYear);
      if (!date || !Number.isFinite(anchorYear) || !Array.isArray(entry?.observations)) {
        return;
      }

      const dailySpecies = new Map();
      entry.observations.forEach((observation) => {
        const speciesCode = getObservationSpeciesCode(observation);
        if (speciesCode && !dailySpecies.has(speciesCode)) {
          dailySpecies.set(speciesCode, observation);
        }
      });

      dailySpecies.forEach((observation, speciesCode) => {
        if (!buckets.has(speciesCode)) {
          buckets.set(speciesCode, {
            speciesCode,
            historicalName: getObservationName(observation),
            historicalSciName: String(observation?.sciName || "").trim(),
            years: new Set(),
            dates: new Set()
          });
        }

        const bucket = buckets.get(speciesCode);
        bucket.years.add(anchorYear);
        bucket.dates.add(date);
        if (!bucket.historicalName) {
          bucket.historicalName = getObservationName(observation);
        }
        if (!bucket.historicalSciName && observation?.sciName) {
          bucket.historicalSciName = String(observation.sciName).trim();
        }
      });
    });

    const yearDenominator = Math.max(1, Number(historicalYearCount) || 0);
    const dayDenominator = Math.max(1, Number(totalHistoricalDays) || dailyEntries.length || 0);

    return [...buckets.values()]
      .map((bucket) => {
        const taxonomy = normalizeTaxonomy(taxonomyMap, bucket.speciesCode);
        const recent = recentBySpecies.get(bucket.speciesCode);
        const recentConfirmed = Boolean(recent);
        const yearsSeen = bucket.years.size;
        const hitDays = bucket.dates.size;
        const rawScore = (yearsSeen / yearDenominator) * 70 + (hitDays / dayDenominator) * 20 + (recentConfirmed ? 10 : 0);
        const score = Math.min(100, Number(rawScore.toFixed(2)));

        return {
          speciesCode: bucket.speciesCode,
          commonName: String(taxonomy.commonName || taxonomy.comName || bucket.historicalName || getObservationName(recent) || bucket.speciesCode).trim(),
          sciName: String(taxonomy.sciName || bucket.historicalSciName || recent?.sciName || "").trim(),
          taxonOrder: Number.isFinite(Number(taxonomy.taxonOrder)) ? Number(taxonomy.taxonOrder) : Number.POSITIVE_INFINITY,
          score,
          probabilityLevel: getProbabilityLevel(score),
          yearsSeen,
          hitDays,
          historicalYears: [...bucket.years].sort((left, right) => left - right),
          historicalDates: [...bucket.dates].sort(),
          recentConfirmed,
          recentDate: normalizeObsDateTime(recent?.obsDt || recent?.date),
          recentLocation: String(recent?.locName || recent?.location || "").trim()
        };
      })
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        if (right.yearsSeen !== left.yearsSeen) {
          return right.yearsSeen - left.yearsSeen;
        }
        if (left.taxonOrder !== right.taxonOrder) {
          return left.taxonOrder - right.taxonOrder;
        }
        return left.commonName.localeCompare(right.commonName, "zh-CN");
      });
  }

  return {
    aggregateEbirdSeasonalPrediction,
    buildEbirdSeasonalDateRequests,
    getEbirdSeasonalHistoricalYears
  };
});
