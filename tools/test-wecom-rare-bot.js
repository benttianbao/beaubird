const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");

const {
  aggregateLocations,
  buildRareHits,
  extractDateCommand,
  formatRareBirdReply,
  normalizeBirdreportRecord,
  normalizeBirdreportTaxon
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

test("rare bird query service attaches aggregated locations to every hit", async () => {
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
        return [
          normalizeBirdreportRecord({ state: 2, province_name: "浙江省", city_name: "杭州市", point_name: "西溪湿地", taxon_count: 1 }),
          normalizeBirdreportRecord({ state: 2, province_name: "浙江省", city_name: "杭州市", point_name: "西溪湿地", taxon_count: 1 })
        ];
      }
    }
  });

  const result = await service.queryDate("2026-05-07");

  assert.deepEqual(calls, [
    ["taxa", { province: "浙江省", startTime: "2026-05-07", endTime: "2026-05-07", version: "CH4", outside_type: 0, mode: 0 }],
    ["records", "100", "2026-05-07"]
  ]);
  assert.equal(result.hits.length, 1);
  assert.deepEqual(result.hits[0].locations, [{ name: "浙江省杭州市西溪湿地", count: 2, records: 2 }]);
  assert.match(result.reply, /仙八色鸫：2 次/);
});

test("rare bird query service keeps hits when record locations need verification", async () => {
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

  const result = await service.queryDate("2026-05-07");

  assert.equal(result.hits.length, 1);
  assert.equal(result.hits[0].locationError, "BirdReport 需要验证码或服务拒绝。");
  assert.match(result.reply, /地点：查询失败（BirdReport 需要验证码或服务拒绝。）/);
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

test("encryptLong encodes long RSA ciphertext as one base64 payload", () => {
  const encrypted = encryptLong("x".repeat(200));
  assert.equal(typeof encrypted, "string");
  assert.equal(encrypted.length > 300, true);
  assert.equal(/=+[A-Za-z0-9+/]/.test(encrypted), false);
});

test("handleIncomingText queries service and optionally pushes to group webhook", async () => {
  const webhookMessages = [];
  const result = await handleIncomingText("@浙江稀有鸟 2026-05-07", {
    service: {
      async queryDate(date) {
        assert.equal(date, "2026-05-07");
        return { reply: "浙江稀有记录 2026-05-07\n共命中 1 种" };
      }
    },
    sendGroupWebhook: async (message) => webhookMessages.push(message)
  });

  assert.deepEqual(webhookMessages, ["浙江稀有记录 2026-05-07\n共命中 1 种"]);
  assert.deepEqual(result, createTextReplyPayload("浙江稀有记录 2026-05-07\n共命中 1 种"));
});

test("handleIncomingText returns usage text when no valid date is found", async () => {
  const result = await handleIncomingText("@浙江稀有鸟 明天", {
    service: {
      async queryDate() {
        throw new Error("should not query without a date");
      }
    }
  });

  assert.match(result.text.content, /请发送 @机器人 2026-05-07/);
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
      async queryDate(date) {
        assert.equal(date, "2026-05-07");
        return { reply: "浙江稀有记录 2026-05-07\n共命中 1 种" };
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
        content: "浙江稀有记录 2026-05-07\n共命中 1 种"
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
