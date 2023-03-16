// @ts-ignore
import cf from '@openaddresses/cloudfriend';
import Config from '../config.js';
import Err from '@openaddresses/batch-error';
import AWSCloudFormation from '@aws-sdk/client-cloudformation';

export interface CloudFormationStatus {
    status: String
}

/**
 * @class
 */
export default class CloudFormation {
    static stdname(config: Config, layerid: number): string {
        return `${config.StackName}-layer-${layerid}`;
    }

    static async create(config: Config, layerid: number, stack: object): Promise<void> {
        const cf = new AWSCloudFormation.CloudFormationClient({ region: process.env.AWS_DEFAULT_REGION });

        try {
            await cf.send(new AWSCloudFormation.CreateStackCommand({
                StackName: this.stdname(config, layerid),
                TemplateBody: JSON.stringify(stack)
            }));
        } catch (err) {
            throw new Err(500, new Error(err), 'Failed Create Stack');
        }
    }

    static async update(config: Config, layerid: number, stack: object): Promise<void> {
        const cf = new AWSCloudFormation.CloudFormationClient({ region: process.env.AWS_DEFAULT_REGION });

        await cf.send(new AWSCloudFormation.UpdateStackCommand({
            StackName: this.stdname(config, layerid),
            TemplateBody: JSON.stringify(stack)
        }));
    }

    static async status(config: Config, layerid: number): Promise<CloudFormationStatus> {
        const cf = new AWSCloudFormation.CloudFormationClient({ region: process.env.AWS_DEFAULT_REGION });

        try {
            const res = await cf.send(new AWSCloudFormation.DescribeStacksCommand({
                StackName: this.stdname(config, layerid)
            }));

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

    static async exists(config: Config, layerid: number): Promise<boolean> {
        const cf = new AWSCloudFormation.CloudFormationClient({ region: process.env.AWS_DEFAULT_REGION });

        try {
            await cf.send(new AWSCloudFormation.DescribeStacksCommand({
                StackName: this.stdname(config, layerid)
            }));

            return true;
        } catch (err) {
            if (err.message.match(/Stack with id .* does not exist/)) {
                return false;
            } else {
                throw err;
            }
        }
    }

    static async delete(config: Config, layerid: number): Promise<void> {
        const cf = new AWSCloudFormation.CloudFormationClient({ region: process.env.AWS_DEFAULT_REGION });

        await cf.send(new AWSCloudFormation.DeleteStackCommand({
            StackName: this.stdname(config, layerid)
        }));
    }
};
