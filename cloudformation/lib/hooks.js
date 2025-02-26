import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        HookQueue: {
            Type: 'AWS::SQS::Queue',
            Properties: {
                ContentBasedDeduplication: true,
                QueueName: cf.join('-', [cf.stackName, 'hooks.fifo']),
                FifoQueue: true,
                RedrivePolicy: {
                    deadLetterTargetArn: cf.getAtt('HookDeadQueue', 'Arn'),
                    maxReceiveCount: 3
                }
            }
        },
        HookDeadQueue: {
            Type: 'AWS::SQS::Queue',
            Properties: {
                FifoQueue: true,
                QueueName: cf.join('-', [cf.stackName, 'hooks-dead.fifo'])
            }
        },
        HookLambdaSource: {
            Type: 'AWS::Lambda::EventSourceMapping',
            Properties: {
                Enabled: 'True',
                EventSourceArn:  cf.getAtt('HookQueue', 'Arn'),
                FunctionName: cf.ref('HookLambda')
            }
        },
        HookLambda: {
            Type: 'AWS::Lambda::Function',
            DependsOn: ['SigningSecret'],
            Properties: {
                FunctionName: cf.join([cf.stackName, '-hooks']),
                MemorySize: 512,
                Timeout: 15,
                Description: 'Push/Convert CoT events to external storage formats',
                ReservedConcurrentExecutions: 20,
                PackageType: 'Image',
                Environment: {
                    Variables: {
                        TAK_ETL_API: cf.join(['https://', cf.ref('HostedURL')]),
                        StackName: cf.stackName,
                        SigningSecret: cf.sub('{{resolve:secretsmanager:${AWS::StackName}/api/secret:SecretString::AWSCURRENT}}')
                    }
                },
                Role: cf.getAtt('HookLambdaRole', 'Arn'),
                Code: {
                    ImageUri: cf.join([cf.accountId, '.dkr.ecr.', cf.region, '.amazonaws.com/coe-ecr-etl:hooks-', cf.ref('GitSha')])
                }
            }
        },
        HookLambdaRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
                RoleName: cf.join([cf.stackName, '-hooks']),
                AssumeRolePolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Principal: {
                            Service: 'lambda.amazonaws.com'
                        },
                        Action: 'sts:AssumeRole'
                    }]
                },
                Path: '/',
                Policies: [{
                    PolicyName: cf.join([cf.stackName, '-hook-queue']),
                    PolicyDocument: {
                        Version: '2012-10-17',
                        Statement: [{
                            Effect: 'Allow',
                            Action: [
                                'sqs:SendMessage',
                                'sqs:ReceiveMessage',
                                'sqs:ChangeMessageVisibility',
                                'sqs:DeleteMessage',
                                'sqs:GetQueueUrl',
                                'sqs:GetQueueAttributes'
                            ],
                            Resource: [
                                cf.getAtt('HookQueue', 'Arn'),
                                cf.getAtt('HookDeadQueue', 'Arn')
                            ]
                        }]
                    }
                }],
                ManagedPolicyArns: [
                    cf.join(['arn:', cf.partition, ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'])
                ]
            }
        }
    },
    Outputs: {
        HookQueue: {
            Description: 'Hook Queue URL',
            Value: cf.ref('HookQueue')
        }
    }
};
