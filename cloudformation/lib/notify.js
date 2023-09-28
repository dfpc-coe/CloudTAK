import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        NotifySNS: {
            Type: 'AWS::SNS::Topic',
            DependsOn: ['HookQueue'],
            Properties: {
                DisplayName: cf.join('-', [cf.stackName, 'cloudformation-notification'])
                Subscription: [{
                    Protocol: 'sqs',
                    Endpoint: cf.getAtt('HookQueue', 'Arn')
                }],
                TopicName: cf.join('-', [cf.stackName, 'cloudformation-notification'])
            }
        }
    }
};
