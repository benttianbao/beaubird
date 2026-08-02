"use strict";

const { createHash } = require("node:crypto");
const {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync
} = require("node:fs");
const { basename, dirname, join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const {
  canonicalJson
} = require("../server/prediction/spatial-splits");

const DATASET = "COP-DEM_GLO-30-DGED/2024_1";
const DATASET_ID = "COP-DEM_GLO-30-DGED";
const RELEASE = "2024_1";
const CATALOGUE_ENDPOINT =
  "https://catalogue.dataspace.copernicus.eu/odata/v1/Products";
const TOKEN_ENDPOINT =
  "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
const DOWNLOAD_HOST =
  "download.dataspace.copernicus.eu";
const CATALOG_KIND =
  "zhejiang_true_terrain_v11_copernicus_dem_catalog_v1";

class CopernicusDemDownloadError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "CopernicusDemDownloadError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function parseArguments(argv) {
  const options = {
    mode: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = () => {
      index += 1;
      if (index >= argv.length) {
        throw new CopernicusDemDownloadError(
          "COPERNICUS_DEM_OPTIONS_INVALID",
          `${argument} 缺少值。`
        );
      }
      return argv[index];
    };
    if (argument === "--preregistration") {
      options.preregistrationPath = value();
    } else if (argument === "--output-dir") {
      options.outputDirectory = value();
    } else if (argument === "--catalog") {
      options.catalogPath = value();
    } else if (argument === "--catalog-only") {
      options.mode = "catalog-only";
    } else if (argument === "--download") {
      options.mode = "download";
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new CopernicusDemDownloadError(
        "COPERNICUS_DEM_OPTIONS_INVALID",
        `未知参数：${argument}`
      );
    }
  }
  return options;
}

function usage() {
  return "node tools/download-copernicus-dem-terrain-v11.js --preregistration docs/zhejiang-v1-20260715-terrain-v11-preregistration.json --output-dir data/prediction-features/copernicus-dem-glo-30-dged-2024_1 --catalog data/prediction-features/copernicus-dem-glo-30-dged-2024_1/catalog-v11.json <--catalog-only|--download>";
}

function assertOptions(options) {
  const missing = [
    "preregistrationPath",
    "outputDirectory",
    "catalogPath",
    "mode"
  ].filter((key) => !options[key]);
  if (
    missing.length ||
    !["catalog-only", "download"].includes(options.mode)
  ) {
    throw new CopernicusDemDownloadError(
      "COPERNICUS_DEM_OPTIONS_INVALID",
      "Copernicus DEM 下载器缺少冻结路径或运行模式。",
      { missing }
    );
  }
  const paths = {
    preregistrationPath: resolve(
      options.preregistrationPath
    ),
    outputDirectory: resolve(options.outputDirectory),
    catalogPath: resolve(options.catalogPath)
  };
  if (
    paths.catalogPath === paths.preregistrationPath ||
    dirname(paths.catalogPath) !== paths.outputDirectory
  ) {
    throw new CopernicusDemDownloadError(
      "COPERNICUS_DEM_PATH_INVALID",
      "目录清单必须位于专用 DEM 缓存目录，且不得覆盖预登记。"
    );
  }
  return paths;
}

function sha256Value(value) {
  return createHash("sha256")
    .update(canonicalJson(value), "utf8")
    .digest("hex");
}

async function sha256File(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

function gridIdForTile(tileId) {
  const match =
    /^([NS]\d{2})_00_([EW]\d{3})_00$/.exec(
      String(tileId)
    );
  if (!match) {
    throw new CopernicusDemDownloadError(
      "COPERNICUS_DEM_TILE_ID_INVALID",
      `非法冻结 tile ID：${tileId}`
    );
  }
  return `${match[1]}_${match[2]}`;
}

async function fetchJson(url, label) {
  const result = spawnSync(
    "curl.exe",
    [
      "--silent",
      "--show-error",
      "--fail",
      "--retry",
      "5",
      "--retry-all-errors",
      "--connect-timeout",
      "60",
      "--max-time",
      "180",
      "--header",
      "Accept: application/json",
      String(url)
    ],
    {
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024
    }
  );
  if (result.status !== 0) {
    throw new CopernicusDemDownloadError(
      "COPERNICUS_DEM_CATALOG_REQUEST_FAILED",
      `${label} 请求失败。`,
      {
        url: String(url),
        status: result.status,
        error:
          result.error?.message ||
          String(result.stderr || "").trim()
      }
    );
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new CopernicusDemDownloadError(
      "COPERNICUS_DEM_CATALOG_RESPONSE_INVALID",
      `${label} 未返回有效 JSON：${error.message}`
    );
  }
}

function singleResult(value, label) {
  const results = value?.result || value?.value;
  if (!Array.isArray(results) || results.length !== 1) {
    throw new CopernicusDemDownloadError(
      "COPERNICUS_DEM_CATALOG_AMBIGUOUS",
      `${label} 必须恰好返回一个结果。`,
      { resultCount: Array.isArray(results) ? results.length : null }
    );
  }
  return results[0];
}

async function resolveCatalogEntry(tileId) {
  const gridId = gridIdForTile(tileId);
  const filter = [
    "Attributes/OData.CSC.StringAttribute/any(att:",
    "att/Name eq 'dataset' and ",
    `att/OData.CSC.StringAttribute/Value eq '${DATASET}')`,
    " and ",
    "Attributes/OData.CSC.StringAttribute/any(att:",
    "att/Name eq 'gridId' and ",
    `att/OData.CSC.StringAttribute/Value eq '${gridId}')`
  ].join("");
  const url = new URL(CATALOGUE_ENDPOINT);
  url.searchParams.set("$filter", filter);
  url.searchParams.set(
    "$select",
    "Id,Name,ContentLength,S3Path,Checksum"
  );
  url.searchParams.set("$top", "10");
  const catalogResponse = await fetchJson(
    url,
    `catalog ${tileId}`
  );
  const catalogProducts = catalogResponse?.value;
  if (
    Array.isArray(catalogProducts) &&
    catalogProducts.length === 0
  ) {
    return {
      tileId,
      gridId,
      sourceStatus: "not_published_by_source",
      productId: null,
      productName: null,
      productContentLength: 0,
      productS3Path: null,
      productChecksums: [],
      packageNodeName: null,
      tileFolderName: null,
      demFileName: null,
      demContentLength: 0,
      downloadUrl: null
    };
  }
  const product = singleResult(
    catalogResponse,
    `catalog ${tileId}`
  );
  if (
    !/^[0-9a-f-]{36}$/i.test(String(product.Id || "")) ||
    !Number.isInteger(Number(product.ContentLength)) ||
    Number(product.ContentLength) <= 0
  ) {
    throw new CopernicusDemDownloadError(
      "COPERNICUS_DEM_PRODUCT_INVALID",
      `${tileId} 的产品标识或大小无效。`
    );
  }
  const rootUrl =
    `https://${DOWNLOAD_HOST}/odata/v1/Products(${product.Id})/Nodes`;
  const packageNode = singleResult(
    await fetchJson(rootUrl, `package ${tileId}`),
    `package ${tileId}`
  );
  const packageChildren = await fetchJson(
    packageNode.Nodes?.uri,
    `package children ${tileId}`
  );
  const expectedTileFolder =
    `Copernicus_DSM_10_${tileId}`;
  const tileNodes = (packageChildren.result || []).filter(
    (node) => node.Name === expectedTileFolder
  );
  const tileNode = singleResult(
    { result: tileNodes },
    `tile folder ${tileId}`
  );
  const tileChildren = await fetchJson(
    tileNode.Nodes?.uri,
    `tile children ${tileId}`
  );
  const demNode = singleResult(
    {
      result: (tileChildren.result || []).filter(
        (node) => node.Name === "DEM"
      )
    },
    `DEM folder ${tileId}`
  );
  const demChildren = await fetchJson(
    demNode.Nodes?.uri,
    `DEM children ${tileId}`
  );
  const expectedDemFile =
    `${expectedTileFolder}_DEM.tif`;
  const demFile = singleResult(
    {
      result: (demChildren.result || []).filter(
        (node) => node.Name === expectedDemFile
      )
    },
    `DEM file ${tileId}`
  );
  const contentLength = Number(demFile.ContentLength);
  if (
    !Number.isInteger(contentLength) ||
    contentLength <= 0 ||
    !String(demFile.Nodes?.uri || "").endsWith("/Nodes")
  ) {
    throw new CopernicusDemDownloadError(
      "COPERNICUS_DEM_FILE_INVALID",
      `${tileId} 的 DEM GeoTIFF 节点无效。`
    );
  }
  return {
    tileId,
    gridId,
    sourceStatus: "published",
    productId: product.Id,
    productName: product.Name,
    productContentLength: Number(product.ContentLength),
    productS3Path: product.S3Path,
    productChecksums: product.Checksum || [],
    packageNodeName: packageNode.Name,
    tileFolderName: tileNode.Name,
    demFileName: demFile.Name,
    demContentLength: contentLength,
    downloadUrl:
      demFile.Nodes.uri.replace(
        /\/Nodes$/,
        "/$value"
      )
  };
}

function validateCatalog(catalog, requiredTileIds) {
  const content = {
    schemaVersion: catalog?.schemaVersion,
    kind: catalog?.kind,
    datasetId: catalog?.datasetId,
    release: catalog?.release,
    dataset: catalog?.dataset,
    tileCount: catalog?.tileCount,
    totalProductBytes: catalog?.totalProductBytes,
    totalDemBytes: catalog?.totalDemBytes,
    availableTileCount: catalog?.availableTileCount,
    unavailableTileCount: catalog?.unavailableTileCount,
    products: catalog?.products
  };
  const failures = [];
  if (
    content.schemaVersion !== 1 ||
    content.kind !== CATALOG_KIND ||
    content.datasetId !== DATASET_ID ||
    content.release !== RELEASE ||
    content.dataset !== DATASET ||
    content.tileCount !== 27 ||
    !Number.isInteger(content.availableTileCount) ||
    !Number.isInteger(content.unavailableTileCount) ||
    content.availableTileCount +
        content.unavailableTileCount !==
      27 ||
    !Array.isArray(content.products) ||
    content.products.length !== 27
  ) failures.push("schema");
  if (
    canonicalJson(
      (content.products || []).map((item) => item.tileId)
    ) !== canonicalJson(requiredTileIds)
  ) failures.push("tileIds");
  if (
    (content.products || []).some((item) => {
      if (
        item.sourceStatus ===
        "not_published_by_source"
      ) {
        return (
          item.productId !== null ||
          item.demFileName !== null ||
          item.productContentLength !== 0 ||
          item.demContentLength !== 0 ||
          item.downloadUrl !== null
        );
      }
      return (
        item.sourceStatus !== "published" ||
        item.demFileName !==
          `Copernicus_DSM_10_${item.tileId}_DEM.tif` ||
        !Number.isInteger(item.demContentLength) ||
        item.demContentLength <= 0 ||
        new URL(item.downloadUrl).hostname !==
          DOWNLOAD_HOST
      );
    })
  ) failures.push("products");
  if (
    Number(content.totalProductBytes) !==
      (content.products || []).reduce(
        (sum, item) =>
          sum + Number(item.productContentLength),
        0
      ) ||
    Number(content.totalDemBytes) !==
      (content.products || []).reduce(
        (sum, item) =>
          sum + Number(item.demContentLength),
        0
      )
  ) failures.push("byteTotals");
  if (
    catalog?.manifestSha256 !== sha256Value(content)
  ) failures.push("manifestSha256");
  if (failures.length) {
    throw new CopernicusDemDownloadError(
      "COPERNICUS_DEM_CATALOG_INVALID",
      "Copernicus DEM 目录清单未通过冻结校验。",
      { failures }
    );
  }
  return catalog;
}

async function buildCatalog(
  requiredTileIds,
  partialDirectory = null
) {
  const products = [];
  for (const tileId of requiredTileIds) {
    const partialPath = partialDirectory
      ? join(partialDirectory, `${tileId}.json`)
      : null;
    let entry;
    if (partialPath && existsSync(partialPath)) {
      entry = JSON.parse(
        readFileSync(partialPath, "utf8")
      );
      if (
        entry?.tileId !== tileId ||
        ![
          "published",
          "not_published_by_source"
        ].includes(entry?.sourceStatus)
      ) {
        throw new CopernicusDemDownloadError(
          "COPERNICUS_DEM_CATALOG_PART_INVALID",
          `${tileId} 的目录分片无效，拒绝覆盖。`
        );
      }
    } else {
      entry = await resolveCatalogEntry(tileId);
      if (partialPath) {
        mkdirSync(partialDirectory, {
          recursive: true
        });
        writeFileSync(
          partialPath,
          `${JSON.stringify(entry, null, 2)}\n`,
          {
            encoding: "utf8",
            flag: "wx"
          }
        );
      }
    }
    products.push(entry);
    process.stdout.write(
      `${JSON.stringify({
        phase: "catalog",
        tileId,
        sourceStatus: entry.sourceStatus,
        demBytes: entry.demContentLength,
        productBytes: entry.productContentLength
      })}\n`
    );
  }
  const content = {
    schemaVersion: 1,
    kind: CATALOG_KIND,
    datasetId: DATASET_ID,
    release: RELEASE,
    dataset: DATASET,
    tileCount: products.length,
    totalProductBytes: products.reduce(
      (sum, item) =>
        sum + item.productContentLength,
      0
    ),
    totalDemBytes: products.reduce(
      (sum, item) => sum + item.demContentLength,
      0
    ),
    availableTileCount: products.filter(
      (item) => item.sourceStatus === "published"
    ).length,
    unavailableTileCount: products.filter(
      (item) =>
        item.sourceStatus ===
        "not_published_by_source"
    ).length,
    products
  };
  return {
    ...content,
    manifestSha256: sha256Value(content)
  };
}

function catalogFromDisk(path, requiredTileIds) {
  if (!existsSync(path)) return null;
  return validateCatalog(
    JSON.parse(readFileSync(path, "utf8")),
    requiredTileIds
  );
}

function publishCatalog(path, catalog) {
  if (existsSync(path)) {
    throw new CopernicusDemDownloadError(
      "COPERNICUS_DEM_CATALOG_EXISTS",
      "目录清单已经存在，拒绝覆盖。",
      { path }
    );
  }
  const temporaryPath = `${path}.building-${process.pid}`;
  if (existsSync(temporaryPath)) {
    throw new CopernicusDemDownloadError(
      "COPERNICUS_DEM_TEMPORARY_EXISTS",
      "目录清单临时路径已存在，拒绝覆盖。",
      { temporaryPath }
    );
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    temporaryPath,
    `${JSON.stringify(catalog, null, 2)}\n`,
    "utf8"
  );
  renameSync(temporaryPath, path);
}

function authenticationAvailable() {
  return Boolean(
    process.env.CDSE_ACCESS_TOKEN ||
    (
      process.env.CDSE_USERNAME &&
      process.env.CDSE_PASSWORD
    )
  );
}

function createTokenProvider() {
  const staticToken =
    process.env.CDSE_ACCESS_TOKEN || null;
  const username = process.env.CDSE_USERNAME || null;
  const password = process.env.CDSE_PASSWORD || null;
  let token = staticToken;
  let refreshToken = null;
  let expiresAt = staticToken
    ? Number.POSITIVE_INFINITY
    : 0;

  async function requestToken(grantType) {
    const form = new URLSearchParams({
      client_id: "cdse-public",
      grant_type: grantType
    });
    if (
      grantType === "refresh_token" &&
      refreshToken
    ) {
      form.set("refresh_token", refreshToken);
    } else {
      if (!username || !password) {
        throw new CopernicusDemDownloadError(
          "COPERNICUS_DEM_AUTH_REQUIRED",
          "下载需要 CDSE_ACCESS_TOKEN，或 CDSE_USERNAME 与 CDSE_PASSWORD 环境变量。"
        );
      }
      form.set("username", username);
      form.set("password", password);
    }
    const result = spawnSync(
      "curl.exe",
      [
        "--silent",
        "--show-error",
        "--fail",
        "--location",
        "--request",
        "POST",
        "--header",
        "Content-Type: application/x-www-form-urlencoded",
        "--data-binary",
        "@-",
        TOKEN_ENDPOINT
      ],
      {
        input: form.toString(),
        encoding: "utf8",
        windowsHide: true,
        maxBuffer: 2 * 1024 * 1024
      }
    );
    if (result.status !== 0) {
      throw new CopernicusDemDownloadError(
        "COPERNICUS_DEM_AUTH_FAILED",
        "CDSE OAuth 认证失败。",
        {
          status: result.status,
          error:
            result.error?.message ||
            String(result.stderr || "").trim()
        }
      );
    }
    let value;
    try {
      value = JSON.parse(result.stdout);
    } catch {
      value = {};
    }
    if (!value.access_token) {
      throw new CopernicusDemDownloadError(
        "COPERNICUS_DEM_AUTH_FAILED",
        "CDSE OAuth 响应缺少 access_token。"
      );
    }
    token = value.access_token;
    refreshToken = value.refresh_token || refreshToken;
    expiresAt =
      Date.now() +
      Math.max(60, Number(value.expires_in) || 300) *
        1000;
    return token;
  }

  return async function accessToken({
    forceRefresh = false
  } = {}) {
    if (
      staticToken &&
      !forceRefresh
    ) return staticToken;
    if (
      !forceRefresh &&
      token &&
      Date.now() < expiresAt - 60_000
    ) return token;
    if (refreshToken) {
      try {
        return await requestToken("refresh_token");
      } catch {
        refreshToken = null;
      }
    }
    return requestToken("password");
  };
}

function curlConfigValue(value) {
  return String(value)
    .replaceAll("\\", "/")
    .replaceAll('"', '\\"')
    .replaceAll("\r", "")
    .replaceAll("\n", "");
}

function curlDownload({
  url,
  destination,
  token
}) {
  const config = [
    "silent",
    "show-error",
    "fail",
    "location",
    "retry = 3",
    "retry-delay = 2",
    "connect-timeout = 60",
    `url = "${curlConfigValue(url)}"`,
    `output = "${curlConfigValue(destination)}"`,
    `header = "Authorization: Bearer ${curlConfigValue(token)}"`,
    "continue-at = -"
  ].join("\n");
  return spawnSync(
    "curl.exe",
    ["--config", "-"],
    {
      input: config,
      encoding: "utf8",
      windowsHide: true,
      timeout: 30 * 60 * 1000,
      maxBuffer: 2 * 1024 * 1024
    }
  );
}

async function downloadEntry(
  entry,
  outputDirectory,
  tokenProvider
) {
  const destination = join(
    outputDirectory,
    entry.demFileName
  );
  const partial = `${destination}.part`;
  if (existsSync(destination)) {
    const size = statSync(destination).size;
    if (size !== entry.demContentLength) {
      throw new CopernicusDemDownloadError(
        "COPERNICUS_DEM_EXISTING_FILE_MISMATCH",
        "已有 DEM 文件大小与冻结目录不一致，拒绝覆盖。",
        { destination, expected: entry.demContentLength, actual: size }
      );
    }
    return {
      tileId: entry.tileId,
      fileName: entry.demFileName,
      bytes: size,
      sha256: await sha256File(destination),
      reused: true
    };
  }
  const partialBytes = existsSync(partial)
    ? statSync(partial).size
    : 0;
  if (partialBytes > entry.demContentLength) {
    throw new CopernicusDemDownloadError(
      "COPERNICUS_DEM_PARTIAL_FILE_INVALID",
      "DEM 断点文件大于冻结文件长度，拒绝覆盖。",
      { partial, partialBytes, expected: entry.demContentLength }
    );
  }
  let result;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    result = curlDownload({
      url: entry.downloadUrl,
      destination: partial,
      token: await tokenProvider({
        forceRefresh: attempt > 0
      })
    });
    if (result.status === 0) break;
  }
  if (result.status !== 0) {
    throw new CopernicusDemDownloadError(
      "COPERNICUS_DEM_DOWNLOAD_FAILED",
      `${entry.tileId} 下载失败。`,
      {
        status: result.status,
        error:
          result.error?.message ||
          String(result.stderr || "").trim()
      }
    );
  }
  const completedBytes = statSync(partial).size;
  if (completedBytes !== entry.demContentLength) {
    throw new CopernicusDemDownloadError(
      "COPERNICUS_DEM_DOWNLOAD_TRUNCATED",
      `${entry.tileId} 下载长度不完整。`,
      {
        expected: entry.demContentLength,
        actual: completedBytes
      }
    );
  }
  renameSync(partial, destination);
  return {
    tileId: entry.tileId,
    fileName: entry.demFileName,
    bytes: completedBytes,
    sha256: await sha256File(destination),
    reused: false
  };
}

async function run(options) {
  const paths = assertOptions(options);
  const preregistration = JSON.parse(
    readFileSync(paths.preregistrationPath, "utf8")
  );
  if (
    preregistration?.kind !==
      "zhejiang_true_terrain_v11_preregistration" ||
    preregistration?.demSource?.datasetId !==
      DATASET_ID ||
    preregistration?.demSource?.release !== RELEASE ||
    preregistration?.demSource?.downloadApproved !== false
  ) {
    throw new CopernicusDemDownloadError(
      "COPERNICUS_DEM_PREREGISTRATION_INVALID",
      "预登记不是待下载状态的真实 v11 Copernicus DEM 契约。"
    );
  }
  const requiredTileIds = [
    ...(preregistration.demSource.requiredTileIds || [])
  ].sort();
  if (
    requiredTileIds.length !== 27 ||
    new Set(requiredTileIds).size !== 27
  ) {
    throw new CopernicusDemDownloadError(
      "COPERNICUS_DEM_TILE_SET_INVALID",
      "预登记必须冻结恰好 27 个 DEM tile。"
    );
  }
  mkdirSync(paths.outputDirectory, {
    recursive: true
  });
  let catalog = catalogFromDisk(
    paths.catalogPath,
    requiredTileIds
  );
  if (!catalog) {
    catalog = await buildCatalog(
      requiredTileIds,
      join(paths.outputDirectory, "catalog-parts")
    );
    validateCatalog(catalog, requiredTileIds);
    publishCatalog(paths.catalogPath, catalog);
  }
  if (options.mode === "catalog-only") {
    return {
      ok: true,
      mode: options.mode,
      catalogPath: paths.catalogPath,
      manifestSha256: catalog.manifestSha256,
      tileCount: catalog.tileCount,
      totalProductBytes: catalog.totalProductBytes,
      totalDemBytes: catalog.totalDemBytes,
      availableTileCount:
        catalog.availableTileCount,
      unavailableTileCount:
        catalog.unavailableTileCount,
      authenticationAvailable:
        authenticationAvailable(),
      downloadStarted: false
    };
  }
  if (!authenticationAvailable()) {
    throw new CopernicusDemDownloadError(
      "COPERNICUS_DEM_AUTH_REQUIRED",
      "目录已冻结；下载需要设置 CDSE_ACCESS_TOKEN，或 CDSE_USERNAME 与 CDSE_PASSWORD 环境变量。"
    );
  }
  const tokenProvider = createTokenProvider();
  const files = [];
  for (
    const entry of catalog.products.filter(
      (item) => item.sourceStatus === "published"
    )
  ) {
    const file = await downloadEntry(
      entry,
      paths.outputDirectory,
      tokenProvider
    );
    files.push(file);
    process.stdout.write(
      `${JSON.stringify({
        phase: "download",
        ...file
      })}\n`
    );
  }
  return {
    ok: true,
    mode: options.mode,
    catalogPath: paths.catalogPath,
    manifestSha256: catalog.manifestSha256,
    tileCount: catalog.tileCount,
    downloadedTileCount: files.length,
    unavailableTileCount:
      catalog.unavailableTileCount,
    totalDemBytes: files.reduce(
      (sum, file) => sum + file.bytes,
      0
    ),
    files
  };
}

if (require.main === module) {
  (async () => {
    try {
      const options = parseArguments(
        process.argv.slice(2)
      );
      if (options.help) {
        process.stdout.write(`${usage()}\n`);
        return;
      }
      process.stdout.write(
        `${JSON.stringify(await run(options), null, 2)}\n`
      );
    } catch (error) {
      process.stderr.write(
        `${JSON.stringify({
          ok: false,
          code:
            error.code ||
            "COPERNICUS_DEM_DOWNLOAD_FAILED",
          message: error.message,
          details: error.details
        }, null, 2)}\n`
      );
      process.exitCode = 1;
    }
  })();
}

module.exports = {
  CATALOG_KIND,
  DATASET,
  DATASET_ID,
  RELEASE,
  CopernicusDemDownloadError,
  buildCatalog,
  gridIdForTile,
  parseArguments,
  run,
  usage,
  validateCatalog
};
