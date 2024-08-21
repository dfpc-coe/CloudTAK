import AWSECS, {
    DescribeServicesCommandInput
} from '@aws-sdk/client-ecs';
import Config from '../config.js';
import Err from '@openaddresses/batch-error';
import process from 'node:process';

/**
 * @class
 */
export default class ECSVideo {
    config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    /**
     * Return config document for ECS Media Service
     */
    async configuration(): Promise<any> {
        try {
            const ecs = new AWSECS.ECSClient({ region: process.env.AWS_DEFAULT_REGION });

            const res = await ecs.send(new AWSECS.DescribeServicesCommand({
                cluster: `coe-ecs-${this.config.StackName.replace(/^coe-etl-/, '')}`,
                services: [
                    `coe-media-${this.config.StackName.replace(/^coe-etl-/, '')}-Service`
                ]
            }));

            console.error(JSON.stringify(res));

        } catch (err) {
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to describe ECS Service');
        }
    }
}
