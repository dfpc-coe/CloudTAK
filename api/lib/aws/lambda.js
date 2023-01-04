import cf from '@mapbox/cloudfriend';

/**
 * @class
 */
export default class Lambda {
    static generate(config, task, cron) {
        const name = `${config.StackName}-${task}`;

        return {
            Resources: {
                ETLFunctionLogs: {
                    Type: 'AWS::Logs::LogGroup',
                    Properties: {
                        LogGroupName: `/aws/lambda/${name}`,
                        RetentionInDays: 7
                    }
                },
                ETLEvents: {
                    Type: 'AWS::Events::Rule',
                    Properties: {
                        Description: name,
                        State: 'ENABLED',
                        ScheduleExpression: cron,
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
                        FunctionName: name,
                        MemorySize: 128,
                        Timeout: 60,
                        Description: name,
                        PackageType: 'Image',
                        Environment: {
                            Variables: {
                                TAK_API: 'me',
                                TAK_TOKEN: 'me'
                            }
                        },
                        Role: cf.importValue(config.StackName + '-etl-role'),
                        Code: {
                            ImageUri: cf.join([cf.accountId, '.dkr.ecr.', cf.region, `.amazonaws.com/coe-ecr-etl-tasks:${name}`])
                        }
                    }
                }
            }
        }
    }
};
