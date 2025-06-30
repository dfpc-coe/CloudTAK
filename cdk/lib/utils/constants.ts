/**
 * Default constants for CloudTAK infrastructure
 */

export const DEFAULT_AWS_REGION = 'ap-southeast-2';

export const DATABASE_CONSTANTS = {
  USERNAME: 'cloudtak',
  PASSWORD_LENGTH: 32,
  DEFAULT_DATABASE_NAME: 'tak_ps_etl',
  PORT: 5432
};

export const ECR_CONSTANTS = {
  DEFAULT_REPOSITORY_NAME: 'coe-ecr-etl',
  DEFAULT_RETENTION_COUNT: 10
};