const { randomUUID } = require("node:crypto");
const { URL } = require("node:url");

const {
  extractCaptchaCode,
  extractDateCommand,
  formatRareBirdReply,
  formatSpeciesLocationReply,
  parseRareBotCommand
} = require("./core");
const {
  createWecomSignature,
  decryptWecomMessage,
  encryptWecomMessage,
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

function createTextStreamReplyPayload(content, streamId) {
  return {
    msgtype: "stream",
    stream: {
      id: String(streamId || Date.now()),
      finish: true,
      content: String(content || "")
    }
  };
}

function createCaptchaSessionStore(options = {}) {
  const ttlMs = Number(options.ttlMs) || 5 * 60 * 1000;
  const now = options.now || Date.now;
  const idFactory = options.idFactory || (() => randomUUID());
  const sessionsByKey = new Map();
  const imagesById = new Map();

  function sweep() {
    const timestamp = now();
    for (const [key, session] of sessionsByKey.entries()) {
      if (session.expiresAt <= timestamp) {
        sessionsByKey.delete(key);
        imagesById.delete(session.captchaId);
      }
    }
    for (const [id, image] of imagesById.entries()) {
      if (image.expiresAt <= timestamp) {
        imagesById.delete(id);
      }
    }
  }

  function createSession({ key, retryText, image }) {
    sweep();
    const captchaId = idFactory();
    const expiresAt = now() + ttlMs;
    const session = {
      key: String(key || "global"),
      retryText: String(retryText || ""),
      captchaId,
      expiresAt
    };
    sessionsByKey.set(session.key, session);
    imagesById.set(captchaId, {
      body: Buffer.from(image?.body || ""),
      contentType: image?.contentType || "image/png",
      expiresAt
    });
    return session;
  }

  function getSession(key) {
    sweep();
    return sessionsByKey.get(String(key || "global")) || null;
  }

  function deleteSession(key) {
    sweep();
    const session = sessionsByKey.get(String(key || "global"));
    if (session) {
      imagesById.delete(session.captchaId);
      sessionsByKey.delete(session.key);
    }
  }

  function getImage(id) {
    sweep();
    const image = imagesById.get(String(id || ""));
    if (!image) {
      return null;
    }
    return {
      body: Buffer.from(image.body),
      contentType: image.contentType
    };
  }

  return {
    createSession,
    deleteSession,
    getImage,
    getSession
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

function extractSessionKeyFromJson(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const room = String(
    payload.chatid ||
      payload.chatId ||
      payload.chat_id ||
      payload.groupId ||
      payload.group_id ||
      payload.conversationId ||
      payload.conversation_id ||
      payload.receiver ||
      payload.ToUserName ||
      payload.toUserName ||
      ""
  ).trim();
  const user = String(
    payload.from ||
      payload.FromUserName ||
      payload.fromUserName ||
      payload.userid ||
      payload.userId ||
      payload.user_id ||
      payload.sender ||
      payload.senderId ||
      ""
  ).trim();
  if (!room && !user) {
    return "";
  }
  return `${room || "direct"}:${user || "unknown"}`;
}

function extractMessageFromJson(payload) {
  return {
    text: extractTextFromJson(payload),
    sessionKey: extractSessionKeyFromJson(payload)
  };
}

function extractEncryptedFromJson(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  return String(payload.encrypt || payload.Encrypt || payload.msg_encrypt || payload.msgEncrypt || "").trim();
}

function extractTextFromDecryptedMessage(message) {
  return extractMessageFromDecryptedMessage(message).text;
}

function extractMessageFromDecryptedMessage(message) {
  const text = String(message || "").trim();
  if (!text) {
    return { text: "", sessionKey: "" };
  }

  if (text.startsWith("{")) {
    try {
      return extractMessageFromJson(JSON.parse(text));
    } catch {
      return { text, sessionKey: "" };
    }
  }

  if (text.startsWith("<")) {
    const room = parseXmlValue(text, "ToUserName");
    const user = parseXmlValue(text, "FromUserName");
    return {
      text: parseXmlValue(text, "Content"),
      sessionKey: room || user ? `${room || "direct"}:${user || "unknown"}` : ""
    };
  }

  return { text, sessionKey: "" };
}

function createEncryptedJsonReplyPayload(payload, { config, timestamp, nonce }) {
  const outputTimestamp = String(timestamp || Math.floor(Date.now() / 1000));
  const outputNonce = String(nonce || randomUUID().replaceAll("-", "").slice(0, 12));
  const encrypted = encryptWecomMessage(JSON.stringify(payload), {
    encodingAesKey: config.encodingAesKey,
    corpId: config.corpId || ""
  });
  return {
    encrypt: encrypted,
    msgsignature: createWecomSignature({
      token: config.token,
      timestamp: outputTimestamp,
      nonce: outputNonce,
      encrypted
    }),
    timestamp: outputTimestamp,
    nonce: outputNonce
  };
}

function getSessionKey(options = {}) {
  return String(options.sessionKey || "global");
}

function withSessionRuntime(options = {}, sessionKey = "") {
  const resolvedSessionKey = String(sessionKey || options.sessionKey || "global");
  if (typeof options.getSessionRuntime !== "function") {
    return { ...options, sessionKey: resolvedSessionKey };
  }
  const runtime = options.getSessionRuntime(resolvedSessionKey) || {};
  return {
    ...options,
    ...runtime,
    sessionKey: resolvedSessionKey
  };
}

function getPublicBaseUrl(options = {}) {
  return String(options.config?.publicBaseUrl || options.publicBaseUrl || "").replace(/\/+$/, "");
}

function buildCaptchaUrl(session, options = {}) {
  const routePath = options.routePath || "/wecom/rare-bot";
  const path = `${routePath}/captcha/${encodeURIComponent(session.captchaId)}`;
  const publicBaseUrl = getPublicBaseUrl(options);
  return publicBaseUrl ? `${publicBaseUrl}${path}` : path;
}

function isBirdreportCaptchaError(error) {
  return error?.name === "BirdreportCaptchaError";
}

async function sendReplyWebhook(reply, sendGroupWebhook) {
  if (typeof sendGroupWebhook === "function") {
    await sendGroupWebhook(reply);
  }
}

async function createCaptchaReply(text, options = {}) {
  const { birdreportClient, captchaStore } = options;
  if (!birdreportClient || typeof birdreportClient.fetchCaptchaImage !== "function" || !captchaStore) {
    return createTextReplyPayload("BirdReport 需要验证码，但机器人还没有配置验证码图片获取能力。");
  }

  const image = await birdreportClient.fetchCaptchaImage();
  const session = captchaStore.createSession({
    key: getSessionKey(options),
    retryText: text,
    image
  });
  const captchaUrl = buildCaptchaUrl(session, options);
  return createTextReplyPayload(
    [
      "BirdReport 需要验证码。",
      `验证码图片：${captchaUrl}`,
      "请直接回复图片中的验证码，我会自动重试刚才的查询。"
    ].join("\n")
  );
}

async function handleCaptchaCode(text, options = {}) {
  const { birdreportClient, captchaStore } = options;
  const sessionKey = getSessionKey(options);
  const code = extractCaptchaCode(text);
  const session = captchaStore?.getSession(sessionKey);
  if (!code || !session) {
    return null;
  }

  try {
    if (!birdreportClient || typeof birdreportClient.verifyCaptcha !== "function") {
      throw new Error("机器人还没有配置验证码校验能力。");
    }
    await birdreportClient.verifyCaptcha(code);
    captchaStore.deleteSession(sessionKey);
    const retryPayload = await handleIncomingText(session.retryText, {
      ...options,
      sessionKey
    });
    const retryText = retryPayload?.text?.content || "";
    return createTextReplyPayload(`验证码通过，已重新查询。\n\n${retryText}`.trim());
  } catch (error) {
    const refreshed = await createCaptchaReply(session.retryText, options);
    refreshed.text.content = `验证码验证失败：${error?.message || "验证码不正确"}\n\n${refreshed.text.content}`;
    return refreshed;
  }
}

async function handleIncomingText(text, options = {}) {
  const { service, sendGroupWebhook } = options;
  const captchaPayload = await handleCaptchaCode(text, options);
  if (captchaPayload) {
    await sendReplyWebhook(captchaPayload.text.content, sendGroupWebhook);
    return captchaPayload;
  }

  const command = parseRareBotCommand(text);
  if (!command) {
    return createTextReplyPayload("请发送 @机器人 2026-05-07 这样的日期格式来查询浙江稀有记录。");
  }

  try {
    const result =
      command.type === "location"
        ? await service.querySpeciesLocations(command.date, command.speciesName)
        : await service.queryDateSpecies(command.date);
    const reply =
      result?.reply ||
      (command.type === "location"
        ? formatSpeciesLocationReply({ date: command.date, speciesName: command.speciesName, error: "没有生成查询结果。" })
        : formatRareBirdReply({ date: command.date, error: "没有生成查询结果。" }));
    await sendReplyWebhook(reply, sendGroupWebhook);
    return createTextReplyPayload(reply);
  } catch (error) {
    if (isBirdreportCaptchaError(error)) {
      const captchaReply = await createCaptchaReply(text, options);
      await sendReplyWebhook(captchaReply.text.content, sendGroupWebhook);
      return captchaReply;
    }
    const reply =
      command.type === "location"
        ? formatSpeciesLocationReply({ date: command.date, speciesName: command.speciesName, error: error?.message || "查询失败" })
        : formatRareBirdReply({ date: command.date, error: error?.message || "查询失败" });
    await sendReplyWebhook(reply, sendGroupWebhook);
    return createTextReplyPayload(reply);
  }
}

async function readBody(request, options = {}) {
  const maxBodyBytes = Math.max(1, Number(options.maxBodyBytes) || 64 * 1024);
  const declaredLength = Number(request.headers["content-length"]);
  if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
    throw new RequestBodyTooLargeError();
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > maxBodyBytes) {
      throw new RequestBodyTooLargeError();
    }
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

function writeBuffer(response, statusCode, body, contentType = "application/octet-stream") {
  const output = Buffer.from(body || "");
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
    return Boolean(config.allowUnsignedCallbacks);
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
  if (!config.token && !config.allowUnsignedCallbacks) {
    writeJson(response, 503, { success: false, error: "WeCom token is not configured" });
    return;
  }
  if (!verifyWecomQuery(query, config)) {
    write(response, 403, "invalid signature", "text/plain; charset=utf-8");
    return;
  }

  if (echo && config.encodingAesKey) {
    write(response, 200, decryptWecomMessage(echo, { encodingAesKey: config.encodingAesKey, corpId: config.corpId }), "text/plain; charset=utf-8");
    return;
  }

  write(response, 200, echo || "ok", "text/plain; charset=utf-8");
}

async function handleJsonCallback(payload, requestUrl, response, options) {
  const encrypted = extractEncryptedFromJson(payload);
  if (encrypted && options.config?.encodingAesKey) {
    const { config } = options;
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

    const plainMessage = decryptWecomMessage(encrypted, {
      encodingAesKey: config.encodingAesKey,
      corpId: config.corpId
    });
    const message = extractMessageFromDecryptedMessage(plainMessage);
    const text = message.text;
    const sessionOptions = withSessionRuntime({ ...options, config, sendGroupWebhook: null }, message.sessionKey || options.sessionKey);
    const replyPayload = await handleIncomingText(text, sessionOptions);
    const content = replyPayload?.text?.content || "";
    const streamPayload = createTextStreamReplyPayload(content, extractDateCommand(text));
    writeJson(
      response,
      200,
      createEncryptedJsonReplyPayload(streamPayload, {
        config,
        timestamp: requestUrl.searchParams.get("timestamp"),
        nonce: requestUrl.searchParams.get("nonce")
      })
    );
    return;
  }

  const message = extractMessageFromJson(payload);
  const sessionOptions = withSessionRuntime({ ...options, sendGroupWebhook: null }, message.sessionKey || options.sessionKey);
  const replyPayload = await handleIncomingText(message.text, sessionOptions);
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

  const room = parseXmlValue(plainXml, "ToUserName");
  const user = parseXmlValue(plainXml, "FromUserName");
  const text = parseXmlValue(plainXml, "Content");
  write(response, 200, "success", "text/plain; charset=utf-8");
  const sessionOptions = withSessionRuntime(options, room || user ? `${room || "direct"}:${user || "unknown"}` : options.sessionKey);
  Promise.resolve(handleIncomingText(text, sessionOptions)).catch((error) => {
    console.error("Failed to process WeCom XML callback:", error);
  });
}

function createRareBotHttpHandler(options = {}) {
  const config = options.config || {};
  const routePath = options.routePath || "/wecom/rare-bot";
  const captchaStore = options.captchaStore || createCaptchaSessionStore();
  return async function rareBotHandler(request, response) {
    try {
      const requestUrl = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
      if (request.method === "GET" && requestUrl.pathname === "/health") {
        writeJson(response, 200, { success: true, service: "wecom-rare-bot" });
        return;
      }

      const captchaPrefix = `${routePath}/captcha/`;
      if (request.method === "GET" && requestUrl.pathname.startsWith(captchaPrefix)) {
        const captchaId = decodeURIComponent(requestUrl.pathname.slice(captchaPrefix.length));
        const image = captchaStore.getImage(captchaId);
        if (!image) {
          write(response, 404, "captcha not found", "text/plain; charset=utf-8");
          return;
        }
        writeBuffer(response, 200, image.body, image.contentType);
        return;
      }

      if (requestUrl.pathname !== routePath) {
        writeJson(response, 404, { success: false, error: "Not found" });
        return;
      }

      if (!config.token && !config.allowUnsignedCallbacks) {
        writeJson(response, 503, { success: false, error: "WeCom token is not configured" });
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

      const body = await readBody(request, { maxBodyBytes: options.maxBodyBytes });
      const contentType = String(request.headers["content-type"] || "");
      if (contentType.includes("application/json") || body.trim().startsWith("{")) {
        await handleJsonCallback(JSON.parse(body || "{}"), requestUrl, response, { ...options, config, routePath, captchaStore });
        return;
      }

      await handleXmlCallback(body, requestUrl, response, { ...options, config, routePath, captchaStore });
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        writeJson(response, 413, { success: false, error: "Request body too large" });
        return;
      }
      writeJson(response, 500, { success: false, error: error?.message || "Internal server error" });
    }
  };
}

class RequestBodyTooLargeError extends Error {}

module.exports = {
  createRareBotHttpHandler,
  createCaptchaSessionStore,
  createTextStreamReplyPayload,
  createTextReplyPayload,
  createWecomSignature,
  extractMessageFromDecryptedMessage,
  extractTextFromDecryptedMessage,
  extractTextFromJson,
  handleIncomingText,
  parseXmlValue
};
