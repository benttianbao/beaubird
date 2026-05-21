const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  BIRDREPORT_VERSION,
  createBirdreportPayload,
  createBirdreportRecordSearchPayload,
  dedupeBirdreportTaxa,
  formatBirdreportQuerySummary,
  getBirdreportTaxonKey,
  getBirdreportTaxonName,
  normalizeBirdreportAdministrativeArea,
  normalizeBirdreportRecord,
  normalizeBirdreportRecordPage,
  normalizeBirdreportTaxon,
  normalizeBirdreportTaxonPage,
  parseBirdreportRequestData,
  serializeBirdreportRequestData,
  sortBirdreportObjectKeys,
  sortBirdreportRecordsByObservationTimeDesc,
  sortBirdreportTaxaByRecordCount
} = require("../beaubird-birdreport-core");

test("createBirdreportPayload builds the default BirdReport request contract", () => {
  assert.deepEqual(
    createBirdreportPayload({
      startTime: "2026-05-07",
      endTime: "2026-05-08",
      province: " 浙江省 ",
      city: " 杭州市 ",
      district: " 西湖区 ",
      pointname: " 西溪湿地 ",
      username: " birder ",
      state: " 2 ",
      mode: 1
    }),
    {
      startTime: "2026-05-07",
      endTime: "2026-05-08",
      province: "浙江省",
      city: "杭州市",
      district: "西湖区",
      pointname: "西溪湿地",
      username: "birder",
      state: "2",
      version: BIRDREPORT_VERSION,
      outside_type: 0,
      mode: 1
    }
  );
});

test("createBirdreportPayload drops invalid dates but keeps username query mode", () => {
  assert.deepEqual(createBirdreportPayload({ startTime: "tomorrow", username: "Lingod", mode: 1 }), {
    startTime: "",
    endTime: "",
    province: "",
    city: "",
    district: "",
    pointname: "",
    username: "Lingod",
    state: "",
    version: BIRDREPORT_VERSION,
    outside_type: 0,
    mode: 1
  });
});

test("normalizeBirdreportAdministrativeArea moves special county-level cities to district", () => {
  assert.deepEqual(
    normalizeBirdreportAdministrativeArea({
      province: "海南省",
      city: "文昌市",
      district: "",
      version: BIRDREPORT_VERSION
    }),
    {
      province: "海南省",
      city: "",
      district: "文昌市",
      version: BIRDREPORT_VERSION
    }
  );
});

test("formatBirdreportQuerySummary renders area and point filters", () => {
  assert.equal(
    formatBirdreportQuerySummary({
      province: "浙江省",
      city: "杭州市",
      district: "西湖区",
      pointname: "西溪湿地"
    }),
    "浙江省 / 杭州市 / 西湖区 · 观测地点“西溪湿地”"
  );
  assert.equal(formatBirdreportQuerySummary({}), "当前筛选条件");
});

test("normalizeBirdreportTaxon produces stable keys and taxon names", () => {
  assert.deepEqual(
    normalizeBirdreportTaxon({
      taxonid: 4188,
      name: "仙八色鸫",
      latinname: "Pitta nympha",
      recordcount: "12",
      reportCount: "3"
    }),
    {
      key: "4188",
      taxon_id: "4188",
      taxonname: "仙八色鸫",
      latinname: "Pitta nympha",
      taxonordername: "",
      taxonfamilyname: "",
      recordcount: 12,
      reportcount: 3,
      isRare: true
    }
  );
  assert.equal(getBirdreportTaxonKey({ key: "100", taxonname: "彩鹮" }), "100");
  assert.equal(getBirdreportTaxonName({ name: "彩鹮" }), "彩鹮");
});

test("normalizeBirdreportRecord keeps public locations and hides private ones", () => {
  assert.deepEqual(
    normalizeBirdreportRecord({
      state: 2,
      province_name: "浙江省",
      cityName: "杭州市",
      district: "西湖区",
      point_name: "西溪湿地",
      username: "Lingod",
      serial_id: "0000123",
      taxon_count: "2",
      start_time: "2026-05-07 06:30",
      end_time: "2026-05-07 08:00"
    }),
    {
      id: "0000123",
      serialId: "0000123",
      pointName: "浙江省杭州市西湖区西溪湿地",
      username: "Lingod",
      taxonCount: 2,
      isPublic: true,
      isHiddenLocation: false,
      startTime: "2026-05-07 06:30",
      endTime: "2026-05-07 08:00",
      startTimeLabel: "2026-05-07 06:30",
      endTimeLabel: "2026-05-07 08:00"
    }
  );

  const hidden = normalizeBirdreportRecord({ state: 1, point_name: "***", taxon_count: 4 });
  assert.equal(hidden.pointName, "地点未公开");
  assert.equal(hidden.username, "******");
  assert.equal(hidden.isHiddenLocation, true);
});

test("page normalizers use injected decoders and fallback source items", () => {
  const decodePayload = (value) => JSON.parse(value);
  assert.deepEqual(
    normalizeBirdreportTaxonPage(
      { data: JSON.stringify({ list: [{ taxonid: "100", name: "彩鹮", recordcount: "4" }] }) },
      { decodePayload }
    ),
    [
      {
        key: "100",
        taxon_id: "100",
        taxonname: "彩鹮",
        latinname: "",
        taxonordername: "",
        taxonfamilyname: "",
        recordcount: 4,
        reportcount: 0,
        isRare: true
      }
    ]
  );

  assert.deepEqual(
    normalizeBirdreportRecordPage(
      {
        data: JSON.stringify([]),
        records: [{ state: 2, province: "浙江省", city: "杭州市", pointName: "西溪湿地" }]
      },
      { decodePayload }
    ).map((record) => record.pointName),
    ["浙江省杭州市西溪湿地"]
  );
});

test("dedupe and sort helpers keep stable BirdReport ordering", () => {
  const taxa = [
    { taxonid: "2", name: "白鹭", recordcount: 20 },
    { taxonid: "1", name: "彩鹮", recordcount: 3 },
    { taxonid: "1", name: "彩鹮", recordcount: 3 }
  ];
  assert.deepEqual(dedupeBirdreportTaxa(taxa).map(getBirdreportTaxonKey), ["2", "1"]);
  assert.deepEqual(sortBirdreportTaxaByRecordCount(taxa).map(getBirdreportTaxonName), ["彩鹮", "彩鹮", "白鹭"]);

  const records = [
    normalizeBirdreportRecord({ serial_id: "9", start_time: "2026-05-07 06:30", state: 2, point_name: "A" }),
    normalizeBirdreportRecord({ serial_id: "10", start_time: "2026-05-08 06:30", state: 2, point_name: "B" }),
    normalizeBirdreportRecord({ serial_id: "11", start_time: "2026-05-08 06:30", state: 2, point_name: "C" })
  ];
  assert.deepEqual(records.sort(sortBirdreportRecordsByObservationTimeDesc).map((record) => record.serialId), [
    "11",
    "10",
    "9"
  ]);
});

test("record search payload and request serialization share signing normalization", () => {
  assert.deepEqual(
    createBirdreportRecordSearchPayload({ province: "浙江省", version: BIRDREPORT_VERSION }, { taxonId: "100", taxonName: "彩鹮" }),
    {
      province: "浙江省",
      version: BIRDREPORT_VERSION,
      taxonid: "100",
      taxonname: "彩鹮",
      taxon_name: "彩鹮",
      name: "彩鹮",
      field: "start_time",
      order: "desc",
      sort: "start_time",
      sortField: "start_time",
      sortOrder: "desc",
      orderField: "start_time",
      orderType: "desc"
    }
  );

  const serialized = serializeBirdreportRequestData({ province: "浙江省", empty: "", page: 1 });
  assert.equal(serialized, "province=%E6%B5%99%E6%B1%9F%E7%9C%81&page=1");
  assert.deepEqual(parseBirdreportRequestData(serialized), {
    province: "%E6%B5%99%E6%B1%9F%E7%9C%81",
    page: "1"
  });
  assert.deepEqual(sortBirdreportObjectKeys({ b: "2", a: "1" }), { a: "1", b: "2" });
});
