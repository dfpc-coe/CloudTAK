import cf from '@mapbox/cloudfriend';
import AWS from 'aws-sdk';

/**
 * @class
 */
export default class CloudFormation {
    static name(config, layer) {
        return `${config.StackName}-layer-${layer.id}`;
    }

    static async create(config, layer, stack) {
        const CF = new AWS.CloudFormation({ region: process.env.AWS_DEFAULT_REGION });

        await CF.createStack({
            StackName: this.name(config, layer),
            TemplateBody: JSON.stringify(stack)
        }).promise();
    }

    static async status(config, layer) {
        const CF = new AWS.CloudFormation({ region: process.env.AWS_DEFAULT_REGION });

        try {
            const res = await CF.describeStacks({
                StackName: this.name(config, layer)
            }).promise()

            return {
                status: res.Stacks[0].StackStatus
            };
        } catch (err) {
            if (err.message.match(/Stack with id .* does not exist/)) {
                return { status: 'destroyed' };
            } else {
                throw err;
            }
        }
    }

    static async delete(config, layer) {
        const CF = new AWS.CloudFormation({ region: process.env.AWS_DEFAULT_REGION });

        await CF.deleteStack({
            StackName: this.name(config, layer)
        }).promise();
    }
};
