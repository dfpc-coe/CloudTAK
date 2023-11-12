import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        StackHook: {
            Type : "AWS::SNS::Topic",
            Properties : {
                DisplayName: cf.join([cf.stackName, ' Layer CloudFormation Events']),
                TopicName: cf.join([cf.stackName, '-stack-events']),
                Subscription: [{
                    Endpoint: cf.getAtt('StackHookQueue', 'Arn')
                    Protocol: 'sqs'
                }]
            }
        },
        StackHookQueue: {
            Type: 'AWS::SQS::Queue',
            Properties: {
                QueueName: cf.join([cf.stackName, '-stack-events']),
            }
        }
    }
};
