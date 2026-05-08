const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");

const {
  aggregateLocations,
  buildRareHits,
  extractDateCommand,
  extractCaptchaCode,
  formatRareBirdReply,
  formatRareSpeciesListReply,
  formatSpeciesLocationReply,
  matchRareSpeciesByName,
  normalizeBirdreportRecord,
  normalizeBirdreportTaxon,
  parseRareBotCommand
} = require("../server/wecom-rare-bot/core");
const {
  decryptWecomMessage,
  encryptWecomMessage,
  signWecomPayload,
  verifyWecomSignature
} = require("../server/wecom-rare-bot/wecom-crypto");
const { createRareBirdQueryService } = require("../server/wecom-rare-bot/service");
const {
  buildSignedBirdreportRequest,
  createBirdreportClient,
  encryptLong
} = require("../server/wecom-rare-bot/birdreport-client");
const {
  createRareBotHttpHandler,
  createCaptchaSessionStore,
  createTextReplyPayload,
  handleIncomingText,
  parseXmlValue
} = require("../server/wecom-rare-bot/app");
const { parseDotEnv } = require("../server/wecom-rare-bot/server");

test("extractDateCommand returns the yyyy-mm-dd date mentioned after an at command", () => {
  assert.equal(extractDateCommand("@浙江稀有鸟 2026-05-07"), "2026-05-07");
  assert.equal(extractDateCommand("帮我查一下 2026-02-29 浙江稀有记录"), null);
  assert.equal(extractDateCommand("@机器人 2026-02-29"), null);
  assert.equal(extractDateCommand("@机器人 2024-02-29"), "2024-02-29");
});

test("parseRareBotCommand separates date list and species location commands", () => {
  assert.deepEqual(parseRareBotCommand("@机器人 2026-05-07"), {
    type: "date",
    date: "2026-05-07",
    speciesName: ""
  });
  assert.deepEqual(parseRareBotCommand("@机器人 2026-05-07 仙八色鸫"), {
    type: "location",
    date: "2026-05-07",
    speciesName: "仙八色鸫"
  });
  assert.deepEqual(parseRareBotCommand("@机器人 2026-05-07   仙八色鸫  "), {
    type: "location",
    date: "2026-05-07",
    speciesName: "仙八色鸫"
  });
  assert.equal(parseRareBotCommand("2026-05-07 仙八色鸫"), null);
});

test("extractCaptchaCode accepts short direct verification replies", () => {
  assert.equal(extractCaptchaCode("a7K9"), "a7K9");
  assert.equal(extractCaptchaCode("  1234  "), "1234");
  assert.equal(extractCaptchaCode("@机器人 1234"), "1234");
  assert.equal(extractCaptchaCode("@浙江稀有鸟 a7K9"), "a7K9");
  assert.equal(extractCaptchaCode("2026-05-07"), null);
});

test("normalizeBirdreportTaxon produces stable keys and numeric record counts", () => {
  assert.deepEqual(
    normalizeBirdreportTaxon({
      taxonid: 4188,
      name: "仙八色鸫",
      latinname: "Pitta nympha",
      recordcount: "12"
    }),
    {
      key: "4188",
      taxon_id: "4188",
      taxonname: "仙八色鸫",
      latinname: "Pitta nympha",
      taxonordername: "",
      taxonfamilyname: "",
      recordcount: 12,
      reportcount: 0,
      isRare: true
    }
  );
});

test("buildRareHits intersects date taxa with rare baseline and sorts by daily counts", () => {
  const baseline = [
    { taxon_id: "100", taxonname: "仙八色鸫", recordcount: 20, isRare: true },
    { taxon_id: "101", taxonname: "彩鹮", recordcount: 88, isRare: true },
    { taxon_id: "102", taxonname: "白鹭", recordcount: 10000, isRare: false }
  ];
  const dailyTaxa = [
    { taxon_id: "102", taxonname: "白鹭", recordcount: 30 },
    { taxon_id: "101", taxonname: "彩鹮", recordcount: 1 },
    { taxon_id: "100", taxonname: "仙八色鸫", recordcount: 3 }
  ];

  assert.deepEqual(
    buildRareHits(dailyTaxa, baseline).map((item) => ({
      name: item.taxonname,
      daily: item.targetDateRecordCount,
      baseline: item.baselineRecordCount
    })),
    [
      { name: "彩鹮", daily: 1, baseline: 88 },
      { name: "仙八色鸫", daily: 3, baseline: 20 }
    ]
  );
});

test("matchRareSpeciesByName prefers exact matches then reports candidates", () => {
  const hits = [
    { taxon_id: "100", taxonname: "仙八色鸫", targetDateRecordCount: 1 },
    { taxon_id: "101", taxonname: "蓝翅八色鸫", targetDateRecordCount: 2 },
    { taxon_id: "102", taxonname: "彩鹮", targetDateRecordCount: 1 }
  ];

  assert.deepEqual(matchRareSpeciesByName(hits, "仙八色鸫"), {
    status: "matched",
    species: hits[0],
    candidates: []
  });
  assert.deepEqual(matchRareSpeciesByName(hits, "八色鸫"), {
    status: "multiple",
    species: null,
    candidates: [hits[0], hits[1]]
  });
  assert.deepEqual(matchRareSpeciesByName(hits, "黑脸琵鹭"), {
    status: "none",
    species: null,
    candidates: []
  });
});

test("aggregateLocations groups public records and keeps hidden records separate", () => {
  const records = [
    normalizeBirdreportRecord({ state: 2, province_name: "浙江省", city_name: "杭州市", point_name: "西溪湿地", taxon_count: 2 }),
    normalizeBirdreportRecord({ state: 2, province_name: "浙江省", city_name: "杭州市", point_name: "西溪湿地", taxon_count: 1 }),
    normalizeBirdreportRecord({ state: 1, point_name: "***", taxon_count: 4 })
  ];

  assert.deepEqual(aggregateLocations(records), [
    { name: "浙江省杭州市西溪湿地", count: 3, records: 2 },
    { name: "地点未公开", count: 4, records: 1 }
  ]);
});

test("formatRareSpeciesListReply renders species names only", () => {
  const reply = formatRareSpeciesListReply({
    date: "2026-05-07",
    province: "浙江省",
    hits: [
      { taxonname: "仙八色鸫", targetDateRecordCount: 2 },
      { taxonname: "彩鹮", targetDateRecordCount: 1 }
    ]
  });

  assert.equal(reply, "浙江稀有鸟种 2026-05-07\n共 2 种\n1. 仙八色鸫\n2. 彩鹮");
});

test("formatSpeciesLocationReply renders locations for one species", () => {
  const reply = formatSpeciesLocationReply({
    date: "2026-05-07",
    species: { taxonname: "仙八色鸫" },
    locations: [
      { name: "杭州西溪湿地", count: 1, records: 1 },
      { name: "温州某保护区", count: 2, records: 2 }
    ]
  });

  assert.equal(reply, "仙八色鸫 2026-05-07 浙江公开地点\n共 2 个地点\n1. 温州某保护区 2 次\n2. 杭州西溪湿地 1 次");
});

test("formatRareBirdReply renders compact group text with locations", () => {
  const reply = formatRareBirdReply({
    date: "2026-05-07",
    province: "浙江省",
    hits: [
      {
        taxonname: "仙八色鸫",
        targetDateRecordCount: 2,
        baselineRecordCount: 20,
        locations: [
          { name: "杭州西溪湿地", count: 1, records: 1 },
          { name: "地点未公开", count: 1, records: 1 }
        ]
      }
    ]
  });

  assert.match(reply, /浙江稀有记录 2026-05-07/);
  assert.match(reply, /共命中 1 种/);
  assert.match(reply, /仙八色鸫：2 次/);
  assert.match(reply, /杭州西溪湿地 1 次/);
});

test("wecom crypto signs and decrypts callback messages", () => {
  const token = "token-for-test";
  const encodingAesKey = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";
  const corpId = "ww-test-corp";
  const encrypted = encryptWecomMessage("<xml><Content>2026-05-07</Content></xml>", {
    corpId,
    encodingAesKey,
    randomBytes: Buffer.alloc(16, 1)
  });
  const timestamp = "1778160000";
  const nonce = "nonce";
  const signature = signWecomPayload({ token, timestamp, nonce, encrypted });

  assert.equal(verifyWecomSignature({ token, timestamp, nonce, encrypted, signature }), true);
  assert.equal(decryptWecomMessage(encrypted, { encodingAesKey, corpId }), "<xml><Content>2026-05-07</Content></xml>");
});

test("rare bird query service lists date species without fetching locations", async () => {
  const calls = [];
  const service = createRareBirdQueryService({
    baselineSpecies: [
      { taxon_id: "100", taxonname: "仙八色鸫", recordcount: 20, isRare: true },
      { taxon_id: "101", taxonname: "白鹭", recordcount: 10000, isRare: false }
    ],
    birdreportClient: {
      async fetchAllTaxa(payload) {
        calls.push(["taxa", payload]);
        return [
          { taxon_id: "100", taxonname: "仙八色鸫", recordcount: 2 },
          { taxon_id: "101", taxonname: "白鹭", recordcount: 50 }
        ];
      },
      async fetchRecordsByTaxon(species, date) {
        calls.push(["records", species.taxon_id, date]);
        throw new Error("date list should not fetch locations");
      }
    }
  });

  const result = await service.queryDateSpecies("2026-05-07");

  assert.deepEqual(calls, [
    ["taxa", { province: "浙江省", startTime: "2026-05-07", endTime: "2026-05-07", version: "CH4", outside_type: 0, mode: 0 }]
  ]);
  assert.equal(result.hits.length, 1);
  assert.equal(result.reply, "浙江稀有鸟种 2026-05-07\n共 1 种\n1. 仙八色鸫");
});

test("rare bird query service fetches locations only for the requested species", async () => {
  const calls = [];
  const service = createRareBirdQueryService({
    baselineSpecies: [
      { taxon_id: "100", taxonname: "仙八色鸫", recordcount: 20, isRare: true },
      { taxon_id: "101", taxonname: "彩鹮", recordcount: 30, isRare: true }
    ],
    birdreportClient: {
      async fetchAllTaxa(payload) {
        calls.push(["taxa", payload]);
        return [
          { taxon_id: "100", taxonname: "仙八色鸫", recordcount: 2 },
          { taxon_id: "101", taxonname: "彩鹮", recordcount: 1 }
        ];
      },
      async fetchRecordsByTaxon(species, date) {
        calls.push(["records", species.taxon_id, date]);
        return [
          normalizeBirdreportRecord({ state: 2, province_name: "浙江省", city_name: "杭州市", point_name: "西溪湿地", taxon_count: 1 }),
          normalizeBirdreportRecord({ state: 2, province_name: "浙江省", city_name: "杭州市", point_name: "西溪湿地", taxon_count: 1 })
        ];
      }
    }
  });

  const result = await service.querySpeciesLocations("2026-05-07", "仙八色鸫");

  assert.deepEqual(calls.map((item) => item[0]), ["taxa", "records"]);
  assert.deepEqual(calls[1], ["records", "100", "2026-05-07"]);
  assert.equal(result.status, "matched");
  assert.deepEqual(result.locations, [{ name: "浙江省杭州市西溪湿地", count: 2, records: 2 }]);
  assert.match(result.reply, /仙八色鸫 2026-05-07 浙江公开地点/);
});

test("rare bird query service returns candidates when species name is ambiguous", async () => {
  const service = createRareBirdQueryService({
    baselineSpecies: [
      { taxon_id: "100", taxonname: "仙八色鸫", recordcount: 20, isRare: true },
      { taxon_id: "101", taxonname: "蓝翅八色鸫", recordcount: 30, isRare: true }
    ],
    birdreportClient: {
      async fetchAllTaxa() {
        return [
          { taxon_id: "100", taxonname: "仙八色鸫", recordcount: 2 },
          { taxon_id: "101", taxonname: "蓝翅八色鸫", recordcount: 1 }
        ];
      },
      async fetchRecordsByTaxon() {
        throw new Error("ambiguous species should not fetch locations");
      }
    }
  });

  const result = await service.querySpeciesLocations("2026-05-07", "八色鸫");

  assert.equal(result.status, "multiple");
  assert.match(result.reply, /匹配到多个鸟种/);
  assert.match(result.reply, /仙八色鸫/);
  assert.match(result.reply, /蓝翅八色鸫/);
});

test("rare bird query service propagates captcha errors for one-species location lookups", async () => {
  const service = createRareBirdQueryService({
    baselineSpecies: [{ taxon_id: "100", taxonname: "仙八色鸫", recordcount: 20, isRare: true }],
    birdreportClient: {
      async fetchAllTaxa() {
        return [{ taxon_id: "100", taxonname: "仙八色鸫", recordcount: 2 }];
      },
      async fetchRecordsByTaxon() {
        const error = new Error("BirdReport 需要验证码或服务拒绝。");
        error.name = "BirdreportCaptchaError";
        throw error;
      }
    }
  });

  await assert.rejects(() => service.querySpeciesLocations("2026-05-07", "仙八色鸫"), {
    name: "BirdreportCaptchaError"
  });
});

test("buildSignedBirdreportRequest sorts payload before signing", () => {
  const request = buildSignedBirdreportRequest(
    { b: 2, a: 1, empty: "" },
    {
      timestamp: "1778160000000",
      requestId: "0123456789abcdef0123456789abcdef",
      encryptPayload: (payload) => `encrypted:${payload}`
    }
  );

  assert.equal(request.body, 'encrypted:{"a":"1","b":"2"}');
  assert.equal(request.headers.timestamp, "1778160000000");
  assert.equal(request.headers.requestId, "0123456789abcdef0123456789abcdef");
  assert.equal(request.headers.sign, "9ed64d314863e0c4b5c8c1d5e570ea5e");
});

test("birdreport client fetchAllTaxa follows paginated taxon responses", async () => {
  const signedPayloads = [];
  const client = createBirdreportClient({
    signRequest(data) {
      signedPayloads.push(data);
      return { body: `page=${data.page}`, headers: {} };
    },
    async fetchImpl(url, options) {
      assert.match(url, /record\/activity\/taxon/);
      const page = Number(String(options.body).replace("page=", ""));
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify(
            page === 1
              ? { count: 501, data: { list: [{ taxon_id: "1", taxonname: "仙八色鸫", recordcount: 1 }] } }
              : { count: 501, data: { list: [{ taxon_id: "2", taxonname: "彩鹮", recordcount: 2 }] } }
          )
      };
    }
  });

  const taxa = await client.fetchAllTaxa({ province: "浙江省" });

  assert.deepEqual(signedPayloads.map((item) => item.page), [1, 2]);
  assert.deepEqual(taxa.map((item) => item.taxonname), ["仙八色鸫", "彩鹮"]);
});

test("birdreport client throws BirdReport business errors", async () => {
  const client = createBirdreportClient({
    signRequest(data) {
      return { body: `page=${data.page}`, headers: {} };
    },
    async fetchImpl() {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: false, errorCode: 400, msg: "无效签名，验证签名失败！" })
      };
    }
  });

  await assert.rejects(
    () => client.fetchAllTaxa({ province: "浙江省" }),
    /无效签名/
  );
});

test("birdreport client fetches captcha images and verifies codes with the same cookie jar", async () => {
  const calls = [];
  const client = createBirdreportClient({
    async fetchImpl(url, options) {
      calls.push([url, options]);
      if (url.includes("/front/code/visited/generate")) {
        return {
          ok: true,
          status: 200,
          headers: {
            getSetCookie: () => ["BIRDREPORT_SESSION=session-1; Path=/"],
            get: (name) => (String(name).toLowerCase() === "content-type" ? "image/png" : "")
          },
          arrayBuffer: async () => Buffer.from("png-bytes")
        };
      }
      if (url.includes("/front/code/visited/verify")) {
        assert.equal(options.headers.Cookie, "BIRDREPORT_SESSION=session-1");
        assert.equal(options.body, JSON.stringify({ code: "a7K9" }));
        return {
          ok: true,
          status: 200,
          headers: {
            getSetCookie: () => [],
            get: () => "application/json; charset=utf-8"
          },
          text: async () => JSON.stringify({ success: true })
        };
      }
      throw new Error(`unexpected URL ${url}`);
    }
  });

  const image = await client.fetchCaptchaImage();
  const verify = await client.verifyCaptcha("a7K9");

  assert.equal(image.contentType, "image/png");
  assert.equal(image.body.toString("utf8"), "png-bytes");
  assert.deepEqual(verify, { success: true });
  assert.equal(calls.length, 2);
});

test("encryptLong encodes long RSA ciphertext as one base64 payload", () => {
  const encrypted = encryptLong("x".repeat(200));
  assert.equal(typeof encrypted, "string");
  assert.equal(encrypted.length > 300, true);
  assert.equal(/=+[A-Za-z0-9+/]/.test(encrypted), false);
});

test("handleIncomingText sends date-only species lists through the date service", async () => {
  const webhookMessages = [];
  const result = await handleIncomingText("@浙江稀有鸟 2026-05-07", {
    service: {
      async queryDateSpecies(date) {
        assert.equal(date, "2026-05-07");
        return { reply: "浙江稀有鸟种 2026-05-07\n共 1 种\n1. 仙八色鸫" };
      },
      async querySpeciesLocations() {
        throw new Error("date-only commands should not query locations");
      }
    },
    sendGroupWebhook: async (message) => webhookMessages.push(message)
  });

  assert.deepEqual(webhookMessages, ["浙江稀有鸟种 2026-05-07\n共 1 种\n1. 仙八色鸫"]);
  assert.deepEqual(result, createTextReplyPayload("浙江稀有鸟种 2026-05-07\n共 1 种\n1. 仙八色鸫"));
});

test("handleIncomingText routes species commands to location lookups", async () => {
  const result = await handleIncomingText("@机器人 2026-05-07 仙八色鸫", {
    service: {
      async queryDateSpecies() {
        throw new Error("location commands should not use date-only service");
      },
      async querySpeciesLocations(date, speciesName) {
        assert.equal(date, "2026-05-07");
        assert.equal(speciesName, "仙八色鸫");
        return { reply: "仙八色鸫 2026-05-07 浙江公开地点\n共 1 个地点\n1. 杭州西溪湿地 1 次" };
      }
    }
  });

  assert.deepEqual(result, createTextReplyPayload("仙八色鸫 2026-05-07 浙江公开地点\n共 1 个地点\n1. 杭州西溪湿地 1 次"));
});

test("handleIncomingText returns usage text when no valid date is found", async () => {
  const result = await handleIncomingText("@浙江稀有鸟 明天", {
    service: {
      async queryDateSpecies() {
        throw new Error("should not query without a date");
      }
    }
  });

  assert.match(result.text.content, /请发送 @机器人 2026-05-07/);
});

test("handleIncomingText creates captcha sessions when location lookup needs verification", async () => {
  const captchaStore = createCaptchaSessionStore({
    idFactory: () => "captcha-1",
    now: () => 1000
  });
  const error = new Error("BirdReport 需要验证码。");
  error.name = "BirdreportCaptchaError";

  const result = await handleIncomingText("@机器人 2026-05-07 仙八色鸫", {
    sessionKey: "room-1:user-1",
    config: { publicBaseUrl: "http://120.26.231.157" },
    captchaStore,
    birdreportClient: {
      async fetchCaptchaImage() {
        return { body: Buffer.from("image-bytes"), contentType: "image/png" };
      }
    },
    service: {
      async querySpeciesLocations() {
        throw error;
      }
    }
  });

  assert.match(result.text.content, /BirdReport 需要验证码/);
  assert.match(result.text.content, /http:\/\/120\.26\.231\.157\/wecom\/rare-bot\/captcha\/captcha-1/);
  assert.equal(captchaStore.getSession("room-1:user-1").retryText, "@机器人 2026-05-07 仙八色鸫");
  assert.equal(captchaStore.getImage("captcha-1").body.toString("utf8"), "image-bytes");
});

test("handleIncomingText verifies captcha replies and retries the pending command", async () => {
  const calls = [];
  const captchaStore = createCaptchaSessionStore({
    idFactory: () => "captcha-1",
    now: () => 1000
  });
  captchaStore.createSession({
    key: "room-1:user-1",
    retryText: "@机器人 2026-05-07 仙八色鸫",
    image: { body: Buffer.from("image-bytes"), contentType: "image/png" }
  });

  const result = await handleIncomingText("a7K9", {
    sessionKey: "room-1:user-1",
    captchaStore,
    birdreportClient: {
      async verifyCaptcha(code) {
        calls.push(["verify", code]);
        return { success: true };
      }
    },
    service: {
      async querySpeciesLocations(date, speciesName) {
        calls.push(["locations", date, speciesName]);
        return { reply: "仙八色鸫 2026-05-07 浙江公开地点\n共 1 个地点\n1. 杭州西溪湿地 1 次" };
      }
    }
  });

  assert.deepEqual(calls, [
    ["verify", "a7K9"],
    ["locations", "2026-05-07", "仙八色鸫"]
  ]);
  assert.equal(captchaStore.getSession("room-1:user-1"), null);
  assert.deepEqual(result, createTextReplyPayload("验证码通过，已重新查询。\n\n仙八色鸫 2026-05-07 浙江公开地点\n共 1 个地点\n1. 杭州西溪湿地 1 次"));
});

test("handleIncomingText accepts at-mentioned captcha replies", async () => {
  const calls = [];
  const captchaStore = createCaptchaSessionStore({
    idFactory: () => "captcha-1",
    now: () => 1000
  });
  captchaStore.createSession({
    key: "room-1:user-1",
    retryText: "@机器人 2026-05-07 仙八色鸫",
    image: { body: Buffer.from("image-bytes"), contentType: "image/png" }
  });

  const result = await handleIncomingText("@机器人 a7K9", {
    sessionKey: "room-1:user-1",
    captchaStore,
    birdreportClient: {
      async verifyCaptcha(code) {
        calls.push(["verify", code]);
        return { success: true };
      }
    },
    service: {
      async querySpeciesLocations(date, speciesName) {
        calls.push(["locations", date, speciesName]);
        return { reply: "仙八色鸫 2026-05-07 浙江公开地点\n共 1 个地点\n1. 杭州西溪湿地 1 次" };
      }
    }
  });

  assert.deepEqual(calls, [
    ["verify", "a7K9"],
    ["locations", "2026-05-07", "仙八色鸫"]
  ]);
  assert.deepEqual(result, createTextReplyPayload("验证码通过，已重新查询。\n\n仙八色鸫 2026-05-07 浙江公开地点\n共 1 个地点\n1. 杭州西溪湿地 1 次"));
});

test("handleIncomingText refreshes captcha sessions when verification fails", async () => {
  let imageCount = 0;
  const captchaStore = createCaptchaSessionStore({
    idFactory: () => `captcha-${imageCount + 1}`,
    now: () => 1000
  });
  captchaStore.createSession({
    key: "room-1:user-1",
    retryText: "@机器人 2026-05-07 仙八色鸫",
    image: { body: Buffer.from("old-image"), contentType: "image/png" }
  });

  const result = await handleIncomingText("WRONG", {
    sessionKey: "room-1:user-1",
    config: { publicBaseUrl: "http://120.26.231.157" },
    captchaStore,
    birdreportClient: {
      async verifyCaptcha() {
        throw new Error("验证码不正确");
      },
      async fetchCaptchaImage() {
        imageCount += 1;
        return { body: Buffer.from(`new-image-${imageCount}`), contentType: "image/png" };
      }
    },
    service: {
      async querySpeciesLocations() {
        throw new Error("should not retry when verification fails");
      }
    }
  });

  assert.match(result.text.content, /验证码验证失败：验证码不正确/);
  assert.match(result.text.content, /captcha-2/);
  assert.equal(captchaStore.getSession("room-1:user-1").retryText, "@机器人 2026-05-07 仙八色鸫");
  assert.equal(captchaStore.getImage("captcha-2").body.toString("utf8"), "new-image-1");
});

test("captcha image route serves pending captcha bytes", async () => {
  const captchaStore = createCaptchaSessionStore({
    idFactory: () => "captcha-1",
    now: () => 1000
  });
  captchaStore.createSession({
    key: "room-1:user-1",
    retryText: "@机器人 2026-05-07 仙八色鸫",
    image: { body: Buffer.from("image-bytes"), contentType: "image/png" }
  });
  const server = http.createServer(createRareBotHttpHandler({ captchaStore }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/wecom/rare-bot/captcha/captcha-1`);
    const body = Buffer.from(await response.arrayBuffer());

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/png");
    assert.equal(body.toString("utf8"), "image-bytes");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("parseXmlValue reads CDATA and plain XML values", () => {
  assert.equal(parseXmlValue("<xml><Content><![CDATA[@bot 2026-05-07]]></Content><ToUserName>ww</ToUserName></xml>", "Content"), "@bot 2026-05-07");
  assert.equal(parseXmlValue("<xml><MsgType>text</MsgType></xml>", "MsgType"), "text");
});

test("encrypted JSON smart robot callbacks return encrypted stream replies", async () => {
  const token = "token-for-test";
  const encodingAesKey = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";
  const timestamp = "1778173853";
  const nonce = "1778103445";
  const encrypted = encryptWecomMessage(JSON.stringify({ msgtype: "text", text: { content: "@bot 2026-05-07" } }), {
    corpId: "",
    encodingAesKey,
    randomBytes: Buffer.alloc(16, 2)
  });
  const signature = signWecomPayload({ token, timestamp, nonce, encrypted });
  const handler = createRareBotHttpHandler({
    config: { token, encodingAesKey, corpId: "" },
    service: {
      async queryDateSpecies(date) {
        assert.equal(date, "2026-05-07");
        return { reply: "浙江稀有鸟种 2026-05-07\n共 1 种\n1. 仙八色鸫" };
      }
    }
  });
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const { port } = server.address();
    const response = await fetch(
      `http://127.0.0.1:${port}/wecom/rare-bot?msg_signature=${signature}&timestamp=${timestamp}&nonce=${nonce}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encrypt: encrypted })
      }
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(typeof body.encrypt, "string");
    assert.equal(body.msgsignature, signWecomPayload({ token, timestamp: body.timestamp, nonce: body.nonce, encrypted: body.encrypt }));

    const decrypted = JSON.parse(decryptWecomMessage(body.encrypt, { encodingAesKey, corpId: "" }));
    assert.deepEqual(decrypted, {
      msgtype: "stream",
      stream: {
        id: "2026-05-07",
        finish: true,
        content: "浙江稀有鸟种 2026-05-07\n共 1 种\n1. 仙八色鸫"
      }
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("parseDotEnv reads simple bot environment files", () => {
  assert.deepEqual(parseDotEnv("A=1\n# comment\nB=\"two words\"\nEMPTY=\n"), {
    A: "1",
    B: "two words",
    EMPTY: ""
  });
});
