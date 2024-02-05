import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Batch from '../lib/aws/batch.js';
import Logs from '../lib/aws/batch-logs.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import Config from '../lib/config.js';
import { AuthResourceAccess } from '@tak-ps/blueprint-login';

export default async function router(schema: any, config: Config) {
    await schema.get('/connection/:connectionid/data/:dataid/job', {
        name: 'List Jobs',
        auth: 'user',
        group: 'DataJobs',
        description: 'List Data Jobs',
        ':connectionid': 'integer',
        ':dataid': 'integer',
        res: 'res.ListDataJobs.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(config.models, req, {
                resources: [{ access: AuthResourceAccess.DATA, id: parseInt(req.params.dataid) }]
            });

            const data = await config.models.Data.from(parseInt(req.params.dataid));

            const list = await Batch.list(config, `data-${data.id}`);

            return res.json({
                total: list.length,
                items: list
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid/data/:dataid/job/:jobid', {
        name: 'List Jobs',
        auth: 'user',
        group: 'DataJobs',
        description: 'List Data Jobs',
        ':connectionid': 'integer',
        ':dataid': 'integer',
        ':jobid': 'string',
        res: 'res.DataJob.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(config.models, req, {
                resources: [{ access: AuthResourceAccess.DATA, id: parseInt(req.params.dataid) }]
            });

            const data = await config.models.Data.from(parseInt(req.params.dataid));

            const job = await Batch.job(config, req.params.jobid);

            return res.json(job)
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid/data/:dataid/job/:jobid/logs', {
        name: 'List Logs',
        auth: 'user',
        group: 'DataJobLogs',
        description: 'List Data Job Logs',
        ':connectionid': 'integer',
        ':dataid': 'integer',
        ':jobid': 'string',
        res: 'res.DataJobLogs.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(config.models, req, {
                resources: [{ access: AuthResourceAccess.DATA, id: parseInt(req.params.dataid) }]
            });

            const data = await config.models.Data.from(parseInt(req.params.dataid));

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
