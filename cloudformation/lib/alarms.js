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
    }
};
