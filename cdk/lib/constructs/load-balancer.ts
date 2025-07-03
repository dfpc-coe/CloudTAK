import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { ContextEnvironmentConfig } from '../stack-config';

export interface LoadBalancerProps {
  envConfig: ContextEnvironmentConfig;
  vpc: ec2.IVpc;
  albSecurityGroup: ec2.SecurityGroup;
  certificate: acm.ICertificate;
  logsBucket: cdk.aws_s3.IBucket;
}

export class LoadBalancer extends Construct {
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly httpsListener: elbv2.ApplicationListener;
  public readonly targetGroup: elbv2.ApplicationTargetGroup;

  constructor(scope: Construct, id: string, props: LoadBalancerProps) {
    super(scope, id);

    const { envConfig, vpc, albSecurityGroup, certificate, logsBucket } = props;

    this.alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc: vpc,
      internetFacing: true,
      loadBalancerName: `tak-${envConfig.stackName.toLowerCase()}-cloudtak`,
      securityGroup: albSecurityGroup,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      ipAddressType: elbv2.IpAddressType.DUAL_STACK
    });
    
    // Enable access logging to S3 bucket (matches CloudFormation)
    this.alb.setAttribute('idle_timeout.timeout_seconds', '4000');
    this.alb.setAttribute('access_logs.s3.enabled', 'true');
    this.alb.setAttribute('access_logs.s3.bucket', logsBucket.bucketName);
    this.alb.setAttribute('access_logs.s3.prefix', `TAK-${envConfig.stackName}-CloudTAK`);
    this.alb.setAttribute('connection_logs.s3.enabled', 'true');
    this.alb.setAttribute('connection_logs.s3.bucket', logsBucket.bucketName);
    this.alb.setAttribute('connection_logs.s3.prefix', `TAK-${envConfig.stackName}-CloudTAK`);

    this.httpsListener = this.alb.addListener('HTTPSListener', {
      port: 443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      certificates: [certificate]
    });

    this.alb.addListener('HTTPListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.redirect({
        protocol: 'HTTPS',
        port: '443',
        permanent: true
      })
    });

    this.targetGroup = new elbv2.ApplicationTargetGroup(this, 'TargetGroup', {
      vpc: vpc,
      port: 5000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/api',
        healthyHttpCodes: '200,202,302,304',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 5
      }
    });

    this.httpsListener.addAction('DefaultAction', {
      action: elbv2.ListenerAction.forward([this.targetGroup])
    });
  }
}