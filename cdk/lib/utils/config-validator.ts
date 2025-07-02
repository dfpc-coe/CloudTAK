import { ContextEnvironmentConfig } from '../stack-config';

export class ConfigValidator {
  static validateEnvironmentConfig(envConfig: ContextEnvironmentConfig, environment: 'prod' | 'dev-test'): void {
    if (!envConfig.stackName) {
      throw new Error('stackName is required in environment configuration');
    }
    
    if (!envConfig.cloudtak?.hostname) {
      throw new Error('cloudtak.hostname is required in environment configuration');
    }
    
    if (!envConfig.database) {
      throw new Error('database configuration is required');
    }
    
    if (!envConfig.ecs) {
      throw new Error('ecs configuration is required');
    }
  }
}