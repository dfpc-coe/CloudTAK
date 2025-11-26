import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        GeofenceSecret: {
            Type: 'AWS::SecretsManager::Secret',
            DeletionPolicy: 'Retain',
            Properties: {
                Description: cf.join([cf.stackName, ' Geofence Secret']),
                GenerateSecretString: {
                    ExcludePunctuation: true,
                    PasswordLength: 32
                },
                Name: cf.join([cf.stackName, '/api/geofence']),
                KmsKeyId: cf.ref('KMS')
            }
        },
        SigningSecret: {
            Type: 'AWS::SecretsManager::Secret',
            DeletionPolicy: 'Retain',
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
