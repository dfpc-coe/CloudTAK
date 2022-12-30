import cf from '@mapbox/cloudfriend';

export default {
    Resources: {
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
