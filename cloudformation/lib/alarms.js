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

        EventAlarm: {
            Type: 'AWS::CloudWatch::Alarm',
            Properties: {
                AlarmName: cf.join('-', [cf.stackName, 'EventLambda']),
                Namespace: 'AWS/Lambda',
                MetricName: 'Errors',
                ComparisonOperator: 'GreaterThanThreshold',
                Threshold: 0,
                EvaluationPeriods: 1,
                Statistic: 'Maximum',
                Period: 60,
                AlarmActions: [cf.ref('HighUrgencyAlarmTopic')],
                Dimensions: [{
                    Name: 'FunctionName',
                    Value: cf.join([cf.stackName, '-events'])
                }]
            }
        }
    }
};
