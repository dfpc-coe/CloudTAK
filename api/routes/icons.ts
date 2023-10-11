import Auth from '../lib/auth.js';
import Err from '@openaddresses/batch-error';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import Iconset from '../lib/types/iconset.js';
import Icon from '../lib/types/icon.js';
import Config from '../lib/config.js';

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
        name: 'Create Iconset',
        group: 'Icons',
        auth: 'user',
        description: 'Patch Iconset',
        ':iconset': 'string',
        body: 'req.body.PatchIconset.json',
        res: 'iconsets.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const iconset = await Iconset.commit(config.pool, req.body);

            return res.json(iconset);
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

    await schema.get('/icon/:icon', {
        name: 'Get Icon',
        group: 'Icons',
        auth: 'user',
        ':icon': 'string',
        description: 'Icon Metadata',
        res: 'res.Icon.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
