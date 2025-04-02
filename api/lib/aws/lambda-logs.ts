import { Static } from '@sinclair/typebox';
import CloudWatchLogs from '@aws-sdk/client-cloudwatch-logs';
import type { AugmentedLayer } from '../models/Layer.js';
import Err from '@openaddresses/batch-error';
import Config from '../config.js';
import process from 'node:process';

/**
 * @class
 */
export default class LogGroup {
    static async delete(config: Config, layer: Static<typeof AugmentedLayer>): Promise<void> {
        const cwl = new CloudWatchLogs.CloudWatchLogsClient({ region: process.env.AWS_REGION });

        await cwl.send(new CloudWatchLogs.DeleteLogGroupCommand({
            logGroupName: `/aws/lambda/${config.StackName}-layer-${layer.id}`
        }));
    }

    static async list(config: Config, layer: Static<typeof AugmentedLayer>): Promise<{
        logs: Array<{
            message: string;
            timestamp: number;
        }>
    }> {
        const cwl = new CloudWatchLogs.CloudWatchLogsClient({ region: process.env.AWS_REGION });

        let streams;
        try {
            streams = await cwl.send(new CloudWatchLogs.DescribeLogStreamsCommand({
                limit: 1,
                descending: true,
                logGroupName: `/aws/lambda/${config.StackName}-layer-${layer.id}`,
                orderBy: 'LastEventTime'
            }));
        } catch (err) {
            if (String(err).includes('ResourceNotFoundException')) {
                return { logs: [] }
            } else {
                throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to list lambda logs');
            }
        }

        if (!streams.logStreams || !streams.logStreams.length) {
            return { logs: [] }
        }

        return {
            logs: ((await cwl.send(new CloudWatchLogs.GetLogEventsCommand({
                logStreamName: streams.logStreams[0].logStreamName,
                logGroupName: `/aws/lambda/${config.StackName}-layer-${layer.id}`,
                startFromHead: true,
            }))).events || []).map((log) => {
                return {
                    message: String(log.message),
                    timestamp: log.timestamp || 0
                }
            })
        }
    }
}
