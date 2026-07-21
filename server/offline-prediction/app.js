"use strict";

const http = require("node:http");
const { createReadStream, existsSync } = require("node:fs");
const { extname, join, resolve } = require("node:path");

const { OfflineModelCatalog } = require("./model-catalog");
const { locationPredictions, searchLocations } = require("./queries");

const STATIC_FILES = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/style.css", "style.css"],
  ["/app.js", "app.js"]
]);
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

function securityHeaders(response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
}

function json(response, statusCode, body) {
  securityHeaders(response);
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

function serveStatic(response, publicDirectory, pathname) {
  const fileName = STATIC_FILES.get(pathname);
  if (!fileName) return false;
  const filePath = join(publicDirectory, fileName);
  if (!existsSync(filePath)) return false;
  securityHeaders(response);
  response.statusCode = 200;
  response.setHeader("Content-Type", MIME_TYPES[extname(filePath)] || "application/octet-stream");
  createReadStream(filePath).pipe(response);
  return true;
}

function createOfflinePredictionServer(options = {}) {
  const projectRoot = resolve(options.projectRoot || join(__dirname, "..", ".."));
  const publicDirectory = resolve(options.publicDirectory || join(__dirname, "public"));
  const catalog =
    options.catalog ||
    new OfflineModelCatalog({
      modelDirectory: options.modelDirectory || join(projectRoot, "data", "prediction-models"),
      preferredModel: options.preferredModel
    });

  const server = http.createServer((request, response) => {
    let url;
    let pathname;
    try {
      url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return json(response, 400, { error: { code: "INVALID_REQUEST", message: "请求地址无效" } });
    }
    if (request.method !== "GET") {
      return json(response, 405, { error: { code: "METHOD_NOT_ALLOWED", message: "这里只接受读取请求" } });
    }
    try {
      if (pathname === "/api/health") {
        return json(response, 200, { ok: true, service: "beaubird-offline-prediction" });
      }
      if (pathname === "/api/models") {
        const list = catalog.list();
        return json(response, list.models.length ? 200 : 503, {
          ...list,
          error: list.models.length ? null : { code: "NO_MODEL", message: "没有找到包含完整预测结果的模型" }
        });
      }
      if (pathname === "/api/locations") {
        const { model, database } = catalog.database(url.searchParams.get("model"));
        return json(response, 200, {
          modelId: model.id,
          locations: searchLocations(database, {
            query: url.searchParams.get("q"),
            limit: url.searchParams.get("limit")
          })
        });
      }
      if (pathname === "/api/predictions") {
        const { model, database } = catalog.database(url.searchParams.get("model"));
        return json(response, 200, {
          model: { id: model.id, modelVersion: model.modelVersion, dataCutoffDate: model.dataCutoffDate },
          ...locationPredictions(database, {
            spaceUnitId: url.searchParams.get("spaceUnitId"),
            date: url.searchParams.get("date"),
            limit: url.searchParams.get("limit")
          })
        });
      }
      if (serveStatic(response, publicDirectory, pathname)) return;
      return json(response, 404, { error: { code: "NOT_FOUND", message: "页面或接口不存在" } });
    } catch (error) {
      return json(response, Number(error.statusCode) || 500, {
        error: {
          code: error.code || "OFFLINE_PREDICTION_ERROR",
          message: Number(error.statusCode) ? error.message : "离线预测读取失败"
        }
      });
    }
  });
  server.on("close", () => catalog.close());
  server.offlineModelCatalog = catalog;
  return server;
}

module.exports = { createOfflinePredictionServer };
