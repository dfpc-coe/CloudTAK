import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Route53 } from '../../../lib/constructs/route53';
import { CDKTestHelper } from '../../__helpers__/cdk-test-utils';

describe('Route53 Construct', () => {
  it('creates A record for IPv4', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack1', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    const infrastructure = CDKTestHelper.createMockInfrastructure(stack);
    const { vpc } = infrastructure;
    const { hostedZone } = CDKTestHelper.createMockNetwork(stack);
    
    const alb = new elbv2.ApplicationLoadBalancer(stack, 'TestALB', {
      vpc,
      internetFacing: true
    });

    const route53 = new Route53(stack, 'TestRoute53', {
      hostedZone,
      hostname: 'map',
      loadBalancer: alb
    });

    expect(route53.aRecord).toBeDefined();
    expect(route53.serviceUrl).toBe('map.test.com');

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Route53::RecordSet', {
      Type: 'A'
    });
  });

  it('creates AAAA record for IPv6', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack2', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    const infrastructure = CDKTestHelper.createMockInfrastructure(stack);
    const { vpc } = infrastructure;
    const { hostedZone } = CDKTestHelper.createMockNetwork(stack);
    
    const alb = new elbv2.ApplicationLoadBalancer(stack, 'TestALB', {
      vpc,
      internetFacing: true
    });

    new Route53(stack, 'TestRoute53', {
      hostedZone,
      hostname: 'map',
      loadBalancer: alb
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Route53::RecordSet', {
      Type: 'AAAA'
    });
  });

  it('creates alias records pointing to load balancer', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack3', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    const infrastructure = CDKTestHelper.createMockInfrastructure(stack);
    const { vpc } = infrastructure;
    const { hostedZone } = CDKTestHelper.createMockNetwork(stack);
    
    const alb = new elbv2.ApplicationLoadBalancer(stack, 'TestALB', {
      vpc,
      internetFacing: true
    });

    new Route53(stack, 'TestRoute53', {
      hostedZone,
      hostname: 'map',
      loadBalancer: alb
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Route53::RecordSet', {
      AliasTarget: {
        DNSName: {
          'Fn::Join': [
            '',
            [
              'dualstack.',
              { 'Fn::GetAtt': ['TestALB70A5B1F2', 'DNSName'] }
            ]
          ]
        }
      }
    });
  });
});