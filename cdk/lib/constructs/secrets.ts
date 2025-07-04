import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as kms from 'aws-cdk-lib/aws-kms';
import { ContextEnvironmentConfig } from '../stack-config';

export interface SecretsProps {
  envConfig: ContextEnvironmentConfig;
  kmsKey: kms.IKey;
}

export class Secrets extends Construct {
  public readonly signingSecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: SecretsProps) {
    super(scope, id);

    const { envConfig, kmsKey } = props;

    this.signingSecret = new secretsmanager.Secret(this, 'SigningSecret', {
      description: `TAK-${envConfig.stackName}-CloudTAK Signing Secret`,
      secretName: `TAK-${envConfig.stackName}-CloudTAK/api/secret`,
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 32
      },
      encryptionKey: kmsKey,
      removalPolicy: envConfig.general.removalPolicy === 'RETAIN' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY
    });

    // Create media secret to match old CloudFormation pattern
    new secretsmanager.Secret(this, 'MediaSecret', {
      description: `TAK-${envConfig.stackName}-CloudTAK Media Secret`,
      secretName: `TAK-${envConfig.stackName}-CloudTAK/api/media`,
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 16
      },
      encryptionKey: kmsKey,
      removalPolicy: envConfig.general.removalPolicy === 'RETAIN' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY
    });
  }
}