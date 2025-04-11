import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        MediaSecret: {
            Type: 'AWS::SecretsManager::Secret',
            Properties: {
                Description: cf.join([cf.stackName, ' Media Secret']),
                GenerateSecretString: {
                    ExcludePunctuation: true,
                    PasswordLength: 16
                },
                Name: cf.join([cf.stackName, '/api/media']),
                KmsKeyId: cf.ref('KMS')
            }
        },
        SigningSecret: {
            Type: 'AWS::SecretsManager::Secret',
            Properties: {
                Description: cf.join([cf.stackName, ' Signing Secret']),
                GenerateSecretString: {
                    ExcludePunctuation: true,
                    PasswordLength: 32
                },
                Name: cf.join([cf.stackName, '/api/secret']),
                KmsKeyId: cf.ref('KMS')
            }
        }
    }
};
