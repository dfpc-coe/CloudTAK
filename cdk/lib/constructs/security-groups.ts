import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { ContextEnvironmentConfig } from '../stack-config';

export interface SecurityGroupsProps {
  vpc: ec2.IVpc;
  envConfig: ContextEnvironmentConfig;
}

export class SecurityGroups extends Construct {
  public readonly database: ec2.SecurityGroup;
  public readonly ecs: ec2.SecurityGroup;
  public readonly alb: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: SecurityGroupsProps) {
    super(scope, id);

    const { vpc, envConfig } = props;

    this.alb = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc: vpc,
      description: `TAK-${envConfig.stackName}-CloudTAK ALB Security Group`,
      allowAllOutbound: false
    });

    this.alb.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP');
    this.alb.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS');
    this.alb.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(80), 'HTTP IPv6');
    this.alb.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(443), 'HTTPS IPv6');

    this.ecs = new ec2.SecurityGroup(this, 'ECSSecurityGroup', {
      vpc: vpc,
      description: `TAK-${envConfig.stackName}-CloudTAK ECS Security Group`,
      allowAllOutbound: false
    });

    this.ecs.addIngressRule(this.alb, ec2.Port.tcp(5000), 'ALB to ECS');

    this.database = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: vpc,
      description: `TAK-${envConfig.stackName}-CloudTAK Database Security Group`,
      allowAllOutbound: false
    });

    this.database.addIngressRule(this.ecs, ec2.Port.tcp(5432), 'ECS to Database');

    // ALB outbound - only health checks to ECS
    this.alb.addEgressRule(this.ecs, ec2.Port.tcp(5000), 'Health checks to ECS');

    // ECS outbound - essential services only
    this.ecs.addEgressRule(this.database, ec2.Port.tcp(5432), 'ECS to Database');
    this.ecs.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP outbound');
    this.ecs.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS outbound');
    this.ecs.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.udp(53), 'DNS');
    this.ecs.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(53), 'DNS TCP');


  }
}