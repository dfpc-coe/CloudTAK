/**
 * CloudTAK Application Stack
 * 
 * This stack deploys the CloudTAK application layer including:
 * - Aurora PostgreSQL database (serverless for dev-test, provisioned for prod)
 * - ECS Fargate service for the API
 * - Application Load Balancer with HTTPS
 * - AWS Batch for ETL processing
 * - Lambda functions for event processing
 * - S3 bucket for assets
 * - Secrets Manager for application secrets
 */

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecrAssets from 'aws-cdk-lib/aws-ecr-assets';

import { Database } from './constructs/database';
import { SecurityGroups } from './constructs/security-groups';
import { LoadBalancer } from './constructs/load-balancer';
import { EcsService } from './constructs/ecs-service';
import { Route53 } from './constructs/route53';
import { S3Resources } from './constructs/s3-resources';
import { Batch } from './constructs/batch';
import { Secrets } from './constructs/secrets';
import { LambdaFunctions } from './constructs/lambda-functions';
import { Alarms } from './constructs/alarms';
import { AuthentikUserCreator } from './constructs/authentik-user-creator';
import { registerOutputs } from './outputs';
import { createBaseImportValue, BASE_EXPORT_NAMES } from './cloudformation-imports';
import { ContextEnvironmentConfig } from './stack-config';
import { generateStandardTags, TagDefaults } from './utils/tag-helpers';
import { ConfigValidator } from './utils/config-validator';

export interface CloudTakStackProps extends cdk.StackProps {
  environment: 'prod' | 'dev-test';
  envConfig: ContextEnvironmentConfig;
}

export class CloudTakStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CloudTakStackProps) {
    super(scope, id, {
      ...props,
      description: 'TAK CloudTAK Application Layer - Web Client and ETL Services',
    });

    // Validate configuration early
    ConfigValidator.validateEnvironmentConfig(props.envConfig, props.environment);

    const { environment, envConfig } = props;

    // Apply comprehensive tagging
    const standardTags = generateStandardTags(
      envConfig,
      environment,
      this.node.tryGetContext('defaults') as TagDefaults
    );
    
    Object.entries(standardTags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });

    // Import base infrastructure resources from BaseInfra stack
    const vpc = ec2.Vpc.fromVpcAttributes(this, 'VPC', {
      vpcId: cdk.Fn.importValue(createBaseImportValue(envConfig.stackName, BASE_EXPORT_NAMES.VPC_ID)),
      vpcCidrBlock: cdk.Fn.importValue(createBaseImportValue(envConfig.stackName, BASE_EXPORT_NAMES.VPC_CIDR_IPV4)),
      availabilityZones: this.availabilityZones.slice(0, 2),
      publicSubnetIds: [
        cdk.Fn.importValue(createBaseImportValue(envConfig.stackName, BASE_EXPORT_NAMES.SUBNET_PUBLIC_A)),
        cdk.Fn.importValue(createBaseImportValue(envConfig.stackName, BASE_EXPORT_NAMES.SUBNET_PUBLIC_B))
      ],
      privateSubnetIds: [
        cdk.Fn.importValue(createBaseImportValue(envConfig.stackName, BASE_EXPORT_NAMES.SUBNET_PRIVATE_A)),
        cdk.Fn.importValue(createBaseImportValue(envConfig.stackName, BASE_EXPORT_NAMES.SUBNET_PRIVATE_B))
      ]
    });

    const ecsCluster = ecs.Cluster.fromClusterAttributes(this, 'ECSCluster', {
      clusterName: `TAK-${envConfig.stackName}-BaseInfra`,
      vpc: vpc
    });

    const kmsKey = kms.Key.fromKeyArn(this, 'KMSKey', 
      cdk.Fn.importValue(createBaseImportValue(envConfig.stackName, BASE_EXPORT_NAMES.KMS_KEY))
    );
    
    // Add key policy for cross-service access (if key allows policy modifications)
    try {
      (kmsKey as kms.Key).addToResourcePolicy(new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        principals: [
          new cdk.aws_iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
          new cdk.aws_iam.ServicePrincipal('lambda.amazonaws.com'),
          new cdk.aws_iam.ServicePrincipal('batch.amazonaws.com')
        ],
        actions: ['kms:Decrypt', 'kms:GenerateDataKey'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'aws:SourceAccount': this.account
          }
        }
      }));
    } catch (e) {
      // Key policy modification not supported for imported keys
    }

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: cdk.Fn.importValue(createBaseImportValue(envConfig.stackName, BASE_EXPORT_NAMES.HOSTED_ZONE_ID)),
      zoneName: cdk.Fn.importValue(createBaseImportValue(envConfig.stackName, BASE_EXPORT_NAMES.HOSTED_ZONE_NAME))
    });

    const certificate = acm.Certificate.fromCertificateArn(this, 'Certificate',
      cdk.Fn.importValue(createBaseImportValue(envConfig.stackName, BASE_EXPORT_NAMES.CERTIFICATE_ARN))
    );

    // Determine container image strategy (local build vs pre-built images)
    const usePreBuiltImages = this.node.tryGetContext('usePreBuiltImages') ?? false;
    
    let ecrRepository: ecr.IRepository;
    let dockerImageAsset: ecrAssets.DockerImageAsset | undefined;
    let eventsImageAsset: ecrAssets.DockerImageAsset | undefined;
    let tilesImageAsset: ecrAssets.DockerImageAsset | undefined;
    let dataImageAsset: ecrAssets.DockerImageAsset | undefined;
    
    if (usePreBuiltImages) {
      // Use BaseInfra ECR repository for CI/CD deployments
      ecrRepository = ecr.Repository.fromRepositoryArn(this, 'ImportedECRRepository',
        cdk.Fn.importValue(createBaseImportValue(envConfig.stackName, BASE_EXPORT_NAMES.ECR_REPO))
      );
    } else {
      // Create Docker image assets for local deployments
      dockerImageAsset = new ecrAssets.DockerImageAsset(this, 'CloudTAKDockerAsset', {
        directory: '../api',
        file: 'Dockerfile',
        buildArgs: {
          NODE_ENV: environment === 'prod' ? 'production' : 'development'
        },
        exclude: [
          'node_modules/**',
          '**/.git/**',
          '**/.vscode/**',
          '**/.idea/**',
          '**/*.log',
          '**/*.tmp',
          '**/.DS_Store',
          '**/Thumbs.db'
        ]
      });
      
      eventsImageAsset = new ecrAssets.DockerImageAsset(this, 'EventsDockerAsset', {
        directory: '../tasks/events',
        file: 'Dockerfile',
        buildArgs: {
          NODE_ENV: environment === 'prod' ? 'production' : 'development'
        },
        exclude: [
          'node_modules/**',
          '**/.git/**',
          '**/.vscode/**',
          '**/.idea/**',
          '**/*.log',
          '**/*.tmp',
          '**/.DS_Store',
          '**/Thumbs.db'
        ]
      });
      
      tilesImageAsset = new ecrAssets.DockerImageAsset(this, 'TilesDockerAsset', {
        directory: '../tasks/pmtiles',
        file: 'Dockerfile',
        buildArgs: {
          NODE_ENV: environment === 'prod' ? 'production' : 'development'
        },
        exclude: [
          'node_modules/**',
          '**/.git/**',
          '**/.vscode/**',
          '**/.idea/**',
          '**/*.log',
          '**/*.tmp',
          '**/.DS_Store',
          '**/Thumbs.db'
        ]
      });
      
      dataImageAsset = new ecrAssets.DockerImageAsset(this, 'DataDockerAsset', {
        directory: '../tasks/data',
        file: 'Dockerfile',
        buildArgs: {
          NODE_ENV: environment === 'prod' ? 'production' : 'development'
        },
        exclude: [
          'node_modules/**',
          '**/.git/**',
          '**/.vscode/**',
          '**/.idea/**',
          '**/*.log',
          '**/*.tmp',
          '**/.DS_Store',
          '**/Thumbs.db'
        ]
      });
      
      ecrRepository = dockerImageAsset.repository;
    }

    // Create application secrets (signing secret for API)
    const secrets = new Secrets(this, 'Secrets', {
      envConfig,
      kmsKey
    });

    // Create security groups for different components
    const securityGroups = new SecurityGroups(this, 'SecurityGroups', {
      vpc,
      envConfig
    });

    // Create Aurora PostgreSQL database (serverless for dev-test, provisioned for prod)
    const database = new Database(this, 'Database', {
      environment,
      envConfig,
      vpc,
      kmsKey,
      securityGroups: [securityGroups.database]
    });

    // Create S3 resources for asset storage (without Lambda trigger initially)
    const s3Resources = new S3Resources(this, 'S3Resources', {
      envConfig,
      kmsKey
    });

    // Import ALB access logs bucket from BaseInfra
    const logsBucket = cdk.aws_s3.Bucket.fromBucketArn(this, 'ImportedLogsBucket',
      cdk.Fn.importValue(createBaseImportValue(envConfig.stackName, BASE_EXPORT_NAMES.S3_ELB_LOGS))
    );
    
    // Create Application Load Balancer with HTTPS
    const loadBalancer = new LoadBalancer(this, 'LoadBalancer', {
      envConfig,
      vpc,
      albSecurityGroup: securityGroups.alb,
      certificate,
      logsBucket
    });

    // Create Route53 DNS record for the service
    const route53Records = new Route53(this, 'Route53', {
      hostedZone,
      hostname: envConfig.cloudtak.hostname,
      loadBalancer: loadBalancer.alb
    });

    // Create Lambda functions for event processing
    const lambdaFunctions = new LambdaFunctions(this, 'LambdaFunctions', {
      envConfig,
      ecrRepository,
      eventsImageAsset,
      tilesImageAsset,
      assetBucketName: s3Resources.assetBucket.bucketName,
      serviceUrl: route53Records.serviceUrl,
      signingSecret: secrets.signingSecret,
      kmsKey,
      hostedZone,
      certificate
    });

    // Add S3 notification after Lambda is created
    s3Resources.assetBucket.addEventNotification(
      cdk.aws_s3.EventType.OBJECT_CREATED,
      new cdk.aws_s3_notifications.LambdaDestination(lambdaFunctions.eventLambda)
    );

    // Create ECS Fargate service for the CloudTAK API
    const ecsService = new EcsService(this, 'EcsService', {
      environment,
      envConfig,
      vpc,
      ecsCluster,
      ecsSecurityGroup: securityGroups.ecs,
      albTargetGroup: loadBalancer.targetGroup,
      ecrRepository,
      dockerImageAsset,
      databaseSecret: database.masterSecret,
      databaseHostname: database.cluster.clusterEndpoint.hostname,
      connectionStringSecret: database.connectionStringSecret,
      assetBucketName: s3Resources.assetBucket.bucketName,
      signingSecret: secrets.signingSecret,
      adminPasswordSecret: secrets.adminPasswordSecret,
      serviceUrl: route53Records.serviceUrl
    });

    // Create AWS Batch resources for ETL processing
    const batch = new Batch(this, 'Batch', {
      envConfig,
      vpc,
      ecrRepository,
      dataImageAsset,
      assetBucketName: s3Resources.assetBucket.bucketName,
      serviceUrl: route53Records.serviceUrl
    });

    // Create monitoring and alarms
    const alarms = new Alarms(this, 'Alarms', {
      envConfig,
      eventLambda: lambdaFunctions.eventLambda
    });

    // Create Authentik user for CloudTAK admin
    const authentikUrl = cdk.Fn.importValue(`TAK-${envConfig.stackName}-AuthInfra-AuthentikUrl`);
    
    new AuthentikUserCreator(this, 'AuthentikUserCreator', {
      stackName: envConfig.stackName,
      adminPasswordSecret: secrets.adminPasswordSecret,
      authentikUrl: authentikUrl,
      takAdminEmail: envConfig.cloudtak.takAdminEmail
    });

    // Ensure ECS service waits for database and Route53 records
    ecsService.service.node.addDependency(database.cluster);
    ecsService.service.node.addDependency(database.connectionStringSecret);
    ecsService.service.node.addDependency(route53Records.aRecord);
    ecsService.service.node.addDependency(route53Records.aaaaRecord);

    // Register CloudFormation outputs
    registerOutputs({
      stack: this,
      serviceUrl: route53Records.serviceUrl,
      loadBalancer: loadBalancer.alb,
      database: database.cluster,
      assetBucket: s3Resources.assetBucket,
      ecrRepository: dockerImageAsset ? dockerImageAsset.repository : undefined
    });
  }
}