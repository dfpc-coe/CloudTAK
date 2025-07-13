import {
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_secretsmanager as secretsmanager,
  aws_s3 as s3,
  aws_kms as kms,
  aws_elasticloadbalancingv2 as elbv2,
} from 'aws-cdk-lib';

/**
 * Infrastructure configuration shared across constructs
 */
export interface InfrastructureConfig {
  /**
   * VPC for deployment
   */
  vpc: ec2.IVpc;

  /**
   * Security group for ECS tasks
   */
  ecsSecurityGroup: ec2.SecurityGroup;

  /**
   * ECS cluster
   */
  ecsCluster: ecs.ICluster;

  /**
   * KMS key for secrets encryption
   */
  kmsKey: kms.IKey;
}

/**
 * Secrets configuration for all services
 */
export interface SecretsConfig {
  /**
   * Database secret
   */
  database: secretsmanager.ISecret;

  /**
   * CloudTAK-specific secrets
   */
  cloudtak: {
    /**
     * Signing secret for API authentication
     */
    signingSecret: secretsmanager.ISecret;
  };
}

/**
 * Storage configuration for S3
 */
export interface StorageConfig {
  /**
   * S3 configuration
   */
  s3: {
    /**
     * S3 asset bucket for CloudTAK
     */
    assetBucket: s3.IBucket;
  };
}

/**
 * Application configuration for CloudTAK services
 */
export interface CloudTakApplicationConfig {
  /**
   * Database configuration
   */
  database: {
    /**
     * Database hostname
     */
    hostname: string;

    /**
     * Database read replica hostname (optional)
     */
    readReplicaHostname?: string;
  };

  /**
   * CloudTAK host URL
   */
  cloudtakHost?: string;
}

/**
 * Network configuration for DNS and load balancers
 */
export interface NetworkConfig {
  /**
   * Hosted Zone ID imported from base infrastructure
   */
  hostedZoneId: string;

  /**
   * Hosted Zone Name imported from base infrastructure
   */
  hostedZoneName: string;

  /**
   * SSL certificate ARN for HTTPS
   */
  sslCertificateArn: string;

  /**
   * Hostname for services
   */
  hostname?: string;

  /**
   * Load balancer
   */
  loadBalancer?: elbv2.ILoadBalancerV2;
}