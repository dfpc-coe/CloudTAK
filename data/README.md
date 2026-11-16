# `data/`

Large published geospatial archives, kept locally so they don't have to be
re-fetched. **The archives themselves are not tracked in git** — `.gitignore`
excludes `*.pmtiles`, `*.mbtiles`, `*.tif` and `*.laz` here. This file records
what belongs in the directory, where it came from, and how to reproduce it.

`data/**` is also excluded from the three root-context `DockerImageAsset`s in
[`cdk/lib/cloudtak-stack.ts`](../cdk/lib/cloudtak-stack.ts). Those build from the
repository root, so without the exclusion a multi-gigabyte archive would be
staged into `cdk.out` and handed to the Docker daemon on every local `cdk synth`.

---

## `nz-building-heights.pmtiles`

Above-ground height for every building in New Zealand, for 3D building
extrusion (MapLibre `fill-extrusion`).

| | |
|---|---|
| Dataset | Aotearoa New Zealand Building Heights |
| Author | Atman Dhruva |
| Home | <https://heights.anicca.nz/> |
| **Licence** | **CC BY 4.0** — <https://creativecommons.org/licenses/by/4.0/> |
| Derived from | LINZ open LiDAR elevation data |
| Source URL | `https://tiles.anicca.nz/buildings-20260810T1048.pmtiles` |
| Size | 1,143,287,793 bytes |
| Origin ETag | `7315d8dfbefd1259291752e3fc97120b-219` |

### Attribution is required

CC BY 4.0 obliges us to credit both the dataset author and LINZ wherever this is
displayed. Set the basemap/overlay `attribution` field to something like:

> Building heights © Atman Dhruva, CC BY 4.0. Derived from LINZ LiDAR, CC BY 4.0.

### Method (the author's, summarised)

Roof 90th percentile minus ground under the LINZ building outline. The 90th
percentile rather than the maximum is what rejects chimneys, aerials and
overhanging tree canopy.

### Contents

Read from the archive itself, not from the website:

- PMTiles v3, MVT tiles, gzip compressed
- Zoom **4–16** (MapLibre overzooms above 16)
- Bounds `167.3900,-46.9090 → 178.5482,-34.4260`
- 347,418 tiles; **3,172,034** building polygons
- **source-layer: `buildings`**
- Built with `tippecanoe v2.80.0 -Z4 -z16 --drop-densest-as-needed
  --extend-zooms-if-still-dropping -M 1500000 -l buildings`

19 attributes: `building_id`, `height_m`, `height_block_m`, `height_max_m`,
`roof_p50`, `roof_p70`, `roof_p90`, `roof_max`, `ground_m`, `n_pixels`,
`ndvi_applied`, `canopy_fixed`, `flagged`, `peak_unverified`, `post_survey`,
`imagery_year`, `imagery_end`, `lidar_year`, `lidar_end`.

`height_m` is the one to extrude by. Because `--drop-densest-as-needed` thins
buildings heavily below zoom 9, a style should set `minzoom` around 15 or the
lower zooms show a misleading subset.

### Re-fetching

A single unbroken GET of the whole file is refused by the origin's Cloudflare bot
protection. Ranged requests — the format's native access pattern — pass without
issue. `scripts/fetch-nz-building-heights.py` does this in 5 MiB chunks aligned
to the origin's S3 multipart layout, which lets it recompute the composite ETag
and prove the copy is byte-identical rather than merely the right length.

```bash
python3 scripts/fetch-nz-building-heights.py
```

Observed throughput is roughly 8.6 MB/s, so about two and a half minutes.

### Hosting

Uploaded to `s3://<assets-bucket>/public/nz-building-heights.pmtiles`, which is
the prefix CloudTAK's own PMTiles service lists and opens
(`tasks/pmtiles/routes/public.ts`).

Note that `tiles.test.tak.nz` is **TileServer GL**, not that service — it serves
`/data/<id>/{z}/{x}/{y}` and reads from its own configuration, so publishing
there is a separate step on that host.

### Refresh

The source filename is timestamped (`buildings-20260810T1048`), so new releases
land at new URLs. Check <https://heights.anicca.nz/> for the current one and
update the constants in the fetch script.
