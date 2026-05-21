const assert = require("node:assert/strict");
const { mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { test } = require("node:test");

const tempRoot = resolve(".tmp", "bird-profile-shards-test");
const sourcePath = join(tempRoot, "all_birds_full.json");
const outputDir = join(tempRoot, "bird-profiles");

test("bird profile shard generator writes index, json shards, and script fallbacks", async () => {
  mkdirSync(tempRoot, { recursive: true });
  writeFileSync(
    sourcePath,
    JSON.stringify(
      [
        { name: "白鹭", overview: "常见涉禽。", appearance: "通体白色。", scientific_name: "Egretta garzetta" },
        { name: "白头鹎", overview: "城市常见鸟。", habits: "鸣声响亮。", scientific_name: "Pycnonotus sinensis" },
        { name: "红嘴蓝鹊", overview: "长尾蓝色。", distribution: "林地。", scientific_name: "Urocissa erythroryncha" }
      ],
      null,
      2
    ),
    "utf8"
  );

  const { writeBirdProfileShards } = await import("../tools/build-bird-profile-shards.mjs");
  const result = await writeBirdProfileShards({ sourcePath, outputDir, shardSize: 2 });

  assert.equal(result.profileCount, 3);
  assert.equal(result.shardCount, 2);

  const index = JSON.parse(readFileSync(join(outputDir, "index.json"), "utf8"));
  assert.deepEqual(index.names["白鹭"], { name: "白鹭", shard: "shard-000.json", script: "shard-000.js" });
  assert.deepEqual(index.names["红嘴蓝鹊"], { name: "红嘴蓝鹊", shard: "shard-001.json", script: "shard-001.js" });

  const firstShard = JSON.parse(readFileSync(join(outputDir, "shard-000.json"), "utf8"));
  assert.equal(firstShard.length, 2);
  assert.equal(firstShard[0].overview, "常见涉禽。");
  assert.equal(firstShard[0].scientific_name, "Egretta garzetta");

  const indexScript = readFileSync(join(outputDir, "index.js"), "utf8");
  const shardScript = readFileSync(join(outputDir, "shard-000.js"), "utf8");
  assert.match(indexScript, /window\.BEAUBIRD_BIRD_PROFILE_SHARDS_INDEX/);
  assert.match(shardScript, /window\.BEAUBIRD_BIRD_PROFILE_SHARDS\["shard-000\.json"\]/);
});
