import os
import zipfile

from osgeo import ogr, osr


DEFAULT_ZIP_EXTS = (
    ".shp",
    ".shx",
    ".dbf",
    ".prj",
    ".cpg",
    ".qpj",
    ".fix",
    ".sbn",
    ".sbx",
    ".xml",
)


def infer_driver_name(path):
    ext = os.path.splitext(path)[1].lower()
    mapping = {
        ".shp": "ESRI Shapefile",
        ".geojson": "GeoJSON",
        ".gpkg": "GPKG",
        ".kml": "KML",
    }
    return mapping.get(ext, "ESRI Shapefile")


def make_spatial_file(
    path,
    geometry_type,
    layer_name="layer",
    epsg=4326,
    fields=None,
    feature_generator=None,
    driver_name=None,
    overwrite=True,
):
    """Create a spatial file with a given geometry type and field schema."""
    driver_name = driver_name or infer_driver_name(path)
    driver = ogr.GetDriverByName(driver_name)
    if driver is None:
        raise RuntimeError(f"Driver not available: {driver_name}")

    if overwrite and os.path.exists(path):
        if driver_name == "ESRI Shapefile":
            if driver.Open(path, 0):
                driver.DeleteDataSource(path)
        else:
            try:
                os.remove(path)
            except OSError:
                pass

    ds = driver.CreateDataSource(path)
    if ds is None:
        raise RuntimeError(
            f"Could not create datasource at '{path}'. "
            "Check that the file extension matches the driver (e.g. .shp for ESRI Shapefile). "
            "Pass --out with a spatial file extension; --compress produces the archive."
        )
    srs = osr.SpatialReference()
    srs.ImportFromEPSG(epsg)

    geometry_name = geometry_type.upper()
    geometry_map = {
        "POINT": ogr.wkbPoint,
        "LINESTRING": ogr.wkbLineString,
        "LINE": ogr.wkbLineString,
        "POLYGON": ogr.wkbPolygon,
        "MULTIPOINT": ogr.wkbMultiPoint,
        "MULTILINESTRING": ogr.wkbMultiLineString,
        "MULTIPOLYGON": ogr.wkbMultiPolygon,
    }
    geometry_constant = geometry_map.get(geometry_name, getattr(ogr, geometry_name, ogr.wkbPoint))
    layer = ds.CreateLayer(layer_name, srs, geometry_constant)

    if fields:
        for field_name, field_type in fields:
            field_defn = ogr.FieldDefn(field_name, field_type)
            layer.CreateField(field_defn)

    if feature_generator is not None:
        for feature in feature_generator():
            if isinstance(feature, tuple):
                geom, attrs = feature
            else:
                geom, attrs = feature, {}

            feat = ogr.Feature(layer.GetLayerDefn())
            feat.SetGeometry(geom)
            for key, value in attrs.items():
                feat.SetField(key, value)
            layer.CreateFeature(feat)
            feat = None

    ds = None
    return path


def package_dataset_zip(path):
    """Build a ZIP archive containing all related files for a shapefile dataset."""
    directory = os.path.dirname(path) or "."
    base_name = os.path.splitext(os.path.basename(path))[0]
    zip_path = os.path.join(directory, f"{base_name}.zip")

    if os.path.exists(zip_path):
        os.remove(zip_path)

    files_to_zip = []
    for filename in os.listdir(directory):
        if filename.startswith(base_name) and filename.lower().endswith(DEFAULT_ZIP_EXTS):
            files_to_zip.append(os.path.join(directory, filename))

    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for file_path in sorted(files_to_zip):
            zf.write(file_path, os.path.basename(file_path))

    return zip_path


# KML → .kmz, all others → .zip
_KMZ_EXTS = (".kml",)


def compress_dataset(path):
    ext = os.path.splitext(path)[1].lower()
    if ext in _KMZ_EXTS:
        directory = os.path.dirname(path) or "."
        base_name = os.path.splitext(os.path.basename(path))[0]
        archive_path = os.path.join(directory, f"{base_name}.kmz")
        if os.path.exists(archive_path):
            os.remove(archive_path)
        with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            zf.write(path, os.path.basename(path))
        return archive_path
    return package_dataset_zip(path)
