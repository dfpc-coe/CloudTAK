import Err from '@openaddresses/batch-error';
import Schema from '@openaddresses/batch-schema';
import { Type } from '@sinclair/typebox';
import { authRequest } from '../lib/auth.js';
import { TileJSON } from '../lib/tilejson.js';
import Basemap from '../lib/basemap.js';
import { Hillshade, HILLSHADE_METHODS } from '@tak-ps/node-tiles';
import type { HillshadeInput, HillshadeOptions } from '@tak-ps/node-tiles';

function param(description: string) {
    return Type.Optional(Type.Union([
        Type.String(),
        Type.Array(Type.String()),
    ], { description }));
}

const HillshadeQuery = {
    azimuth: param('Compass direction the light comes from in degrees, 0-360. Defaults to 315'),
    altitude: param('Height of the light above the horizon in degrees, 0-90. Defaults to 45'),
    exaggeration: param('Vertical exaggeration applied before shading, 0-100. Defaults to 1'),
    method: param(`Shading algorithm: ${HILLSHADE_METHODS.join(', ')}. Defaults to standard`),
    shadow: param('Colour of shaded pixels as RRGGBB or RRGGBBAA. Defaults to black'),
    highlight: param('Colour of lit pixels as RRGGBB or RRGGBBAA. Defaults to white'),
};

function hillshadeInput(query: Record<string, unknown>): HillshadeInput {
    const input: HillshadeInput = {};

    for (const key of Object.keys(HillshadeQuery) as (keyof HillshadeOptions)[]) {
        const value = query[key];
        if (value !== undefined) input[key] = value as string | string[];
    }

    return input;
}

function parseHillshade(input: HillshadeInput): HillshadeOptions {
    try {
        return Hillshade.parse(input);
    } catch (err) {
        throw new Err(400, err instanceof Error ? err : new Error(String(err)), err instanceof Error ? err.message : 'Invalid hillshade options');
    }
}

export default async function router(schema: Schema) {
    schema.get('/tiles/hillshade/:basemapid', {
        name: 'Get Hillshade TileJSON',
        group: 'HillshadeTiles',
        description: 'TileJSON for hillshade relief rendered from a raster-dem basemap. Supplied lighting options are carried onto the tile URLs',
        params: Type.Object({
            basemapid: Type.Integer({ minimum: 1 }),
        }),
        query: Type.Object({
            token: Type.Optional(Type.String()),
            ...HillshadeQuery,
        }),
        res: TileJSON,
    }, async (req, res) => {
        try {
            const input = hillshadeInput(req.query);
            parseHillshade(input);

            const auth = authRequest(req, {
                resources: [
                    { access: 'basemap', id: req.params.basemapid },
                ],
            });

            const basemap = await Basemap.from(req.params.basemapid, auth.token);

            basemap.authorize(auth);

            res.json(await basemap.hillshadeTileJSON({
                token: req.query.token,
                upstreamToken: auth.token,
                input,
            }));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    schema.get('/tiles/hillshade/:basemapid/tiles/:z/:x/:y', {
        name: 'Get Hillshade Tile',
        group: 'HillshadeTiles',
        description: 'Transparent hillshade relief tile rendered from a raster-dem basemap',
        params: Type.Object({
            basemapid: Type.Integer({ minimum: 1 }),
            z: Type.Integer({ minimum: 0 }),
            x: Type.Integer({ minimum: 0 }),
            y: Type.Integer({ minimum: 0 }),
        }),
        query: Type.Object({
            token: Type.Optional(Type.String()),
            ...HillshadeQuery,
        }),
    }, async (req, res) => {
        try {
            const hillshade = parseHillshade(hillshadeInput(req.query));

            const auth = authRequest(req, {
                resources: [
                    { access: 'basemap', id: req.params.basemapid },
                ],
            });

            const basemap = await Basemap.from(req.params.basemapid, auth.token);

            basemap.authorize(auth);

            await basemap.hillshadeTile(req.params.z, req.params.x, req.params.y, res, {
                hillshade,
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
