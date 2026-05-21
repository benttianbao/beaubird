import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_PROFILE_SOURCE_PATH = resolve("all_birds_full.json");
export const DEFAULT_PROFILE_OUTPUT_DIR = resolve("data/bird-profiles");
export const DEFAULT_SHARD_SIZE = 200;
export const PROFILE_INDEX_GLOBAL = "BEAUBIRD_BIRD_PROFILE_SHARDS_INDEX";
export const PROFILE_SHARDS_GLOBAL = "BEAUBIRD_BIRD_PROFILE_SHARDS";

export function normalizeBirdProfileName(value) {
  let text = String(value || "").trim();
  if (typeof text.normalize === "function") {
    text = text.normalize("NFKC");
  }
  return text.replace(/\s+/g, "");
}

export function buildBirdProfileShardPayload(profiles, options = {}) {
  const shardSize = Math.max(1, Number.parseInt(options.shardSize, 10) || DEFAULT_SHARD_SIZE);
  const items = Array.isArray(profiles) ? profiles : [];
  const index = {
    version: 1,
    shardSize,
    profileCount: items.length,
    names: {}
  };
  const shards = [];

  items.forEach((item, itemIndex) => {
    const shardIndex = Math.floor(itemIndex / shardSize);
    const shardName = formatShardName(shardIndex, "json");
    const scriptName = formatShardName(shardIndex, "js");
    const normalizedName = normalizeBirdProfileName(item?.name);

    if (!shards[shardIndex]) {
      shards[shardIndex] = {
        file: shardName,
        script: scriptName,
        profiles: []
      };
    }

    shards[shardIndex].profiles.push(item);
    if (normalizedName && !index.names[normalizedName]) {
      index.names[normalizedName] = {
        name: String(item.name || "").trim(),
        shard: shardName,
        script: scriptName
      };
    }
  });

  index.shards = shards.map(({ file, script, profiles }) => ({
    file,
    script,
    count: profiles.length
  }));

  return { index, shards };
}

export async function writeBirdProfileShards(options = {}) {
  const sourcePath = resolve(options.sourcePath || DEFAULT_PROFILE_SOURCE_PATH);
  const outputDir = resolve(options.outputDir || DEFAULT_PROFILE_OUTPUT_DIR);
  const raw = await readFile(sourcePath, "utf8");
  const profiles = JSON.parse(raw);
  const { index, shards } = buildBirdProfileShardPayload(profiles, options);

  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, "index.json"), `${JSON.stringify(index)}\n`, "utf8");
  await writeFile(join(outputDir, "index.js"), createIndexScript(index), "utf8");

  for (const shard of shards) {
    await writeFile(join(outputDir, shard.file), `${JSON.stringify(shard.profiles)}\n`, "utf8");
    await writeFile(join(outputDir, shard.script), createShardScript(shard.file, shard.profiles), "utf8");
  }

  return {
    outputDir,
    profileCount: index.profileCount,
    shardCount: shards.length
  };
}

function formatShardName(index, extension) {
  return `shard-${String(index).padStart(3, "0")}.${extension}`;
}

function createIndexScript(index) {
  return [
    "/* Auto-generated from all_birds_full.json. Do not edit by hand. */",
    `window.${PROFILE_INDEX_GLOBAL} = ${JSON.stringify(index)};`,
    ""
  ].join("\n");
}

function createShardScript(file, profiles) {
  return [
    "/* Auto-generated from all_birds_full.json. Do not edit by hand. */",
    `window.${PROFILE_SHARDS_GLOBAL} = window.${PROFILE_SHARDS_GLOBAL} || {};`,
    `window.${PROFILE_SHARDS_GLOBAL}[${JSON.stringify(file)}] = ${JSON.stringify(profiles)};`,
    ""
  ].join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeBirdProfileShards().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
