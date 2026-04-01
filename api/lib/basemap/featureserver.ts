import { GeoJSONVT } from '@maplibre/geojson-vt';
// @ts-expect-error No Type Defs
import vtpbf from 'vt-pbf';
import type { Response } from 'express';
import Err from '@openaddresses/batch-error';
import typedFetch from '../fetch.js';
import { Feature } from '@tak-ps/node-cot';
import { Static } from '@sinclair/typebox';
import { Basemap_FeatureAction } from '../enums.js';
import { MultiGeoJSONFeatureCollection, MultiGeoJSONFeature } from '../types.js';
import { EsriPolygon } from '../esri/types.js';
import { BasemapProtocol, TileJSONActions, TileOpts } from '../interface-basemap.js';

/**
 * @class
 *
 * ESRI FeatureServer basemap protocol.
 * Fetches features from an ArcGIS FeatureServer endpoint, encodes them as
 * Mapbox Vector Tiles (PBF), and supports polygon querying and single-feature
 * fetching.
 */
export default class FeatureServerBasemap extends BasemapProtocol {
    isValidURL(str: string): void {
        super.isValidURL(str);

        if (!str.match(/\/FeatureServer\/\d+$/)) {
            throw new Err(400, null, 'FeatureServer protocol requires a URL ending with /FeatureServer/{id}');
        }
    }

    /**
     * Build an ESRI FeatureServer/MapServer query URL for the given tile
     * coordinates, using quantization parameters for efficient tile delivery.
     *
     * @param layer - FeatureServer or MapServer layer URL
     * @param z     - Zoom level
     * @param x     - Tile column
     * @param y     - Tile row
     */
    static esriVectorTileURL(layer: string, z: number, x: number, y: number): URL {
        const url = new URL(layer);

        if (!url.pathname.endsWith('/query')) {
            url.pathname = url.pathname + '/query';
        }

        url.searchParams.set('f', 'geojson');
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
            ymax: bbox[3]
        };

        url.searchParams.set('quantizationParameters', JSON.stringify({
            extent,
            tolerance: 0.001,
            mode: 'view'
        }));

        url.searchParams.set('geometry', JSON.stringify(extent));

        return url;
    }

    actions(): Static<typeof TileJSONActions> {
        return {
            feature: [
                Basemap_FeatureAction.FETCH,
                Basemap_FeatureAction.QUERY
            ]
        };
    }

    /**
     * Query features within a polygon from the FeatureServer.
     *
     * @param polygon - GeoJSON Polygon to query within
     */
    async featureQuery(
        polygon: Static<typeof Feature.Polygon>
    ): Promise<Static<typeof MultiGeoJSONFeatureCollection>> {
        const url = this.basemap!.url;

        const esriPolygon: Static<typeof EsriPolygon> = {
            rings: polygon.coordinates,
            spatialReference: { wkid: 4326, latestWkid: 4326 }
        };

        const urlBuilder = new URL(url + '/query');
        const formData = new FormData();
        formData.append('where', '1=1');
        formData.append('outFields', '*');
        formData.append('f', 'geojson');
        formData.append('geometryType', 'esriGeometryPolygon');
        formData.append('spatialRel', 'esriSpatialRelIntersects');
        formData.append('geometry', JSON.stringify(esriPolygon));

        const fc = await (await fetch(urlBuilder, {
            method: 'POST',
            body: formData
        })).json() as Static<typeof MultiGeoJSONFeatureCollection>;

        return fc;
    }

    /**
     * Fetch a single feature by objectId from the FeatureServer.
     *
     * @param id - Feature objectId
     */
    async featureFetch(
        id: string
    ): Promise<Static<typeof MultiGeoJSONFeature>> {
        const urlBuilder = new URL(this.basemap!.url + '/query');
        urlBuilder.searchParams.set('f', 'geojson');
        urlBuilder.searchParams.set('objectIds', String(id));
        urlBuilder.searchParams.set('outFields', '*');

        const res = await typedFetch(urlBuilder);
        const fc = await res.typed(MultiGeoJSONFeatureCollection);

        if (fc.features.length === 0) {
            throw new Err(404, null, `Could not find feature with ID: ${id}`);
        } else if (fc.features.length > 1) {
            throw new Err(404, null, `Server returned multiple features with ID: ${id}`);
        }

        const feat = fc.features[0];
        feat.id = id;
        return feat;
    }

    protected async _tile(
        z: number, x: number, y: number,
        res: Response,
        opts: Required<TileOpts>
    ): Promise<void> {
        try {
            const url = FeatureServerBasemap.esriVectorTileURL(this.basemap!.url, z, x, y);

            const tileRes = await typedFetch(url);

            if (!tileRes.ok) throw new Err(400, null, `Upstream Error: ${await tileRes.text()}`);

            const fc = await tileRes.typed(MultiGeoJSONFeatureCollection);

            if (!fc.features.length) {
                res.status(404).json({
                    status: 404,
                    message: 'No Features Found'
                });
                return;
            }

            const geojson = {
                type: 'FeatureCollection' as const,
                features: fc.features.map((feat) => {
                    feat.id = Number(feat.id);
                    return feat;
                })
            };

            const tileIndex = new GeoJSONVT(geojson, {
                maxZoom: 24,
                tolerance: 3,
                extent: 4096,
                buffer: 64,
            });

            const tileFeatures = tileIndex.getTile(z, x, y);

            if (!tileFeatures) throw new Err(404, null, 'No Features Found in Tile');

            const tile = vtpbf.fromGeojsonVt({ 'out': tileFeatures });

            res.writeHead(200, {
                ...opts.headers,
                'Content-Type': 'application/vnd.mapbox-vector-tile',
                'Content-Length': Buffer.byteLength(tile)
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
