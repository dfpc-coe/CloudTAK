import cf from '@openaddresses/cloudfriend';

export default {
    Parameters: {
        RetentionScheduleExpression: {
            Description: 'EventBridge schedule expression for retention runs',
            Type: 'String',
            Default: 'rate(1 day)'
        },
        RetentionScheduleState: {
            Description: 'Enable or disable the retention schedule',
            Type: 'String',
            AllowedValues: ['ENABLED', 'DISABLED'],
            Default: 'ENABLED'
        }
    },
    Resources: {
        RetentionLogs: {
            Type: 'AWS::Logs::LogGroup',
            Properties: {
                LogGroupName: cf.join([cf.stackName, '-retention']),
                RetentionInDays: 7
            }
        },
        RetentionTaskRole: {
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
                    PolicyName: cf.join('-', [cf.stackName, 'retention-policy']),
                    PolicyDocument: {
                        Statement: [{
                            Effect: 'Allow',
                            Action: [
                                'kms:Decrypt',
                                'kms:GenerateDataKey'
                            ],
                            Resource: [cf.getAtt('KMS', 'Arn')]
                        }, {
                            Effect: 'Allow',
                            Resource: [
                                cf.join(['arn:', cf.partition, ':s3:::', cf.ref('AssetBucket'), '/*'])
                            ],
                            Action: [
                                's3:DeleteObject'
                            ]
                        }, {
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
        RetentionTaskDefinition: {
            Type: 'AWS::ECS::TaskDefinition',
            DependsOn: ['SigningSecret'],
            Properties: {
                Family: cf.join([cf.stackName, '-retention']),
                Cpu: 256,
                Memory: 512,
                NetworkMode: 'awsvpc',
                RequiresCompatibilities: ['FARGATE'],
                Tags: [{
                    Key: 'Name',
                    Value: cf.join('-', [cf.stackName, 'retention'])
                }],
                ExecutionRoleArn: cf.getAtt('ExecRole', 'Arn'),
                TaskRoleArn: cf.getAtt('RetentionTaskRole', 'Arn'),
                ContainerDefinitions: [{
                    Name: 'retention',
                    Image: cf.join([cf.accountId, '.dkr.ecr.', cf.region, '.amazonaws.com/tak-vpc-', cf.ref('Environment'), '-cloudtak-api:retention-', cf.ref('GitSha')]),
                    Command: ['npm', 'run', 'run-once'],
                    Environment: [
                        {
                            Name: 'POSTGRES',
                            Value: cf.join([
                                'postgresql://',
                                cf.sub('{{resolve:secretsmanager:${AWS::StackName}/rds/secret:SecretString:username:AWSCURRENT}}'),
                                ':',
                                cf.sub('{{resolve:secretsmanager:${AWS::StackName}/rds/secret:SecretString:password:AWSCURRENT}}'),
                                '@',
                                cf.getAtt('DBCluster', 'Endpoint.Address'),
                                ':5432/tak_ps_etl?sslmode=require'
                            ])
                        },
                        { Name: 'SigningSecret', Value: cf.sub('{{resolve:secretsmanager:${AWS::StackName}/api/secret:SecretString::AWSCURRENT}}') },
                        { Name: 'AWS_REGION', Value: cf.region },
                        { Name: 'CLOUDTAK_Mode', Value: 'AWS' },
                        { Name: 'StackName', Value: cf.stackName },
                        { Name: 'ASSET_BUCKET', Value: cf.ref('AssetBucket') },
                        { Name: 'API_URL', Value: cf.join(['https://map.', cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-hosted-zone-name']))]) }
                    ],
                    LogConfiguration: {
                        LogDriver: 'awslogs',
                        Options: {
                            'awslogs-group': cf.join([cf.stackName, '-retention']),
                            'awslogs-region': cf.region,
                            'awslogs-stream-prefix': cf.stackName,
                            'awslogs-create-group': true
                        }
                    },
                    Essential: true
                }]
            }
        },
        RetentionSecurityGroup: {
            Type: 'AWS::EC2::SecurityGroup',
            Properties: {
                Tags: [{
                    Key: 'Name',
                    Value: cf.join('-', [cf.stackName, 'retention-sg'])
                }],
                GroupName: cf.join('-', [cf.stackName, 'retention-sg']),
                GroupDescription: 'No direct access to the retention service',
                VpcId: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-vpc'])),
                SecurityGroupIngress: []
            }
        },
        RetentionEventsRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
                AssumeRolePolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Principal: {
                            Service: 'events.amazonaws.com'
                        },
                        Action: 'sts:AssumeRole'
                    }]
                },
                Policies: [{
                    PolicyName: cf.join('-', [cf.stackName, 'retention-events-policy']),
                    PolicyDocument: {
                        Statement: [{
                            Effect: 'Allow',
                            Action: ['ecs:RunTask'],
                            Resource: cf.ref('RetentionTaskDefinition')
                        }, {
                            Effect: 'Allow',
                            Action: ['iam:PassRole'],
                            Resource: [
                                cf.getAtt('ExecRole', 'Arn'),
                                cf.getAtt('RetentionTaskRole', 'Arn')
                            ]
                        }]
                    }
                }]
            }
        },
        RetentionSchedule: {
            Type: 'AWS::Events::Rule',
            Properties: {
                Description: 'Schedule for CloudTAK retention runs',
                ScheduleExpression: cf.ref('RetentionScheduleExpression'),
                State: cf.ref('RetentionScheduleState'),
                Targets: [{
                    Id: 'RetentionRunTask',
                    Arn: cf.join(['arn:', cf.partition, ':ecs:', cf.region, ':', cf.accountId, ':cluster/tak-vpc-', cf.ref('Environment')]),
                    RoleArn: cf.getAtt('RetentionEventsRole', 'Arn'),
                    EcsParameters: {
                        TaskDefinitionArn: cf.ref('RetentionTaskDefinition'),
                        TaskCount: 1,
                        LaunchType: 'FARGATE',
                        PlatformVersion: 'LATEST',
                        NetworkConfiguration: {
                            AwsVpcConfiguration: {
                                AssignPublicIp: 'ENABLED',
                                SecurityGroups: [cf.ref('RetentionSecurityGroup')],
                                Subnets: [
                                    cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-subnet-public-a'])),
                                    cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-subnet-public-b']))
                                ]
                            }
                        }
                    }
                }]
            }
        }
    }
};
