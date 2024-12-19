import Err from '@openaddresses/batch-error';
import CloudWatch from '@aws-sdk/client-cloudwatch';
import process from 'node:process';

/**
 * @class
 */
export default class Alarm {
    stack: string;

    constructor(stack: string) {
        this.stack = stack;
    }

    async list(): Promise<Map<number, string>> {
        const cw = new CloudWatch.CloudWatchClient({ region: process.env.AWS_REGION });

        try {
            const map: Map<number, string>  = new Map();

            const MetricAlarms = [];

            let res;
            do {
                const req: CloudWatch.DescribeAlarmsCommandInput = {
                    AlarmNamePrefix: `${this.stack}-layer-`
                };

                if (res && res.NextToken) req.NextToken = res.NextToken;
                res = await cw.send(new CloudWatch.DescribeAlarmsCommand(req))

                MetricAlarms.push(...(res.MetricAlarms || []));
            } while (res.NextToken)

            for (const alarm of (MetricAlarms || [])) {
                let value = 'healthy';
                if (alarm.StateValue === 'ALARM') value = 'alarm';
                if (alarm.StateValue === 'INSUFFICIENT_DATA') value = 'unknown';

                const layer = parseInt(String(alarm.AlarmName).replace(`${this.stack}-layer-`, ''));

                if (!map.has(layer) || map.get(layer) === 'health' && value === 'alarm') {
                    map.set(layer, value);
                }
            }

            return map;
        } catch (err) {
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to describe alarms');
        }
    }

    async get(layer: number): Promise<string> {
        const cw = new CloudWatch.CloudWatchClient({ region: process.env.AWS_REGION });

        try {
            const MetricAlarms = [];

            let res;
            do {
                const req: CloudWatch.DescribeAlarmsCommandInput = {
                    AlarmNames: [`${this.stack}-layer-${layer}`]
                };

                if (res && res.NextToken) req.NextToken = res.NextToken;
                res = await cw.send(new CloudWatch.DescribeAlarmsCommand(req))

                MetricAlarms.push(...(res.MetricAlarms || []));
            } while (res.NextToken)

            if (!res.MetricAlarms.length) return 'unknown';

            let final;
            for (const alarm of (MetricAlarms || [])) {
                let value = 'healthy';
                if (alarm.StateValue === 'ALARM') value = 'alarm';
                if (alarm.StateValue === 'INSUFFICIENT_DATA') value = 'unknown';

                const layer = parseInt(String(alarm.AlarmName).replace(`${this.stack}-layer-`, ''));

                if (!final || final === 'health' && value === 'alarm') {
                    final = value
                }
            }

            return final;
        } catch (err) {
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to describe alarm');
        }
    }
}
