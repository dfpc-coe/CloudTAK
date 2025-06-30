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
  ECS_CLUSTER: 'EcsCluster',
  ECR_REPO: 'EcrRepository',
  KMS_KEY: 'KmsKey',
  S3_BUCKET: 'S3ConfigBucket',
  HOSTED_ZONE_ID: 'HostedZoneId',
  HOSTED_ZONE_NAME: 'HostedZoneName',
  CERTIFICATE_ARN: 'CertificateArn'
} as const;

export function createBaseImportValue(stackNameComponent: string, exportName: string): string {
  return `TAK-${stackNameComponent}-BaseInfra-${exportName}`;
}