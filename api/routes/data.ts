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

    await schema.post('/data', {
        name: 'Create data',
        group: 'Data',
        auth: 'admin',
        description: 'Register a new data source',
        body: 'req.body.CreateData.json',
        res: 'data.json'
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);
            let data = await Data.generate(config.pool, req.body);
            return res.json(data);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.patch('/data/:dataid', {
        name: 'Update Layer',
        group: 'Data',
        auth: 'admin',
        description: 'Update a data source',
        ':dataid': 'integer',
        body: 'req.body.PatchData.json',
        res: 'data.json'
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);

            let data = await Data.commit(config.pool, parseInt(req.params.dataid), {
                updated: sql`Now()`,
                ...req.body
            });

            return res.json(data);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/data/:dataid', {
        name: 'Get Data',
        group: 'Data',
        auth: 'user',
        description: 'Get a data source',
        ':dataid': 'integer',
        res: 'data.json'
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);

            const data = await Data.from(config.pool, req.params.dataid);

            return res.json(data);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/data/:dataid', {
        name: 'Delete Data',
        group: 'Data',
        auth: 'user',
        description: 'Delete a data source',
        ':dataid': 'integer',
        res: 'res.Standard.json'
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);

            const data = await Data.from(config.pool, req.params.layerid);

            await data.delete();

            return res.json({
                status: 200,
                message: 'Data Deleted'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
