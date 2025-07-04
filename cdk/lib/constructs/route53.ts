import { Construct } from 'constructs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';

export interface Route53Props {
  hostedZone: route53.IHostedZone;
  hostname: string;
  loadBalancer: elbv2.ApplicationLoadBalancer;
}

export class Route53 extends Construct {
  public readonly aRecord: route53.ARecord;
  public readonly aaaaRecord: route53.AaaaRecord;
  public readonly serviceUrl: string;

  constructor(scope: Construct, id: string, props: Route53Props) {
    super(scope, id);

    const { hostedZone, hostname, loadBalancer } = props;

    // A Record
    this.aRecord = new route53.ARecord(this, 'ARecord', {
      zone: hostedZone,
      recordName: hostname,
      target: route53.RecordTarget.fromAlias(
        new route53targets.LoadBalancerTarget(loadBalancer)
      )
    });

    // AAAA Record for IPv6
    this.aaaaRecord = new route53.AaaaRecord(this, 'AAAARecord', {
      zone: hostedZone,
      recordName: hostname,
      target: route53.RecordTarget.fromAlias(
        new route53targets.LoadBalancerTarget(loadBalancer)
      )
    });

    this.serviceUrl = `${hostname}.${hostedZone.zoneName}`;
  }
}