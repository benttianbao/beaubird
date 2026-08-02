"""Regression tests for deterministic Copernicus DEM sampling math."""

import importlib.util
import math
from pathlib import Path

import numpy as np
from PIL import Image


MODULE_PATH = Path(__file__).with_name(
    "copernicus-dem-h3-sampler.py"
)
SPEC = importlib.util.spec_from_file_location(
    "copernicus_dem_h3_sampler", MODULE_PATH
)
SAMPLER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SAMPLER)


assert np.array_equal(
    SAMPLER.aligned_indexes(1, 10, 3, 1),
    np.array([1, 4, 7, 10]),
)
assert np.array_equal(
    SAMPLER.aligned_indexes(2, 10, 3, 1),
    np.array([4, 7, 10]),
)

posts = 11
row_grid, column_grid = np.meshgrid(
    np.arange(posts, dtype=np.float32),
    np.arange(posts, dtype=np.float32),
    indexing="ij",
)
raster = column_grid * 2.0 + row_grid * 3.0
image = Image.fromarray(raster, mode="F")
tile = {
    "tileId": "N00_00_E000_00",
    "west": 0.0,
    "east": 1.0,
    "south": 0.0,
    "north": 1.0,
}
cell = {
    "h3Index": "synthetic",
    "minLongitude": 0.0,
    "maxLongitude": 1.0,
    "minLatitude": 0.0,
    "maxLatitude": 1.0,
    "boundary": [
        [0.0, 0.0],
        [1.0, 0.0],
        [1.0, 1.0],
        [0.0, 1.0],
    ],
}
(
    elevation_count,
    elevation_sum,
    elevation_sum_squares,
    slope_count,
    slope_sum,
) = SAMPLER.sample_cell(
    image,
    tile,
    cell,
    stride=1,
    offset=0,
    expected_posts=posts,
    nodata=None,
)
assert elevation_count == 81
assert slope_count == 81
sample_rows = np.arange(1, 10, dtype=np.float64)
sample_columns = np.arange(1, 10, dtype=np.float64)
expected_elevations = (
    sample_columns[np.newaxis, :] * 2.0
    + sample_rows[:, np.newaxis] * 3.0
)
assert math.isclose(
    elevation_sum,
    float(expected_elevations.sum()),
    rel_tol=0,
    abs_tol=1e-12,
)
assert math.isclose(
    elevation_sum_squares,
    float((expected_elevations**2).sum()),
    rel_tol=0,
    abs_tol=1e-12,
)
latitudes = 1.0 - sample_rows / (posts - 1)
latitude_grid = np.repeat(
    latitudes[:, np.newaxis], 9, axis=1
)
x_spacing, y_spacing = SAMPLER.metric_spacing(
    latitude_grid, 1.0 / (posts - 1)
)
expected_slopes = np.rad2deg(
    np.arctan(
        np.sqrt(
            (2.0 / x_spacing) ** 2
            + (3.0 / y_spacing) ** 2
        )
    )
)
assert math.isclose(
    slope_sum,
    float(expected_slopes.sum()),
    rel_tol=0,
    abs_tol=1e-12,
)

print("Copernicus DEM sampler tests passed")
