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
import * as s3 from 'aws-cdk-lib/aws-s3';
import { ContextEnvironmentConfig } from '../stack-config';
import { createTakImportValue, TAK_EXPORT_NAMES, createBaseImportValue, BASE_EXPORT_NAMES, createAuthImportValue, AUTH_EXPORT_NAMES } from '../cloudformation-imports';

import { CLOUDTAK_CONSTANTS } from '../utils/constants';
import { mailDomainFor, mailLayerPrefix } from './mail';

export interface CloudTakApiProps {
  environment: 'prod' | 'dev-test';
  envConfig: ContextEnvironmentConfig;
  vpc: ec2.IVpc;
  ecsCluster: ecs.ICluster;
  ecsSecurityGroup: ec2.SecurityGroup;
  mediaSecurityGroup: ec2.SecurityGroup;
  albTargetGroup: elbv2.ApplicationTargetGroup;
  ecrRepository: ecr.IRepository;
  dockerImageAsset?: ecrAssets.DockerImageAsset;
  etlEcrRepository: ecr.IRepository;
  databaseSecret: secretsmanager.ISecret;
  databaseHostname: string;
  connectionStringSecret: secretsmanager.ISecret;
  assetBucketName: string;
  signingSecret: secretsmanager.ISecret;
  adminPasswordSecret: secretsmanager.ISecret;
  geofenceSecret: secretsmanager.ISecret;
  serviceUrl: string;
  /** OIDC client ID from the Authentik OAuth2 provider (set when cloudtak.oidcEnabled is true) */
  oidcClientId?: string;
  /** Secret holding the OIDC client secret from the Authentik OAuth2 provider */
  oidcClientSecret?: secretsmanager.ISecret;
  /**
   * SCIM bearer token shared with the Authentik SCIM provider (set when cloudtak.scimEnabled is true).
   * Switches the API to env-driven SCIM: `SCIM_ENABLED=true` and `SCIM_TOKEN`.
   */
  scimToken?: secretsmanager.ISecret;
  /**
   * Internal hub ALB DNS name. Set once the stateless/stateful split is wired;
   * the stateless tier calls the hub for anything needing a TAK Server
   * connection. Omit to run the container in single-service `both` mode.
   */
  hubAlbDnsName?: string;
}

export class CloudTakApi extends Construct {
  public readonly service: ecs.FargateService;
  public readonly taskDefinition: ecs.FargateTaskDefinition;

  // Exposed so CloudTakStateful can run the *same* image with the *same* IAM
  // roles, environment and secrets, differing only by CLOUDTAK_Server_Mode.
  // Sharing these rather than duplicating them is deliberate: the two tiers are
  // one application and any drift between them is a latent production bug.
  public readonly containerImage: ecs.ContainerImage;
  public readonly containerEnvironment: Record<string, string>;
  public readonly containerSecrets: Record<string, ecs.Secret>;
  public readonly containerEnvironmentFiles?: ecs.EnvironmentFile[];
  public readonly taskRole: cdk.aws_iam.Role;
  public readonly executionRole: cdk.aws_iam.Role;

  constructor(scope: Construct, id: string, props: CloudTakApiProps) {
    super(scope, id);

    const { 
      environment, 
      envConfig, 
      vpc, 
      ecsCluster, 
      ecsSecurityGroup,
      mediaSecurityGroup,
      albTargetGroup,
      ecrRepository,
      dockerImageAsset,
      etlEcrRepository,
      databaseSecret,
      databaseHostname,
      connectionStringSecret,
      assetBucketName,
      signingSecret,
      adminPasswordSecret,
      geofenceSecret,
      serviceUrl,
      oidcClientId,
      oidcClientSecret,
      scimToken,
      hubAlbDnsName
    } = props;

    // Create CloudWatch log group for container logs
    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/aws/ecs/TAK-${envConfig.stackName}-CloudTAK`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: envConfig.general.removalPolicy === 'RETAIN' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY
    });

    // Create task role with comprehensive permissions
    const taskRole = this.taskRole = new cdk.aws_iam.Role(this, 'TaskRole', {
      assumedBy: new cdk.aws_iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      inlinePolicies: {
        'api-policy': new cdk.aws_iam.PolicyDocument({
          statements: [
            // ECS Exec permissions
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: [
                'ssmmessages:CreateControlChannel',
                'ssmmessages:CreateDataChannel', 
                'ssmmessages:OpenControlChannel',
                'ssmmessages:OpenDataChannel'
              ],
              resources: ['*']
            }),
            // S3 bucket access — bucket level (list/locate only)
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: ['s3:ListBucket', 's3:GetBucketLocation'],
              resources: [`arn:${cdk.Stack.of(this).partition}:s3:::${assetBucketName}`]
            }),
            // S3 bucket access — object level
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
                's3:AbortMultipartUpload',
                's3:ListMultipartUploadParts',
              ],
              resources: [`arn:${cdk.Stack.of(this).partition}:s3:::${assetBucketName}/*`]
            }),

            // SQS permissions for layer queues
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: ['sqs:PurgeQueue', 'sqs:SendMessage', 'sqs:SendMessageBatch', 'sqs:ChangeMessageVisibility', 'sqs:GetQueueUrl', 'sqs:GetQueueAttributes', 'sqs:DeleteMessage'],
              resources: [`arn:${cdk.Stack.of(this).partition}:sqs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:tak-cloudtak-${environment}-layer-*`]
            }),
            // Secrets Manager access
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: ['secretsmanager:Describe*', 'secretsmanager:Get*', 'secretsmanager:List*'],
              resources: [`arn:${cdk.Stack.of(this).partition}:secretsmanager:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:secret:TAK-${envConfig.stackName}-*`]
            }),

            // Lambda permissions for layer management
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: ['lambda:*'],
              resources: [`arn:${cdk.Stack.of(this).partition}:lambda:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:function:TAK-${envConfig.stackName}-CloudTAK-layer-*`]
            }),
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: [
                'cloudformation:DescribeStacks', 
                'cloudformation:ListExports',
                'cloudformation:CreateStack',
                'cloudformation:UpdateStack', 
                'cloudformation:DeleteStack',
                'cloudformation:CancelUpdateStack'
              ],
              resources: [
                `arn:${cdk.Stack.of(this).partition}:cloudformation:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:stack/TAK-${envConfig.stackName}-*`,
                `arn:${cdk.Stack.of(this).partition}:cloudformation:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:stack/TAK-${envConfig.stackName}-layer-*`
              ]
            }),
            // cloudformation:ListStacks requires Resource: * (no ARN filtering possible)
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: ['cloudformation:ListStacks'],
              resources: ['*']
            }),
            // ECS permissions for media server
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: ['ecs:Describe*', 'ecs:Get*', 'ecs:List*', 'ecs:RunTask', 'ecs:StopTask'],
              resources: [
                `arn:${cdk.Stack.of(this).partition}:ecs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:container-instance/TAK-${envConfig.stackName}-BaseInfra/*`,
                `arn:${cdk.Stack.of(this).partition}:ecs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:cluster/TAK-${envConfig.stackName}-BaseInfra`,
                `arn:${cdk.Stack.of(this).partition}:ecs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:task/TAK-${envConfig.stackName}-BaseInfra/*`,
                `arn:${cdk.Stack.of(this).partition}:ecs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:task-definition/TAK-${envConfig.stackName}-media:*`,
                `arn:${cdk.Stack.of(this).partition}:ecs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:task-definition/TAK-${envConfig.stackName}-media`
              ]
            }),
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: ['iam:PassRole'],
              resources: [
                `arn:${cdk.Stack.of(this).partition}:iam::${cdk.Stack.of(this).account}:role/TAK-${envConfig.stackName}-media-*`,
                `arn:${cdk.Stack.of(this).partition}:iam::${cdk.Stack.of(this).account}:role/service-role/TAK-${envConfig.stackName}-media-*`,
                `arn:${cdk.Stack.of(this).partition}:iam::${cdk.Stack.of(this).account}:role/TAK-${envConfig.stackName}-CloudTAK-etl`,
                `arn:${cdk.Stack.of(this).partition}:iam::${cdk.Stack.of(this).account}:role/service-role/TAK-${envConfig.stackName}-CloudTAK-etl`
              ]
            }),
            // EC2 permissions for VPC operations
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: ['ec2:DescribeNetworkInterfaces', 'ec2:DescribeSubnets', 'ec2:DescribeSecurityGroups', 'ecs:ListTaskDefinitions'],
              resources: ['*']
            }),

            // CloudWatch Logs permissions for ETL layer Lambda logs
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: [
                'logs:GetLogEvents', 
                'logs:DescribeLogStreams', 
                'logs:DescribeLogGroups', 
                'logs:DeleteLogGroup',
                'logs:CreateLogGroup',
                'logs:PutRetentionPolicy',
                'logs:TagResource',
                'logs:UntagResource',
                'logs:ListTagsForResource'
              ],
              resources: [
                `arn:${cdk.Stack.of(this).partition}:logs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:log-group:/aws/lambda/TAK-${envConfig.stackName}-CloudTAK-layer-*`
              ]
            }),
            // CloudWatch permissions for alarms
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: ['cloudwatch:DescribeAlarms', 'cloudwatch:GetMetricStatistics', 'cloudwatch:PutMetricAlarm', 'cloudwatch:DeleteAlarms'],
              resources: ['*']
            }),
            // KMS permissions for decryption
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: ['kms:Decrypt', 'kms:GenerateDataKey'],
              resources: ['*'],
              conditions: {
                StringEquals: {
                  'kms:ViaService': [
                    `s3.${cdk.Stack.of(this).region}.amazonaws.com`,
                    `secretsmanager.${cdk.Stack.of(this).region}.amazonaws.com`,
                    `sqs.${cdk.Stack.of(this).region}.amazonaws.com`
                  ]
                }
              }
            }),
            // SNS permissions for alarm notifications
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: ['sns:Publish'],
              resources: [`arn:${cdk.Stack.of(this).partition}:sns:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:TAK-${envConfig.stackName}-*-urgency`]
            }),
            // EventBridge permissions for scheduled Lambda functions
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: [
                'events:PutRule',
                'events:PutTargets',
                'events:DeleteRule',
                'events:RemoveTargets',
                'events:DescribeRule',
                'events:UntagResource',
                'events:TagResource',
                'events:ListTagsForResource',
              ],
              resources: [`arn:${cdk.Stack.of(this).partition}:events:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:rule/TAK-${envConfig.stackName}-CloudTAK-layer-*`]
            }),
            // API Gateway permissions for webhook functionality
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: ['apigateway:POST', 'apigateway:DELETE', 'apigateway:GET', 'apigateway:PUT'],
              resources: [`arn:${cdk.Stack.of(this).partition}:apigateway:${cdk.Stack.of(this).region}::/apis/*/routes*`, `arn:${cdk.Stack.of(this).partition}:apigateway:${cdk.Stack.of(this).region}::/apis/*/integrations*`]
            }),
            // Inbound email: the API registers each layer's email address with the
            // mail router as an SSM parameter (created by the layer's own
            // CloudFormation stack, which runs with this role's credentials).
            // Path prefix matches the Mail construct's LAYER_PREFIX export.
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: [
                'ssm:PutParameter',
                'ssm:GetParameters',
                'ssm:DeleteParameter',
                'ssm:AddTagsToResource',
                'ssm:RemoveTagsFromResource',
                'ssm:ListTagsForResource'
              ],
              resources: [`arn:${cdk.Stack.of(this).partition}:ssm:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:parameter${mailLayerPrefix(cdk.Stack.of(this).stackName)}*`]
            }),
            // Lambda event source mapping permissions
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: ['lambda:CreateEventSourceMapping', 'lambda:UpdateEventSourceMapping', 'lambda:GetEventSourceMapping', 'lambda:DeleteEventSourceMapping', 'lambda:AddPermission', 'lambda:RemovePermission'],
              resources: ['*']
            }),
            // SQS queue management permissions
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: ['sqs:CreateQueue', 'sqs:DeleteQueue', 'sqs:SetQueueAttributes', 'sqs:ListQueueTags', 'sqs:TagQueue', 'sqs:UntagQueue'],
              resources: [`arn:${cdk.Stack.of(this).partition}:sqs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:TAK-${envConfig.stackName}-CloudTAK-layer-*`]
            }),
            // ECR permissions — GetAuthorizationToken is global (not repo-scoped)
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: ['ecr:GetAuthorizationToken'],
              resources: ['*']
            }),
            // ECR permissions (matching old CloudFormation)
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: ['ecr:Describe*', 'ecr:Get*', 'ecr:BatchGetImage', 'ecr:BatchDeleteImage', 'ecr:List*'],
              resources: [etlEcrRepository.repositoryArn]
            })
          ]
        })
      }
    });
    
    // Create execution role
    const executionRole = this.executionRole = new cdk.aws_iam.Role(this, 'ExecRole', {
      assumedBy: new cdk.aws_iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
      ],
      inlinePolicies: {
        'api-logging': new cdk.aws_iam.PolicyDocument({
          statements: [
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents', 'logs:DescribeLogStreams'],
              resources: [`arn:${cdk.Stack.of(this).partition}:logs:*:*:*`]
            }),
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: ['ecr:GetAuthorizationToken'],
              resources: ['*']
            }),
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: ['ecr:BatchCheckLayerAvailability', 'ecr:GetDownloadUrlForLayer', 'ecr:BatchGetImage'],
              resources: [ecrRepository.repositoryArn]
            }),
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: ['kms:Decrypt', 'kms:GenerateDataKey'],
              resources: ['*'],
              conditions: {
                StringEquals: {
                  'kms:ViaService': [
                    `secretsmanager.${cdk.Stack.of(this).region}.amazonaws.com`,
                    `ecr.${cdk.Stack.of(this).region}.amazonaws.com`,
                    `s3.${cdk.Stack.of(this).region}.amazonaws.com`
                  ]
                }
              }
            })
          ]
        })
      },
      path: '/service-role/'
    });

    // Create Fargate task definition
    this.taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDefinition', {
      family: `TAK-${envConfig.stackName}-CloudTAK`,
      cpu: envConfig.ecs.taskCpu,
      memoryLimitMiB: envConfig.ecs.taskMemory,
      taskRole,
      executionRole
    });

    // Import TAK admin certificate secret for base64 encoded certificate
    const takAdminCertSecret = secretsmanager.Secret.fromSecretCompleteArn(
      this, 
      'TakAdminCertSecret',
      cdk.Fn.importValue(createTakImportValue(envConfig.stackName, TAK_EXPORT_NAMES.TAK_ADMIN_CERT_SECRET_ARN))
    );
    

    
    // Import S3 config bucket from BaseInfra
    const configBucket = s3.Bucket.fromBucketArn(
      this,
      'ConfigBucket',
      cdk.Fn.importValue(createBaseImportValue(envConfig.stackName, BASE_EXPORT_NAMES.S3_ENV_CONFIG))
    );

    // Grant S3 access for environment files
    configBucket.grantRead(executionRole);
    configBucket.grantRead(taskRole);

    // Grant access to secrets
    databaseSecret.grantRead(executionRole);
    signingSecret.grantRead(executionRole);
    takAdminCertSecret.grantRead(taskRole); // Task role for application access
    connectionStringSecret.grantRead(executionRole);
    adminPasswordSecret.grantRead(executionRole);
    geofenceSecret.grantRead(executionRole);
    
    // Grant access to the scoped Authentik service-account token if OIDC is
    // enabled. This is a dedicated, non-superuser token (tak-cloudtak-service)
    // limited to exactly what AuthentikProvider calls: view/add/delete_user,
    // add_token, reset_user_password on Users; view_group, add_user_to_group
    // on Groups. Nothing on Applications/Providers/Outposts/Flows/Stages/
    // Policies/Blueprints - do not widen this without checking every call in
    // authentik-provider.ts against that set first, since a missing
    // permission surfaces as a runtime 403, not a build error.
    if (envConfig.cloudtak.oidcEnabled) {
      const authentikCloudTakSecret = secretsmanager.Secret.fromSecretCompleteArn(
        this,
        'AuthentikCloudTakSecretForGrant',
        cdk.Fn.importValue(createAuthImportValue(envConfig.stackName, AUTH_EXPORT_NAMES.AUTHENTIK_CLOUDTAK_TOKEN_ARN))
      );
      authentikCloudTakSecret.grantRead(taskRole);

      // OIDC_CLIENT_SECRET is injected via ecs.Secret.fromSecretsManager() below,
      // which is resolved by the execution role at container startup (not the
      // task role, which is only for in-app SDK calls like the Authentik API token).
      if (oidcClientSecret) {
        oidcClientSecret.grantRead(executionRole);
      }
    }
    // SCIM_TOKEN is injected the same way (execution role, at container startup)
    if (scimToken) {
      scimToken.grantRead(executionRole);
    }



    // Determine container image source
    const containerImage = this.containerImage = dockerImageAsset 
      ? ecs.ContainerImage.fromDockerImageAsset(dockerImageAsset)
      : (() => {
          const cloudtakImageTag = cdk.Stack.of(this).node.tryGetContext('cloudtakImageTag');
          const apiTag = cloudtakImageTag || 'latest';
          return ecs.ContainerImage.fromEcrRepository(ecrRepository, apiTag);
        })();

    // Prepare container definition options
    let containerDefinitionOptions: ecs.ContainerDefinitionOptions = {
      image: containerImage,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'cloudtak-api',
        logGroup: logGroup
      }),
      // Restart the container in place when the process exits, instead of ECS
      // replacing the whole task. Matches upstream v13.70.0, which sets
      // RestartPolicy { Enabled: true, RestartAttemptPeriod: 300 } on all three
      // containers (cloudformation/lib/api.js, events.js, stateful.js).
      //
      // An in-place restart skips Fargate placement, the image pull, ENI
      // attachment and target group re-registration, so recovery from a
      // transient crash is seconds rather than tens of seconds.
      //
      // restartAttemptPeriod is what stops a crash loop: a container must stay
      // up for this long before another restart is allowed. 300s is also the
      // AWS default, but it is stated here because it is load-bearing.
      //
      // Trade-off, accepted: a container that starts, crashes and restarts in
      // place keeps the task RUNNING, so it does not count as a failed task for
      // the deployment circuit breaker. The ALB health check is still the
      // backstop - an unhealthy target does count - so a broken deploy still
      // rolls back, just via health checks rather than task failures.
      enableRestartPolicy: true,
      restartAttemptPeriod: cdk.Duration.seconds(300),
      // Environment variables for application configuration (matching old CloudFormation)
      environment: {
        'AWS_REGION': cdk.Stack.of(this).region,
        'CLOUDTAK_Mode': 'AWS',
        'StackName': `TAK-${envConfig.stackName}-CloudTAK`,
        // Stateless tier: serves the web app and REST API, holds no TAK Server
        // connections. Without hubAlbDnsName the container stays in single-service
        // 'both' mode, which is what runs before the split is wired.
        ...(hubAlbDnsName ? {
          'CLOUDTAK_Server_Mode': 'api',
          'CLOUDTAK_Hub_URL': `http://${hubAlbDnsName}`
        } : {}),
        'ASSET_BUCKET': assetBucketName,
        'API_URL': serviceUrl.startsWith('http') ? serviceUrl : `https://${serviceUrl}`,
        // Inbound email domain. Set explicitly (the API would otherwise derive the
        // same `mail.<API_URL host>`); must equal the Mail construct's mail domain.
        'MAIL_DOMAIN': mailDomainFor(serviceUrl.replace(/^https?:\/\//, '')),
        'VpcId': cdk.Fn.importValue(createBaseImportValue(envConfig.stackName, BASE_EXPORT_NAMES.VPC_ID)),
        'SubnetPublicA': cdk.Fn.importValue(createBaseImportValue(envConfig.stackName, BASE_EXPORT_NAMES.SUBNET_PUBLIC_A)),
        'SubnetPublicB': cdk.Fn.importValue(createBaseImportValue(envConfig.stackName, BASE_EXPORT_NAMES.SUBNET_PUBLIC_B)),
        'MediaSecurityGroup': mediaSecurityGroup.securityGroupId,
        // CloudTAK Server configuration
        'CLOUDTAK_Server_name': environment === 'prod' ? 'TAK.NZ' : `TAK.NZ ${envConfig.stackName}`,
        'CLOUDTAK_Server_url': `ssl://${cdk.Fn.importValue(createTakImportValue(envConfig.stackName, TAK_EXPORT_NAMES.TAK_SERVICE_NAME))}:8089`,
        'CLOUDTAK_Server_api': `https://${cdk.Fn.importValue(createTakImportValue(envConfig.stackName, TAK_EXPORT_NAMES.TAK_SERVICE_NAME))}:8443`,
        'CLOUDTAK_Server_webtak': `https://${cdk.Fn.importValue(createTakImportValue(envConfig.stackName, TAK_EXPORT_NAMES.TAK_SERVICE_NAME))}:8446`,
        'CLOUDTAK_Server_auth_password': 'atakatak',
        'CLOUDTAK_Server_auth_p12_secret_arn': cdk.Fn.importValue(createTakImportValue(envConfig.stackName, TAK_EXPORT_NAMES.TAK_ADMIN_CERT_SECRET_ARN)),
        // PR #717 - Configurable ECR and ECS names
        'ECR_TASKS_REPOSITORY_NAME': etlEcrRepository.repositoryName,
        'ECS_CLUSTER_PREFIX': `TAK-${envConfig.stackName}-BaseInfra`,
        // The TLS ports of the media-infra load balancer (RTSPS and RTMPS) and whether its
        // plaintext RTSP and RTMP ports exist, which MediaMTX cannot report itself
        'MEDIA_RTSPS_PORT': '8555',
        'MEDIA_RTMPS_PORT': '1936',
        'MEDIA_INSECURE_PORTS': envConfig.mediainfra.enableInsecurePorts === false ? 'false' : 'true',
        // Media server URL
        'MEDIA_URL': `https://${envConfig.mediainfra.mediaHostname}.${cdk.Fn.importValue(createBaseImportValue(envConfig.stackName, BASE_EXPORT_NAMES.HOSTED_ZONE_NAME))}:9997`,
        // OIDC configuration - CloudTAK performs the Authorization Code flow
        // itself (GET /login/oidc, GET /login/oidc/callback); there is no ALB
        // OIDC listener action.
        'OIDC_ENABLED': envConfig.cloudtak.oidcEnabled ? 'true' : 'false',
        ...(envConfig.cloudtak.oidcEnabled && {
          'OIDC_DISCOVERY_URL': `${cdk.Fn.importValue(createAuthImportValue(envConfig.stackName, AUTH_EXPORT_NAMES.AUTHENTIK_URL))}/application/o/${envConfig.cloudtak.authentikAppSlug || 'cloudtak'}/.well-known/openid-configuration`,
          'OIDC_CLIENT_ID': oidcClientId || '',
          'OIDC_SCOPES': 'openid profile email groups',
          'AUTHENTIK_URL': cdk.Fn.importValue(createAuthImportValue(envConfig.stackName, AUTH_EXPORT_NAMES.AUTHENTIK_URL)),
          'AUTHENTIK_APP_SLUG': envConfig.cloudtak.authentikAppSlug || 'cloudtak',
          'AUTHENTIK_API_TOKEN_SECRET_ARN': cdk.Fn.importValue(createAuthImportValue(envConfig.stackName, AUTH_EXPORT_NAMES.AUTHENTIK_CLOUDTAK_TOKEN_ARN)),
          'SYNC_AUTHENTIK_ATTRIBUTES_ON_LOGIN': envConfig.cloudtak.syncAuthentikAttributesOnLogin !== false ? 'true' : 'false',
          'OIDC_FORCED': envConfig.cloudtak.oidcForced !== false ? 'true' : 'false',
          'OIDC_SYSTEM_ADMIN_GROUP': envConfig.cloudtak.oidcSystemAdminGroup || 'CloudTAKSystemAdmin',
          'OIDC_AGENCY_ADMIN_GROUP_PREFIX': envConfig.cloudtak.oidcAgencyAdminGroupPrefix || 'CloudTAKAgency',
          'AUTHENTIK_CHANNEL_GROUP_PREFIX': envConfig.cloudtak.authentikChannelGroupPrefix || 'tak_',
          'LOCAL_ONLY_ACCOUNTS': (envConfig.cloudtak.localOnlyAccounts || []).join(',')
        }),
        // Env-driven SCIM: the API checks SCIM_TOKEN instead of the database scim::* settings
        ...(scimToken && { 'SCIM_ENABLED': 'true' })
      },
      secrets: {
        'SigningSecret': ecs.Secret.fromSecretsManager(signingSecret),
        'POSTGRES': ecs.Secret.fromSecretsManager(connectionStringSecret),
        'CLOUDTAK_ADMIN_USERNAME': ecs.Secret.fromSecretsManager(adminPasswordSecret, 'username'),
        'CLOUDTAK_ADMIN_PASSWORD': ecs.Secret.fromSecretsManager(adminPasswordSecret, 'password'),
        'CLOUDTAK_Config_geofence_password': ecs.Secret.fromSecretsManager(geofenceSecret),
        ...(envConfig.cloudtak.oidcEnabled && oidcClientSecret && {
          'OIDC_CLIENT_SECRET': ecs.Secret.fromSecretsManager(oidcClientSecret),
        }),
        ...(scimToken && {
          'SCIM_TOKEN': ecs.Secret.fromSecretsManager(scimToken),
        })
      }
    };

    // Add environment files if S3 config file is enabled
    if (envConfig.cloudtak.useS3CloudTAKConfigFile) {
      containerDefinitionOptions = {
        ...containerDefinitionOptions,
        environmentFiles: [
          ecs.EnvironmentFile.fromBucket(configBucket, 'cloudtak-config.env')
        ]
      };
    }

    // Publish the finalised container config for CloudTakStateful to reuse.
    this.containerEnvironment = containerDefinitionOptions.environment as Record<string, string>;
    this.containerSecrets = containerDefinitionOptions.secrets as Record<string, ecs.Secret>;
    this.containerEnvironmentFiles = containerDefinitionOptions.environmentFiles;

    // Add container to task definition
    const container = this.taskDefinition.addContainer('api', containerDefinitionOptions);

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
      assignPublicIp: false,
      enableExecuteCommand: envConfig.ecs.enableEcsExec,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [ecsSecurityGroup],
      // Roll forward at full capacity in every environment, matching upstream
      // v13.70.0 - cloudformation/lib/api.js declares no DeploymentConfiguration,
      // taking the ECS default of 100/200.
      //
      // This was previously `prod ? 100 : 50`, which let dev-test deploys run at
      // half capacity. That is not an outage with desiredCount 2, but it made
      // dev-test a weaker rehearsal for prod than it should be.
      minHealthyPercent: 100,
      maxHealthyPercent: 200
    });

    // Attach service to ALB target group for load balancing
    this.service.attachToApplicationTargetGroup(albTargetGroup);

    // Horizontal scaling for the stateless tier, matching upstream v13.70.0
    // (cloudformation/lib/api.js).
    //
    // This is only safe because the hub split moved ConnectionPool out of this
    // service - it is per-process in-memory state, so before the split a second
    // task would have duplicated every TAK Server session and broken layer CoT
    // delivery. Do not enable this without CLOUDTAK_Server_Mode=api.
    //
    // CPU only: upstream deliberately has no memory scaling policy here (unlike
    // the Events service), so neither do we.
    if (hubAlbDnsName) {
      const scaling = this.service.autoScaleTaskCount({
        minCapacity: envConfig.ecs.desiredCount,
        maxCapacity: envConfig.ecs.maxCapacity ?? 10
      });

      scaling.scaleOnCpuUtilization('ApiCPUScaling', {
        targetUtilizationPercent: envConfig.ecs.targetCpuUtilization ?? 70,
        scaleInCooldown: cdk.Duration.seconds(300),
        scaleOutCooldown: cdk.Duration.seconds(60)
      });
    }

    // Export API URL for Lambda layer imports
    new cdk.CfnOutput(this, 'ApiUrlOutput', {
      description: 'Hosted API Location',
      value: serviceUrl.startsWith('http') ? serviceUrl : `https://${serviceUrl}`,
      exportName: `TAK-${envConfig.stackName}-CloudTAK-hosted`
    });
  }
}