import Err from '@openaddresses/batch-error';
import Schema from '@openaddresses/batch-schema';
import { Type } from '@sinclair/typebox';
import { authRequest } from '../lib/auth.js';
import { TileJSON } from '../lib/tilejson.js';
import Basemap from '../lib/basemap.js';
import CompositeBasemap from '../lib/basemap/composite.js';
import { decodeSpec, MAX_SPEC_LENGTH, CompositeSpecType } from '../lib/composite.js';

function layerResources(spec: CompositeSpecType): Array<{ access: 'basemap'; id: number }> {
    return spec.layers.map(layer => ({ access: 'basemap', id: layer.basemap }));
}

export default async function router(schema: Schema) {
    schema.get('/tiles/composite/:spec', {
        name: 'Get Composite TileJSON',
        group: 'CompositeTiles',
        description: 'TileJSON for an ad hoc raster composite. The spec is a base64url encoded JSON document listing the basemaps to flatten, in draw order',
        params: Type.Object({
            spec: Type.String({ maxLength: MAX_SPEC_LENGTH }),
        }),
        query: Type.Object({
            token: Type.Optional(Type.String()),
        }),
        res: TileJSON,
    }, async (req, res) => {
        try {
            const spec = decodeSpec(req.params.spec);

            const auth = authRequest(req, { resources: layerResources(spec) });

            const children = await CompositeBasemap.children(spec, { token: auth.token, auth });

            const url = `${Basemap.pmtilesUrl()}/tiles/composite/${req.params.spec}/tiles/{z}/{x}/{y}`;

            res.json(CompositeBasemap.tilejson(spec, children, req.query.token ? `${url}?token=${req.query.token}` : url));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    schema.get('/tiles/composite/:spec/tiles/:z/:x/:y', {
        name: 'Get Composite Tile',
        group: 'CompositeTiles',
        description: 'Render a tile for an ad hoc raster composite',
        params: Type.Object({
            spec: Type.String({ maxLength: MAX_SPEC_LENGTH }),
            z: Type.Integer({ minimum: 0 }),
            x: Type.Integer({ minimum: 0 }),
            y: Type.Integer({ minimum: 0 }),
        }),
        query: Type.Object({
            token: Type.Optional(Type.String()),
        }),
    }, async (req, res) => {
        try {
            const spec = decodeSpec(req.params.spec);

            const auth = authRequest(req, { resources: layerResources(spec) });

            const children = await CompositeBasemap.children(spec, { token: auth.token, auth });

            const headers: Record<string, string | undefined> = {
                'user-agent': req.headers['user-agent'],
                'accept': req.headers['accept'],
                'accept-language': req.headers['accept-language'],
            };
            for (const key of Object.keys(headers)) {
                if (!headers[key]) delete headers[key];
            }

            await CompositeBasemap.render(req.params.z, req.params.x, req.params.y, res, spec, children, {
                headers,
                token: auth.token,
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
