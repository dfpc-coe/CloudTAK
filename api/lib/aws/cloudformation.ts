// @ts-ignore
import cf from '@mapbox/cloudfriend';
import Config from '../config.js';
import AWS from 'aws-sdk';

/**
 * @class
 */
export default class CloudFormation {
    static stdname(config: Config, layerid: number): string {
        return `${config.StackName}-layer-${layerid}`;
    }

    static async create(config: Config, layerid: number, stack: object) {
        const CF = new AWS.CloudFormation({ region: process.env.AWS_DEFAULT_REGION });

        await CF.createStack({
            StackName: this.stdname(config, layerid),
            TemplateBody: JSON.stringify(stack)
        }).promise();
    }

    static async update(config: Config, layerid: number, stack: object) {
        const CF = new AWS.CloudFormation({ region: process.env.AWS_DEFAULT_REGION });

        await CF.updateStack({
            StackName: this.stdname(config, layerid),
            TemplateBody: JSON.stringify(stack)
        }).promise();
    }

    static async status(config: Config, layerid: number) {
        const CF = new AWS.CloudFormation({ region: process.env.AWS_DEFAULT_REGION });

        try {
            const res = await CF.describeStacks({
                StackName: this.stdname(config, layerid)
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

    static async exists(config: Config, layerid: number) {
        const CF = new AWS.CloudFormation({ region: process.env.AWS_DEFAULT_REGION });

        try {
            await CF.describeStacks({
                StackName: this.stdname(config, layerid)
            }).promise()

            return true;
        } catch (err) {
            if (err.message.match(/Stack with id .* does not exist/)) {
                return false;
            } else {
                throw err;
            }
        }
    }

    static async delete(config: Config, layerid: number) {
        const CF = new AWS.CloudFormation({ region: process.env.AWS_DEFAULT_REGION });

        await CF.deleteStack({
            StackName: this.stdname(config, layerid)
        }).promise();
    }
};
