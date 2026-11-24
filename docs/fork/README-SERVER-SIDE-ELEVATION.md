
# Server-Side Elevation Lookup (068)
> **Changed by the v14.1.0 sync.** The problem and the reason for a server-side lookup still
> hold, but the API no longer decodes the tile itself. `tileBuffer()` and `tilebelt.ts` are gone
> and `getElevation()` asks the tile server's elevation endpoint instead. See the Server-side
> elevation section of [`FORK-DELTA.md`](FORK-DELTA.md).

> **Historical patch numbers.** The `NNN-name.patch` identifiers used below refer
> to a patch set that was deleted at v13.70.0 — only 8 of its 45 files still
> matched the tree, and 19 pointed at paths upstream had moved. They are kept here
> purely as labels for the work described. The code itself is the source of truth;
> [`FORK-DELTA.md`](FORK-DELTA.md) is the current index of what differs and why.


**Patch:** `068-server-side-elevation-lookup.patch`

## Summary

The map query mode's elevation lookup (`Query/Elevation.vue`) showed "No Elevation Data" unless
the user had 3D Terrain toggled on in the map view. Elevation is now computed server-side by
decoding the raster-dem tile directly, independent of any client-side rendering mode.

## Root Cause

`Elevation.vue` called MapLibre GL JS's `map.queryTerrainElevation()`, which only returns a value
once 3D terrain rendering has been enabled via `map.setTerrain()` — internally,
`queryTerrainElevation()` is a thin wrapper around `map.terrain`, which stays `null` until
`setTerrain()` is called. `addTerrain()` (`app/src/stores/map.ts`) is the only code path that
calls `setTerrain()`, and it's wired directly to the "3D Terrain" toggle button.

This coupled a data-availability question ("is elevation data loaded?") to an unrelated rendering
preference ("does the user want tilted 3D visuals?") — the two are otherwise decoupled everywhere
else in the codebase. `Overlay.ensureTerrainSource()` (added by patch 058) already proves this:
it registers the exact same raster-dem source for 2D hillshading *without* ever calling
`setTerrain()`. The elevation query never reused that path.

Separately, enabling 3D Terrain has been reported to crash the browser on some hardware, since
`setTerrain()` triggers MapLibre to build a GPU-heavy 3D mesh and rendering pipeline — a real cost,
not something that can be "quietly" triggered in the background just to answer one query.

This bug is entirely upstream v13.26.0 behaviour (`Elevation.vue` and `stores/map.ts`'s terrain
code are both unmodified from baseline); no patch introduced or masked it.

## Fix

Elevation is now looked up server-side, independent of any map/client rendering state:

1. `BasemapProtocol.tileBuffer(z, x, y)` (`api/stateless/lib/interface-basemap.ts`) fetches a single tile's
   raw bytes in-process. It reuses the existing `tile()` facade and each protocol's `_tile()`
   implementation unmodified, by handing them a minimal in-memory stand-in for Express's
   `Response` object instead of an HTTP response — this works for every basemap protocol (ZXY,
   Hosted, ImageServer, MapServer, FeatureServer) with zero protocol-specific code.
2. `getElevation(config, longitude, latitude)` (`api/stateless/lib/terrain.ts`, new file) resolves the
   `map::terrain` setting to a basemap, computes the tile and pixel that cover the query point via
   `pointToTileFraction()` (`api/stateless/lib/tilebelt.ts`), fetches that one tile via `tileBuffer()`,
   decodes it with `sharp`, and applies the Mapbox Terrain-RGB or Terrarium decode formula
   depending on the basemap's configured `encoding` (`BasemapTerrain_Encoding`).
3. `GET /search/reverse/:longitude/:latitude/elevation` (`api/stateless/routes/search.ts`) calls
   `getElevation()` as the primary source. If it returns `null` (no terrain basemap configured,
   point outside coverage, fetch/decode failure), it falls back to the old client-supplied
   `elevation` query parameter for backward compatibility with any stale cached frontend build.
4. `Elevation.vue` no longer calls `queryTerrainElevation()` or touches `mapStore` at all — it
   just requests the endpoint and displays whatever comes back.

## Verified Terrain Source

Confirmed against the deployment's configured terrain layer
(`https://basemaps.linz.govt.nz/v1/tiles/elevation/WebMercatorQuad/{z}/{x}/{y}.png?...`): standard
ZXY protocol, PNG tiles, Mapbox Terrain-RGB encoding — matching the assumptions `getElevation()`
is built around.

## Files Modified

| File | Change |
|------|--------|
| `api/stateless/lib/interface-basemap.ts` | Adds `BasemapProtocol.tileBuffer()` |
| `api/stateless/lib/terrain.ts` *(new)* | `getElevation()` helper: tile/pixel math + raster-dem decode |
| `api/stateless/routes/search.ts` | Wires `getElevation()` into the elevation route, with legacy fallback |
| `app/src/components/CloudTAK/Query/Elevation.vue` | Drops the `queryTerrainElevation()`/`mapStore` dependency entirely |

## Note

Patch 058 (`058-fix-isvalidstyle-hillshade-raster-dem.patch`) was regenerated as part of this work
— its `interface-basemap.ts` portion (`isValidStyle()` accepting hillshade/`__terrain__` sources)
was already committed to `main` but had gone missing from that patch file, since it was never
regenerated after the commit that introduced it. This is unrelated to the elevation fix itself;
it was corrected so this patch's diff of `interface-basemap.ts` only contains the new
`tileBuffer()` addition, not a duplicate of 058's change.
