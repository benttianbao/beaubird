const http = require("node:http");
const { createReadStream, existsSync, statSync } = require("node:fs");
const { extname, join, normalize, resolve, sep } = require("node:path");

const { adminPage, changePasswordPage, loginPage } = require("./pages");
const {
  changeUserPassword,
  clearLoginFailures,
  createSession,
  createUser,
  deleteSession,
  getSessionUser,
  getUserById,
  getUserByUsername,
  initializeSiteDatabase,
  isLoginLocked,
  listUsers,
  recordLoginFailure,
  resetUserPassword,
  setUserDisabled,
  toPublicUser,
  verifyPassword,
  writeAuditLog
} = require("./store");

const DEFAULT_SECURITY = {
  lockoutMs: 15 * 60 * 1000,
  maxLoginFailures: 5,
  sessionTtlMs: 12 * 60 * 60 * 1000
};

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

const PUBLIC_ROOT_FILES = new Set([
  "index.html",
  "script.js",
  "style.css",
  "ebird-seasonal-core.js",
  "bird-prep-ppt-core.js",
  "all_birds_full.js",
  "all_birds_full.json"
]);
const PUBLIC_PREFIXES = ["data/", "vendor/"];

const BIRDREPORT_ENDPOINTS = {
  "/api/birdreport/province": {
    remote: "https://api.birdreport.cn/front/system/adcode/province",
    referer: "https://www.birdreport.cn/home/search/page.html"
  },
  "/api/birdreport/city": {
    remote: "https://api.birdreport.cn/front/system/adcode/city",
    referer: "https://www.birdreport.cn/home/search/page.html"
  },
  "/api/birdreport/district": {
    remote: "https://api.birdreport.cn/front/system/adcode/district",
    referer: "https://www.birdreport.cn/home/search/page.html"
  },
  "/api/birdreport/taxon": {
    remote: "https://api.birdreport.cn/front/record/activity/taxon",
    referer: "https://www.birdreport.cn/home/search/taxon.html"
  },
  "/api/birdreport/record": {
    remote: "https://api.birdreport.cn/front/record/search/page",
    referer: "https://www.birdreport.cn/home/search/record.html"
  },
  "/api/birdreport/summary": {
    remote: "https://api.birdreport.cn/front/record/chart/summary",
    referer: "https://www.birdreport.cn/home/search/page.html"
  }
};

function createSiteServer(options = {}) {
  const projectRoot = options.projectRoot || resolve(__dirname, "..", "..");
  const database =
    options.database || initializeSiteDatabase(options.databasePath || join(projectRoot, "data", "site.sqlite"));
  const security = { ...DEFAULT_SECURITY, ...(options.security || {}) };
  const secureCookies = Boolean(options.secureCookies || process.env.NODE_ENV === "production");
  const fetchImpl = options.fetchImpl || fetch;

  return http.createServer(async (request, response) => {
    try {
      await routeRequest({
        database,
        fetchImpl,
        projectRoot,
        request,
        response,
        secureCookies,
        security
      });
    } catch (error) {
      console.error(error);
      json(response, 500, { error: "服务器内部错误。" });
    }
  });
}

async function routeRequest(context) {
  const { request, response } = context;
  const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
  const pathname = decodeURIComponent(url.pathname);

  if (request.method === "GET" && pathname === "/site/health") {
    return json(response, 200, { ok: true, service: "beaubird-site" });
  }
  if (request.method === "GET" && pathname === "/login") {
    return html(response, loginPage());
  }

  if (request.method === "POST" && pathname === "/api/auth/login") {
    return handleLogin(context);
  }

  const session = getSessionUser(context.database, readCookie(request, "bb_session"));
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return json(response, 401, { error: "请先登录。" });
    }
    return redirect(response, "/login");
  }

  context.session = session;
  if (request.method === "GET" && pathname === "/change-password") {
    return html(response, changePasswordPage());
  }
  if (request.method === "POST" && pathname === "/api/auth/logout") {
    if (!verifyCsrf(context, request)) {
      return json(response, 403, { error: "请求校验失败。" });
    }
    deleteSession(context.database, session.sessionId);
    setSessionCookie(response, "", context.secureCookies, 0);
    return json(response, 200, { ok: true });
  }
  if (request.method === "POST" && pathname === "/api/auth/change-password") {
    return handleChangePassword(context);
  }

  if (session.user.must_change_password && pathname !== "/change-password" && !pathname.startsWith("/api/auth/")) {
    if (pathname.startsWith("/api/")) {
      return json(response, 403, { error: "请先修改密码。" });
    }
    return redirect(response, "/change-password");
  }

  if (pathname.startsWith("/api/admin/") || pathname === "/admin") {
    if (session.user.role !== "admin") {
      return request.method === "GET" && pathname === "/admin"
        ? text(response, 403, "Forbidden")
        : json(response, 403, { error: "没有后台权限。" });
    }
  }

  if (request.method === "GET" && pathname === "/admin") {
    return html(response, adminPage(session.csrfToken));
  }
  if (pathname.startsWith("/api/admin/") || pathname === "/api/admin/users") {
    if (request.method !== "GET" && !verifyCsrf(context, request)) {
      return json(response, 403, { error: "请求校验失败。" });
    }
    return handleAdminApi(context, pathname);
  }
  if (pathname.startsWith("/api/birdreport/")) {
    return proxyBirdreport(context, pathname);
  }
  if (request.method === "GET" && pathname === "/api/media/macaulay/search") {
    return proxyMacaulaySearch(context, url);
  }
  const macaulayAssetMatch = pathname.match(/^\/api\/media\/macaulay\/asset\/([^/]+)$/);
  if (request.method === "GET" && macaulayAssetMatch) {
    return proxyMacaulayAsset(context, macaulayAssetMatch[1]);
  }
  if (request.method === "GET" || request.method === "HEAD") {
    return serveStatic(context, pathname);
  }

  return json(response, 404, { error: "Not found" });
}

async function handleLogin(context) {
  const { database, request, response, security } = context;
  const body = await readJson(request);
  const username = String(body.username || "").trim();
  const ip = getClientIp(request);

  if (isLoginLocked(database, username, ip)) {
    writeAuditLog(database, { action: "login_locked", ip, details: { username } });
    return json(response, 429, { error: "登录尝试过多，请稍后再试。" });
  }

  const user = getUserByUsername(database, username);
  if (!user || user.disabled || !verifyPassword(body.password, user)) {
    recordLoginFailure(database, username, ip, security);
    writeAuditLog(database, { action: "login_failed", targetUserId: user?.id, ip, details: { username } });
    return json(response, 401, { error: "用户名或密码错误。" });
  }

  clearLoginFailures(database, username, ip);
  const session = createSession(database, user.id, security.sessionTtlMs);
  setSessionCookie(response, session.id, context.secureCookies, security.sessionTtlMs);
  writeAuditLog(database, { actorUserId: user.id, action: "login_success", targetUserId: user.id, ip });
  return json(response, 200, {
    csrfToken: session.csrfToken,
    mustChangePassword: Boolean(user.must_change_password),
    user: toPublicUser(user)
  });
}

async function handleChangePassword(context) {
  const { database, request, response, session } = context;
  if (!verifyCsrf(context, request)) {
    return json(response, 403, { error: "请求校验失败。" });
  }
  const body = await readJson(request);
  const user = getUserById(database, session.user.id);
  if (String(body.newPassword || "") !== String(body.confirmPassword || "")) {
    return json(response, 400, { error: "两次输入的新密码不一致。" });
  }
  if (!user.must_change_password && !verifyPassword(body.currentPassword, user)) {
    return json(response, 401, { error: "当前密码不正确。" });
  }
  try {
    const changed = changeUserPassword(database, user.id, body.newPassword);
    writeAuditLog(database, { actorUserId: user.id, action: "change_password", targetUserId: user.id, ip: getClientIp(request) });
    return json(response, 200, { ok: true, user: changed });
  } catch (error) {
    return json(response, 400, { error: error.message || "密码不符合要求。" });
  }
}

async function handleAdminApi(context, pathname) {
  const { database, request, response, session } = context;
  const ip = getClientIp(request);
  if (request.method === "GET" && pathname === "/api/admin/users") {
    return json(response, 200, { users: listUsers(database) });
  }
  if (request.method === "POST" && pathname === "/api/admin/users") {
    const body = await readJson(request);
    let created;
    try {
      created = createUser(database, { username: body.username, role: body.role || "user" });
    } catch (error) {
      return json(response, 400, { error: error.message || "新增用户失败。" });
    }
    writeAuditLog(database, {
      actorUserId: session.user.id,
      action: "create_user",
      targetUserId: created.user.id,
      ip,
      details: { role: created.user.role }
    });
    return json(response, 201, created);
  }
  const match = pathname.match(/^\/api\/admin\/users\/(\d+)\/(reset-password|disable|enable)$/);
  if (request.method === "POST" && match) {
    const userId = Number(match[1]);
    const action = match[2];
    const result =
      action === "reset-password"
        ? resetUserPassword(database, userId)
        : { user: setUserDisabled(database, userId, action === "disable") };
    writeAuditLog(database, {
      actorUserId: session.user.id,
      action: action.replace("-", "_"),
      targetUserId: userId,
      ip
    });
    return json(response, 200, result);
  }
  return json(response, 404, { error: "Not found" });
}

async function proxyBirdreport(context, pathname) {
  const endpoint = BIRDREPORT_ENDPOINTS[pathname];
  if (!endpoint) {
    return json(context.response, 404, { error: "Unknown BirdReport endpoint" });
  }
  const body = context.request.method === "GET" || context.request.method === "HEAD" ? undefined : await readRaw(context.request);
  const upstream = await context.fetchImpl(endpoint.remote, {
    method: context.request.method,
    headers: {
      accept: context.request.headers.accept || "application/json, text/plain, */*",
      "content-type": context.request.headers["content-type"] || "application/json; charset=UTF-8",
      origin: "https://www.birdreport.cn",
      referer: endpoint.referer,
      requestId: context.request.headers.requestid || "",
      sign: context.request.headers.sign || "",
      timestamp: context.request.headers.timestamp || "",
      "user-agent": context.request.headers["user-agent"] || "BeauBird Site"
    },
    body
  });
  context.response.writeHead(upstream.status, {
    "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8"
  });
  context.response.end(Buffer.from(await upstream.arrayBuffer()));
}

async function proxyMacaulaySearch(context, url) {
  const taxonCode = String(url.searchParams.get("taxonCode") || "").trim();
  const query = String(url.searchParams.get("q") || "").trim();
  if (!taxonCode && !query) {
    return json(context.response, 400, { error: "Missing Macaulay Library taxonCode or query" });
  }

  const upstreamUrl = new URL("https://media.ebird.org/api/v1/search");
  if (taxonCode) {
    upstreamUrl.searchParams.set("taxonCode", taxonCode);
  } else {
    upstreamUrl.searchParams.set("q", query);
    upstreamUrl.searchParams.set("searchField", "species");
  }
  upstreamUrl.searchParams.set("mediaType", "photo");
  upstreamUrl.searchParams.set("sort", "rating_rank_desc");
  upstreamUrl.searchParams.set("birdOnly", "true");
  upstreamUrl.searchParams.set("count", "5");

  const upstream = await context.fetchImpl(upstreamUrl.toString(), {
    headers: {
      accept: "application/json",
      "user-agent": context.request.headers["user-agent"] || "BeauBird Site"
    }
  });

  if (!upstream.ok) {
    return json(context.response, upstream.status, { error: `Macaulay Library search returned HTTP ${upstream.status}` });
  }

  const payload = await upstream.json();
  return json(context.response, 200, { results: normalizeMacaulaySearchResults(payload, { taxonCode, query }) });
}

async function proxyMacaulayAsset(context, rawAssetId) {
  const assetId = normalizeMacaulayAssetId(rawAssetId);
  if (!assetId) {
    return json(context.response, 400, { error: "Invalid Macaulay Library asset id" });
  }

  const upstreamUrl = `https://cdn.download.ams.birds.cornell.edu/api/v1/asset/${assetId}/1200`;
  const upstream = await context.fetchImpl(upstreamUrl, {
    headers: {
      accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      "user-agent": context.request.headers["user-agent"] || "BeauBird Site"
    }
  });
  const contentType = String(upstream.headers.get("content-type") || "").split(";")[0].toLowerCase();
  if (!upstream.ok) {
    return json(context.response, upstream.status, { error: `Macaulay Library asset returned HTTP ${upstream.status}` });
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
    return json(context.response, 502, { error: "Macaulay Library asset was not a supported image" });
  }

  context.response.writeHead(200, {
    "content-type": contentType,
    "x-content-type-options": "nosniff"
  });
  context.response.end(Buffer.from(await upstream.arrayBuffer()));
}

function normalizeMacaulayAssetId(value) {
  const match = String(value || "").trim().match(/^(?:ML)?(\d+)$/i);
  return match ? match[1] : "";
}

function normalizeMacaulaySearchResults(payload, criteria = {}) {
  const content = Array.isArray(payload?.results?.content)
    ? payload.results.content
    : Array.isArray(payload?.content)
      ? payload.content
      : [];
  const seen = new Set();
  const results = [];

  for (const item of content) {
    const assetId = normalizeMacaulayAssetId(item?.assetId || item?.catalogId);
    if (!assetId || seen.has(assetId) || !isMacaulayMediaMatch(item, criteria)) {
      continue;
    }
    seen.add(assetId);
    const previewUrl = item?.largeUrl || item?.mediaUrl || `https://cdn.download.ams.birds.cornell.edu/api/v1/asset/${assetId}/1200`;
    results.push({
      mlId: `ML${assetId}`,
      assetId,
      attribution: String(item?.userDisplayName || item?.recorder || "").trim(),
      rating: item?.rating == null || item.rating === "" ? null : Number(item.rating),
      checklistId: String(item?.eBirdChecklistId || "").trim(),
      previewUrl,
      sourceUrl: item?.specimenUrl || `https://macaulaylibrary.org/asset/${assetId}`
    });
  }

  return results.slice(0, 5);
}

function isMacaulayMediaMatch(item, criteria = {}) {
  if (String(item?.mediaType || "").toLowerCase() !== "photo") {
    return false;
  }
  const taxonCode = String(criteria.taxonCode || "").trim().toLowerCase();
  if (taxonCode) {
    return getMacaulayItemSpeciesCodes(item).some((code) => code === taxonCode);
  }
  const query = normalizeMacaulayQuery(criteria.query);
  if (!query) {
    return true;
  }
  return getMacaulayItemNames(item).some((name) => normalizeMacaulayQuery(name) === query);
}

function getMacaulayItemSpeciesCodes(item) {
  return [
    item?.speciesCode,
    item?.reportAs,
    ...(Array.isArray(item?.subjectData) ? item.subjectData.map((subject) => subject?.speciesCode) : [])
  ]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);
}

function getMacaulayItemNames(item) {
  return [
    item?.sciName,
    item?.commonName,
    ...(Array.isArray(item?.subjectData) ? item.subjectData.flatMap((subject) => [subject?.sciName, subject?.comName]) : [])
  ].filter(Boolean);
}

function normalizeMacaulayQuery(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function serveStatic(context, pathname) {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const publicRelative = relative.replace(/\\/g, "/");
  if (!PUBLIC_ROOT_FILES.has(publicRelative) && !PUBLIC_PREFIXES.some((prefix) => publicRelative.startsWith(prefix))) {
    return text(context.response, 404, "Not found");
  }
  const resolved = normalize(resolve(context.projectRoot, relative));
  const root = normalize(context.projectRoot);
  if (resolved !== root && !resolved.startsWith(root + sep)) {
    return text(context.response, 403, "Forbidden");
  }
  if (!existsSync(resolved) || !statSync(resolved).isFile()) {
    return text(context.response, 404, "Not found");
  }
  const type = MIME_TYPES[extname(resolved).toLowerCase()] || "application/octet-stream";
  setBaseHeaders(context.response, type);
  createReadStream(resolved).pipe(context.response);
}

function verifyCsrf(context, request) {
  return request.headers["x-csrf-token"] && request.headers["x-csrf-token"] === context.session?.csrfToken;
}

function setSessionCookie(response, value, secure, maxAgeMs) {
  const parts = [`bb_session=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${Math.floor(maxAgeMs / 1000)}`];
  if (secure) {
    parts.push("Secure");
  }
  response.setHeader("Set-Cookie", parts.join("; "));
}

function readCookie(request, name) {
  const header = request.headers.cookie || "";
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) {
      return value.join("=");
    }
  }
  return "";
}

function getClientIp(request) {
  return String(request.headers["x-forwarded-for"] || request.socket.remoteAddress || "").split(",")[0].trim();
}

async function readRaw(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(request) {
  const raw = await readRaw(request);
  if (!raw.length) {
    return {};
  }
  return JSON.parse(raw.toString("utf8"));
}

function setBaseHeaders(response, contentType) {
  response.setHeader("Content-Type", contentType);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "same-origin");
  response.setHeader("X-Frame-Options", "DENY");
  if (contentType.startsWith("text/html")) {
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://api.ebird.org https://api.birdreport.cn; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    );
  }
}

function html(response, body) {
  setBaseHeaders(response, "text/html; charset=utf-8");
  response.writeHead(200);
  response.end(body);
}

function json(response, status, payload) {
  setBaseHeaders(response, "application/json; charset=utf-8");
  response.writeHead(status);
  response.end(JSON.stringify(payload));
}

function text(response, status, payload) {
  setBaseHeaders(response, "text/plain; charset=utf-8");
  response.writeHead(status);
  response.end(payload);
}

function redirect(response, location) {
  response.writeHead(302, { location });
  response.end();
}

module.exports = {
  createSiteServer
};
