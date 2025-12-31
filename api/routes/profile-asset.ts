import path from 'node:path';
import { Type } from '@sinclair/typebox'
import { StandardResponse, ProfileFileResponse } from '../lib/types.js';
import { sql } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import S3 from '../lib/aws/s3.js';
import jwt from 'jsonwebtoken';
import { ProfileFile } from '../lib/schema.js';
import Config from '../lib/config.js';
import * as Default from '../lib/limits.js'

export default async function router(schema: Schema, config: Config) {
    async function ensureIconsetPermission(iconset: string | null | undefined, email: string) {
        if (iconset === undefined || iconset === null || iconset === '') return;

        const iconsetRes = await config.models.Iconset.from(iconset);

        if (iconsetRes.username !== email) {
            throw new Err(403, null, `You do not have permission to associate iconset '${iconset}'`);
        }
    }

    await schema.get('/profile/asset', {
        name: 'List Files',
        group: 'ProfileFile',
        description: 'List Files',
        query: Type.Object({
            limit: Type.Integer({
                default: 100,
                minimum: 1,
                maximum: 1000
            }),
            sort: Type.String({
                default: 'created',
                enum: Object.keys(ProfileFile)
            }),
            filter: Type.String({
                default: ''
            }),
            page: Default.Page,
            order: Default.Order,
        }),
        res: Type.Object({
            total: Type.Integer(),
            tiles: Type.Object({
                url: Type.String()
            }),
            items: Type.Array(ProfileFileResponse)
        })
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const list = await config.models.ProfileFile.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    name ~* ${req.query.filter}
                    AND username = ${user.email}
                `
            });

            res.json({
                tiles: {
                    url: String(new URL(`${config.PMTILES_URL}/tiles/profile/${user.email}/`))
                },
                ...list
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.delete('/profile/asset/:asset', {
        name: 'Delete File',
        group: 'ProfileFile',
        description: 'Delete Asset',
        params: Type.Object({
            asset: Type.String({
                format: 'uuid'
            }),
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const file = await config.models.ProfileFile.from(req.params.asset);

            if (file.username !== user.email) {
                throw new Err(403, null, 'You do not have permission to delete this asset');
            }

            await config.models.ProfileFile.delete(req.params.asset);

            if (file.iconset) {
                const iconset = await config.models.Iconset.from(file.iconset);

                if (await config.models.ProfileFile.count({
                    where: sql`
                      iconset = ${file.iconset}
                    `
                }) > 1) {
                    return;
                }

                if (iconset.username_internal && iconset.username && iconset.username === user.email) {
                    await config.models.Icon.delete(sql`iconset = ${file.iconset}`);
                    await config.models.Iconset.delete(String(file.iconset));
                }
            }

            await S3.del(`profile/${user.email}/${req.params.asset}`, {
                recurse: true
            });

            res.json({
                status: 200,
                message: 'Asset Deleted'
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.post('/profile/asset', {
        name: 'Create Asset',
        group: 'ProfileFile',
        description: 'Internal API used to create assets after S3 assets have been uploaded by the Events Task',
        body: Type.Object({
            id: Type.String({
                description: 'Random UUID v4 of uploaded asset'
            }),
            name: Type.String(),
            path: Type.String({
                default: '/'
            }),
            iconset: Type.Optional(Type.Union([Type.Null(), Type.String()])),
            artifacts: Type.Array(Type.Object({
                ext: Type.String()
            }), {
                default: []
            })
        }),
        res: ProfileFileResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req, { token: true });

            const head = await S3.head(`profile/${user.email}/${req.body.id}${path.parse(req.body.name).ext}`)

            const artifacts = [];
            for (const artifact of req.body.artifacts) {
                artifacts.push({
                    ext: artifact.ext,
                    size: (await S3.head(`profile/${user.email}/${req.body.id}${artifact.ext}`)).ContentLength || 0
                });
            }

            await ensureIconsetPermission(req.body.iconset, user.email);

            console.error('ICONSET', req.body.iconset, typeof req.body.iconset);

            const file = await config.models.ProfileFile.generate({
                id: req.body.id,
                username: user.email,
                name: req.body.name,
                path: req.body.path,
                iconset: req.body.iconset ?? null,
                size: head.ContentLength || 0,
                artifacts
            });

            res.json(file);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.patch('/profile/asset/:asset', {
        name: 'Update Asset',
        group: 'ProfileFile',
        description: 'Modify Asset Metadata',
        params: Type.Object({
            asset: Type.String({
                format: 'uuid'
            }),
        }),
        body: Type.Object({
            path: Type.Optional(Type.String()),
            artifacts: Type.Optional(Type.Array(Type.Object({
                ext: Type.String()
            }))),
            name: Type.Optional(Type.String()),
            iconset: Type.Optional(Type.Union([Type.Null(), Type.String()]))
        }),
        res: ProfileFileResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req, { token: true });

            let file = await config.models.ProfileFile.from(req.params.asset);

            if (file.username !== user.email) {
                throw new Err(403, null, 'You do not have permission to modify this asset');
            }

            if (req.body.artifacts) {
                const artifacts = [];
                for (const artifact of req.body.artifacts) {
                    artifacts.push({
                        ext: artifact.ext,
                        size: (await S3.head(`profile/${user.email}/${file.id}${artifact.ext}`)).ContentLength
                    });
                }

                file = await config.models.ProfileFile.commit(req.params.asset, { artifacts });
            }

            let iconsetValue = file.iconset;
            if (req.body.iconset === null) {
                iconsetValue = null;
            } else if (req.body.iconset !== undefined) {
                iconsetValue = req.body.iconset;
            }

            await ensureIconsetPermission(iconsetValue, user.email);

            file = await config.models.ProfileFile.commit(req.params.asset, {
                name: req.body.name,
                path: req.body.path,
                iconset: iconsetValue
            });

            res.json(file);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/profile/asset/:asset.:ext', {
        name: 'Raw Asset',
        group: 'ProfileFile',
        description: 'Get single raw asset',
        query: Type.Object({
            token: Type.Optional(Type.String())
        }),
        params: Type.Object({
            asset: Type.String({
                format: 'uuid'
            }),
            ext: Type.String()
        }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req, { token: true });

            const file = await config.models.ProfileFile.from(req.params.asset);

            if (file.username !== user.email) {
                throw new Err(403, null, 'You do not have permission to download this asset');
            }

            const stream = await S3.get(`profile/${user.email}/${req.params.asset}.${req.params.ext}`);

            stream.pipe(res);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/profile/asset/:asset.pmtiles/tile', {
        name: 'PMTiles TileJSON',
        group: 'ProfileFile',
        description: 'Get TileJSON ',
        query: Type.Object({
            token: Type.Optional(Type.String())
        }),
        params: Type.Object({
            asset: Type.String(),
        }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req, { token: true });

            const file = await config.models.ProfileFile.from(req.params.asset);

            if (file.username !== user.email) {
                throw new Err(403, null, 'You do not have permission to view this asset');
            }

            if (!await S3.exists(`profile/${user.email}/${req.params.asset}.pmtiles`)) {
                throw new Err(404, null, 'Asset does not exist');
            }

            const token = jwt.sign({ access: 'profile', email: user.email }, config.SigningSecret)
            const url = new URL(`${config.PMTILES_URL}/tiles/profile/${user.email}/${req.params.asset}`);
            url.searchParams.append('token', token);

            res.redirect(String(url));
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
