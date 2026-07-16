"use strict";

const { resolve } = require("node:path");
const {
  freezeSpatialParametersFromDevelopmentReport
} = require("../server/prediction/spatial-parameters");

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`${argument} 缺少值`);
      return argv[index];
    };
    if (argument === "--report") options.reportPath = value();
    else if (argument === "--spatial-split-manifest") options.splitManifestPath = value();
    else if (argument === "--output") options.outputPath = value();
    else throw new Error(`未知参数：${argument}`);
  }
  if (!options.reportPath || !options.splitManifestPath || !options.outputPath) {
    throw new Error("必须提供 --report、--spatial-split-manifest 和 --output");
  }
  return Object.fromEntries(
    Object.entries(options).map(([key, value]) => [key, resolve(value)])
  );
}

try {
  const result = freezeSpatialParametersFromDevelopmentReport(parseArguments(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    ok: false,
    code: error.code || "FREEZE_FAILED",
    message: error.message,
    details: error.details
  }, null, 2)}\n`);
  process.exitCode = 1;
}
