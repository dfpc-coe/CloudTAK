import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { EcsService } from '../../../lib/constructs/ecs-service';
import { CDKTestHelper } from '../../__helpers__/cdk-test-utils';
import { MOCK_CONFIGS } from '../../__fixtures__/mock-configs';

describe('EcsService Construct', () => {
  it('creates ECS service', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack1', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    const infrastructure = CDKTestHelper.createMockInfrastructure(stack);
    const { vpc, ecsCluster, ecsSecurityGroup } = infrastructure;
    const ecrRepository = CDKTestHelper.createMockEcrRepository(stack);
    const assetBucket = CDKTestHelper.createMockS3Bucket(stack, 'AssetBucket');
    
    const targetGroup = new elbv2.ApplicationTargetGroup(stack, 'TestTargetGroup', {
      vpc,
      port: 5000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP
    });

    const signingSecret = secretsmanager.Secret.fromSecretCompleteArn(stack, 'SigningSecret', 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret-AbCdEf');
    const adminSecret = secretsmanager.Secret.fromSecretCompleteArn(stack, 'AdminSecret', 'arn:aws:secretsmanager:us-east-1:123456789012:secret:admin-secret-AbCdEf');
    const dbSecret = secretsmanager.Secret.fromSecretCompleteArn(stack, 'DatabaseSecret', 'arn:aws:secretsmanager:us-east-1:123456789012:secret:db-secret-AbCdEf');

    const ecsService = new EcsService(stack, 'TestEcsService', {
      environment: 'dev-test',
      envConfig: MOCK_CONFIGS.DEV_TEST,
      ecsCluster,
      vpc,
      ecsSecurityGroup,
      ecrRepository,
      albTargetGroup: targetGroup,
      assetBucketName: 'test-bucket',
      serviceUrl: 'https://test.example.com',
      signingSecret,
      adminPasswordSecret: adminSecret,
      databaseHostname: 'db.example.com',
      databaseSecret: dbSecret,
      connectionStringSecret: dbSecret
    });

    expect(ecsService.service).toBeDefined();
    expect(ecsService.taskDefinition).toBeDefined();

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::ECS::Service', {
      LaunchType: 'FARGATE'
    });
  });

  it('creates task definition', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack2', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    const infrastructure = CDKTestHelper.createMockInfrastructure(stack);
    const { vpc, ecsCluster, ecsSecurityGroup } = infrastructure;
    const ecrRepository = CDKTestHelper.createMockEcrRepository(stack);
    const assetBucket = CDKTestHelper.createMockS3Bucket(stack, 'AssetBucket');
    
    const targetGroup = new elbv2.ApplicationTargetGroup(stack, 'TestTargetGroup', {
      vpc,
      port: 5000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP
    });

    const signingSecret2 = secretsmanager.Secret.fromSecretCompleteArn(stack, 'SigningSecret2', 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret2-AbCdEf');
    const adminSecret2 = secretsmanager.Secret.fromSecretCompleteArn(stack, 'AdminSecret2', 'arn:aws:secretsmanager:us-east-1:123456789012:secret:admin-secret2-AbCdEf');
    const dbSecret2 = secretsmanager.Secret.fromSecretCompleteArn(stack, 'DatabaseSecret2', 'arn:aws:secretsmanager:us-east-1:123456789012:secret:db-secret2-AbCdEf');

    new EcsService(stack, 'TestEcsService', {
      environment: 'dev-test',
      envConfig: MOCK_CONFIGS.DEV_TEST,
      ecsCluster,
      vpc,
      ecsSecurityGroup,
      ecrRepository,
      albTargetGroup: targetGroup,
      assetBucketName: 'test-bucket',
      serviceUrl: 'https://test.example.com',
      signingSecret: signingSecret2,
      adminPasswordSecret: adminSecret2,
      databaseHostname: 'db.example.com',
      databaseSecret: dbSecret2,
      connectionStringSecret: dbSecret2
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      NetworkMode: 'awsvpc',
      RequiresCompatibilities: ['FARGATE']
    });
  });
});