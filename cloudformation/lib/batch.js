import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        BatchDataJob: {
            Type: 'AWS::Batch::JobDefinition',
            Properties: {
                Type: 'container',
                JobDefinitionName: cf.join('', [cf.stackName, '-data-job']),
                PlatformCapabilities: [ 'FARGATE' ],
                RetryStrategy: { Attempts: 1 },
                ContainerProperties: {
                    FargatePlatformConfiguration: {
                        PlatformVersion: 'LATEST'
                    },
                    Environment: [
                        { Name: 'StackName', Value: cf.stackName }
                    ],
                    JobRoleArn: cf.getAtt('BatchJobRole', 'Arn'),
                    ExecutionRoleArn: cf.getAtt('BatchExecRole', 'Arn'),
                    Image: cf.join([cf.accountId, '.dkr.ecr.', cf.region, '.amazonaws.com/coe-ecr-etl:task-', cf.ref('GitSha')]),
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
                ManagedPolicyArns: [
                    cf.join(['arn:', cf.partition, ':iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy'])
                ],
                Path: '/'
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
                ServiceRole: cf.getAtt('BatchServiceRole', 'Arn'),
                ComputeEnvironmentName: cf.join('-', ['etl', cf.stackName]),
                ComputeResources: {
                    Type: 'FARGATE',
                    MaxvCpus: 128,
                    SecurityGroupIds: [cf.ref('BatchSecurityGroup')],
                    Subnets: [
                        cf.importValue('coe-vpc-prod-subnet-private-a'),
                        cf.importValue('coe-vpc-prod-subnet-private-b')
                    ]
                },
                'State': 'ENABLED'
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
                VpcId: cf.importValue('coe-vpc-prod-vpc'),
                GroupDescription: cf.join([cf.stackName, ' Batch Security Group']),
                SecurityGroupIngress: []
            }
        }
    }
};
