import Err from '@openaddresses/batch-error';
import CloudWatch from '@aws-sdk/client-cloudwatch';

/**
 * @class
 */
export default class Alarm {
    stack: string;

    constructor(stack: string) {
        this.stack = stack;
    }

    async list(): Promise<Map<Number, String>> {
        const cw = new CloudWatch.CloudWatchClient({ region: process.env.AWS_DEFAULT_REGION });

        try {
            const map: Map<Number, String> = new Map();
            const res = await cw.send(new CloudWatch.DescribeAlarmsCommand({
                AlarmNamePrefix: `${this.stack}-layer-`
            }));

            for (const alarm of res.MetricAlarms) {
                let value = 'healthy';
                if (alarm.StateValue === 'ALARM') value = 'alarm';
                if (alarm.StateValue === 'INSUFFICIENT_DATA') value = 'unknown';

                const layer = parseInt(alarm.AlarmName.replace(`${this.stack}-layer-`, ''));

                map.set(layer, value);
            }

            return map;
        } catch (err) {
            throw new Err(500, new Error(err), 'Failed to describe alarms');
        }
    }

    async get(layer: number): Promise<String> {
        const cw = new CloudWatch.CloudWatchClient({ region: process.env.AWS_DEFAULT_REGION });

        try {
            const res = await cw.send(new CloudWatch.DescribeAlarmsCommand({
                AlarmNames: [`${this.stack}-layer-${layer}`]
            }));

            if (!res.MetricAlarms.length) return 'unknown';

            let value = 'healthy';
            if (res.MetricAlarms[0].StateValue === 'ALARM') value = 'alarm';
            if (res.MetricAlarms[0].StateValue === 'INSUFFICIENT_DATA') value = 'unknown';
            return value;
        } catch (err) {
            throw new Err(500, new Error(err), 'Failed to describe alarm');
        }
    }
}
