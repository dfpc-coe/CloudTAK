/**
 * CloudFormation import utilities for BaseInfra/AuthInfra/TakInfra integration
 */

export const BASE_EXPORT_NAMES = {
  VPC_ID: 'VpcId',
  VPC_CIDR_IPV4: 'VpcCidrIpv4',
  SUBNET_PUBLIC_A: 'SubnetPublicA',
  SUBNET_PUBLIC_B: 'SubnetPublicB', 
  SUBNET_PRIVATE_A: 'SubnetPrivateA',
  SUBNET_PRIVATE_B: 'SubnetPrivateB',
  ECS_CLUSTER: 'EcsClusterArn',
  ECR_REPO: 'EcrRepoArn',
  KMS_KEY: 'KmsKeyArn',
  S3_BUCKET: 'S3BucketArn',
  HOSTED_ZONE_ID: 'HostedZoneId',
  HOSTED_ZONE_NAME: 'HostedZoneName',
  CERTIFICATE_ARN: 'CertificateArn'
} as const;

export const TAK_EXPORT_NAMES = {
  TAK_ADMIN_CERT_SECRET_ARN: 'TakAdminCertSecretArn',
  TAK_SERVICE_NAME: 'TakServiceName'
} as const;

export function createBaseImportValue(stackNameComponent: string, exportName: string): string {
  return `TAK-${stackNameComponent}-BaseInfra-${exportName}`;
}

export function createTakImportValue(stackNameComponent: string, exportName: string): string {
  return `TAK-${stackNameComponent}-TakInfra-${exportName}`;
}