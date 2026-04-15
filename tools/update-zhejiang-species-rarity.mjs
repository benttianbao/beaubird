import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { writeZhejiangSpeciesJs } from "./write-zhejiang-species-js.mjs";

const DATA_PATH = resolve("data/zhejiang-birdreport-species.json");

function parseArgs(args) {
  const result = { _: [] };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      result._.push(arg);
      continue;
    }

    const key = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      result[key] = true;
      continue;
    }

    result[key] = next;
    index += 1;
  }

  return result;
}

function toBoolean(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y", "稀有"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n", "常见"].includes(normalized)) {
    return false;
  }

  throw new Error(`无法识别 --rare 的值：${value}`);
}

function getTaxonKey(item) {
  return String(item?.key || item?.taxon_id || item?.taxonid || item?.id || item?.taxonname || item?.name || "").trim();
}

function findSpecies(species, target) {
  return species.find((item) => getTaxonKey(item) === target || String(item?.taxonname || item?.name || "").trim() === target);
}

function recomputeSummary(data) {
  data.schemaVersion = 2;
  data.totalSpecies = data.species.length;
  data.birdreportSpeciesCount = data.species.filter((item) => !item.manualAdded).length;
  data.manualSpeciesCount = data.species.filter((item) => item.manualAdded).length;
  data.rareSpeciesCount = data.species.filter((item) => item.isRare).length;
  data.updatedAt = new Date().toISOString();
}

async function loadData() {
  const raw = await readFile(DATA_PATH, "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data.species)) {
    throw new Error("JSON 中缺少 species 数组");
  }
  return data;
}

async function saveData(data) {
  recomputeSummary(data);
  await writeFile(DATA_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await writeZhejiangSpeciesJs();
}

function applyRarity(item, options) {
  const isRare = toBoolean(options.rare, typeof item.isRare === "boolean" ? item.isRare : true);
  item.isRare = isRare;
  item.rarityLevel = String(options.level || item.rarityLevel || (isRare ? "rare" : "common")).trim();
  item.raritySource = "manual";
  item.rarityNote = String(options.note ?? item.rarityNote ?? "").trim();
}

async function addSpecies(name, options) {
  const data = await loadData();
  if (findSpecies(data.species, name)) {
    throw new Error(`${name} 已存在，请用 set 修改`);
  }

  const isRare = toBoolean(options.rare, true);
  const item = {
    key: String(options.key || `manual:${name}`).trim(),
    taxon_id: String(options["taxon-id"] || "").trim(),
    taxonname: name,
    latinname: String(options.latin || "").trim(),
    taxonordername: String(options.order || "").trim(),
    taxonfamilyname: String(options.family || "").trim(),
    recordcount: options.recordcount === undefined ? null : Number(options.recordcount) || 0,
    isRare,
    rarityLevel: String(options.level || (isRare ? "rare" : "common")).trim(),
    raritySource: "manual",
    manualAdded: true,
    rarityNote: String(options.note || "").trim()
  };

  data.species.push(item);
  await saveData(data);
  console.log(`已添加：${name}，isRare=${item.isRare}，rarityLevel=${item.rarityLevel}`);
}

async function setRarity(target, options) {
  const data = await loadData();
  const item = findSpecies(data.species, target);
  if (!item) {
    throw new Error(`未找到鸟种：${target}`);
  }

  applyRarity(item, options);
  await saveData(data);
  console.log(`已更新：${item.taxonname || target}，isRare=${item.isRare}，rarityLevel=${item.rarityLevel}`);
}

async function main() {
  const [command, target, ...rest] = process.argv.slice(2);
  const options = parseArgs(rest);

  if (!command || !target || !["add", "set"].includes(command)) {
    console.log("用法：");
    console.log("  node tools/update-zhejiang-species-rarity.mjs set 鸟名 --rare true --level rare --note 备注");
    console.log("  node tools/update-zhejiang-species-rarity.mjs add 鸟名 --rare true --level rare --latin \"Latin name\"");
    process.exitCode = 1;
    return;
  }

  if (command === "add") {
    await addSpecies(target, options);
    return;
  }

  await setRarity(target, options);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
