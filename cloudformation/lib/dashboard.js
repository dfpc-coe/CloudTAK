import cf from '@openaddresses/cloudfriend';

// The red threshold line value below matches the CPU & Memory alarm Threshold in ./alarms.ts (80%)

export default {
    Resources: {
        BatchELBDashboard: {
            Type: 'AWS::CloudWatch::Dashboard',
            Properties: {
                DashboardName: cf.sub('${AWS::StackName}-${AWS::Region}-batchelb'),
                DashboardBody: cf.sub(JSON.stringify({
                    widgets: [{
                        type: 'metric',
                        x: 0,
                        y: 0,
                        width: 24,
                        height: 6,
                        properties: {
                            title: 'HTTP status',
                            view: 'timeSeries',
                            stacked: false,
                            metrics: [
                                ['AWS/ApplicationELB', 'HTTPCode_Target_2XX_Count', 'LoadBalancer', '${LoadBalancerFullName}', { label: '2xx', stat: 'Sum', period: 60, yAxis: 'left' }],
                                ['.', 'HTTPCode_Target_4XX_Count', '.', '.', { label: 'target 4xx', stat: 'Sum', period: 60, yAxis: 'left' }],
                                ['.', 'HTTPCode_ELB_4XX_Count', '.', '.', { label: 'elb 4xx', stat: 'Sum', period: 60, yAxis: 'left' }],
                                ['.', 'HTTPCode_Target_5XX_Count', '.', '.', { label: 'target 5xx', stat: 'Sum', period: 60, yAxis: 'left' }],
                                ['.', 'HTTPCode_ELB_5XX_Count', '.', '.', { label: 'elb 5xx', stat: 'Sum', period: 60, yAxis: 'left' }]
                            ],
                            region: '${AWS::Region}',
                            period: 300,
                            yAxis: {
                                left: { min: 0 },
                                right: { min: 0 }
                            }
                        }
                    }, {
                        type: 'metric',
                        x: 0,
                        y: 6,
                        width: 24,
                        height: 6,
                        properties: {
                            title: 'Hub HTTP status (internal ELB)',
                            view: 'timeSeries',
                            stacked: false,
                            metrics: [
                                ['AWS/ApplicationELB', 'HTTPCode_Target_2XX_Count', 'LoadBalancer', '${HubLoadBalancerFullName}', { label: '2xx', stat: 'Sum', period: 60, yAxis: 'left' }],
                                ['.', 'HTTPCode_Target_4XX_Count', '.', '.', { label: 'target 4xx', stat: 'Sum', period: 60, yAxis: 'left' }],
                                ['.', 'HTTPCode_ELB_4XX_Count', '.', '.', { label: 'elb 4xx', stat: 'Sum', period: 60, yAxis: 'left' }],
                                ['.', 'HTTPCode_Target_5XX_Count', '.', '.', { label: 'target 5xx', stat: 'Sum', period: 60, yAxis: 'left' }],
                                ['.', 'HTTPCode_ELB_5XX_Count', '.', '.', { label: 'elb 5xx', stat: 'Sum', period: 60, yAxis: 'left' }]
                            ],
                            region: '${AWS::Region}',
                            period: 300,
                            yAxis: {
                                left: { min: 0 },
                                right: { min: 0 }
                            }
                        }
                    }, {
                        type: 'metric',
                        x: 0,
                        y: 12,
                        width: 24,
                        height: 6,
                        properties: {
                            title: 'Latency',
                            view: 'timeSeries',
                            stacked: false,
                            metrics: [
                                ['AWS/ApplicationELB', 'TargetResponseTime', 'LoadBalancer', '${LoadBalancerFullName}', { color: '#9467bd', label: 'avg', period: 60 }],
                                ['...', { color: '#c5b0d5', label: 'max', stat: 'Maximum', period: 60 }],
                                ['...', { color: '#c5b0d5', label: 'min', stat: 'Minimum', period: 60 }],
                                ['...', { stat: 'p99', period: 60, label: 'p99', color: '#9edae5' }]
                            ],
                            region: '${AWS::Region}',
                            yAxis: {
                                left: { min: 0 },
                                right: { min: 0 }
                            },
                            period: 300,
                            annotations: {
                                horizontal: [
                                    { color: '#9edae5', label: 'p99 alarm', value: 10 }
                                ]
                            }
                        }
                    }, {
                        type: 'metric',
                        x: 0,
                        y: 18,
                        width: 12,
                        height: 6,
                        properties: {
                            title: 'Service capacity',
                            view: 'timeSeries',
                            stacked: false,
                            metrics: [
                                ['Mapbox/ecs-cluster', 'DesiredCapacity', 'ServiceName', '${ServiceName}', 'ClusterName', '${Cluster}', { label: 'stateless desired', color: '#1f77b4', stat: 'Minimum', period: 60 }],
                                ['.', 'RunningCapacity', '.', '.', '.', '.', { label: 'stateless running', color: '#aec7e8', stat: 'Minimum', period: 60 }],
                                ['AWS/ApplicationELB', 'HealthyHostCount', 'TargetGroup', '${TargetGroupFullName}', 'LoadBalancer', '${LoadBalancerFullName}', { period: 60, stat: 'Minimum', label: 'stateless healthy', color: '#17becf' }],
                                ['Mapbox/ecs-cluster', 'DesiredCapacity', 'ServiceName', '${StatefulServiceName}', 'ClusterName', '${Cluster}', { label: 'stateful desired', color: '#ff7f0e', stat: 'Minimum', period: 60 }],
                                ['.', 'RunningCapacity', '.', '.', '.', '.', { label: 'stateful running', color: '#ffbb78', stat: 'Minimum', period: 60 }],
                                ['AWS/ApplicationELB', 'HealthyHostCount', 'TargetGroup', '${HubTargetGroupFullName}', 'LoadBalancer', '${HubLoadBalancerFullName}', { period: 60, stat: 'Minimum', label: 'stateful healthy', color: '#e7ba52' }]
                            ],
                            region: '${AWS::Region}',
                            period: 300,
                            yAxis: { left: { min: 0 } }
                        }
                    }, {
                        type: 'metric',
                        x: 12,
                        y: 18,
                        width: 6,
                        height: 6,
                        properties: {
                            title: 'Stateless CPU / Memory',
                            view: 'timeSeries',
                            stacked: false,
                            metrics: [
                                ['AWS/ECS', 'CPUUtilization', 'ServiceName', '${ServiceName}', 'ClusterName', '${Cluster}', { label: 'cpu', color: '#1f77b4', period: 60 }],
                                ['.', 'MemoryUtilization', '.', '.', '.', '.', { label: 'memory', color: '#2ca02c', period: 60 }]
                            ],
                            region: '${AWS::Region}',
                            period: 300,
                            yAxis: { left: { min: 0, max: 110 } },
                            annotations: {
                                horizontal: [
                                    { color: '#d62728', label: 'alarm', value: 80 }
                                ]
                            }
                        }
                    }, {
                        type: 'metric',
                        x: 18,
                        y: 18,
                        width: 6,
                        height: 6,
                        properties: {
                            title: 'Stateful CPU / Memory',
                            view: 'timeSeries',
                            stacked: false,
                            metrics: [
                                ['AWS/ECS', 'CPUUtilization', 'ServiceName', '${StatefulServiceName}', 'ClusterName', '${Cluster}', { label: 'cpu', color: '#1f77b4', period: 60 }],
                                ['.', 'MemoryUtilization', '.', '.', '.', '.', { label: 'memory', color: '#2ca02c', period: 60 }]
                            ],
                            region: '${AWS::Region}',
                            period: 300,
                            yAxis: { left: { min: 0, max: 110 } },
                            annotations: {
                                horizontal: [
                                    { color: '#d62728', label: 'alarm', value: 80 }
                                ]
                            }
                        }
                    }, {
                        type: 'log',
                        x: 0,
                        y: 24,
                        width: 24,
                        height: 6,
                        properties: {
                            title: '5XX Requests',
                            query: `
                                SOURCE '$\{Apache\}'
                                | fields @timestamp, @message | sort @timestamp desc
                                | parse @message '* - - [*] "* * *" * * "*" "*" "*"' as client, dateTimeString, httpVerb, url, protocol, statusCode, bytes, referer, userAgent, origIp
                                | filter statusCode >= "500" and statusCode <= 599
                                | display @timestamp, statusCode, httpVerb, url, userAgent, @log, @logStream
                            `,
                            region: '${AWS::Region}',
                            stacked: false,
                            view: 'table'
                        }
                    }, {
                        type: 'log',
                        x: 0,
                        y: 30,
                        width: 24,
                        height: 6,
                        properties: {
                            title: 'Recent Errors',
                            query: `
                                SOURCE '$\{Apache\}'
                                    | fields @timestamp, @message
                                    | sort @timestamp desc
                                    | filter @message like /.*Error:.*/
                                    | display @timestamp, @message, @log, @logStream
                            `,
                            region: '${AWS::Region}',
                            stacked: false,
                            view: 'table'
                        }
                    }]
                }), {
                    LoadBalancerFullName: cf.getAtt('ELB', 'LoadBalancerFullName'),
                    TargetGroupFullName: cf.getAtt('TargetGroup', 'TargetGroupFullName'),
                    HubLoadBalancerFullName: cf.getAtt('HubELB', 'LoadBalancerFullName'),
                    HubTargetGroupFullName: cf.getAtt('HubRpcTargetGroup', 'TargetGroupFullName'),
                    Apache: cf.stackName,
                    ServiceName: cf.getAtt('Service', 'Name'),
                    StatefulServiceName: cf.getAtt('StatefulService', 'Name'),
                    Cluster: cf.join(['tak-vpc-', cf.ref('Environment')])
                })
            }
        },
        BatchDBDashboard: {
            Type: 'AWS::CloudWatch::Dashboard',
            Properties: {
                DashboardName: cf.sub('${AWS::StackName}-${AWS::Region}-db'),
                DashboardBody: cf.sub(JSON.stringify({
                    widgets: [{
                        height: 6,
                        width: 12,
                        y: 0,
                        x: 0,
                        type: 'metric',
                        properties: {
                            view: 'timeSeries',
                            stacked: false,
                            metrics: [
                                ['AWS/RDS', 'FreeStorageSpace', 'DBInstanceIdentifier', '${Instance}']
                            ],
                            region: '${AWS::Region}',
                            title: 'FreeStorageSpace',
                            period: 300,
                            yAxis: { left: { min: 0 } }
                        }
                    }, {
                        height: 6,
                        width: 11,
                        y: 0,
                        x: 12,
                        type: 'metric',
                        properties: {
                            view: 'timeSeries',
                            stacked: false,
                            metrics: [
                                ['AWS/RDS', 'FreeStorageSpace', 'DBInstanceIdentifier', '${Instance}']
                            ],
                            region: '${AWS::Region}',
                            period: 300,
                            yAxis: { left: { min: 0, max: 100 } }
                        }
                    }, {
                        height: 6,
                        width: 11,
                        y: 6,
                        x: 12,
                        type: 'metric',
                        properties: {
                            view: 'timeSeries',
                            stacked: false,
                            metrics: [
                                ['AWS/RDS', 'FreeStorageSpace', 'DBInstanceIdentifier', '${Instance}'],
                                ['.', 'ReadLatency', '.', '.']
                            ],
                            region: '${AWS::Region}'
                        }
                    }, {
                        height: 6,
                        width: 12,
                        y: 6,
                        x: 0,
                        type: 'metric',
                        properties: {
                            view: 'timeSeries',
                            stacked: false,
                            metrics: [
                                ['AWS/RDS', 'FreeStorageSpace', 'DBInstanceIdentifier', '${Instance}']
                            ],
                            region: '${AWS::Region}'
                        }
                    }]
                }), {
                    Instance: cf.ref('DBClusterInstanceA')
                })
            }
        }
    }
};
