import AWSECS, { ListTaskDefinitionsInput } from '@aws-sdk/client-ecs';
import Config from '../config.js';
import Err from '@openaddresses/batch-error';
import process from 'node:process';

/**
 * @class
 */
export default class ECSVideo {
    config: Config;

    constructor(config: Config) {
        this.config = Config;
    }

    async definitions(): Promise<void> {
        try {
            const ecs = new AWSECS.ECSClient({ region: process.env.AWS_DEFAULT_REGION });
            const taskDefinitionArns: String[] = [];

            let res;
            do {
                const req: ListImagesCommandInput = {
                    status: 'ACTIVE',
                    sort: 'DESC',
                    familyPrefix: `coe-media-${this.config.StackName.replace(/^coe-etl-/, '')}`
                };

                if (res && res.nextToken) req.nextToken = res.nextToken;
                res = await ecr.send(new AWSECS.ListTaskDefinitionsCommand(req));
                taskDefinitionArns.push(...res.taskDefinitionArns);
            } while (res.nextToken)
        } catch (err) {
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to list ECR Tasks');
        }
    }
}
