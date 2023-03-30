// @ts-ignore
import cf from '@openaddresses/cloudfriend';
import AWSBatch from '@aws-sdk/client-batch';
import Config from '../config.js';
import jwt from 'jsonwebtoken';
import Err from '@openaddresses/batch-error';

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
    static async submit(config: Config, data: any, asset: string, task: object): Promise<any> {
        const batch = new AWSBatch.BatchClient({ region: process.env.AWS_DEFAULT_REGION });

        const batchres = await batch.send(new AWSBatch.SubmitJobCommand({
            jobName: `data-${data.id}-${asset.replace('.', '_')}`,
            jobQueue: `${config.StackName}-queue`,
            jobDefinition: `${config.StackName}-data-job`,
            containerOverrides: {
                environment: [
                    { name: 'ETL_API',   value:  config.API_URL },
                    { name: 'ETL_TOKEN', value: jwt.sign({ access: 'data', data: data.id }, config.SigningSecret) },
                    { name: 'ETL_DATA',  value: String(data.id) },
                    { name: 'ETL_TASK', value: JSON.stringify({ asset: asset, config: task }) },
                ]
            }
        }));

        return batchres;
    }

    static async job(config: Config, jobid: string): Promise<BatchJob> {
        const batch = new AWSBatch.BatchClient({ region: process.env.AWS_DEFAULT_REGION });

        const jobs = await batch.send(new AWSBatch.DescribeJobsCommand({
            jobs: [jobid]
        }))

        if (!jobs.jobs.length) throw new Err(400, null, 'AWS Does not report this job');

        const job = jobs.jobs[0];

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

    static async list(config: Config, data: any): Promise<BatchJob[]> {
        const batch = new AWSBatch.BatchClient({ region: process.env.AWS_DEFAULT_REGION });

        const jobs = (await batch.send(new AWSBatch.ListJobsCommand({
            jobQueue: `${config.StackName}-queue`,
            filters: [{
                name: 'JOB_NAME',
                values: [`data-${data.id}-*`]
            }]
        }))).jobSummaryList.map((job) => {
            const name = job.jobName.replace(`data-${data.id}-`, '');
            let asset: string[] = [...name];
            asset[name.lastIndexOf('_')] = '.';

            return {
                id: job.jobId,
                asset: asset.join(''),
                status: job.status,
                created: job.createdAt,
                updated: job.stoppedAt,
            };
        });

        return jobs;
    }
};
