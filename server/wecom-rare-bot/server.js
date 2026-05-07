const http = require("node:http");
const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const { createRareBotHttpHandler } = require("./app");
const { createBirdreportClient } = require("./birdreport-client");
const { createRareBirdQueryService } = require("./service");

const DOT_ENV_PATH = resolve(__dirname, ".env");

function parseDotEnv(source) {
  return String(source || "")
    .split(/\r?\n/)
    .reduce((result, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return result;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) {
        return result;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key) {
        result[key] = value;
      }
      return result;
    }, {});
}

function loadDotEnvFile(dotEnvPath = DOT_ENV_PATH) {
  if (!existsSync(dotEnvPath)) {
    return {};
  }

  const parsed = parseDotEnv(readFileSync(dotEnvPath, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  return parsed;
}

function loadConfigFromEnv() {
  loadDotEnvFile();
  return {
    corpId: process.env.WECOM_CORP_ID || process.env.WECHAT_WORK_CORP_ID || "",
    token: process.env.WECOM_TOKEN || process.env.WECHAT_WORK_BOT_TOKEN || "",
    encodingAesKey: process.env.WECOM_ENCODING_AES_KEY || process.env.WECHAT_WORK_ENCODING_AES_KEY || "",
    groupWebhookUrl: process.env.WECOM_GROUP_WEBHOOK_URL || process.env.WECHAT_WORK_GROUP_WEBHOOK_URL || ""
  };
}

function getListenOptions() {
  loadDotEnvFile();
  return {
    host: process.env.BEAUBIRD_WECHAT_BOT_HOST || "127.0.0.1",
    port: Number(process.env.BEAUBIRD_WECHAT_BOT_PORT || 8791)
  };
}

function createGroupWebhookSender(groupWebhookUrl, fetchImpl = fetch) {
  if (!groupWebhookUrl) {
    return null;
  }

  return async function sendGroupWebhook(content) {
    const response = await fetchImpl(groupWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        msgtype: "text",
        text: {
          content: String(content || "")
        }
      })
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`企业微信群 Webhook 发送失败：HTTP ${response.status} ${text}`);
    }
    return text ? JSON.parse(text) : {};
  };
}

function createServer() {
  const config = loadConfigFromEnv();
  const service = createRareBirdQueryService({
    birdreportClient: createBirdreportClient()
  });
  const handler = createRareBotHttpHandler({
    config,
    service,
    sendGroupWebhook: createGroupWebhookSender(config.groupWebhookUrl)
  });
  return http.createServer(handler);
}

if (require.main === module) {
  const server = createServer();
  const { host, port } = getListenOptions();
  server.listen(port, host, () => {
    console.log(`WeCom rare bird bot listening on http://${host}:${port}`);
  });
}

module.exports = {
  createGroupWebhookSender,
  createServer,
  getListenOptions,
  loadConfigFromEnv,
  loadDotEnvFile,
  parseDotEnv
};
