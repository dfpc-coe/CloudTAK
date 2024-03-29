import CloudWatchLogs from '@aws-sdk/client-cloudwatch-logs';
import Config from '../config.js';
import process from 'node:process';

/**
 * @class
 */
export default class LogGroup {
    static async delete(config: Config, layer: any): Promise<void> {
        const cwl = new CloudWatchLogs.CloudWatchLogsClient({ region: process.env.AWS_DEFAULT_REGION });

        await cwl.send(new CloudWatchLogs.DeleteLogGroupCommand({
            logGroupName: `/aws/lambda/${config.StackName}-layer-${layer.id}`
        }));
    }

    static async list(config: Config, layer: any): Promise<{
        logs: Array<{
            message: string;
            timestamp: number;
        }>
    }> {
        const cwl = new CloudWatchLogs.CloudWatchLogsClient({ region: process.env.AWS_DEFAULT_REGION });

        const streams = await cwl.send(new CloudWatchLogs.DescribeLogStreamsCommand({
            limit: 1,
            descending: true,
            logGroupName: `/aws/lambda/${config.StackName}-layer-${layer.id}`,
            orderBy: 'LastEventTime'
        }));

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
};
