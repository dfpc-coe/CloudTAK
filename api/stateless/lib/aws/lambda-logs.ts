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

    static DEFAULT_LINE_LIMIT = 150;

    static async list(config: Config, layer: Static<typeof AugmentedLayer>, opts: {
        limit?: number;
    } = {}): Promise<{
        logs: Array<{
            message: string;
            timestamp: number;
        }>;
    }> {
        const limit = opts.limit ?? LogGroup.DEFAULT_LINE_LIMIT;

        const logs: Array<{ message: string; timestamp: number }> = [];

        if (limit <= 0) return { logs };

        const cwl = new CloudWatchLogs.CloudWatchLogsClient({ region: process.env.AWS_REGION });
        const logGroupName = `/aws/lambda/${config.StackName}-layer-${layer.id}`;

        try {
            const streams = await cwl.send(new CloudWatchLogs.DescribeLogStreamsCommand({
                logGroupName,
                descending: true,
                orderBy: 'LastEventTime',
                limit: 20,
            }));

            for (const stream of streams.logStreams || []) {
                if (logs.length >= limit) break;
                if (!stream.logStreamName) continue;

                const page = await cwl.send(new CloudWatchLogs.GetLogEventsCommand({
                    logGroupName,
                    logStreamName: stream.logStreamName,
                    startFromHead: false,
                    limit: limit - logs.length,
                }));

                for (const event of page.events || []) {
                    logs.push({
                        message: String(event.message),
                        timestamp: event.timestamp || 0,
                    });
                }
            }
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
