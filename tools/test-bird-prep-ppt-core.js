const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  buildBirdPrepSlides,
  buildBirdPrepPptxFilename,
  buildBirdProfileIndex,
  createBirdPrepPptx,
  normalizeBirdName
} = require("../bird-prep-ppt-core");

function listStoredZipEntries(bytes) {
  const entries = [];
  let offset = 0;
  while (offset < bytes.length - 4) {
    const signature =
      bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24);
    if (signature !== 0x04034b50) {
      break;
    }

    const compressionMethod = bytes[offset + 8] | (bytes[offset + 9] << 8);
    const compressedSize =
      bytes[offset + 18] |
      (bytes[offset + 19] << 8) |
      (bytes[offset + 20] << 16) |
      (bytes[offset + 21] << 24);
    const nameLength = bytes[offset + 26] | (bytes[offset + 27] << 8);
    const extraLength = bytes[offset + 28] | (bytes[offset + 29] << 8);
    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLength;
    const name = Buffer.from(bytes.slice(nameStart, nameEnd)).toString("utf8");
    entries.push({ name, compressionMethod, compressedSize });
    offset = nameEnd + extraLength + compressedSize;
  }
  return entries;
}

test("buildBirdProfileIndex matches Chinese names with light normalization", () => {
  const index = buildBirdProfileIndex([
    {
      name: "黑脸琵鹭",
      appearance: "大型白色涉禽，脸部裸露皮肤黑色。",
      call: "繁殖地较安静。",
      habits: "常在潮间带、河口和浅水湿地觅食。",
      breeding: "繁殖于岛屿或海岸附近。",
      identification: "匙形长嘴是关键识别点。",
      distribution: "东亚沿海迁徙。"
    }
  ]);

  assert.equal(index.get("黑脸琵鹭").name, "黑脸琵鹭");
  assert.equal(index.get(normalizeBirdName(" 黑 脸 琵 鹭 ")).identification, "匙形长嘴是关键识别点。");
});

test("buildBirdPrepSlides creates slides for matched taxa and reports skipped names", () => {
  const index = buildBirdProfileIndex([
    {
      name: "黑脸琵鹭",
      appearance: "大型白色涉禽。",
      call: "低哑叫声。",
      habits: "浅水湿地觅食。",
      breeding: "繁殖于沿海岛屿。",
      identification: "黑脸和匙形嘴。",
      distribution: "东亚沿海。"
    }
  ]);

  const result = buildBirdPrepSlides(
    [
      { taxonname: "黑脸琵鹭", latinname: "Platalea minor", recordcount: 12 },
      { taxonname: "不存在鸟", latinname: "Missing bird", recordcount: 1 }
    ],
    index
  );

  assert.equal(result.slides.length, 1);
  assert.equal(result.slides[0].speciesName, "黑脸琵鹭");
  assert.deepEqual(
    result.slides[0].sections.map((section) => section.title),
    ["外形", "识别", "习性生境", "分布 / 繁殖 / 叫声"]
  );
  assert.deepEqual(result.skippedNames, ["不存在鸟"]);
});

test("createBirdPrepPptx generates a pptx package with one slide per bird", () => {
  const bytes = createBirdPrepPptx([
    {
      speciesName: "黑脸琵鹭",
      latinName: "Platalea minor",
      sections: [
        { title: "外形", body: "大型白色涉禽。" },
        { title: "识别", body: "黑脸和匙形嘴。" },
        { title: "习性生境", body: "浅水湿地觅食。" },
        { title: "分布 / 繁殖 / 叫声", body: "东亚沿海迁徙。" }
      ]
    },
    {
      speciesName: "白鹭",
      latinName: "Egretta garzetta",
      sections: [
        { title: "外形", body: "通体白色。" },
        { title: "识别", body: "黑嘴黑脚，趾黄色。" },
        { title: "习性生境", body: "水边觅食。" },
        { title: "分布 / 繁殖 / 叫声", body: "常见留鸟或候鸟。" }
      ]
    }
  ]);

  assert.ok(bytes instanceof Uint8Array);
  assert.deepEqual([...bytes.slice(0, 2)].map((value) => String.fromCharCode(value)).join(""), "PK");

  const entries = listStoredZipEntries(bytes);
  assert.equal(entries.find((entry) => entry.name === "ppt/slides/slide1.xml")?.compressionMethod, 0);
  assert.ok(entries.some((entry) => entry.name === "ppt/slides/slide2.xml"));
  assert.ok(entries.some((entry) => entry.name === "ppt/presentation.xml"));
  assert.ok(!entries.some((entry) => entry.name === "ppt/slides/slide3.xml"));
});

test("buildBirdPrepPptxFilename includes location and timestamp-safe suffix", () => {
  assert.match(
    buildBirdPrepPptxFilename({ province: "浙江省", city: "杭州市", date: new Date("2026-05-09T08:07:06") }),
    /^浙江省-杭州市-鸟类预习-20260509-080706\.pptx$/
  );

  assert.match(
    buildBirdPrepPptxFilename({
      province: "Zhejiang",
      city: "Hangzhou",
      district: "Xihu",
      pointname: "Xixi Wetland",
      date: new Date("2026-06-01T09:10:11")
    }),
    /^Zhejiang-Hangzhou-Xihu-Xixi Wetland-鸟类预习-20260601-091011\.pptx$/
  );
});
