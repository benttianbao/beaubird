import { readFile } from "node:fs/promises";

import { buildScript, scriptOutputPath } from "./build-script.mjs";

async function readCommittedBundle() {
  try {
    return await readFile(scriptOutputPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(
        `Could not find ${scriptOutputPath}. Run npm run build:script first.`,
        { cause: error },
      );
    }

    throw error;
  }
}

async function main() {
  const [buildResult, committedBundle] = await Promise.all([
    buildScript({
      write: false,
      logLevel: "silent",
    }),
    readCommittedBundle(),
  ]);
  const generatedBundle = buildResult.outputFiles?.[0]?.contents;

  if (!generatedBundle) {
    throw new Error("esbuild did not return an in-memory bundle.");
  }

  if (!committedBundle.equals(Buffer.from(generatedBundle))) {
    throw new Error(
      "script.js is out of date with src/script/. Run npm run build:script and commit the generated file.",
    );
  }

  console.log("script.js is in sync with src/script/.");
}

await main();
