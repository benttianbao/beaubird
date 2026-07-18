const { readFileSync } = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");

// Keep this list explicit so source-contract tests do not depend on filesystem
// enumeration order. The order mirrors the application's install sequence.
const SCRIPT_SOURCE_FILES = Object.freeze([
  "src/script/config.js",
  "src/script/shared/storage.js",
  "src/script/shared/utils.js",
  "src/script/shared/ui.js",
  "src/script/shared/download.js",
  "src/script/app/runtime.js",
  "src/script/features/records.js",
  "src/script/features/ebird/recent.js",
  "src/script/features/ebird/seasonal.js",
  "src/script/features/birdreport/domain.js",
  "src/script/features/birdreport/client.js",
  "src/script/features/birdreport/regions.js",
  "src/script/features/birdreport/query.js",
  "src/script/features/birdreport/unlocked.js",
  "src/script/features/birdreport/rare-monitor.js",
  "src/script/features/bird-prep/media.js",
  "src/script/features/bird-prep/profiles.js",
  "src/script/features/bird-prep/workflow.js",
  "src/script/app/bootstrap.js",
  "src/script/main.js"
]);

function readScriptSourceCorpus() {
  return SCRIPT_SOURCE_FILES.map((relativePath) => {
    const source = readFileSync(path.join(repoRoot, relativePath), "utf8");
    return `// --- ${relativePath} ---\n${source}`;
  }).join("\n\n");
}

module.exports = {
  SCRIPT_SOURCE_FILES,
  readScriptSourceCorpus
};
