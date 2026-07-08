import cf from '@openaddresses/cloudfriend';

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
        BatchELBMemoryAlarm: {
            Type: 'AWS::CloudWatch::Alarm',
            Properties: {
                AlarmName: cf.join('-', [cf.stackName, 'MemoryUtilization', cf.region, 'batchelb']),
                Namespace: 'AWS/ECS',
                MetricName: 'MemoryUtilization',
                ComparisonOperator: 'GreaterThanThreshold',
                Threshold: 80,
                EvaluationPeriods: 10,
                Statistic: 'Average',
                Period: 60,
                AlarmActions: [cf.ref('HighUrgencyAlarmTopic')],
                InsufficientDataActions: [cf.ref('HighUrgencyAlarmTopic')],
                Dimensions: [{
                    Name: 'ClusterName',
                    Value: cf.join(['tak-vpc-', cf.ref('Environment')])
                }, {
                    Name: 'ServiceName',
                    Value: cf.getAtt('Service', 'Name')
                }]
            }
        },
        BatchELBCpuAlarm: {
            Type: 'AWS::CloudWatch::Alarm',
            Properties: {
                AlarmName: cf.join('-', [cf.stackName, 'CPUUtilization', cf.region, 'batchelb']),
                Namespace: 'AWS/ECS',
                MetricName: 'CPUUtilization',
                ComparisonOperator: 'GreaterThanThreshold',
                Threshold: 80,
                EvaluationPeriods: 10,
                Statistic: 'Average',
                Period: 60,
                AlarmActions: [cf.ref('HighUrgencyAlarmTopic')],
                InsufficientDataActions: [cf.ref('HighUrgencyAlarmTopic')],
                Dimensions: [{
                    Name: 'ClusterName',
                    Value: cf.join(['tak-vpc-', cf.ref('Environment')])
                }, {
                    Name: 'ServiceName',
                    Value: cf.getAtt('Service', 'Name')
                }]
            }
        },
        BatchELBAlarmHTTPCodeELB5XX: {
            Type: 'AWS::CloudWatch::Alarm',
            Properties: {
                AlarmName: cf.join('-', [cf.stackName, 'AlarmHTTPCodeELB5XX', cf.region, 'batchelb']),
                MetricName: 'HTTPCode_ELB_5XX_Count',
                Namespace: 'AWS/ApplicationELB',
                Statistic: 'Sum',
                Period: 60,
                EvaluationPeriods: 2,
                Threshold: 1,
                AlarmActions: [cf.ref('HighUrgencyAlarmTopic')],
                InsufficientDataActions: [cf.ref('HighUrgencyAlarmTopic')],
                Dimensions: [{
                    Name: 'LoadBalancer',
                    Value: cf.getAtt('ELB', 'LoadBalancerFullName')
                }],
                TreatMissingData: 'notBreaching',
                ComparisonOperator: 'GreaterThanThreshold'
            }
        },
        BatchELBAlarmHTTPCodeBackend5XX: {
            Type: 'AWS::CloudWatch::Alarm',
            Properties: {
                AlarmName: cf.join('-', [cf.stackName, 'AlarmHTTPCodeBackend5XX', cf.region, 'batchelb']),
                MetricName: 'HTTPCode_Target_5XX_Count',
                Namespace: 'AWS/ApplicationELB',
                Statistic: 'Sum',
                Period: 60,
                EvaluationPeriods: 2,
                Threshold: 1,
                AlarmActions: [cf.ref('HighUrgencyAlarmTopic')],
                InsufficientDataActions: [cf.ref('HighUrgencyAlarmTopic')],
                Dimensions: [{
                    Name: 'LoadBalancer',
                    Value: cf.getAtt('ELB', 'LoadBalancerFullName')
                }],
                TreatMissingData: 'notBreaching',
                ComparisonOperator: 'GreaterThanThreshold'
            }
        },
        BatchELBAlarmHTTPCodeBackend5XXDuration: {
            Type: 'AWS::CloudWatch::Alarm',
            Properties: {
                AlarmName: cf.join('-', [cf.stackName, 'AlarmHTTPCodeBackend5XXDuration', cf.region, 'batchelb']),
                MetricName: 'HTTPCode_Target_5XX_Count',
                Namespace: 'AWS/ApplicationELB',
                Statistic: 'Sum',
                Period: 300,
                EvaluationPeriods: 4,
                Threshold: 5,
                AlarmActions: [cf.ref('HighUrgencyAlarmTopic')],
                InsufficientDataActions: [cf.ref('HighUrgencyAlarmTopic')],
                Dimensions: [{
                    Name: 'LoadBalancer',
                    Value: cf.getAtt('ELB', 'LoadBalancerFullName')
                }],
                TreatMissingData: 'notBreaching',
                ComparisonOperator: 'GreaterThanThreshold'
            }
        },
        BatchELBAlarmP99Latency: {
            Type: 'AWS::CloudWatch::Alarm',
            Properties: {
                AlarmName: cf.join('-', [cf.stackName, 'AlarmP99Latency', cf.region, 'batchelb']),
                MetricName: 'TargetResponseTime',
                Namespace: 'AWS/ApplicationELB',
                ExtendedStatistic: 'p99',
                Period: '60',
                EvaluationPeriods: '5',
                Threshold: '10',
                AlarmActions: [cf.ref('HighUrgencyAlarmTopic')],
                InsufficientDataActions: [cf.ref('HighUrgencyAlarmTopic')],
                Dimensions: [{
                    Name: 'LoadBalancer',
                    Value: cf.getAtt('ELB', 'LoadBalancerFullName')
                }],
                ComparisonOperator: 'GreaterThanThreshold'
            }
        },
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
                AlarmActions: [cf.ref('HighUrgencyAlarmTopic')],
                InsufficientDataActions: [cf.ref('HighUrgencyAlarmTopic')],
                Dimensions: [{
                    Name: 'DBInstanceIdentifier',
                    Value: cf.ref('DBClusterInstanceA')
                }]
            }
        },
        BatchDBFreeStorage: {
            Type: 'AWS::CloudWatch::Alarm',
            Properties: {
                AlarmName: cf.join('-', [cf.stackName, 'DBFreeStorage', cf.region]),
                Namespace: 'AWS/RDS',
                MetricName: 'FreeStorageSpace',
                ComparisonOperator: 'LessThanThreshold',
                Threshold: 10737418240,
                EvaluationPeriods: 10,
                Statistic: 'Average',
                Period: 60,
                AlarmActions: [cf.ref('HighUrgencyAlarmTopic')],
                InsufficientDataActions: [cf.ref('HighUrgencyAlarmTopic')],
                Dimensions: [{
                    Name: 'DBInstanceIdentifier',
                    Value: cf.ref('DBClusterInstanceA')
                }]
            }
        }
    }
};
