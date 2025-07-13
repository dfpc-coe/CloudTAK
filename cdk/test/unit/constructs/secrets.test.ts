import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Secrets } from '../../../lib/constructs/secrets';
import { MOCK_CONFIGS } from '../../__fixtures__/mock-configs';

describe('Secrets Construct', () => {
  let app: cdk.App;
  let stack: cdk.Stack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');
    
    const kmsKey = new kms.Key(stack, 'TestKey');
    const envConfig = MOCK_CONFIGS.DEV_TEST;
    
    new Secrets(stack, 'TestSecrets', {
      envConfig,
      kmsKey
    });
    
    template = Template.fromStack(stack);
  });

  test('creates all required secrets for CloudTAK API', () => {
    // Verify signing secret exists
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: 'TAK-DevTest-CloudTAK/api/secret',
      Description: 'TAK-DevTest-CloudTAK Signing Secret'
    });

    // Verify media secret exists
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: 'TAK-DevTest-CloudTAK/api/media',
      Description: 'TAK-DevTest-CloudTAK Media Secret'
    });

    // Verify admin password secret exists
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: 'TAK-DevTest-CloudTAK/API/Admin-Password',
      Description: 'CloudTAK Admin Username and Password'
    });
  });

  test('creates exactly 3 secrets', () => {
    template.resourceCountIs('AWS::SecretsManager::Secret', 3);
  });

  test('all secrets use KMS encryption', () => {
    template.allResourcesProperties('AWS::SecretsManager::Secret', {
      KmsKeyId: {
        'Fn::GetAtt': [
          'TestKey4CACAF33',
          'Arn'
        ]
      }
    });
  });

  test('admin password secret has correct template structure', () => {
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      GenerateSecretString: {
        SecretStringTemplate: '{"username":"ckadmin"}',
        GenerateStringKey: 'password',
        ExcludePunctuation: true,
        PasswordLength: 32
      }
    });
  });
});