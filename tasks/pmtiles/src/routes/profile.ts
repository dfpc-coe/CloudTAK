import Err from '@openaddresses/batch-error';
import Schema from '@openaddresses/batch-schema';
import { Type } from '@sinclair/typebox'
import auth from '../lib/auth.js';
import { FileTiles, TileJSON, QueryResponse } from '../lib/tiles.js';

export default async function router(schema: Schema) {
    schema.get('/tiles/profile/:username/:file', {
        name: 'Get TileJSON',
        group: 'ProfileTiles',
        description: 'Return TileJSON for a given file',
        params: Type.Object({
            username: Type.String(),
            file: Type.String()
        }),
        query: Type.Object({
            token: Type.String()
        }),
        res: TileJSON
    }, async (req, res) => {
        try {
            const token = auth(req.query.token);
            if (token.email !== req.params.username || token.access !== 'profile') {
                throw new Err(401, null, 'Unauthorized Access');
            }

            const file = new FileTiles(`profile/${req.params.username}/${req.params.file}`);
            res.json(await file.tilejson(req.query.token));
        } catch (err) {
            Err.respond(err, res);
        }
    })

    schema.get('/tiles/profile/:username/:file/query', {
        name: 'Get TileJSON',
        group: 'ProfileTiles',
        description: 'Return TileJSON for a given file',
        params: Type.Object({
            username: Type.String(),
            file: Type.String()
        }),
        query: Type.Object({
            token: Type.String(),
            query: Type.String(),
            zoom: Type.Optional(Type.Integer()),
            limit: Type.Integer({ default: 1 })
        }),
        res: QueryResponse
    }, async (req, res) => {
        try {
            const token = auth(req.query.token);
            if (token.email !== req.params.username || token.access !== 'profile') {
                throw new Err(401, null, 'Unauthorized Access');
            }

            const file = new FileTiles(`profile/${req.params.username}/${req.params.file}`);
            res.json(await file.query(req.query.query, {
                limit: req.query.limit,
                zoom: req.query.zoom
            }));
        } catch (err) {
            Err.respond(err, res);
        }
    })

    schema.get('/tiles/profile/:username/:file/tiles/:z/:x/:y.:ext', {
        name: 'Get Tile',
        group: 'ProfileTiles',
        description: 'Return tile for a given zxy',
        query: Type.Object({
            token: Type.String()
        }),
        params: Type.Object({
            username: Type.String(),
            file: Type.String(),
            z: Type.Integer(),
            x: Type.Integer(),
            y: Type.Integer(),
            ext: Type.String()
        }),
    }, async (req, res) => {
        try {
            const token = auth(req.query.token);
            if (token.email !== req.params.username || token.access !== 'profile') {
                throw new Err(401, null, 'Unauthorized Access');
            }

            const file = new FileTiles(`profile/${req.params.username}/${req.params.file}`);

            await file.tile(res, req.params.z, req.params.x, req.params.y, req.params.ext);
        } catch (err) {
            Err.respond(err, res);
        }
    })
}
