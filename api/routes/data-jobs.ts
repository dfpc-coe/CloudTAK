import Err from '@openaddresses/batch-error';
import Data from '../lib/types/data.ts';
import Auth from '../lib/auth.tss';
import Batch from '../lib/aws/batch.ts';
import Logs from '../lib/aws/batch-logs.ts';

import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import Config from '../lib/config.ts';

export default async function router(schema: any, config: Config) {
    await schema.get('/data/:dataid/job', {
        name: 'List Jobs',
        auth: 'user',
        group: 'DataJobs',
        description: 'List Data Jobs',
        ':dataid': 'integer',
        res: 'res.ListDataJobs.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const data = await Data.from(config.pool, req.params.dataid);

            const list = await Batch.list(config, `data-${data.id}`);

            return res.json({
                total: list.length,
                list
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/data/:dataid/job/:jobid', {
        name: 'List Jobs',
        auth: 'user',
        group: 'DataJobs',
        description: 'List Data Jobs',
        ':dataid': 'integer',
        ':jobid': 'string',
        res: 'res.DataJob.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const data = await Data.from(config.pool, req.params.dataid);

            const job = await Batch.job(config, req.params.jobid);

            return res.json(job)
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/data/:dataid/job/:jobid/logs', {
        name: 'List Logs',
        auth: 'user',
        group: 'DataJobLogs',
        description: 'List Data Job Logs',
        ':dataid': 'integer',
        ':jobid': 'string',
        res: 'res.DataJobLogs.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const data = await Data.from(config.pool, req.params.dataid);

            const job = await Batch.job(config, req.params.jobid);

            if (job.logstream) {
                const logs = await Logs.list(job.logstream);
                return res.json(logs)
            } else {
                return res.json({
                    logs: []
                })
            }
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
