import { Static } from '@sinclair/typebox';
import CloudWatchLogs from '@aws-sdk/client-cloudwatch-logs';
import type { AugmentedLayer } from '../../../common/models/Layer.js';
import Err from '@openaddresses/batch-error';
import Config from '../../../common/config.js';
import process from 'node:process';

/**
 * @class
 */
export default class LogGroup {
    static async delete(config: Config, layer: Static<typeof AugmentedLayer>): Promise<void> {
        const cwl = new CloudWatchLogs.CloudWatchLogsClient({ region: process.env.AWS_REGION });

        await cwl.send(new CloudWatchLogs.DeleteLogGroupCommand({
            logGroupName: `/aws/lambda/${config.StackName}-layer-${layer.id}`,
        }));
    }

    static async list(config: Config, layer: Static<typeof AugmentedLayer>): Promise<{
        logs: Array<{
            message: string;
            timestamp: number;
        }>;
    }> {
        const cwl = new CloudWatchLogs.CloudWatchLogsClient({ region: process.env.AWS_REGION });
        const logGroupName = `/aws/lambda/${config.StackName}-layer-${layer.id}`;

        const logs: Array<{ message: string; timestamp: number }> = [];

        try {
            let nextToken: string | undefined;

            // Log group retention is only 7 days (see ETLFunctionLogs in lambda.ts),
            // so this loop is naturally bounded without needing a startTime.
            do {
                const page = await cwl.send(new CloudWatchLogs.FilterLogEventsCommand({
                    logGroupName,
                    nextToken,
                    interleaved: true,
                }));

                for (const event of page.events || []) {
                    logs.push({
                        message: String(event.message),
                        timestamp: event.timestamp || 0,
                    });
                }

                nextToken = page.nextToken;
            } while (nextToken);
        } catch (err) {
            if (String(err).includes('ResourceNotFoundException')) {
                return { logs: [] };
            } else {
                throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to list lambda logs');
            }
        }

        logs.sort((a, b) => a.timestamp - b.timestamp);

        return { logs };
    }
}
