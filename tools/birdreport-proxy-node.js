const http = require("http");
const { URL } = require("url");

const HOST = "127.0.0.1";
const PORT = Number(process.env.BEAUBIRD_PROXY_PORT || 8788);

const endpointMap = {
  "/api/birdreport/province": {
    remotePath: "https://api.birdreport.cn/front/system/adcode/province",
    referer: "https://www.birdreport.cn/home/search/page.html"
  },
  "/api/birdreport/city": {
    remotePath: "https://api.birdreport.cn/front/system/adcode/city",
    referer: "https://www.birdreport.cn/home/search/page.html"
  },
  "/api/birdreport/district": {
    remotePath: "https://api.birdreport.cn/front/system/adcode/district",
    referer: "https://www.birdreport.cn/home/search/page.html"
  },
  "/api/birdreport/taxon": {
    remotePath: "https://api.birdreport.cn/front/record/activity/taxon",
    referer: "https://www.birdreport.cn/home/search/taxon.html"
  },
  "/api/birdreport/record": {
    remotePath: "https://api.birdreport.cn/front/record/search/page",
    referer: "https://www.birdreport.cn/home/search/record.html"
  },
  "/api/birdreport/summary": {
    remotePath: "https://api.birdreport.cn/front/record/chart/summary",
    referer: "https://www.birdreport.cn/home/search/page.html"
  }
};

const birdreportCookies = new Map();

function setCorsHeaders(response, contentType, contentLength) {
  response.setHeader("Content-Type", contentType);
  response.setHeader("Content-Length", String(contentLength));
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, timestamp, requestId, sign, X-Requested-With");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Private-Network", "true");
  response.setHeader("Cache-Control", "no-store");
}

function writeJson(response, statusCode, payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  response.writeHead(statusCode);
  setCorsHeaders(response, "application/json; charset=utf-8", body.length);
  response.end(body);
}

function buildCookieHeader() {
  if (!birdreportCookies.size) {
    return "";
  }
  return [...birdreportCookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function storeSetCookie(headers) {
  const values = headers.getSetCookie ? headers.getSetCookie() : headers.get("set-cookie");
  const cookieLines = Array.isArray(values) ? values : values ? [values] : [];
  for (const line of cookieLines) {
    const firstPart = String(line).split(";")[0];
    const separator = firstPart.indexOf("=");
    if (separator > 0) {
      birdreportCookies.set(firstPart.slice(0, separator).trim(), firstPart.slice(separator + 1).trim());
    }
  }
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function proxyFetch(remotePath, options = {}) {
  const { method = "POST", referer, contentType, body, headers = {}, accept } = options;
  const finalHeaders = {
    Accept: accept || "application/json, text/plain, */*",
    "Accept-Encoding": "identity",
    Origin: "https://www.birdreport.cn",
    Referer: referer,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    ...headers
  };

  const cookieHeader = buildCookieHeader();
  if (cookieHeader) {
    finalHeaders.Cookie = cookieHeader;
  }
  if (contentType) {
    finalHeaders["Content-Type"] = contentType;
  }

  const response = await fetch(remotePath, {
    method,
    headers: finalHeaders,
    body,
    redirect: "manual"
  });
  storeSetCookie(response.headers);

  return {
    status: response.status,
    contentType: response.headers.get("content-type") || "application/json; charset=utf-8",
    body: Buffer.from(await response.arrayBuffer())
  };
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${HOST}:${PORT}`);
    const path = requestUrl.pathname;

    if (request.method === "OPTIONS") {
      response.writeHead(200);
      setCorsHeaders(response, "application/json; charset=utf-8", 16);
      response.end('{"success":true}');
      return;
    }

    if (path === "/health") {
      writeJson(response, 200, { success: true, service: "birdreport-proxy-node" });
      return;
    }

    if (path === "/api/birdreport/captcha") {
      const remote = await proxyFetch(`https://api.birdreport.cn/front/code/visited/generate?timestamp=${Date.now()}`, {
        method: "GET",
        referer: "https://www.birdreport.cn/home/code/verify.html",
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
      });
      response.writeHead(remote.status);
      setCorsHeaders(response, remote.contentType, remote.body.length);
      response.end(remote.body);
      return;
    }

    if (path === "/api/birdreport/verify") {
      const body = await readRequestBody(request);
      const remote = await proxyFetch("https://api.birdreport.cn/front/code/visited/verify", {
        method: "POST",
        referer: "https://www.birdreport.cn/home/code/verify.html",
        contentType: "application/json; charset=UTF-8",
        body
      });
      response.writeHead(remote.status);
      setCorsHeaders(response, remote.contentType, remote.body.length);
      response.end(remote.body);
      return;
    }

    const target = endpointMap[path];
    if (!target) {
      writeJson(response, 404, { success: false, error: "Unknown endpoint" });
      return;
    }

    if (request.method !== "POST") {
      writeJson(response, 405, { success: false, error: "Method not allowed" });
      return;
    }

    const body = await readRequestBody(request);
    const remote = await proxyFetch(target.remotePath, {
      method: "POST",
      referer: target.referer,
      contentType: "application/x-www-form-urlencoded; charset=UTF-8",
      body,
      headers: {
        timestamp: request.headers.timestamp || "",
        requestId: request.headers.requestid || "",
        sign: request.headers.sign || ""
      }
    });

    response.writeHead(remote.status);
    setCorsHeaders(response, remote.contentType, remote.body.length);
    response.end(remote.body);
  } catch (error) {
    writeJson(response, 500, {
      success: false,
      error: error && error.message ? error.message : "Internal server error"
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`BirdReport node proxy listening on http://${HOST}:${PORT}`);
});
