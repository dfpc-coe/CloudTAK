import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        EventLambda: {
            Type: 'AWS::Lambda::Function',
            DependsOn: ['SigningSecret'],
            Properties: {
                FunctionName: cf.join([cf.stackName, '-events']),
                MemorySize: 512,
                Timeout: 900,
                Description: 'Respond to events on the S3 Asset Bucket & Stack SQS Queue',
                ReservedConcurrentExecutions: 20,
                PackageType: 'Image',
                Environment: {
                    Variables: {
                        TAK_ETL_API: cf.ref('HostedURL'),
                        StackName: cf.stackName,
                        SigningSecret: cf.sub('{{resolve:secretsmanager:${AWS::StackName}/api/secret:SecretString::AWSCURRENT}}')
                    }
                },
                Role: cf.getAtt('EventLambdaRole', 'Arn'),
                Code: {
                    ImageUri: cf.join([cf.accountId, '.dkr.ecr.', cf.region, '.amazonaws.com/coe-ecr-etl:events-', cf.ref('GitSha')])
                }
            }
        },
        EventLambdaRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
                RoleName: cf.join([cf.stackName, '-events']),
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
                            Resource: [
                                cf.join(['arn:', cf.partition, ':s3:::', cf.join('-', [cf.stackName, cf.accountId, cf.region])]),
                                cf.join(['arn:', cf.partition, ':s3:::', cf.join('-', [cf.stackName, cf.accountId, cf.region]), '/*'])
                            ],
                            Action: '*'
                        },{
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
                                cf.getAtt('StackHookQueue', 'Arn')
                            ]
                        },{
                            Effect: 'Allow',
                            Action: [
                                'batch:SubmitJob',
                                'batch:ListJobs',
                                'batch:DescribeJobs',
                                'logs:GetLogEvents',
                                'batch:CancelJob',
                                'batch:DescribeJobs'
                            ],
                            Resource: [
                                '*'
                            ]
                        }]
                    }
                }],
                ManagedPolicyArns: [
                    cf.join(['arn:', cf.partition, ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'])
                ]
            }
        }
    }
};
