import Auth from '../lib/auth.js';
import Err from '@openaddresses/batch-error';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import Iconset from '../lib/types/iconset.js';
import Icon from '../lib/types/icon.js';
import Config from '../lib/config.js';

export default async function router(schema, config: Config) {
    await schema.get('/iconset', {
        name: 'List Icons',
        group: 'Icons',
        auth: 'user',
        description: 'List Icons',
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
