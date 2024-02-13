// @ts-ignore
import cf from '@openaddresses/cloudfriend';
import AWSBatch from '@aws-sdk/client-batch';
import Config from '../config.js';
import jwt from 'jsonwebtoken';
import Err from '@openaddresses/batch-error';
import process from 'node:process';
import { Data } from '../schema.js';
import { type InferSelectModel } from 'drizzle-orm';

export interface BatchJob {
    id: string;
    asset: string;
    status: string;
    created: number;
    updated: number;
    logstream?: string;
}

/**
 * @class
 */
export default class Batch {
    static async submitUser(config: Config, email: string, asset: string, task: object): Promise<AWSBatch.SubmitJobCommandOutput> {
        const batch = new AWSBatch.BatchClient({ region: process.env.AWS_DEFAULT_REGION });

        let jobName = `profile-${email.replace('@', '_at_').replace(/[^a-zA-Z0-9]/g, '_')}-${asset.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 50)}`;

        const batchres = await batch.send(new AWSBatch.SubmitJobCommand({
            jobName,
            jobQueue: `${config.StackName}-queue`,
            jobDefinition: `${config.StackName}-data-job`,
            containerOverrides: {
                environment: [
                    { name: 'ETL_API',      value:  config.API_URL },
                    { name: 'ETL_BUCKET',   value:  config.Bucket },
                    { name: 'ETL_TOKEN',    value: jwt.sign({ access: 'profile', profle: email }, config.SigningSecret) },
                    { name: 'ETL_TYPE',     value: 'profile' },
                    { name: 'ETL_ID',       value: email },
                    { name: 'ETL_TASK',     value: JSON.stringify({ asset: asset, config: task }) },
                ]
            }
        }));

        return batchres;
    }

    static async submitData(config: Config, data: InferSelectModel<typeof Data>, asset: string, task: object): Promise<AWSBatch.SubmitJobCommandOutput> {
        const batch = new AWSBatch.BatchClient({ region: process.env.AWS_DEFAULT_REGION });

        let jobName = `data-${data.id}-${asset.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 50)}`;

        const batchres = await batch.send(new AWSBatch.SubmitJobCommand({
            jobName,
            jobQueue: `${config.StackName}-queue`,
            jobDefinition: `${config.StackName}-data-job`,
            containerOverrides: {
                environment: [
                    { name: 'ETL_API',      value:  config.API_URL },
                    { name: 'ETL_BUCKET',   value:  config.Bucket },
                    { name: 'ETL_TOKEN',    value: `etl.${jwt.sign({ access: 'data', id: data.id, internal: true }, config.SigningSecret)}` },
                    { name: 'ETL_TYPE',     value: 'data' },
                    { name: 'ETL_ID',       value: String(data.id) },
                    { name: 'ETL_TASK',     value: JSON.stringify({ asset: asset, config: task }) },
                ]
            }
        }));

        return batchres;
    }

    static async job(config: Config, jobid: string): Promise<BatchJob> {
        const batch = new AWSBatch.BatchClient({ region: process.env.AWS_DEFAULT_REGION });

        const res = await batch.send(new AWSBatch.DescribeJobsCommand({
            jobs: [jobid]
        }))

        if (!res.jobs || !res.jobs.length) throw new Err(400, null, 'AWS Does not report this job');

        const job = res.jobs[0];

        if (!job.jobName) throw new Err(400, null, 'AWS Does not report a jobName')
        if (!job.jobId) throw new Err(400, null, 'AWS Does not report a jobId')
        if (!job.status) throw new Err(400, null, 'AWS Does not report a Status')

        const name = job.jobName.replace(/data-[0-9]+-/, '');
        let asset: string[] = [...name];
        asset[name.lastIndexOf('_')] = '.';

        return {
            id: job.jobId,
            asset: asset.join(''),
            status: job.status,
            created: job.createdAt,
            updated: job.stoppedAt,
            logstream: job.container.logStreamName
        }
    }

    static async list(config: Config, prefix: string): Promise<BatchJob[]> {
        const batch = new AWSBatch.BatchClient({ region: process.env.AWS_DEFAULT_REGION });

        const res = (await batch.send(new AWSBatch.ListJobsCommand({
            jobQueue: `${config.StackName}-queue`,
            filters: [{
                name: 'JOB_NAME',
                values: [`${prefix}-*`]
            }]
        }))).jobSummaryList.map((job) => {
            const name = job.jobName.replace(`${prefix}-`, '');
            let asset: string[] = [...name];
            asset[name.lastIndexOf('_')] = '.';

            return {
                id: job.jobId,
                asset: asset.join(''),
                status: job.status,
                created: job.createdAt,
                updated: job.stoppedAt,
            };
        }).sort((a, b) => {
            return b.created - a.created;
        });

        return res;
    }
};
