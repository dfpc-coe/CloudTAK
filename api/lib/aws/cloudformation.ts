import Config from '../config.js';
import AWSCloudFormation from '@aws-sdk/client-cloudformation';
import AWSCWL from '@aws-sdk/client-cloudwatch-logs';
import process from 'node:process';
import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';

export const StackFrame = Type.Object({
    Description: Type.String(),
    Parameters: Type.Record(Type.String(), Type.Object({
        Default: Type.String(),
        Description: Type.Optional(Type.String()),
        Type: Type.String()
    })),
    Resources: Type.Record(Type.String(), Type.Object({
        Type: Type.String(),
        Properties: Type.Optional(Type.Record(Type.String(), Type.Any()))
    })),
});

/**
 * @class
 */
export default class CloudFormation {
    static stdname(config: Config, layerid: number): string {
        return `${config.StackName}-layer-${layerid}`;
    }

    static async self(config: Config): Promise<AWSCloudFormation.Stack> {
        const cf = new AWSCloudFormation.CloudFormationClient({ region: process.env.AWS_REGION });

        const res = await cf.send(new AWSCloudFormation.DescribeStacksCommand({
            StackName: config.StackName
        }));

        if (!res.Stacks || !res.Stacks.length) throw new Error(`Stack with id ${config.StackName} does not exist`);

        return res.Stacks[0];
    }

    static async create(
        config: Config,
        layerid: number,
        stack: Static<typeof StackFrame>
    ): Promise<void> {
        const cf = new AWSCloudFormation.CloudFormationClient({ region: process.env.AWS_REGION });
        const cwl = new AWSCWL.CloudWatchLogsClient({ region: process.env.AWS_REGION });

        // LogGroups are managed in CloudFormation, if they are present already an error will throw
        try {
            await cwl.send(new AWSCWL.DeleteLogGroupCommand({
                logGroupName: `/aws/lambda/${config.StackName}-layer-${layerid}`
            }));
        } catch (err) {
            console.error(err);
            // Resource not found
        }

        await cf.send(new AWSCloudFormation.CreateStackCommand({
            StackName: this.stdname(config, layerid),
            TemplateBody: JSON.stringify(stack),
            Tags: (await this.self(config)).Tags,
            Parameters: Object.keys(stack.Parameters).map(key => {
                return {
                    ParameterKey: key,
                    ParameterValue: stack.Parameters[key].Default
                };
            })
        }));
    }

    static async update(
        config: Config,
        layerid: number,
        stack: Static<typeof StackFrame>
    ): Promise<void> {
        const cf = new AWSCloudFormation.CloudFormationClient({ region: process.env.AWS_REGION });

        await cf.send(new AWSCloudFormation.UpdateStackCommand({
            StackName: this.stdname(config, layerid),
            TemplateBody: JSON.stringify(stack),
            Tags: (await this.self(config)).Tags,
            Parameters: Object.keys(stack.Parameters).map(key => {
                return {
                    ParameterKey: key,
                    ParameterValue: stack.Parameters[key].Default
                };
            })
        }));
    }

    static async status(config: Config, layerid: number): Promise<{
        status: string;
    }> {
        const cf = new AWSCloudFormation.CloudFormationClient({ region: process.env.AWS_REGION });

        try {
            const res = await cf.send(new AWSCloudFormation.DescribeStacksCommand({
                StackName: this.stdname(config, layerid)
            }));

            if (!res.Stacks || !res.Stacks.length) return { status: 'unknown' }

            return {
                status: String(res.Stacks[0].StackStatus)
            };
        } catch (err) {
            if (err instanceof Error && err.message.match(/Stack with id .* does not exist/)) {
                return { status: 'DOES_NOT_EXIST_COMPLETE' };
            } else {
                throw err;
            }
        }
    }

    static async exists(config: Config, layerid: number): Promise<boolean> {
        const cf = new AWSCloudFormation.CloudFormationClient({ region: process.env.AWS_REGION });

        try {
            await cf.send(new AWSCloudFormation.DescribeStacksCommand({
                StackName: this.stdname(config, layerid)
            }));

            return true;
        } catch (err) {
            if (err instanceof Error && err.message.match(/Stack with id .* does not exist/)) {
                return false;
            } else {
                throw err;
            }
        }
    }

    static async cancel(config: Config, layerid: number): Promise<void> {
        const cf = new AWSCloudFormation.CloudFormationClient({ region: process.env.AWS_REGION });

        await cf.send(new AWSCloudFormation.CancelUpdateStackCommand({
            StackName: this.stdname(config, layerid)
        }));
    }

    static async delete(config: Config, layerid: number): Promise<void> {
        const cf = new AWSCloudFormation.CloudFormationClient({ region: process.env.AWS_REGION });

        await cf.send(new AWSCloudFormation.DeleteStackCommand({
            StackName: this.stdname(config, layerid)
        }));
    }

    static async resources(config: Config, layerid: number): Promise<AWSCloudFormation.StackResource[]> {
        const cf = new AWSCloudFormation.CloudFormationClient({ region: process.env.AWS_REGION });

        const res = await cf.send(new AWSCloudFormation.DescribeStackResourcesCommand({
            StackName: this.stdname(config, layerid)
        }));

        return res.StackResources || [];
    }
}
