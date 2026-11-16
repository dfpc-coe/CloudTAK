/**
 * Configuration interface for CloudTAK stack template
 * This makes the stack reusable across different projects and environments
 */

/**
 * Context-based configuration interface matching cdk.context.json structure
 * This is used directly by the stack without complex transformations
 */
export interface ContextEnvironmentConfig {
  stackName: string;
  database: {
    instanceClass: string;
    instanceCount: number;
    engineVersion?: string;
    allocatedStorage: number;
    maxAllocatedStorage: number;
    enablePerformanceInsights: boolean;
    monitoringInterval: number;
    backupRetentionDays: number;
    deleteProtection: boolean;
    enableCloudWatchLogs?: boolean;
  };
  ecs: {
    taskCpu: number;
    taskMemory: number;
    /** Baseline task count for the stateless API service; also the autoscaling floor. */
    desiredCount: number;
    enableDetailedLogging: boolean;
    enableEcsExec?: boolean;
    /** CPU target for the stateless API service's tracking policy. Defaults to 70. */
    targetCpuUtilization?: number;
    /** Autoscaling ceiling for the stateless API service. Defaults to 10. */
    maxCapacity?: number;
  };
  cloudtak: {
    hostname: string;
    takAdminEmail: string;
    useS3CloudTAKConfigFile: boolean;
    webhooksSubdomain?: string;
    oidcEnabled?: boolean;
    oidcForced?: boolean;
    authentikUrl?: string;
    authentikAppSlug?: string;
    syncAuthentikAttributesOnLogin?: boolean;
    oidcSystemAdminGroup?: string;
    oidcAgencyAdminGroupPrefix?: string;
    authentikChannelGroupPrefix?: string;
    localOnlyAccounts?: string[];
    /**
     * CloudTAK web plugins to bake into the image (WEB_PLUGINS Docker build arg).
     * Comma and/or whitespace separated https GitHub URLs. Optional; empty or unset means no plugins.
     */
    webPlugins?: string;
  };
  ecr: {
    imageRetentionCount: number;
    scanOnPush: boolean;
  };
  general: {
    removalPolicy: string;
    enableDetailedLogging: boolean;
    enableContainerInsights: boolean;
  };
  s3: {
    enableVersioning: boolean;
  };
  mediainfra: {
    mediaHostname: string;
    /**
     * Whether media-infra exposes the plaintext RTSP (8554) and RTMP (1935) ports, its
     * `enableInsecurePorts`. When false CloudTAK only offers the TLS variants.
     * Defaults to true when unset.
     */
    enableInsecurePorts?: boolean;
  };
}