import { Type } from '@sinclair/typebox'
import { Readable } from 'node:stream';
import Cacher from '../lib/cacher.js';
import TileJSON, { TileJSONType } from '../lib/control/tilejson.js';
import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import zlib from 'zlib';
import { OverlayResponse } from '../lib/types.js'
import { Overlay } from '../lib/schema.js';
import { sql } from 'drizzle-orm';
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/overlay', {
        name: 'Get Overlays',
        group: 'Overlays',
        description: 'Return a list of Server Overlays',
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            filter: Default.Filter,
            sort: Type.Optional(Type.String({default: 'name', enum: Object.keys(Overlay)})),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(OverlayResponse)
        })

    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const overlays = await config.models.Overlay.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                where: sql`
                    name ~* ${req.query.filter}
                `
            });

            return res.json(overlays)
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/overlay/:overlay', {
        name: 'Get Overlays',
        group: 'Overlays',
        description: 'Create a new Server Overlay',
        params: Type.Object({
            overlay: Type.Integer()
        }),
        res: OverlayResponse

    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req)

            const overlay = await config.models.Overlay.from(req.params.overlay)

            return res.json(overlay)
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.patch('/overlay/:overlay', {
        name: 'Update Overlay',
        group: 'Overlays',
        description: 'Create a new Server Overlay',
        params: Type.Object({
            overlay: Type.String()
        }),
        body: Type.Object({
            name: Type.Optional(Type.String()),
            format: Type.String(),
            minzoom: Type.Integer(),
            maxzoom: Type.Integer(),
            type: Type.Optional(Type.String()),
            styles: Type.Optional(Type.Array(Type.Unknown())),
            url: Type.Optional(Type.String())
        }),
        res: OverlayResponse

    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, {
                admin: true
            });

            let overlay = await config.models.Overlay.from(req.params.overlay)

            if (req.body.styles && req.body.styles.length) {
                TileJSON.isValidStyle(overlay.type, req.body.styles);
            }

            overlay = await config.models.Overlay.commit(req.params.overlay, req.body)

            await config.cacher.del(`overlay-${overlay.id}`);

            return res.json(overlay)
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/overlay', {
        name: 'Create Overlay',
        group: 'Overlays',
        description: 'Create a new Server Overlay',
        body: Type.Object({
            name: Type.String(),
            type: Type.String(),
            format: Type.String(),
            minzoom: Type.Integer(),
            maxzoom: Type.Integer(),
            styles: Type.Array(Type.Unknown()),
            url: Type.String()
        }),
        res: OverlayResponse

    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, {
                admin: true
            });

            const overlay = await config.models.Overlay.generate(req.body)

            return res.json(overlay)
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/overlay/:overlay/tiles', {
        name: 'Overlay TileJSON',
        group: 'Overlays',
        description: 'Get an overlay tilejson',
        params: Type.Object({
            overlay: Type.String()
        }),
        query: Type.Object({
            token: Type.Optional(Type.String()),
        }),
        res: TileJSONType
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { token: true });

            const overlay = await config.cacher.get(Cacher.Miss(req.query, `overlay-${req.params.overlay}`), async () => {
                return await config.models.Overlay.from(req.params.overlay);
            });

            let url = config.API_URL + `/api/overlay/${overlay.id}/tiles/{z}/{x}/{y}`;
            if (req.query.token) url = url + `?token=${req.query.token}`;

            return res.json(TileJSON.json({
                ...overlay, url
            }));
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/overlay/:overlay/tiles/:z/:x/:y', {
        name: 'Get Overlay Tile',
        group: 'Overlays',
        description: 'Get an overlay tile',
        params: Type.Object({
            overlay: Type.String(),
            z: Type.Integer({ minimum: 0 }),
            x: Type.Integer({ minimum: 0 }),
            y: Type.Integer({ minimum: 0 }),
        }),
        query: Type.Object({
            token: Type.Optional(Type.String()),
        })
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { token: true });

            const overlay = await config.cacher.get(Cacher.Miss(req.query, `overlay-${req.params.overlay}`), async () => {
                return await config.models.Overlay.from(req.params.overlay);
            });

            const url = new URL(overlay.url
                .replace('{z}', req.params.z)
                .replace('{x}', req.params.x)
                .replace('{y}', req.params.y)
            );

            const proxy = await fetch(url)

            res.status(proxy.status);
            for (const h of [
                'content-type',
                'content-length',
                'content-encoding'
            ]) {
                const ph = proxy.headers.get(h);
                if (ph) res.append(h, ph);
            }

            if (proxy.headers.get('content-encoding') === 'gzip') {
                const gz = zlib.createGzip();

                // @ts-expect-error Doesnt meet TS def
                return Readable.fromWeb(proxy.body)
                    .pipe(gz)
                    .pipe(res);
            } else {
                // @ts-expect-error Doesnt meet TS def
                return Readable.fromWeb(proxy.body).pipe(res);
            }
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
