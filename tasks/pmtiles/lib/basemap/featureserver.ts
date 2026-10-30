import { GeoJSONVT } from '@maplibre/geojson-vt';
// @ts-expect-error No Type Defs
import vtpbf from 'vt-pbf';
import type { Response } from 'express';
import Err from '@openaddresses/batch-error';
import { fetch as typedFetch } from '@tak-ps/node-safeurl';
import type { Static } from '@sinclair/typebox';
import { TileJSONActions } from '../tilejson.js';
import { esriToGeoJSON, parseFeatureSet } from '../esri/geojson.js';
import { BasemapProtocol, TileOpts, assertTileSize } from './protocol.js';

/**
 * ESRI FeatureServer basemap protocol.
 * Fetches features from an ArcGIS FeatureServer endpoint and encodes them as
 * Mapbox Vector Tiles (PBF). Feature query and fetch remain on the CloudTAK API.
 */
export default class FeatureServerBasemap extends BasemapProtocol {
    static esriVectorTileURL(layer: string, z: number, x: number, y: number): URL {
        const url = new URL(layer);

        if (!url.pathname.endsWith('/query')) {
            url.pathname = url.pathname + '/query';
        }

        url.searchParams.set('f', 'json');
        url.searchParams.set('inSR', '4326');
        url.searchParams.set('outSR', '4326');
        url.searchParams.set('returnZ', 'false');
        url.searchParams.set('returnM', 'false');
        url.searchParams.set('useStaticZoomLevel', 'false');
        url.searchParams.set('simplifyFactor', '0.3');
        url.searchParams.set('setAttributionFromService', 'true');
        url.searchParams.set('useSeviceBounds', 'true');
        url.searchParams.set('resultType', 'tile');
        url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
        url.searchParams.set('geometryType', 'esriGeometryEnvelope');

        if (!url.searchParams.has('precision')) url.searchParams.set('precision', '8');
        if (!url.searchParams.has('where')) url.searchParams.append('where', '1=1');
        if (!url.searchParams.has('outFields')) url.searchParams.append('outFields', '*');

        const bbox = BasemapProtocol.extent(z, x, y);

        const extent = {
            spatialReference: { latestWkid: 4326, wkid: 4326 },
            xmin: bbox[0],
            ymin: bbox[1],
            xmax: bbox[2],
            ymax: bbox[3],
        };

        url.searchParams.set('quantizationParameters', JSON.stringify({
            extent,
            tolerance: FeatureServerBasemap.tileTolerance(z),
            mode: 'view',
        }));

        url.searchParams.set('geometry', JSON.stringify(extent));

        return url;
    }

    /**
     * Quantization tolerance in degrees for one unit of a 4096 extent tile
     * at the given zoom, matching the GeoJSONVT extent used for encoding.
     */
    static tileTolerance(z: number): number {
        return 360 / Math.pow(2, z) / 4096;
    }

    actions(): Static<typeof TileJSONActions> {
        return {
            feature: ['fetch', 'query'],
        };
    }

    protected async _tile(
        z: number, x: number, y: number,
        res: Response,
        opts: Required<TileOpts>,
    ): Promise<void> {
        try {
            const url = FeatureServerBasemap.esriVectorTileURL(this.basemap.url, z, x, y);

            const tileRes = await typedFetch(url);

            if (!tileRes.ok) throw new Err(400, null, `Upstream Error: ${await tileRes.text()}`);

            const fc = esriToGeoJSON(parseFeatureSet(await tileRes.json()));

            if (!fc.features.length) {
                res.status(404).json({
                    status: 404,
                    message: 'No Features Found',
                });
                return;
            }

            const geojson = {
                type: 'FeatureCollection' as const,
                features: fc.features.map((feat) => {
                    feat.id = Number(feat.id);
                    return feat;
                }),
            };

            const tileIndex = new GeoJSONVT(geojson, {
                maxZoom: 24,
                tolerance: 3,
                extent: 4096,
                buffer: 64,
            });

            const tileFeatures = tileIndex.getTile(z, x, y);

            if (!tileFeatures) throw new Err(404, null, 'No Features Found in Tile');

            const tile = vtpbf.fromGeojsonVt({ out: tileFeatures });

            assertTileSize(Buffer.byteLength(tile));

            res.writeHead(200, {
                ...opts.headers,
                'Content-Type': 'application/vnd.mapbox-vector-tile',
                'Content-Length': Buffer.byteLength(tile),
                'Cache-Control': 'public, max-age=3600',
            });

            res.write(tile);
            res.end();
        } catch (err) {
            if (err instanceof Err) {
                throw err;
            } else {
                throw new Err(400, err instanceof Error ? err : new Error(String(err)), 'Failed to fetch ESRI tile');
            }
        }
    }
}
