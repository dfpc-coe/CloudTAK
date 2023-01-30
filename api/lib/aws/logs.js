import AWS from 'aws-sdk';

/**
 * @class
 */
export default class LogGroup {
    static async delete(config, layer) {
        const CWL = new AWS.CloudWatchLogs({ region: process.env.AWS_DEFAULT_REGION });

        await CWL.deleteLogGroup({
            logGroupName: `/aws/lambda/${config.StackName}-layer-${layer.id}`
        }).promise();
    }

    static async list(config, layer) {
        const CWL = new AWS.CloudWatchLogs({ region: process.env.AWS_DEFAULT_REGION });

        const streams = await CWL.describeLogStreams({
            limit: 1,
            descending: true,
            logGroupName: `/aws/lambda/${config.StackName}-layer-${layer.id}`,
            orderBy: 'LastEventTime'
        }).promise();

        if (!streams.logStreams.length) {
            return {
                logs: []
            }
        }

        return {
            logs: (await CWL.getLogEvents({
                logStreamName: streams.logStreams[0].logStreamName,
                logGroupName: `/aws/lambda/${config.StackName}-layer-${layer.id}`,
                startFromHead: true,
            }).promise()).events.map((log) => {
                return {
                    message: log.message,
                    timestamp: log.timestamp
                }
            })
        }
    }
};
