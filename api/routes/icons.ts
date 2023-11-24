import Auth from '../lib/auth.js';
import Err from '@openaddresses/batch-error';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import Iconset from '../lib/types/iconset.js';
import Icon from '../lib/types/icon.js';
import Config from '../lib/config.js';
import Sprites from '../lib/sprites.js';

export default async function router(schema, config: Config) {
    await schema.get('/iconset', {
        name: 'List Iconsets',
        group: 'Icons',
        auth: 'user',
        description: 'List Iconsets',
        query: 'req.query.ListIconsets.json',
        res: 'res.ListIconsets.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const list = await Iconset.list(config.pool, req.query);

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
            await Auth.is_auth(req);

            const iconset = await Iconset.generate(config.pool, req.body);

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
            await Auth.is_auth(req);

            const iconset = await Iconset.commit(config.pool, req.params.iconset, req.body);

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
        res: 'iconsets.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const iconset = await Iconset.from(config.pool, req.params.iconset);

            return res.json(iconset);
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
            await Auth.is_auth(req);

            const iconset = await Iconset.from(config.pool, req.params.iconset);

            const icon = await Icon.generate(config.pool, {
                ...req.body,
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
            await Auth.is_auth(req);

            await Icon.delete(config.pool, req.params.iconset, { column: 'iconset' });
            await Iconset.delete(config.pool, req.params.iconset);

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
            await Auth.is_auth(req);

            req.query.filter = String(req.query.filter).toLowerCase();

            const list = await Icon.list(config.pool, req.query);

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
            await Auth.is_auth(req);
            const icon = await Icon.from(config.pool, req.params.iconset, req.params.icon);
            return res.json(icon);
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
            await Auth.is_auth(req, true);

            const icon = await Icon.from(config.pool, req.params.iconset, req.params.icon);
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
                type: { type: 'boolean' }
            }
        }
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req, true);

            const icons = await Icon.list(config.pool, req.query)

            const sprites = await Sprites(icons);
            return res.json(sprites.json);
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
                type: { type: 'boolean' }
            }
        }
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req, true);

            const icons = await Icon.list(config.pool, req.query)

            const sprites = await Sprites(icons, {
                name: 'type2525b'
            });

            res.type('png');
            return res.send(sprites.image);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
