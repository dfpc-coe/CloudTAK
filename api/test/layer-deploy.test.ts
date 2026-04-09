import test from 'node:test';
import assert from 'node:assert';
import Sinon from 'sinon';
import {
    CloudFormationClient,
    CreateStackCommand,
    DeleteStackCommand,
    DescribeStacksCommand,
    UpdateStackCommand
} from '@aws-sdk/client-cloudformation';
import {
    ECRClient,
    BatchGetImageCommand,
} from '@aws-sdk/client-ecr';
import {
    CloudWatchLogsClient,
    DeleteLogGroupCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import {
    GetFunctionCommand,
    LambdaClient,
} from '@aws-sdk/client-lambda';
import LayerDeploy from '../lib/aws/layer-deploy.js';

process.env.ECR_TASKS_REPOSITORY_NAME = 'example-ecr';
process.env.AWS_REGION = 'us-gov-east-1';

const config = {
    StackName: 'test',
    SigningSecret: 'test-secret'
} as any;

const stack = {
    Description: 'Test Layer',
    Parameters: {
        Task: {
            Type: 'String',
            Default: 'etl-test-v1.0.1'
        },
        UniqueID: {
            Type: 'String',
            Default: 'layer-uuid'
        }
    },
    Resources: {}
} as const;

test('LayerDeploy.apply updates when current image digest exists', async () => {
    const cfCommands: string[] = [];

    try {
        Sinon.stub(CloudWatchLogsClient.prototype, 'send').callsFake((command) => {
            if (command instanceof DeleteLogGroupCommand) {
                return Promise.resolve({});
            }

            throw new Error('Unexpected CloudWatch Logs command');
        });

        Sinon.stub(CloudFormationClient.prototype, 'send').callsFake((command) => {
            if (command instanceof DescribeStacksCommand) {
                if (command.input.StackName === 'test-layer-1') {
                    return Promise.resolve({
                        Stacks: [{ StackStatus: 'UPDATE_COMPLETE' }]
                    });
                } else if (command.input.StackName === 'test') {
                    return Promise.resolve({
                        Stacks: [{ Tags: [] }]
                    });
                }
            } else if (command instanceof UpdateStackCommand) {
                cfCommands.push('update');
                return Promise.resolve({});
            } else if (command instanceof DeleteStackCommand) {
                cfCommands.push('delete');
                return Promise.resolve({});
            } else if (command instanceof CreateStackCommand) {
                cfCommands.push('create');
                return Promise.resolve({});
            }

            throw new Error('Unexpected CloudFormation command');
        });

        Sinon.stub(LambdaClient.prototype, 'send').callsFake((command) => {
            if (command instanceof GetFunctionCommand) {
                assert.deepEqual(command.input, {
                    FunctionName: 'test-layer-1'
                });

                return Promise.resolve({
                    Code: {
                        ResolvedImageUri: '123456789012.dkr.ecr.us-gov-east-1.amazonaws.com/example-ecr@sha256:abcdef'
                    }
                });
            }

            throw new Error('Unexpected Lambda command');
        });

        Sinon.stub(ECRClient.prototype, 'send').callsFake((command) => {
            if (command instanceof BatchGetImageCommand) {
                assert.deepEqual(command.input, {
                    repositoryName: process.env.ECR_TASKS_REPOSITORY_NAME,
                    imageIds: [{ imageDigest: 'sha256:abcdef' }]
                });

                return Promise.resolve({
                    images: [{ imageId: { imageDigest: 'sha256:abcdef' } }]
                });
            }

            throw new Error('Unexpected ECR command');
        });

        await LayerDeploy.apply(config, 1, stack as any);

        assert.deepEqual(cfCommands, ['update']);
    } finally {
        Sinon.restore();
    }
});

test('LayerDeploy.apply recreates stack when current image digest is missing', async () => {
    const cfCommands: string[] = [];
    let describeCount = 0;

    try {
        Sinon.stub(CloudWatchLogsClient.prototype, 'send').callsFake((command) => {
            if (command instanceof DeleteLogGroupCommand) {
                return Promise.resolve({});
            }

            throw new Error('Unexpected CloudWatch Logs command');
        });

        Sinon.stub(CloudFormationClient.prototype, 'send').callsFake((command) => {
            if (command instanceof DescribeStacksCommand) {
                if (command.input.StackName === 'test-layer-1') {
                    describeCount++;

                    if (describeCount === 1) {
                        return Promise.resolve({
                            Stacks: [{ StackStatus: 'UPDATE_COMPLETE' }]
                        });
                    }

                    throw new Error('Stack with id test-layer-1 does not exist');
                } else if (command.input.StackName === 'test') {
                    return Promise.resolve({
                        Stacks: [{ Tags: [] }]
                    });
                }
            } else if (command instanceof DeleteStackCommand) {
                cfCommands.push('delete');
                return Promise.resolve({});
            } else if (command instanceof CreateStackCommand) {
                cfCommands.push('create');
                return Promise.resolve({});
            } else if (command instanceof UpdateStackCommand) {
                cfCommands.push('update');
                return Promise.resolve({});
            }

            throw new Error('Unexpected CloudFormation command');
        });

        Sinon.stub(LambdaClient.prototype, 'send').callsFake((command) => {
            if (command instanceof GetFunctionCommand) {
                return Promise.resolve({
                    Code: {
                        ResolvedImageUri: '123456789012.dkr.ecr.us-gov-east-1.amazonaws.com/example-ecr@sha256:missing'
                    }
                });
            }

            throw new Error('Unexpected Lambda command');
        });

        Sinon.stub(ECRClient.prototype, 'send').callsFake((command) => {
            if (command instanceof BatchGetImageCommand) {
                assert.deepEqual(command.input, {
                    repositoryName: process.env.ECR_TASKS_REPOSITORY_NAME,
                    imageIds: [{ imageDigest: 'sha256:missing' }]
                });

                return Promise.resolve({ images: [] });
            }

            throw new Error('Unexpected ECR command');
        });

        await LayerDeploy.apply(config, 1, stack as any);

        assert.deepEqual(cfCommands, ['delete', 'create']);
    } finally {
        Sinon.restore();
    }
});