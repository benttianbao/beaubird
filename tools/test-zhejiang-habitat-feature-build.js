"use strict";

const assert = require("node:assert/strict");
const {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  rmdirSync,
  unlinkSync
} = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const {
  buildFeatureCells,
  habitatFeatureGenerationImplementationSha256,
  requiredTileIds,
  sampleWorldCover,
  tileBounds,
  tileId
} = require("./build-zhejiang-habitat-features");

function testDirectory(name) {
  return mkdtempSync(join(tmpdir(), `beaubird-${name}-`));
}

function cleanupDirectory(directory) {
  if (!existsSync(directory)) return;
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    try {
      chmodSync(path, 0o666);
    } catch {
      // Windows ACLs may ignore POSIX mode bits.
    }
    unlinkSync(path);
  }
  rmdirSync(directory);
}

test("WorldCover tile 选择在 3×3 度边界上确定且完整", () => {
  assert.equal(tileId(30.1, 120.1), "N30E120");
  assert.equal(tileId(29.9, 119.9), "N27E117");
  assert.deepEqual(tileBounds("N30E120"), {
    south: 30,
    west: 120,
    north: 33,
    east: 123
  });
  assert.deepEqual(requiredTileIds([{
    minLatitude: 29.9,
    maxLatitude: 30.1,
    minLongitude: 119.9,
    maxLongitude: 120.1
  }]), ["N27E117", "N27E120", "N30E117", "N30E120"]);
});

test("生成实现 SHA 稳定且抽样计数严格守恒", () => {
  const first = habitatFeatureGenerationImplementationSha256();
  const second = habitatFeatureGenerationImplementationSha256();
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, second);
  const cells = buildFeatureCells([{
    h3Index: "86283082fffffff",
    sampleCount: 100,
    validSampleCount: 95,
    classCounts: { "10": 45, "80": 50 }
  }]);
  assert.equal(cells[0].coverage, 0.95);
  assert.equal(cells[0].classFractions["10"], 45 / 95);
  assert.equal(cells[0].classFractions["80"], 50 / 95);
  assert.equal(
    Object.values(cells[0].classFractions).reduce((sum, value) => sum + value, 0),
    1
  );
});

test("Pillow sampler 校验 EPSG:4326 geotags 并按多边形返回确定性分类", () => {
  const directory = testDirectory("worldcover-sampler");
  const tilePath = join(directory, "synthetic.tif");
  try {
    const create = spawnSync("python", [
      "-c",
      [
        "import numpy as np",
        "from PIL import Image, TiffImagePlugin",
        "a=np.full((30,30),10,dtype=np.uint8)",
        "a[:,15:]=80",
        "info=TiffImagePlugin.ImageFileDirectory_v2()",
        "info[33550]=(0.1,0.1,0.0)",
        "info[33922]=(0.0,0.0,0.0,0.0,3.0,0.0)",
        "info[34735]=(1,1,0,1,2048,0,1,4326)",
        "Image.fromarray(a,mode='L').save(__import__('sys').argv[1],tiffinfo=info,compression='tiff_deflate')"
      ].join(";"),
      tilePath
    ], { encoding: "utf8", windowsHide: true });
    assert.equal(create.status, 0, create.stderr);
    const sampled = sampleWorldCover({
      pythonPath: "python",
      samplingContract: {
        sourceTilePixels: 30,
        sampleStridePixels: 10,
        samplePixelOffset: 4
      },
      cells: [{
        h3Index: "fixture-cell",
        boundary: [[0, 0], [3, 0], [3, 3], [0, 3]],
        minLongitude: 0,
        minLatitude: 0,
        maxLongitude: 3,
        maxLatitude: 3
      }],
      tileManifest: {
        tiles: [{
          tileId: "N00E000",
          path: tilePath,
          west: 0,
          south: 0,
          east: 3,
          north: 3
        }]
      }
    });
    assert.equal(sampled.length, 1);
    assert.equal(sampled[0].sampleCount, 9);
    assert.equal(sampled[0].validSampleCount, 9);
    assert.equal(sampled[0].classCounts["10"] + sampled[0].classCounts["80"], 9);
  } finally {
    cleanupDirectory(directory);
  }
});
