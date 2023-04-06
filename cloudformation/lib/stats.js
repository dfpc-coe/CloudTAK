import cf from '@openaddresses/cloudfriend';

export default {
    Parameters: {
        LDAPServer: {
            Type: 'String',
            Description: 'URL to LDAP Server'
        },
        LDAPUsername: {
            Type: 'String',
            Description: 'Username to LDAP Service'
        },
        LDAPPassword: {
            Type: 'String',
            Description: 'Password to LDAP Service'
        }
    },
    Resources: {
        ETLFunctionLogs: {
            Type: 'AWS::Logs::LogGroup',
            Properties: {
                LogGroupName: cf.join(['/aws/lambda/', cf.stackName, '-etl']),
                RetentionInDays: 7
            }
        },
        ETLEvents: {
            Type: 'AWS::Events::Rule',
            Properties: {
                Description: cf.stackName,
                State: 'ENABLED',
                ScheduleExpression: 'cron(0 22 * * ? *)',
                Targets: [{
                    Id: 'TagWatcherScheduler',
                    Arn: cf.getAtt('ETLFunction', 'Arn')
                }]
            }
        },
        ETLFunctionInvoke: {
            Type: 'AWS::Lambda::Permission',
            Properties: {
                FunctionName: cf.getAtt('ETLFunction', 'Arn'),
                Action: 'lambda:InvokeFunction',
                Principal: 'events.amazonaws.com',
                SourceArn: cf.getAtt('ETLEvents', 'Arn')
            }
        },
        ETLFunction: {
            Type: 'AWS::Lambda::Function',
            Properties: {
                FunctionName: cf.join('-', [cf.stackName, 'etl']),
                KmsKeyArn: cf.getAtt('KMS', 'Arn'),
                MemorySize: 128,
                Timeout: 60,
                Description: 'Scrape LDAP for user stats',
                PackageType: 'Image',
                Environment: {
                    Variables: {
                        TAK_STATS_API: cf.join(['http://', cf.getAtt('ELB', 'DNSName')]),
                        TAK_STATS_TOKEN: cf.sub('{{resolve:secretsmanager:${AWS::StackName}/api/secret:SecretString::AWSCURRENT}}'),
                        LDAP_SERVER: cf.ref('LDAPServer'),
                        LDAP_USERNAME: cf.ref('LDAPUsername'),
                        LDAP_PASSWORD: cf.ref('LDAPPassword')
                    }
                },
                Role: cf.getAtt('ETLFunctionRole', 'Arn'),
                Code: {
                    ImageUri: cf.join([cf.accountId, '.dkr.ecr.', cf.region, '.amazonaws.com/coe-ecr-stats:etl-', cf.ref('GitSha')])
                }
            }
        },
        ETLFunctionRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
                RoleName: cf.join([cf.stackName, '-lambda-role']),
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
