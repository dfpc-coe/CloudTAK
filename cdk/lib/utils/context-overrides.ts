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
      instanceCount: app.node.tryGetContext('instanceCount') ? Number(app.node.tryGetContext('instanceCount')) : baseConfig.database.instanceCount,
      allocatedStorage: app.node.tryGetContext('allocatedStorage') ? Number(app.node.tryGetContext('allocatedStorage')) : baseConfig.database.allocatedStorage,
      maxAllocatedStorage: app.node.tryGetContext('maxAllocatedStorage') ? Number(app.node.tryGetContext('maxAllocatedStorage')) : baseConfig.database.maxAllocatedStorage,
      enablePerformanceInsights: app.node.tryGetContext('enablePerformanceInsights') ? app.node.tryGetContext('enablePerformanceInsights') === 'true' : baseConfig.database.enablePerformanceInsights,
      monitoringInterval: app.node.tryGetContext('monitoringInterval') ? Number(app.node.tryGetContext('monitoringInterval')) : baseConfig.database.monitoringInterval,
      backupRetentionDays: app.node.tryGetContext('backupRetentionDays') ? Number(app.node.tryGetContext('backupRetentionDays')) : baseConfig.database.backupRetentionDays,
      deleteProtection: app.node.tryGetContext('deleteProtection') ? app.node.tryGetContext('deleteProtection') === 'true' : baseConfig.database.deleteProtection,
      enableCloudWatchLogs: app.node.tryGetContext('enableCloudWatchLogs') ? app.node.tryGetContext('enableCloudWatchLogs') === 'true' : baseConfig.database.enableCloudWatchLogs,
    },
    ecs: {
      ...baseConfig.ecs,
      taskCpu: app.node.tryGetContext('taskCpu') ? Number(app.node.tryGetContext('taskCpu')) : baseConfig.ecs.taskCpu,
      taskMemory: app.node.tryGetContext('taskMemory') ? Number(app.node.tryGetContext('taskMemory')) : baseConfig.ecs.taskMemory,
      desiredCount: app.node.tryGetContext('desiredCount') ? Number(app.node.tryGetContext('desiredCount')) : baseConfig.ecs.desiredCount,
      enableDetailedLogging: app.node.tryGetContext('enableDetailedLogging') ? app.node.tryGetContext('enableDetailedLogging') === 'true' : baseConfig.ecs.enableDetailedLogging,
      enableEcsExec: app.node.tryGetContext('enableEcsExec') ? app.node.tryGetContext('enableEcsExec') === 'true' : baseConfig.ecs.enableEcsExec,
    },
    cloudtak: {
      ...baseConfig.cloudtak,
      hostname: app.node.tryGetContext('hostname') ?? baseConfig.cloudtak.hostname,
      takAdminEmail: app.node.tryGetContext('takAdminEmail') ?? baseConfig.cloudtak.takAdminEmail,
      useS3CloudTAKConfigFile: app.node.tryGetContext('useS3CloudTAKConfigFile') ? app.node.tryGetContext('useS3CloudTAKConfigFile') === 'true' : baseConfig.cloudtak.useS3CloudTAKConfigFile,
    },
    ecr: {
      ...baseConfig.ecr,
      imageRetentionCount: app.node.tryGetContext('imageRetentionCount') ? Number(app.node.tryGetContext('imageRetentionCount')) : baseConfig.ecr.imageRetentionCount,
      scanOnPush: app.node.tryGetContext('scanOnPush') ? app.node.tryGetContext('scanOnPush') === 'true' : baseConfig.ecr.scanOnPush,
    },
    general: {
      ...baseConfig.general,
      removalPolicy: app.node.tryGetContext('removalPolicy') || baseConfig.general.removalPolicy,
      enableDetailedLogging: app.node.tryGetContext('enableDetailedLogging') ? app.node.tryGetContext('enableDetailedLogging') === 'true' : baseConfig.general.enableDetailedLogging,
      enableContainerInsights: app.node.tryGetContext('enableContainerInsights') ? app.node.tryGetContext('enableContainerInsights') === 'true' : baseConfig.general.enableContainerInsights,
    },
    s3: {
      ...baseConfig.s3,
      enableVersioning: app.node.tryGetContext('enableVersioning') ? app.node.tryGetContext('enableVersioning') === 'true' : baseConfig.s3.enableVersioning,
    },
  };
}