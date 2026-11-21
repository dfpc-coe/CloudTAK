import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import { ContextEnvironmentConfig } from '../stack-config';

export interface CloudTakStatefulProps {
  envConfig: ContextEnvironmentConfig;
  vpc: ec2.IVpc;
  ecsCluster: ecs.ICluster;

  /** SecurityGroups.stateful */
  statefulSecurityGroup: ec2.SecurityGroup;

  /** Public HTTPS listener - the WebSocket rule is added here. */
  httpsListener: elbv2.ApplicationListener;

  /** HubLoadBalancer.rpcTargetGroup (port 5002). */
  hubRpcTargetGroup: elbv2.ApplicationTargetGroup;

  // Shared with the stateless tier - same image, same roles, same config.
  containerImage: ecs.ContainerImage;
  containerEnvironment: Record<string, string>;
  containerSecrets: Record<string, ecs.Secret>;
  containerEnvironmentFiles?: ecs.EnvironmentFile[];
  taskRole: cdk.aws_iam.Role;
  executionRole: cdk.aws_iam.Role;
}

/**
 * Stateful ("hub") CloudTAK service.
 *
 * Mirrors upstream v13.70.0 `cloudformation/lib/stateful.js`. Runs the same
 * image as the stateless API service with `CLOUDTAK_Server_Mode=hub`, which in
 * `api/index.ts` means: build a minimal express app serving only `GET /api`,
 * attach the browser WebSocket server to it, and start the hub RPC listener on
 * `HUB_RPC_PORT`. It owns the TAK Server connection pool, the geofence engine
 * and the events pool, and it is the tier that runs database migrations.
 *
 * Two ports:
 *   5000  nginx (see the image's `./start` + `nginx.conf.js`) -> node on 5001.
 *         Serves the `/api` health check and proxies WebSocket upgrades.
 *   5002  node directly. Hub RPC, not proxied through nginx.
 *
 * `desiredCount` is fixed at 1 and must stay there: `ConnectionPool` is
 * per-process in-memory state, so a second task would duplicate every TAK Server
 * session. Scaling belongs to the stateless tier only.
 */
export class CloudTakStateful extends Construct {
  public readonly service: ecs.FargateService;
  public readonly taskDefinition: ecs.FargateTaskDefinition;
  /** Port 5000 target group, wired to the public ALB's WebSocket rule. */
  public readonly targetGroup: elbv2.ApplicationTargetGroup;

  constructor(scope: Construct, id: string, props: CloudTakStatefulProps) {
    super(scope, id);

    const {
      envConfig,
      vpc,
      ecsCluster,
      statefulSecurityGroup,
      httpsListener,
      hubRpcTargetGroup,
      containerImage,
      containerEnvironment,
      containerSecrets,
      containerEnvironmentFiles,
      taskRole,
      executionRole
    } = props;

    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/aws/ecs/TAK-${envConfig.stackName}-CloudTAK-stateful`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: envConfig.general.removalPolicy === 'RETAIN'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY
    });

    const statefulEnvironment = { ...containerEnvironment };
    delete statefulEnvironment['CLOUDTAK_Hub_URL'];

    this.taskDefinition = new ecs.FargateTaskDefinition(this, 'StatefulTaskDefinition', {
      family: `TAK-${envConfig.stackName}-CloudTAK-stateful`,
      cpu: envConfig.ecs.taskCpu,
      memoryLimitMiB: envConfig.ecs.taskMemory,
      taskRole,
      executionRole
    });

    const container = this.taskDefinition.addContainer('api', {
      image: containerImage,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'cloudtak-stateful',
        logGroup
      }),
      environment: {
        // This service *is* the hub, so CLOUDTAK_Hub_URL is dropped rather than
        // blanked - it would otherwise point the hub at itself.
        ...statefulEnvironment,
        'CLOUDTAK_Server_Mode': 'hub',
        ...(envConfig.cloudtak.locationArbitration ? { 'CLOUDTAK_Location_Arbitration': envConfig.cloudtak.locationArbitration } : {}),
        // Explicit for documentation; 5002 is also the app's default.
        'HUB_RPC_PORT': '5002'
        // NOTE: deliberately no PORT override. The image runs nginx on 5000
        // which proxies to node on 5001 (api/nginx.conf.js). Setting PORT=5000
        // as upstream's CloudFormation does would put node on nginx's port and
        // leave nginx proxying to nothing.
      },
      secrets: containerSecrets,
      // Restart in place instead of replacing the task. Matches upstream
      // v13.70.0 (cloudformation/lib/stateful.js). See cloudtak-api.ts for the
      // full reasoning and the circuit-breaker trade-off.
      //
      // This tier gains the most. Replacing the task means Fargate placement, an
      // image pull, a new ENI and re-registration with *two* target groups
      // (5000 WebSocket + 5002 hub RPC). An in-place restart avoids all of that.
      // It still loses every TAK Server connection, since ConnectionPool is
      // per-process and this is a new process, but the outage is far shorter.
      enableRestartPolicy: true,
      restartAttemptPeriod: cdk.Duration.seconds(300),
      ...(containerEnvironmentFiles ? { environmentFiles: containerEnvironmentFiles } : {})
    });

    container.addPortMappings(
      { containerPort: 5000, protocol: ecs.Protocol.TCP },
      { containerPort: 5002, protocol: ecs.Protocol.TCP }
    );

    this.service = new ecs.FargateService(this, 'StatefulService', {
      cluster: ecsCluster,
      taskDefinition: this.taskDefinition,
      serviceName: `TAK-${envConfig.stackName}-CloudTAK-stateful`,
      // Must remain 1 - see the class comment.
      desiredCount: 1,
      assignPublicIp: false,
      enableExecuteCommand: envConfig.ecs.enableEcsExec,
      // Upstream puts this tier in public subnets with a public IP. We keep it
      // in private subnets with NAT egress, matching the existing API service -
      // that path is already proven to reach TAK Server, since today's single
      // service holds those same connections from here.
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [statefulSecurityGroup],
      healthCheckGracePeriod: cdk.Duration.seconds(300),
      circuitBreaker: { rollback: true },
      propagateTags: ecs.PropagatedTagSource.SERVICE,
      // Roll forward: start the replacement, wait for it to pass its health
      // check, then drain the old task. Matches upstream v13.70.0
      // (`cloudformation/lib/stateful.js`, MinimumHealthyPercent 100 /
      // MaximumPercent 200) and every other service in this stack.
      //
      // This does mean two `CLOUDTAK_Server_Mode=hub` tasks exist for the length
      // of one health check pass, each with its own ConnectionPool, so TAK
      // Server sees duplicate connections for that window and the hub ALB will
      // spread RPC across both. Upstream accepts that, and it is the better
      // trade: the alternative - draining first, which is what this used to do -
      // is a guaranteed gap in browser WebSockets *and* hub RPC on every single
      // deploy, rather than a brief overlap.
      minHealthyPercent: 100,
      maxHealthyPercent: 200
    });

    // Port 5000: WebSocket + health check, reached via the public ALB.
    this.targetGroup = new elbv2.ApplicationTargetGroup(this, 'StatefulTargetGroup', {
      vpc,
      port: 5000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      // Long-lived WebSockets: drain immediately rather than holding the
      // deployment open for connections that will reconnect anyway.
      deregistrationDelay: cdk.Duration.seconds(0),
      healthCheck: {
        enabled: true,
        path: '/api',
        healthyHttpCodes: '200,202,302,304',
        // Upstream's timings. These matter more than they look now that the
        // service rolls forward: two healthy checks at 15s is how long the two
        // hub tasks overlap, so 15/3 keeps that window at roughly 30 seconds
        // instead of a minute.
        interval: cdk.Duration.seconds(15),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3
      }
    });

    this.service.attachToApplicationTargetGroup(this.targetGroup);

    // Port 5002 needs an explicit container/port, so register the target
    // directly rather than via attachToApplicationTargetGroup.
    hubRpcTargetGroup.addTarget(this.service.loadBalancerTarget({
      containerName: 'api',
      containerPort: 5002
    }));

    // Browser WebSockets must reach the stateful tier, everything else the
    // stateless tier. Priority 10; priority 1 is taken by the scanner block.
    httpsListener.addAction('StatefulWebSocket', {
      priority: 10,
      conditions: [
        elbv2.ListenerCondition.httpHeader('Upgrade', ['websocket']),
        elbv2.ListenerCondition.pathPatterns(['/api'])
      ],
      action: elbv2.ListenerAction.forward([this.targetGroup])
    });
  }
}
