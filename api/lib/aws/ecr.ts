import AWSECR, { ImageIdentifier, ListImagesCommandInput } from '@aws-sdk/client-ecr';
import Err from '@openaddresses/batch-error';
import process from 'node:process';

function repositoryName(): string {
    return String(process.env.ECR_TASKS_REPOSITORY_NAME);
}

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
                const req: ListImagesCommandInput = { repositoryName: repositoryName() };
                if (res && res.nextToken) req.nextToken = res.nextToken;
                res = await ecr.send(new AWSECR.ListImagesCommand(req));
                imageIds.push(...(res.imageIds || []));
            } while (res.nextToken)

            return imageIds;
        } catch (err) {
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to list ECR Tasks');
        }
    }

    static async exists(imageTag: string): Promise<boolean> {
        const ecr = new AWSECR.ECRClient({ region: process.env.AWS_REGION });

        try {
            const res = await ecr.send(new AWSECR.BatchGetImageCommand({
                repositoryName: repositoryName(),
                imageIds: [{ imageTag }]
            }));

            if (!res || !res.images) return false;
            return res.images.length > 0;
        } catch (err) {
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to Get ECR Task');
        }
    }

    static async existsDigest(imageDigest: string): Promise<boolean> {
        const ecr = new AWSECR.ECRClient({ region: process.env.AWS_REGION });

        try {
            const res = await ecr.send(new AWSECR.BatchGetImageCommand({
                repositoryName: repositoryName(),
                imageIds: [{ imageDigest }]
            }));

            if (!res || !res.images) return false;
            return res.images.length > 0;
        } catch (err) {
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to Get ECR Task Digest');
        }
    }

    static async delete(task: string, version: string): Promise<void> {
        const ecr = new AWSECR.ECRClient({ region: process.env.AWS_REGION });

        try {
            await ecr.send(new AWSECR.BatchDeleteImageCommand({
                repositoryName: repositoryName(),
                imageIds: [{ imageTag: `${task}-v${version}` }]
            }));
        } catch (err) {
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to delete ECR Tasks');
        }
    }
}
