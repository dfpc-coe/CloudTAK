import Err from '@openaddresses/batch-error';
// @ts-ignore
import Data from '../lib/types/data.js';
import Auth from '../lib/auth.js';
import Batch from '../lib/aws/batch.js';

import { Request, Response } from 'express';
import Config from '../lib/config.js';

export default async function router(schema: any, config: Config) {
    await schema.get('/data/:dataid/job', {
        name: 'List Jobs',
        auth: 'user',
        group: 'DataJobs',
        description: 'List Data Jobs',
        ':dataid': 'integer',
        res: 'res.ListDataJobs.json'
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);

            const data = await Data.from(config.pool, req.params.dataid);

            const list = await Batch.list(config, data);

            return res.json({
                total: list.length,
                list
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
