import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Batch } from '../../../lib/constructs/batch';
import { CDKTestHelper } from '../../__helpers__/cdk-test-utils';
import { MOCK_CONFIGS } from '../../__fixtures__/mock-configs';

describe('Batch Construct', () => {
  it('creates batch compute environment', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack1', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    const { vpc } = CDKTestHelper.createMockInfrastructure(stack);
    const ecrRepository = CDKTestHelper.createMockEcrRepository(stack);

    const batch = new Batch(stack, 'TestBatch', {
      envConfig: MOCK_CONFIGS.DEV_TEST,
      vpc,
      ecrRepository,
      assetBucketArn: 'arn:aws:s3:::test-bucket',
      serviceUrl: 'https://test.example.com'
    });

    expect(batch.computeEnvironment).toBeDefined();
    expect(batch.jobQueue).toBeDefined();

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Batch::ComputeEnvironment', {
      Type: 'MANAGED'
    });
  });

  it('creates batch job definitions with different configs', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack2', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    const { vpc } = CDKTestHelper.createMockInfrastructure(stack);
    const ecrRepository = CDKTestHelper.createMockEcrRepository(stack);

    new Batch(stack, 'TestBatch', {
      envConfig: MOCK_CONFIGS.PROD,
      vpc,
      ecrRepository,
      assetBucketArn: 'arn:aws:s3:::test-bucket',
      serviceUrl: 'https://prod.example.com'
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Batch::JobDefinition', {
      Type: 'container'
    });
  });
});