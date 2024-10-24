import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        KMSAlias: {
            Type: 'AWS::KMS::Alias',
            Properties: {
                AliasName: cf.join(['alias/', cf.stackName]),
                TargetKeyId: cf.ref('KMS')
            }
        },
        KMS: {
            Type : 'AWS::KMS::Key',
            Properties: {
                Description: cf.stackName,
                Enabled: true,
                EnableKeyRotation: false,
                KeyPolicy: {
                    Id: cf.stackName,
                    Statement: [{
                        Effect: 'Allow',
                        Principal: {
                            AWS: cf.join(['arn:', cf.partition, ':iam::', cf.accountId, ':root'])
                        },
                        Action: ['kms:*'],
                        Resource: '*'
                    }]
                }
            }
        }
    }
};
