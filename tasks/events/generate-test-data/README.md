# generate-test-data

A small CLI for generating test spatial datasets and packaging them into zip archives.

## Install

```bash
source .venv/bin/activate
python -m pip install -e ./generate-test-data
```

## Usage

```bash
generate-test-data \
  --out data/random_points.shp \
  --geom_type POINT \
  --count 150 \
  --bbox -105.15 -104.75 39.60 39.85 \
  --zip
```

This creates the shapefile and a matching zip archive containing the component files.
