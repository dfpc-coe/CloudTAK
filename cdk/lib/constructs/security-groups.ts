import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { ContextEnvironmentConfig } from '../stack-config';
import { createBaseImportValue, BASE_EXPORT_NAMES } from '../cloudformation-imports';

export interface SecurityGroupsProps {
  vpc: ec2.IVpc;
  envConfig: ContextEnvironmentConfig;
  vpcCidrIpv4?: string; // Optional override for VPC IPv4 CIDR
  vpcCidrIpv6?: string; // Optional override for VPC IPv6 CIDR
}

export class SecurityGroups extends Construct {
  public readonly database: ec2.SecurityGroup;
  public readonly ecs: ec2.SecurityGroup;
  public readonly alb: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: SecurityGroupsProps) {
    super(scope, id);

    const { vpc, envConfig, vpcCidrIpv4: providedVpcCidrIpv4, vpcCidrIpv6: providedVpcCidrIpv6 } = props;
    
    // Import VPC CIDRs from BaseInfra if not provided
    const vpcCidrIpv4 = providedVpcCidrIpv4 || 
      cdk.Fn.importValue(createBaseImportValue(envConfig.stackName, BASE_EXPORT_NAMES.VPC_CIDR_IPV4));
      
    const vpcCidrIpv6 = providedVpcCidrIpv6 || 
      cdk.Fn.importValue(createBaseImportValue(envConfig.stackName, BASE_EXPORT_NAMES.VPC_CIDR_IPV6));

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
    this.ecs.addEgressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(80), 'HTTP outbound IPv6');
    this.ecs.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS outbound');
    this.ecs.addEgressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(443), 'HTTPS outbound IPv6');
    this.ecs.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.udp(53), 'DNS');
    this.ecs.addEgressRule(ec2.Peer.anyIpv6(), ec2.Port.udp(53), 'DNS IPv6');
    this.ecs.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(53), 'DNS TCP');
    this.ecs.addEgressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(53), 'DNS TCP IPv6');
    // VPC endpoints for AWS services
    this.ecs.addEgressRule(ec2.Peer.ipv4(vpcCidrIpv4), ec2.Port.tcp(443), 'VPC Endpoints');
    // TAK Server connections - IPv4
    this.ecs.addEgressRule(ec2.Peer.ipv4(vpcCidrIpv4), ec2.Port.tcp(8089), 'TAK Streaming CoT');
    this.ecs.addEgressRule(ec2.Peer.ipv4(vpcCidrIpv4), ec2.Port.tcp(8443), 'TAK Server API');
    this.ecs.addEgressRule(ec2.Peer.ipv4(vpcCidrIpv4), ec2.Port.tcp(8446), 'TAK Server WebTAK');
    // TAK Server connections - IPv6
    this.ecs.addEgressRule(ec2.Peer.ipv6(vpcCidrIpv6), ec2.Port.tcp(8089), 'TAK Streaming CoT IPv6');
    this.ecs.addEgressRule(ec2.Peer.ipv6(vpcCidrIpv6), ec2.Port.tcp(8443), 'TAK Server API IPv6');
    this.ecs.addEgressRule(ec2.Peer.ipv6(vpcCidrIpv6), ec2.Port.tcp(8446), 'TAK Server WebTAK IPv6');


  }
}