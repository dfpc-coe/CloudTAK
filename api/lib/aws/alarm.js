import AWS from 'aws-sdk';
import Err from '@openaddresses/batch-error';

/**
 * @class
 */
export default class Alarm {
    constructor(stack) {
        this.stack = stack;
    }

    async list() {
        const cw = new AWS.CloudWatch({ region: process.env.AWS_DEFAULT_REGION });

        try {
            const res = await cw.describeAlarms({
                AlarmNamePrefix: `${this.stack}-layer-`
            }).promise();

            return res;
        } catch (err) {
            throw new Err(500, new Error(err), 'Failed to describe alarms');
        }
    }
}
