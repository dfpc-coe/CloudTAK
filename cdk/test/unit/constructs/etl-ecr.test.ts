import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { EtlEcr } from '../../../lib/constructs/etl-ecr';
import { CDKTestHelper } from '../../__helpers__/cdk-test-utils';
import { MOCK_CONFIGS } from '../../__fixtures__/mock-configs';

describe('EtlEcr Construct', () => {
  it('creates ECR repository with correct name', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    const kmsKey = CDKTestHelper.createMockKmsKey(stack);

    new EtlEcr(stack, 'TestEtlEcr', {
      envConfig: MOCK_CONFIGS.DEV_TEST,
      kmsKey
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::ECR::Repository', {
      RepositoryName: 'tak-devtest-etl-tasks'
    });
  });

  it('creates ECR repository with lifecycle policy', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    const kmsKey = CDKTestHelper.createMockKmsKey(stack);

    new EtlEcr(stack, 'TestEtlEcr', {
      envConfig: MOCK_CONFIGS.DEV_TEST,
      kmsKey
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::ECR::Repository', {
      LifecyclePolicy: {
        LifecyclePolicyText: JSON.stringify({
          rules: [{
            rulePriority: 1,
            description: 'Keep last N images',
            selection: {
              tagStatus: 'any',
              countType: 'imageCountMoreThan',
              countNumber: MOCK_CONFIGS.DEV_TEST.ecr.imageRetentionCount
            },
            action: {
              type: 'expire'
            }
          }]
        })
      }
    });
  });

  it('creates ECR repository with KMS encryption', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    const kmsKey = CDKTestHelper.createMockKmsKey(stack);

    new EtlEcr(stack, 'TestEtlEcr', {
      envConfig: MOCK_CONFIGS.DEV_TEST,
      kmsKey
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::ECR::Repository', {
      EncryptionConfiguration: {
        EncryptionType: 'KMS'
      }
    });
  });

  it('configures image scanning based on environment', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    const kmsKey = CDKTestHelper.createMockKmsKey(stack);

    new EtlEcr(stack, 'TestEtlEcr', {
      envConfig: MOCK_CONFIGS.PROD,
      kmsKey
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::ECR::Repository', {
      ImageScanningConfiguration: {
        ScanOnPush: MOCK_CONFIGS.PROD.ecr.scanOnPush
      }
    });
  });

  it('uses correct removal policy for production', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    const kmsKey = CDKTestHelper.createMockKmsKey(stack);

    new EtlEcr(stack, 'TestEtlEcr', {
      envConfig: MOCK_CONFIGS.PROD,
      kmsKey
    });

    const template = Template.fromStack(stack);
    template.hasResource('AWS::ECR::Repository', {
      DeletionPolicy: 'Retain'
    });
  });
});