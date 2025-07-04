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
import { createTakImportValue, TAK_EXPORT_NAMES, createBaseImportValue, BASE_EXPORT_NAMES } from '../cloudformation-imports';
import { AuthentikUserCreator } from './authentik-user-creator';

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
  connectionStringSecret: secretsmanager.ISecret;
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
      connectionStringSecret,
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

    // Create task role with comprehensive permissions
    const taskRole = new cdk.aws_iam.Role(this, 'TaskRole', {
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
            // S3 bucket access
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket', 's3:GetBucketLocation'],
              resources: [`arn:${cdk.Stack.of(this).partition}:s3:::${assetBucketName}`, `arn:${cdk.Stack.of(this).partition}:s3:::${assetBucketName}/*`]
            }),

            // SQS permissions for layer queues
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: ['sqs:SendMessage', 'sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes', 'sqs:GetQueueUrl'],
              resources: [`arn:${cdk.Stack.of(this).partition}:sqs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:tak-cloudtak-${environment}-layer-*`]
            }),
            // Secrets Manager access
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: ['secretsmanager:Describe*', 'secretsmanager:Get*', 'secretsmanager:List*'],
              resources: [`arn:${cdk.Stack.of(this).partition}:secretsmanager:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:secret:TAK-${envConfig.stackName}-*`]
            }),

            // Lambda permissions for layer invocation
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: ['lambda:InvokeFunction'],
              resources: [`arn:${cdk.Stack.of(this).partition}:lambda:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:function:TAK-${envConfig.stackName}-layer-*`]
            }),
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: ['cloudformation:DescribeStacks'],
              resources: [`arn:${cdk.Stack.of(this).partition}:cloudformation:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:stack/TAK-${envConfig.stackName}-layer-*`]
            }),
            // Batch job permissions
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: ['batch:SubmitJob', 'batch:ListJobs', 'batch:DescribeJobs', 'batch:CancelJob'],
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
                `arn:${cdk.Stack.of(this).partition}:iam::${cdk.Stack.of(this).account}:role/service-role/TAK-${envConfig.stackName}-media-*`
              ]
            }),
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: ['ec2:DescribeNetworkInterfaces', 'ecs:ListTaskDefinitions'],
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
            // ECR permissions
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: ['ecr:ListImages', 'ecr:DescribeImages'],
              resources: [ecrRepository.repositoryArn]
            })
          ]
        })
      }
    });
    
    // Create execution role
    const executionRole = new cdk.aws_iam.Role(this, 'ExecRole', {
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
                    `ecr.${cdk.Stack.of(this).region}.amazonaws.com`
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
    
    // Create admin password secret
    const adminPasswordSecret = new secretsmanager.Secret(this, 'AdminPasswordSecret', {
      description: 'CloudTAK Admin Username and Password',
      secretName: `TAK-${envConfig.stackName}-CloudTAK/API/Admin-Password`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'admin' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        passwordLength: 16
      }
    });
    
    // Grant access to secrets
    databaseSecret.grantRead(executionRole);
    signingSecret.grantRead(executionRole);
    takAdminCertSecret.grantRead(taskRole); // Task role for application access
    connectionStringSecret.grantRead(executionRole);
    adminPasswordSecret.grantRead(executionRole);

    // Create Authentik user during deployment
    new AuthentikUserCreator(this, 'AuthentikUserCreator', {
      stackName: envConfig.stackName,
      adminPasswordSecret,
      authentikUrl: cdk.Fn.importValue(`TAK-${envConfig.stackName}-AuthInfra-AuthentikUrl`)
    });

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
      // Environment variables for application configuration (matching old CloudFormation)
      environment: {
        'AWS_REGION': cdk.Stack.of(this).region,
        'CLOUDTAK_Mode': 'AWS',
        'StackName': `TAK-${envConfig.stackName}-CloudTAK`,
        'ASSET_BUCKET': assetBucketName,
        'API_URL': serviceUrl,
        'VpcId': cdk.Fn.importValue(createBaseImportValue(envConfig.stackName, BASE_EXPORT_NAMES.VPC_ID)),
        'SubnetPublicA': cdk.Fn.importValue(createBaseImportValue(envConfig.stackName, BASE_EXPORT_NAMES.SUBNET_PUBLIC_A)),
        'SubnetPublicB': cdk.Fn.importValue(createBaseImportValue(envConfig.stackName, BASE_EXPORT_NAMES.SUBNET_PUBLIC_B)),
        // CloudTAK Server configuration
        'CLOUDTAK_Server_name': `TAK.NZ ${environment === 'prod' ? 'Production' : 'Development'} Server`,
        'CLOUDTAK_Server_url': `ssl://${cdk.Fn.importValue(createTakImportValue(envConfig.stackName, TAK_EXPORT_NAMES.TAK_SERVICE_NAME))}:8089`,
        'CLOUDTAK_Server_api': `https://${cdk.Fn.importValue(createTakImportValue(envConfig.stackName, TAK_EXPORT_NAMES.TAK_SERVICE_NAME))}:8443`,
        'CLOUDTAK_Server_webtak': `https://${cdk.Fn.importValue(createTakImportValue(envConfig.stackName, TAK_EXPORT_NAMES.TAK_SERVICE_NAME))}:8446`,
        'CLOUDTAK_Server_auth_password': 'atakatak',
        'CLOUDTAK_Server_auth_p12_secret_arn': cdk.Fn.importValue(createTakImportValue(envConfig.stackName, TAK_EXPORT_NAMES.TAK_ADMIN_CERT_SECRET_ARN)),
        // PR #717 - Configurable ECR and ECS names
        'ECR_TASKS_REPOSITORY_NAME': envConfig.cloudtak.ecrRepositoryName,
        'ECS_CLUSTER_PREFIX': `TAK-${envConfig.stackName}-BaseInfra`
      },
      secrets: {
        'SigningSecret': ecs.Secret.fromSecretsManager(signingSecret),
        'POSTGRES': ecs.Secret.fromSecretsManager(connectionStringSecret),
        'CLOUDTAK_ADMIN_USERNAME': ecs.Secret.fromSecretsManager(adminPasswordSecret, 'username'),
        'CLOUDTAK_ADMIN_PASSWORD': ecs.Secret.fromSecretsManager(adminPasswordSecret, 'password')
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
      assignPublicIp: false,
      enableExecuteCommand: envConfig.ecs.enableEcsExec,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [ecsSecurityGroup],
      minHealthyPercent: environment === 'prod' ? 100 : 50,
      maxHealthyPercent: 200
    });

    // Attach service to ALB target group for load balancing
    this.service.attachToApplicationTargetGroup(albTargetGroup);
  }
}