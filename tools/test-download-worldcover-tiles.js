"use strict";

const assert = require("node:assert/strict");
const { mkdirSync, writeFileSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { randomUUID } = require("node:crypto");
const test = require("node:test");

const {
  WorldCoverDownloadError,
  downloadTiles,
  normalizeTileId,
  sha256File,
  tileFileName,
  usage
} = require("./download-worldcover-tiles");

test("WorldCover tile ID and official six-tile usage are deterministic", () => {
  assert.equal(normalizeTileId("n24e117"), "N24E117");
  assert.equal(
    tileFileName("N30E120"),
    "ESA_WorldCover_10m_2021_v200_N30E120_Map.tif"
  );
  assert.match(usage(), /N24E117,N24E120,N27E117,N27E120,N30E117,N30E120/);
  assert.doesNotMatch(usage(), /E123/);
  assert.throws(
    () => normalizeTileId("N27E123.tif"),
    (error) =>
      error instanceof WorldCoverDownloadError &&
      error.code === "WORLDCOVER_TILE_ID_INVALID"
  );
});

test("existing tiles are hash-checked without overwrite or network access", async () => {
  const directory = resolve(
    __dirname,
    "..",
    ".tmp",
    `worldcover-download-${randomUUID()}`
  );
  mkdirSync(directory, { recursive: true });
  const firstPath = join(directory, tileFileName("N24E117"));
  const secondPath = join(directory, tileFileName("N24E120"));
  writeFileSync(firstPath, "official-tile-fixture-a", "utf8");
  writeFileSync(secondPath, "official-tile-fixture-b", "utf8");
  const rows = await downloadTiles({
    tileIds: ["N24E120", "n24e117", "N24E117"],
    outputDirectory: directory
  });
  assert.deepEqual(
    rows.map((row) => ({
      tileId: row.tileId,
      skipped: row.skipped,
      fileSha256: row.fileSha256
    })),
    [
      {
        tileId: "N24E117",
        skipped: true,
        fileSha256: sha256File(firstPath)
      },
      {
        tileId: "N24E120",
        skipped: true,
        fileSha256: sha256File(secondPath)
      }
    ]
  );
});
