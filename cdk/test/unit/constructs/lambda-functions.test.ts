
import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { LambdaFunctions } from '../../../lib/constructs/lambda-functions';
import { CDKTestHelper } from '../../__helpers__/cdk-test-utils';
import { MOCK_CONFIGS } from '../../__fixtures__/mock-configs';

// The "creates an image-package Lambda" restatement was removed — the
// full-stack synth exercises the PMTiles Lambda. What remains is the PMTiles
// API Gateway name, which is a stable identifier the construct derives.
describe('LambdaFunctions Construct', () => {
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
      assetBucketName: 'test-bucket',
      signingSecret,
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      Name: 'TAK-DevTest-CloudTAK-pmtiles',
      ProtocolType: 'HTTP',
    });
  });

  describe('pmtiles provisioned concurrency', () => {
    function build(id: string, pmtilesProvisionedConcurrency?: number): Template {
      const app = new App();
      const stack = new Stack(app, id, {
        env: { account: '123456789012', region: 'us-east-1' }
      });
      const { kmsKey } = CDKTestHelper.createMockInfrastructure(stack);
      const { hostedZone } = CDKTestHelper.createMockNetwork(stack);
      const ecrRepository = CDKTestHelper.createMockEcrRepository(stack);
      const certificate = acm.Certificate.fromCertificateArn(
        stack, 'PmtilesTestCert',
        'arn:aws:acm:us-west-2:123456789012:certificate/test-cert'
      );
      const { signingSecret } = CDKTestHelper.createMockSecrets(stack);
      new LambdaFunctions(stack, 'TestLambdaFunctions', {
        envConfig: {
          ...MOCK_CONFIGS.DEV_TEST,
          cloudtak: { ...MOCK_CONFIGS.DEV_TEST.cloudtak, pmtilesProvisionedConcurrency }
        },
        ecrRepository,
        kmsKey,
        hostedZone,
        certificate,
        serviceUrl: 'https://test.example.com',
        assetBucketName: 'test-bucket',
        signingSecret,
      });
      return Template.fromStack(stack);
    }

    it('defaults to 2 when unset', () => {
      build('Default').hasResourceProperties('AWS::Lambda::Alias', {
        Name: 'live',
        ProvisionedConcurrencyConfig: { ProvisionedConcurrentExecutions: 2 }
      });
    });

    it('uses the configured value', () => {
      build('Ten', 10).hasResourceProperties('AWS::Lambda::Alias', {
        Name: 'live',
        ProvisionedConcurrencyConfig: { ProvisionedConcurrentExecutions: 10 }
      });
    });

    it('keeps the alias but drops provisioned concurrency at 0', () => {
      const template = build('Zero', 0);
      template.hasResourceProperties('AWS::Lambda::Alias', { Name: 'live' });
      const aliases = Object.values(template.findResources('AWS::Lambda::Alias'));
      expect(aliases).toHaveLength(1);
      expect(aliases[0].Properties).not.toHaveProperty('ProvisionedConcurrencyConfig');
    });

    it.each([-1, 1.5, NaN])('rejects %p', (value) => {
      expect(() => build(`Bad${String(value).replace(/\W/g, '')}`, value)).toThrow(
        /pmtilesProvisionedConcurrency/
      );
    });
  });
});
