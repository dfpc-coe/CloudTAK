import CloudWatchLogs from '@aws-sdk/client-cloudwatch-logs';
import process from 'node:process';

export type LogGroupOutput = {
    logs: Array<{
        message: string;
        timestamp: number;
    }>
}

/**
 * @class
 */
export default class LogGroup {
    static async list(stream: string): Promise<LogGroupOutput> {
        const cwl = new CloudWatchLogs.CloudWatchLogsClient({ region: process.env.AWS_DEFAULT_REGION });

        const logs = await cwl.send(new CloudWatchLogs.GetLogEventsCommand({
            logStreamName: stream,
            logGroupName: `/aws/batch/job`,
            startFromHead: true,
        }))

        try {
            return {
                logs: (logs.events || []).map((log) => {
                    return {
                        message: String(log.message),
                        timestamp: log.timestamp || 0
                    }
                })
            }
        } catch (err) {
            if (String(err).startsWith('ResourceNotFoundException')) {
                return { logs: [] }
            } else {
                throw new Error(err instanceof Error ? err.message : String(err));
            }
        }
    }
}
