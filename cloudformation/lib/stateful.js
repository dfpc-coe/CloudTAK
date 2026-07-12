import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        StatefulLogs: {
            Type: 'AWS::Logs::LogGroup',
            Properties: {
                LogGroupName: cf.join([cf.stackName, '-stateful']),
                RetentionInDays: 7
            }
        },
        StatefulTargetGroup: {
            Type: 'AWS::ElasticLoadBalancingV2::TargetGroup',
            DependsOn: 'ELB',
            Properties: {
                HealthCheckEnabled: true,
                HealthCheckIntervalSeconds: 15,
                HealthCheckTimeoutSeconds: 5,
                HealthyThresholdCount: 2,
                UnhealthyThresholdCount: 3,
                HealthCheckPath: '/api',
                Port: 5000,
                Protocol: 'HTTP',
                TargetType: 'ip',
                VpcId: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-vpc'])),
                Matcher: {
                    HttpCode: '200,202,302,304'
                },
                TargetGroupAttributes: [{
                    Key: 'deregistration_delay.timeout_seconds',
                    Value: '15'
                }]
            }
        },
        StatefulListenerRule: {
            Type: 'AWS::ElasticLoadBalancingV2::ListenerRule',
            Properties: {
                ListenerArn: cf.ref('HttpsListener'),
                Priority: 10,
                Conditions: [{
                    Field: 'http-header',
                    HttpHeaderConfig: {
                        HttpHeaderName: 'Upgrade',
                        Values: ['websocket']
                    }
                },{
                    Field: 'path-pattern',
                    PathPatternConfig: {
                        Values: ['/api']
                    }
                }],
                Actions: [{
                    Type: 'forward',
                    TargetGroupArn: cf.ref('StatefulTargetGroup')
                }]
            }
        },
        HubELB: {
            Type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
            Properties: {
                Name: cf.join('-', [cf.stackName, 'hub']),
                Type: 'application',
                Scheme: 'internal',
                SecurityGroups: [cf.ref('HubELBSecurityGroup')],
                Subnets: [
                    cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-subnet-private-a'])),
                    cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-subnet-private-b']))
                ]
            }
        },
        HubELBSecurityGroup: {
            Type: 'AWS::EC2::SecurityGroup',
            Properties: {
                Tags: [{
                    Key: 'Name',
                    Value: cf.join('-', [cf.stackName, 'hub-elb-sg'])
                }],
                GroupName: cf.join('-', [cf.stackName, 'hub-elb-sg']),
                GroupDescription: 'Internal hub RPC access from the stateless API service',
                VpcId: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-vpc'])),
                SecurityGroupIngress: [{
                    Description: 'Hub RPC from stateless API tasks',
                    IpProtocol: 'tcp',
                    SourceSecurityGroupId: cf.ref('ServiceSecurityGroup'),
                    FromPort: 80,
                    ToPort: 80
                }]
            }
        },
        HubListener: {
            Type: 'AWS::ElasticLoadBalancingV2::Listener',
            Properties: {
                DefaultActions: [{
                    Type: 'forward',
                    TargetGroupArn: cf.ref('HubRpcTargetGroup')
                }],
                LoadBalancerArn: cf.ref('HubELB'),
                Port: 80,
                Protocol: 'HTTP'
            }
        },
        HubRpcTargetGroup: {
            Type: 'AWS::ElasticLoadBalancingV2::TargetGroup',
            DependsOn: 'HubELB',
            Properties: {
                HealthCheckEnabled: true,
                HealthCheckIntervalSeconds: 15,
                HealthCheckTimeoutSeconds: 5,
                HealthyThresholdCount: 2,
                UnhealthyThresholdCount: 3,
                HealthCheckPath: '/hub',
                Port: 5002,
                Protocol: 'HTTP',
                TargetType: 'ip',
                VpcId: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-vpc'])),
                Matcher: {
                    HttpCode: '200'
                },
                TargetGroupAttributes: [{
                    Key: 'deregistration_delay.timeout_seconds',
                    Value: '30'
                }]
            }
        },
        StatefulTaskDefinition: {
            Type: 'AWS::ECS::TaskDefinition',
            DependsOn: ['SigningSecret', 'GeofenceSecret'],
            Properties: {
                Family: cf.join([cf.stackName, '-stateful']),
                Cpu: cf.ref('ComputeCpu'),
                Memory: cf.ref('ComputeMemory'),
                NetworkMode: 'awsvpc',
                RequiresCompatibilities: ['FARGATE'],
                Tags: [{
                    Key: 'Name',
                    Value: cf.join('-', [cf.stackName, 'stateful'])
                }],
                ExecutionRoleArn: cf.getAtt('ExecRole', 'Arn'),
                TaskRoleArn: cf.getAtt('TaskRole', 'Arn'),
                ContainerDefinitions: [{
                    Name: 'api',
                    Image: cf.join([cf.accountId, '.dkr.ecr.', cf.region, '.amazonaws.com/tak-vpc-', cf.ref('Environment'), '-cloudtak-api:', cf.ref('GitSha')]),
                    Command: ['npm', 'run', 'prod'],
                    PortMappings: [{
                        ContainerPort: 5000
                    },{
                        ContainerPort: 5002
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
                        { Name: 'PORT', Value: '5000' },
                        { Name: 'HUB_RPC_PORT', Value: '5002' },
                        { Name: 'CLOUDTAK_Server_Mode', Value: 'hub' },
                        { Name: 'AWS_REGION', Value: cf.region },
                        { Name: 'ECR_TASKS_REPOSITORY_NAME', Value: cf.join(['tak-vpc-', cf.ref('Environment'), '-cloudtak-tasks']) },
                        { Name: 'CLOUDTAK_Mode', Value: 'AWS' },
                        { Name: 'StackName', Value: cf.stackName },
                        { Name: 'ASSET_BUCKET', Value: cf.ref('AssetBucket') },
                        { Name: 'API_URL', Value: cf.join(['https://map.', cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-hosted-zone-name']))]) },
                        { Name: 'VpcId', Value: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-vpc'])) },
                        { Name: 'SubnetPublicA', Value: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-subnet-public-a'])) },
                        { Name: 'SubnetPublicB', Value: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-subnet-public-b'])) },
                        { Name: 'MediaSecurityGroup', Value: cf.ref('MediaSecurityGroup') },
                        { Name: 'CLOUDTAK_Config_geofence_password', Value: cf.sub('{{resolve:secretsmanager:${AWS::StackName}/api/geofence}}') }
                    ],
                    RestartPolicy: {
                        Enabled: true,
                        RestartAttemptPeriod: 300
                    },
                    LogConfiguration: {
                        LogDriver: 'awslogs',
                        Options: {
                            'awslogs-group': cf.join([cf.stackName, '-stateful']),
                            'awslogs-region': cf.region,
                            'awslogs-stream-prefix': cf.stackName,
                            'awslogs-create-group': true
                        }
                    },
                    Essential: true
                }]
            }
        },
        StatefulService: {
            Type: 'AWS::ECS::Service',
            DependsOn: ['StatefulListenerRule', 'HubListener'],
            Properties: {
                ServiceName: cf.join('-', [cf.stackName, 'stateful']),
                Cluster: cf.join(['tak-vpc-', cf.ref('Environment')]),
                TaskDefinition: cf.ref('StatefulTaskDefinition'),
                LaunchType: 'FARGATE',
                PropagateTags: 'SERVICE',
                EnableExecuteCommand: cf.ref('EnableExecute'),
                HealthCheckGracePeriodSeconds: 300,
                DesiredCount: 1,
                DeploymentConfiguration: {
                    MaximumPercent: 100,
                    MinimumHealthyPercent: 0,
                    DeploymentCircuitBreaker: {
                        Enable: true,
                        Rollback: true
                    }
                },
                NetworkConfiguration: {
                    AwsvpcConfiguration: {
                        AssignPublicIp: 'ENABLED',
                        SecurityGroups: [cf.ref('StatefulServiceSecurityGroup')],
                        Subnets: [
                            cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-subnet-public-a'])),
                            cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-subnet-public-b']))
                        ]
                    }
                },
                LoadBalancers: [{
                    ContainerName: 'api',
                    ContainerPort: 5000,
                    TargetGroupArn: cf.ref('StatefulTargetGroup')
                },{
                    ContainerName: 'api',
                    ContainerPort: 5002,
                    TargetGroupArn: cf.ref('HubRpcTargetGroup')
                }]
            }
        },
        StatefulServiceSecurityGroup: {
            Type: 'AWS::EC2::SecurityGroup',
            Properties: {
                Tags: [{
                    Key: 'Name',
                    Value: cf.join('-', [cf.stackName, 'stateful-sg'])
                }],
                GroupName: cf.join('-', [cf.stackName, 'stateful-sg']),
                GroupDescription: 'WebSocket traffic from the ELB and hub RPC from the internal ALB',
                VpcId: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-vpc'])),
                SecurityGroupIngress: [{
                    Description: 'ELB WebSocket Traffic',
                    IpProtocol: 'tcp',
                    SourceSecurityGroupId: cf.ref('ELBSecurityGroup'),
                    FromPort: 5000,
                    ToPort: 5000
                },{
                    Description: 'Hub RPC from internal ALB',
                    IpProtocol: 'tcp',
                    SourceSecurityGroupId: cf.ref('HubELBSecurityGroup'),
                    FromPort: 5002,
                    ToPort: 5002
                }]
            }
        }
    }
};
