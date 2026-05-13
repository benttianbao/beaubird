const { existsSync, readFileSync } = require("node:fs");
const { join, resolve } = require("node:path");

const { createSiteServer } = require("./app");

const DOT_ENV_PATH = join(__dirname, ".env");

function loadDotEnvFile(dotEnvPath = DOT_ENV_PATH) {
  if (!existsSync(dotEnvPath)) {
    return {};
  }
  const parsed = {};
  for (const line of readFileSync(dotEnvPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
      parsed[key] = value;
    }
  }
  return parsed;
}

function getListenOptions() {
  loadDotEnvFile();
  return {
    host: process.env.BEAUBIRD_SITE_HOST || "127.0.0.1",
    port: Number(process.env.BEAUBIRD_SITE_PORT || 3000)
  };
}

function getDatabasePath() {
  loadDotEnvFile();
  return process.env.BEAUBIRD_SITE_DATABASE || join(resolve(__dirname, "..", ".."), "data", "site.sqlite");
}

function main() {
  const { host, port } = getListenOptions();
  const server = createSiteServer({
    databasePath: getDatabasePath(),
    projectRoot: resolve(__dirname, "..", ".."),
    secureCookies: process.env.BEAUBIRD_SITE_SECURE_COOKIES === "1"
  });
  server.listen(port, host, () => {
    console.log(`BeauBird site listening on http://${host}:${port}`);
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  getDatabasePath,
  getListenOptions,
  loadDotEnvFile,
  main
};
