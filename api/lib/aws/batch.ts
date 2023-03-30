// @ts-ignore
import cf from '@openaddresses/cloudfriend';
import AWSBatch from '@aws-sdk/client-batch';
import Config from '../config.js';
import jwt from 'jsonwebtoken';

export interface BatchJob {
    asset: string;
    status: string;
    created: number;
    updated: number;
}

/**
 * @class
 */
export default class Batch {
    static async submit(config: Config, data: any, asset: string): Promise<any> {
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
                ]
            }
        }));

        return batchres;
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
                asset: asset.join(''),
                status: job.status,
                created: job.createdAt,
                updated: job.stoppedAt,
            };
        });

        return jobs;
    }
};
