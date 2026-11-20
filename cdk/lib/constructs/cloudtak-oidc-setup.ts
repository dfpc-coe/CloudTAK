import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

export interface CloudTakOidcSetupProps {
  stackName: string;
  authentikUrl: string;
  authentikAdminSecretArn: string;
  cloudtakUrl: string;
  kmsKeyArn: string;
  vpc?: cdk.aws_ec2.IVpc;
  securityGroup?: cdk.aws_ec2.ISecurityGroup;
  /**
   * Create the SCIM bearer token and the Authentik SCIM provider that pushes users to CloudTAK
   * (`<cloudtakUrl>/api/scim/v2`). The CloudTAK API reads the same token from `scimToken`.
   */
  scimEnabled?: boolean;
}

export class CloudTakOidcSetup extends Construct {
  public readonly clientId: string;
  public readonly clientSecret: secretsmanager.ISecret;
  /** Generated SCIM bearer token. Only set when `scimEnabled` is true. */
  public readonly scimToken?: secretsmanager.ISecret;

  constructor(scope: Construct, id: string, props: CloudTakOidcSetupProps) {
    super(scope, id);

    const kmsKey = cdk.aws_kms.Key.fromKeyArn(this, 'KmsKey', props.kmsKeyArn);

    // The same token is presented by Authentik (SCIM provider) and checked by the CloudTAK API
    if (props.scimEnabled) {
      this.scimToken = new secretsmanager.Secret(this, 'ScimToken', {
        secretName: `TAK-${props.stackName}-CloudTAK-ScimToken`,
        description: 'Bearer token shared by the Authentik SCIM provider and the CloudTAK SCIM API',
        generateSecretString: { passwordLength: 48, excludePunctuation: true },
        encryptionKey: kmsKey,
      });
    }

    // Create Lambda function for OIDC setup
    const oidcSetupFunction = new nodejs.NodejsFunction(this, 'OidcSetupFunction', {
      runtime: lambda.Runtime.NODEJS_24_X,
      entry: path.join(__dirname, '../../src/cloudtak-oidc-setup/index.js'),
      handler: 'handler',
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node24',
        externalModules: ['@aws-sdk/*'],
        forceDockerBundling: false,
        commandHooks: {
          beforeBundling: () => [],
          beforeInstall: () => [],
          afterBundling: (inputDir: string, outputDir: string) => [
            `cp ${inputDir}/src/cloudtak-oidc-setup/CloudTAKLogo.png ${outputDir}/CloudTAKLogo.png`
          ]
        }
      },
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      vpc: props.vpc,
      securityGroups: props.securityGroup ? [props.securityGroup] : undefined,
      vpcSubnets: props.vpc ? { subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS } : undefined,
      environment: {
        AUTHENTIK_URL: props.authentikUrl,
        AUTHENTIK_ADMIN_SECRET_ARN: props.authentikAdminSecretArn,
        PROVIDER_NAME: 'CloudTAK OAuth Provider',
        APPLICATION_NAME: 'CloudTAK',
        APPLICATION_SLUG: 'cloudtak',
        // CloudTAK performs the OIDC Authorization Code flow itself (no ALB
        // OIDC listener action) - the IdP redirects back to our own callback route.
        REDIRECT_URIS: JSON.stringify([`${props.cloudtakUrl}/api/login/oidc/callback`]),
        LAUNCH_URL: `${props.cloudtakUrl}/api/login/oidc`,
        GROUP_NAME: 'Team Awareness Kit',
        ...(this.scimToken && {
          SCIM_TOKEN_SECRET_ARN: this.scimToken.secretArn,
          SCIM_URL: `${props.cloudtakUrl}/api/scim/v2`,
        }),
      },
    });

    // Grant Lambda permission to read Authentik admin secret
    const authentikAdminSecret = secretsmanager.Secret.fromSecretCompleteArn(
      this,
      'AuthentikAdminSecret',
      props.authentikAdminSecretArn
    );
    authentikAdminSecret.grantRead(oidcSetupFunction);
    this.scimToken?.grantRead(oidcSetupFunction);

    // Grant Lambda permission to use KMS key
    oidcSetupFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['kms:Decrypt'],
      resources: [props.kmsKeyArn],
    }));

    // Create custom resource provider
    const provider = new cr.Provider(this, 'OidcSetupProvider', {
      onEventHandler: oidcSetupFunction,
    });

    // Create custom resource
    const oidcSetup = new cdk.CustomResource(this, 'OidcSetup', {
      serviceToken: provider.serviceToken,
      properties: {
        // Trigger update when these change
        AuthentikUrl: props.authentikUrl,
        CloudTakUrl: props.cloudtakUrl,
        Timestamp: Date.now(), // Force update on each deployment
      },
    });

    // Get client ID from custom resource
    this.clientId = oidcSetup.getAttString('clientId');

    // Store client secret in Secrets Manager
    this.clientSecret = new secretsmanager.Secret(this, 'ClientSecret', {
      secretName: `TAK-${props.stackName}-CloudTAK-AuthentikClientSecret`,
      description: 'Authentik OIDC client secret for CloudTAK ALB',
      secretStringValue: cdk.SecretValue.resourceAttribute(
        oidcSetup.getAttString('clientSecret')
      ),
      encryptionKey: kmsKey,
    });
  }
}
