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
};
