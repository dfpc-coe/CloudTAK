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
  public readonly mediaSecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: SecretsProps) {
    super(scope, id);

    const { envConfig, kmsKey } = props;

    this.signingSecret = new secretsmanager.Secret(this, 'SigningSecret', {
      description: `${envConfig.stackName} Signing Secret`,
      secretName: `${cdk.Stack.of(this).stackName}/api/secret`,
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 32
      },
      encryptionKey: kmsKey,
      removalPolicy: envConfig.general.removalPolicy === 'retain' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY
    });

    this.mediaSecret = new secretsmanager.Secret(this, 'MediaSecret', {
      description: `${envConfig.stackName} Media Secret`,
      secretName: `${cdk.Stack.of(this).stackName}/api/media`,
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 16
      },
      encryptionKey: kmsKey,
      removalPolicy: envConfig.general.removalPolicy === 'retain' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY
    });
  }
}