import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        StackHook: {
            Type : 'AWS::SNS::Topic',
            Properties : {
                DisplayName: cf.join([cf.stackName, ' Layer CloudFormation Events']),
                TopicName: cf.join([cf.stackName, '-stack-events']),
                Subscription: [{
                    Endpoint: cf.getAtt('StackHookQueue', 'Arn'),
                    Protocol: 'sqs'
                }]
            }
        },
        StackHookQueuePolicy: {
            Type: 'AWS::SQS::QueuePolicy',
            Properties: {
                Queues: [cf.ref('StackHookQueue')],
                PolicyDocument: {
                    'Statement':[{
                        Action: ['SQS:SendMessage'],
                        Effect: 'Allow',
                        Resource: cf.getAtt('StackHookQueue', 'Arn'),
                        Principal: {
                            Service: 'sns.amazonaws.com'
                        }
                    }]
                }
            }
        },
        StackHookQueue: {
            Type: 'AWS::SQS::Queue',
            Properties: {
                QueueName: cf.join([cf.stackName, '-stack-events']),
                VisibilityTimeout: 900
            }
        },
        StackHookQueueLambdaPermission: {
            Type: 'AWS::Lambda::Permission',
            Properties: {
                Action: 'lambda:InvokeFunction',
                FunctionName: cf.getAtt('EventLambda', 'Arn'),
                Principal: 'sqs.amazonaws.com',
                SourceArn: cf.getAtt('StackHookQueue', 'Arn'),
                SourceAccount: cf.accountId
            }
        },
        StackHookLambdaSource: {
            Type: 'AWS::Lambda::EventSourceMapping',
            Properties: {
                Enabled: 'True',
                EventSourceArn:  cf.getAtt('StackHookQueue', 'Arn'),
                FunctionName: cf.ref('EventLambda')
            }
        }
    }
};
