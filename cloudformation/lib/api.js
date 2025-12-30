import cf from '@openaddresses/cloudfriend';

export default {
    Parameters: {
        ComputeCpu: {
            Description: 'The number of CPU units used by the task',
            Type: 'Number',
            Default: 1024
        },
        ComputeMemory: {
            Description: 'The amount of memory (in MiB) used by the task',
            Type: 'Number',
            Default: 4096 * 2
        }
    },
    Resources: {
        ELBDNS: {
            Type: 'AWS::Route53::RecordSet',
            Properties: {
                HostedZoneId: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-hosted-zone-id'])),
                Type : 'A',
                Name: cf.join(['map.', cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-hosted-zone-name']))]),
                Comment: cf.join(' ', [cf.stackName, 'UI/API DNS Entry']),
                AliasTarget: {
                    DNSName: cf.getAtt('ELB', 'DNSName'),
                    EvaluateTargetHealth: true,
                    HostedZoneId: cf.getAtt('ELB', 'CanonicalHostedZoneID')
                }
            }
        },
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
                LoadBalancerAttributes: [{
                    Key: 'idle_timeout.timeout_seconds',
                    Value: 4000
                },{
                    Key: 'connection_logs.s3.enabled',
                    Value: true
                },{
                    Key: 'connection_logs.s3.bucket',
                    Value: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-bucket']))
                },{
                    Key: 'connection_logs.s3.prefix',
                    Value: cf.stackName
                },{
                    Key: 'access_logs.s3.enabled',
                    Value: true
                },{
                    Key: 'access_logs.s3.bucket',
                    Value: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-bucket']))
                },{
                    Key: 'access_logs.s3.prefix',
                    Value: cf.stackName
                }],
                Subnets:  [
                    cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-subnet-public-a'])),
                    cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-subnet-public-b']))
                ]
            }
        },
        ELBSecurityGroup: {
            Type : 'AWS::EC2::SecurityGroup',
            Properties : {
                Tags: [{
                    Key: 'Name',
                    Value: cf.join('-', [cf.stackName, 'elb-sg'])
                }],
                GroupName: cf.join('-', [cf.stackName, 'elb-sg']),
                GroupDescription: 'Allow 443 and 80 Access to ELB',
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
                VpcId: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-vpc']))
            }
        },
        HttpsListener: {
            Type: 'AWS::ElasticLoadBalancingV2::Listener',
            Properties: {
                Certificates: [{
                    CertificateArn: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-acm']))
                }],
                DefaultActions: [{
                    Type: 'forward',
                    TargetGroupArn: cf.ref('TargetGroup')
                }],
                LoadBalancerArn: cf.ref('ELB'),
                Port: 443,
                Protocol: 'HTTPS'
            }
        },
        HttpListener: {
            Type: 'AWS::ElasticLoadBalancingV2::Listener',
            Properties: {
                DefaultActions: [{
                    Type: 'redirect',
                    RedirectConfig: {
                        Protocol: 'HTTPS',
                        StatusCode: 'HTTP_301',
                        Port: 443
                    }
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
                VpcId: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-vpc'])),
                Matcher: {
                    HttpCode: '200,202,302,304'
                }
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
                            Action: [
                                'ssmmessages:CreateControlChannel',
                                'ssmmessages:CreateDataChannel',
                                'ssmmessages:OpenControlChannel',
                                'ssmmessages:OpenDataChannel'
                            ],
                            Resource: '*'
                        },{
                            Effect: 'Allow',
                            Resource: [
                                cf.join(['arn:', cf.partition, ':s3:::', cf.ref('AssetBucket')]),
                                cf.join(['arn:', cf.partition, ':s3:::', cf.ref('AssetBucket'), '/*'])
                            ],
                            Action: '*'
                        },{
                            Effect: 'Allow',
                            Action: [
                                'ecr:Describe*',
                                'ecr:Get*',
                                'ecr:BatchDeleteImage',
                                'ecr:BatchGetImage',
                                'ecr:List*'
                            ],
                            Resource: [
                                cf.join(['arn:', cf.partition, ':ecr:', cf.region, ':', cf.accountId, ':repository/tak-vpc-', cf.ref('Environment'), '-cloudtak-tasks']),
                            ]
                        },{
                            Effect: 'Allow',
                            Action: [
                                'sqs:PurgeQueue',
                                'sqs:SendMessage',
                                'sqs:SendMessageBatch',
                                'sqs:ChangeMessageVisibility',
                                'sqs:UntagQueue',
                                'sqs:GetQueueUrl',
                                'sqs:GetQueueAttributes',
                                'sqs:DeleteMessage'
                            ],
                            Resource: [
                                cf.join(['arn:', cf.partition, ':sqs:', cf.region, ':', cf.accountId, ':tak-cloudtak-', cf.ref('Environment'), '-layer-*'])
                            ]
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
                        },{ // ------------ Permissions Required to stand up lambda tasks ------------
                            Effect: 'Allow',
                            Action: [
                                'sns:publish'
                            ],
                            Resource: [
                                cf.join(['arn:', cf.partition, ':sns:', cf.region, ':', cf.accountId, ':', cf.stackName, '-*'])
                            ]
                        },{
                            Effect: 'Allow',
                            Action: [
                                'cloudformation:DescribeStacks'
                            ],
                            Resource: [
                                cf.join(['arn:', cf.partition, ':cloudformation:', cf.region, ':', cf.accountId, ':stack/', cf.stackName, '/*'])
                            ]
                        },{
                            Effect: 'Allow',
                            Action: [
                                'apigateway:GET',
                                'apigateway:PATCH',
                                'apigateway:DELETE',
                                'apigateway:POST',
                                'apigateway:PUT'
                            ],
                            Resource: [
                                cf.join(['arn:', cf.partition, ':apigateway:', cf.region, '::/apis/', cf.importValue(cf.join(['tak-cloudtak-webhooks-', cf.ref('Environment'), '-api'])), '/routes']),
                                cf.join(['arn:', cf.partition, ':apigateway:', cf.region, '::/apis/', cf.importValue(cf.join(['tak-cloudtak-webhooks-', cf.ref('Environment'), '-api'])), '/routes/*']),
                                cf.join(['arn:', cf.partition, ':apigateway:', cf.region, '::/apis/', cf.importValue(cf.join(['tak-cloudtak-webhooks-', cf.ref('Environment'), '-api'])), '/integrations']),
                                cf.join(['arn:', cf.partition, ':apigateway:', cf.region, '::/apis/', cf.importValue(cf.join(['tak-cloudtak-webhooks-', cf.ref('Environment'), '-api'])), '/integrations/*'])
                            ]
                        },{
                            Effect: 'Allow',
                            Action: [
                                'iam:PassRole'
                            ],
                            Resource: [
                                cf.join(['arn:', cf.partition, ':iam::', cf.accountId, ':role/', cf.stackName]),
                                cf.join(['arn:', cf.partition, ':iam::', cf.accountId, ':role/tak-cloudtak-webhooks-', cf.ref('Environment')])
                            ]
                        },{
                            Effect: 'Allow',
                            Action: [
                                'cloudformation:*'
                            ],
                            Resource: [
                                cf.join(['arn:', cf.partition, ':cloudformation:', cf.region, ':', cf.accountId, ':stack/', cf.stackName, '-layer-*'])
                            ]
                        },{
                            Effect: 'Allow',
                            Action: [
                                'cloudwatch:UntagResource',
                                'cloudwatch:Describe*'
                            ],
                            Resource: [
                                cf.join(['arn:', cf.partition, ':cloudwatch:', cf.region, ':', cf.accountId, ':alarm:*'])
                            ]
                        },{
                            Effect: 'Allow',
                            Action: [
                                'sqs:CreateQueue',
                                'sqs:DeleteQueue',
                                'sqs:GetQueueAttributes',
                                'sqs:SetQueueAttributes',
                                'sqs:ListQueueTags',
                                'sqs:ReceiveMessage',
                                'sqs:DeleteMessage',
                                'sqs:TagQueue'
                            ],
                            Resource: [
                                cf.join(['arn:', cf.partition, ':sqs:', cf.region, ':', cf.accountId, ':tak-cloudtak-', cf.ref('Environment'), '-layer-*'])
                            ]
                        },{
                            Effect: 'Allow',
                            Action: [
                                'cloudwatch:PutMetricData',
                                'cloudwatch:GetMetricData'
                            ],
                            Resource: [
                                '*'
                            ]
                        },{
                            Effect: 'Allow',
                            Action: [
                                'cloudwatch:Get*',
                                'cloudwatch:List*',
                                'cloudwatch:PutMetricAlarm',
                                'cloudwatch:DeleteAlarms'
                            ],
                            Resource: [
                                cf.join(['arn:', cf.partition, ':cloudwatch:', cf.region, ':', cf.accountId, ':alarm:', cf.stackName, '-layer-*'])
                            ]
                        },{
                            Effect: 'Allow',
                            Action: [
                                'logs:TagResource',
                                'logs:CreateLogGroup',
                                'logs:DeleteLogGroup',
                                'logs:PutRetentionPolicy',
                                'logs:UntagResource',
                                'logs:List*',
                                'logs:Describe*',
                                'logs:Get*'
                            ],
                            Resource: [
                                cf.join(['arn:', cf.partition, ':logs:', cf.region, ':', cf.accountId, ':log-group:/aws/lambda/', cf.stackName, '-layer-*'])
                            ]
                        },{
                            Effect: 'Allow',
                            Action: [
                                'lambda:*'
                            ],
                            Resource: [
                                cf.join(['arn:', cf.partition, ':lambda:', cf.region, ':', cf.accountId, ':function:', cf.stackName, '-layer-*'])
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
                                cf.join(['arn:', cf.partition, ':events:', cf.region, ':', cf.accountId, ':rule/', cf.stackName, '-*'])
                            ]
                        },{
                            Effect: 'Allow',
                            Action: [
                                'lambda:CreateEventSourceMapping',
                                'lambda:UpdateEventSourceMapping',
                                'lambda:GetEventSourceMapping',
                                'lambda:DeleteEventSourceMapping',
                                'logs:GetLogEvents'
                            ],
                            Resource: [
                                '*'
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
                            Resource: [cf.join(['arn:', cf.partition, ':logs:*:*:*'])]
                        }]
                    }
                }],
                ManagedPolicyArns: [
                    cf.join(['arn:', cf.partition, ':iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy'])
                ],
                Path: '/service-role/'
            }
        },
        TaskDefinition: {
            Type: 'AWS::ECS::TaskDefinition',
            DependsOn: ['SigningSecret'],
            Properties: {
                Family: cf.stackName,
                Cpu: cf.ref('ComputeCpu'),
                Memory: cf.ref('ComputeMemory'),
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
                    Image: cf.join([cf.accountId, '.dkr.ecr.', cf.region, '.amazonaws.com/tak-vpc-', cf.ref('Environment'), '-cloudtak-api:', cf.ref('GitSha')]),
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
                                cf.getAtt('DBCluster', 'Endpoint.Address'),
                                ':5432/tak_ps_etl?sslmode=require'
                            ])
                        },
                        { Name: 'AWS_REGION', Value: cf.region },
                        { Name: 'CLOUDTAK_Mode', Value: 'AWS' },
                        { Name: 'StackName', Value: cf.stackName },
                        { Name: 'ASSET_BUCKET', Value: cf.ref('AssetBucket') },
                        { Name: 'API_URL', Value: cf.join(['https://map.', cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-hosted-zone-name']))]) },
                        { Name: 'VpcId', Value: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-vpc'])) },
                        { Name: 'SubnetPublicA', Value: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-subnet-public-a'])) },
                        { Name: 'SubnetPublicB', Value: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-subnet-public-b'])) },
                        { Name: 'MediaSecurityGroup', Value: cf.ref('MediaSecurityGroup') }
                    ],
                    RestartPolicy: {
                        Enabled: true,
                        RestartAttemptPeriod: 300
                    },
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
                    Value: cf.join('-', [cf.stackName, 'ec2-sg'])
                }],
                GroupName: cf.join('-', [cf.stackName, 'ec2-sg']),
                GroupDescription: 'Allow access to docker port 5000',
                VpcId: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-vpc'])),
                SecurityGroupIngress: [{
                    Description: 'ELB Traffic',
                    IpProtocol: 'tcp',
                    SourceSecurityGroupId: cf.ref('ELBSecurityGroup'),
                    FromPort: 5000,
                    ToPort: 5000
                }]
            }
        },
        ETLFunctionRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
                RoleName: cf.stackName,
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
                    PolicyName: cf.join([cf.stackName, '-etl-policy']),
                    PolicyDocument: {
                        Version: '2012-10-17',
                        Statement: [{
                            Effect: 'Allow',
                            Action: [
                                'sqs:SendMessage',
                                'sqs:ChangeMessageVisibility',
                                'sqs:DeleteMessage',
                                'sqs:GetQueueUrl',
                                'sqs:GetQueueAttributes'
                            ],
                            Resource: [
                                cf.join(['arn:', cf.partition, ':sqs:', cf.region, ':', cf.accountId, ':tak-cloudtak-', cf.ref('Environment'), '-layer-*'])
                            ]
                        }]
                    }
                }],
                ManagedPolicyArns: [
                    cf.join(['arn:', cf.partition, ':iam::aws:policy/service-role/AWSLambdaSQSQueueExecutionRole']),
                    cf.join(['arn:', cf.partition, ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'])
                ]
            }
        }
    },
    Outputs: {
        APIURLCNAME: {
            Description: 'Hosted API CNAME target (API ELB)',
            Value: cf.join([cf.getAtt('ELB', 'DNSName'), '.'])
        },
        APIURL: {
            Description: 'Hosted API Location',
            Export: {
                Name: cf.join([cf.stackName, '-hosted'])
            },
            Value: cf.join(['https://map.', cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-hosted-zone-name']))])
        },
        ETLRole: {
            Description: 'ETL Lambda Role',
            Export: {
                Name: cf.join([cf.stackName, '-etl-role'])
            },
            Value: cf.getAtt('ETLFunctionRole', 'Arn')
        }
    }
};
