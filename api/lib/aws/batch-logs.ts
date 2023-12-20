import CloudWatchLogs from '@aws-sdk/client-cloudwatch-logs';
import process from 'node:process';

/**
 * @class
 */
export default class LogGroup {
    static async list(stream: string) {
        const cwl = new CloudWatchLogs.CloudWatchLogsClient({ region: process.env.AWS_DEFAULT_REGION });

        return {
            logs: (await cwl.send(new CloudWatchLogs.GetLogEventsCommand({
                logStreamName: stream,
                logGroupName: `/aws/batch/job`,
                startFromHead: true,
            }))).events.map((log) => {
                return {
                    message: log.message,
                    timestamp: log.timestamp
                }
            })
        }
    }
};
