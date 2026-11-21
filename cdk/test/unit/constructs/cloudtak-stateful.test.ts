import { App, Stack } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { CloudTakStateful } from '../../../lib/constructs/cloudtak-stateful';
import { HubLoadBalancer } from '../../../lib/constructs/hub-load-balancer';
import { MOCK_CONFIGS } from '../../__fixtures__/mock-configs';

function scaffold(stackId: string, locationArbitration?: 'off' | 'observe' | 'enforce') {
  const app = new App();
  const stack = new Stack(app, stackId, { env: { account: '123456789012', region: 'us-east-1' } });
  const vpc = new ec2.Vpc(stack, 'Vpc');
  const ecsCluster = new ecs.Cluster(stack, 'Cluster', { vpc });

  const statefulSecurityGroup = new ec2.SecurityGroup(stack, 'StatefulSg', { vpc, allowAllOutbound: false });
  const hubAlbSecurityGroup = new ec2.SecurityGroup(stack, 'HubAlbSg', { vpc, allowAllOutbound: false });

  const alb = new elbv2.ApplicationLoadBalancer(stack, 'Alb', { vpc, internetFacing: true });
  const httpsListener = alb.addListener('Https', {
    port: 443,
    protocol: elbv2.ApplicationProtocol.HTTPS,
    certificates: [acm.Certificate.fromCertificateArn(
      stack, 'Cert', 'arn:aws:acm:us-east-1:123456789012:certificate/abc'
    )],
    defaultAction: elbv2.ListenerAction.fixedResponse(404)
  });

  const hub = new HubLoadBalancer(stack, 'Hub', {
    envConfig: MOCK_CONFIGS.DEV_TEST,
    vpc,
    hubAlbSecurityGroup
  });

  const role = (id: string) => new cdk.aws_iam.Role(stack, id, {
    assumedBy: new cdk.aws_iam.ServicePrincipal('ecs-tasks.amazonaws.com')
  });

  const envConfig = locationArbitration
    ? { ...MOCK_CONFIGS.DEV_TEST, cloudtak: { ...MOCK_CONFIGS.DEV_TEST.cloudtak, locationArbitration } }
    : MOCK_CONFIGS.DEV_TEST;
  const stateful = new CloudTakStateful(stack, 'Stateful', {
    envConfig,
    vpc,
    ecsCluster,
    statefulSecurityGroup,
    httpsListener,
    hubRpcTargetGroup: hub.rpcTargetGroup,
    containerImage: ecs.ContainerImage.fromRegistry('nginx'),
    containerEnvironment: {
      'API_URL': 'https://map.example.com',
      'CLOUDTAK_Server_Mode': 'api',
      'CLOUDTAK_Hub_URL': 'http://hub.internal'
    },
    containerSecrets: {},
    taskRole: role('TaskRole'),
    executionRole: role('ExecRole')
  });

  return { stack, stateful, hub };
}

describe('CloudTakStateful Construct', () => {
  it('runs a single task and never autoscales', () => {
    const { stack } = scaffold('S1');
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::ECS::Service', {
      ServiceName: 'TAK-DevTest-CloudTAK-stateful',
      DesiredCount: 1
    });
    // ConnectionPool is per-process in-memory state; a second task would
    // duplicate every TAK Server session.
    template.resourceCountIs('AWS::ApplicationAutoScaling::ScalableTarget', 0);
  });

  it('selects hub mode and drops the hub URL', () => {
    const { stack } = scaffold('S2');
    const defs = Template.fromStack(stack).findResources('AWS::ECS::TaskDefinition');
    const container = Object.values(defs)[0].Properties.ContainerDefinitions[0];
    const env: Record<string, string> = Object.fromEntries(
      container.Environment.map((e: { Name: string; Value: string }) => [e.Name, e.Value])
    );

    expect(env['CLOUDTAK_Server_Mode']).toBe('hub');
    expect(env['HUB_RPC_PORT']).toBe('5002');
    // This service *is* the hub - pointing it at itself would be wrong.
    expect(env).not.toHaveProperty('CLOUDTAK_Hub_URL');
    // Inherited from the shared stateless config.
    expect(env['API_URL']).toBe('https://map.example.com');
    // No PORT override: the image runs nginx on 5000 -> node on 5001.
    expect(env).not.toHaveProperty('PORT');
  });

  it('passes the location arbitration mode to the hub only when configured', () => {
    const envOf = (stackId: string, mode?: 'off' | 'observe' | 'enforce') => {
      const defs = Template.fromStack(scaffold(stackId, mode).stack).findResources('AWS::ECS::TaskDefinition');
      const container = Object.values(defs)[0].Properties.ContainerDefinitions[0];
      return Object.fromEntries(
        container.Environment.map((e: { Name: string; Value: string }) => [e.Name, e.Value])
      ) as Record<string, string>;
    };
    expect(envOf('L1', 'enforce')['CLOUDTAK_Location_Arbitration']).toBe('enforce');
    expect(envOf('L2', 'off')['CLOUDTAK_Location_Arbitration']).toBe('off');
    // Unset leaves the application default (observe), it is not forced from here
    expect(envOf('L3')).not.toHaveProperty('CLOUDTAK_Location_Arbitration');
  });
  it('exposes 5000 for nginx/WebSocket and 5002 for hub RPC', () => {
    const { stack } = scaffold('S3');
    const defs = Template.fromStack(stack).findResources('AWS::ECS::TaskDefinition');
    const container = Object.values(defs)[0].Properties.ContainerDefinitions[0];
    expect(container.PortMappings.map((p: { ContainerPort: number }) => p.ContainerPort)).toEqual([5000, 5002]);
  });

  it('registers against both target groups', () => {
    const { stack } = scaffold('S4');
    Template.fromStack(stack).hasResourceProperties('AWS::ECS::Service', {
      LoadBalancers: Match.arrayWith([
        Match.objectLike({ ContainerName: 'api', ContainerPort: 5000 }),
        Match.objectLike({ ContainerName: 'api', ContainerPort: 5002 })
      ])
    });
  });

  it('routes only WebSocket upgrades on /api to the stateful tier', () => {
    const { stack } = scaffold('S5');
    Template.fromStack(stack).hasResourceProperties('AWS::ElasticLoadBalancingV2::ListenerRule', {
      Priority: 10,
      Conditions: Match.arrayWith([
        Match.objectLike({ Field: 'http-header', HttpHeaderConfig: Match.objectLike({ Values: ['websocket'] }) }),
        Match.objectLike({ Field: 'path-pattern', PathPatternConfig: Match.objectLike({ Values: ['/api'] }) })
      ])
    });
  });

  it('stays in private subnets with no public IP', () => {
    const { stack } = scaffold('S6');
    Template.fromStack(stack).hasResourceProperties('AWS::ECS::Service', {
      ServiceName: 'TAK-DevTest-CloudTAK-stateful',
      NetworkConfiguration: Match.objectLike({
        AwsvpcConfiguration: Match.objectLike({ AssignPublicIp: 'DISABLED' })
      })
    });
  });

  it('drains WebSocket targets immediately and health checks /api', () => {
    const { stack } = scaffold('S7');
    Template.fromStack(stack).hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
      Port: 5000,
      HealthCheckPath: '/api',
      TargetGroupAttributes: Match.arrayWith([
        Match.objectLike({ Key: 'deregistration_delay.timeout_seconds', Value: '0' })
      ])
    });
  });
});

describe('HubLoadBalancer Construct', () => {
  it('is internal and health checks /hub on 5002', () => {
    const { stack } = scaffold('H1');
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      Scheme: 'internal',
      Name: 'tak-devtest-cloudtak-hub'
    });
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
      Port: 5002,
      HealthCheckPath: '/hub',
      Matcher: { HttpCode: '200' }
    });
  });

  it('does not open the RPC listener to 0.0.0.0/0', () => {
    const { stack } = scaffold('H2');
    const ingress = Template.fromStack(stack).findResources('AWS::EC2::SecurityGroupIngress');

    // CDK's default `open: true` would add an anyIpv4 rule on the listener port
    // to the hub ALB security group. Only the stateless tier may reach it.
    for (const rule of Object.values(ingress)) {
      expect(rule.Properties).not.toMatchObject({ CidrIp: '0.0.0.0/0', FromPort: 80 });
    }
    const sgs = Template.fromStack(stack).findResources('AWS::EC2::SecurityGroup');
    for (const [id, sg] of Object.entries(sgs)) {
      if (!id.startsWith('HubAlbSg')) continue;
      for (const rule of sg.Properties.SecurityGroupIngress ?? []) {
        expect(rule).not.toMatchObject({ CidrIp: '0.0.0.0/0' });
      }
    }
  });
});
