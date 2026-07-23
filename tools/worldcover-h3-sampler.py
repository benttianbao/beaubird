"""Deterministically sample ESA WorldCover COGs inside H3 r6 polygons.

The Node wrapper owns snapshot/H3 discovery and output validation. This helper
only reads local GeoTIFF files and returns anonymous class counts per H3 cell.
It intentionally has no network access and writes no files.
"""

import json
import math
import sys

import numpy as np
from PIL import Image


WORLD_COVER_CODES = (10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100)


def fail(message, details=None):
    payload = {"ok": False, "message": message}
    if details is not None:
        payload["details"] = details
    sys.stderr.write(json.dumps(payload, ensure_ascii=False) + "\n")
    raise SystemExit(1)


def aligned_indexes(first, last, stride, offset):
    if last < first:
        return np.empty(0, dtype=np.int64)
    start = first + ((offset - first) % stride)
    if start > last:
        return np.empty(0, dtype=np.int64)
    return np.arange(start, last + 1, stride, dtype=np.int64)


def points_in_polygon(longitudes, latitudes, boundary):
    inside = np.zeros(longitudes.shape, dtype=bool)
    xj, yj = boundary[-1]
    for xi, yi in boundary:
        crossing = (yi > latitudes) != (yj > latitudes)
        denominator = yj - yi
        if abs(denominator) < 1e-15:
            denominator = 1e-15
        intersection = (xj - xi) * (latitudes - yi) / denominator + xi
        inside ^= crossing & (longitudes < intersection)
        xj, yj = xi, yi
    return inside


def tile_overlap(cell, tile):
    return not (
        cell["maxLongitude"] <= tile["west"]
        or cell["minLongitude"] >= tile["east"]
        or cell["maxLatitude"] <= tile["south"]
        or cell["minLatitude"] >= tile["north"]
    )


def validate_georeferencing(image, tile, expected_pixels):
    tags = image.tag_v2
    scale = tags.get(33550)
    tiepoint = tags.get(33922)
    geokeys = tags.get(34735)
    expected_scale = (tile["east"] - tile["west"]) / expected_pixels
    if (
        scale is None
        or len(scale) < 2
        or not math.isclose(float(scale[0]), expected_scale, rel_tol=0, abs_tol=1e-12)
        or not math.isclose(float(scale[1]), expected_scale, rel_tol=0, abs_tol=1e-12)
    ):
        fail(
            "WorldCover tile 像元大小不符合冻结 EPSG:4326 契约。",
            {"tileId": tile["tileId"], "pixelScale": list(scale or ())},
        )
    if (
        tiepoint is None
        or len(tiepoint) < 6
        or not math.isclose(float(tiepoint[3]), float(tile["west"]), rel_tol=0, abs_tol=1e-9)
        or not math.isclose(float(tiepoint[4]), float(tile["north"]), rel_tol=0, abs_tol=1e-9)
    ):
        fail(
            "WorldCover tile 原点与文件名边界不一致。",
            {"tileId": tile["tileId"], "tiepoint": list(tiepoint or ())},
        )
    keys = list(geokeys or ())
    geographic_type = None
    if len(keys) >= 4:
        for index in range(int(keys[3])):
            start = 4 + index * 4
            if start + 3 >= len(keys):
                break
            key_id, tag_location, count, value_offset = keys[start : start + 4]
            if int(key_id) == 2048 and int(tag_location) == 0 and int(count) == 1:
                geographic_type = int(value_offset)
    if geographic_type != 4326:
        fail(
            "WorldCover tile CRS 不是 EPSG:4326。",
            {"tileId": tile["tileId"], "geographicType": geographic_type},
        )


def sample_cell_from_tile(image, tile, cell, stride, offset):
    width, height = image.size
    pixel_width = (tile["east"] - tile["west"]) / width
    pixel_height = (tile["north"] - tile["south"]) / height
    min_col = max(
        0,
        int(math.floor((max(cell["minLongitude"], tile["west"]) - tile["west"]) / pixel_width)),
    )
    max_col = min(
        width - 1,
        int(math.ceil((min(cell["maxLongitude"], tile["east"]) - tile["west"]) / pixel_width)) - 1,
    )
    min_row = max(
        0,
        int(math.floor((tile["north"] - min(cell["maxLatitude"], tile["north"])) / pixel_height)),
    )
    max_row = min(
        height - 1,
        int(math.ceil((tile["north"] - max(cell["minLatitude"], tile["south"])) / pixel_height)) - 1,
    )
    columns = aligned_indexes(min_col, max_col, stride, offset)
    rows = aligned_indexes(min_row, max_row, stride, offset)
    if not len(columns) or not len(rows):
        return 0, {}

    crop = image.crop(
        (
            int(columns[0]),
            int(rows[0]),
            int(columns[-1]) + 1,
            int(rows[-1]) + 1,
        )
    )
    raster = np.asarray(crop)
    if raster.ndim == 3:
        raster = raster[:, :, 0]
    raster = raster[::stride, ::stride]
    if raster.shape != (len(rows), len(columns)):
        fail(
            "GeoTIFF 抽样窗口形状异常。",
            {
                "tileId": tile["tileId"],
                "expected": [len(rows), len(columns)],
                "actual": list(raster.shape),
            },
        )

    x = tile["west"] + (columns.astype(np.float64) + 0.5) * pixel_width
    y = tile["north"] - (rows.astype(np.float64) + 0.5) * pixel_height
    longitudes, latitudes = np.meshgrid(x, y)
    inside = points_in_polygon(longitudes, latitudes, cell["boundary"])
    values = raster[inside]
    if values.size == 0:
        return 0, {}
    counts = {}
    for code in WORLD_COVER_CODES:
        count = int(np.count_nonzero(values == code))
        if count:
            counts[str(code)] = count
    return int(values.size), counts


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception as error:
        fail(f"无法解析抽样输入：{error}")
    stride = int(payload.get("sampleStridePixels", 0))
    offset = int(payload.get("samplePixelOffset", -1))
    expected_pixels = int(payload.get("sourceTilePixels", 0))
    if stride <= 0 or offset < 0 or offset >= stride or expected_pixels <= 0:
        fail("抽样契约参数非法。")
    cells = payload.get("cells")
    tiles = payload.get("tiles")
    if not isinstance(cells, list) or not cells or not isinstance(tiles, list) or not tiles:
        fail("抽样输入缺少 cells 或 tiles。")

    accumulators = {
        cell["h3Index"]: {
            "h3Index": cell["h3Index"],
            "sampleCount": 0,
            "classCounts": {str(code): 0 for code in WORLD_COVER_CODES},
        }
        for cell in cells
    }
    Image.MAX_IMAGE_PIXELS = None
    for tile in sorted(tiles, key=lambda item: item["tileId"]):
        try:
            image = Image.open(tile["path"])
        except Exception as error:
            fail(
                f"无法读取 WorldCover GeoTIFF：{error}",
                {"tileId": tile.get("tileId"), "path": tile.get("path")},
            )
        try:
            if image.size != (expected_pixels, expected_pixels):
                fail(
                    "WorldCover tile 尺寸不符合冻结契约。",
                    {
                        "tileId": tile["tileId"],
                        "expected": [expected_pixels, expected_pixels],
                        "actual": list(image.size),
                    },
                )
            validate_georeferencing(image, tile, expected_pixels)
            for cell in cells:
                if not tile_overlap(cell, tile):
                    continue
                sample_count, counts = sample_cell_from_tile(
                    image,
                    tile,
                    cell,
                    stride,
                    offset,
                )
                target = accumulators[cell["h3Index"]]
                target["sampleCount"] += sample_count
                for code, count in counts.items():
                    target["classCounts"][code] += count
        finally:
            image.close()

    results = []
    for h3_index in sorted(accumulators):
        result = accumulators[h3_index]
        result["validSampleCount"] = sum(result["classCounts"].values())
        if result["sampleCount"] <= 0:
            fail("H3 r6 单元没有落入任何 WorldCover 抽样像元。", {"h3Index": h3_index})
        results.append(result)
    json.dump({"ok": True, "cells": results}, sys.stdout, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
