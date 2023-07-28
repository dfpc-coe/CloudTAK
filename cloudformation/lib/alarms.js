import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        AlarmTopic: {
            Type: 'AWS::SNS::Topic',
            Properties: {
                TopicName: cf.stackName,
            }
        }
    }
};
