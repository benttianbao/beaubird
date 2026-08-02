"use strict";

const assert = require("node:assert/strict");
const {
  mkdtempSync,
  readFileSync,
  rmdirSync
} = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");

const {
  buildTerrainTileManifest
} = require("./build-zhejiang-terrain-features");
const {
  validateCatalog
} = require("./download-copernicus-dem-terrain-v11");

const projectRoot = resolve(__dirname, "..");
const preregistration = JSON.parse(
  readFileSync(
    join(
      projectRoot,
      "docs",
      "zhejiang-v1-20260715-terrain-v11-preregistration.json"
    ),
    "utf8"
  )
);
const sourceCatalog = validateCatalog(
  JSON.parse(
    readFileSync(
      join(
        projectRoot,
        preregistration.demSource.sourceCatalogPath
      ),
      "utf8"
    )
  ),
  preregistration.demSource.requiredTileIds
);
assert.equal(sourceCatalog.availableTileCount, 26);
assert.equal(sourceCatalog.unavailableTileCount, 1);
assert.deepEqual(
  sourceCatalog.products
    .filter(
      (item) =>
        item.sourceStatus ===
        "not_published_by_source"
    )
    .map((item) => item.tileId),
  ["N26_00_E121_00"]
);

const emptyCache = mkdtempSync(
  join(tmpdir(), "beaubird-terrain-catalog-")
);
try {
  const manifest = buildTerrainTileManifest(
    emptyCache,
    preregistration.demSource.requiredTileIds,
    sourceCatalog
  );
  assert.equal(
    manifest.tiles.filter(
      (tile) => tile.status === "not_published_by_source"
    ).length,
    1
  );
  assert.equal(
    manifest.tiles.filter(
      (tile) => tile.status === "not_present_in_local_cache"
    ).length,
    26
  );
  assert.equal(
    manifest.sourceCatalogManifestSha256,
    preregistration.demSource.sourceCatalogManifestSha256
  );
} finally {
  rmdirSync(emptyCache);
}

const downloaderSource = readFileSync(
  join(
    projectRoot,
    "tools",
    "download-copernicus-dem-terrain-v11.js"
  ),
  "utf8"
);
assert.equal(
  downloaderSource.includes('"location-trusted"'),
  false
);

process.stdout.write(
  "terrain source catalog tests passed\n"
);
