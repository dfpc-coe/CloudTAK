import CloudWatchLogs from '@aws-sdk/client-cloudwatch-logs';
import Err from '@openaddresses/batch-error';
import Config from '../config.js';

export interface LogGroup {
    message: string,
    timestamp: string
}

/**
 * @class
 */
export default class LogGroup {
    static async delete(config: Config, layer: any): Promise<void> {
        const cwl = new CloudWatchLogs.CloudWatchLogsClient({ region: process.env.AWS_DEFAULT_REGION });

        try {
            await cwl.send(new CloudWatchLogs.DeleteLogGroupCommand({
                logGroupName: `/aws/lambda/${config.StackName}-layer-${layer.id}`
            }));
        } catch (err) {
            throw new Err(500, null, 'Failed to delete CloudWatch Logs');
        }
    }

    static async list(config: Config, layer: any): Promise<LogGroup[]> {
        const cwl = new CloudWatchLogs.CloudWatchLogsClient({ region: process.env.AWS_DEFAULT_REGION });

        try {
            const streams = await cwl.send(new CloudWatchLogs.DescribeLogStreamsCommand({
                limit: 1,
                descending: true,
                logGroupName: `/aws/lambda/${config.StackName}-layer-${layer.id}`,
                orderBy: 'LastEventTime'
            }));

            if (!streams.logStreams.length) {
                return {
                    logs: []
                }
            }

            return {
                logs: (await cwl.send(new CloudWatchLogs.GetLogEventsCommand({
                    logStreamName: streams.logStreams[0].logStreamName,
                    logGroupName: `/aws/lambda/${config.StackName}-layer-${layer.id}`,
                    startFromHead: true,
                }))).events.map((log) => {
                    return {
                        message: log.message,
                        timestamp: log.timestamp
                    }
                })
            }
        } catch (err) {
            throw new Err(500, null, 'Failed to list CloudWatch Logs');
        }
    }
};
