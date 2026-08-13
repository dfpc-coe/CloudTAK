import argparse
import os
import random

import argcomplete
from osgeo import ogr


DEFAULT_BOUNDARY_PATH = os.path.normpath(os.path.join(
    os.path.dirname(__file__), "..", "..", "colorado_boundaries.gpkg"
))

# Colorado-wide fallback when --region is omitted
_COLORADO_BBOX = [-109.06, -102.05, 37.00, 41.00]

# outputs land under tasks/events/test/fixtures/<subfolder>/
DEFAULT_FIXTURES_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "test", "fixtures")
)


def random_point_features(num_points, bbox):
    for i in range(1, num_points + 1):
        x = random.uniform(bbox[0], bbox[1])
        y = random.uniform(bbox[2], bbox[3])
        point = ogr.Geometry(ogr.wkbPoint)
        point.AddPoint(x, y)
        yield (point, {"id": i})


def random_polygon_features(num_polygons, bbox, size_fraction=0.02):
    # each polygon is a small rectangle around a random center
    dx = (bbox[1] - bbox[0]) * size_fraction
    dy = (bbox[3] - bbox[2]) * size_fraction
    for i in range(1, num_polygons + 1):
        cx = random.uniform(bbox[0] + dx, bbox[1] - dx)
        cy = random.uniform(bbox[2] + dy, bbox[3] - dy)
        w = random.uniform(dx * 0.3, dx)
        h = random.uniform(dy * 0.3, dy)
        ring = ogr.Geometry(ogr.wkbLinearRing)
        ring.AddPoint(cx - w, cy - h)
        ring.AddPoint(cx + w, cy - h)
        ring.AddPoint(cx + w, cy + h)
        ring.AddPoint(cx - w, cy + h)
        ring.AddPoint(cx - w, cy - h)
        poly = ogr.Geometry(ogr.wkbPolygon)
        poly.AddGeometry(ring)
        yield (poly, {"id": i})


def _make_point_generator(count, bbox):
    return lambda: random_point_features(count, bbox)


def _make_polygon_generator(count, bbox):
    return lambda: random_polygon_features(count, bbox)


def random_linestring_features(num_lines, bbox, num_vertices=4, step_fraction=0.03):
    # each vertex is a short random walk from the previous one
    extent_x = (bbox[1] - bbox[0]) * step_fraction
    extent_y = (bbox[3] - bbox[2]) * step_fraction
    for i in range(1, num_lines + 1):
        line = ogr.Geometry(ogr.wkbLineString)
        x = random.uniform(bbox[0] + extent_x, bbox[1] - extent_x)
        y = random.uniform(bbox[2] + extent_y, bbox[3] - extent_y)
        line.AddPoint(x, y)
        for _ in range(num_vertices - 1):
            x = max(bbox[0], min(bbox[1], x + random.uniform(-extent_x, extent_x)))
            y = max(bbox[2], min(bbox[3], y + random.uniform(-extent_y, extent_y)))
            line.AddPoint(x, y)
        yield (line, {"id": i})


def random_linestring_features_in_polygon(num_lines, polygon, num_vertices=4, step_fraction=0.03):
    envelope = polygon.GetEnvelope()
    min_x, max_x = envelope[0], envelope[1]
    min_y, max_y = envelope[2], envelope[3]
    extent_x = (max_x - min_x) * step_fraction
    extent_y = (max_y - min_y) * step_fraction

    generated = 0
    while generated < num_lines:
        start_x = random.uniform(min_x + extent_x, max_x - extent_x)
        start_y = random.uniform(min_y + extent_y, max_y - extent_y)
        start = ogr.Geometry(ogr.wkbPoint)
        start.AddPoint(start_x, start_y)
        if not start.Within(polygon):
            continue
        line = ogr.Geometry(ogr.wkbLineString)
        x, y = start_x, start_y
        line.AddPoint(x, y)
        for _ in range(num_vertices - 1):
            x = max(min_x, min(max_x, x + random.uniform(-extent_x, extent_x)))
            y = max(min_y, min(max_y, y + random.uniform(-extent_y, extent_y)))
            line.AddPoint(x, y)
        yield (line, {"id": generated + 1})
        generated += 1


def _make_linestring_generator(count, bbox):
    return lambda: random_linestring_features(count, bbox)


def random_point_features_in_polygon(num_points, polygon):
    envelope = polygon.GetEnvelope()
    min_x, max_x = envelope[0], envelope[1]
    min_y, max_y = envelope[2], envelope[3]

    generated = 0
    while generated < num_points:
        x = random.uniform(min_x, max_x)
        y = random.uniform(min_y, max_y)
        point = ogr.Geometry(ogr.wkbPoint)
        point.AddPoint(x, y)

        if point.Within(polygon):
            yield (point, {"id": generated + 1})
            generated += 1


def random_polygon_features_in_polygon(num_polygons, polygon, size_fraction=0.02):
    envelope = polygon.GetEnvelope()
    min_x, max_x = envelope[0], envelope[1]
    min_y, max_y = envelope[2], envelope[3]
    dx = (max_x - min_x) * size_fraction
    dy = (max_y - min_y) * size_fraction

    generated = 0
    while generated < num_polygons:
        cx = random.uniform(min_x + dx, max_x - dx)
        cy = random.uniform(min_y + dy, max_y - dy)
        center = ogr.Geometry(ogr.wkbPoint)
        center.AddPoint(cx, cy)
        if not center.Within(polygon):
            continue
        w = random.uniform(dx * 0.3, dx)
        h = random.uniform(dy * 0.3, dy)
        ring = ogr.Geometry(ogr.wkbLinearRing)
        ring.AddPoint(cx - w, cy - h)
        ring.AddPoint(cx + w, cy - h)
        ring.AddPoint(cx + w, cy + h)
        ring.AddPoint(cx - w, cy + h)
        ring.AddPoint(cx - w, cy - h)
        poly = ogr.Geometry(ogr.wkbPolygon)
        poly.AddGeometry(ring)
        yield (poly, {"id": generated + 1})
        generated += 1


def load_polygon_by_name(boundary_path, name):
    if not boundary_path or not os.path.exists(boundary_path):
        raise FileNotFoundError(
            f"Boundary file not found: {boundary_path}"
        )

    ds = ogr.Open(boundary_path)
    if ds is None:
        raise ValueError(f"Could not open boundary dataset: {boundary_path}")

    layer = ds.GetLayer()
    layer_defn = layer.GetLayerDefn()
    available_fields = {layer_defn.GetFieldDefn(i).GetName() for i in range(layer_defn.GetFieldCount())}

    for feature in layer:
        properties = ["NAME", "name", "COUNTYNAME", "county_name", "admin_name", "CITY"]
        for key in properties:
            if key not in available_fields:
                continue
            value = feature.GetField(key)
            if value is not None and str(value).lower() == str(name).lower():
                return feature.GetGeometryRef().Clone()

    raise ValueError(f"No polygon named '{name}' found in {boundary_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Generate spatial test data and optionally package it as a ZIP file."
    )
    parser.add_argument(
        "--out",
        required=True,
        help="Output path relative to test/fixtures/, e.g. 'tasks/events/test/fixtures/shapefile/filename.zip'",
    )
    parser.add_argument(
        "--geom_type",
        dest="geometry_type",
        default="POINT",
        help="Geometry type, e.g. POINT, LINESTRING, POLYGON",
    )
    parser.add_argument("--driver", default=None, help="GDAL driver name, e.g. ESRI Shapefile, GeoJSON, GPKG")
    parser.add_argument("--layer", default="layer", help="Layer name")
    parser.add_argument("--epsg", type=int, default=4326, help="EPSG code for the spatial reference")
    parser.add_argument("--count", type=int, default=100, help="Number of features to create")
    parser.add_argument(
        "--region",
        nargs="+",
        default=None,
        metavar="VALUE",
        help=(
            "Where to sample. Either a named boundary (e.g. 'Denver', 'Larimer') "
            "or a bbox as 4 numbers: min_lon max_lon min_lat max_lat. "
            "Omit to sample across all of Colorado."
        ),
    )
    parser.add_argument("--compress", action="store_true", help="Compress output: .zip for shapefiles, .kmz for KML")
    argcomplete.autocomplete(parser)
    args = parser.parse_args()

    from generate_test_data.generator import make_spatial_file, package_dataset_zip, compress_dataset

    out_path = os.path.join(DEFAULT_FIXTURES_DIR, args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    # If the user asked for an archive directly, derive the spatial path and auto-compress
    _ARCHIVE_TO_SPATIAL = {".zip": ".shp", ".kmz": ".kml"}
    out_ext = os.path.splitext(out_path)[1].lower()
    if out_ext in _ARCHIVE_TO_SPATIAL:
        spatial_path = os.path.splitext(out_path)[0] + _ARCHIVE_TO_SPATIAL[out_ext]
        compress = True
    else:
        spatial_path = out_path
        compress = args.compress

    _GEOM_BBOX_GENERATORS = {
        "POINT": _make_point_generator,
        "POLYGON": _make_polygon_generator,
        "LINESTRING": _make_linestring_generator,
        "LINE": _make_linestring_generator,
    }
    geom_key = args.geometry_type.upper()
    if geom_key not in _GEOM_BBOX_GENERATORS:
        parser.error(f"--geom_type must be one of: {', '.join(_GEOM_BBOX_GENERATORS)}")

    if args.region is None:
        feature_generator = _GEOM_BBOX_GENERATORS[geom_key](args.count, _COLORADO_BBOX)
    elif len(args.region) == 4:
        try:
            bbox = [float(v) for v in args.region]
        except ValueError:
            parser.error("--region with 4 values must be numeric: min_lon max_lon min_lat max_lat")
        feature_generator = _GEOM_BBOX_GENERATORS[geom_key](args.count, bbox)
    elif len(args.region) == 1:
        boundary_polygon = load_polygon_by_name(DEFAULT_BOUNDARY_PATH, args.region[0])
        if geom_key == "POLYGON":
            feature_generator = lambda: random_polygon_features_in_polygon(args.count, boundary_polygon)
        elif geom_key in ("LINESTRING", "LINE"):
            feature_generator = lambda: random_linestring_features_in_polygon(args.count, boundary_polygon)
        else:
            feature_generator = lambda: random_point_features_in_polygon(args.count, boundary_polygon)
    else:
        parser.error("--region expects either a single name or 4 bbox coordinates")

    path = make_spatial_file(
        path=spatial_path,
        geometry_type=args.geometry_type,
        layer_name=args.layer,
        epsg=args.epsg,
        fields=[("id", ogr.OFTInteger)],
        driver_name=args.driver,
        feature_generator=feature_generator,
    )

    if compress:
        archive_path = compress_dataset(path)
        # remove intermediate spatial files when the user only asked for the archive
        if out_ext in _ARCHIVE_TO_SPATIAL:
            base = os.path.splitext(path)[0]
            for f in os.listdir(os.path.dirname(path)):
                f_path = os.path.join(os.path.dirname(path), f)
                if os.path.splitext(f)[0] == os.path.basename(base) and f_path != archive_path:
                    os.remove(f_path)
        print(f"Created: {archive_path}")
    else:
        print(f"Created: {path}")


if __name__ == "__main__":
    main()
