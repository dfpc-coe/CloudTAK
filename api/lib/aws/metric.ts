import Err from '@openaddresses/batch-error';
import CloudWatch from '@aws-sdk/client-cloudwatch';

/**
 * @class
 */
export default class Metric {
    stack: string;

    constructor(stack: string) {
        this.stack = stack;
    }

    async post(connid: number) {
        const cw = new CloudWatch.CloudWatchClient({ region: process.env.AWS_DEFAULT_REGION });

        try {
            await cw.send(new CloudWatch.PutMetricDataCommand({
                Namespace: 'TAKETL',
                MetricData: [{
                    MetricName: `ConnectionHealth`,
                    Unit: 'Count',
                    Value: 1,
                    Timestamp: new Date(),
                    Dimensions: [{
                        Name: 'ConnectionId',
                        Value: String(connid)
                    },{
                        Name: 'StackName',
                        Value: this.stack
                    }]
                }]
            }));
        } catch (err) {
            throw new Err(500, new Error(err), 'Failed to push metric data');
        }
    }
}
