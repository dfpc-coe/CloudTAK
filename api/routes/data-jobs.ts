import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Batch from '../lib/aws/batch.js';
import Logs from '../lib/aws/batch-logs.js';
import Config from '../lib/config.js';
import { DataJobResponse, DataJobLogResponse } from '../lib/types.js';
import { AuthResourceAccess } from '../lib/auth.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/connection/:connectionid/data/:dataid/job', {
        name: 'List Jobs',
        group: 'DataJobs',
        description: 'List Data Jobs',
        params: Type.Object({
            connectionid: Type.Integer(),
            dataid: Type.Integer()
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(DataJobResponse)
        })
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                resources: [{ access: AuthResourceAccess.DATA, id: req.params.dataid }]
            });

            const data = await config.models.Data.from(req.params.dataid);

            const list = await Batch.list(config, `data-${data.id}`);

            return res.json({
                total: list.length,
                items: list.map((job) => {
                    return {
                        id: job.id,
                        asset: job.asset,
                        status: job.status,
                        created: job.created,
                        updated: job.updated
                    }
                })
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid/data/:dataid/job/:jobid', {
        name: 'Get Jobs',
        group: 'DataJobs',
        description: 'Get Data Jobs',
        params: Type.Object({
            connectionid: Type.Integer(),
            dataid: Type.Integer(),
            jobid: Type.String()
        }),
        res: DataJobResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                resources: [{ access: AuthResourceAccess.DATA, id: req.params.dataid }]
            });

            const data = await config.models.Data.from(req.params.dataid);

            const job = await Batch.job(config, req.params.jobid);

            return res.json({
                id: job.id,
                asset: job.asset,
                status: job.status,
                created: job.created,
                updated: job.updated
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid/data/:dataid/job/:jobid/logs', {
        name: 'List Logs',
        group: 'DataJobLogs',
        description: 'List Data Job Logs',
        params: Type.Object({
            connectionid: Type.Integer(),
            dataid: Type.Integer(),
            jobid: Type.String()
        }),
        res: Type.Object({
            logs: Type.Array(DataJobLogResponse)
        })
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                resources: [{ access: AuthResourceAccess.DATA, id: req.params.dataid }]
            });

            const data = await config.models.Data.from(req.params.dataid);

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
