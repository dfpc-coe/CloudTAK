import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        Logs: {
            Type: 'AWS::Logs::LogGroup',
            Properties: {
                LogGroupName: cf.join([cf.stackName, '-events']),
                RetentionInDays: 7
            }
        },
        EventsTaskRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
                AssumeRolePolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Principal: {
                            Service: 'ecs-tasks.amazonaws.com'
                        },
                        Action: 'sts:AssumeRole'
                    }]
                },
                Policies: [{
                    PolicyName: cf.join('-', [cf.stackName, 'api-policy']),
                    PolicyDocument: {
                        Statement: [{
                            Effect: 'Allow',
                            Action: [
                                'ssmmessages:CreateControlChannel',
                                'ssmmessages:CreateDataChannel',
                                'ssmmessages:OpenControlChannel',
                                'ssmmessages:OpenDataChannel'
                            ],
                            Resource: '*'
                        },{
                            Effect: 'Allow',
                            Action: [
                                'kms:Decrypt',
                                'kms:GenerateDataKey'
                            ],
                            Resource: [cf.getAtt('KMS', 'Arn')]
                        },{
                            Effect: 'Allow',
                            Action: [
                                'secretsmanager:Describe*',
                                'secretsmanager:Get*',
                                'secretsmanager:List*'
                            ],
                            Resource: [
                                cf.join(['arn:', cf.partition, ':secretsmanager:', cf.region, ':', cf.accountId, ':secret:', cf.stackName, '/*'])
                            ]
                        }]
                    }
                }]
            }
        },
        TaskDefinition: {
            Type: 'AWS::ECS::TaskDefinition',
            DependsOn: ['SigningSecret', 'MediaSecret'],
            Properties: {
                Family: cf.join([cf.stackName, '-events']),
                Cpu: 1024 * 1,
                Memory: 4096 * 2,
                NetworkMode: 'awsvpc',
                RequiresCompatibilities: ['FARGATE'],
                Tags: [{
                    Key: 'Name',
                    Value: cf.join('-', [cf.stackName, 'events'])
                }],
                ExecutionRoleArn: cf.getAtt('ExecRole', 'Arn'),
                TaskRoleArn: cf.getAtt('EventsTaskRole', 'Arn'),
                ContainerDefinitions: [{
                    Name: 'api',
                    Image: cf.join([cf.accountId, '.dkr.ecr.', cf.region, '.amazonaws.com/coe-ecr-etl:', cf.ref('GitSha'), '-events']),
                    PortMappings: [{
                        ContainerPort: 5000
                    }],
                    Environment: [
                        {
                            Name: 'POSTGRES',
                            Value: cf.join([
                                'postgresql://',
                                cf.sub('{{resolve:secretsmanager:${AWS::StackName}/rds/secret:SecretString:username:AWSCURRENT}}'),
                                ':',
                                cf.sub('{{resolve:secretsmanager:${AWS::StackName}/rds/secret:SecretString:password:AWSCURRENT}}'),
                                '@',
                                cf.getAtt('DBInstance', 'Endpoint.Address'),
                                ':5432/tak_ps_etl?sslmode=require'
                            ])
                        },
                        { Name: 'AWS_REGION', Value: cf.region },
                        { Name: 'CLOUDTAK_Mode', Value: 'AWS' },
                        { Name: 'StackName', Value: cf.stackName },
                        { Name: 'ASSET_BUCKET', Value: cf.ref('AssetBucket') },
                        { Name: 'API_URL', Value: cf.join([cf.ref('SubdomainPrefix'), '.', cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-hosted-zone-name']))]) },
                        { Name: 'VpcId', Value: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-vpc'])) },
                    ],
                    RestartPolicy: {
                        Enabled: true,
                        RestartAttemptPeriod: 300
                    },
                    LogConfiguration: {
                        LogDriver: 'awslogs',
                        Options: {
                            'awslogs-group': cf.join([cf.stackName, '-events']),
                            'awslogs-region': cf.region,
                            'awslogs-stream-prefix': cf.stackName,
                            'awslogs-create-group': true
                        }
                    },
                    Essential: true
                }]
            }
        },
        Service: {
            Type: 'AWS::ECS::Service',
            Properties: {
                ServiceName: cf.join('-', [cf.stackName, 'events']),
                Cluster: cf.join(['tak-vpc-', cf.ref('Environment')]),
                TaskDefinition: cf.ref('TaskDefinition'),
                LaunchType: 'FARGATE',
                PropagateTags: 'SERVICE',
                EnableExecuteCommand: cf.ref('EnableExecute'),
                HealthCheckGracePeriodSeconds: 300,
                DesiredCount: 1,
                NetworkConfiguration: {
                    AwsvpcConfiguration: {
                        AssignPublicIp: 'ENABLED',
                        SecurityGroups: [cf.ref('ServiceSecurityGroup')],
                        Subnets:  [
                            cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-subnet-public-a'])),
                            cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-subnet-public-b']))
                        ]
                    }
                },
                LoadBalancers: [{
                    ContainerName: 'api',
                    ContainerPort: 5000,
                    TargetGroupArn: cf.ref('TargetGroup')
                }]
            }
        },
        ServiceSecurityGroup: {
            Type: 'AWS::EC2::SecurityGroup',
            Properties: {
                Tags: [{
                    Key: 'Name',
                    Value: cf.join('-', [cf.stackName, 'events-sg'])
                }],
                GroupName: cf.join('-', [cf.stackName, 'events-sg']),
                GroupDescription: 'No direct access to this security group',
                VpcId: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-vpc'])),
                SecurityGroupIngress: []
            }
        },
    },
};
