import path from 'node:path';
import jwt from 'jsonwebtoken';
import Err from '@openaddresses/batch-error';
import { bbox } from '@turf/bbox';
import TileJSON, { TileJSONType, TileJSONActions } from '../lib/control/tilejson.js';
import Auth, { AuthUserAccess, AuthUser, AuthResource, ResourceCreationScope, AuthResourceAccess } from '../lib/auth.js';
import busboy from 'busboy';
import Config from '../lib/config.js';
import { Response } from 'express';
import stream2buffer from '../lib/stream.js';
import bboxPolygon from '@turf/bbox-polygon';
import { Param } from '@openaddresses/batch-generic'
import { sql } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import { Geometry, BBox } from 'geojson';
import { Static, Type } from '@sinclair/typebox'
import { StandardResponse, BasemapResponse, OptionalTileJSON, GeoJSONFeature, GeoJSONFeatureCollection } from '../lib/types.js';
import { BasemapCollection } from '../lib/models/Basemap.js';
import { Basemap as BasemapParser, Feature } from '@tak-ps/node-cot';
import { Basemap } from '../lib/schema.js';
import { toEnum, Basemap_Format, Basemap_Scheme, Basemap_Type } from '../lib/enums.js';
import { EsriBase, EsriProxyLayer } from '../lib/esri.js';
import * as Default from '../lib/limits.js';

const AugmentedBasemapResponse = Type.Composite([
    Type.Omit(BasemapResponse, ['bounds', 'center']),
    Type.Object({
        bounds: Type.Optional(Type.Array(Type.Number(), { minItems: 4, maxItems: 4 })),
        center: Type.Optional(Type.Array(Type.Number())),
        actions: TileJSONActions
    })
])

const AugmentedTileJSONType = Type.Composite([
    TileJSONType,
    Type.Object({
        actions: TileJSONActions
    })
])

export default async function router(schema: Schema, config: Config) {
    await schema.put('/basemap', {
        name: 'Import Basemaps',
        group: 'BaseMap',
        description: `
            If the Content-Type if text/plain, then assume the body contains a TileJSON URL
            Alternatively, if the Content-Type is a MultiPart upload, assume the input is a TAK XML document

            Both return as many BaseMap fields as possible to use in the creation of a new BaseMap
        `,
        res: OptionalTileJSON
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const imported: {
                name?: string;
                type: Basemap_Type;
                url?: string;
                attribution?: string;
                bounds?: object;
                center?: object;
                minzoom?: number;
                maxzoom?: number;
                format?: Basemap_Format;
            } = {
                type: Basemap_Type.RASTER
            };

            if (req.headers['content-type'] && req.headers['content-type'].startsWith('multipart/form-data')) {
                const bb = busboy({
                    headers: req.headers,
                    limits: {
                        files: 1
                    }
                });

                let buffer: Buffer;
                bb.on('file', async (fieldname, file) => {
                    try {
                        buffer = await stream2buffer(file);
                    } catch (err) {
                        Err.respond(err, res);
                    }
                }).on('finish', async () => {
                    try {
                        const b = await BasemapParser.parse(String(buffer));

                        if (!b.raw.customMapSource) {
                            res.json(imported);
                        } else {
                            const map = b.raw.customMapSource;

                            imported.name = map.name._text;
                            imported.minzoom = map.minZoom._text;
                            imported.maxzoom = map.maxZoom._text;
                            if (map.url) imported.url = map.url._text;

                            if (map.tileType) {
                                imported.format = toEnum.fromString(
                                    Type.Enum(Basemap_Format),
                                    map.tileType._text.replace(/^image\//, '')
                                );
                            }

                            res.json(imported);
                        }
                    } catch (err) {
                        Err.respond(err, res);
                    }
                });

                req.pipe(bb);
            } else if (req.headers['content-type'] && req.headers['content-type'].startsWith('text/plain')) {
                const url = new URL(String(await stream2buffer(req)));

                if (
                    String(url).match(/\/FeatureServer\/\d+$/)
                    || String(url).match(/\/MapServer\/\d+$/)
                    || String(url).match(/\/ImageServer$/)
                ) {
                    const base = new EsriBase(url);
                    const layer = new EsriProxyLayer(base);
                    const tilejson = await layer.tilejson();

                    res.json(tilejson);
                } else {
                    const tjres = await fetch(url);
                    const tjbody = await tjres.json();

                    if (tjbody.name) imported.name = tjbody.name;
                    if (tjbody.attribution) imported.attribution = tjbody.attribution;
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
                        imported.format = toEnum.fromString(Type.Enum(Basemap_Format), path.parse(url.pathname).ext.replace('.', ''));
                    }

                    res.json(imported);
                }
            } else {
                throw new Err(400, null, 'Unsupported Content-Type');
            }
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/basemap', {
        name: 'List Basemaps',
        group: 'BaseMap',
        description: 'List BaseMaps',
        query: Type.Object({
            scope: Type.Optional(Type.Enum(ResourceCreationScope)),
            impersonate: Type.Optional(Type.Union([
                Type.Boolean({ description: 'List all of the given resource, regardless of ACL' }),
                Type.String({ description: 'Filter the given resource by a given username' }),
            ])),
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            type: Type.Optional(Type.Union([
                Type.Enum(Basemap_Type),
                Type.Array(Type.Enum(Basemap_Type))
            ])),
            sort: Type.String({
                default: 'created',
                enum: Object.keys(Basemap)
            }),
            filter: Default.Filter,
            collection: Type.Optional(Type.String({
                description: 'Only show Basemaps belonging to a given collection'
            })),
            overlay: Type.Boolean({ default: false })
        }),
        res: Type.Object({
            total: Type.Integer(),
            collections: Type.Array(BasemapCollection),
            items: Type.Array(AugmentedBasemapResponse)
        })
    }, async (req, res) => {
        try {
            let list;
            let collections: Array<Static<typeof BasemapCollection>> = [];

            let scope = sql`True`;
            if (req.query.scope === ResourceCreationScope.SERVER) {
                scope = sql`username IS NULL`;
            } else if (req.query.scope === ResourceCreationScope.USER) {
                scope = sql`username IS NOT NULL`;
            }

            const types: Array<Basemap_Type> = Array.isArray(req.query.type) ? req.query.type : (req.query.type ? [req.query.type] : [
                Basemap_Type.RASTER, Basemap_Type.VECTOR, Basemap_Type.TERRAIN
            ]);

            if (req.query.impersonate) {
                await Auth.as_user(config, req, { admin: true });

                const impersonate: string | null = req.query.impersonate === true ? null : req.query.impersonate;

                list = await config.models.Basemap.list({
                    limit: req.query.limit,
                    page: req.query.page,
                    order: req.query.order,
                    sort: req.query.sort,
                    where: sql`
                        name ~* ${Param(req.query.filter)}
                        AND (${Param(req.query.overlay)}::BOOLEAN = overlay)
                        AND type = ANY(${sql.raw(`ARRAY[${types.map(c => `'${c}'`).join(', ')}]`)}::TEXT[])
                        AND (
                                (${Param(req.query.collection)}::TEXT IS NULL AND collection IS NULL)
                                OR ${Param(req.query.collection)}::TEXT = collection
                            )
                        AND ${scope}
                        AND (${impersonate}::TEXT IS NULL OR username = ${impersonate}::TEXT)
                    `
                });

                if (!req.query.collection) {
                    collections = await config.models.Basemap.collections({
                        order: req.query.order,
                        sort: req.query.sort,
                        where: sql`
                            collection ~* ${Param(req.query.filter)}
                            AND (${Param(req.query.overlay)}::BOOLEAN = overlay)
                            AND type = ANY(${sql.raw(`ARRAY[${types.map(c => `'${c}'`).join(', ')}]`)}::TEXT[])
                            AND ${scope}
                            AND (${impersonate}::TEXT IS NULL OR username = ${impersonate}::TEXT)
                        `
                    });
                }
            } else {
                const user = await Auth.as_user(config, req);

                list = await config.models.Basemap.list({
                    limit: req.query.limit,
                    page: req.query.page,
                    order: req.query.order,
                    sort: req.query.sort,
                    where: sql`
                        name ~* ${Param(req.query.filter)}
                        AND (${Param(req.query.overlay)}::BOOLEAN = overlay)
                        AND (username IS NULL OR username = ${user.email})
                        AND type = ANY(${sql.raw(`ARRAY[${types.map(c => `'${c}'`).join(', ')}]`)}::TEXT[])
                        AND (
                                (${Param(req.query.collection)}::TEXT IS NULL AND collection IS NULL)
                                OR ${Param(req.query.collection)}::TEXT = collection
                            )
                        AND ${scope}
                    `
                });

                if (!req.query.collection) {
                    collections = await config.models.Basemap.collections({
                        order: req.query.order,
                        sort: req.query.sort,
                        where: sql`
                            collection ~* ${Param(req.query.filter)}
                            AND (${Param(req.query.overlay)}::BOOLEAN = overlay)
                            AND (username IS NULL OR username = ${user.email})
                            AND type = ANY(${sql.raw(`ARRAY[${types.map(c => `'${c}'`).join(', ')}]`)}::TEXT[])
                            AND ${scope}
                        `
                    });
                }
            }

            res.json({
                total: list.total,
                collections,
                items: list.items.map((basemap) => {
                    return {
                        ...basemap,
                        bounds: basemap.bounds ? bbox(basemap.bounds) : undefined,
                        center: basemap.center ? basemap.center.coordinates : undefined,
                        actions: TileJSON.actions(basemap.url)
                    };
                })
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/basemap', {
        name: 'Create Basemap',
        group: 'BaseMap',
        description: 'Register a new basemap',
        query: Type.Object({
            impersonate: Type.Optional(Type.String({ description: 'Filter the given resource by a given username' })),
        }),
        body: Type.Object({
            name: Default.NameField,
            sharing_enabled: Type.Boolean({
                default: true,
                description: 'Allow CloudTAK users to share this layer with other users'
            }),
            collection: Type.Optional(Type.Union([Type.Null(), Type.String()])),
            scope: Type.Enum(ResourceCreationScope, { default: ResourceCreationScope.USER }),
            url: Type.String(),
            overlay: Type.Boolean({ default: false }),
            tilesize: Type.Integer({ default: 256, minimum: 256, maximum: 512 }),
            attribution: Type.Optional(Type.Union([Type.Null(), Type.String()])),
            frequency: Type.Optional(Type.Union([Type.Null(), Type.Integer()])),
            minzoom: Type.Optional(Type.Integer()),
            maxzoom: Type.Optional(Type.Integer()),
            format: Type.Optional(Type.Enum(Basemap_Format)),
            style: Type.Optional(Type.Enum(Basemap_Scheme)),
            type: Type.Optional(Type.Enum(Basemap_Type)),
            bounds: Type.Optional(Type.Array(Type.Number(), { minItems: 4, maxItems: 4 })),
            center: Type.Optional(Type.Array(Type.Number())),
            styles: Type.Optional(Type.Array(Type.Unknown()))
        }),
        res: AugmentedBasemapResponse
    }, async (req, res) => {
        try {
            const user = req.query.impersonate
                ? await Auth.impersonate(config, req, req.query.impersonate)
                : await Auth.as_user(config, req);

            let bounds: Geometry | undefined = undefined;
            if (req.body.bounds) {
                bounds = bboxPolygon(req.body.bounds as BBox).geometry;
                delete req.body.bounds;
            }

            let center: Geometry | undefined = undefined;
            if (req.body.center) {
                center = { type: 'Point', coordinates: req.body.center };
                delete req.body.center;
            }

            TileJSON.isValidURL(req.body.url);

            let username: string | null = null;
            if (user.access !== AuthUserAccess.ADMIN && req.body.scope === ResourceCreationScope.SERVER) {
                throw new Err(400, null, 'Only Server Admins can create Server scoped basemaps');
            } else if (user.access === AuthUserAccess.USER || req.body.scope === ResourceCreationScope.USER) {
                username = user.email;
            }

            let basemap = await config.models.Basemap.generate({
                ...req.body,
                bounds,
                center,
                username
            });

            if (req.body.sharing_enabled) {
                basemap = await config.models.Basemap.commit(basemap.id, {
                    sharing_token: `etl.${jwt.sign({ id: basemap.id, access: 'basemap', internal: true, t: +new Date() }, config.SigningSecret)}`
                })
            }

            res.json({
                ...basemap,
                bounds: basemap.bounds ? bbox(basemap.bounds) : undefined,
                center: basemap.center ? basemap.center.coordinates : undefined,
                actions: TileJSON.actions(basemap.url)
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/basemap/:basemapid', {
        name: 'Update Basemap',
        group: 'BaseMap',
        description: 'Update a basemap',
        params: Type.Object({
            basemapid: Type.Integer({ minimum: 1 })
        }),
        query: Type.Object({
            impersonate: Type.Optional(Type.String({ description: 'Filter the given resource by a given username' })),
        }),
        body: Type.Object({
            name: Type.Optional(Default.NameField),
            sharing_enabled: Type.Optional(Type.Boolean()),
            collection: Type.Optional(Type.Union([Type.Null(), Type.String()])),
            overlay: Type.Optional(Type.Boolean()),
            scope: Type.Enum(ResourceCreationScope, { default: ResourceCreationScope.USER }),
            url: Type.Optional(Type.String()),
            tilesize: Type.Optional(Type.Integer({ default: 256, minimum: 256, maximum: 512 })),
            attribution: Type.Optional(Type.Union([Type.Null(), Type.String()])),
            frequency: Type.Optional(Type.Union([Type.Null(), Type.Integer()])),
            minzoom: Type.Optional(Type.Integer()),
            maxzoom: Type.Optional(Type.Integer()),
            format: Type.Optional(Type.Enum(Basemap_Format)),
            style: Type.Optional(Type.Enum(Basemap_Scheme)),
            type: Type.Optional(Type.Enum(Basemap_Type)),
            bounds: Type.Optional(Type.Array(Type.Number(), { minItems: 4, maxItems: 4 })),
            center: Type.Optional(Type.Array(Type.Number())),
            styles: Type.Optional(Type.Array(Type.Unknown())),
        }),
        res: AugmentedBasemapResponse
    }, async (req, res) => {
        try {
            const user = req.query.impersonate
                ? await Auth.impersonate(config, req, req.query.impersonate)
                : await Auth.as_user(config, req);

            let bounds: Geometry | undefined = undefined;
            let center: Geometry | undefined = undefined;
            if (req.body.bounds) bounds = bboxPolygon(req.body.bounds as BBox).geometry;
            if (req.body.center) center = { type: 'Point', coordinates: req.body.center };
            if (req.body.url) TileJSON.isValidURL(req.body.url);

            const existing = await config.models.Basemap.from(req.params.basemapid);

            if (existing.username && existing.username !== user.email && user.access === AuthUserAccess.USER) {
                throw new Err(400, null, 'You don\'t have permission to access this resource');
            } else if (!existing.username && (user.access !== AuthUserAccess.ADMIN && !user.impersonate)) {
                throw new Err(400, null, 'Only System Admin can edit Server Resources');
            }

            let username: string | null = existing.username;
            if (
                req.body.scope !== undefined
                && req.body.scope === ResourceCreationScope.SERVER
                && (!user.impersonate && user.access !== AuthUserAccess.ADMIN)
            ) {
                throw new Err(400, null, 'Only Server Admins can edit scoped basemaps');
            } else if (req.body.scope !== undefined && user.access === AuthUserAccess.ADMIN && req.body.scope === ResourceCreationScope.SERVER) {
                username = null
            } else if (req.body.scope && user.access === AuthUserAccess.USER || req.body.scope === ResourceCreationScope.USER) {
                username = user.email;
            }

            let basemap = await config.models.Basemap.commit(req.params.basemapid, {
                username,
                updated: sql`Now()`,
                ...req.body,
                bounds, center,
            });

            if (req.body.sharing_enabled !== undefined) {
                if (req.body.sharing_enabled) {
                    basemap = await config.models.Basemap.commit(basemap.id, {
                        sharing_token: basemap.sharing_token || `etl.${jwt.sign({ id: basemap.id, access: 'basemap', internal: true, t: +new Date() }, config.SigningSecret)}`
                    });
                } else {
                    basemap = await config.models.Basemap.commit(basemap.id, {
                        sharing_token: null
                    });
                }
            }

            res.json({
                ...basemap,
                bounds: basemap.bounds ? bbox(basemap.bounds) : undefined,
                center: basemap.center ? basemap.center.coordinates : undefined,
                actions: TileJSON.actions(basemap.url)
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/basemap/:basemapid', {
        name: 'Get Basemap',
        group: 'BaseMap',
        description: 'Get a basemap',
        params: Type.Object({
            basemapid: Type.Integer({ minimum: 1 })
        }),
        query: Type.Object({
            download: Type.Optional(Type.Boolean()),
            format: Type.Optional(Type.String()),
            token: Type.Optional(Type.String()),
        }),
        res: Type.Union([AugmentedBasemapResponse, Type.String()])
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req, { token: true });

            const basemap = await config.models.Basemap.from(req.params.basemapid);

            if (basemap.username && basemap.username !== user.email && user.access === AuthUserAccess.USER) {
                throw new Err(400, null, 'You don\'t have permission to access this resource');
            }

            if (req.query.download) {
                res.setHeader('Content-Disposition', `attachment; filename="${basemap.name}.${req.query.format}"`);
            }

            if (req.query.format === 'xml') {
                res.setHeader('Content-Type', 'text/xml');

                const xml: string = (new BasemapParser({
                    customMapSource: {
                        name: { _text: basemap.name },
                        minZoom: { _text: basemap.minzoom },
                        maxZoom: { _text: basemap.maxzoom },
                        tileType: { _text: basemap.format },
                        tileUpdate: { _text: 'None' },
                        url: { _text: TileJSON.proxyShare(config, basemap) },
                        backgroundColor: { _text: '#000000' },
                    }
                })).to_xml();

                res.send(xml);
            } else {
                res.json({
                    ...basemap,
                    bounds: basemap.bounds ? bbox(basemap.bounds) : undefined,
                    center: basemap.center ? basemap.center.coordinates : undefined,
                    actions: TileJSON.actions(basemap.url)
                });
            }
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/basemap/:basemapid/tiles', {
        name: 'Get Basemap TileJSON',
        group: 'BaseMap',
        description: 'Get a basemap tilejson',
        params: Type.Object({
            basemapid: Type.Integer({ minimum: 1 }),
        }),
        query: Type.Object({
            token: Type.Optional(Type.String()),
        }),
        res: AugmentedTileJSONType
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                token: true,
                resources: [
                    { access: AuthResourceAccess.BASEMAP, id: req.params.basemapid }
                ]
            });

            const basemap = await config.models.Basemap.from(req.params.basemapid);

            if (auth instanceof AuthUser) {
                if (basemap.username && basemap.username !== auth.email && auth.access === AuthUserAccess.USER) {
                    throw new Err(400, null, 'You don\'t have permission to access this resource');
                }
            } else if (auth instanceof AuthResource) {
                if (basemap.sharing_enabled === false) {
                    throw new Err(400, null, `Sharing for ${basemap.name} is disabled`);
                } else if (basemap.sharing_token !== auth.token) {
                    throw new Err(400, null, 'You don\'t have permission to access this resource');
                }
            }

            let url: string;
            if (basemap.url.startsWith(config.PMTILES_URL)) {
                url = basemap.url;
                if (req.query.token) url = url + `?token=${req.query.token}`;
            } else {
                url = config.API_URL + `/api/basemap/${basemap.id}/tiles/{z}/{x}/{y}`;
                if (req.query.token) url = url + `?token=${req.query.token}`;
            }

            const json = TileJSON.json({
                ...basemap,
                bounds: basemap.bounds ? bbox(basemap.bounds) : undefined,
                center: basemap.center ? basemap.center.coordinates : undefined,
                url,
            });

            res.json({
                ...json,
                actions: TileJSON.actions(basemap.url),
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/basemap/:basemapid/tiles/:z/:x/:y', {
        name: 'Get Basemap Tile',
        group: 'BaseMap',
        description: 'Get a basemap tile',
        params: Type.Object({
            basemapid: Type.Integer({ minimum: 1 }),
            z: Type.Integer({ minimum: 0 }),
            x: Type.Integer({ minimum: 0 }),
            y: Type.Integer({ minimum: 0 }),
        }),
        query: Type.Object({
            token: Type.Optional(Type.String()),
        })
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                token: true,
                resources: [
                    { access: AuthResourceAccess.BASEMAP, id: req.params.basemapid }
                ]
            });

            const basemap = await config.models.Basemap.from(req.params.basemapid);

            if (auth instanceof AuthUser) {
                if (basemap.username && basemap.username !== auth.email && auth.access === AuthUserAccess.USER) {
                    throw new Err(400, null, 'You don\'t have permission to access this resource');
                }
            } else if (auth instanceof AuthResource) {
                if (basemap.sharing_enabled === false) {
                    throw new Err(400, null, `Sharing for ${basemap.name} is disabled`);
                } else if (basemap.sharing_token !== auth.token) {
                    throw new Err(400, null, 'You don\'t have permission to access this resource');
                }
            }

            return await TileJSON.tile(
                // @ts-expect-error TODO Fix polygon bounds
                basemap,
                req.params.z,
                req.params.x,
                req.params.y,
                res,
                {
                    headers: {
                        'user-agent': req.headers['user-agent'],
                        'accept': req.headers['accept'],
                        'accept-language': req.headers['accept-language'],
                    }
                }
            );
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/basemap/:basemapid/feature', {
        name: 'Lasso Basemap Features',
        group: 'BaseMap',
        description: 'Lasso Basemap Features',
        params: Type.Object({
            basemapid: Type.Integer({ minimum: 1 }),
        }),
        body: Type.Object({
            polygon: Feature.Polygon
        }),
        res: GeoJSONFeatureCollection
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req, { token: true });

            const basemap = await config.models.Basemap.from(req.params.basemapid);

            if (basemap.username && basemap.username !== user.email && user.access === AuthUserAccess.USER) {
                throw new Err(400, null, 'You don\'t have permission to access this resource');
            }

            const fc = await TileJSON.featureQuery(
                basemap.url,
                req.body.polygon
            );

            res.json(fc);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/basemap/:basemapid/feature/:featureid', {
        name: 'Get Basemap Feature',
        group: 'BaseMap',
        description: 'Get a basemap feature',
        params: Type.Object({
            basemapid: Type.Integer({ minimum: 1 }),
            featureid: Type.String()
        }),
        res: GeoJSONFeature
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req, { token: true });

            const basemap = await config.models.Basemap.from(req.params.basemapid);

            if (basemap.username && basemap.username !== user.email && user.access === AuthUserAccess.USER) {
                throw new Err(400, null, 'You don\'t have permission to access this resource');
            }

            res.json(await TileJSON.featureFetch(basemap.url, req.params.featureid));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/basemap/:basemapid', {
        name: 'Delete Basemap',
        group: 'BaseMap',
        description: 'Delete a basemap',
        params: Type.Object({
            basemapid: Type.Integer({ minimum: 1 })
        }),
        res: StandardResponse
    }, async (req, res: Response) => {
        try {
            const user = await Auth.as_user(config, req);

            const basemap = await config.models.Basemap.from(req.params.basemapid);

            if (basemap.username && basemap.username !== user.email && user.access === AuthUserAccess.USER) {
                throw new Err(400, null, 'You don\'t have permission to access this resource');
            } else if (!basemap.username && user.access !== AuthUserAccess.ADMIN) {
                throw new Err(400, null, 'Only System Admin can edit Server Resource');
            }

            await config.models.Basemap.delete(req.params.basemapid);

            res.json({
                status: 200,
                message: 'Basemap Deleted'
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
