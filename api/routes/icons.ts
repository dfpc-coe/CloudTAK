import sharp from 'sharp';
import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Auth, { AuthUserAccess, ResourceCreationScope } from '../lib/auth.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import Err from '@openaddresses/batch-error';
import Config from '../lib/config.js';
import Sprites from '../lib/sprites.js';
import archiver from 'archiver';
import xml2js from 'xml2js';
import { Param } from '@openaddresses/batch-generic';
import { sql } from 'drizzle-orm';
import { StandardResponse, IconResponse, IconsetResponse } from '../lib/types.js';
import { Icon, Iconset } from '../lib/schema.js'
import * as Default from '../lib/limits.js';

export type SpriteRecord = {
    json: object;
    image: Buffer;
}

export enum IconsetFormatEnum {
    JSON = 'json',
    ZIP = 'zip'
}

const useDataAlt = true;

export default async function router(schema: Schema, config: Config) {
    const DefaultSprite = {
        json: JSON.parse(String(await fs.readFile(new URL('../icons/generator.json', import.meta.url)))),
        image: await fs.readFile(new URL('../icons/generator.png', import.meta.url))
    };

    for await (const iconset of config.models.Iconset.iter()) {
        if (iconset.spritesheet_json && iconset.spritesheet_data) continue;
        await Sprites.regen(config, iconset.uid, { useDataAlt });
    }

    await schema.get('/iconset', {
        name: 'List Iconsets',
        group: 'Icons',
        description: 'List Iconsets',
        query: Type.Object({
            scope: Type.Optional(Type.Enum(ResourceCreationScope)),
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({
                default: 'created',
                enum: Object.keys(Iconset)
            }),
            filter: Default.Filter
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(IconsetResponse)
        })
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            let scope = sql`True`;
            if (req.query.scope === ResourceCreationScope.SERVER) {
                scope = sql`username IS NULL`;
            } else if (req.query.scope === ResourceCreationScope.USER) {
                scope = sql`username IS NOT NULL`;
            }

            const list = await config.models.Iconset.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    name ~* ${req.query.filter}
                    AND (username IS NULL OR username = ${user.email})
                    AND ${scope}
                `
            });

            res.json(list);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/iconset', {
        name: 'Create Iconset',
        group: 'Icons',
        description: 'Create Iconset',
        body: Type.Object({
            uid: Type.String(),
            version: Type.Integer(),
            name: Default.NameField,
            scope: Type.Optional(Type.Enum(ResourceCreationScope)),
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
            const user = await Auth.as_user(config, req);

            let username: string | null = null;
            if (user.access !== AuthUserAccess.ADMIN && req.body.scope === ResourceCreationScope.SERVER) {
                throw new Err(400, null, 'Only Server Admins can create Server scoped iconsets');
            } else if (user.access === AuthUserAccess.USER || req.body.scope === ResourceCreationScope.USER) {
                username = user.email;
            }

            const iconset = await config.models.Iconset.generate({
                ...req.body,
                username
            });

            res.json(iconset);
        } catch (err) {
            Err.respond(err, res);
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
            public: Type.Optional(Type.Boolean()),
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
            const user = await Auth.as_user(config, req);

            const existing = await config.models.Iconset.from(req.params.iconset);

            if (existing.username && existing.username !== user.email && user.access === AuthUserAccess.USER) {
                throw new Err(400, null, 'You don\'t have permission to access this resource');
            } else if (!existing.username && user.access !== AuthUserAccess.ADMIN) {
                throw new Err(400, null, 'Only System Admin can edit Server Resource');
            }

            if (typeof req.body.public === 'boolean' && user.access === AuthUserAccess.ADMIN) {
                if (req.body.public === true) {
                    await config.models.Iconset.commit(req.params.iconset, { username: null });
                } else {
                    await config.models.Iconset.commit(req.params.iconset, { username: user.email });
                }
            }

            delete req.body.public;
            const iconset = await config.models.Iconset.commit(req.params.iconset, req.body);

            res.json(iconset);
        } catch (err) {
            Err.respond(err, res);
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
            const user = await Auth.as_user(config, req, { token: true });

            const iconset = await config.models.Iconset.from(req.params.iconset);

            if (iconset.username && iconset.username !== user.email && user.access === AuthUserAccess.USER) {
                throw new Err(400, null, 'You don\'t have permission to access this resource');
            }

            if (req.query.download) {
                res.setHeader('Content-Disposition', `attachment; filename="${iconset.name}.${req.query.format}"`);
            }

            if (req.query.format === 'zip') {
                const archive = archiver('zip', {
                    zlib: { level: 9 } // Sets the compression level.
                })

                archive.pipe(res);

                const xmljson: any = {
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
                        buffer = Buffer.from(await sharp(buffer).resize(32).toBuffer())
                    }

                    archive.append(Buffer.from(icon.data, 'base64'), { name: icon.name });
                    xmljson.iconset.icon.push({ $: {
                        name: path.parse(icon.name).base,
                        type2525b: icon.type2525b
                    } })
                }

                res.setHeader('Content-Type', 'text/xml');

                const builder = new xml2js.Builder();
                const xml = builder.buildObject(xmljson);

                archive.append(Buffer.from(xml), { name: 'iconset.xml' });

                archive.finalize();
            } else {
                res.json(iconset);
            }
        } catch (err) {
            Err.respond(err, res);
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
            const user = await Auth.as_user(config, req);

            const iconset = await config.models.Iconset.from(req.params.iconset);

            if (iconset.username && iconset.username !== user.email && user.access === AuthUserAccess.USER) {
                throw new Err(400, null, 'You don\'t have permission to access this resource');
            } else if (!iconset.username && user.access !== AuthUserAccess.ADMIN) {
                throw new Err(400, null, 'Only System Admin can edit Server Resource');
            }

            await config.models.Icon.delete(sql`iconset = ${req.params.iconset}`);
            await config.models.Iconset.delete(String(req.params.iconset));

            res.json({
                status: 200,
                message: 'Iconset Deleted'
            });
        } catch (err) {
            Err.respond(err, res);
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
            name: Default.NameField,
            data: Type.String(),
            data_alt: Type.Optional(Type.String()),
            type2525b: Type.Optional(Type.Union([Type.String(), Type.Null()]))
        }),
        res: IconResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const iconset = await config.models.Iconset.from(req.params.iconset);

            if (iconset.username && iconset.username !== user.email && user.access === AuthUserAccess.USER) {
                throw new Err(400, null, 'You don\'t have permission to access this resource');
            } else if(!iconset.username && user.access !== AuthUserAccess.ADMIN) {
                throw new Err(400, null, 'Only Server Admins can create Server scoped icons');
            }

            if (path.parse(req.body.name).ext !== '.png') throw new Err(400, null, 'Name must have .png extension');

            const icon = await config.models.Icon.generate({
                ...req.body,
                path: `${iconset.uid}/${req.body.name}`,
                iconset: iconset.uid
            });

            res.json(icon);

            await Sprites.regen(config, iconset.uid, { useDataAlt });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/icon', {
        name: 'List Icons',
        group: 'Icons',
        description: 'List Icons',
        query: Type.Object({
            scope: Type.Optional(Type.Enum(ResourceCreationScope)),
            limit: Type.Optional(Type.Integer({ default: 100 })),
            page: Default.Page,
            order: Default.Order,
            sort: Type.Optional(Type.String({default: 'created', enum: Object.keys(Icon) })),
            iconset: Type.Optional(Type.String()),
            filter: Default.Filter
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(IconResponse)
        })
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            req.query.filter = req.query.filter.toLowerCase();

            let scope = sql`True`;
            if (req.query.scope === ResourceCreationScope.SERVER) scope = sql`username IS NULL`;
            else if (req.query.scope === ResourceCreationScope.USER) scope = sql`username IS NOT NULL`;

            const list = await config.models.Icon.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    icons.name ~* ${req.query.filter}
                    AND (${Param(req.query.iconset)}::TEXT IS NULL OR ${Param(req.query.iconset)}::TEXT = iconset)
                    AND (username IS NULL OR username = ${user.email})
                    AND ${scope}
                `
            });

            res.json(list)

        } catch (err) {
            Err.respond(err, res);
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
            const user = await Auth.as_user(config, req);

            const iconset = await config.models.Iconset.from(req.params.iconset);
            if (iconset.username && iconset.username !== user.email && user.access === AuthUserAccess.USER) {
                throw new Err(400, null, 'You don\'t have permission to access this resource');
            }

            const icon = await config.models.Icon.from(sql`${req.params.iconset} = iconset AND ${req.params.icon} = name`);
            res.json(icon);
        } catch (err) {
            Err.respond(err, res);
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
            data_alt: Type.Optional(Type.String()),
            type2525b: Type.Optional(Type.Union([Type.String(), Type.Null()]))
        }),
        res: IconResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const iconset = await config.models.Iconset.from(req.params.iconset);

            if (iconset.username && iconset.username !== user.email && user.access === AuthUserAccess.USER) {
                throw new Err(400, null, 'You don\'t have permission to access this resource');
            } else if (!iconset.username && user.access !== AuthUserAccess.ADMIN) {
                throw new Err(400, null, 'Only System Admin can edit Server Resource');
            }

            let icon = await config.models.Icon.from(sql`${req.params.iconset} = iconset AND ${req.params.icon} = name`);

            if (req.body.name && path.parse(req.body.name).ext !== '.png') throw new Err(400, null, 'Name must have .png extension');
            if (req.body.name) {
                await config.models.Icon.commit(icon.id, { path: `${icon.iconset}/${req.body.name}` });
            }
            if (req.body.type2525b === '') delete req.body.type2525b;

            icon = await config.models.Icon.commit(icon.id, req.body);

            res.json(icon);

            await Sprites.regen(config, iconset.uid, { useDataAlt });
        } catch (err) {
            Err.respond(err, res);
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
            const user = await Auth.as_user(config, req);

            const iconset = await config.models.Iconset.from(req.params.iconset);

            if (iconset.username && iconset.username !== user.email && user.access === AuthUserAccess.USER) {
                throw new Err(400, null, 'You don\'t have permission to access this resource');
            } else if (!iconset.username && user.access !== AuthUserAccess.ADMIN) {
                throw new Err(400, null, 'Only System Admin can edit Server Resource');
            }

            await config.models.Icon.delete(sql`${req.params.iconset} = iconset AND ${req.params.icon} = name`);

            res.json({
                status: 200,
                message: 'Icon Deleted'
            });

            await Sprites.regen(config, iconset.uid, { useDataAlt });
        } catch (err) {
            Err.respond(err, res);
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
            alt: Type.Boolean({
                default: false,
                description: 'Use alternate icon if possible'
            })
        }),
        description: 'Icon Data',
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req, { token: true });

            const iconset = await config.models.Iconset.from(req.params.iconset);
            if (iconset.username && iconset.username !== user.email && user.access === AuthUserAccess.USER) {
                throw new Err(400, null, 'You don\'t have permission to access this resource');
            }

            const icon = await config.models.Icon.from(sql`
                (${req.params.iconset} = iconset AND ${req.params.icon} = name)
            `);

            if (req.query.alt && icon.data_alt) {
                res.status(200).send(Buffer.from(icon.data, 'base64'));
            } else {
                res.status(200).send(Buffer.from(icon.data, 'base64'));
            }
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/iconset/:iconset/sprite{:size}.json', {
        name: 'CoT Type Sprites (json)',
        group: 'Icons',
        description: 'Get Spriteset JSON for CoT types',
        params: Type.Object({
            iconset: Type.String(),
            size: Type.Optional(Type.String())
        }),
        query: Type.Object({
            scope: Type.Optional(Type.Enum(ResourceCreationScope)),
            token: Type.Optional(Type.String()),
        }),
        res: Type.Unknown()
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req, { token: true });

            if (req.params.iconset === 'default') {
                res.json(DefaultSprite.json);
            } else {
                const iconset = await config.models.Iconset.from(req.params.iconset);
                if (iconset.username && iconset.username !== user.email && user.access === AuthUserAccess.USER) {
                    throw new Err(400, null, 'You don\'t have permission to access this resource');
                }

                if (iconset.spritesheet_json) {
                    res.json(JSON.parse(String(iconset.spritesheet_json)));
                } else {
                    throw new Err(400, null, 'Request regeneration of Iconset Spritesheet');
                }
            }
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/iconset/:iconset/sprite{:size}.png', {
        name: 'CoT Type Sprites',
        group: 'Icons',
        description: 'Return a sprite sheet for CoT Types',
        params: Type.Object({
            iconset: Type.String(),
            size: Type.Optional(Type.String())
        }),
        query: Type.Object({
            token: Type.Optional(Type.String()),
        })
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req, { token: true });

            res.type('png');

            if (req.params.iconset === 'default') {
                res.send(DefaultSprite.image);
            } else {
                const iconset = await config.models.Iconset.from(req.params.iconset);
                if (iconset.username && iconset.username !== user.email && user.access === AuthUserAccess.USER) {
                    throw new Err(400, null, 'You don\'t have permission to access this resource');
                }

                if (iconset.spritesheet_data) {
                    res.send(Buffer.from(iconset.spritesheet_data, 'base64'));
                } else {
                    throw new Err(400, null, 'Request regeneration of Iconset Spritesheet');
                }
            }
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
