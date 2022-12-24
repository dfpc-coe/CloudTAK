import cf from '@mapbox/cloudfriend';

export default {
    Resources: {
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
                ManagedPolicyArns: ['arn:aws:iam::aws:policy/service-role/AWSBatchServiceRole']
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
                                cf.join(['arn:aws:s3:::', cf.ref('DataBucketProduction')]),
                                cf.join(['arn:aws:s3:::', cf.ref('DataBucketProduction'), '/*'])
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
                    Subnets: [cf.ref('SubnetB')]
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
                ManagedPolicyArns: ['arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy'],
                Path: '/'
            }
        },
        BatchSecurityGroup: {
            Type: 'AWS::EC2::SecurityGroup',
            Properties: {
                VpcId: cf.ref('VPC'),
                GroupDescription: cf.join([cf.stackName, ' Batch Security Group']),
                SecurityGroupIngress: []
            }
        }
    }
};
