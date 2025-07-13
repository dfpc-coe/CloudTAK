import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Alarms } from '../../../lib/constructs/alarms';
import { CDKTestHelper } from '../../__helpers__/cdk-test-utils';
import { MOCK_CONFIGS } from '../../__fixtures__/mock-configs';

describe('Alarms Construct', () => {
  it('creates CloudWatch alarms', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack1', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    
    const eventLambda = new lambda.Function(stack, 'TestLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => {};')
    });

    new Alarms(stack, 'TestAlarms', {
      envConfig: MOCK_CONFIGS.DEV_TEST,
      eventLambda
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      MetricName: 'Errors',
      Namespace: 'AWS/Lambda'
    });
  });

  it('creates Lambda error alarm', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack2', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    
    const eventLambda = new lambda.Function(stack, 'TestLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => {};')
    });

    new Alarms(stack, 'TestAlarms', {
      envConfig: MOCK_CONFIGS.DEV_TEST,
      eventLambda
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      ComparisonOperator: 'GreaterThanThreshold',
      EvaluationPeriods: 1,
      Threshold: 0
    });
  });
});