import Err from '@openaddresses/batch-error';
import Schema from '@openaddresses/batch-schema';
import { Type } from '@sinclair/typebox';
import auth from '../lib/auth.js';
import getElevationProfile, {
    ElevationEncoding,
    ElevationEncodingType,
    ElevationProfileType,
    LineStringGeometryType,
} from '../lib/elevation.js';

type CloudTAKBasemap = {
    type?: string;
    minzoom?: number;
    maxzoom?: number;
    encoding?: ElevationEncoding;
};

type CloudTAKTileJSON = {
    type?: string;
    format?: string;
    minzoom?: number;
    maxzoom?: number;
    tiles?: string[];
};

async function fetchCloudTAKJSON<T>(url: URL): Promise<T> {
    const res = await fetch(url);

    if (!res.ok) {
        let message = `CloudTAK API request failed with status ${res.status}`;

        try {
            const body = await res.json() as { message?: string };
            if (body.message) message = body.message;
        } catch {
            // Use the default message if the upstream body is not JSON.
        }

        throw new Err(res.status, null, message);
    }

    return await res.json() as T;
}

function cloudtakURL(path: string, token: string): URL {
    const base = new URL(process.env.API_URL || 'http://localhost:5001');
    const url = new URL(path, base);
    url.searchParams.set('token', token);
    return url;
}

export default async function router(schema: Schema) {
    schema.post('/tiles/basemap/:basemapid/elevation', {
        name: 'Get Elevation Profile',
        group: 'BasemapTiles',
        description: 'Return sampled elevation values for a CloudTAK raster-dem basemap',
        query: Type.Object({
            token: Type.String()
        }),
        params: Type.Object({
            basemapid: Type.Integer({ minimum: 1 })
        }),
        body: Type.Object({
            geometry: LineStringGeometryType,
            sampleRate: Type.Number({
                exclusiveMinimum: 0,
                description: 'Sampling interval along the line in kilometers'
            }),
            zoom: Type.Optional(Type.Integer({ minimum: 0 })),
            encoding: Type.Optional(ElevationEncodingType),
        }),
        res: ElevationProfileType
    }, async (req, res) => {
        try {
            auth(req.query.token);

            const [basemap, tilejson] = await Promise.all([
                fetchCloudTAKJSON<CloudTAKBasemap>(
                    cloudtakURL(`/api/basemap/${req.params.basemapid}`, req.query.token)
                ),
                fetchCloudTAKJSON<CloudTAKTileJSON>(
                    cloudtakURL(`/api/basemap/${req.params.basemapid}/tiles`, req.query.token)
                )
            ]);

            if (basemap.type !== 'raster-dem' || tilejson.type !== 'raster-dem' || tilejson.format === 'mvt') {
                throw new Err(400, null, 'Elevation profiles require raster-dem tiles');
            }

            const tileurl = tilejson.tiles?.[0];
            if (!tileurl) {
                throw new Err(400, null, 'Basemap has no tile URL');
            }

            const minzoom = tilejson.minzoom ?? basemap.minzoom ?? 0;
            const maxzoom = tilejson.maxzoom ?? basemap.maxzoom ?? 0;

            if (req.body.zoom !== undefined && req.body.zoom > maxzoom) {
                throw new Err(400, null, 'Above Layer MaxZoom');
            }

            if (req.body.zoom !== undefined && req.body.zoom < minzoom) {
                throw new Err(400, null, 'Below Layer MinZoom');
            }

            res.json(await getElevationProfile(tileurl, req.body.geometry, {
                zoom: req.body.zoom ?? maxzoom,
                encoding: req.body.encoding ?? basemap.encoding,
                minSampleDistance: req.body.sampleRate,
                maxSampleDistance: req.body.sampleRate,
            }));
        } catch (err) {
            Err.respond(err, res);
        }
    });
}