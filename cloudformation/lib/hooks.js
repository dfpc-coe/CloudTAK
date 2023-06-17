import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        HookQueue: {
            Type: 'AWS::SQS::Queue',
            Properties: {
                ContentBasedDeduplication: true,
                QueueName: cf.join('-', [cf.stackName, 'hooks.fifo']),
                FifoQueue: true
            }
        },
        HookLambda: {
            Type: 'AWS::Lambda::Function',
            Properties: {
                FunctionName: cf.join([cf.stackName, '-hooks']),
                MemorySize: 512,
                Timeout: 15,
                Description: 'Push/Convert CoT events to external storage formats',
                PackageType: 'Image',
                Environment: {
                    Variables: {
                        TAK_ETL_API: cf.ref('HostedURL'),
                        SigningSecret: cf.sub('{{resolve:secretsmanager:${AWS::StackName}/api/secret:SecretString::AWSCURRENT}}')
                    }
                },
                Role: cf.getAtt('HookLambdaRole', 'Arn'),
                Code: {
                    ImageUri: cf.join([cf.accountId, '.dkr.ecr.', cf.region, '.amazonaws.com/coe-ecr-etl:hooks-', cf.ref('GitSha')])
                }
            }
        },
        HookLambdaRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
                RoleName: cf.join([cf.stackName, '-hooks']),
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
                Policies: [],
                ManagedPolicyArns: [
                    cf.join(['arn:', cf.partition, ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'])
                ]
            }
        }
    }
};
