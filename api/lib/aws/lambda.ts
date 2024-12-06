import cf from '@openaddresses/cloudfriend';
import { InferSelectModel } from 'drizzle-orm';
import type { Layer } from '../schema.js';
import AWSLambda from '@aws-sdk/client-lambda';
import Config from '../config.js';
import jwt from 'jsonwebtoken';
import Schedule from '../schedule.js';
import process from 'node:process';

/**
 * @class
 */
export default class Lambda {
    static async schema(config: Config, layerid: number, type: string = 'schema:input'): Promise<object> {
        const lambda = new AWSLambda.LambdaClient({ region: process.env.AWS_REGION });
        const FunctionName = `${config.StackName}-layer-${layerid}`;

        const res = await lambda.send(new AWSLambda.InvokeCommand({
            FunctionName,
            InvocationType: 'RequestResponse',
            Payload: Buffer.from(JSON.stringify({
                type
            }))
        }));

        if (!res.Payload) return {};
        return JSON.parse(Buffer.from(res.Payload).toString());
    }

    static async invoke(config: Config, layerid: number): Promise<void> {
        const lambda = new AWSLambda.LambdaClient({ region: process.env.AWS_REGION });
        const FunctionName = `${config.StackName}-layer-${layerid}`;

        await lambda.send(new AWSLambda.InvokeCommand({
            FunctionName,
            InvocationType: 'Event',
            Payload: Buffer.from('')
        }));
    }

    static generate(config: Config, layer: InferSelectModel<typeof Layer>): object {
        const StackName = `${config.StackName}-layer-${layer.id}`;

        const stack: any = {
            Description: `${layer.name}`,
            Parameters: {
                Task: {
                    Type: 'String',
                    Default: layer.task
                },
                UniqueID: {
                    Type: 'String',
                    Default: layer.uuid
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
                LambdaAlarm: {
                    Type: 'AWS::CloudWatch::Alarm',
                    Properties: {
                        AlarmName: StackName,
                        ActionsEnabled: true,
                        AlarmActions: [ ],
                        MetricName: 'Errors',
                        Namespace: 'AWS/Lambda',
                        Statistic: 'Maximum',
                        Dimensions: [{
                            Name: 'FunctionName',
                            Value: StackName
                        }],
                        Period: layer.alarm_period,
                        EvaluationPeriods: layer.alarm_evals,
                        DatapointsToAlarm: layer.alarm_points,
                        Threshold: layer.alarm_threshold,
                        ComparisonOperator: 'GreaterThanThreshold',
                        TreatMissingData: 'missing'
                    }
                },
                LambdaNoInvocationAlarm: {
                    Type: 'AWS::CloudWatch::Alarm',
                    Properties: {
                        AlarmName: cf.join([StackName, '-no-invocations']),
                        ActionsEnabled: true,
                        AlarmActions: [ ],
                        MetricName: 'Invocations',
                        Namespace: 'AWS/Lambda',
                        Statistic: 'Maximum',
                        Dimensions: [{
                            Name: 'FunctionName',
                            Value: StackName
                        }],
                        Period: layer.alarm_period,
                        EvaluationPeriods: layer.alarm_evals,
                        DatapointsToAlarm: layer.alarm_points,
                        Threshold: layer.alarm_threshold,
                        ComparisonOperator: 'LessThanOrEqualToThreshold',
                        TreatMissingData: 'missing'
                    }
                },
                ETLFunction: {
                    Type: 'AWS::Lambda::Function',
                    Properties: {
                        FunctionName: StackName,
                        MemorySize: layer.memory,
                        Timeout: layer.timeout,
                        Description: `${StackName}: ${layer.name}`,
                        PackageType: 'Image',
                        Environment: {
                            Variables: {
                                ETL_API: cf.importValue(config.StackName + '-hosted'),
                                ETL_TOKEN: `etl.${jwt.sign({ access: 'layer', id: layer.id, internal: true }, config.SigningSecret)}`,
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

        if (layer.webhooks) {
            stack.Resources.WebHookResourceBase = {
                Type: 'AWS::ApiGatewayV2::Route',
                Properties: {
                    RouteKey: cf.join(['ANY /', cf.ref('UniqueID') ]),
                    ApiId: cf.importValue(config.StackName.replace(/^coe-etl-/, 'coe-etl-webhooks-') + '-api'),
                    Target: cf.join(['integrations/', cf.ref('WebHookResourceIntegration')])
                }
            };

            stack.Resources.WebHookResource = {
                Type: 'AWS::ApiGatewayV2::Route',
                Properties: {
                    RouteKey: cf.join(['ANY /', cf.ref('UniqueID'), '/{proxy+}']),
                    ApiId: cf.importValue(config.StackName.replace(/^coe-etl-/, 'coe-etl-webhooks-') + '-api'),
                    Target: cf.join(['integrations/', cf.ref('WebHookResourceIntegration')])
                }
            };

            stack.Resources.WebHookResourceIntegration = {
                Type: 'AWS::ApiGatewayV2::Integration',
                Properties: {
                    ApiId: cf.importValue(config.StackName.replace(/^coe-etl-/, 'coe-etl-webhooks-') + '-api'),
                    IntegrationType: 'AWS_PROXY',
                    IntegrationUri: cf.getAtt('ETLFunction', 'Arn'),
                    CredentialsArn: cf.importValue(config.StackName.replace(/^coe-etl-/, 'coe-etl-webhooks-') + '-role'),
                    PayloadFormatVersion: '2.0'
                }
            }
        }

        if (layer.priority !== 'off') {
            stack.Resources.LambdaAlarm.Properties.AlarmActions.push(
                cf.join(['arn:', cf.partition, ':sns:', cf.region, `:`, cf.accountId, `:${config.StackName}-${layer.priority}-urgency`])
            )

            stack.Resources.LambdaNoInvocationAlarm.Properties.AlarmActions.push(
                cf.join(['arn:', cf.partition, ':sns:', cf.region, `:`, cf.accountId, `:${config.StackName}-${layer.priority}-urgency`])
            )
        }

        if (layer.cron && Schedule.is_aws(layer.cron)) {
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
}
