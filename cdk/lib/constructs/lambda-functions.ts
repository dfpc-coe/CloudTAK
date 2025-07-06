import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecrAssets from 'aws-cdk-lib/aws-ecr-assets';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import { ContextEnvironmentConfig } from '../stack-config';

export interface LambdaFunctionsProps {
  envConfig: ContextEnvironmentConfig;
  ecrRepository: ecr.IRepository;
  eventsImageAsset?: ecrAssets.DockerImageAsset;
  tilesImageAsset?: ecrAssets.DockerImageAsset;
  assetBucketArn: string;
  serviceUrl: string;
  signingSecret: secretsmanager.ISecret;
  kmsKey: cdk.aws_kms.IKey;
  hostedZone: cdk.aws_route53.IHostedZone;
  certificate: cdk.aws_certificatemanager.ICertificate;
}

export class LambdaFunctions extends Construct {
  public readonly eventLambda: lambda.Function;
  public readonly tilesLambda: lambda.Function;
  public readonly tilesApi: apigateway.RestApi;
  public readonly etlFunctionRole: iam.Role;

  constructor(scope: Construct, id: string, props: LambdaFunctionsProps) {
    super(scope, id);

    const { envConfig, ecrRepository, eventsImageAsset, tilesImageAsset, assetBucketArn, serviceUrl, signingSecret, kmsKey, hostedZone, certificate } = props;

    const eventLambdaRole = new iam.Role(this, 'EventLambdaRole', {
      roleName: `TAK-${envConfig.stackName}-CloudTAK-events`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        'hook-queue': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket', 's3:GetBucketLocation'],
              resources: [assetBucketArn, `${assetBucketArn}/*`]
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['sqs:SendMessage', 'sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes'],
              resources: [`arn:${cdk.Stack.of(this).partition}:sqs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:tak-cloudtak-*`]
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['kms:Decrypt', 'kms:GenerateDataKey'],
              resources: ['*'],
              conditions: {
                StringEquals: {
                  'kms:ViaService': [`s3.${cdk.Stack.of(this).region}.amazonaws.com`, `secretsmanager.${cdk.Stack.of(this).region}.amazonaws.com`]
                }
              }
            })
          ]
        })
      },
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    // Get image tag from context for CI/CD deployments
    const cloudtakImageTag = cdk.Stack.of(this).node.tryGetContext('cloudtakImageTag');
    const eventsTag = cloudtakImageTag ? `events-${cloudtakImageTag}` : 'events-latest';
    
    this.eventLambda = new lambda.Function(this, 'EventLambda', {
      functionName: `TAK-${envConfig.stackName}-CloudTAK-events`,
      runtime: lambda.Runtime.FROM_IMAGE,
      code: eventsImageAsset 
        ? lambda.Code.fromEcrImage(eventsImageAsset.repository, {
            tagOrDigest: eventsImageAsset.assetHash
          })
        : lambda.Code.fromEcrImage(ecrRepository, {
            tagOrDigest: eventsTag
          }),
      handler: lambda.Handler.FROM_IMAGE,
      role: eventLambdaRole,
      memorySize: 512,
      timeout: cdk.Duration.minutes(15),
      description: 'Respond to events on the S3 Asset Bucket & Stack SQS Queue',
      reservedConcurrentExecutions: 20,
      environment: {
        'TAK_ETL_API': serviceUrl.startsWith('http') ? serviceUrl : `https://${serviceUrl}`,
        'StackName': cdk.Stack.of(this).stackName,
        'SigningSecret': `{{resolve:secretsmanager:${signingSecret.secretName}:SecretString::AWSCURRENT}}`
      },
      environmentEncryption: props.kmsKey
    });
    
    // Note: No need to grant read access when using CloudFormation dynamic references
    
    // Create ETL Function Role for dynamic Lambda functions (matches CloudFormation export)
    const etlFunctionRole = new iam.Role(this, 'ETLFunctionRole', {
      roleName: `TAK-${envConfig.stackName}-CloudTAK-etl`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        'etl-policy': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'sqs:SendMessage',
                'sqs:ChangeMessageVisibility', 
                'sqs:DeleteMessage',
                'sqs:GetQueueUrl',
                'sqs:GetQueueAttributes'
              ],
              resources: [`arn:${cdk.Stack.of(this).partition}:sqs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:tak-cloudtak-${envConfig.stackName}-layer-*`]
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket', 's3:GetBucketLocation'],
              resources: [assetBucketArn, `${assetBucketArn}/*`]
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
              resources: [`arn:${cdk.Stack.of(this).partition}:secretsmanager:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:secret:TAK-${envConfig.stackName}-*`]
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['kms:Decrypt', 'kms:GenerateDataKey'],
              resources: ['*'],
              conditions: {
                StringEquals: {
                  'kms:ViaService': [`s3.${cdk.Stack.of(this).region}.amazonaws.com`, `secretsmanager.${cdk.Stack.of(this).region}.amazonaws.com`]
                }
              }
            })
          ]
        })
      },
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaSQSQueueExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });
    
    // Export ETL Role ARN for use by dynamic Lambda functions
    new cdk.CfnOutput(this, 'ETLRoleOutput', {
      value: etlFunctionRole.roleArn,
      exportName: `TAK-${envConfig.stackName}-CloudTAK-etl-role`,
      description: 'ETL Lambda Role'
    });
    
    // Create PMTiles Lambda Role
    const tilesLambdaRole = new iam.Role(this, 'PMTilesLambdaRole', {
      roleName: `TAK-${envConfig.stackName}-CloudTAK-pmtiles`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        'pmtiles': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['s3:List*', 's3:Get*', 's3:Head*', 's3:Describe*'],
              resources: [assetBucketArn, `${assetBucketArn}/*`]
            })
          ]
        })
      },
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });
    
    // Create PMTiles Lambda
    const tilesTag = cloudtakImageTag ? `pmtiles-${cloudtakImageTag}` : 'pmtiles-latest';
    const assetBucketName = assetBucketArn.split(':')[5];
    const tilesHostname = `tiles.${serviceUrl.replace('https://', '').replace('http://', '')}`;
    
    this.tilesLambda = new lambda.Function(this, 'PMTilesLambda', {
      functionName: `TAK-${envConfig.stackName}-CloudTAK-pmtiles`,
      runtime: lambda.Runtime.FROM_IMAGE,
      code: tilesImageAsset 
        ? lambda.Code.fromEcrImage(tilesImageAsset.repository, {
            tagOrDigest: tilesImageAsset.assetHash
          })
        : lambda.Code.fromEcrImage(ecrRepository, {
            tagOrDigest: tilesTag
          }),
      handler: lambda.Handler.FROM_IMAGE,
      role: tilesLambdaRole,
      memorySize: 256,
      timeout: cdk.Duration.seconds(15),
      description: 'Return Mapbox Vector Tiles from a PMTiles Store',
      environment: {
        'StackName': cdk.Stack.of(this).stackName,
        'ASSET_BUCKET': assetBucketName,
        'APIROOT': `https://${tilesHostname}`,
        'SigningSecret': `{{resolve:secretsmanager:${signingSecret.secretName}:SecretString::AWSCURRENT}}`
      },
      environmentEncryption: kmsKey
    });
    
    // Note: No need to grant read access when using CloudFormation dynamic references
    
    // Create API Gateway for PMTiles
    // Force REGIONAL endpoint to use local certificate (EDGE requires us-east-1 certificate)
    const endpointType = apigateway.EndpointType.REGIONAL;
    
    this.tilesApi = new apigateway.RestApi(this, 'PMTilesAPI', {
      restApiName: `TAK-${envConfig.stackName}-CloudTAK-pmtiles`,
      description: 'PMTiles API Gateway',
      endpointConfiguration: {
        types: [endpointType]
      },
      disableExecuteApiEndpoint: true,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token', 'X-Amz-User-Agent']
      },
      cloudWatchRole: true,
      cloudWatchRoleRemovalPolicy: cdk.RemovalPolicy.DESTROY
    });
    
    // Add proxy resource for all paths
    const proxyResource = this.tilesApi.root.addResource('{proxy+}');
    proxyResource.addMethod('GET', new apigateway.LambdaIntegration(this.tilesLambda, {
      proxy: true
    }));
    
    // Grant API Gateway permission to invoke Lambda
    this.tilesLambda.addPermission('APIGatewayInvoke', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: `${this.tilesApi.arnForExecuteApi()}/*/*`
    });
    
    // Create custom domain and base path mapping (matches CloudFormation approach)
    const domainName = new apigateway.DomainName(this, 'PMTilesDomain', {
      domainName: tilesHostname,
      certificate: certificate,
      endpointType: endpointType
    });
    
    // Create deployment and stage explicitly (ensure method exists first)
    const deployment = new apigateway.Deployment(this, 'PMTilesDeployment', {
      api: this.tilesApi,
      description: `TAK-${envConfig.stackName}-CloudTAK PMTiles API`
    });
    
    deployment.node.addDependency(proxyResource);
    
    const stage = new apigateway.Stage(this, 'PMTilesStage', {
      deployment: deployment,
      stageName: 'tiles'
    });
    
    // Create base path mapping
    new apigateway.BasePathMapping(this, 'PMTilesBasePathMapping', {
      domainName: domainName,
      restApi: this.tilesApi,
      stage: stage
    });
    
    // Create Route53 records for tiles subdomain (using custom domain)
    new route53.ARecord(this, 'PMTilesDNS', {
      zone: hostedZone,
      recordName: `tiles.${envConfig.cloudtak.hostname}`,
      target: route53.RecordTarget.fromAlias(
        new route53targets.ApiGatewayDomain(domainName)
      ),
      comment: `${cdk.Stack.of(this).stackName} PMTiles API DNS Entry`
    });
    
    this.etlFunctionRole = etlFunctionRole;
  }
}