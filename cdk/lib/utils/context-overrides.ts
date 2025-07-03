/**
 * Dynamic context override utilities
 * Simplified flat parameter system for command-line context overrides
 */

import * as cdk from 'aws-cdk-lib';
import { ContextEnvironmentConfig } from '../stack-config';

export function applyContextOverrides(
  app: cdk.App, 
  baseConfig: ContextEnvironmentConfig
): ContextEnvironmentConfig {
  const topLevelOverrides = {
    stackName: app.node.tryGetContext('stackName'),
  };

  return {
    ...baseConfig,
    ...Object.fromEntries(Object.entries(topLevelOverrides).filter(([_, v]) => v !== undefined)),
    database: {
      ...baseConfig.database,
      instanceClass: app.node.tryGetContext('instanceClass') ?? baseConfig.database.instanceClass,
      instanceCount: app.node.tryGetContext('instanceCount') ?? baseConfig.database.instanceCount,
      allocatedStorage: app.node.tryGetContext('allocatedStorage') ?? baseConfig.database.allocatedStorage,
      maxAllocatedStorage: app.node.tryGetContext('maxAllocatedStorage') ?? baseConfig.database.maxAllocatedStorage,
      enablePerformanceInsights: app.node.tryGetContext('enablePerformanceInsights') ?? baseConfig.database.enablePerformanceInsights,
      monitoringInterval: app.node.tryGetContext('monitoringInterval') ?? baseConfig.database.monitoringInterval,
      backupRetentionDays: app.node.tryGetContext('backupRetentionDays') ?? baseConfig.database.backupRetentionDays,
      deleteProtection: app.node.tryGetContext('deleteProtection') ?? baseConfig.database.deleteProtection,
    },
    ecs: {
      ...baseConfig.ecs,
      taskCpu: app.node.tryGetContext('taskCpu') ?? baseConfig.ecs.taskCpu,
      taskMemory: app.node.tryGetContext('taskMemory') ?? baseConfig.ecs.taskMemory,
      desiredCount: app.node.tryGetContext('desiredCount') ?? baseConfig.ecs.desiredCount,
      enableDetailedLogging: app.node.tryGetContext('enableDetailedLogging') ?? baseConfig.ecs.enableDetailedLogging,
      enableEcsExec: app.node.tryGetContext('enableEcsExec') ?? baseConfig.ecs.enableEcsExec,
    },
    cloudtak: {
      ...baseConfig.cloudtak,
      hostname: app.node.tryGetContext('hostname') ?? baseConfig.cloudtak.hostname,
      databaseName: app.node.tryGetContext('databaseName') ?? baseConfig.cloudtak.databaseName,
      ecrRepositoryName: app.node.tryGetContext('ecrRepositoryName') ?? baseConfig.cloudtak.ecrRepositoryName,
    },
    ecr: {
      ...baseConfig.ecr,
      imageRetentionCount: app.node.tryGetContext('imageRetentionCount') ?? baseConfig.ecr.imageRetentionCount,
      scanOnPush: app.node.tryGetContext('scanOnPush') ?? baseConfig.ecr.scanOnPush,
    },
    general: {
      ...baseConfig.general,
      removalPolicy: app.node.tryGetContext('removalPolicy') || baseConfig.general.removalPolicy,
      enableDetailedLogging: app.node.tryGetContext('enableDetailedLogging') ?? baseConfig.general.enableDetailedLogging,
      enableContainerInsights: app.node.tryGetContext('enableContainerInsights') ?? baseConfig.general.enableContainerInsights,
    },
    s3: {
      ...baseConfig.s3,
      enableVersioning: app.node.tryGetContext('enableVersioning') ?? baseConfig.s3.enableVersioning,
    },
  };
}