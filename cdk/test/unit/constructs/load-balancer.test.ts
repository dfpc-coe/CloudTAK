import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { LoadBalancer } from '../../../lib/constructs/load-balancer';
import { CDKTestHelper } from '../../__helpers__/cdk-test-utils';
import { MOCK_CONFIGS } from '../../__fixtures__/mock-configs';

describe('LoadBalancer Construct', () => {
  it('creates Application Load Balancer', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack1', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    const infrastructure = CDKTestHelper.createMockInfrastructure(stack);
    const { vpc, ecsSecurityGroup } = infrastructure;
    const certificate = acm.Certificate.fromCertificateArn(
      stack, 'TestCert',
      'arn:aws:acm:us-west-2:123456789012:certificate/test-cert'
    );
    const logsBucket = CDKTestHelper.createMockS3Bucket(stack, 'LogsBucket');

    const loadBalancer = new LoadBalancer(stack, 'TestLoadBalancer', {
      envConfig: MOCK_CONFIGS.DEV_TEST,
      vpc,
      albSecurityGroup: ecsSecurityGroup,
      certificate,
      logsBucket
    });

    expect(loadBalancer.alb).toBeDefined();
    expect(loadBalancer.targetGroup).toBeDefined();

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      Type: 'application',
      Scheme: 'internet-facing'
    });
  });

  it('creates HTTPS listener', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack2', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    const infrastructure = CDKTestHelper.createMockInfrastructure(stack);
    const { vpc, ecsSecurityGroup } = infrastructure;
    const certificate = acm.Certificate.fromCertificateArn(
      stack, 'TestCert',
      'arn:aws:acm:us-west-2:123456789012:certificate/test-cert'
    );
    const logsBucket = CDKTestHelper.createMockS3Bucket(stack, 'LogsBucket');

    new LoadBalancer(stack, 'TestLoadBalancer', {
      envConfig: MOCK_CONFIGS.DEV_TEST,
      vpc,
      albSecurityGroup: ecsSecurityGroup,
      certificate,
      logsBucket
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', {
      Port: 443,
      Protocol: 'HTTPS'
    });
  });

  it('creates target group for ECS service', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack3', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    const infrastructure = CDKTestHelper.createMockInfrastructure(stack);
    const { vpc, ecsSecurityGroup } = infrastructure;
    const certificate = acm.Certificate.fromCertificateArn(
      stack, 'TestCert',
      'arn:aws:acm:us-west-2:123456789012:certificate/test-cert'
    );
    const logsBucket = CDKTestHelper.createMockS3Bucket(stack, 'LogsBucket');

    new LoadBalancer(stack, 'TestLoadBalancer', {
      envConfig: MOCK_CONFIGS.DEV_TEST,
      vpc,
      albSecurityGroup: ecsSecurityGroup,
      certificate,
      logsBucket
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
      Port: 5000,
      Protocol: 'HTTP',
      TargetType: 'ip'
    });
  });
});