import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        BatchDataJob: {
            Type: 'AWS::Batch::JobDefinition',
            Properties: {
                Type: 'container',
                JobDefinitionName: cf.join('', [cf.stackName, '-data-job']),
                PlatformCapabilities: ['FARGATE'],
                RetryStrategy: { Attempts: 1 },
                ContainerProperties: {
                    FargatePlatformConfiguration: {
                        PlatformVersion: 'LATEST'
                    },
                    Environment: [
                        { Name: 'StackName', Value: cf.stackName },
                        { Name: 'TAK_ETL_URL', Value: cf.join(['https://', cf.ref('HostedURL')]) },
                        { Name: 'TAK_ETL_BUCKET', Value: cf.ref('AssetBucket') }
                    ],
                    JobRoleArn: cf.getAtt('BatchJobRole', 'Arn'),
                    ExecutionRoleArn: cf.getAtt('BatchExecRole', 'Arn'),
                    Image: cf.join([cf.accountId, '.dkr.ecr.', cf.region, '.amazonaws.com/coe-ecr-etl:data-', cf.ref('GitSha')]),
                    ReadonlyRootFilesystem: false,
                    ResourceRequirements: [{
                        Type: 'VCPU',
                        Value: 1
                    },{
                        Type: 'MEMORY',
                        Value: 2048
                    }]
                }
            }
        },
        BatchJobQueue: {
            Type: 'AWS::Batch::JobQueue',
            Properties: {
                ComputeEnvironmentOrder: [{
                    Order: 1,
                    ComputeEnvironment: cf.ref('BatchComputeEnvironment')
                }],
                State: 'ENABLED',
                Priority: 1,
                JobQueueName: cf.join('-', [cf.stackName, 'queue'])
            }
        },
        BatchServiceRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
                AssumeRolePolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Principal: {
                            Service: 'batch.amazonaws.com'
                        },
                        Action: 'sts:AssumeRole'
                    }]
                },
                Path: '/service-role/',
                ManagedPolicyArns: [cf.join(['arn:', cf.partition, ':iam::aws:policy/service-role/AWSBatchServiceRole'])]
            }
        },
        BatchJobRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
                Path: '/',
                AssumeRolePolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Action: 'sts:AssumeRole',
                        Principal: {
                            Service: 'ecs-tasks.amazonaws.com'
                        }
                    },{
                        Effect: 'Allow',
                        Principal: {
                            Service: 'lambda.amazonaws.com'
                        },
                        Action: 'sts:AssumeRole'
                    }]
                },
                Policies: [{
                    PolicyName: cf.join('-', [cf.stackName, 'etl-policy']),
                    PolicyDocument: {
                        Statement: [{
                            Effect: 'Allow',
                            Resource: '*',
                            Action: ['batch:DescribeJobs']
                        },{
                            Effect: 'Allow',
                            Resource: [
                                cf.join(['arn:', cf.partition, ':s3:::', cf.ref('AssetBucket')]),
                                cf.join(['arn:', cf.partition, ':s3:::', cf.ref('AssetBucket'), '/*'])
                            ],
                            Action: '*'
                        },{
                            Effect: 'Allow',
                            Resource: '*',
                            Action: ['ecs:DescribeContainerInstances']
                        }]
                    }
                }]
            }
        },
        BatchComputeEnvironment: {
            Type: 'AWS::Batch::ComputeEnvironment',
            Properties: {
                Type: 'MANAGED',
                State: 'ENABLED',
                ServiceRole: cf.getAtt('BatchServiceRole', 'Arn'),
                ComputeEnvironmentName: cf.join('-', ['etl', cf.stackName]),
                ComputeResources: {
                    Type: 'FARGATE',
                    MaxvCpus: 128,
                    SecurityGroupIds: [cf.ref('BatchSecurityGroup')],
                    Subnets: [
                        cf.importValue(cf.join(['coe-vpc-', cf.ref('Environment'), '-subnet-private-a'])),
                        cf.importValue(cf.join(['coe-vpc-', cf.ref('Environment'), '-subnet-private-b']))
                    ]
                }
            }
        },
        BatchExecRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
                AssumeRolePolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Action: 'sts:AssumeRole',
                        Principal: {
                            Service: 'ecs-tasks.amazonaws.com'
                        }
                    }]
                },
                ManagedPolicyArns: [cf.join(['arn:', cf.partition, ':iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy'])],
                Path: '/'
            }
        },
        BatchSecurityGroup: {
            Type: 'AWS::EC2::SecurityGroup',
            Properties: {
                Tags: [{
                    Key: 'Name',
                    Value: cf.join('-', [cf.stackName, 'vpc'])
                }],
                VpcId: cf.importValue(cf.join(['coe-vpc-', cf.ref('Environment'), '-vpc'])),
                GroupName: cf.join([cf.stackName, '-batch']),
                GroupDescription: cf.join([cf.stackName, ' Batch Security Group'])
            }
        }
    }
};
