const { existsSync, readFileSync } = require("node:fs");
const { isAbsolute, join, resolve } = require("node:path");

const { createSiteServer } = require("./app");

const DOT_ENV_PATH = join(__dirname, ".env");
const PROJECT_ROOT = resolve(__dirname, "..", "..");

function resolveProjectPath(configuredPath, fallbackPath) {
  const value = String(configuredPath || fallbackPath).trim();
  return isAbsolute(value) ? value : resolve(PROJECT_ROOT, value);
}

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
  return resolveProjectPath(process.env.BEAUBIRD_SITE_DATABASE, join("data", "site.sqlite"));
}

function getMapDatabasePath() {
  loadDotEnvFile();
  return resolveProjectPath(process.env.BEAUBIRD_MAP_DATABASE, join("data", "bird-map.sqlite"));
}

function main() {
  const { host, port } = getListenOptions();
  const server = createSiteServer({
    databasePath: getDatabasePath(),
    mapDatabasePath: getMapDatabasePath(),
    projectRoot: PROJECT_ROOT,
    secureCookies: process.env.BEAUBIRD_SITE_SECURE_COOKIES === "1",
    amapJsKey: process.env.BEAUBIRD_AMAP_JS_KEY || "",
    amapSecurityCode: process.env.BEAUBIRD_AMAP_SECURITY_CODE || ""
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
  getMapDatabasePath,
  getListenOptions,
  loadDotEnvFile,
  main,
  resolveProjectPath
};
