import cf from '@mapbox/cloudfriend';

/**
 * @class
 */
export default class Lambda {
    static generate(config, layer, layerdata) {
        const StackName = `${config.StackName}-layer-${layer.id}`;

        return {
            Resources: {
                ETLFunctionLogs: {
                    Type: 'AWS::Logs::LogGroup',
                    Properties: {
                        LogGroupName: `/aws/lambda/${StackName}`,
                        RetentionInDays: 7
                    }
                },
                ETLEvents: {
                    Type: 'AWS::Events::Rule',
                    Properties: {
                        Description: StackName,
                        State: 'ENABLED',
                        ScheduleExpression: layerdata.cron,
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
                        FunctionName: StackName,
                        MemorySize: 128,
                        Timeout: 60,
                        Description: StackName,
                        PackageType: 'Image',
                        Environment: {
                            Variables: {
                                TAK_API: 'me',
                                TAK_TOKEN: 'me'
                            }
                        },
                        Role: cf.importValue(config.StackName + '-etl-role'),
                        Code: {
                            ImageUri: cf.join([cf.accountId, '.dkr.ecr.', cf.region, `.amazonaws.com/coe-ecr-etl-tasks:${layerdata.task}`])
                        }
                    }
                }
            }
        }
    }
};
