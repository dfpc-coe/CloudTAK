/**
 * ECR Repository construct for ETL Tasks
 * 
 * Creates a dedicated ECR repository for ETL task containers with:
 * - Lifecycle policy for image retention
 * - Image scanning configuration
 * - KMS encryption
 */

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as kms from 'aws-cdk-lib/aws-kms';
import { ContextEnvironmentConfig } from '../stack-config';

export interface EtlEcrProps {
  envConfig: ContextEnvironmentConfig;
  kmsKey: kms.IKey;
}

export class EtlEcr extends Construct {
  public readonly repository: ecr.Repository;

  constructor(scope: Construct, id: string, props: EtlEcrProps) {
    super(scope, id);

    const { envConfig, kmsKey } = props;

    this.repository = new ecr.Repository(this, 'Repository', {
      repositoryName: `tak-${envConfig.stackName.toLowerCase()}-etl-tasks`,
      imageScanOnPush: envConfig.ecr.scanOnPush,
      encryptionKey: kmsKey,
      lifecycleRules: [{
        rulePriority: 1,
        description: 'Keep last N images',
        maxImageCount: envConfig.ecr.imageRetentionCount
      }],
      removalPolicy: envConfig.general.removalPolicy === 'RETAIN' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY
    });
  }
}