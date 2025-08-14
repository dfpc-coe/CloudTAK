import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        EventLambdaRoute: {
            Type: 'AWS::ApiGatewayV2::Route',
            Properties: {
                RouteKey: 'POST /internal',
                ApiId: cf.importValue(cf.join(['tak-cloudtak-webhooks-', cf.ref('Environment'), '-api'])),
                Target: cf.join(['integrations/', cf.ref('EventLambdaRouteIntegration')])
            },
        },
        EventLambdaRouteIntegration: {
            Type: 'AWS::ApiGatewayV2::Integration',
            Properties: {
                ApiId: cf.importValue(cf.join(['tak-cloudtak-webhooks-', cf.ref('Environment'), '-api'])),
                IntegrationType: 'AWS_PROXY',
                IntegrationUri: cf.getAtt('EventLambda', 'Arn'),
                CredentialsArn: cf.getAtt('EventLambdaRole', 'Arn'),
                PayloadFormatVersion: '2.0'
            }
        },
        EventLambda: {
            Type: 'AWS::Lambda::Function',
            DependsOn: ['SigningSecret'],
            Properties: {
                FunctionName: cf.join([cf.stackName, '-events']),
                MemorySize: 512,
                Timeout: 900,
                Description: 'Respond to events on the S3 Asset Bucket & Stack SQS Queue',
                ReservedConcurrentExecutions: 20,
                PackageType: 'Image',
                Environment: {
                    Variables: {
                        TAK_ETL_API: cf.join(['https://', cf.ref('SubdomainPrefix'), '.', cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-hosted-zone-name']))]),
                        StackName: cf.stackName,
                        SigningSecret: cf.sub('{{resolve:secretsmanager:${AWS::StackName}/api/secret:SecretString::AWSCURRENT}}')
                    }
                },
                Role: cf.getAtt('EventLambdaRole', 'Arn'),
                Code: {
                    ImageUri: cf.join([cf.accountId, '.dkr.ecr.', cf.region, '.amazonaws.com/coe-ecr-etl:events-', cf.ref('GitSha')])
                }
            }
        },
        EventLambdaRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
                RoleName: cf.join([cf.stackName, '-events']),
                AssumeRolePolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Principal: {
                            Service: 'lambda.amazonaws.com'
                        },
                        Action: 'sts:AssumeRole'
                    }]
                },
                Path: '/',
                Policies: [{
                    PolicyName: cf.join([cf.stackName, '-hook-queue']),
                    PolicyDocument: {
                        Version: '2012-10-17',
                        Statement: [{
                            Effect: 'Allow',
                            Resource: [
                                cf.join(['arn:', cf.partition, ':s3:::', cf.join('-', [cf.stackName, cf.accountId, cf.region])]),
                                cf.join(['arn:', cf.partition, ':s3:::', cf.join('-', [cf.stackName, cf.accountId, cf.region]), '/*'])
                            ],
                            Action: '*'
                        }]
                    }
                }],
                ManagedPolicyArns: [
                    cf.join(['arn:', cf.partition, ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'])
                ]
            }
        }
    }
};
