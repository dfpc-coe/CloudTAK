import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { S3Resources } from '../../../lib/constructs/s3-resources';
import { CDKTestHelper } from '../../__helpers__/cdk-test-utils';
import { MOCK_CONFIGS } from '../../__fixtures__/mock-configs';

describe('S3Resources Construct', () => {
  it('creates S3 bucket without errors', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    const kmsKey = CDKTestHelper.createMockInfrastructure(stack).kmsKey;

    expect(() => {
      new S3Resources(stack, 'TestS3Resources', {
        envConfig: MOCK_CONFIGS.DEV_TEST,
        kmsKey
      });
    }).not.toThrow();
  });

  it('creates S3 bucket with encryption', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    const kmsKey = CDKTestHelper.createMockInfrastructure(stack).kmsKey;

    new S3Resources(stack, 'TestS3Resources', {
      envConfig: MOCK_CONFIGS.DEV_TEST,
      kmsKey
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          {
            ServerSideEncryptionByDefault: {
              SSEAlgorithm: 'aws:kms'
            }
          }
        ]
      }
    });
  });

  it('creates S3 bucket with versioning enabled', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack2', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    const kmsKey = CDKTestHelper.createMockInfrastructure(stack).kmsKey;
    const prodConfig = { ...MOCK_CONFIGS.PROD };
    prodConfig.s3.enableVersioning = true;

    new S3Resources(stack, 'TestS3Resources', {
      envConfig: prodConfig,
      kmsKey
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::S3::Bucket', {
      VersioningConfiguration: {
        Status: 'Enabled'
      }
    });
  });
});