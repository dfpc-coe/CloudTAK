/**
 * ECS Service construct for CloudTAK API
 * 
 * Creates Fargate service running the CloudTAK API with:
 * - Container image from ECR repository
 * - Environment variables for configuration
 * - Secrets for database and API authentication
 * - CloudWatch logging with configurable retention
 * - Auto-scaling and health checks via ALB
 */

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecrAssets from 'aws-cdk-lib/aws-ecr-assets';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { ContextEnvironmentConfig } from '../stack-config';
import { createTakImportValue, TAK_EXPORT_NAMES } from '../cloudformation-imports';

export interface EcsServiceProps {
  environment: 'prod' | 'dev-test';
  envConfig: ContextEnvironmentConfig;
  vpc: ec2.IVpc;
  ecsCluster: ecs.ICluster;
  ecsSecurityGroup: ec2.SecurityGroup;
  albTargetGroup: elbv2.ApplicationTargetGroup;
  ecrRepository: ecr.IRepository;
  dockerImageAsset?: ecrAssets.DockerImageAsset;
  databaseSecret: secretsmanager.ISecret;
  databaseHostname: string;
  assetBucketName: string;
  signingSecret: secretsmanager.ISecret;
  serviceUrl: string;
}

export class EcsService extends Construct {
  public readonly service: ecs.FargateService;
  public readonly taskDefinition: ecs.FargateTaskDefinition;

  constructor(scope: Construct, id: string, props: EcsServiceProps) {
    super(scope, id);

    const { 
      environment, 
      envConfig, 
      vpc, 
      ecsCluster, 
      ecsSecurityGroup,
      albTargetGroup,
      ecrRepository,
      dockerImageAsset,
      databaseSecret,
      databaseHostname,
      assetBucketName,
      signingSecret,
      serviceUrl
    } = props;

    // Create CloudWatch log group for container logs
    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/aws/ecs/TAK-${envConfig.stackName}-CloudTAK`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: envConfig.general.removalPolicy === 'RETAIN' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY
    });

    // Create Fargate task definition
    this.taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDefinition', {
      family: `TAK-${envConfig.stackName}-CloudTAK`,
      cpu: envConfig.ecs.taskCpu,
      memoryLimitMiB: envConfig.ecs.taskMemory
    });

    // Import TAK admin certificate secret for base64 encoded certificate
    const takAdminCertSecret = secretsmanager.Secret.fromSecretCompleteArn(
      this, 
      'TakAdminCertSecret',
      cdk.Fn.importValue(createTakImportValue(envConfig.stackName, TAK_EXPORT_NAMES.TAK_ADMIN_CERT_SECRET_ARN))
    );

    // Determine container image source
    const containerImage = dockerImageAsset 
      ? ecs.ContainerImage.fromDockerImageAsset(dockerImageAsset)
      : ecs.ContainerImage.fromEcrRepository(ecrRepository, 'latest');

    // Add container to task definition
    const container = this.taskDefinition.addContainer('api', {
      image: containerImage,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'cloudtak-api',
        logGroup: logGroup
      }),
      // Environment variables for application configuration
      environment: {
        'AWS_REGION': cdk.Stack.of(this).region,
        'CLOUDTAK_MODE': 'AWS',
        'STACK_NAME': `TAK-${envConfig.stackName}-CloudTAK`,
        'ASSET_BUCKET': assetBucketName,
        'API_URL': serviceUrl,
        'ECS_CLUSTER_PREFIX': `TAK-${envConfig.stackName}-BaseInfra`,
        // CloudTAK Server configuration
        'CLOUDTAK_Server_name': `TAK.NZ ${environment === 'prod' ? 'Production' : 'Development'} Server`,
        'CLOUDTAK_Server_url': `ssl://${cdk.Fn.importValue(createTakImportValue(envConfig.stackName, TAK_EXPORT_NAMES.TAK_SERVICE_NAME))}:8089`,
        'CLOUDTAK_Server_api': `https://${cdk.Fn.importValue(createTakImportValue(envConfig.stackName, TAK_EXPORT_NAMES.TAK_SERVICE_NAME))}:8443`,
        'CLOUDTAK_Server_webtak': `https://${cdk.Fn.importValue(createTakImportValue(envConfig.stackName, TAK_EXPORT_NAMES.TAK_SERVICE_NAME))}:8446`,
        'CLOUDTAK_Server_auth_password': 'atakatak'
      },
      // Secrets from AWS Secrets Manager
      secrets: {
        'POSTGRES': ecs.Secret.fromSecretsManager(databaseSecret),
        'SigningSecret': ecs.Secret.fromSecretsManager(signingSecret),
        'CLOUDTAK_Server_auth_p12': ecs.Secret.fromSecretsManager(takAdminCertSecret)
      }
    });

    // Expose port 5000 for the API
    container.addPortMappings({
      containerPort: 5000,
      protocol: ecs.Protocol.TCP
    });

    // Create Fargate service
    this.service = new ecs.FargateService(this, 'Service', {
      cluster: ecsCluster,
      taskDefinition: this.taskDefinition,
      serviceName: `TAK-${envConfig.stackName}-CloudTAK`,
      desiredCount: envConfig.ecs.desiredCount,
      assignPublicIp: true, // Required for ECR image pulls
      enableExecuteCommand: envConfig.ecs.enableEcsExec,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [ecsSecurityGroup]
    });

    // Attach service to ALB target group for load balancing
    this.service.attachToApplicationTargetGroup(albTargetGroup);
  }
}