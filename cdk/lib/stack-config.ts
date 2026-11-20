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
    /**
     * Provision Authentik users into CloudTAK over SCIM. Creates a generated bearer token in Secrets
     * Manager, hands it to the CloudTAK API (`SCIM_ENABLED` / `SCIM_TOKEN`) and creates the matching
     * Authentik SCIM provider on the CloudTAK application. Requires `oidcEnabled`. Defaults to false.
     */
    scimEnabled?: boolean;
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
    /**
     * Provisioned concurrency for the `pmtiles` Lambda `live` alias. Keeps that many
     * containers warm so a burst of tile requests on first map load skips cold starts.
     * Each unit is billed continuously (about $6.50/month). 0 disables it. Defaults to 2,
     * which is upstream's default.
     */
    pmtilesProvisionedConcurrency?: number;
    /**
     * Create the SES Mail Manager ingress point and its MX record, which receive email for
     * ETL layers. The ingress point costs about $49/month flat. Defaults to true when unset.
     * When false the rest of the mail stack stays deployed, but inbound mail bounces.
     */
    enableInboundMail?: boolean;
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