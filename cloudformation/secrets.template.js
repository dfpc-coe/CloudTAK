import cf from '@openaddresses/cloudfriend';

const SECRETS = {
    FirebaseIOS: {
        path: 'firebase/ios',
        description: 'Contents of app/ios/App/GoogleService-Info.plist'
    },
    FirebaseAndroid: {
        path: 'firebase/android',
        description: 'Contents of app/android/app/google-services.json'
    },
    AndroidKeystore: {
        path: 'android/keystore',
        description: 'Binary Android upload keystore (.jks)'
    },
    AndroidSigning: {
        path: 'android/signing',
        description: 'JSON: { storePassword, keyAlias, keyPassword } for the Android upload keystore'
    },
    AppleCertificate: {
        path: 'apple/certificate',
        description: 'Binary Apple distribution certificate (.p12)'
    },
    AppleSigning: {
        path: 'apple/signing',
        description: 'JSON: { certificatePassword, teamId, apiKeyId, apiIssuerId, apiKey } for Apple signing and App Store Connect'
    }
};

const Resources = {};
const Outputs = {};

for (const [name, secret] of Object.entries(SECRETS)) {
    Resources[`${name}Secret`] = {
        Type: 'AWS::SecretsManager::Secret',
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
        Properties: {
            Name: cf.join([cf.stackName, '/', secret.path]),
            Description: secret.description,
            KmsKeyId: cf.ref('KMS')
        }
    };

    Outputs[`${name}Secret`] = {
        Description: secret.description,
        Value: cf.ref(`${name}Secret`)
    };
}

export default cf.merge({
    Description: 'Mobile & Desktop app build secrets for CloudTAK',
    Parameters: {
        GithubRepo: {
            Description: 'GitHub org/repo whose tag builds may read the secrets. Leave empty to skip creating the GitHub Actions role',
            Type: 'String',
            Default: 'dfpc-coe/CloudTAK',
            AllowedPattern: '^([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)?$'
        }
    },
    Conditions: {
        HasGithubRepo: cf.notEquals(cf.ref('GithubRepo'), '')
    },
    Resources: {
        KMSAlias: {
            Type: 'AWS::KMS::Alias',
            Properties: {
                AliasName: cf.join(['alias/', cf.stackName]),
                TargetKeyId: cf.ref('KMS')
            }
        },
        KMS: {
            Type: 'AWS::KMS::Key',
            Properties: {
                Description: cf.stackName,
                Enabled: true,
                EnableKeyRotation: true,
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
        },
        GithubRole: {
            Type: 'AWS::IAM::Role',
            Condition: 'HasGithubRepo',
            Properties: {
                RoleName: cf.join([cf.stackName, '-github']),
                AssumeRolePolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Principal: {
                            Federated: cf.join(['arn:', cf.partition, ':iam::', cf.accountId, ':oidc-provider/token.actions.githubusercontent.com'])
                        },
                        Action: 'sts:AssumeRoleWithWebIdentity',
                        Condition: {
                            StringEquals: {
                                'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com'
                            },
                            StringLike: {
                                'token.actions.githubusercontent.com:sub': cf.join(['repo:', cf.ref('GithubRepo'), ':ref:refs/tags/*'])
                            }
                        }
                    }]
                },
                Policies: [{
                    PolicyName: 'read-app-secrets',
                    PolicyDocument: {
                        Version: '2012-10-17',
                        Statement: [{
                            Effect: 'Allow',
                            Action: [
                                'secretsmanager:GetSecretValue',
                                'secretsmanager:DescribeSecret'
                            ],
                            Resource: Object.keys(SECRETS).map((name) => cf.ref(`${name}Secret`))
                        }, {
                            Effect: 'Allow',
                            Action: ['kms:Decrypt'],
                            Resource: cf.getAtt('KMS', 'Arn')
                        }]
                    }
                }]
            }
        },
        ...Resources
    },
    Outputs: {
        KMS: {
            Description: 'App Secrets KMS Key',
            Value: cf.ref('KMS')
        },
        GithubRole: {
            Condition: 'HasGithubRepo',
            Description: 'Role GitHub Actions tag builds assume to read the secrets',
            Value: cf.getAtt('GithubRole', 'Arn')
        },
        ...Outputs
    }
});
