import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { build } from "esbuild";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

export const scriptEntryPath = resolve(projectRoot, "src/script/main.js");
export const scriptOutputPath = resolve(projectRoot, "script.js");

export function createScriptBuildOptions(overrides = {}) {
  return {
    entryPoints: [scriptEntryPath],
    outfile: scriptOutputPath,
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    charset: "utf8",
    minify: false,
    treeShaking: false,
    legalComments: "none",
    banner: {
      js: "/* @generated from src/script/main.js; do not edit directly. */",
    },
    sourcemap: false,
    ...overrides,
  };
}

export function buildScript(overrides = {}) {
  return build(createScriptBuildOptions(overrides));
}

async function main() {
  await buildScript({
    write: true,
    logLevel: "info",
  });
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";

if (invokedPath === fileURLToPath(import.meta.url)) {
  await main();
}
