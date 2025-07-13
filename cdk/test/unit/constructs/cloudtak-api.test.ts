import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { CloudTakApi } from '../../../lib/constructs/cloudtak-api';
import { CDKTestHelper } from '../../__helpers__/cdk-test-utils';
import { MOCK_CONFIGS } from '../../__fixtures__/mock-configs';

describe('CloudTakApi Construct', () => {
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

    const etlEcrRepository = CDKTestHelper.createMockEcrRepository(stack, 'EtlEcrRepository');

    const cloudtakApi = new CloudTakApi(stack, 'TestCloudTakApi', {
      environment: 'dev-test',
      envConfig: MOCK_CONFIGS.DEV_TEST,
      ecsCluster,
      vpc,
      ecsSecurityGroup,
      ecrRepository,
      etlEcrRepository,
      albTargetGroup: targetGroup,
      assetBucketName: 'test-bucket',
      serviceUrl: 'https://test.example.com',
      signingSecret,
      adminPasswordSecret: adminSecret,
      databaseHostname: 'db.example.com',
      databaseSecret: dbSecret,
      connectionStringSecret: dbSecret
    });

    expect(cloudtakApi.service).toBeDefined();
    expect(cloudtakApi.taskDefinition).toBeDefined();

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

    const etlEcrRepository2 = CDKTestHelper.createMockEcrRepository(stack, 'EtlEcrRepository2');

    new CloudTakApi(stack, 'TestCloudTakApi', {
      environment: 'dev-test',
      envConfig: MOCK_CONFIGS.DEV_TEST,
      ecsCluster,
      vpc,
      ecsSecurityGroup,
      ecrRepository,
      etlEcrRepository: etlEcrRepository2,
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

  it('sets ETL ECR repository name in environment variables', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack3', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    const infrastructure = CDKTestHelper.createMockInfrastructure(stack);
    const { vpc, ecsCluster, ecsSecurityGroup } = infrastructure;
    const ecrRepository = CDKTestHelper.createMockEcrRepository(stack);
    
    const targetGroup = new elbv2.ApplicationTargetGroup(stack, 'TestTargetGroup', {
      vpc,
      port: 5000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP
    });

    const signingSecret3 = secretsmanager.Secret.fromSecretCompleteArn(stack, 'SigningSecret3', 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret3-AbCdEf');
    const adminSecret3 = secretsmanager.Secret.fromSecretCompleteArn(stack, 'AdminSecret3', 'arn:aws:secretsmanager:us-east-1:123456789012:secret:admin-secret3-AbCdEf');
    const dbSecret3 = secretsmanager.Secret.fromSecretCompleteArn(stack, 'DatabaseSecret3', 'arn:aws:secretsmanager:us-east-1:123456789012:secret:db-secret3-AbCdEf');

    const etlEcrRepository3 = CDKTestHelper.createMockEcrRepository(stack, 'EtlEcrRepository3');

    new CloudTakApi(stack, 'TestCloudTakApi', {
      environment: 'dev-test',
      envConfig: MOCK_CONFIGS.DEV_TEST,
      ecsCluster,
      vpc,
      ecsSecurityGroup,
      ecrRepository,
      etlEcrRepository: etlEcrRepository3,
      albTargetGroup: targetGroup,
      assetBucketName: 'test-bucket',
      serviceUrl: 'https://test.example.com',
      signingSecret: signingSecret3,
      adminPasswordSecret: adminSecret3,
      databaseHostname: 'db.example.com',
      databaseSecret: dbSecret3,
      connectionStringSecret: dbSecret3
    });

    const template = Template.fromStack(stack);
    const taskDefs = template.findResources('AWS::ECS::TaskDefinition');
    const taskDef = Object.values(taskDefs)[0];
    const containerDef = taskDef.Properties.ContainerDefinitions[0];
    const envVars = containerDef.Environment;
    
    expect(envVars).toContainEqual({
      Name: 'ECR_TASKS_REPOSITORY_NAME',
      Value: 'mock-ecr-repository'
    });
  });
});