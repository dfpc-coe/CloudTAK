/**
 * Context override utilities for CloudTAK
 */

import * as cdk from 'aws-cdk-lib';
import { ContextEnvironmentConfig } from '../stack-config';

/**
 * Apply context overrides for non-prefixed parameters
 * This supports direct overrides that work for any environment:
 * --context hostname=custom-hostname
 * --context enableEcsExec=true
 */
export function applyContextOverrides(
  app: cdk.App,
  envConfig: ContextEnvironmentConfig
): ContextEnvironmentConfig {
  const overrides: Partial<ContextEnvironmentConfig> = {};

  // CloudTAK specific overrides
  const hostname = app.node.tryGetContext('hostname');
  if (hostname) {
    overrides.cloudtak = { ...envConfig.cloudtak, hostname };
  }

  // ECS overrides
  const enableEcsExec = app.node.tryGetContext('enableEcsExec');
  if (enableEcsExec !== undefined) {
    overrides.ecs = { ...envConfig.ecs, enableEcsExec: enableEcsExec === 'true' };
  }

  // Database overrides
  const enablePerformanceInsights = app.node.tryGetContext('enablePerformanceInsights');
  if (enablePerformanceInsights !== undefined) {
    overrides.database = { 
      ...envConfig.database, 
      enablePerformanceInsights: enablePerformanceInsights === 'true' 
    };
  }

  return {
    ...envConfig,
    ...overrides
  };
}