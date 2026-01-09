import Err from '@openaddresses/batch-error';
import cf from '@openaddresses/cloudfriend';
import type { AugmentedLayer } from '../models/Layer.js';
import AWSLambda from '@aws-sdk/client-lambda';
import Config from '../config.js';
import jwt from 'jsonwebtoken';
import Schedule from '../schedule.js';
import process from 'node:process';
import { Static } from '@sinclair/typebox'
import { StackFrame } from './cloudformation.js';
import { Capabilities } from '@tak-ps/etl'

const ECR_TASKS_REPOSITORY = process.env.ECR_TASKS_REPOSITORY_NAME;

/**
 * @class
 */
export default class Lambda {
    static async capabilities(
        config: Config,
        layerid: number
    ): Promise<Static<typeof Capabilities>> {
        const res = await Lambda.invoke(config, layerid, 'capabilities');

        if (!res) {
            throw new Err(400, null, 'Capabilities API returned empty response');
        }

        return JSON.parse(res.toString()) as Static<typeof Capabilities>;
    }


    static async invoke(config: Config, layerid: number, type?: string): Promise<Buffer | undefined> {
        const lambda = new AWSLambda.LambdaClient({ region: process.env.AWS_REGION });
        const FunctionName = `${config.StackName}-layer-${layerid}`;

        let InvocationType: AWSLambda.InvocationType = 'Event';
        if (type && ['capabilities'].includes(type)) {
            InvocationType = 'RequestResponse';
        }

        const res = await lambda.send(new AWSLambda.InvokeCommand({
            FunctionName,
            InvocationType,
            Payload: type ? Buffer.from(JSON.stringify({ type })) : Buffer.from('')
        }));

        if (res.Payload) {
            return Buffer.from(res.Payload);
        } else {
            return
        }
    }

    static generate(
        config: Config,
        layer: Static<typeof AugmentedLayer>
    ): Static<typeof StackFrame> {
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
                            ImageUri: cf.join([cf.accountId, '.dkr.ecr.', cf.region, `.amazonaws.com/${ECR_TASKS_REPOSITORY}:`, cf.ref('Task')])
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
                    },
                    VisibilityTimeout: layer.timeout
                }
            };

            stack.Resources.OutgoingDeadQueue = {
                Type: 'AWS::SQS::Queue',
                Properties: {
                    FifoQueue: true,
                    QueueName: cf.join([cf.stackName, '-outgoing-dead.fifo']),
                    VisibilityTimeout: layer.timeout
                }
            };

            stack.Resources.OutgoingDeadQueueBacklogAlarm = {
                Type: 'AWS::CloudWatch::Alarm',
                Properties: {
                    AlarmName: cf.join('-', [cf.stackName, 'outgoing-dead-backlog']),
                    Namespace: 'AWS/SQS',
                    MetricName: 'ApproximateNumberOfMessagesVisible',
                    ComparisonOperator: 'GreaterThanThreshold',
                    Threshold: 1000,
                    EvaluationPeriods: 5,
                    Statistic: 'Maximum',
                    Period: 60,
                    AlarmActions: [],
                    Dimensions: [{
                        Name: 'QueueName',
                        Value: cf.getAtt('OutgoingDeadQueue', 'QueueName')
                    }]
                }
            }

            stack.Resources.OutgoingQueueBacklogAlarm = {
                Type: 'AWS::CloudWatch::Alarm',
                Properties: {
                    AlarmName: cf.join('-', [cf.stackName, 'outgoing-backlog']),
                    Namespace: 'AWS/SQS',
                    MetricName: 'ApproximateNumberOfMessagesVisible',
                    ComparisonOperator: 'GreaterThanThreshold',
                    Threshold: 1000,
                    EvaluationPeriods: 5,
                    Statistic: 'Maximum',
                    Period: 60,
                    AlarmActions: [ ],
                    Dimensions: [{
                        Name: 'QueueName',
                        Value: cf.getAtt('OutgoingQueue', 'QueueName')
                    }]
                }
            }

            stack.Resources.OutgoingLambdaSource = {
                Type: 'AWS::Lambda::EventSourceMapping',
                Properties: {
                    Enabled: 'True',
                    BatchSize: 1,
                    EventSourceArn:  cf.getAtt('OutgoingQueue', 'Arn'),
                    FunctionName: cf.ref('ETLFunction')
                }
            }
        }

        stack.Resources.LambdaAlarm = {
            Type: 'AWS::CloudWatch::Alarm',
            Properties: {
                AlarmName: StackName,
                ActionsEnabled: true,
                AlarmActions: [ ],
                MetricName: 'Errors',
                Namespace: 'AWS/Lambda',
                Statistic: 'Average',
                Dimensions: [{
                    Name: 'FunctionName',
                    Value: StackName
                }],
                Period: layer.alarm_period,
                EvaluationPeriods: layer.alarm_evals,
                DatapointsToAlarm: layer.alarm_points,
                Threshold: 0,
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
                Statistic: 'Average',
                Dimensions: [{
                    Name: 'FunctionName',
                    Value: StackName
                }],
                Period: layer.alarm_period,
                EvaluationPeriods: layer.alarm_evals,
                DatapointsToAlarm: layer.alarm_points,
                Threshold: 0,
                ComparisonOperator: 'LessThanOrEqualToThreshold',
                TreatMissingData: 'missing'
            }
        };

        if (layer.incoming) {
            if (layer.incoming.webhooks) {
                stack.Resources.WebHookResourceBase = {
                    Type: 'AWS::ApiGatewayV2::Route',
                    Properties: {
                        RouteKey: cf.join(['ANY /', cf.ref('UniqueID') ]),
                        ApiId: cf.importValue(config.StackName.replace(/^tak-cloudtak-/, 'tak-cloudtak-webhooks-') + '-api'),
                        Target: cf.join(['integrations/', cf.ref('WebHookResourceIntegration')])
                    }
                };

                stack.Resources.WebHookResource = {
                    Type: 'AWS::ApiGatewayV2::Route',
                    Properties: {
                        RouteKey: cf.join(['ANY /', cf.ref('UniqueID'), '/{proxy+}']),
                        ApiId: cf.importValue(config.StackName.replace(/^tak-cloudtak-/, 'tak-cloudtak-webhooks-') + '-api'),
                        Target: cf.join(['integrations/', cf.ref('WebHookResourceIntegration')])
                    }
                };

                stack.Resources.WebHookResourceIntegration = {
                    Type: 'AWS::ApiGatewayV2::Integration',
                    Properties: {
                        ApiId: cf.importValue(config.StackName.replace(/^tak-cloudtak-/, 'tak-cloudtak-webhooks-') + '-api'),
                        IntegrationType: 'AWS_PROXY',
                        IntegrationUri: cf.getAtt('ETLFunction', 'Arn'),
                        CredentialsArn: cf.importValue(config.StackName.replace(/^tak-cloudtak-/, 'tak-cloudtak-webhooks-') + '-role'),
                        PayloadFormatVersion: '2.0'
                    }
                }
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

        if (layer.priority !== 'off') {
            if (stack.Resources.LambdaAlarm) {
                stack.Resources.LambdaAlarm.Properties.AlarmActions.push(
                    cf.join(['arn:', cf.partition, ':sns:', cf.region, `:`, cf.accountId, `:${config.StackName}-${layer.priority}-urgency`])
                );
            }

            if (stack.Resources.OutgoingDeadQueueBacklogAlarm) {
                stack.Resources.OutgoingDeadQueueBacklogAlarm.Properties.AlarmActions.push(
                    cf.join(['arn:', cf.partition, ':sns:', cf.region, `:`, cf.accountId, `:${config.StackName}-${layer.priority}-urgency`])
                );
            }

            if (stack.Resources.OutgoingQueueBacklogAlarm) {
                stack.Resources.OutgoingQueueBacklogAlarm.Properties.AlarmActions.push(
                    cf.join(['arn:', cf.partition, ':sns:', cf.region, `:`, cf.accountId, `:${config.StackName}-${layer.priority}-urgency`])
                );
            }

            if (stack.Resources.LambdaNoInvocationAlarm) {
                stack.Resources.LambdaNoInvocationAlarm.Properties.AlarmActions.push(
                    cf.join(['arn:', cf.partition, ':sns:', cf.region, `:`, cf.accountId, `:${config.StackName}-${layer.priority}-urgency`])
                );
            }
        }


        return stack;
    }
}
