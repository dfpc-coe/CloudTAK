// @ts-ignore
import cf from '@openaddresses/cloudfriend';
import AWSBatch from '@aws-sdk/client-batch';
import Config from '../config.js';
import jwt from 'jsonwebtoken';

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
};
