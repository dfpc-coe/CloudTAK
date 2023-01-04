import AWS from 'aws-sdk';
import Err from '@openaddresses/batch-error';

/**
 * @class
 */
export default class ECR {
    static async list() {
        const ecr = new AWS.ECR({ region: process.env.AWS_DEFAULT_REGION });

        try {
            const res = await ecr.listImages({
                repositoryName: 'coe-ecr-etl-tasks'
            }).promise();

            return res;
        } catch (err) {
            throw new Err(500, new Error(err), 'Failed to list ECR Tasks');
        }
    }
}
