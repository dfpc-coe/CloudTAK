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

        /*
         * The Hook lambda delivers CoT messages to Sinks via an SQS FiFo queue
         * In the rare event a message fails to be "successful" it can back up the queue
         * Messages that fail to deliver are still marked successful and if logging is enabled
         * a custom CloudWatch Metric records the failure
         *
         * The thought process here is that an individual CoT message is not that important
         * as another update is close behind it if a single given message fails
         */
        HookBacklogAlarm: {
            Type: 'AWS::CloudWatch::Alarm',
            Properties: {
                AlarmName: cf.join('-', [cf.stackName, 'HookBacklog']),
                Namespace: 'AWS/SQS',
                MetricName: 'ApproximateNumberOfMessagesVisible',
                ComparisonOperator: 'GreaterThanThreshold',
                Threshold: 10000,
                EvaluationPeriods: 5,
                Statistic: 'Maximum',
                Period: 60,
                AlarmActions: [cf.ref('HighUrgencyAlarmTopic')],
                InsufficientDataActions: [cf.ref('HighUrgencyAlarmTopic')],
                Dimensions: [{
                    Name: 'QueueName',
                    Value: cf.getAtt('HookDeadQueue', 'QueueName')
                }]
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
                InsufficientDataActions: [cf.ref('HighUrgencyAlarmTopic')],
                Dimensions: [{
                    Name: 'FunctionName',
                    Value: cf.join([cf.stackName, '-events'])
                }]
            }
        }
    }
};
