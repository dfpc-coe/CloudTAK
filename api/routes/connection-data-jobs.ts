import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Batch from '../lib/aws/batch.js';
import Logs from '../lib/aws/batch-logs.js';
import Config from '../lib/config.js';
import { JobResponse, JobLogResponse } from '../lib/types.js';
import { AuthResourceAccess } from '../lib/auth.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/connection/:connectionid/data/:dataid/job', {
        name: 'List Jobs',
        group: 'DataJobs',
        description: 'List Data Jobs',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
            dataid: Type.Integer({ minimum: 1 })
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(JobResponse)
        })
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.DATA, id: req.params.dataid },
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }
                ]
            }, req.params.connectionid);

            if (connection.readonly) throw new Err(400, null, 'Connection is Read-Only mode');

            const data = await config.models.Data.from(req.params.dataid);
            if (data.connection !== connection.id) throw new Err(400, null, 'Data Sync does not belong to given Connection');

            const list = await Batch.list(config, `data-${data.id}`);

            res.json({
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
            Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid/data/:dataid/job/:jobid', {
        name: 'Get Jobs',
        group: 'DataJobs',
        description: 'Get Data Jobs',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
            dataid: Type.Integer({ minimum: 1 }),
            jobid: Type.String()
        }),
        res: JobResponse
    }, async (req, res) => {
        try {
            const { connection} = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.DATA, id: req.params.dataid },
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }
                ]
            }, req.params.connectionid);

            if (connection.readonly) throw new Err(400, null, 'Connection is Read-Only mode');

            const data = await config.models.Data.from(req.params.dataid);
            if (data.connection !== connection.id) throw new Err(400, null, 'Data Sync does not belong to given Connection');

            const job = await Batch.job(config, req.params.jobid);

            res.json({
                id: job.id,
                asset: job.asset,
                status: job.status,
                created: job.created,
                updated: job.updated
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid/data/:dataid/job/:jobid/logs', {
        name: 'List Logs',
        group: 'DataJobLogs',
        description: 'List Data Job Logs',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
            dataid: Type.Integer({ minimum: 1 }),
            jobid: Type.String()
        }),
        res: Type.Object({
            logs: Type.Array(JobLogResponse)
        })
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.DATA, id: req.params.dataid },
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }
                ]
            }, req.params.connectionid);

            if (connection.readonly) throw new Err(400, null, 'Connection is Read-Only mode');

            const data = await config.models.Data.from(req.params.dataid);
            if (data.connection !== connection.id) throw new Err(400, null, 'Data Sync does not belong to given Connection');

            const job = await Batch.job(config, req.params.jobid);

            if (job.logstream) {
                const logs = await Logs.list(job.logstream);
                res.json(logs)
            } else {
                res.json({
                    logs: []
                })
            }
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
