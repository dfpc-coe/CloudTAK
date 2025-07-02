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
import { registerOutputs } from './outputs';
import { createBaseImportValue, BASE_EXPORT_NAMES } from './cloudformation-imports';
import { ContextEnvironmentConfig } from './stack-config';

export interface CloudTakStackProps extends cdk.StackProps {
  environment: 'prod' | 'dev-test';
  envConfig: ContextEnvironmentConfig;
}

export class CloudTakStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CloudTakStackProps) {
    super(scope, id, {
      ...props,
      description: 'TAK CloudTAK Application Layer - API and ETL Services',
    });

    const { environment, envConfig } = props;

    // Import base infrastructure resources from BaseInfra stack
    const vpc = ec2.Vpc.fromVpcAttributes(this, 'VPC', {
      vpcId: cdk.Fn.importValue(createBaseImportValue(envConfig.stackName, BASE_EXPORT_NAMES.VPC_ID)),
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
    
    if (usePreBuiltImages) {
      // Use BaseInfra ECR repository for CI/CD deployments
      ecrRepository = ecr.Repository.fromRepositoryArn(this, 'ImportedECRRepository',
        cdk.Fn.importValue(createBaseImportValue(envConfig.stackName, BASE_EXPORT_NAMES.ECR_REPO))
      );
    } else {
      // Create Docker image asset for local deployments
      dockerImageAsset = new ecrAssets.DockerImageAsset(this, 'CloudTAKDockerAsset', {
        directory: '../..',
        file: 'api/Dockerfile'
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

    // Create S3 resources for asset storage
    const s3Resources = new S3Resources(this, 'S3Resources', {
      envConfig,
      kmsKey
    });

    // Create Application Load Balancer with HTTPS
    const loadBalancer = new LoadBalancer(this, 'LoadBalancer', {
      envConfig,
      vpc,
      albSecurityGroup: securityGroups.alb,
      certificate
    });

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
      databaseHostname: database.hostname,
      assetBucketName: s3Resources.assetBucket.bucketName,
      signingSecret: secrets.signingSecret
    });

    // Create AWS Batch resources for ETL processing
    const batch = new Batch(this, 'Batch', {
      envConfig,
      vpc,
      ecrRepository,
      assetBucketArn: s3Resources.assetBucket.bucketArn,
      serviceUrl: `https://${envConfig.cloudtak.hostname}.${hostedZone.zoneName}`
    });

    // Create Lambda functions for event processing
    const lambdaFunctions = new LambdaFunctions(this, 'LambdaFunctions', {
      envConfig,
      ecrRepository,
      assetBucketArn: s3Resources.assetBucket.bucketArn,
      serviceUrl: `https://${envConfig.cloudtak.hostname}.${hostedZone.zoneName}`,
      signingSecret: secrets.signingSecret
    });

    // Create Route53 DNS record for the service
    const route53 = new Route53(this, 'Route53', {
      hostedZone,
      hostname: envConfig.cloudtak.hostname,
      loadBalancer: loadBalancer.alb
    });

    // Register CloudFormation outputs
    registerOutputs({
      stack: this,
      serviceUrl: route53.serviceUrl,
      loadBalancer: loadBalancer.alb,
      database: database.cluster,
      assetBucket: s3Resources.assetBucket,
      ecrRepository: dockerImageAsset ? dockerImageAsset.repository : ecrRepository
    });
  }
}