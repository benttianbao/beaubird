import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ZHEJIANG_SPECIES_JSON_PATH = resolve("data/zhejiang-birdreport-species.json");
export const ZHEJIANG_SPECIES_JS_PATH = resolve("data/zhejiang-birdreport-species.js");
export const ZHEJIANG_SPECIES_GLOBAL = "BEAUBIRD_ZHEJIANG_SPECIES_DATA";

export async function writeZhejiangSpeciesJs() {
  const raw = await readFile(ZHEJIANG_SPECIES_JSON_PATH, "utf8");
  const parsed = JSON.parse(raw);
  const source = [
    "/* Auto-generated from zhejiang-birdreport-species.json. Do not edit by hand. */",
    `window.${ZHEJIANG_SPECIES_GLOBAL} = ${JSON.stringify(parsed, null, 2)};`,
    ""
  ].join("\n");

  await writeFile(ZHEJIANG_SPECIES_JS_PATH, source, "utf8");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeZhejiangSpeciesJs().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
