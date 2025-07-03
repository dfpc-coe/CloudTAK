import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { ContextEnvironmentConfig } from '../stack-config';

export interface AlarmsProps {
  envConfig: ContextEnvironmentConfig;
  eventLambda: lambda.Function;
}

export class Alarms extends Construct {
  public readonly highUrgencyTopic: sns.Topic;
  public readonly lowUrgencyTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: AlarmsProps) {
    super(scope, id);

    const { envConfig, eventLambda } = props;

    this.highUrgencyTopic = new sns.Topic(this, 'HighUrgencyAlarmTopic', {
      displayName: `TAK-${envConfig.stackName}-CloudTAK-high-urgency`,
      topicName: `TAK-${envConfig.stackName}-CloudTAK-high-urgency`
    });

    this.lowUrgencyTopic = new sns.Topic(this, 'LowUrgencyAlarmTopic', {
      displayName: `TAK-${envConfig.stackName}-CloudTAK-low-urgency`,
      topicName: `TAK-${envConfig.stackName}-CloudTAK-low-urgency`
    });

    new cloudwatch.Alarm(this, 'EventAlarm', {
      alarmName: `TAK-${envConfig.stackName}-CloudTAK-EventLambda`,
      metric: eventLambda.metricErrors({
        period: cdk.Duration.minutes(1),
        statistic: 'Maximum'
      }),
      threshold: 0,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 1
    }).addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.highUrgencyTopic));
  }
}