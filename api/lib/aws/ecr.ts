import AWSECR, { ImageIdentifier, ListImagesCommandInput } from '@aws-sdk/client-ecr';
import Err from '@openaddresses/batch-error';
import process from 'node:process';

/**
 * @class
 */
export default class ECR {
    static async list(): Promise<Array<ImageIdentifier>> {
        const ecr = new AWSECR.ECRClient({ region: process.env.AWS_REGION });

        try {
            const imageIds: ImageIdentifier[] = [];

            let res;
            do {
                const req: ListImagesCommandInput = { repositoryName: 'coe-ecr-etl-tasks' };
                if (res && res.nextToken) req.nextToken = res.nextToken;
                res = await ecr.send(new AWSECR.ListImagesCommand(req));
                imageIds.push(...(res.imageIds || []));
            } while (res.nextToken)

            return imageIds;
        } catch (err) {
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to list ECR Tasks');
        }
    }

    static async delete(task: string, version: string): Promise<void> {
        const ecr = new AWSECR.ECRClient({ region: process.env.AWS_REGION });

        try {
            await ecr.send(new AWSECR.BatchDeleteImageCommand({
                repositoryName: 'coe-ecr-etl-tasks',
                imageIds: [{ imageTag: `${task}-v${version}` }]
            }));
        } catch (err) {
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to delete ECR Tasks');
        }
    }
}
