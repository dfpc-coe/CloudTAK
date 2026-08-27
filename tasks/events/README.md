# CloudTAK Events Import Worker

The events module is CloudTAK's asynchronous geospatial import worker. It polls the CloudTAK API for pending import jobs, claims them, and processes each job in an isolated worker thread. Source files typically originate from [user uploads](https://docs.cloudtak.io/user/#uploaded-files), [data sync](https://docs.cloudtak.io/user/#data-sync-missions) file imports, or TAK Server [file shares](https://docs.cloudtak.io/user/#data-packages) and are stored in S3-compatible object storage. Events downloads each source, processes standalone files or TAK Data Packages, creates CloudTAK resources and derived artifacts, and reports the final job status to the API.

 [!NOTE] After installing Node.js, run `npm install` to ensure the above requisite tools are installed.
As of Aug 2026, the module supports ingesting vectors: (GeoJSON files, KML/KMZ files, Shapefiles) and rasters: (GeoTIFF, GeoPDF, and MBTiles). Vector inputs are normalized to newline-delimited GeoJSON and tiled as PMTiles; raster inputs are converted through MBTiles to PMTiles. The containerized service relies on GDAL, Tippecanoe, and the PMTiles CLI. An offline CLI runs the same import pipeline with local substitutes for the API and object store.

The main components are:

| Path | Responsibility |
| --- | --- |
| `index.ts` | Polls and locks imports, manages worker-thread concurrency, and finalizes job status. |
| `src/comms.ts` | Bridges messages between the worker pool and an import worker thread. |
| `src/worker.ts` | Downloads and classifies an upload, processes archives and TAK resources, creates the profile asset, and cleans up temporary files. |
| `src/transform.ts` | Selects a format converter, creates derived artifacts and iconsets, validates PMTiles, and uploads artifacts. |
| `src/transforms/` | Implements a particular file conversion based on input file type. |
| `src/togeojson/` | Converts KML content into GeoJSON features. |
| `src/s3.ts` | Configures AWS or custom S3-compatible storage. |
| `src/api.ts` | Records resources created by an import. |
| `cli.ts` | Runs the real worker pipeline locally with mocked CloudTAK API and S3 calls. |

## Job Lifecycle

1. `WorkerPool` requests up to the number of available worker slots from
	 `GET /api/import?status=Pending&limit=N` every second.
2. Each selected import is claimed by setting its status to `Running`.
3. A worker thread receives the import, API URL, bucket, and signing secret.
4. The source object is downloaded from `import/<import-id><original-extension>`
	 into a temporary directory.
5. ZIP content is _usually_ parsed as a TAK Data Package, unless it is identified as a ShapeFile. <shapefile>.zip folders and other content enters the single-file profile asset pipeline.
6. Created resources are registered through
	 `POST /api/import/<import-id>/result`.
7. The pool marks the import `Success`, or `Fail` with the reported error.
8. Temporary files are removed in either case.

The default maximum concurrency is `os.availableParallelism()`. The exported
`WorkerPool` class accepts `maxWorkers` when embedded by another process, but
the production entry point does not currently expose it as an environment
variable.

## Supported Inputs

| Input | Processing | Derived artifacts |
| --- | --- | --- |
| `.kml`, `.kmz` | Converts KML features and icons. KMZ files with a root KML are treated as a single geospatial asset. | `.geojsonld`, `.pmtiles`, and optionally an iconset |
| `.geojson`, `.json` | Accepts a Feature, FeatureCollection, or line-delimited GeoJSON. Invalid lines are skipped. | `.geojsonld`, `.pmtiles` |
| `.geojsonld` | Normalizes valid line-delimited features. | `.geojsonld`, `.pmtiles` |
| `.shp` | Must be delivered in `<filename>.zip` format with (at least) necessary supporting files: `.dbf`, `.prj`, `.shx`. Uses GDAL to convert a complete shapefile to GeoJSON sequence. | `.geojsonld`, `.pmtiles` |
| `.tif`, `.tiff` | Uses GDAL to create raster MBTiles, including overviews and high-resolution downsampling. | `.pmtiles` |
| `.pdf` | Accepts georeferenced PDFs only and converts them through GDAL. | `.pmtiles` |
| `.mbtiles` | Converts an existing MBTiles database with the PMTiles CLI. | `.pmtiles` |
| `.zip` | Parses TAK Data Packages and processes supported files contained within them. | Depends on package contents |
| `.xml` | Parses supported TAK basemap XML. Other standalone XML has no registered transform. | Basemap |


## Requirements

The supported runtime is Node.js 24 or newer. Processing also requires:


### Native Tool Installation

On macOS, install the native tools with [Homebrew](https://brew.sh/):

```sh
brew install gdal tippecanoe pmtiles
```

On Linux, install Homebrew for Linux and run the same command:

```sh
brew install gdal tippecanoe pmtiles
```

On Windows, use Ubuntu under WSL2 because Tippecanoe does not provide reliable native Windows support. Install WSL2 from an administrator PowerShell prompt:

```powershell
wsl --install -d Ubuntu
```

Then open Ubuntu, install Homebrew for Linux, and follow the Linux instructions above. Keeping the repository in the WSL filesystem provides better filesystem performance than working under `/mnt/c`.

After installing native tools, install JavaScript dependencies from this directory on any platform:

```sh
npm install
```

## Running

### Offline Import CLI

The CLI exercises the real download, archive, transform, tiling, upload, and API workflow without requiring a running CloudTAK API or S3 service. It mocks those boundaries and writes generated S3 objects beneath a local output directory.
Native format tools are still required, and remote KML NetworkLinks may make network requests.

```sh
npx tsx cli.ts <path-to-geospatial-file> [output-directory]
```

For example:

```sh
npx tsx cli.ts ./test/fixtures/KML-Samples.kml ./output-example
```

If the output directory is omitted, the CLI creates
`output-<input-basename>` in the current directory. Output paths mirror S3 keys, such as `profile/local@cloudtak.local/<asset-id>.pmtiles`.

## Development

Available scripts:

| Command | Purpose |
| --- | --- |
| `npm test` | Runs the Node test suite through `tsx`. |
| `npm run coverage` | Runs tests with text and LCOV coverage reports. |
| `npm run check` | Type-checks without emitting JavaScript. |
| `npm run lint` | Lints the entry points, source, and tests. |
| `npm run build` | Compiles TypeScript to `dist/`. |
| `npm run typegen` | Regenerates API-derived TypeScript types. |

Run the standard validation set with:

```sh
npm run check
npm run lint
npm test
```

Tests cover worker-pool polling, GeoJSON and KML conversion, shapefiles, rasters, GeoPDF rejection, basemaps, iconsets, nested archives, package files, and malformed archive handling. Test commands set `StackName=test`, which also enables controlled localhost behavior in KML NetworkLink tests.

## Adding a Format

1. Add a class under `src/transforms/` that implements `Transform` from `src/types.ts`.
2. Expose a static `register()` method returning the supported lowercase input extensions.
3. Implement `convert()` and return a path to either a `.geojsonld` or an MBTiles-compatible asset. Optionally return icons for iconset creation.
4. Add the class to `FORMATS` in `src/transform.ts`.
5. Add focused conversion and worker integration tests. Utilize the [generate-test-data](https://github.com/dfpc-coe/generate-test-data) to build test data files for new formats.