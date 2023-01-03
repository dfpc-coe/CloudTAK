import AWS from 'aws-sdk';
import Err from '@openaddresses/batch-error';

/**
 * @class
 */
export default class EventRule {
    constructor(stack, sqs) {
        this.stack = stack;
        this.sqs = sqs;
    }

    async create(schedule) {
        const eb = new AWS.EventBridge({ region: process.env.AWS_DEFAULT_REGION });

        try {
            await eb.putRule({
                Name: `${this.stack}-schedule-${schedule.id}`,
                Description: `${this.stack} Schedule: ${schedule.id}`,
                ScheduleExpression: `cron(${schedule.cron})`,
                State: schedule.paused ? 'DISABLED' : 'ENABLED'
            }).promise();

        } catch (err) {
            throw new Err(500, new Error(err), 'Failed to create rule');
        }

        try {
            await eb.putTargets({
                Rule: `${this.stack}-schedule-${schedule.id}`,
                Targets: [{
                    Id: 'default',
                    Arn: this.sqs['obtain-queue'].arn
                }]
            }).promise();
        } catch (err) {
            throw new Err(500, new Error(err), 'Failed to add targets to rule');
        }
    }

    async describe(schedule) {
        const eb = new AWS.EventBridge({ region: process.env.AWS_DEFAULT_REGION });

        try {
            const res = await eb.describeRule({
                Name: `${this.stack}-schedule-${schedule.id}`,
            }).promise();

            return res;
        } catch (err) {
            throw new Err(500, new Error(err), 'Failed to describe rule');
        }
    }

    async update(schedule) {
        try {
            const eb = new AWS.EventBridge({ region: process.env.AWS_DEFAULT_REGION });

            await eb.putRule({
                Name: `${this.stack}-schedule-${schedule.id}`,
                Description: `${this.stack} Schedule: ${schedule.id}`,
                ScheduleExpression: `cron(${schedule.cron})`,
                State: 'ENABLED'
            }).promise();
        } catch (err) {
            throw new Err(500, new Error(err), 'Failed to update rule');
        }
    }

    async delete(schedule) {
        const eb = new AWS.EventBridge({ region: process.env.AWS_DEFAULT_REGION });

        try {
            await eb.removeTargets({
                Rule: `${this.stack}-schedule-${schedule.id}`,
                Ids: ['default']
            }).promise();
        } catch (err) {
            if (!err.message.match(/does not exist/)) {
                throw new Err(500, new Error(err), 'Failed to remove targets from rule');
            }
        }

        try {
            await eb.deleteRule({
                Name: `${this.stack}-schedule-${schedule.id}`,
            }).promise();
        } catch (err) {
            throw new Err(500, new Error(err), 'Failed to delete rule');
        }
    }

    async disable(schedule) {
        try {
            const eb = new AWS.EventBridge({ region: process.env.AWS_DEFAULT_REGION });

            await eb.disableRule({
                Name: `${this.stack}-schedule-${schedule.id}`,
            }).promise();
        } catch (err) {
            throw new Err(500, new Error(err), 'Failed to disable rule');
        }
    }

    async enable(schedule) {
        try {
            const eb = new AWS.EventBridge({ region: process.env.AWS_DEFAULT_REGION });

            await eb.enableRule({
                Name: `${this.stack}-schedule-${schedule.id}`,
            }).promise();
        } catch (err) {
            throw new Err(500, new Error(err), 'Failed to enable rule');
        }
    }
}
