import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Secrets } from '../../../lib/constructs/secrets';
import { CDKTestHelper } from '../../__helpers__/cdk-test-utils';
import { MOCK_CONFIGS } from '../../__fixtures__/mock-configs';

describe('Secrets Construct', () => {
  it('creates signing secret', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack1', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    const { kmsKey } = CDKTestHelper.createMockInfrastructure(stack);

    const secrets = new Secrets(stack, 'TestSecrets', {
      envConfig: MOCK_CONFIGS.DEV_TEST,
      kmsKey
    });

    expect(secrets.signingSecret).toBeDefined();
    expect(secrets.adminPasswordSecret).toBeDefined();
    expect(secrets.mediaSecret).toBeDefined();

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Description: 'TAK-DevTest-CloudTAK Signing Secret'
    });
  });

  it('creates admin password secret', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack2', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    const { kmsKey } = CDKTestHelper.createMockInfrastructure(stack);

    new Secrets(stack, 'TestSecrets', {
      envConfig: MOCK_CONFIGS.DEV_TEST,
      kmsKey
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Description: 'CloudTAK Admin Username and Password'
    });
  });

  it('encrypts secrets with KMS', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack3', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    const { kmsKey } = CDKTestHelper.createMockInfrastructure(stack);

    new Secrets(stack, 'TestSecrets', {
      envConfig: MOCK_CONFIGS.DEV_TEST,
      kmsKey
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      KmsKeyId: 'arn:aws:kms:us-west-2:123456789012:key/12345678-1234-1234-1234-123456789012'
    });
  });
});