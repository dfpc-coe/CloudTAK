import cf from '@mapbox/cloudfriend';
import jwt from 'jsonwebtoken';

/**
 * @class
 */
export default class Lambda {
    static generate(config, layer, layerdata) {
        const StackName = `${config.StackName}-layer-${layer.id}`;

        return {
            Parameters: {
                ScheduleExpression: {
                    Type: 'String',
                    Default: layerdata.cron
                },
                Task: {
                    Type: 'String',
                    Default: layerdata.task
                }
            },
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
                        ScheduleExpression: cf.ref('ScheduleExpression'),
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
                                ...layerdata.environment,
                                ETL_API: config.API_URL,
                                ETL_TOKEN: jwt.sign({ access: 'cot', layer: layer.id }, config.SigningSecret),
                                ETL_LAYER: layer.id
                            }
                        },
                        Role: cf.importValue(config.StackName + '-etl-role'),
                        Code: {
                            ImageUri: cf.join([cf.accountId, '.dkr.ecr.', cf.region, `.amazonaws.com/coe-ecr-etl-tasks:`, cf.ref('Task')])
                        }
                    }
                }
            }
        }
    }
};
