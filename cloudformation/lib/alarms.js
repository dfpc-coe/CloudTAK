import cf from '@openaddresses/cloudfriend';

const HIGH = [cf.ref('HighUrgencyAlarmTopic')];

function ecsAlarms(prefix, suffix, service) {
    const dims = [{
        Name: 'ClusterName',
        Value: cf.join(['tak-vpc-', cf.ref('Environment')])
    }, {
        Name: 'ServiceName',
        Value: cf.getAtt(service, 'Name')
    }];

    return {
        [`${prefix}MemoryAlarm`]: {
            Type: 'AWS::CloudWatch::Alarm',
            Properties: {
                AlarmName: cf.join('-', [cf.stackName, 'MemoryUtilization', cf.region, suffix]),
                Namespace: 'AWS/ECS',
                MetricName: 'MemoryUtilization',
                ComparisonOperator: 'GreaterThanThreshold',
                Threshold: 80,
                EvaluationPeriods: 10,
                Statistic: 'Average',
                Period: 60,
                AlarmActions: HIGH,
                InsufficientDataActions: HIGH,
                Dimensions: dims
            }
        },
        [`${prefix}CpuAlarm`]: {
            Type: 'AWS::CloudWatch::Alarm',
            Properties: {
                AlarmName: cf.join('-', [cf.stackName, 'CPUUtilization', cf.region, suffix]),
                Namespace: 'AWS/ECS',
                MetricName: 'CPUUtilization',
                ComparisonOperator: 'GreaterThanThreshold',
                Threshold: 80,
                EvaluationPeriods: 10,
                Statistic: 'Average',
                Period: 60,
                AlarmActions: HIGH,
                InsufficientDataActions: HIGH,
                Dimensions: dims
            }
        }
    };
}

function elbAlarms(prefix, suffix, elb) {
    const dims = [{
        Name: 'LoadBalancer',
        Value: cf.getAtt(elb, 'LoadBalancerFullName')
    }];

    return {
        [`${prefix}AlarmHTTPCodeELB5XX`]: {
            Type: 'AWS::CloudWatch::Alarm',
            Properties: {
                AlarmName: cf.join('-', [cf.stackName, 'AlarmHTTPCodeELB5XX', cf.region, suffix]),
                MetricName: 'HTTPCode_ELB_5XX_Count',
                Namespace: 'AWS/ApplicationELB',
                Statistic: 'Sum',
                Period: 60,
                EvaluationPeriods: 2,
                Threshold: 1,
                AlarmActions: HIGH,
                InsufficientDataActions: HIGH,
                Dimensions: dims,
                TreatMissingData: 'notBreaching',
                ComparisonOperator: 'GreaterThanThreshold'
            }
        },
        [`${prefix}AlarmHTTPCodeBackend5XX`]: {
            Type: 'AWS::CloudWatch::Alarm',
            Properties: {
                AlarmName: cf.join('-', [cf.stackName, 'AlarmHTTPCodeBackend5XX', cf.region, suffix]),
                MetricName: 'HTTPCode_Target_5XX_Count',
                Namespace: 'AWS/ApplicationELB',
                Statistic: 'Sum',
                Period: 60,
                EvaluationPeriods: 2,
                Threshold: 1,
                AlarmActions: HIGH,
                InsufficientDataActions: HIGH,
                Dimensions: dims,
                TreatMissingData: 'notBreaching',
                ComparisonOperator: 'GreaterThanThreshold'
            }
        },
        [`${prefix}AlarmHTTPCodeBackend5XXDuration`]: {
            Type: 'AWS::CloudWatch::Alarm',
            Properties: {
                AlarmName: cf.join('-', [cf.stackName, 'AlarmHTTPCodeBackend5XXDuration', cf.region, suffix]),
                MetricName: 'HTTPCode_Target_5XX_Count',
                Namespace: 'AWS/ApplicationELB',
                Statistic: 'Sum',
                Period: 300,
                EvaluationPeriods: 4,
                Threshold: 5,
                AlarmActions: HIGH,
                InsufficientDataActions: HIGH,
                Dimensions: dims,
                TreatMissingData: 'notBreaching',
                ComparisonOperator: 'GreaterThanThreshold'
            }
        },
        [`${prefix}AlarmP99Latency`]: {
            Type: 'AWS::CloudWatch::Alarm',
            Properties: {
                AlarmName: cf.join('-', [cf.stackName, 'AlarmP99Latency', cf.region, suffix]),
                MetricName: 'TargetResponseTime',
                Namespace: 'AWS/ApplicationELB',
                ExtendedStatistic: 'p99',
                Period: 60,
                EvaluationPeriods: 5,
                Threshold: 10,
                AlarmActions: HIGH,
                InsufficientDataActions: HIGH,
                Dimensions: dims,
                ComparisonOperator: 'GreaterThanThreshold'
            }
        }
    };
}

function healthyHostAlarm(prefix, suffix, targetGroup, elb) {
    return {
        [`${prefix}HealthyHostAlarm`]: {
            Type: 'AWS::CloudWatch::Alarm',
            Properties: {
                AlarmName: cf.join('-', [cf.stackName, 'HealthyHostCount', cf.region, suffix]),
                Namespace: 'AWS/ApplicationELB',
                MetricName: 'HealthyHostCount',
                ComparisonOperator: 'LessThanThreshold',
                Threshold: 1,
                EvaluationPeriods: 2,
                Statistic: 'Minimum',
                Period: 60,
                AlarmActions: HIGH,
                InsufficientDataActions: HIGH,
                TreatMissingData: 'breaching',
                Dimensions: [{
                    Name: 'TargetGroup',
                    Value: cf.getAtt(targetGroup, 'TargetGroupFullName')
                }, {
                    Name: 'LoadBalancer',
                    Value: cf.getAtt(elb, 'LoadBalancerFullName')
                }]
            }
        }
    };
}

export default {
    Resources: {
        HighUrgencyAlarmTopic: {
            Type: 'AWS::SNS::Topic',
            Properties: {
                DisplayName: cf.join([cf.stackName, '-high-urgency']),
                TopicName: cf.join([cf.stackName, '-high-urgency'])
            }
        },
        LowUrgencyAlarmTopic: {
            Type: 'AWS::SNS::Topic',
            Properties: {
                DisplayName: cf.join([cf.stackName, '-low-urgency']),
                TopicName: cf.join([cf.stackName, '-low-urgency'])
            }
        },

        ...ecsAlarms('BatchELB', 'batchelb', 'Service'),
        ...ecsAlarms('Stateful', 'stateful', 'StatefulService'),

        ...elbAlarms('BatchELB', 'batchelb', 'ELB'),
        ...elbAlarms('HubELB', 'hub', 'HubELB'),

        ...healthyHostAlarm('BatchELB', 'batchelb', 'TargetGroup', 'ELB'),
        ...healthyHostAlarm('Stateful', 'stateful', 'StatefulTargetGroup', 'ELB'),
        ...healthyHostAlarm('HubELB', 'hub', 'HubRpcTargetGroup', 'HubELB'),

        BatchDBCpuAlarm: {
            Type: 'AWS::CloudWatch::Alarm',
            Properties: {
                AlarmName: cf.join('-', [cf.stackName, 'DBCPUUtilization', cf.region]),
                Namespace: 'AWS/RDS',
                MetricName: 'CPUUtilization',
                ComparisonOperator: 'GreaterThanThreshold',
                Threshold: 80,
                EvaluationPeriods: 10,
                Statistic: 'Average',
                Period: 60,
                AlarmActions: HIGH,
                InsufficientDataActions: HIGH,
                Dimensions: [{
                    Name: 'DBInstanceIdentifier',
                    Value: cf.ref('DBClusterInstanceA')
                }]
            }
        },

        PMTilesLambdaErrorsAlarm: {
            Type: 'AWS::CloudWatch::Alarm',
            Properties: {
                AlarmName: cf.join('-', [cf.stackName, 'PMTilesLambdaErrors', cf.region]),
                Namespace: 'AWS/Lambda',
                MetricName: 'Errors',
                ComparisonOperator: 'GreaterThanThreshold',
                Threshold: 0,
                EvaluationPeriods: 2,
                Statistic: 'Sum',
                Period: 60,
                AlarmActions: HIGH,
                TreatMissingData: 'notBreaching',
                Dimensions: [{
                    Name: 'FunctionName',
                    Value: cf.ref('PMTilesLambda')
                }]
            }
        },
        PMTilesLambdaThrottlesAlarm: {
            Type: 'AWS::CloudWatch::Alarm',
            Properties: {
                AlarmName: cf.join('-', [cf.stackName, 'PMTilesLambdaThrottles', cf.region]),
                Namespace: 'AWS/Lambda',
                MetricName: 'Throttles',
                ComparisonOperator: 'GreaterThanThreshold',
                Threshold: 0,
                EvaluationPeriods: 2,
                Statistic: 'Sum',
                Period: 60,
                AlarmActions: HIGH,
                TreatMissingData: 'notBreaching',
                Dimensions: [{
                    Name: 'FunctionName',
                    Value: cf.ref('PMTilesLambda')
                }]
            }
        },
        PMTilesLambdaDurationAlarm: {
            Type: 'AWS::CloudWatch::Alarm',
            Properties: {
                AlarmName: cf.join('-', [cf.stackName, 'PMTilesLambdaDuration', cf.region]),
                Namespace: 'AWS/Lambda',
                MetricName: 'Duration',
                ComparisonOperator: 'GreaterThanThreshold',
                Threshold: 50000,
                EvaluationPeriods: 5,
                ExtendedStatistic: 'p99',
                Period: 60,
                AlarmActions: HIGH,
                TreatMissingData: 'notBreaching',
                Dimensions: [{
                    Name: 'FunctionName',
                    Value: cf.ref('PMTilesLambda')
                }]
            }
        },
        PMTilesApi5XXAlarm: {
            Type: 'AWS::CloudWatch::Alarm',
            Properties: {
                AlarmName: cf.join('-', [cf.stackName, 'PMTilesApi5XX', cf.region]),
                Namespace: 'AWS/ApiGateway',
                MetricName: '5xx',
                ComparisonOperator: 'GreaterThanThreshold',
                Threshold: 1,
                EvaluationPeriods: 2,
                Statistic: 'Sum',
                Period: 60,
                AlarmActions: HIGH,
                TreatMissingData: 'notBreaching',
                Dimensions: [{
                    Name: 'ApiId',
                    Value: cf.ref('PMTilesLambdaAPIV2')
                }, {
                    Name: 'Stage',
                    Value: '$default'
                }]
            }
        },
        PMTilesApiLatencyAlarm: {
            Type: 'AWS::CloudWatch::Alarm',
            Properties: {
                AlarmName: cf.join('-', [cf.stackName, 'PMTilesApiP99Latency', cf.region]),
                Namespace: 'AWS/ApiGateway',
                MetricName: 'IntegrationLatency',
                ComparisonOperator: 'GreaterThanThreshold',
                Threshold: 10000,
                EvaluationPeriods: 5,
                ExtendedStatistic: 'p99',
                Period: 60,
                AlarmActions: HIGH,
                TreatMissingData: 'notBreaching',
                Dimensions: [{
                    Name: 'ApiId',
                    Value: cf.ref('PMTilesLambdaAPIV2')
                }, {
                    Name: 'Stage',
                    Value: '$default'
                }]
            }
        },

        RetentionFailedInvocationsAlarm: {
            Type: 'AWS::CloudWatch::Alarm',
            Properties: {
                AlarmName: cf.join('-', [cf.stackName, 'RetentionFailedInvocations', cf.region]),
                Namespace: 'AWS/Events',
                MetricName: 'FailedInvocations',
                ComparisonOperator: 'GreaterThanThreshold',
                Threshold: 0,
                EvaluationPeriods: 1,
                Statistic: 'Sum',
                Period: 300,
                AlarmActions: HIGH,
                TreatMissingData: 'notBreaching',
                Dimensions: [{
                    Name: 'RuleName',
                    Value: cf.ref('RetentionSchedule')
                }]
            }
        },
        RetentionErrorMetricFilter: {
            Type: 'AWS::Logs::MetricFilter',
            Properties: {
                LogGroupName: cf.ref('RetentionLogs'),
                FilterPattern: '"error -"',
                MetricTransformations: [{
                    MetricName: cf.join([cf.stackName, '-retention-errors']),
                    MetricNamespace: cf.stackName,
                    MetricValue: '1',
                    DefaultValue: 0,
                    Unit: 'Count'
                }]
            }
        },
        RetentionErrorsAlarm: {
            Type: 'AWS::CloudWatch::Alarm',
            DependsOn: 'RetentionErrorMetricFilter',
            Properties: {
                AlarmName: cf.join('-', [cf.stackName, 'RetentionErrors', cf.region]),
                Namespace: cf.stackName,
                MetricName: cf.join([cf.stackName, '-retention-errors']),
                ComparisonOperator: 'GreaterThanThreshold',
                Threshold: 0,
                EvaluationPeriods: 1,
                Statistic: 'Sum',
                Period: 300,
                AlarmActions: HIGH,
                TreatMissingData: 'notBreaching'
            }
        }
    }
};
