import path from 'node:path';
import Err from '@openaddresses/batch-error';
import Auth, { AuthUserAccess, ResourceCreationScope } from '../lib/auth.js';
import Cacher from '../lib/cacher.js';
import busboy from 'busboy';
import Config from '../lib/config.js';
import { Response } from 'express';
import xml2js from 'xml2js';
import { Readable } from 'node:stream';
import stream2buffer from '../lib/stream.js';
import bboxPolygon from '@turf/bbox-polygon';
import { Param, GenericListOrder } from '@openaddresses/batch-generic'
import { sql } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import { Geometry, BBox } from 'geojson';
import { Type } from '@sinclair/typebox'
import { StandardResponse, BasemapResponse } from '../lib/types.js';
import { Basemap } from '../lib/schema.js';

enum BasemapType {
    vector = 'vector',
    raster = 'raster',
    terrain = 'terrain'
}

export default async function router(schema: Schema, config: Config) {
    await schema.put('/basemap', {
        name: 'Import BaseMaps',
        group: 'BaseMap',
        description: `
            If the Content-Type if text/plain, then assume the body contains a TileJSON URL
            Alternatively, if the Content-Type is a MultiPart upload, assume the input is a TAK XML document

            Both return as many BaseMap fields as possible to use in the creation of a new BaseMap
        `,
        res: Type.Object({
            name: Type.Optional(Type.String()),
            type: Type.Optional(Type.String()),
            url: Type.Optional(Type.String()),
            bounds: Type.Optional(Type.Any()),
            center: Type.Optional(Type.Any()),
            minzoom: Type.Optional(Type.Integer()),
            maxzoom: Type.Optional(Type.Integer()),
            format: Type.Optional(Type.String())
        })
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const imported: {
                name?: string;
                type: string;
                url?: string;
                bounds?: object;
                center?: object;
                minzoom?: number;
                maxzoom?: number;
                format?: string;
            } = {
                type: 'raster'
            };

            if (req.headers['content-type'] && req.headers['content-type'].startsWith('multipart/form-data')) {
                const bb = busboy({
                    headers: req.headers,
                    limits: {
                        files: 1
                    }
                });

                let buffer: Buffer;
                bb.on('file', async (fieldname, file, blob) => {
                    try {
                        buffer = await stream2buffer(file);
                    } catch (err) {
                        return Err.respond(err, res);
                    }
                }).on('finish', async () => {
                    try {
                        const xml = await xml2js.parseStringPromise(String(buffer));
                        if (!xml.customMapSource) return res.json(imported);
                        const map = xml.customMapSource;

                        if (map.name && map.name.length) {
                            imported.name = xml.customMapSource.name[0];
                        }
                        if (map.minZoom && map.minZoom.length) {
                            imported.minzoom = parseInt(xml.customMapSource.minZoom[0]);
                        }
                        if (map.maxZoom && map.maxZoom.length) {
                            imported.maxzoom = parseInt(xml.customMapSource.maxZoom[0]);
                        }
                        if (map.tileType && map.tileType.length) {
                            imported.format = xml.customMapSource.tileType[0];
                        }
                        if (map.url && map.url.length) {
                            imported.url = xml.customMapSource.url[0];
                        }

                        return res.json(imported);
                    } catch (err) {
                        Err.respond(err, res);
                    }
                });

                return req.pipe(bb);
            } else if (req.headers['content-type'] && req.headers['content-type'].startsWith('text/plain')) {
                const url = new URL(String(await stream2buffer(req)));
                const tjres = await fetch(url);
                const tjbody = await tjres.json();

                if (tjbody.name) imported.name = tjbody.name;
                if (tjbody.maxzoom !== undefined) imported.maxzoom = tjbody.maxzoom;
                if (tjbody.minzoom !== undefined) imported.minzoom = tjbody.minzoom;
                if (tjbody.tiles.length) {
                    imported.url = tjbody.tiles[0]
                        .replace('{z}', '{$z}')
                        .replace('{x}', '{$x}')
                        .replace('{y}', '{$y}')
                }

                if (imported.url) {
                    const url = new URL(imported.url)
                    imported.format = path.parse(url.pathname).ext.replace('.', '');
                }

                return res.json(imported);
            } else {
                throw new Err(400, null, 'Unsupported Content-Type');
            }
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/basemap', {
        name: 'List BaseMaps',
        group: 'BaseMap',
        description: 'List BaseMaps',
        query: Type.Object({
            scope: Type.Optional(Type.Enum(ResourceCreationScope)),
            limit: Type.Optional(Type.Integer()),
            page: Type.Optional(Type.Integer()),
            order: Type.Optional(Type.Enum(GenericListOrder)),
            type: Type.Optional(Type.Enum(BasemapType)),
            sort: Type.Optional(Type.String({default: 'created', enum: Object.keys(Basemap) })),
            filter: Type.Optional(Type.String({default: ''}))
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(BasemapResponse)
        })
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            let scope = sql`True`;
            if (req.query.scope === ResourceCreationScope.SERVER) scope = sql`username IS NULL`;
            else if (req.query.scope === ResourceCreationScope.USER) scope = sql`username IS NOT NULL`;

            const list = await config.models.Basemap.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    name ~* ${Param(req.query.filter)}
                    AND (${Param(req.query.type)}::TEXT IS NULL or ${Param(req.query.type)}::TEXT = type)
                    AND (username IS NULL OR username = ${user.email})
                    AND ${scope}
                `
            });

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/basemap', {
        name: 'Create BaseMap',
        group: 'BaseMap',
        description: 'Register a new basemap',
        body: Type.Object({
            name: Type.String(),
            scope: Type.Enum(ResourceCreationScope, { default: ResourceCreationScope.USER }),
            url: Type.String(),
            minzoom: Type.Optional(Type.Integer()),
            maxzoom: Type.Optional(Type.Integer()),
            format: Type.Optional(Type.String()),
            type: Type.Optional(Type.String()),
            bounds: Type.Array(Type.Number({minItems: 4, maxItems: 4})),
            center: Type.Array(Type.Number())
        }),
        res: BasemapResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            let bounds: Geometry;
            if (req.body.bounds) {
                bounds = bboxPolygon(req.body.bounds as BBox).geometry;
                delete req.body.bounds;
            }
            let center: Geometry;
            if (req.body.center) {
                center = { type: 'Point', coordinates: req.body.center };
                delete req.body.center;
            }

            let username: string | null = null;
            if (user.access !== AuthUserAccess.ADMIN && req.body.scope === ResourceCreationScope.SERVER) {
                throw new Err(400, null, 'Only Server Admins can create Server scoped basemaps');
            } else if (user.access === AuthUserAccess.USER || req.body.scope === ResourceCreationScope.USER) {
                username = user.email;
            }

            const basemap = await config.models.Basemap.generate({
                ...req.body,
                bounds,
                center,
                username
            });

            return res.json(basemap);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.patch('/basemap/:basemapid', {
        name: 'Update BaseMap',
        group: 'BaseMap',
        description: 'Update a basemap',
        params: Type.Object({
            basemapid: Type.Integer()
        }),
        body: Type.Object({
            name: Type.Optional(Type.String()),
            url: Type.Optional(Type.String()),
            minzoom: Type.Optional(Type.Integer()),
            maxzoom: Type.Optional(Type.Integer()),
            format: Type.Optional(Type.String()),
            type: Type.Optional(Type.String()),
            bounds: Type.Optional(Type.Array(Type.Number({minItems: 4, maxItems: 4}))),
            center: Type.Optional(Type.Array(Type.Number()))
        }),
        res: BasemapResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            let bounds: Geometry;
            let center: Geometry;
            if (req.body.bounds) bounds = bboxPolygon(req.body.bounds as BBox).geometry;
            if (req.body.center) center = { type: 'Point', coordinates: req.body.center };

            const existing = await config.cacher.get(Cacher.Miss(req.query, `basemap-${req.params.basemapid}`), async () => {
                return await config.models.Basemap.from(Number(req.params.basemapid))
            });

            if (existing.username && existing.username !== user.email && user.access === AuthUserAccess.USER) {
                throw new Err(400, null, 'You don\'t have permission to access this resource');
            }

            const basemap = await config.models.Basemap.commit(Number(req.params.basemapid), {
                updated: sql`Now()`,
                bounds, center,
                ...req.body
            });

            await config.cacher.del(`basemap-${req.params.basemapid}`);

            return res.json(basemap);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/basemap/:basemapid', {
        name: 'Get BaseMap',
        group: 'BaseMap',
        description: 'Get a basemap',
        params: Type.Object({
            basemapid: Type.Integer()
        }),
        query: Type.Object({
            download: Type.Optional(Type.Boolean()),
            format: Type.Optional(Type.String()),
            token: Type.Optional(Type.String()),
        }),
        res: Type.Union([BasemapResponse, Type.String()])
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req, { token: true });

            const basemap = await config.cacher.get(Cacher.Miss(req.query, `basemap-${req.params.basemapid}`), async () => {
                return await config.models.Basemap.from(Number(req.params.basemapid))
            });

            if (basemap.username && basemap.username !== user.email && user.access === AuthUserAccess.USER) {
                throw new Err(400, null, 'You don\'t have permission to access this resource');
            }

            if (req.query.download) {
                res.setHeader('Content-Disposition', `attachment; filename="${basemap.name}.${req.query.format}"`);
            }

            if (req.query.format === 'xml') {
                const builder = new xml2js.Builder();

                res.setHeader('Content-Type', 'text/xml');

                const xml: string = builder.buildObject({
                    customMapSource: {
                        name: { _: basemap.name },
                        minZoom: { _: basemap.minzoom },
                        maxZoom: { _: basemap.maxzoom },
                        tileType: { _: basemap.format },
                        tileUpdate: { _: 'None' },
                        url: { _: basemap.url },
                        backgroundColor: { _: '#000000' },
                    }
                });

                return res.send(xml);
            } else {
                return res.json(basemap);
            }
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/basemap/:basemapid/tiles/:z/:x/:y', {
        name: 'Get BaseMap Tile',
        group: 'BaseMap',
        description: 'Get a basemap tile',
        params: Type.Object({
            basemapid: Type.Integer(),
            z: Type.Integer(),
            x: Type.Integer(),
            y: Type.Integer(),
        }),
        query: Type.Object({
            token: Type.Optional(Type.String()),
        })
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req, { token: true });

            const basemap = await config.cacher.get(Cacher.Miss(req.query, `basemap-${req.params.basemapid}`), async () => {
                return await config.models.Basemap.from(Number(req.params.basemapid));
            });

            if (basemap.username && basemap.username !== user.email && user.access === AuthUserAccess.USER) {
                throw new Err(400, null, 'You don\'t have permission to access this resource');
            }

            const url = new URL(basemap.url
                .replace('{$z}', req.params.z)
                .replace('{$x}', req.params.x)
                .replace('{$y}', req.params.y)
            );

            const proxy = await fetch(url)

            res.status(proxy.status);
            for (const h of ['content-type', 'content-length', 'content-encoding']) {
                const ph = proxy.headers.get(h);
                if (ph) res.append(h, ph);
            }


            // @ts-ignore
            return Readable.fromWeb(proxy.body).pipe(res);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/basemap/:basemapid', {
        name: 'Delete BaseMap',
        group: 'BaseMap',
        description: 'Delete a basemap',
        params: Type.Object({
            basemapid: Type.Integer()
        }),
        res: StandardResponse
    }, async (req, res: Response) => {
        try {
            const user = await Auth.as_user(config, req);

            const basemap = await config.cacher.get(Cacher.Miss(req.query, `basemap-${req.params.basemapid}`), async () => {
                return await config.models.Basemap.from(Number(req.params.basemapid));
            });

            if (basemap.username && basemap.username !== user.email && user.access === AuthUserAccess.USER) {
                throw new Err(400, null, 'You don\'t have permission to access this resource');
            }

            await config.models.Basemap.delete(Number(req.params.basemapid));

            await config.cacher.del(`basemap-${req.params.basemapid}`);

            return res.json({
                status: 200,
                message: 'BaseMap Deleted'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
