import Err from '@openaddresses/batch-error';
// @ts-ignore
import Data from '../lib/types/data.js';
import { sql } from 'slonik';
import Auth from '../lib/auth.js';
import { Request, Response } from 'express';
import Config from '../lib/config.js';

export default async function router(schema: any, config: Config) {
    await schema.get('/data', {
        name: 'List Data',
        group: 'Data',
        auth: 'user',
        description: 'List data',
        query: 'req.query.ListData.json',
        res: 'res.ListData.json'
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);

            const list = await Data.list(config.pool, req.query);

            res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
