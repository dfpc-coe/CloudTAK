import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Batch from '../lib/aws/batch.js';
import Logs from '../lib/aws/batch-logs.js';
import { JobResponse, JobLogResponse } from '../lib/types.js';
import Config from '../lib/config.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/profile/job', {
        name: 'List Jobs',
        group: 'ProfileJobs',
        description: 'List Profile Jobs',
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(JobResponse)
        })
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const list = await Batch.list(config, `profile-${user.email.replace('@', '_at_').replace(/[^a-zA-Z0-9]/g, '_')}`);

            return res.json({
                total: list.length,
                items: list
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/profile/job/:jobid', {
        name: 'List Jobs',
        group: 'ProfileJobs',
        description: 'List Profile Jobs',
        params: Type.Object({
            jobid: Type.String(),
        }),
        res: JobResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const job = await Batch.job(config, req.params.jobid);

            // TODO Ensure jobname contains email address of user requesting it

            return res.json(job)
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/profile/job/:jobid/logs', {
        name: 'List Logs',
        group: 'ProfileJobs',
        description: 'List Profile Job Logs',
        params: Type.Object({
            jobid: Type.String(),
        }),
        res: Type.Object({
            logs: Type.Array(JobLogResponse)
        }) 
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const job = await Batch.job(config, req.params.jobid);

            // TODO Ensure jobname contains email address of user requesting it

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
