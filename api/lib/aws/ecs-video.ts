import AWSECS, {
    ListTaskDefinitionsCommandInput,
    ListTasksResponse,
    ListTasksCommandInput
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
     * Return a list of Media Server Versions
     */
    async definitions(): Promise<Array<number>> {
        try {
            const ecs = new AWSECS.ECSClient({ region: process.env.AWS_DEFAULT_REGION });
            const taskDefinitionArns: String[] = [];

            let res;
            do {
                const req: ListTaskDefinitionsCommandInput = {
                    status: 'ACTIVE',
                    sort: 'DESC',
                    familyPrefix: `coe-media-${this.config.StackName.replace(/^coe-etl-/, '')}`
                };

                if (res && res.nextToken) req.nextToken = res.nextToken;
                res = await ecs.send(new AWSECS.ListTaskDefinitionsCommand(req));
                taskDefinitionArns.push(...res.taskDefinitionArns);
            } while (res.nextToken)

            return taskDefinitionArns.map((def) => {
                return Number(def.replace(/.*\/coe-media-.*:/, ''));
            });
        } catch (err) {
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to list ECR Tasks');
        }
    }

    /**
     * Return a list of Media Server Tasks
     */
    async tasks(): Promise<Array<string>> {
        try {
            const ecs = new AWSECS.ECSClient({ region: process.env.AWS_DEFAULT_REGION });
            const taskArns: string[] = [];

            let res;
            do {
                const req: ListTasksCommandInput = {
                    cluster: `coe-ecs-${this.config.StackName.replace(/^coe-etl-/, '')}`,
                    family: `coe-media-${this.config.StackName.replace(/^coe-etl-/, '')}`
                };

                if (res && res.nextToken) req.nextToken = res.nextToken;
                res = await ecs.send(new AWSECS.ListTasksCommand(req));
                taskArns.push(...res.taskArns);
            } while (res.nextToken)

            return taskArns.map((def) => {
                return def;
            });
        } catch (err) {
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to list ECR Tasks');
        }
    }
}
