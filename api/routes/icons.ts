import Auth from '../lib/auth.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import Err from '@openaddresses/batch-error';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import Config from '../lib/config.js';
import Sprites from '../lib/sprites.js';
import Cacher from '../lib/cacher.js';
import archiver from 'archiver';
import xml2js from 'xml2js';
import { Param } from '@openaddresses/batch-generic';
import { sql } from 'drizzle-orm';

export type SpriteRecord = {
    json: object;
    image: Buffer;
}

export default async function router(schema: any, config: Config) {
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
        auth: 'user',
        description: 'List Iconsets',
        query: 'req.query.ListIconsets.json',
        res: 'res.ListIconsets.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(config.models, req);

            const list = await config.models.Iconset.list({
                limit: Number(req.query.limit),
                page: Number(req.query.page),
                order: String(req.query.order),
                sort: String(req.query.sort),
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
        auth: 'user',
        description: 'Create Iconset',
        body: 'req.body.CreateIconset.json',
        res: 'iconsets.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(config.models, req);

            const iconset = await config.models.Iconset.generate(req.body);

            return res.json(iconset);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.patch('/iconset/:iconset', {
        name: 'Update Iconset',
        group: 'Icons',
        auth: 'user',
        description: 'Update Iconset',
        ':iconset': 'string',
        body: 'req.body.PatchIconset.json',
        res: 'iconsets.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(config.models, req);

            const iconset = await config.models.Iconset.commit(String(req.params.iconset), req.body);

            return res.json(iconset);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/iconset/:iconset', {
        name: 'Get Iconset',
        group: 'Icons',
        auth: 'user',
        description: 'Get Iconset',
        ':iconset': 'string',
        query: {
            type: 'object',
            properties: {
                format: {
                    type: 'string',
                    enum: ['json', 'zip'],
                    default: 'json'
                },
                download: {
                    type: 'boolean'
                }
            }
        },
        res: 'iconsets.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(config.models, req, { token: true });

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
        auth: 'user',
        description: 'Create Icon',
        ':iconset': 'string',
        body: 'req.body.CreateIcon.json',
        res: 'icons.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(config.models, req);

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
        auth: 'user',
        description: 'Delete Iconset',
        ':iconset': 'string',
        res: 'res.Standard.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(config.models, req);

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
        auth: 'user',
        description: 'List Icons',
        query: 'req.query.ListIcons.json',
        res: 'res.ListIcons.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(config.models, req);

            req.query.filter = String(req.query.filter).toLowerCase();

            const list = await config.models.Icon.list({
                limit: Number(req.query.limit),
                page: Number(req.query.page),
                order: String(req.query.order),
                sort: String(req.query.sort),
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
        auth: 'user',
        ':iconset': 'string',
        ':icon': 'string',
        description: 'Icon Metadata',
        res: 'icons.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(config.models, req);
            const icon = await config.models.Icon.from(sql`${req.params.iconset} = iconset AND ${req.params.icon} = name`);
            return res.json(icon);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.patch('/iconset/:iconset/icon/:icon', {
        name: 'Update Icon',
        group: 'Icons',
        auth: 'user',
        ':iconset': 'string',
        ':icon': 'string',
        description: 'Update Icon in Iconset',
        body: {
            type: 'object',
            additionalProperties: false,
            properties: {
                name: { type: 'string' },
                data: { type: 'string' },
                type2525b: { type: ['string', 'null'] },
            }
        },
        res: 'icons.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(config.models, req);
            let icon = await config.models.Icon.from(sql`${req.params.iconset} = iconset AND ${req.params.icon} = name`);

            if (req.body.name && path.parse(req.body.name).ext !== '.png') throw new Err(400, null, 'Name must have .png extension');
            if (req.body.name) req.body.path = `${icon.iconset}/${req.body.name}`;

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
        auth: 'user',
        ':iconset': 'string',
        ':icon': 'string',
        description: 'Remove Icon from Iconset',
        res: 'res.Standard.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(config.models, req);
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
        auth: 'user',
        ':iconset': 'string',
        ':icon': 'string',
        description: 'Icon Data',
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(config.models, req, { token: true });

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
        auth: 'user',
        description: 'Get Spriteset JSON for CoT types',
        ':iconset': 'string',
        query: {
            type: 'object',
            additionalProperties: false,
            properties: {
                iconset: { type: 'string' },
            }
        }
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(config.models, req, { token: true });

            if (SpriteMap[String(req.query.iconset)]) {
                return res.json(SpriteMap[String(req.query.iconset)].json);
            } else {
                const icons = await config.models.Icon.list({
                    limit: 1000,
                    where: sql`
                        (${Param(req.query.iconset)}::TEXT IS NULL OR ${Param(req.query.iconset)}::TEXT = iconset)
                    `
                })

                const sprites = await Sprites(icons.items);

                SpriteMap[String(req.query.iconset)] = { image: sprites.image, json: sprites.json };

                return res.json(sprites.json);
            }
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/icon/sprite.png', {
        name: 'CoT Type Sprites',
        group: 'Icons',
        auth: 'user',
        description: 'Return a sprite sheet for CoT Types',
        ':iconset': 'string',
        query: {
            type: 'object',
            additionalProperties: false,
            properties: {
                iconset: { type: 'string' },
            }
        }
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(config.models, req, { token: true });

            res.type('png');
            if (SpriteMap[String(req.query.iconset)]) {
                return res.send(SpriteMap[String(req.query.iconset)].image);
            } else {
                const icons = await config.models.Icon.list({
                    limit: 1000,
                    where: sql`
                        (${Param(req.query.iconset)}::TEXT IS NULL OR ${Param(req.query.iconset)}::TEXT = iconset)
                    `
                })
                const sprites = await Sprites(icons.items);

                SpriteMap[String(req.query.iconset)] = { image: sprites.image, json: sprites.json };

                return res.send(sprites.image);
            }
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
