"use strict";

const { resolve } = require("node:path");
const {
  freezeSealedEvaluationReceipt
} = require("../server/prediction/sealed-evaluation-receipt");

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
    else if (argument === "--spatial-parameters") options.parameterPath = value();
    else if (argument === "--spatial-split-manifest") options.splitManifestPath = value();
    else if (argument === "--output") options.outputPath = value();
    else throw new Error(`未知参数：${argument}`);
  }
  for (const key of ["reportPath", "parameterPath", "splitManifestPath", "outputPath"]) {
    if (!options[key]) throw new Error(`缺少必需参数：${key}`);
  }
  return Object.fromEntries(Object.entries(options).map(([key, value]) => [key, resolve(value)]));
}

try {
  const result = freezeSealedEvaluationReceipt(parseArguments(process.argv.slice(2)));
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
