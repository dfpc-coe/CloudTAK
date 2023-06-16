import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        HookQueue: {
            Type: 'AWS::SQS::Queue',
            Properties: {
                QueueName: cf.join('-', [cf.stackName, 'hooks.fifo']),
                FifoQueue: true,
            }
        }
    }
};
