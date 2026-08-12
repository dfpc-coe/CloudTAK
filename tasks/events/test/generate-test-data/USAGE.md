# generate-test-data — Install & Usage

## Prerequisites

- Python virtual environment at `.venv/` in the repo root
- GDAL installed via Homebrew (`brew install gdal`)

## Install

Run once from the repo root. Activate the venv in every new shell session.

```bash
source .venv/bin/activate
pip install -e tasks/events/test/generate-test-data
```

If you recreate the venv or move the package, re-run the `pip install` line above.

## Output location

`--out` is relative to `tasks/events/test/fixtures/`. You supply the subfolder and filename:

```
tasks/events/test/fixtures/<your-subfolder>/<filename>
```

## Basic usage

Omit `--region` to sample across all of Colorado:

```bash
generate-test-data \
  --out colorado_points/random_points.shp \
  --count 150 \
  --compress
```

## Sample inside a named boundary

Pass a single name to `--region`:

```bash
generate-test-data \
  --out larimer/points.shp \
  --count 100 \
  --region Larimer \
  --compress
```

## Sample inside a custom bbox

Pass 4 coordinates to `--region`:

```bash
generate-test-data \
  --out custom/points.shp \
  --count 100 \
  --region -105.15 -104.75 39.60 39.85 \
  --compress
```

## All options

| Flag | Default | Description |
|---|---|---|
| `--out` | required | Output path relative to `fixtures/` |
| `--count` | 100 | Number of features to generate |
| `--geom_type` | POINT | Geometry type: POINT, LINESTRING, POLYGON |
| `--driver` | auto | GDAL driver: ESRI Shapefile, GeoJSON, GPKG, KML |
| `--epsg` | 4326 | Output spatial reference |
| `--region` | all of Colorado | Named boundary (e.g. `Denver`) or bbox as `min_lon max_lon min_lat max_lat` |
| `--compress` | false | Compress output: `.zip` for shapefiles, `.kmz` for KML |
