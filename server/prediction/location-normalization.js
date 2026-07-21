"use strict";

const { createHash } = require("node:crypto");

const { haversineDistanceMeters } = require("./geo");
const { canonicalJson } = require("./spatial-splits");

const LOCATION_NORMALIZATION_VERSION = "zhejiang_point_alias_exact_identity_v1";
const NEARBY_AUDIT_DISTANCE_METERS = 100;
const FAR_SAME_NAME_DISTANCE_METERS = 1_000;
const MAX_AUDIT_EXAMPLES = 200;

const LOCATION_NORMALIZATION_RULES = Object.freeze({
  labels: "unicode_nfkc_trim_collapse_whitespace_locale_lowercase",
  administrativeScope: "same_nonempty_city_and_district_required",
  automaticMerge:
    "same_normalized_city_district_name_and_exact_source_longitude_latitude_only",
  coordinateEligibility: "all_member_coordinates_valid_and_each_source_point_stable",
  nearbySameName: "audit_only_when_nonzero_distance_at_most_100m",
  differentName: "never_automatic_even_at_identical_coordinates",
  crossAdministrativeBoundary: "never_automatic",
  canonicalPointId: "minimum_numeric_then_lexical_source_point_id",
  inputOrder: "all_profiles_groups_members_and_examples_sorted_before_hashing"
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function displayLocationLabel(value) {
  return String(value || "").normalize("NFKC").trim().replace(/[\s\u3000]+/gu, " ");
}

function normalizeLocationLabel(value) {
  return displayLocationLabel(value).toLocaleLowerCase("zh-CN");
}

function normalizeCoordinate(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Object.is(number, -0) ? 0 : number;
}

function comparePointIds(leftValue, rightValue) {
  const left = String(leftValue || "").trim();
  const right = String(rightValue || "").trim();
  if (/^\d+$/u.test(left) && /^\d+$/u.test(right)) {
    const numeric = BigInt(left) - BigInt(right);
    if (numeric < 0n) return -1;
    if (numeric > 0n) return 1;
  }
  return left.localeCompare(right);
}

function pointIdentity(row) {
  const identity = {
    cityName: displayLocationLabel(row.city_name),
    districtName: displayLocationLabel(row.district_name),
    pointName: displayLocationLabel(row.point_name),
    normalizedCityName: normalizeLocationLabel(row.city_name),
    normalizedDistrictName: normalizeLocationLabel(row.district_name),
    normalizedPointName: normalizeLocationLabel(row.point_name),
    longitude: normalizeCoordinate(row.longitude),
    latitude: normalizeCoordinate(row.latitude)
  };
  identity.key = canonicalJson({
    cityName: identity.normalizedCityName,
    districtName: identity.normalizedDistrictName,
    pointName: identity.normalizedPointName,
    longitude: identity.longitude,
    latitude: identity.latitude
  });
  return identity;
}

function observePointLocation(profiles, row, coordinate = {}) {
  const pointId = String(row.point_id || "").trim();
  if (!pointId) return;
  let profile = profiles.get(pointId);
  if (!profile) {
    profile = { pointId, reportCount: 0, variants: new Map() };
    profiles.set(pointId, profile);
  }
  const identity = pointIdentity(row);
  const displayKey = canonicalJson([identity.cityName, identity.districtName, identity.pointName]);
  let variant = profile.variants.get(identity.key);
  if (!variant) {
    variant = {
      ...identity,
      displayKey,
      reportCount: 0,
      validCoordinateCount: 0,
      minDate: null,
      maxDate: null
    };
    profile.variants.set(identity.key, variant);
  } else if (displayKey < variant.displayKey) {
    variant.cityName = identity.cityName;
    variant.districtName = identity.districtName;
    variant.pointName = identity.pointName;
    variant.displayKey = displayKey;
  }
  const date = String(row.start_time || "").slice(0, 10);
  profile.reportCount += 1;
  variant.reportCount += 1;
  if (coordinate.valid === true) variant.validCoordinateCount += 1;
  if (/^\d{4}-\d{2}-\d{2}$/u.test(date)) {
    if (!variant.minDate || date < variant.minDate) variant.minDate = date;
    if (!variant.maxDate || date > variant.maxDate) variant.maxDate = date;
  }
}

function canonicalVariant(profile) {
  return [...profile.variants.values()].sort(
    (left, right) =>
      right.reportCount - left.reportCount ||
      left.key.localeCompare(right.key) ||
      canonicalJson(left).localeCompare(canonicalJson(right))
  )[0] || null;
}

function groupBy(values, keyForValue) {
  const groups = new Map();
  for (const value of values) {
    const key = keyForValue(value);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(value);
  }
  return groups;
}

function pointReference(point) {
  return {
    pointId: point.pointId,
    pointName: point.identity.pointName,
    cityName: point.identity.cityName,
    districtName: point.identity.districtName,
    longitude: point.identity.longitude,
    latitude: point.identity.latitude,
    reportCount: point.reportCount
  };
}

function pairReference(left, right, distanceMeters) {
  return {
    pointIds: [left.pointId, right.pointId].sort(comparePointIds),
    cityName: left.identity.cityName,
    districtName: left.identity.districtName,
    leftName: left.identity.pointName,
    rightName: right.identity.pointName,
    distanceMeters: Number(distanceMeters.toFixed(3))
  };
}

function sortPairs(left, right) {
  return (
    left.distanceMeters - right.distanceMeters ||
    comparePointIds(left.pointIds[0], right.pointIds[0]) ||
    comparePointIds(left.pointIds[1], right.pointIds[1])
  );
}

function auditPointPairs(points) {
  const nearbySameNamePairs = [];
  const farSameNamePairs = [];
  const nearbyDifferentNamePairs = [];
  const sameAdminGroups = groupBy(
    points,
    (point) => canonicalJson([
      point.identity.normalizedCityName,
      point.identity.normalizedDistrictName
    ])
  );
  for (const group of sameAdminGroups.values()) {
    for (let leftIndex = 0; leftIndex < group.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < group.length; rightIndex += 1) {
        const left = group[leftIndex];
        const right = group[rightIndex];
        const distance = haversineDistanceMeters(
          left.identity.longitude,
          left.identity.latitude,
          right.identity.longitude,
          right.identity.latitude
        );
        const sameName = left.identity.normalizedPointName === right.identity.normalizedPointName;
        if (sameName && distance > 0 && distance <= NEARBY_AUDIT_DISTANCE_METERS) {
          nearbySameNamePairs.push(pairReference(left, right, distance));
        } else if (sameName && distance >= FAR_SAME_NAME_DISTANCE_METERS) {
          farSameNamePairs.push(pairReference(left, right, distance));
        } else if (!sameName && distance > 0 && distance <= NEARBY_AUDIT_DISTANCE_METERS) {
          nearbyDifferentNamePairs.push(pairReference(left, right, distance));
        }
      }
    }
  }

  const sameCoordinateDifferentNameGroups = [];
  const coordinateGroups = groupBy(
    points,
    (point) => canonicalJson([
      point.identity.normalizedCityName,
      point.identity.normalizedDistrictName,
      point.identity.longitude,
      point.identity.latitude
    ])
  );
  for (const group of coordinateGroups.values()) {
    if (group.length < 2 || new Set(group.map((point) => point.identity.normalizedPointName)).size < 2) continue;
    sameCoordinateDifferentNameGroups.push({
      cityName: group[0].identity.cityName,
      districtName: group[0].identity.districtName,
      longitude: group[0].identity.longitude,
      latitude: group[0].identity.latitude,
      points: group.map(pointReference).sort((left, right) => comparePointIds(left.pointId, right.pointId))
    });
  }

  const crossAdministrativeSameNameGroups = [];
  const nameGroups = groupBy(points, (point) => point.identity.normalizedPointName);
  for (const group of nameGroups.values()) {
    const administrativeKeys = new Set(group.map((point) => canonicalJson([
      point.identity.normalizedCityName,
      point.identity.normalizedDistrictName
    ])));
    if (group.length < 2 || administrativeKeys.size < 2) continue;
    crossAdministrativeSameNameGroups.push({
      normalizedPointName: group[0].identity.normalizedPointName,
      points: group.map(pointReference).sort((left, right) => comparePointIds(left.pointId, right.pointId))
    });
  }

  nearbySameNamePairs.sort(sortPairs);
  farSameNamePairs.sort(sortPairs);
  nearbyDifferentNamePairs.sort(sortPairs);
  sameCoordinateDifferentNameGroups.sort((left, right) =>
    left.cityName.localeCompare(right.cityName) ||
    left.districtName.localeCompare(right.districtName) ||
    left.longitude - right.longitude ||
    left.latitude - right.latitude
  );
  crossAdministrativeSameNameGroups.sort((left, right) =>
    left.normalizedPointName.localeCompare(right.normalizedPointName)
  );
  return {
    nearbySameNamePairs,
    farSameNamePairs,
    nearbyDifferentNamePairs,
    sameCoordinateDifferentNameGroups,
    crossAdministrativeSameNameGroups
  };
}

function finalizePointLocationNormalization(profiles, pointStats = new Map()) {
  const normalizedProfiles = [...profiles.values()]
    .sort((left, right) => comparePointIds(left.pointId, right.pointId))
    .map((profile) => ({
      pointId: profile.pointId,
      reportCount: profile.reportCount,
      variantCount: profile.variants.size,
      identity: canonicalVariant(profile),
      stable: pointStats.get(profile.pointId)?.stable === true
    }));
  const isSafePoint = (profile) =>
    profile.variantCount === 1 &&
    profile.stable &&
    profile.identity &&
    profile.identity.validCoordinateCount === profile.reportCount &&
    profile.identity.normalizedCityName &&
    profile.identity.normalizedDistrictName &&
    profile.identity.normalizedPointName &&
    Number.isFinite(profile.identity.longitude) &&
    Number.isFinite(profile.identity.latitude);
  const safePoints = normalizedProfiles.filter(isSafePoint);
  const auditablePoints = normalizedProfiles.filter((profile) =>
    profile.variantCount === 1 &&
    profile.identity &&
    profile.identity.normalizedCityName &&
    profile.identity.normalizedDistrictName &&
    profile.identity.normalizedPointName &&
    Number.isFinite(profile.identity.longitude) &&
    Number.isFinite(profile.identity.latitude)
  );
  const allExactCandidateGroups = [...groupBy(
    normalizedProfiles.filter((profile) => profile.variantCount === 1 && profile.identity),
    (point) => point.identity.key
  ).values()].filter((group) => group.length > 1);
  const exactGroups = [...groupBy(safePoints, (point) => point.identity.key).values()]
    .filter((group) => group.length > 1)
    .map((group) => group.sort((left, right) => comparePointIds(left.pointId, right.pointId)))
    .sort((left, right) => comparePointIds(left[0].pointId, right[0].pointId));

  const canonicalPointIdByPointId = new Map(normalizedProfiles.map((profile) => [profile.pointId, profile.pointId]));
  const canonicalLocationByPointId = new Map(
    normalizedProfiles.map((profile) => [profile.pointId, profile.identity])
  );
  const automaticMergeGroups = [];
  for (const group of exactGroups) {
    const canonicalPointId = group[0].pointId;
    const identity = group[0].identity;
    for (const member of group) {
      canonicalPointIdByPointId.set(member.pointId, canonicalPointId);
      canonicalLocationByPointId.set(member.pointId, identity);
    }
    automaticMergeGroups.push({
      canonicalPointId,
      memberPointIds: group.map((member) => member.pointId),
      pointName: identity.pointName,
      cityName: identity.cityName,
      districtName: identity.districtName,
      longitude: identity.longitude,
      latitude: identity.latitude,
      reportCount: group.reduce((sum, member) => sum + member.reportCount, 0),
      minDate: group.map((member) => member.identity.minDate).filter(Boolean).sort()[0] || null,
      maxDate: group.map((member) => member.identity.maxDate).filter(Boolean).sort().at(-1) || null
    });
  }

  const rejectedExactIdentityGroups = allExactCandidateGroups
    .filter((group) => !group.every(isSafePoint))
    .map((group) => ({
      memberPointIds: group.map((member) => member.pointId).sort(comparePointIds),
      pointName: group[0].identity.pointName,
      cityName: group[0].identity.cityName,
      districtName: group[0].identity.districtName,
      longitude: group[0].identity.longitude,
      latitude: group[0].identity.latitude,
      reportCount: group.reduce((sum, member) => sum + member.reportCount, 0),
      reasons: [...new Set(group.flatMap((member) => {
        const reasons = [];
        if (!member.stable) reasons.push("source_point_not_spatially_stable");
        if (member.identity.validCoordinateCount !== member.reportCount) reasons.push("coordinate_not_valid_for_every_report");
        if (
          !member.identity.normalizedCityName ||
          !member.identity.normalizedDistrictName ||
          !member.identity.normalizedPointName
        ) reasons.push("missing_required_identity_label");
        return reasons;
      }))].sort()
    }))
    .sort((left, right) => comparePointIds(left.memberPointIds[0], right.memberPointIds[0]));

  const pointPairs = auditPointPairs(auditablePoints);
  const aliasEntries = [...canonicalPointIdByPointId.entries()]
    .sort((left, right) => comparePointIds(left[0], right[0]));
  const aliasMapSha256 = sha256(Buffer.from(canonicalJson(aliasEntries), "utf8"));
  const fullAudit = {
    version: LOCATION_NORMALIZATION_VERSION,
    rules: LOCATION_NORMALIZATION_RULES,
    automaticMergeGroups,
    rejectedExactIdentityGroups,
    ...pointPairs
  };
  const auditSha256 = sha256(Buffer.from(canonicalJson(fullAudit), "utf8"));
  const contractSha256 = sha256(Buffer.from(canonicalJson({
    version: LOCATION_NORMALIZATION_VERSION,
    rules: LOCATION_NORMALIZATION_RULES
  }), "utf8"));
  const summary = {
    eligiblePointIds: normalizedProfiles.length,
    eligiblePointReportCount: normalizedProfiles.reduce((sum, profile) => sum + profile.reportCount, 0),
    pointIdsWithMultipleNormalizedIdentities: normalizedProfiles.filter((profile) => profile.variantCount > 1).length,
    exactIdentityCandidateGroupCount: allExactCandidateGroups.length,
    automaticMergeGroupCount: automaticMergeGroups.length,
    automaticMergePointIdCount: automaticMergeGroups.reduce((sum, group) => sum + group.memberPointIds.length, 0),
    automaticMergedAliasCount: automaticMergeGroups.reduce((sum, group) => sum + group.memberPointIds.length - 1, 0),
    automaticMergeReportCount: automaticMergeGroups.reduce((sum, group) => sum + group.reportCount, 0),
    rejectedExactIdentityGroupCount: rejectedExactIdentityGroups.length,
    nearbySameNamePairCount: pointPairs.nearbySameNamePairs.length,
    farSameNamePairCount: pointPairs.farSameNamePairs.length,
    nearbyDifferentNamePairCount: pointPairs.nearbyDifferentNamePairs.length,
    sameCoordinateDifferentNameGroupCount: pointPairs.sameCoordinateDifferentNameGroups.length,
    crossAdministrativeSameNameGroupCount: pointPairs.crossAdministrativeSameNameGroups.length
  };
  const examples = (values) => values.slice(0, MAX_AUDIT_EXAMPLES);
  return {
    version: LOCATION_NORMALIZATION_VERSION,
    rules: LOCATION_NORMALIZATION_RULES,
    contractSha256,
    aliasMapSha256,
    auditSha256,
    summary,
    automaticMergeGroups,
    rejectedExactIdentityGroups,
    suspectedDuplicates: {
      nearbySameNamePairs: examples(pointPairs.nearbySameNamePairs),
      farSameNamePairs: examples(pointPairs.farSameNamePairs),
      nearbyDifferentNamePairs: examples(pointPairs.nearbyDifferentNamePairs),
      sameCoordinateDifferentNameGroups: examples(pointPairs.sameCoordinateDifferentNameGroups),
      crossAdministrativeSameNameGroups: examples(pointPairs.crossAdministrativeSameNameGroups),
      examplesTruncatedAt: MAX_AUDIT_EXAMPLES
    },
    canonicalPointIdByPointId,
    canonicalLocationByPointId
  };
}

function locationNormalizationReport(normalization) {
  return {
    version: normalization.version,
    rules: normalization.rules,
    contractSha256: normalization.contractSha256,
    aliasMapSha256: normalization.aliasMapSha256,
    auditSha256: normalization.auditSha256,
    summary: normalization.summary,
    automaticMergeGroups: normalization.automaticMergeGroups,
    rejectedExactIdentityGroups: normalization.rejectedExactIdentityGroups,
    suspectedDuplicates: normalization.suspectedDuplicates
  };
}

module.exports = {
  LOCATION_NORMALIZATION_RULES,
  LOCATION_NORMALIZATION_VERSION,
  comparePointIds,
  displayLocationLabel,
  finalizePointLocationNormalization,
  locationNormalizationReport,
  normalizeLocationLabel,
  observePointLocation,
  pointIdentity
};
