import cf from '@mapbox/cloudfriend';
import AWS from 'aws-sdk';

/**
 * @class
 */
export default class CloudFormation {
    static async create(config, layer, stack) {
        const CF = new AWS.CloudFormation({ region: process.env.AWS_DEFAULT_REGION });

        await CF.createStack({
            StackName: `${config.StackName}-layer-${layer.id}`,
            TemplateBody: JSON.stringify(stack)
        }).promise();
    }

    static async status(config, layer) {
        const CF = new AWS.CloudFormation({ region: process.env.AWS_DEFAULT_REGION });

        const status = await CF.describeStacks({

        }).promise()

        console.error(status);

        return {

        };
    }

    static async delete(config, layer) {
        const CF = new AWS.CloudFormation({ region: process.env.AWS_DEFAULT_REGION });

        await CF.deleteStack({
            StackName: `${config.StackName}-layer-${layer.id}`,
        }).promise();
    }
};
