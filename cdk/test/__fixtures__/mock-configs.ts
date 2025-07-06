/**
 * Reusable test configuration objects for CloudTAK
 */
import type { ContextEnvironmentConfig } from '../../lib/stack-config';

export const MOCK_CONFIGS = {
  DEV_TEST: {
    stackName: 'DevTest',
    database: {
      instanceClass: 'db.serverless',
      instanceCount: 1,
      engineVersion: '17.4',
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      enablePerformanceInsights: false,
      monitoringInterval: 0,
      backupRetentionDays: 7,
      deleteProtection: false
    },
    ecs: {
      taskCpu: 1024,
      taskMemory: 4096,
      desiredCount: 1,
      enableDetailedLogging: true,
      enableEcsExec: true
    },
    cloudtak: {
      hostname: 'map',
      takAdminEmail: 'admin@test.com'
    },
    ecr: {
      imageRetentionCount: 5,
      scanOnPush: false
    },
    general: {
      removalPolicy: 'DESTROY',
      enableDetailedLogging: true,
      enableContainerInsights: false
    },
    s3: {
      enableVersioning: false
    }
  } as ContextEnvironmentConfig,

  PROD: {
    stackName: 'Prod',
    database: {
      instanceClass: 'db.t4g.large',
      instanceCount: 2,
      engineVersion: '17.4',
      allocatedStorage: 100,
      maxAllocatedStorage: 1000,
      enablePerformanceInsights: true,
      monitoringInterval: 60,
      backupRetentionDays: 30,
      deleteProtection: true
    },
    ecs: {
      taskCpu: 2048,
      taskMemory: 8192,
      desiredCount: 2,
      enableDetailedLogging: false,
      enableEcsExec: false
    },
    cloudtak: {
      hostname: 'map',
      takAdminEmail: 'admin@prod.com'
    },
    ecr: {
      imageRetentionCount: 20,
      scanOnPush: true
    },
    general: {
      removalPolicy: 'RETAIN',
      enableDetailedLogging: false,
      enableContainerInsights: true
    },
    s3: {
      enableVersioning: true
    }
  } as ContextEnvironmentConfig,

  MINIMAL: {
    stackName: 'Minimal',
    database: {
      instanceClass: 'db.serverless',
      instanceCount: 1,
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      enablePerformanceInsights: false,
      monitoringInterval: 0,
      backupRetentionDays: 1,
      deleteProtection: false
    },
    ecs: {
      taskCpu: 512,
      taskMemory: 1024,
      desiredCount: 1,
      enableDetailedLogging: false
    },
    cloudtak: {
      hostname: 'test',
      takAdminEmail: 'test@example.com'
    },
    ecr: {
      imageRetentionCount: 1,
      scanOnPush: false
    },
    general: {
      removalPolicy: 'DESTROY',
      enableDetailedLogging: false,
      enableContainerInsights: false
    },
    s3: {
      enableVersioning: false
    }
  } as ContextEnvironmentConfig
};