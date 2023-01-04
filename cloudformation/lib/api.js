import cf from '@mapbox/cloudfriend';

export default {
    Resources: {
        Logs: {
            Type: 'AWS::Logs::LogGroup',
            Properties: {
                LogGroupName: cf.stackName,
                RetentionInDays: 7
            }
        },
        ELB: {
            Type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
            Properties: {
                Name: cf.stackName,
                Type: 'application',
                SecurityGroups: [cf.ref('ELBSecurityGroup')],
                Subnets:  [
                    cf.ref('SubnetPublicA'),
                    cf.ref('SubnetPublicB')
                ]
            }

        },
        ELBSecurityGroup: {
            Type : 'AWS::EC2::SecurityGroup',
            Properties : {
                GroupDescription: cf.join('-', [cf.stackName, 'elb-sg']),
                SecurityGroupIngress: [{
                    CidrIp: '0.0.0.0/0',
                    IpProtocol: 'tcp',
                    FromPort: 443,
                    ToPort: 443
                },{
                    CidrIp: '0.0.0.0/0',
                    IpProtocol: 'tcp',
                    FromPort: 80,
                    ToPort: 80
                }],
                VpcId: cf.ref('VPC')
            }
        },
        HttpListener: {
            Type: 'AWS::ElasticLoadBalancingV2::Listener',
            Properties: {
                DefaultActions: [{
                    Type: 'forward',
                    TargetGroupArn: cf.ref('TargetGroup')
                }],
                LoadBalancerArn: cf.ref('ELB'),
                Port: 80,
                Protocol: 'HTTP'
            }
        },
        TargetGroup: {
            Type: 'AWS::ElasticLoadBalancingV2::TargetGroup',
            DependsOn: 'ELB',
            Properties: {
                HealthCheckEnabled: true,
                HealthCheckIntervalSeconds: 30,
                HealthCheckPath: '/api',
                Port: 5000,
                Protocol: 'HTTP',
                TargetType: 'ip',
                VpcId: cf.ref('VPC'),
                Matcher: {
                    HttpCode: '200,202,302,304'
                }
            }
        },
        ECSCluster: {
            Type: 'AWS::ECS::Cluster',
            Properties: {
                ClusterName: cf.join('-', [cf.stackName, 'cluster'])
            }
        },
        TaskRole: {
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
                            Resource: [
                                cf.join(['arn:aws:s3:::', cf.ref('AssetBucket')]),
                                cf.join(['arn:aws:s3:::', cf.ref('AssetBucket'), '/*'])
                            ],
                            Action: '*'
                        },{
                            Effect: 'Allow',
                            Action: [
                                'ecr:Describe*',
                                'ecr:Get*',
                                'ecr:List*'
                            ],
                            Resource: [
                                cf.join(['arn:aws:ecr:', cf.region, ':', cf.accountId, ':repository/coe-ecr-etl-tasks'])
                            ]
                        },{
                            Effect: 'Allow', // Create events for scheduled ETL
                            Action: [
                                'events:PutRule',
                                'events:DescribeRule',
                                'events:ListRules',
                                'events:PutTargets',
                                'events:RemoveTargets',
                                'events:DisableRule',
                                'events:EnableRule',
                                'events:DeleteRule'
                            ],
                            Resource: [
                                cf.join(['arn:aws:events:', cf.region, ':', cf.accountId, ':rule/', cf.stackName, '-*'])
                            ]
                        }]
                    }
                }]
            }
        },
        ExecRole: {
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
                    PolicyName: cf.join([cf.stackName, '-api-logging']),
                    PolicyDocument: {
                        Statement: [{
                            Effect: 'Allow',
                            Action: [
                                'logs:CreateLogGroup',
                                'logs:CreateLogStream',
                                'logs:PutLogEvents',
                                'logs:DescribeLogStreams'
                            ],
                            Resource: ['arn:aws:logs:*:*:*']
                        }]
                    }
                }],
                ManagedPolicyArns: [
                    'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy',
                    'arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role',
                    'arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly'
                ],
                Path: '/service-role/'
            }
        },
        TaskDefinition: {
            Type: 'AWS::ECS::TaskDefinition',
            Properties: {
                Family: cf.stackName,
                Cpu: 1024,
                Memory: 4096,
                NetworkMode: 'awsvpc',
                RequiresCompatibilities: ['FARGATE'],
                Tags: [{
                    Key: 'Name',
                    Value: cf.join('-', [cf.stackName, 'api'])
                }],
                ExecutionRoleArn: cf.getAtt('ExecRole', 'Arn'),
                TaskRoleArn: cf.getAtt('TaskRole', 'Arn'),
                ContainerDefinitions: [{
                    Name: 'api',
                    Image: cf.join([cf.accountId, '.dkr.ecr.', cf.region, '.amazonaws.com/coe-ecr-etl:', cf.ref('GitSha')]),
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
                                ':5432/tak_ps_etl'
                            ])
                        },
                        { Name: 'SigningSecret', Value: cf.sub('{{resolve:secretsmanager:${AWS::StackName}/api/secret:SecretString::AWSCURRENT}}') },
                        { Name: 'StackName', Value: cf.stackName },
                        { Name: 'ASSET_BUCKET', Value: cf.ref('AssetBucket') },
                        { Name: 'TAK_USERNAME', Value: cf.ref('Username') },
                        { Name: 'TAK_PASSWORD', Value: cf.ref('Password') },
                        { Name: 'AWS_DEFAULT_REGION', Value: cf.region }
                    ],
                    LogConfiguration: {
                        LogDriver: 'awslogs',
                        Options: {
                            'awslogs-group': cf.stackName,
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
                ServiceName: cf.join('-', [cf.stackName, 'Service']),
                Cluster: cf.ref('ECSCluster'),
                TaskDefinition: cf.ref('TaskDefinition'),
                LaunchType: 'FARGATE',
                HealthCheckGracePeriodSeconds: 300,
                DesiredCount: 1,
                NetworkConfiguration: {
                    AwsvpcConfiguration: {
                        AssignPublicIp: 'ENABLED',
                        SecurityGroups: [cf.ref('ServiceSecurityGroup')],
                        Subnets:  [
                            cf.ref('SubnetPublicA'),
                            cf.ref('SubnetPublicB')
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
                GroupDescription: cf.join('-', [cf.stackName, 'ec2-sg']),
                VpcId: cf.ref('VPC'),
                SecurityGroupIngress: [{
                    CidrIp: '0.0.0.0/0',
                    IpProtocol: 'tcp',
                    FromPort: 5000,
                    ToPort: 5000
                }]
            }
        }
    },
    Outputs: {
        API: {
            Description: 'API ELB',
            Value: cf.join(['http://', cf.getAtt('ELB', 'DNSName')])
        }
    }
};
