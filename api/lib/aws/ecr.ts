import AWSECR from '@aws-sdk/client-ecr';
import Err from '@openaddresses/batch-error';
import process from 'node:process';

/**
 * @class
 */
export default class ECR {
    static async list() {
        const ecr = new AWSECR.ECRClient({ region: process.env.AWS_DEFAULT_REGION });

        try {
            const res = await ecr.send(new AWSECR.ListImagesCommand({
                repositoryName: 'coe-ecr-etl-tasks'
            }));

            return res;
        } catch (err) {
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to list ECR Tasks');
        }
    }
}
