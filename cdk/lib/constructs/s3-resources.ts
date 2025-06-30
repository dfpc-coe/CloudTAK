import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import { ContextEnvironmentConfig } from '../stack-config';

export interface S3ResourcesProps {
  envConfig: ContextEnvironmentConfig;
  kmsKey: kms.IKey;
}

export class S3Resources extends Construct {
  public readonly assetBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: S3ResourcesProps) {
    super(scope, id);

    const { envConfig, kmsKey } = props;

    this.assetBucket = new s3.Bucket(this, 'AssetBucket', {
      bucketName: `tak-${envConfig.stackName.toLowerCase()}-cloudtak-assets`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: kmsKey,
      versioned: envConfig.s3.enableVersioning,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: envConfig.general.removalPolicy === 'retain' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: envConfig.general.removalPolicy === 'destroy'
    });
  }
}