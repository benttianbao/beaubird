const { URL } = require("node:url");

const { extractDateCommand, formatRareBirdReply } = require("./core");
const {
  createWecomSignature,
  decryptWecomMessage,
  verifyWecomSignature
} = require("./wecom-crypto");

function createTextReplyPayload(content) {
  return {
    msgtype: "text",
    text: {
      content: String(content || "")
    }
  };
}

function decodeXmlEntities(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseXmlValue(xml, tagName) {
  const pattern = new RegExp(`<${tagName}>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*</${tagName}>`, "i");
  const match = pattern.exec(String(xml || ""));
  if (!match) {
    return "";
  }
  return decodeXmlEntities(match[1] ?? match[2] ?? "").trim();
}

function extractTextFromJson(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const candidates = [
    payload.content,
    payload.Content,
    payload.text?.content,
    payload.text?.Content,
    payload.message?.content,
    payload.message?.text,
    payload.msg?.content,
    payload.msg?.text,
    payload.event?.content
  ];
  return String(candidates.find((item) => item != null) || "").trim();
}

async function handleIncomingText(text, options = {}) {
  const { service, sendGroupWebhook } = options;
  const date = extractDateCommand(text);
  if (!date) {
    return createTextReplyPayload("请发送 @机器人 2026-05-07 这样的日期格式来查询浙江稀有记录。");
  }

  try {
    const result = await service.queryDate(date);
    const reply = result?.reply || formatRareBirdReply({ date, error: "没有生成查询结果。" });
    if (typeof sendGroupWebhook === "function") {
      await sendGroupWebhook(reply);
    }
    return createTextReplyPayload(reply);
  } catch (error) {
    const reply = formatRareBirdReply({ date, error: error?.message || "查询失败" });
    if (typeof sendGroupWebhook === "function") {
      await sendGroupWebhook(reply);
    }
    return createTextReplyPayload(reply);
  }
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function write(response, statusCode, body, contentType = "application/json; charset=utf-8") {
  const output = Buffer.from(String(body || ""), "utf8");
  response.writeHead(statusCode, {
    "Content-Type": contentType,
    "Content-Length": output.length,
    "Cache-Control": "no-store"
  });
  response.end(output);
}

function writeJson(response, statusCode, payload) {
  write(response, statusCode, JSON.stringify(payload), "application/json; charset=utf-8");
}

function verifyWecomQuery(query, config) {
  if (!config.token) {
    return true;
  }
  return verifyWecomSignature({
    token: config.token,
    timestamp: query.get("timestamp"),
    nonce: query.get("nonce"),
    encrypted: query.get("echostr") || query.get("msg_signature_encrypt") || "",
    signature: query.get("msg_signature")
  });
}

async function handleWecomGet(requestUrl, response, config) {
  const query = requestUrl.searchParams;
  const echo = query.get("echostr") || "";
  if (config.token && !verifyWecomQuery(query, config)) {
    write(response, 403, "invalid signature", "text/plain; charset=utf-8");
    return;
  }

  if (echo && config.encodingAesKey) {
    write(response, 200, decryptWecomMessage(echo, { encodingAesKey: config.encodingAesKey, corpId: config.corpId }), "text/plain; charset=utf-8");
    return;
  }

  write(response, 200, echo || "ok", "text/plain; charset=utf-8");
}

async function handleJsonCallback(payload, response, options) {
  let text = extractTextFromJson(payload);
  if (!text && payload?.Encrypt && options.config?.encodingAesKey) {
    const plainXml = decryptWecomMessage(payload.Encrypt, {
      encodingAesKey: options.config.encodingAesKey,
      corpId: options.config.corpId
    });
    text = parseXmlValue(plainXml, "Content");
  }
  const replyPayload = await handleIncomingText(text, { ...options, sendGroupWebhook: null });
  writeJson(response, 200, replyPayload);
}

async function handleXmlCallback(xml, requestUrl, response, options) {
  const { config } = options;
  const encrypted = parseXmlValue(xml, "Encrypt");
  let plainXml = xml;
  if (encrypted) {
    if (config.token) {
      const ok = verifyWecomSignature({
        token: config.token,
        timestamp: requestUrl.searchParams.get("timestamp"),
        nonce: requestUrl.searchParams.get("nonce"),
        encrypted,
        signature: requestUrl.searchParams.get("msg_signature")
      });
      if (!ok) {
        write(response, 403, "invalid signature", "text/plain; charset=utf-8");
        return;
      }
    }
    plainXml = decryptWecomMessage(encrypted, { encodingAesKey: config.encodingAesKey, corpId: config.corpId });
  }

  const text = parseXmlValue(plainXml, "Content");
  await handleIncomingText(text, options);
  write(response, 200, "success", "text/plain; charset=utf-8");
}

function createRareBotHttpHandler(options = {}) {
  const config = options.config || {};
  const routePath = options.routePath || "/wecom/rare-bot";
  return async function rareBotHandler(request, response) {
    try {
      const requestUrl = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
      if (request.method === "GET" && requestUrl.pathname === "/health") {
        writeJson(response, 200, { success: true, service: "wecom-rare-bot" });
        return;
      }

      if (requestUrl.pathname !== routePath) {
        writeJson(response, 404, { success: false, error: "Not found" });
        return;
      }

      if (request.method === "GET") {
        await handleWecomGet(requestUrl, response, config);
        return;
      }

      if (request.method !== "POST") {
        writeJson(response, 405, { success: false, error: "Method not allowed" });
        return;
      }

      const body = await readBody(request);
      const contentType = String(request.headers["content-type"] || "");
      if (contentType.includes("application/json") || body.trim().startsWith("{")) {
        await handleJsonCallback(JSON.parse(body || "{}"), response, { ...options, config });
        return;
      }

      await handleXmlCallback(body, requestUrl, response, { ...options, config });
    } catch (error) {
      writeJson(response, 500, { success: false, error: error?.message || "Internal server error" });
    }
  };
}

module.exports = {
  createRareBotHttpHandler,
  createTextReplyPayload,
  createWecomSignature,
  extractTextFromJson,
  handleIncomingText,
  parseXmlValue
};
