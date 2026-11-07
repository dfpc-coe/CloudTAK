import Err from '@openaddresses/batch-error';
import Schema from '@openaddresses/batch-schema';
import { Type } from '@sinclair/typebox';
import { authRequest } from '../lib/auth.js';
import { TileJSON } from '../lib/tilejson.js';
import Basemap from '../lib/basemap.js';
import { Slope } from '@tak-ps/node-tiles';
import type { SlopeClass } from '@tak-ps/node-tiles';

const SlopeLayerQuery = Type.Optional(Type.Union([
    Type.String(),
    Type.Array(Type.String()),
], {
    description: 'Slope class as lower:upper:hex_color (RRGGBB or RRGGBBAA), repeatable. Defaults to the avalanche classes when omitted',
}));

function parseSlopeLayers(raw: string | string[] | undefined): SlopeClass[] {
    try {
        return Slope.parse(raw);
    } catch (err) {
        throw new Err(400, err instanceof Error ? err : new Error(String(err)), err instanceof Error ? err.message : 'Invalid slope layer');
    }
}

export default async function router(schema: Schema) {
    schema.get('/tiles/slope/:basemapid', {
        name: 'Get Slope TileJSON',
        group: 'SlopeTiles',
        description: 'TileJSON for slope angle shading rendered from a raster-dem basemap. Requested slope classes are carried onto the tile URLs',
        params: Type.Object({
            basemapid: Type.Integer({ minimum: 1 }),
        }),
        query: Type.Object({
            token: Type.Optional(Type.String()),
            layer: SlopeLayerQuery,
        }),
        res: TileJSON,
    }, async (req, res) => {
        try {
            const classes = req.query.layer !== undefined ? parseSlopeLayers(req.query.layer) : undefined;

            const auth = authRequest(req, {
                resources: [
                    { access: 'basemap', id: req.params.basemapid },
                ],
            });

            const basemap = await Basemap.from(req.params.basemapid, auth.token);

            basemap.authorize(auth);

            res.json(await basemap.slopeTileJSON({
                token: req.query.token,
                upstreamToken: auth.token,
                classes,
            }));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    schema.get('/tiles/slope/:basemapid/tiles/:z/:x/:y', {
        name: 'Get Slope Tile',
        group: 'SlopeTiles',
        description: 'Slope angle shading tile rendered from a raster-dem basemap',
        params: Type.Object({
            basemapid: Type.Integer({ minimum: 1 }),
            z: Type.Integer({ minimum: 0 }),
            x: Type.Integer({ minimum: 0 }),
            y: Type.Integer({ minimum: 0 }),
        }),
        query: Type.Object({
            token: Type.Optional(Type.String()),
            layer: SlopeLayerQuery,
        }),
    }, async (req, res) => {
        try {
            const classes = parseSlopeLayers(req.query.layer);

            const auth = authRequest(req, {
                resources: [
                    { access: 'basemap', id: req.params.basemapid },
                ],
            });

            const basemap = await Basemap.from(req.params.basemapid, auth.token);

            basemap.authorize(auth);

            await basemap.slopeTile(req.params.z, req.params.x, req.params.y, res, {
                classes,
                token: auth.token,
                headers: {
                    'user-agent': req.headers['user-agent'],
                    'accept': req.headers['accept'],
                    'accept-language': req.headers['accept-language'],
                },
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
