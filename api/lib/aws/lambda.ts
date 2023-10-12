// @ts-ignore
import cf from '@openaddresses/cloudfriend';
import AWSLambda from '@aws-sdk/client-lambda';
import Config from '../config.js';
import jwt from 'jsonwebtoken';
import Schedule from '../schedule.js';

/**
 * @class
 */
export default class Lambda {
    static async schema(config: Config, layerid: number, type: string = 'schema:input'): Promise<object> {
        const lambda = new AWSLambda.LambdaClient({ region: process.env.AWS_DEFAULT_REGION });
        const FunctionName = `${config.StackName}-layer-${layerid}`;

        const res = await lambda.send(new AWSLambda.InvokeCommand({
            FunctionName,
            InvocationType: 'RequestResponse',
            Payload: Buffer.from(JSON.stringify({
                type
            }))
        }));

        return JSON.parse(Buffer.from(res.Payload).toString());
    }

    static async invoke(config: Config, layerid: number): Promise<void> {
        const lambda = new AWSLambda.LambdaClient({ region: process.env.AWS_DEFAULT_REGION });
        const FunctionName = `${config.StackName}-layer-${layerid}`;

        await lambda.send(new AWSLambda.InvokeCommand({
            FunctionName,
            InvocationType: 'Event',
            Payload: Buffer.from('')
        }));
    }

    static generate(config: Config, layer: any): any {
        const StackName = `${config.StackName}-layer-${layer.id}`;

        const stack: any = {
            Description: `${layer.name} @ v1.0.0`,
            Parameters: {
                Task: {
                    Type: 'String',
                    Default: layer.task
                },
            },
            Resources: {
                LambdaAlarm: {
                    Type: 'AWS::CloudWatch::Alarm',
                    Properties: {
                        AlarmName: StackName,
                        ActionsEnabled: true,
                        AlarmActions: [ cf.join(['arn:', cf.partition, ':sns:', cf.region, `:`, cf.accountId, `:${config.StackName}`]) ],
                        MetricName: 'Errors',
                        Namespace: 'AWS/Lambda',
                        Statistic: 'Maximum',
                        Dimensions: [{
                            Name: 'FunctionName',
                            Value: StackName
                        }],
                        Period: 30,
                        EvaluationPeriods: 5,
                        DatapointsToAlarm: 4,
                        Threshold: 0,
                        ComparisonOperator: 'GreaterThanThreshold',
                        TreatMissingData: 'missing'
                    }
                },
                ETLFunctionLogs: {
                    Type: 'AWS::Logs::LogGroup',
                    Properties: {
                        LogGroupName: `/aws/lambda/${StackName}`,
                        RetentionInDays: 7
                    }
                },
                ETLFunction: {
                    Type: 'AWS::Lambda::Function',
                    Properties: {
                        FunctionName: StackName,
                        MemorySize: layer.memory,
                        Timeout: layer.timeout,
                        Description: StackName,
                        PackageType: 'Image',
                        Environment: {
                            Variables: {
                                ETL_API: cf.importValue(config.StackName + '-hosted'),
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

        if (Schedule.is_aws(layer.cron)) {
            stack.Parameters.ScheduleExpression = {
                Type: 'String',
                Default: layer.cron
            };
            stack.Parameters.Events = {
                Type: 'String',
                Default: layer.enabled ? 'ENABLED' : 'DISABLED'
            };
            stack.Resources.ETLEvents = {
                Type: 'AWS::Events::Rule',
                Properties: {
                    Description: StackName,
                    State: cf.ref('Events'),
                    ScheduleExpression: cf.ref('ScheduleExpression'),
                    Targets: [{
                        Id: 'TagWatcherScheduler',
                        Arn: cf.getAtt('ETLFunction', 'Arn')
                    }]
                }
            };
            stack.Resources.ETLFunctionInvoke = {
                Type: 'AWS::Lambda::Permission',
                Properties: {
                    FunctionName: cf.getAtt('ETLFunction', 'Arn'),
                    Action: 'lambda:InvokeFunction',
                    Principal: 'events.amazonaws.com',
                    SourceArn: cf.getAtt('ETLEvents', 'Arn')
                }
            };
        }

        return stack;
    }
};
