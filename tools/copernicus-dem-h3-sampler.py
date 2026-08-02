"""Deterministically sample Copernicus DEM GLO-30 into H3 r6 terrain rows.

The Node wrapper owns the frozen H3 catalogue, file hashes and output
validation. This helper has no network access and writes no files.
"""

import json
import math
import sys

import numpy as np
from PIL import Image


WGS84_A = 6378137.0
WGS84_E2 = 6.6943799901413165e-3


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
        cell["maxLongitude"] < tile["west"]
        or cell["minLongitude"] > tile["east"]
        or cell["maxLatitude"] < tile["south"]
        or cell["minLatitude"] > tile["north"]
    )


def geokey_value(keys, target):
    values = list(keys or ())
    if len(values) < 4:
        return None
    for index in range(int(values[3])):
        start = 4 + index * 4
        if start + 3 >= len(values):
            break
        key_id, tag_location, count, value_offset = values[start : start + 4]
        if int(key_id) == target and int(tag_location) == 0 and int(count) == 1:
            return int(value_offset)
    return None


def parse_nodata(image):
    raw = image.tag_v2.get(42113)
    if isinstance(raw, (tuple, list)):
        raw = raw[0] if raw else None
    if isinstance(raw, bytes):
        raw = raw.decode("ascii", "ignore")
    if raw is None:
        return None
    try:
        return float(str(raw).strip().rstrip("\x00"))
    except ValueError:
        return None


def validate_georeferencing(image, tile, expected_posts):
    tags = image.tag_v2
    scale = tags.get(33550)
    tiepoint = tags.get(33922)
    expected_scale = 1.0 / (expected_posts - 1)
    if image.format != "TIFF" or image.mode != "F" or len(image.getbands()) != 1:
        fail(
            "Copernicus DEM tile 必须是单波段 float32 GeoTIFF。",
            {
                "tileId": tile["tileId"],
                "format": image.format,
                "mode": image.mode,
                "bands": list(image.getbands()),
            },
        )
    if (
        image.size != (expected_posts, expected_posts)
        or scale is None
        or len(scale) < 2
        or not math.isclose(float(scale[0]), expected_scale, rel_tol=0, abs_tol=1e-12)
        or not math.isclose(float(scale[1]), expected_scale, rel_tol=0, abs_tol=1e-12)
    ):
        fail(
            "Copernicus DEM tile 尺寸或 1 arc-second 网格不符合冻结契约。",
            {
                "tileId": tile["tileId"],
                "size": list(image.size),
                "pixelScale": list(scale or ()),
            },
        )
    if (
        tiepoint is None
        or len(tiepoint) < 6
        or not math.isclose(float(tiepoint[3]), float(tile["west"]), rel_tol=0, abs_tol=1e-9)
        or not math.isclose(float(tiepoint[4]), float(tile["north"]), rel_tol=0, abs_tol=1e-9)
    ):
        fail(
            "Copernicus DEM tile 原点与冻结 geocell 不一致。",
            {"tileId": tile["tileId"], "tiepoint": list(tiepoint or ())},
        )
    if geokey_value(tags.get(34735), 2048) != 4326:
        fail(
            "Copernicus DEM tile 水平 CRS 不是 EPSG:4326。",
            {"tileId": tile["tileId"]},
        )
    vertical_crs = geokey_value(tags.get(34735), 4096)
    if vertical_crs is not None and vertical_crs != 3855:
        fail(
            "Copernicus DEM tile 竖直 CRS 不是 EPSG:3855。",
            {
                "tileId": tile["tileId"],
                "verticalCrs": vertical_crs,
            },
        )
    raster_type = geokey_value(tags.get(34735), 1025)
    if raster_type != 2:
        fail(
            "Copernicus DEM tile 不是 RasterPixelIsPoint。",
            {"tileId": tile["tileId"], "rasterType": raster_type},
        )


def metric_spacing(latitudes, angular_spacing):
    phi = np.deg2rad(latitudes)
    sin_squared = np.sin(phi) ** 2
    denominator = np.sqrt(1.0 - WGS84_E2 * sin_squared)
    prime_vertical_radius = WGS84_A / denominator
    meridional_radius = (
        WGS84_A
        * (1.0 - WGS84_E2)
        / (1.0 - WGS84_E2 * sin_squared) ** 1.5
    )
    angular_radians = math.radians(angular_spacing)
    x_spacing = prime_vertical_radius * np.cos(phi) * angular_radians
    y_spacing = meridional_radius * angular_radians
    return x_spacing, y_spacing


def valid_values(values, nodata):
    valid = np.isfinite(values)
    if nodata is not None and math.isfinite(nodata):
        valid &= values != nodata
    return valid


def sample_cell(image, tile, cell, stride, offset, expected_posts, nodata):
    angular_spacing = 1.0 / (expected_posts - 1)
    minimum_column = max(
        1,
        int(math.ceil((max(cell["minLongitude"], tile["west"]) - tile["west"]) / angular_spacing)),
    )
    maximum_column = min(
        expected_posts - 2,
        int(math.floor((min(cell["maxLongitude"], tile["east"]) - tile["west"]) / angular_spacing)),
    )
    minimum_row = max(
        1,
        int(math.ceil((tile["north"] - min(cell["maxLatitude"], tile["north"])) / angular_spacing)),
    )
    maximum_row = min(
        expected_posts - 2,
        int(math.floor((tile["north"] - max(cell["minLatitude"], tile["south"])) / angular_spacing)),
    )
    columns = aligned_indexes(minimum_column, maximum_column, stride, offset)
    rows = aligned_indexes(minimum_row, maximum_row, stride, offset)
    if not len(columns) or not len(rows):
        return 0, 0.0, 0.0, 0, 0.0

    crop_left = int(columns[0]) - 1
    crop_top = int(rows[0]) - 1
    crop_right = int(columns[-1]) + 2
    crop_bottom = int(rows[-1]) + 2
    raster = np.asarray(
        image.crop((crop_left, crop_top, crop_right, crop_bottom)),
        dtype=np.float64,
    )
    if raster.ndim == 3:
        raster = raster[:, :, 0]
    center_rows = rows - crop_top
    center_columns = columns - crop_left
    row_grid, column_grid = np.meshgrid(center_rows, center_columns, indexing="ij")

    longitudes = tile["west"] + columns.astype(np.float64) * angular_spacing
    latitudes = tile["north"] - rows.astype(np.float64) * angular_spacing
    longitude_grid, latitude_grid = np.meshgrid(longitudes, latitudes)
    inside = points_in_polygon(longitude_grid, latitude_grid, cell["boundary"])

    z5 = raster[row_grid, column_grid]
    elevation_valid = inside & valid_values(z5, nodata)
    elevations = z5[elevation_valid]
    elevation_count = int(elevations.size)
    elevation_sum = float(np.sum(elevations, dtype=np.float64))
    elevation_sum_squares = float(
        np.sum(elevations * elevations, dtype=np.float64)
    )

    z1 = raster[row_grid - 1, column_grid - 1]
    z2 = raster[row_grid - 1, column_grid]
    z3 = raster[row_grid - 1, column_grid + 1]
    z4 = raster[row_grid, column_grid - 1]
    z6 = raster[row_grid, column_grid + 1]
    z7 = raster[row_grid + 1, column_grid - 1]
    z8 = raster[row_grid + 1, column_grid]
    z9 = raster[row_grid + 1, column_grid + 1]
    slope_valid = inside.copy()
    for values in (z1, z2, z3, z4, z5, z6, z7, z8, z9):
        slope_valid &= valid_values(values, nodata)
    x_spacing, y_spacing = metric_spacing(latitude_grid, angular_spacing)
    dz_dx = ((z3 + 2.0 * z6 + z9) - (z1 + 2.0 * z4 + z7)) / (
        8.0 * x_spacing
    )
    dz_dy = ((z7 + 2.0 * z8 + z9) - (z1 + 2.0 * z2 + z3)) / (
        8.0 * y_spacing
    )
    slopes = np.rad2deg(np.arctan(np.sqrt(dz_dx * dz_dx + dz_dy * dz_dy)))
    valid_slopes = slopes[slope_valid & np.isfinite(slopes)]
    slope_count = int(valid_slopes.size)
    slope_sum = float(np.sum(valid_slopes, dtype=np.float64))
    return (
        elevation_count,
        elevation_sum,
        elevation_sum_squares,
        slope_count,
        slope_sum,
    )


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception as error:
        fail(f"无法解析地形抽样输入：{error}")
    stride = int(payload.get("stridePosts", 0))
    offset = int(payload.get("offsetPosts", -1))
    expected_posts = int(payload.get("sourceTilePosts", 0))
    cells = payload.get("cells")
    tiles = payload.get("tiles")
    if (
        stride <= 0
        or offset < 0
        or offset >= stride
        or expected_posts <= 2
        or not isinstance(cells, list)
        or not cells
        or not isinstance(tiles, list)
    ):
        fail("地形抽样契约或输入非法。")

    accumulators = {
        cell["h3Index"]: {
            "h3Index": cell["h3Index"],
            "elevationSampleCount": 0,
            "elevationSum": 0.0,
            "elevationSumSquares": 0.0,
            "slopeSampleCount": 0,
            "slopeSum": 0.0,
        }
        for cell in cells
    }
    Image.MAX_IMAGE_PIXELS = None
    for tile in sorted(tiles, key=lambda item: item["tileId"]):
        try:
            image = Image.open(tile["path"])
        except Exception as error:
            fail(
                f"无法读取 Copernicus DEM GeoTIFF：{error}",
                {"tileId": tile.get("tileId"), "path": tile.get("path")},
            )
        try:
            validate_georeferencing(image, tile, expected_posts)
            nodata = parse_nodata(image)
            for cell in cells:
                if not tile_overlap(cell, tile):
                    continue
                values = sample_cell(
                    image,
                    tile,
                    cell,
                    stride,
                    offset,
                    expected_posts,
                    nodata,
                )
                target = accumulators[cell["h3Index"]]
                target["elevationSampleCount"] += values[0]
                target["elevationSum"] += values[1]
                target["elevationSumSquares"] += values[2]
                target["slopeSampleCount"] += values[3]
                target["slopeSum"] += values[4]
        finally:
            image.close()
    json.dump(
        {
            "ok": True,
            "cells": [accumulators[key] for key in sorted(accumulators)],
        },
        sys.stdout,
        ensure_ascii=False,
        separators=(",", ":"),
        allow_nan=False,
    )


if __name__ == "__main__":
    main()
