import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { LambdaFunctions } from '../../../lib/constructs/lambda-functions';
import { CDKTestHelper } from '../../__helpers__/cdk-test-utils';
import { MOCK_CONFIGS } from '../../__fixtures__/mock-configs';

describe('LambdaFunctions Construct', () => {
  it('creates event Lambda function', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack1', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    const { kmsKey } = CDKTestHelper.createMockInfrastructure(stack);
    const { hostedZone } = CDKTestHelper.createMockNetwork(stack);
    const ecrRepository = CDKTestHelper.createMockEcrRepository(stack);
    const certificate = acm.Certificate.fromCertificateArn(
      stack, 'TestCert1',
      'arn:aws:acm:us-west-2:123456789012:certificate/test-cert'
    );
    const { signingSecret } = CDKTestHelper.createMockSecrets(stack);

    const lambdaFunctions = new LambdaFunctions(stack, 'TestLambdaFunctions', {
      envConfig: MOCK_CONFIGS.DEV_TEST,
      ecrRepository,
      kmsKey,
      hostedZone,
      certificate,
      serviceUrl: 'https://test.example.com',
      assetBucketArn: 'arn:aws:s3:::test-bucket',
      signingSecret
    });

    expect(lambdaFunctions.eventLambda).toBeDefined();
    expect(lambdaFunctions.tilesLambda).toBeDefined();
    expect(lambdaFunctions.tilesApi).toBeDefined();

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Lambda::Function', {
      PackageType: 'Image'
    });
  });

  it('creates PMTiles API Gateway', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack2', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    const { kmsKey } = CDKTestHelper.createMockInfrastructure(stack);
    const { hostedZone } = CDKTestHelper.createMockNetwork(stack);
    const ecrRepository = CDKTestHelper.createMockEcrRepository(stack);
    const certificate = acm.Certificate.fromCertificateArn(
      stack, 'TestCert2',
      'arn:aws:acm:us-west-2:123456789012:certificate/test-cert'
    );
    const { signingSecret } = CDKTestHelper.createMockSecrets(stack);

    new LambdaFunctions(stack, 'TestLambdaFunctions', {
      envConfig: MOCK_CONFIGS.DEV_TEST,
      ecrRepository,
      kmsKey,
      hostedZone,
      certificate,
      serviceUrl: 'https://test.example.com',
      assetBucketArn: 'arn:aws:s3:::test-bucket',
      signingSecret
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'TAK-DevTest-CloudTAK-pmtiles'
    });
  });
});