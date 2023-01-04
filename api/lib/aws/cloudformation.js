import cf from '@mapbox/cloudfriend';
import AWS from 'aws-sdk';

/**
 * @class
 */
export default class CloudFormation {
    static async create(config, layer, stack) {
        const CF = AWS.CloudFormation({ region: process.env.AWS_DEFAULT_REGION });

        await CF.createStack({
            StackName: `${config.StackName}-layer-${layer.id}`,
            Description: `${layer.task} @ ${layer.cron}`,
            TemplateBody: JSON.stringify(stack)
        }).promise();
    }

    static async status(config, task) {
        const CF = AWS.CloudFormation({ region: process.env.AWS_DEFAULT_REGION });

    }

    static async  delete(config, task) {
        const CF = AWS.CloudFormation({ region: process.env.AWS_DEFAULT_REGION });

        CF.deleteStack({
            StackName: config.StackName + '-' + data.task
        }).promise();
    }
};
