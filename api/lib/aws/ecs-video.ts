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
            const ecs = new AWSECS.ECSClient({ region: process.env.AWS_REGION });
            const taskDefinitionArns: string[] = [];

            let res;
            do {
                const req: ListTaskDefinitionsCommandInput = {
                    status: 'ACTIVE',
                    sort: 'DESC',
                    familyPrefix: `coe-media-${this.config.StackName.replace(/^tak-cloudtak-/, '')}-task`
                };

                if (res && res.nextToken) req.nextToken = res.nextToken;
                res = await ecs.send(new AWSECS.ListTaskDefinitionsCommand(req));
                taskDefinitionArns.push(...(res.taskDefinitionArns || []));
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
            const ecs = new AWSECS.ECSClient({ region: process.env.AWS_REGION });

            const descs = await ecs.send(new AWSECS.DescribeTasksCommand({
                cluster: `coe-ecs-${this.config.StackName.replace(/^tak-cloudtak-/, '')}`,
                tasks: [task]
            }));

            if (!descs.tasks || !descs.tasks.length) throw new Err(404, null, 'Could not find task with that ID');
            if (!descs.tasks[0].taskDefinitionArn || !descs.tasks[0].taskDefinitionArn.includes(`:task-definition/coe-media-${this.config.StackName.replace(/^tak-cloudtak-/, '')}`)) throw new Err(404, null, 'Could not find task with that ID');

            return descs.tasks[0];
        } catch (err) {
            if (err instanceof Error && err.message.includes('taskId length should be one of')) throw new Err(400, null, 'Invalid Media Server ID');
            if (err instanceof Error && err.message.includes('Could not find task')) throw new Err(404, null, 'Could not find Media Server with that ID');
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to Get Media Server');
        }
    }

    async delete(task: string): Promise<void> {
        // Ensure it exists and we have permissions to delete it
        const t = await this.task(task)

        if (t.lastStatus !== 'RUNNING' && t.desiredStatus !== 'RUNNING') {
            throw new Err(400, null, 'Only a Running Media Server can be deleted');
        }

        try {
            const ecs = new AWSECS.ECSClient({ region: process.env.AWS_REGION });

            await ecs.send(new AWSECS.StopTaskCommand({
                cluster: `coe-ecs-${this.config.StackName.replace(/^tak-cloudtak-/, '')}`,
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
            const ecs = new AWSECS.ECSClient({ region: process.env.AWS_REGION });
            const taskArns: string[] = [];

            let res;
            do {
                const req: ListTasksCommandInput = {
                    cluster: `coe-ecs-${this.config.StackName.replace(/^tak-cloudtak-/, '')}`,
                    family: `coe-media-${this.config.StackName.replace(/^tak-cloudtak-/, '')}-task`
                };

                if (res && res.nextToken) req.nextToken = res.nextToken;
                res = await ecs.send(new AWSECS.ListTasksCommand(req));
                taskArns.push(...(res.taskArns || []));
            } while (res.nextToken)

            if (!taskArns.length) return [];

            const descs = await ecs.send(new AWSECS.DescribeTasksCommand({
                cluster: `coe-ecs-${this.config.StackName.replace(/^tak-cloudtak-/, '')}`,
                tasks: taskArns
            }));

            return descs.tasks || [];
        } catch (err) {
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to list Media Servers');
        }
    }

    /**
     * Create a new Media Server
     */
    async run(): Promise<Task> {
        try {
            const ecs = new AWSECS.ECSClient({ region: process.env.AWS_REGION });

            const defs = await this.definitions();

            if (!defs.length) throw new Err(400, null, 'Media Server Creation has not been configured for this account');
            if (!this.config.SubnetPublicA) throw new Err(400, null, 'VPC PublicSubnetA is not configured - Contact your administrator');
            if (!this.config.SubnetPublicB) throw new Err(400, null, 'VPC PublicSubnetB is not configured - Contact your administrator');
            if (!this.config.MediaSecurityGroup) throw new Err(400, null, 'Media Security Group is not configured - Contact your administrator');

            const res = await ecs.send(new AWSECS.RunTaskCommand({
                cluster: `coe-ecs-${this.config.StackName.replace(/^tak-cloudtak-/, '')}`,
                count: 1,
                enableECSManagedTags: true,
                launchType: 'FARGATE',
                networkConfiguration: {
                    awsvpcConfiguration: {
                        subnets: [this.config.SubnetPublicA, this.config.SubnetPublicB],
                        securityGroups: [ this.config.MediaSecurityGroup ],
                        assignPublicIp: 'ENABLED'
                    },
                },
                propagateTags: 'TASK_DEFINITION',
                taskDefinition: `coe-media-${this.config.StackName.replace(/^tak-cloudtak-/, '')}-task`,
            }));

            if (!res.tasks || !res.tasks.length) throw new Error('No Task reported');

            return res.tasks[0];
        } catch (err) {
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to Create Media Server');
        }
    }
}
