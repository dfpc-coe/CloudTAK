import AWSECS, {
    Task,
    ListTaskDefinitionsCommandInput,
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
            const taskDefinitionArns: string[] = [];

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
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to list Media Server Task Definitions');
        }
    }

    /**
     * Return a single Media Server Task
     */
    async task(task: string): Promise<Task> {
        try {
            const ecs = new AWSECS.ECSClient({ region: process.env.AWS_DEFAULT_REGION });

            const descs = await ecs.send(new AWSECS.DescribeTasksCommand({
                cluster: `coe-ecs-${this.config.StackName.replace(/^coe-etl-/, '')}`,
                tasks: [task]
            }));

            if (!descs.tasks.length) throw new Err(404, null, 'Could not find task with that ID');
            if (!descs.tasks[0].taskDefinitionArn.includes(`:task-definition/coe-media-${this.config.StackName.replace(/^coe-etl-/, '')}`)) throw new Err(404, null, 'Could not find task with that ID');

            return descs.tasks[0];
        } catch (err) {
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to Get Media Server');
        }
    }

    async delete(task: string): Promise<void> {
        // Ensure it exists and we have permissions to delete it
        await this.task(task)

        try {
            const ecs = new AWSECS.ECSClient({ region: process.env.AWS_DEFAULT_REGION });

            await ecs.send(new AWSECS.StopTaskCommand({
                cluster: `coe-ecs-${this.config.StackName.replace(/^coe-etl-/, '')}`,
                task: task,
                reason: 'User Requested Termination from CloudTAK'
            }));
        } catch (err) {
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to Delete Media Server');
        }
    }

    /**
     * Return a list of Media Server Tasks
     */
    async tasks(): Promise<Array<Task>> {
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

            const descs = await ecs.send(new AWSECS.DescribeTasksCommand({
                cluster: `coe-ecs-${this.config.StackName.replace(/^coe-etl-/, '')}`,
                tasks: taskArns
            }));

            return descs.tasks;
        } catch (err) {
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to list Media Servers');
        }
    }
}
