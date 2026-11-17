/**
 * CloudTAK Application Stack
 * 
 * This stack deploys the CloudTAK application layer including:
 * - Aurora PostgreSQL database (serverless for dev-test, provisioned for prod)
 * - ECS Fargate service for the API
 * - Application Load Balancer with HTTPS
 * - Lambda functions for event processing
 * - S3 bucket for assets
 * - Secrets Manager for application secrets
 */

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecrAssets from 'aws-cdk-lib/aws-ecr-assets';

import { Database } from './constructs/database';
import { SecurityGroups } from './constructs/security-groups';
import { LoadBalancer } from './constructs/load-balancer';
import { CloudTakApi } from './constructs/cloudtak-api';
import { Route53 } from './constructs/route53';
import { S3Resources } from './constructs/s3-resources';
import { Secrets } from './constructs/secrets';
import { LambdaFunctions } from './constructs/lambda-functions';
import { EventsService } from './constructs/events-service';
import { Alarms } from './constructs/alarms';
import { HubLoadBalancer } from './constructs/hub-load-balancer';
import { CloudTakStateful } from './constructs/cloudtak-stateful';
import { Dashboard } from './constructs/dashboard';
import { AuthentikUserCreator } from './constructs/authentik-user-creator';
import { Webhooks } from './constructs/webhooks';
import { Mail } from './constructs/mail';
import { EtlRole } from './constructs/etl-role';
import { CloudTakOidcSetup } from './constructs/cloudtak-oidc-setup';
import { PMTilesEfs } from './constructs/pmtiles-efs';
import { RetentionService } from './constructs/retention-service';

import { registerOutputs } from './outputs';
import { createBaseImportValue, BASE_EXPORT_NAMES } from './cloudformation-imports';
import { ContextEnvironmentConfig } from './stack-config';
import { generateStandardTags, TagDefaults } from './utils/tag-helpers';
import { ConfigValidator } from './utils/config-validator';
import { resolveWebPlugins } from './utils/web-plugins';

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
          new cdk.aws_iam.ServicePrincipal('lambda.amazonaws.com')
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
    // Optional web plugins for the main image only (see utils/web-plugins.ts).
    // Only passed when non-empty so the asset hash is unchanged without plugins.
    const webPlugins = resolveWebPlugins(this, envConfig.cloudtak.webPlugins);
    
    let ecrRepository: ecr.IRepository;
    let dockerImageAsset: ecrAssets.DockerImageAsset | undefined;
    let eventsImageAsset: ecrAssets.DockerImageAsset | undefined;
    let tilesImageAsset: ecrAssets.DockerImageAsset | undefined;
    let retentionImageAsset: ecrAssets.DockerImageAsset | undefined;
    
    if (usePreBuiltImages) {
      // Use BaseInfra ECR repository for CI/CD deployments
      const ecrRepositoryArn = cdk.Fn.importValue(createBaseImportValue(envConfig.stackName, BASE_EXPORT_NAMES.ECR_ARTIFACTS_REPO));
      ecrRepository = ecr.Repository.fromRepositoryAttributes(this, 'ImportedECRRepository', {
        repositoryArn: ecrRepositoryArn,
        repositoryName: cdk.Fn.select(1, cdk.Fn.split('/', cdk.Fn.select(5, cdk.Fn.split(':', ecrRepositoryArn))))
      });
    } else {
      // Create Docker image assets for local deployments
      dockerImageAsset = new ecrAssets.DockerImageAsset(this, 'CloudTAKDockerAsset', {
        // Repository root: upstream's Dockerfile (v13.102+) builds api/ and app/
        // (the web frontend, formerly api/web/) side by side, so it needs both
        // in its context.
        directory: '..',
        file: 'Dockerfile',
        buildArgs: {
          NODE_ENV: environment === 'prod' ? 'production' : 'development',
          ...(webPlugins && { WEB_PLUGINS: webPlugins })
        },
        exclude: [
          'node_modules/**',
          // Nested installs. `node_modules/**` above only covers the context
          // root, and the root .dockerignore's `**/node_modules/` is not applied
          // by CDK's asset hashing, so neither catches api/ or app/. That used to
          // leave app/node_modules (61,226 files, 803 MB) being hashed and copied
          // into cdk.out on every synth, handed to the Docker daemon as build
          // context, and baked into a layer by the Dockerfile's `COPY app/`
          // before `npm ci` replaced it - so it inflated the image too.
          '**/node_modules/**',
          // Built by `npm run build` inside the image; the host's copy is stale
          // weight at best.
          'api/dist/**',
          'app/dist/**',
          '**/.git/**',
          '**/.vscode/**',
          '**/.idea/**',
          '**/*.log',
          '**/*.tmp',
          '**/.DS_Store',
          '**/Thumbs.db',
          // The image never reads these, and with the repository root as the
          // build context any change under them would rewrite the asset hash
          // and force a pointless rebuild. data/ can also hold multi-gigabyte
          // .pmtiles archives (see data/README.md).
          'cdk/**',
          'branding/**',
          'data/**',
          'docs/**',
          'tasks/**',
          'config/**',
          'scripts/**',
          // Local-only operator certificates (untracked) must never reach a build context.
          'tak-certs/**',
          // Native-app projects; not part of the web image (root .dockerignore).
          'app/android/**',
          'app/ios/**'
        ]
      });
      eventsImageAsset = new ecrAssets.DockerImageAsset(this, 'EventsDockerAsset', {
        directory: '..',
        file: 'tasks/events/Dockerfile',
        buildArgs: {
          NODE_ENV: environment === 'prod' ? 'production' : 'development'
        },
        exclude: [
          'node_modules/**',
          '**/node_modules/**',
          '**/.git/**',
          '**/.vscode/**',
          '**/.idea/**',
          '**/*.log',
          '**/*.tmp',
          '**/.DS_Store',
          '**/Thumbs.db',
          'cdk/**',
          'api/dist/**',
          'api/fonts/**',
          'app/node_modules/**',
          'app/dist/**',
          'app/android/**',
          'app/ios/**',
          // Design-source rasters and tracing tooling. These three assets use
          // the repository root as their build context, so without this any
          // change under branding/ rewrites their asset hash and forces a
          // pointless rebuild and ECR push of images that never read it.
          'branding/**',
          // Large published geospatial archives kept locally for convenience
          // (see data/README.md). Same reasoning as branding/, but the stakes
          // are higher: a single .pmtiles here is over a gigabyte, so including
          // it would stage that into cdk.out and hand it to the Docker daemon on
          // every local synth.
          'data/**',
        ]
      });
      
      tilesImageAsset = new ecrAssets.DockerImageAsset(this, 'TilesDockerAsset', {
        directory: '..',
        file: 'tasks/pmtiles/Dockerfile',
        buildArgs: {
          NODE_ENV: environment === 'prod' ? 'production' : 'development'
        },
        exclude: [
          'node_modules/**',
          '**/node_modules/**',
          '**/.git/**',
          '**/.vscode/**',
          '**/.idea/**',
          '**/*.log',
          '**/*.tmp',
          '**/.DS_Store',
          '**/Thumbs.db',
          'cdk/**',
          'api/dist/**',
          'api/fonts/**',
          'app/node_modules/**',
          'app/dist/**',
          'app/android/**',
          'app/ios/**',
          // Design-source rasters and tracing tooling. These three assets use
          // the repository root as their build context, so without this any
          // change under branding/ rewrites their asset hash and forces a
          // pointless rebuild and ECR push of images that never read it.
          'branding/**',
          // Large published geospatial archives kept locally for convenience
          // (see data/README.md). Same reasoning as branding/, but the stakes
          // are higher: a single .pmtiles here is over a gigabyte, so including
          // it would stage that into cdk.out and hand it to the Docker daemon on
          // every local synth.
          'data/**',
        ]
      });

      retentionImageAsset = new ecrAssets.DockerImageAsset(this, 'RetentionDockerAsset', {
        directory: '..',
        file: 'tasks/retention/Dockerfile',
        buildArgs: {
          NODE_ENV: environment === 'prod' ? 'production' : 'development'
        },
        exclude: [
          'node_modules/**',
          '**/node_modules/**',
          '**/.git/**',
          '**/.vscode/**',
          '**/.idea/**',
          '**/*.log',
          '**/*.tmp',
          '**/.DS_Store',
          '**/Thumbs.db',
          'cdk/**',
          'api/dist/**',
          'api/fonts/**',
          'app/node_modules/**',
          'app/dist/**',
          'app/android/**',
          'app/ios/**',
          // Design-source rasters and tracing tooling. These three assets use
          // the repository root as their build context, so without this any
          // change under branding/ rewrites their asset hash and forces a
          // pointless rebuild and ECR push of images that never read it.
          'branding/**',
          // Large published geospatial archives kept locally for convenience
          // (see data/README.md). Same reasoning as branding/, but the stakes
          // are higher: a single .pmtiles here is over a gigabyte, so including
          // it would stage that into cdk.out and hand it to the Docker daemon on
          // every local synth.
          'data/**',
        ]
      });
      
      ecrRepository = dockerImageAsset.repository;
    }

    // Create application secrets (signing secret for API)
    const secrets = new Secrets(this, 'Secrets', {
      envConfig,
      kmsKey
    });

    // Import ETL ECR repository from BaseInfra
    const etlEcrRepositoryArn = cdk.Fn.importValue(createBaseImportValue(envConfig.stackName, BASE_EXPORT_NAMES.ECR_ETL_TASKS_REPO));
    const etlEcrRepository = ecr.Repository.fromRepositoryAttributes(this, 'ImportedETLECRRepository', {
      repositoryArn: etlEcrRepositoryArn,
      repositoryName: cdk.Fn.select(1, cdk.Fn.split('/', cdk.Fn.select(5, cdk.Fn.split(':', etlEcrRepositoryArn))))
    });

    // Create security groups for different components
    const securityGroups = new SecurityGroups(this, 'SecurityGroups', {
      vpc,
      envConfig
      // VPC CIDR will be imported directly in the SecurityGroups construct
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
    
    // Configure OIDC if enabled. CloudTAK performs the Authorization Code flow
    // itself (see api/routes/login.ts) — the ALB has no OIDC listener action,
    // so oidcSetup only needs to provision the Authentik OAuth2 client and hand
    // back credentials for the CloudTAK API container.
    let oidcClientId: string | undefined;
    let oidcClientSecret: cdk.aws_secretsmanager.ISecret | undefined;
    if (envConfig.cloudtak.oidcEnabled) {
      const authentikUrl = envConfig.cloudtak.authentikUrl || 
        cdk.Fn.importValue(`TAK-${envConfig.stackName}-AuthInfra-AuthentikUrl`);
      
      const authentikAdminSecretArn = cdk.Fn.importValue(
        `TAK-${envConfig.stackName}-AuthInfra-AuthentikAdminTokenArn`
      );
      
      const serviceUrl = `https://${envConfig.cloudtak.hostname}.${hostedZone.zoneName}`;
      
      // Create OIDC setup (creates Authentik application and returns credentials)
      const oidcSetup = new CloudTakOidcSetup(this, 'OidcSetup', {
        stackName: envConfig.stackName,
        authentikUrl,
        authentikAdminSecretArn,
        cloudtakUrl: serviceUrl,
        kmsKeyArn: kmsKey.keyArn,
        vpc,
        securityGroup: securityGroups.ecs,
      });

      oidcClientId = oidcSetup.clientId;
      oidcClientSecret = oidcSetup.clientSecret;
    }
    
    // Create Application Load Balancer with HTTPS (plain TLS termination —
    // OIDC authentication happens inside the CloudTAK application, not at the ALB)
    const loadBalancer = new LoadBalancer(this, 'LoadBalancer', {
      envConfig,
      vpc,
      albSecurityGroup: securityGroups.alb,
      certificate,
      logsBucket
    });

    // Internal hub ALB. Created before the API service because the stateless
    // tier needs its DNS name as CLOUDTAK_Hub_URL.
    const hubLoadBalancer = new HubLoadBalancer(this, 'HubLoadBalancer', {
      envConfig,
      vpc,
      hubAlbSecurityGroup: securityGroups.hubAlb
    });

    // Create Route53 DNS record for the service
    const route53Records = new Route53(this, 'Route53', {
      hostedZone,
      hostname: envConfig.cloudtak.hostname,
      loadBalancer: loadBalancer.alb
    });

    // Create Events ECS service for event processing
    const eventsService = new EventsService(this, 'EventsService', {
      environment,
      envConfig,
      vpc,
      ecsCluster,
      ecrRepository,
      eventsImageAsset,
      assetBucketName: s3Resources.assetBucket.bucketName,
      serviceUrl: route53Records.serviceUrl,
      signingSecret: secrets.signingSecret,
      kmsKey
    });

    // Create PMTiles EFS infrastructure
    const pmtilesEfs = new PMTilesEfs(this, 'PMTilesEfs', {
      envConfig,
      vpc,
      kmsKey
    });

    // Create Lambda functions for PMTiles processing
    const lambdaFunctions = new LambdaFunctions(this, 'LambdaFunctions', {
      envConfig,
      ecrRepository,
      tilesImageAsset,
      assetBucketName: s3Resources.assetBucket.bucketName,
      serviceUrl: route53Records.serviceUrl,
      signingSecret: secrets.signingSecret,
      kmsKey,
      hostedZone,
      certificate,
    });

    // Create ECS Fargate service for the CloudTAK API
    const cloudtakApi = new CloudTakApi(this, 'CloudTakApi', {
      environment,
      envConfig,
      vpc,
      ecsCluster,
      ecsSecurityGroup: securityGroups.ecs,
      mediaSecurityGroup: securityGroups.media,
      albTargetGroup: loadBalancer.targetGroup,
      ecrRepository,
      dockerImageAsset,
      etlEcrRepository: etlEcrRepository,
      databaseSecret: database.masterSecret,
      databaseHostname: database.cluster.clusterEndpoint.hostname,
      connectionStringSecret: database.connectionStringSecret,
      assetBucketName: s3Resources.assetBucket.bucketName,
      signingSecret: secrets.signingSecret,
      adminPasswordSecret: secrets.adminPasswordSecret,
      geofenceSecret: secrets.geofenceSecret,
      serviceUrl: route53Records.serviceUrl,
      oidcClientId,
      oidcClientSecret,
      hubAlbDnsName: hubLoadBalancer.alb.loadBalancerDnsName
    });

    // Stateful ("hub") tier: browser WebSockets, the TAK Server connection pool,
    // geofence/events, and database migrations. Same image and IAM roles as the
    // API service, differing only by CLOUDTAK_Server_Mode.
    const cloudtakStateful = new CloudTakStateful(this, 'CloudTakStateful', {
      envConfig,
      vpc,
      ecsCluster,
      statefulSecurityGroup: securityGroups.stateful,
      httpsListener: loadBalancer.httpsListener,
      hubRpcTargetGroup: hubLoadBalancer.rpcTargetGroup,
      containerImage: cloudtakApi.containerImage,
      containerEnvironment: cloudtakApi.containerEnvironment,
      containerSecrets: cloudtakApi.containerSecrets,
      containerEnvironmentFiles: cloudtakApi.containerEnvironmentFiles,
      taskRole: cloudtakApi.taskRole,
      executionRole: cloudtakApi.executionRole
    });

    // Create ETL role for Lambda layer functions
    const etlRole = new EtlRole(this, 'EtlRole', {
      envConfig,
      assetBucketName: s3Resources.assetBucket.bucketName,
      kmsKey
    });

    const etlRoleArn = etlRole.role.roleArn;

    // Operational dashboard - stateless and stateful tiers side by side
    new Dashboard(this, 'Dashboard', {
      envConfig,
      loadBalancer: loadBalancer.alb,
      hubLoadBalancer: hubLoadBalancer.alb,
      targetGroup: loadBalancer.targetGroup,
      statefulTargetGroup: cloudtakStateful.targetGroup,
      apiService: cloudtakApi.service,
      statefulService: cloudtakStateful.service,
      database: database.cluster,
      databaseIsServerless: database.isServerless
    });

    // Create retention service for automated cleanup of expired data
    const retentionService = new RetentionService(this, 'RetentionService', {
      envConfig,
      vpc,
      ecsCluster,
      ecrRepository,
      retentionImageAsset,
      assetBucketName: s3Resources.assetBucket.bucketName,
      serviceUrl: route53Records.serviceUrl,
      connectionStringSecret: database.connectionStringSecret,
      signingSecret: secrets.signingSecret,
      kmsKey,
    });

    // Create monitoring and alarms
    const alarms = new Alarms(this, 'Alarms', {
      envConfig,
      eventsService: eventsService.service,
      apiService: cloudtakApi.service,
      statefulService: cloudtakStateful.service,
      loadBalancer: loadBalancer.alb,
      database: database.cluster,
      databaseIsServerless: database.isServerless,
      hubLoadBalancer: hubLoadBalancer.alb,
      targetGroup: loadBalancer.targetGroup,
      statefulTargetGroup: cloudtakStateful.targetGroup,
      hubTargetGroup: hubLoadBalancer.rpcTargetGroup,
      tilesLambda: lambdaFunctions.tilesLambda,
      tilesApi: lambdaFunctions.tilesApi,
      retentionLogGroup: retentionService.logGroup,
      retentionSchedule: retentionService.schedule
    });

    // Create webhooks infrastructure for layer webhook support
    const webhooks = new Webhooks(this, 'Webhooks', {
      envConfig,
      hostedZone,
      certificate,
      subdomainPrefix: envConfig.cloudtak.webhooksSubdomain || 'webhooks'
    });

    // Inbound email delivery for ETL layers (SES Mail Manager + router Lambda).
    // Shares the hosted zone with Webhooks; alarms go to the high-urgency topic.
    const mail = new Mail(this, 'Mail', {
      envConfig,
      hostedZone,
      alarmTopic: alarms.highUrgencyTopic,
      // The ingress point is a flat ~$49/month; cdk.json can switch it off
      enableIngressPoint: envConfig.cloudtak.enableInboundMail ?? true
    });

    // Layer functions read delivered raw email from the mail bucket. The ETL role
    // is created before the bucket, so the grant is attached here (read-only,
    // objects only - no list).
    etlRole.role.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:GetObject'],
      resources: [mail.bucket.arnForObjects('*')]
    }));

    // Create Authentik user for CloudTAK admin
    const authentikUrl = cdk.Fn.importValue(`TAK-${envConfig.stackName}-AuthInfra-AuthentikUrl`);
    
    new AuthentikUserCreator(this, 'AuthentikUserCreator', {
      stackName: envConfig.stackName,
      adminPasswordSecret: secrets.adminPasswordSecret,
      authentikUrl: authentikUrl,
      takAdminEmail: envConfig.cloudtak.takAdminEmail
    });

    // Ensure ECS services wait for database and Route53 records
    cloudtakApi.service.node.addDependency(database.cluster);
    cloudtakApi.service.node.addDependency(database.connectionStringSecret);
    cloudtakApi.service.node.addDependency(route53Records.aRecord);
    cloudtakApi.service.node.addDependency(route53Records.aaaaRecord);

    // The stateful tier runs migrations, so it must not start before the
    // database and its connection string exist.
    cloudtakStateful.service.node.addDependency(database.cluster);
    cloudtakStateful.service.node.addDependency(database.connectionStringSecret);

    // The stateless tier calls the hub for anything needing a TAK Server
    // connection, so bring the hub up first. This is ordering only - the
    // stateless tasks tolerate a hub that is not yet reachable.
    cloudtakApi.service.node.addDependency(cloudtakStateful.service);
    
    eventsService.service.node.addDependency(database.cluster);
    eventsService.service.node.addDependency(database.connectionStringSecret);

    // Register CloudFormation outputs
    registerOutputs({
      stack: this,
      serviceUrl: route53Records.serviceUrl,
      loadBalancer: loadBalancer.alb,
      database: database.cluster,
      assetBucket: s3Resources.assetBucket
    });

    // Add MediaInfra integration outputs
    new cdk.CfnOutput(this, 'ApiURL', {
      value: `https://${route53Records.serviceUrl}/api`,
      exportName: `TAK-${envConfig.stackName}-CloudTAK-ApiURL`
    });

    new cdk.CfnOutput(this, 'SigningSecretArn', {
      value: secrets.signingSecret.secretArn,
      exportName: `TAK-${envConfig.stackName}-CloudTAK-SigningSecret`
    });

    new cdk.CfnOutput(this, 'MediaSecretArn', {
      value: secrets.mediaSecret.secretArn,
      exportName: `TAK-${envConfig.stackName}-CloudTAK-MediaSecret`
    });

    new cdk.CfnOutput(this, 'EtlEcrRepoArn', {
      value: etlEcrRepository.repositoryArn,
      exportName: `TAK-${envConfig.stackName}-CloudTAK-EtlEcrRepoArn`
    });

    new cdk.CfnOutput(this, 'MediaUrl', {
      value: `https://${envConfig.mediainfra.mediaHostname}.${hostedZone.zoneName}:9997`,
      exportName: `TAK-${envConfig.stackName}-CloudTAK-MediaUrl`
    });

    new cdk.CfnOutput(this, 'EtlRoleArn', {
      value: etlRoleArn,
      exportName: `TAK-${envConfig.stackName}-CloudTAK-etl-role`
    });


  }
}