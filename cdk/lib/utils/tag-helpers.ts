import { ContextEnvironmentConfig } from '../stack-config';

/**
 * Interface for tag-related defaults from cdk.json context
 */
export interface TagDefaults {
  project?: string;
  component?: string;
}

/**
 * Generate standardized tags for TAK infrastructure resources
 * 
 * @param envConfig - Environment configuration
 * @param environment - Environment type ('prod' | 'dev-test')
 * @param defaults - Default values from cdk.json context
 * @returns Object containing all standard tags
 */
export function generateStandardTags(
  envConfig: ContextEnvironmentConfig,
  environment: 'prod' | 'dev-test',
  defaults?: TagDefaults
): Record<string, string> {
  const environmentLabel = environment === 'prod' ? 'Prod' : 'Dev-Test';
  
  return {
    // Core identification tags
    Project: defaults?.project || 'TAK',
    Environment: envConfig.stackName,
    Component: defaults?.component || 'CloudTAK',
    ManagedBy: 'CDK',
    
    // Environment type classification
    'Environment Type': environmentLabel,
  };
}