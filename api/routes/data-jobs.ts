import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Batch from '../lib/aws/batch.js';
import Logs from '../lib/aws/batch-logs.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import Config from '../lib/config.js';
import { AuthResourceAccess } from '@tak-ps/blueprint-login';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/connection/:connectionid/data/:dataid/job', {
        name: 'List Jobs',
        group: 'DataJobs',
        description: 'List Data Jobs',
        params: Type.Object({
            connectionid: Type.Integer()
            dataid: Type.Integer()
        }),
        res: 'res.ListDataJobs.json'
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
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
        group: 'DataJobs',
        description: 'List Data Jobs',
        params: Type.Object({
            connectionid: Type.Integer()
            dataid: Type.Integer()
            jobid: Type.String()
        }),
        res: 'res.DataJob.json'
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
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
        group: 'DataJobLogs',
        description: 'List Data Job Logs',
        params: Type.Object({
            connectionid: Type.Integer()
            dataid: Type.Integer()
            jobid: Type.String()
        }),
        res: 'res.DataJobLogs.json'
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
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
