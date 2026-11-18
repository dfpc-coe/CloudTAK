/**
 * Lambda Functions construct — PMTiles tile server
 *
 * Change #9: migrated from API Gateway v1 (REST API) to v2 (HTTP API).
 * HTTP API is cheaper, natively handles CORS, and uses a resource-based Lambda
 * permission instead of an execution-role credential.
 *
 * Deployment note: the first deploy that removes the v1 resources and creates the
 * v2 resources will cause a brief DNS gap on tiles.<domain>.  Schedule during a
 * low-traffic window.
 */

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecrAssets from 'aws-cdk-lib/aws-ecr-assets';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { ContextEnvironmentConfig } from '../stack-config';

export interface LambdaFunctionsProps {
  envConfig: ContextEnvironmentConfig;
  ecrRepository: ecr.IRepository;
  tilesImageAsset?: ecrAssets.DockerImageAsset;
  assetBucketName: string;
  serviceUrl: string;
  signingSecret: secretsmanager.ISecret;
  kmsKey: cdk.aws_kms.IKey;
  hostedZone: cdk.aws_route53.IHostedZone;
  certificate: cdk.aws_certificatemanager.ICertificate;
}

export class LambdaFunctions extends Construct {
  public readonly tilesLambda: lambda.Function;
  public readonly tilesApi: apigwv2.CfnApi;

  constructor(scope: Construct, id: string, props: LambdaFunctionsProps) {
    super(scope, id);

    const {
      envConfig,
      ecrRepository,
      tilesImageAsset,
      assetBucketName,
      serviceUrl,
      signingSecret,
      kmsKey,
      hostedZone,
      certificate,
    } = props;

    const cloudtakImageTag =
      cdk.Stack.of(this).node.tryGetContext('cloudtakImageTag');

    // IAM role for the PMTiles Lambda
    const tilesLambdaRole = new iam.Role(this, 'PMTilesLambdaRole', {
      roleName: `TAK-${envConfig.stackName}-CloudTAK-pmtiles`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        pmtiles: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['s3:List*', 's3:Get*', 's3:Head*', 's3:Describe*'],
              resources: [
                `arn:${cdk.Stack.of(this).partition}:s3:::${assetBucketName}`,
                `arn:${cdk.Stack.of(this).partition}:s3:::${assetBucketName}/*`,
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'secretsmanager:GetSecretValue',
                'secretsmanager:DescribeSecret',
              ],
              resources: [
                `arn:${cdk.Stack.of(this).partition}:secretsmanager:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:secret:TAK-${envConfig.stackName}-*`,
              ],
            }),
          ],
        }),
      },
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });

    kmsKey.grantDecrypt(tilesLambdaRole);

    const tilesTag = cloudtakImageTag
      ? `pmtiles-${cloudtakImageTag.replace('cloudtak-', '')}`
      : 'pmtiles-latest';

    const baseHostname = serviceUrl
      .replace('https://', '')
      .replace('http://', '');
    const tilesHostname = `tiles.${baseHostname}`;

    // PMTiles Lambda function
    this.tilesLambda = new lambda.Function(this, 'PMTilesLambda', {
      functionName: `TAK-${envConfig.stackName}-CloudTAK-pmtiles`,
      runtime: lambda.Runtime.FROM_IMAGE,
      code: tilesImageAsset
        ? lambda.Code.fromEcrImage(tilesImageAsset.repository, {
            tagOrDigest: tilesImageAsset.assetHash,
          })
        : lambda.Code.fromEcrImage(ecrRepository, {
            tagOrDigest: tilesTag,
          }),
      handler: lambda.Handler.FROM_IMAGE,
      role: tilesLambdaRole,
      memorySize: 512,
      timeout: cdk.Duration.seconds(60),
      description: 'Return Mapbox Vector Tiles from a PMTiles Store',
      environment: {
        StackName: cdk.Stack.of(this).stackName,
        ASSET_BUCKET: assetBucketName,
        PMTILES_URL: `https://${tilesHostname}`,
        APIROOT: `https://${tilesHostname}`,
        // API_URL required by PMTiles Lambda since CloudTAK v13
        API_URL: `https://${baseHostname}`,
        SigningSecret: `{{resolve:secretsmanager:${signingSecret.secretName}:SecretString::AWSCURRENT}}`,
      },
      environmentEncryption: kmsKey,
    });

    // Provisioned concurrency keeps containers warm to avoid cold starts on concurrent
    // tile bursts when a user first loads the map. Each one is billed continuously
    // (about $6.50/month), and concurrency peaks well above any sensible value anyway,
    // so the default is upstream's 2. 0 disables it; the alias is kept either way.
    const requestedConcurrency = envConfig.cloudtak.pmtilesProvisionedConcurrency ?? 2;
    if (!Number.isInteger(requestedConcurrency) || requestedConcurrency < 0) {
      throw new Error(
        `cloudtak.pmtilesProvisionedConcurrency must be an integer >= 0, got ${requestedConcurrency}`
      );
    }
    const version = this.tilesLambda.currentVersion;
    new lambda.Alias(this, 'PMTilesLambdaLive', {
      aliasName: 'live',
      version,
      provisionedConcurrentExecutions: requestedConcurrency > 0 ? requestedConcurrency : undefined,
    });

    // -------------------------------------------------------------------------
    // API Gateway v2 (HTTP API) — replaces the former v1 REST API
    // -------------------------------------------------------------------------

    this.tilesApi = new apigwv2.CfnApi(this, 'PMTilesAPI', {
      name: `TAK-${envConfig.stackName}-CloudTAK-pmtiles`,
      protocolType: 'HTTP',
      disableExecuteApiEndpoint: true,
      description: 'PMTiles HTTP API (v2)',
      corsConfiguration: {
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Amz-User-Agent',
        ],
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowOrigins: ['*'],
      },
    });

    // Resource-based permission — API Gateway v2 uses this instead of an
    // execution role (PMTilesApiGatewayRole is no longer needed)
    this.tilesLambda.addPermission('PMTilesAPIPermission', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: `arn:${cdk.Stack.of(this).partition}:execute-api:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:${this.tilesApi.ref}/*/*`,
    });

    // Lambda integration (payload format v1.0 for binary tile compatibility)
    const integration = new apigwv2.CfnIntegration(
      this,
      'PMTilesIntegration',
      {
        apiId: this.tilesApi.ref,
        integrationType: 'AWS_PROXY',
        integrationUri: this.tilesLambda.functionArn,
        payloadFormatVersion: '1.0',
      },
    );

    new apigwv2.CfnRoute(this, 'PMTilesRouteGet', {
      apiId: this.tilesApi.ref,
      routeKey: 'GET /{proxy+}',
      target: `integrations/${integration.ref}`,
    });

    new apigwv2.CfnRoute(this, 'PMTilesRoutePost', {
      apiId: this.tilesApi.ref,
      routeKey: 'POST /{proxy+}',
      target: `integrations/${integration.ref}`,
    });

    // $default stage with auto-deploy (no explicit Deployment resource needed)
    const stage = new apigwv2.CfnStage(this, 'PMTilesStage', {
      apiId: this.tilesApi.ref,
      stageName: '$default',
      autoDeploy: true,
    });

    // Two-step migration guard:
    // When upgrading from API GW v1 → v2, the old v1 DomainName must be deleted
    // by CloudFormation BEFORE the new v2 DomainName can be created (they share
    // the same domain namespace).  Deploy once with --context skipPmtilesDomain=true
    // to let CloudFormation remove the v1 resources, then redeploy without the flag
    // to create the v2 domain and DNS records.
    const skipDomain = cdk.Stack.of(this).node.tryGetContext('skipPmtilesDomain') === true
      || cdk.Stack.of(this).node.tryGetContext('skipPmtilesDomain') === 'true';

    if (!skipDomain) {
      // Custom domain mapped to the API
      const pmtilesDomain = new apigwv2.CfnDomainName(this, 'PMTilesDomain', {
        domainName: tilesHostname,
        domainNameConfigurations: [
          {
            certificateArn: certificate.certificateArn,
            endpointType: 'REGIONAL',
          },
        ],
      });

      new apigwv2.CfnApiMapping(this, 'PMTilesApiMapping', {
        apiId: this.tilesApi.ref,
        domainName: pmtilesDomain.ref,
        stage: stage.ref,
      });

      // Route53 — alias to the v2 regional domain name
      const aliasTarget = route53.RecordTarget.fromAlias({
        bind: () => ({
          dnsName: pmtilesDomain.attrRegionalDomainName,
          hostedZoneId: pmtilesDomain.attrRegionalHostedZoneId,
        }),
      });

      new route53.ARecord(this, 'PMTilesDNS', {
        zone: hostedZone,
        recordName: `tiles.${envConfig.cloudtak.hostname}`,
        target: aliasTarget,
        comment: `${cdk.Stack.of(this).stackName} PMTiles API DNS Entry`,
      });

      new route53.AaaaRecord(this, 'PMTilesDNSIPv6', {
        zone: hostedZone,
        recordName: `tiles.${envConfig.cloudtak.hostname}`,
        target: aliasTarget,
        comment: `${cdk.Stack.of(this).stackName} PMTiles API IPv6 DNS Entry`,
      });
    }
  }
}
