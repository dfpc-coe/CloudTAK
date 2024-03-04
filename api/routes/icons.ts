import sharp from 'sharp';
import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Auth from '../lib/auth.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import Err from '@openaddresses/batch-error';
import Config from '../lib/config.js';
import Sprites from '../lib/sprites.js';
import Cacher from '../lib/cacher.js';
import archiver from 'archiver';
import xml2js from 'xml2js';
import { Param } from '@openaddresses/batch-generic';
import { sql } from 'drizzle-orm';
import { StandardResponse, IconResponse, IconsetResponse } from '../lib/types.js';
import { GenericListOrder } from '@openaddresses/batch-generic';
import{ Icon, Iconset } from '../lib/schema.js'

export type SpriteRecord = {
    json: object;
    image: Buffer;
}

export enum IconsetFormatEnum {
    JSON = 'json',
    ZIP = 'zip'
}

export default async function router(schema: Schema, config: Config) {
    // Eventually look at replacing this with memcached?
    const SpriteMap: Record<string, SpriteRecord> = {
        default: {
            json: JSON.parse(String(await fs.readFile(new URL('../icons/generator.json', import.meta.url)))),
            image: await fs.readFile(new URL('../icons/generator.png', import.meta.url))
        }
    };

    await schema.get('/iconset', {
        name: 'List Iconsets',
        group: 'Icons',
        description: 'List Iconsets',
        query: Type.Object({
            limit: Type.Optional(Type.Integer({ default: 25 })),
            page: Type.Optional(Type.Integer()),
            order: Type.Optional(Type.Enum(GenericListOrder)),
            sort: Type.Optional(Type.String({default: 'created', enum: Object.keys(Iconset) })),
            filter: Type.Optional(Type.String({default: ''}))
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(IconsetResponse)
        })
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const list = await config.models.Iconset.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    name ~* ${req.query.filter}
                `
            });

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/iconset', {
        name: 'Create Iconset',
        group: 'Icons',
        description: 'Create Iconset',
        body: Type.Object({
            uid: Type.String(),
            version: Type.Integer(),
            name: Type.String(),
            default_group: Type.Optional(Type.String()),
            default_friendly: Type.Optional(Type.String()),
            default_hostile: Type.Optional(Type.String()),
            default_neutral: Type.Optional(Type.String()),
            default_unknown: Type.Optional(Type.String()),
            skip_resize: Type.Optional(Type.Boolean())
        }),
        res: IconsetResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const iconset = await config.models.Iconset.generate(req.body);

            return res.json(iconset);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.patch('/iconset/:iconset', {
        name: 'Update Iconset',
        group: 'Icons',
        description: 'Update Iconset',
        params: Type.Object({
            iconset: Type.String()
        }),
        body: Type.Object({
            default_group: Type.Optional(Type.String()),
            default_friendly: Type.Optional(Type.String()),
            default_hostile: Type.Optional(Type.String()),
            default_neutral: Type.Optional(Type.String()),
            default_unknown: Type.Optional(Type.String()),
            skip_resize: Type.Optional(Type.Boolean())
        }),
        res: IconsetResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const iconset = await config.models.Iconset.commit(String(req.params.iconset), req.body);

            return res.json(iconset);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/iconset/:iconset', {
        name: 'Get Iconset',
        group: 'Icons',
        description: 'Get Iconset',
        params: Type.Object({
            iconset: Type.String()
        }),
        query: Type.Object({
            format: Type.Optional(Type.Enum(IconsetFormatEnum)),
            download: Type.Optional(Type.Boolean()),
            resize: Type.Optional(Type.Boolean({ description: 'Resize Images to 32x32px'})),
            token: Type.Optional(Type.String()),
        }),
        res: IconsetResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, { token: true });

            const iconset = await config.models.Iconset.from(String(req.params.iconset));

            if (req.query.download) {
                res.setHeader('Content-Disposition', `attachment; filename="${iconset.name}.${req.query.format}"`);
            }

            if (req.query.format === 'zip') {
                const archive = archiver('zip', {
                    zlib: { level: 9 } // Sets the compression level.
                })

                archive.pipe(res);

                const xmljson = {
                    iconset: {
                        $: {
                            version: 1,
                            defaultFriendly: iconset.default_friendly,
                            defaultHostile: iconset.default_hostile,
                            defaultNeutral: iconset.default_neutral,
                            defaultUnknown: iconset.default_unknown,
                            name: iconset.name,
                            defaultGroup: iconset.default_group,
                            skipResize: 'false',
                            uid: iconset.uid
                        },
                        icon: []
                    }
                };

                for (const icon of (await config.models.Icon.list({
                    limit: 1000,
                    where: sql`iconset = ${String(req.params.iconset)}`
                })).items) {
                    let buffer = Buffer.from(icon.data, 'base64');

                    if (req.query.resize) {
                        buffer = await sharp(buffer).resize(32).toBuffer()
                    }

                    archive.append(Buffer.from(icon.data, 'base64'), { name: icon.name });
                    // @ts-ignore
                    xmljson.iconset.icon.push({ $: { name: path.parse(icon.name).base, type2525b: icon.type2525b } })
                }

                res.setHeader('Content-Type', 'text/xml');

                const builder = new xml2js.Builder();
                const xml = builder.buildObject(xmljson);

                archive.append(Buffer.from(xml), { name: 'iconset.xml' });

                archive.finalize();
            } else {
                return res.json(iconset);
            }
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/iconset/:iconset/icon', {
        name: 'Create Icon',
        group: 'Icons',
        description: 'Create Icon',
        params: Type.Object({
            iconset: Type.String()
        }),
        body: Type.Object({
            name: Type.String(),
            data: Type.String(),
            type2525b: Type.Optional(Type.Union([Type.String(), Type.Null()]))
        }),
        res: IconResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const iconset = await config.models.Iconset.from(String(req.params.iconset));

            if (path.parse(req.body.name).ext !== '.png') throw new Err(400, null, 'Name must have .png extension');

            const icon = await config.models.Icon.generate({
                ...req.body,
                path: `${iconset.uid}/${req.body.name}`,
                iconset: iconset.uid
            });

            return res.json(icon);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/iconset/:iconset', {
        name: 'Delete Iconset',
        group: 'Icons',
        description: 'Delete Iconset',
        params: Type.Object({
            iconset: Type.String()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            await config.models.Icon.delete(sql`iconset = ${req.params.iconset}`);
            await config.models.Iconset.delete(String(req.params.iconset));

            return res.json({
                status: 200,
                message: 'Iconset Deleted'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/icon', {
        name: 'List Icons',
        group: 'Icons',
        description: 'List Icons',
        query: Type.Object({
            limit: Type.Optional(Type.Integer({ default: 100 })),
            page: Type.Optional(Type.Integer()),
            order: Type.Optional(Type.Enum(GenericListOrder)),
            sort: Type.Optional(Type.String({default: 'created', enum: Object.keys(Icon) })),
            iconset: Type.Optional(Type.String()),
            filter: Type.Optional(Type.String({default: ''}))
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(IconResponse)
        })
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            req.query.filter = req.query.filter.toLowerCase();

            const list = await config.models.Icon.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    name ~* ${req.query.filter}
                    AND (${Param(req.query.iconset)}::TEXT IS NULL OR ${Param(req.query.iconset)}::TEXT = iconset)
                `
            });

            return res.json(list)

        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/iconset/:iconset/icon/:icon', {
        name: 'Get Icon',
        group: 'Icons',
        params: Type.Object({
            iconset: Type.String(),
            icon: Type.String()
        }),
        description: 'Icon Metadata',
        res: IconResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);
            const icon = await config.models.Icon.from(sql`${req.params.iconset} = iconset AND ${req.params.icon} = name`);
            return res.json(icon);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.patch('/iconset/:iconset/icon/:icon', {
        name: 'Update Icon',
        group: 'Icons',
        params: Type.Object({
            iconset: Type.String(),
            icon: Type.String()
        }),
        description: 'Update Icon in Iconset',
        body: Type.Object({
            name: Type.Optional(Type.String()),
            data: Type.Optional(Type.String()),
            type2525b: Type.Optional(Type.Union([Type.String(), Type.Null()]))
        }),
        res: IconResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);
            let icon = await config.models.Icon.from(sql`${req.params.iconset} = iconset AND ${req.params.icon} = name`);

            if (req.body.name && path.parse(req.body.name).ext !== '.png') throw new Err(400, null, 'Name must have .png extension');
            if (req.body.name) {
                await config.models.Icon.commit(icon.id, { path: `${icon.iconset}/${req.body.name}` });
            }
            if (req.body.type2525b === '') delete req.body.type2525b;

            icon = await config.models.Icon.commit(icon.id, req.body);

            return res.json(icon);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/iconset/:iconset/icon/:icon', {
        name: 'Delete Icon',
        group: 'Icons',
        params: Type.Object({
            iconset: Type.String(),
            icon: Type.String()
        }),
        description: 'Remove Icon from Iconset',
        res: StandardResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);
            const icon = await config.models.Icon.delete(sql`${req.params.iconset} = iconset AND ${req.params.icon} = name`);
            return res.json({
                status: 200,
                message: 'Icon Deleted'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/iconset/:iconset/icon/:icon/raw', {
        name: 'Get Raw',
        group: 'Icons',
        params: Type.Object({
            iconset: Type.String(),
            icon: Type.String()
        }),
        query: Type.Object({
            token: Type.Optional(Type.String()),
        }),
        description: 'Icon Data',
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, { token: true });

            const icon = await config.models.Icon.from(sql`
                (${req.params.iconset} = iconset AND ${req.params.icon} = name)
            `);
            return res.status(200).send(Buffer.from(icon.data, 'base64'));
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/icon/sprite.json', {
        name: 'CoT Type Sprites (json)',
        group: 'Icons',
        description: 'Get Spriteset JSON for CoT types',
        query: Type.Object({
            iconset: Type.Optional(Type.String()),
            token: Type.Optional(Type.String()),
        })
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, { token: true });

            if (SpriteMap[req.query.iconset]) {
                return res.json(SpriteMap[req.query.iconset].json);
            } else {
                const icons = await config.models.Icon.list({
                    limit: 1000,
                    where: sql`
                        (${Param(req.query.iconset)}::TEXT IS NULL OR ${Param(req.query.iconset)}::TEXT = iconset)
                    `
                })

                const sprites = await Sprites(icons.items);

                SpriteMap[req.query.iconset] = { image: sprites.image, json: sprites.json };

                return res.json(sprites.json);
            }
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/icon/sprite.png', {
        name: 'CoT Type Sprites',
        group: 'Icons',
        description: 'Return a sprite sheet for CoT Types',
        query: Type.Object({
            iconset: Type.Optional(Type.String()),
            token: Type.Optional(Type.String()),
        })
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, { token: true });

            res.type('png');
            if (SpriteMap[req.query.iconset]) {
                return res.send(SpriteMap[req.query.iconset].image);
            } else {
                const icons = await config.models.Icon.list({
                    limit: 1000,
                    where: sql`
                        (${Param(req.query.iconset)}::TEXT IS NULL OR ${Param(req.query.iconset)}::TEXT = iconset)
                    `
                })
                const sprites = await Sprites(icons.items);

                SpriteMap[req.query.iconset] = { image: sprites.image, json: sprites.json };

                return res.send(sprites.image);
            }
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
