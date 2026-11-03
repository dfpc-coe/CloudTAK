import Err from '@openaddresses/batch-error';
import Schema from '@openaddresses/batch-schema';
import { Type } from '@sinclair/typebox';
import { authRequest } from '../lib/auth.js';
import { AugmentedTileJSON } from '../lib/tilejson.js';
import Basemap from '../lib/basemap.js';
import {
    ElevationProfileType,
    LineStringGeometryType,
} from '../lib/elevation.js';

export default async function router(schema: Schema) {
    schema.get('/tiles/basemap/:basemapid/tiles', {
        name: 'Get Basemap TileJSON',
        group: 'BasemapTiles',
        description: 'Get a basemap tilejson',
        params: Type.Object({
            basemapid: Type.Integer({ minimum: 1 }),
        }),
        query: Type.Object({
            token: Type.Optional(Type.String()),
        }),
        res: AugmentedTileJSON,
    }, async (req, res) => {
        try {
            const auth = authRequest(req, {
                resources: [
                    { access: 'basemap', id: req.params.basemapid },
                ],
            });

            const basemap = await Basemap.from(req.params.basemapid, auth.token);

            basemap.authorize(auth);

            const tilejson = await basemap.tilejson({
                token: req.query.token,
                upstreamToken: auth.token,
            });

            res.json({
                ...tilejson,
                actions: basemap.actions(),
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    schema.get('/tiles/basemap/:basemapid/tiles/:z/:x/:y', {
        name: 'Get Basemap Tile',
        group: 'BasemapTiles',
        description: 'Get a basemap tile',
        params: Type.Object({
            basemapid: Type.Integer({ minimum: 1 }),
            z: Type.Integer({ minimum: 0 }),
            x: Type.Integer({ minimum: 0 }),
            y: Type.Integer({ minimum: 0 }),
        }),
        query: Type.Object({
            token: Type.Optional(Type.String()),
        }),
    }, async (req, res) => {
        try {
            const auth = authRequest(req, {
                resources: [
                    { access: 'basemap', id: req.params.basemapid },
                ],
            });

            const basemap = await Basemap.from(req.params.basemapid, auth.token);

            basemap.authorize(auth);

            return await basemap.tile(
                req.params.z,
                req.params.x,
                req.params.y,
                res,
                {
                    headers: {
                        'user-agent': req.headers['user-agent'],
                        'accept': req.headers['accept'],
                        'accept-language': req.headers['accept-language'],
                    },
                },
            );
        } catch (err) {
            Err.respond(err, res);
        }
    });

    schema.post('/tiles/basemap/:basemapid/elevation', {
        name: 'Get Elevation Profile',
        group: 'BasemapTiles',
        description: 'Return sampled elevation values for a CloudTAK raster-dem basemap',
        query: Type.Object({
            token: Type.Optional(Type.String()),
        }),
        params: Type.Object({
            basemapid: Type.Integer({ minimum: 1 }),
        }),
        body: Type.Object({
            geometry: LineStringGeometryType,
            samples: Type.Integer({
                minimum: 2,
                default: 100,
                description: 'Number of elevation samples to take along the line',
            }),
            zoom: Type.Optional(Type.Integer({ minimum: 0 })),
        }),
        res: ElevationProfileType,
    }, async (req, res) => {
        try {
            const auth = authRequest(req, {
                resources: [
                    { access: 'basemap', id: req.params.basemapid },
                ],
            });

            const basemap = await Basemap.from(req.params.basemapid, auth.token);

            basemap.authorize(auth);

            res.json(await basemap.elevation(req.body.geometry, {
                token: auth.token,
                upstreamToken: auth.token,
                zoom: req.body.zoom,
                samples: req.body.samples,
            }));
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
