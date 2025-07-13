/**
 * CDK testing utilities and helpers for CloudTAK
 */
import { App, Stack } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import type { ContextEnvironmentConfig } from '../../lib/stack-config';

export class CDKTestHelper {
  /**
   * Create a test CDK app and stack
   */
  static createTestStack(stackName = 'TestStack'): { app: App; stack: Stack } {
    const app = new App();
    const stack = new Stack(app, stackName);
    return { app, stack };
  }

  /**
   * Create a mock VPC for testing
   */
  static createMockVpc(stack: Stack, id = 'TestVpc'): ec2.IVpc {
    return new ec2.Vpc(stack, id, {
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });
  }

  /**
   * Create mock AWS secrets for testing
   */
  static createMockSecrets(stack: Stack) {
    return {
      dbSecret: secretsmanager.Secret.fromSecretCompleteArn(
        stack, 'DbSecret', 
        'arn:aws:secretsmanager:us-west-2:123456789012:secret:db-secret-AbCdEf'
      ),
      signingSecret: secretsmanager.Secret.fromSecretCompleteArn(
        stack, 'SigningSecret', 
        'arn:aws:secretsmanager:us-west-2:123456789012:secret:signing-secret-AbCdEf'
      ),
      adminPasswordSecret: secretsmanager.Secret.fromSecretCompleteArn(
        stack, 'AdminPasswordSecret', 
        'arn:aws:secretsmanager:us-west-2:123456789012:secret:admin-password-AbCdEf'
      ),
      connectionStringSecret: secretsmanager.Secret.fromSecretCompleteArn(
        stack, 'ConnectionStringSecret', 
        'arn:aws:secretsmanager:us-west-2:123456789012:secret:connection-string-AbCdEf'
      )
    };
  }

  /**
   * Create mock infrastructure resources
   */
  static createMockInfrastructure(stack: Stack) {
    const vpc = this.createMockVpc(stack);
    const cluster = new ecs.Cluster(stack, 'TestCluster', { vpc });
    const securityGroup = new ec2.SecurityGroup(stack, 'TestSG', { vpc });
    const kmsKey = kms.Key.fromKeyArn(
      stack, 'TestKey', 
      'arn:aws:kms:us-west-2:123456789012:key/12345678-1234-1234-1234-123456789012'
    );

    return {
      vpc,
      ecsSecurityGroup: securityGroup,
      ecsCluster: cluster,
      kmsKey
    };
  }

  /**
   * Create mock network resources
   */
  static createMockNetwork(stack: Stack) {
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(stack, 'TestZone', {
      hostedZoneId: 'Z123456789',
      zoneName: 'test.com'
    });
    
    const certificate = acm.Certificate.fromCertificateArn(
      stack, 'TestCert',
      'arn:aws:acm:us-west-2:123456789012:certificate/test-cert'
    );

    return {
      hostedZone,
      certificate
    };
  }

  /**
   * Create mock S3 bucket
   */
  static createMockS3Bucket(stack: Stack, id = 'TestBucket'): s3.IBucket {
    return s3.Bucket.fromBucketArn(stack, id, 'arn:aws:s3:::test-bucket');
  }

  /**
   * Create mock ECR repository
   */
  static createMockEcrRepository(stack: Stack, id = 'TestRepo'): ecr.IRepository {
    return ecr.Repository.fromRepositoryArn(
      stack, id, 
      'arn:aws:ecr:us-west-2:123456789012:repository/mock-ecr-repository'
    );
  }

  /**
   * Create mock KMS key
   */
  static createMockKmsKey(stack: Stack, id = 'TestKmsKey'): kms.IKey {
    return kms.Key.fromKeyArn(
      stack, id, 
      'arn:aws:kms:us-west-2:123456789012:key/12345678-1234-1234-1234-123456789012'
    );
  }

  /**
   * Create test app with CloudTAK context
   */
  static createTestApp(): App {
    return new App({
      context: {
        'dev-test': {
          stackName: 'DevTest',
          database: {
            instanceClass: 'db.serverless',
            instanceCount: 1,
            engineVersion: '17.4',
            allocatedStorage: 20,
            maxAllocatedStorage: 100,
            enablePerformanceInsights: false,
            monitoringInterval: 0,
            backupRetentionDays: 7,
            deleteProtection: false
          },
          ecs: {
            taskCpu: 1024,
            taskMemory: 4096,
            desiredCount: 1,
            enableDetailedLogging: true,
            enableEcsExec: true
          },
          cloudtak: {
            hostname: 'map',
            takAdminEmail: 'admin@test.com'
          },
          ecr: {
            imageRetentionCount: 5,
            scanOnPush: false
          },
          general: {
            removalPolicy: 'DESTROY',
            enableDetailedLogging: true,
            enableContainerInsights: false
          },
          s3: {
            enableVersioning: false
          }
        },
        'prod': {
          stackName: 'Prod',
          database: {
            instanceClass: 'db.t4g.large',
            instanceCount: 2,
            engineVersion: '17.4',
            allocatedStorage: 100,
            maxAllocatedStorage: 1000,
            enablePerformanceInsights: true,
            monitoringInterval: 60,
            backupRetentionDays: 30,
            deleteProtection: true
          },
          ecs: {
            taskCpu: 2048,
            taskMemory: 8192,
            desiredCount: 2,
            enableDetailedLogging: false,
            enableEcsExec: false
          },
          cloudtak: {
            hostname: 'map',
            takAdminEmail: 'admin@prod.com'
          },
          ecr: {
            imageRetentionCount: 20,
            scanOnPush: true
          },
          general: {
            removalPolicy: 'RETAIN',
            enableDetailedLogging: false,
            enableContainerInsights: true
          },
          s3: {
            enableVersioning: true
          }
        },
        'tak-defaults': {
          project: 'TAK.NZ',
          component: 'CloudTAK',
          region: 'ap-southeast-2'
        }
      }
    });
  }
}