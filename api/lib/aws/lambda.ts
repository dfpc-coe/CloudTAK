import Err from '@openaddresses/batch-error';
import cf from '@openaddresses/cloudfriend';
import type { AugmentedLayer } from '../models/Layer.js';
import AWSLambda from '@aws-sdk/client-lambda';
import Config from '../config.js';
import jwt from 'jsonwebtoken';
import Schedule from '../schedule.js';
import process from 'node:process';
import { Static } from '@sinclair/typebox'
import { Capabilities } from '@tak-ps/etl'

/**
 * @class
 */
export default class Lambda {
    static async capabilities(config: Config, layerid: number): Promise<Static<typeof Capabilities>> {
        const lambda = new AWSLambda.LambdaClient({ region: process.env.AWS_REGION });
        const FunctionName = `${config.StackName}-layer-${layerid}`;

        const res = await lambda.send(new AWSLambda.InvokeCommand({
            FunctionName,
            InvocationType: 'RequestResponse',
            Payload: Buffer.from(JSON.stringify({
                type: 'capabilities'
            }))
        }));

        if (!res.Payload) {
            throw new Err(400, null, 'Capabilities API returned empty response');
        }

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

    static generate(
        config: Config,
        layer: Static<typeof AugmentedLayer>
    ): object {
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

        if (layer.outgoing) {
            stack.Resources.OutgoingQueue = {
                Type: 'AWS::SQS::Queue',
                Properties: {
                    ContentBasedDeduplication: true,
                    QueueName: cf.join([cf.stackName, '-outgoing.fifo']),
                    FifoQueue: true,
                    RedrivePolicy: {
                        deadLetterTargetArn: cf.getAtt('OutgoingDeadQueue', 'Arn'),
                        maxReceiveCount: 3
                    }
                }
            };

            stack.Resources.OutgoingDeadQueue = {
                Type: 'AWS::SQS::Queue',
                Properties: {
                    FifoQueue: true,
                    QueueName: cf.join([cf.stackName, '-outgoing-dead.fifo'])
                }
            };

            stack.Resources.OutgoingLambdaSource = {
                Type: 'AWS::Lambda::EventSourceMapping',
                Properties: {
                    Enabled: 'True',
                    EventSourceArn:  cf.getAtt('OutgoingQueue', 'Arn'),
                    FunctionName: cf.ref('ETLFunction')
                }
            }
        }

        if (layer.incoming) {
            stack.Resources.LambdaAlarm = {
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
                    Period: layer.incoming.alarm_period,
                    EvaluationPeriods: layer.incoming.alarm_evals,
                    DatapointsToAlarm: layer.incoming.alarm_points,
                    Threshold: layer.incoming.alarm_threshold,
                    ComparisonOperator: 'GreaterThanThreshold',
                    TreatMissingData: 'missing'
                }
            };

            stack.Resources.LambdaNoInvocationAlarm = {
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
                    Period: layer.incoming.alarm_period,
                    EvaluationPeriods: layer.incoming.alarm_evals,
                    DatapointsToAlarm: layer.incoming.alarm_points,
                    Threshold: layer.incoming.alarm_threshold,
                    ComparisonOperator: 'LessThanOrEqualToThreshold',
                    TreatMissingData: 'missing'
                }
            };

            if (layer.incoming.webhooks) {
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

            if (layer.incoming.cron && Schedule.is_aws(layer.incoming.cron)) {
                stack.Parameters.ScheduleExpression = {
                    Type: 'String',
                    Default: layer.incoming.cron
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
        }

        return stack;
    }
}
