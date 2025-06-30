/**
 * Tag generation utilities for CloudTAK
 */

import { ContextEnvironmentConfig } from '../stack-config';

/**
 * Generate standard tags for CloudTAK resources
 */
export function generateStandardTags(
  envConfig: ContextEnvironmentConfig,
  envType: 'prod' | 'dev-test',
  defaults?: any
): Record<string, string> {
  return {
    Environment: envType,
    StackName: envConfig.stackName,
    Project: 'CloudTAK',
    ManagedBy: 'CDK',
    ...(defaults?.tags || {})
  };
}