/**
 * Database Construct - CDK implementation of the PostgreSQL database for CloudTAK
 */
import { Construct } from 'constructs';
import {
  aws_rds as rds,
  aws_ec2 as ec2,
  aws_secretsmanager as secretsmanager,
  aws_iam as iam,
  aws_kms as kms,
  aws_logs as logs,
  Duration,
  RemovalPolicy
} from 'aws-cdk-lib';
import type { ContextEnvironmentConfig } from '../stack-config';
import type { InfrastructureConfig } from '../construct-configs';
import { DATABASE_CONSTANTS } from '../utils/constants';

/**
 * Properties for the Database construct
 */
export interface DatabaseProps {
  /**
   * Environment type ('prod' | 'dev-test')
   */
  environment: 'prod' | 'dev-test';

  /**
   * Full stack name (e.g., 'TAK-Demo-CloudTAK')
   */
  stackName: string;

  /**
   * Context-based environment configuration (direct from cdk.json)
   */
  contextConfig: ContextEnvironmentConfig;

  /**
   * Infrastructure configuration (VPC, KMS, security groups)
   */
  infrastructure: InfrastructureConfig;

  /**
   * Security groups for database access
   */
  securityGroups: ec2.SecurityGroup[];
}

/**
 * CDK construct for the PostgreSQL database cluster for CloudTAK
 */
export class Database extends Construct {
  /**
   * The master secret for database access
   */
  public readonly masterSecret: secretsmanager.Secret;

  /**
   * The RDS database cluster
   */
  public readonly cluster: rds.DatabaseCluster;

  /**
   * The database hostname
   */
  public readonly hostname: string;

  /**
   * The database reader endpoint hostname (for read replicas)
   */
  public readonly readerEndpoint: string;

  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id);

    // Validate required database configuration
    if (!props.contextConfig.database) {
      throw new Error('Database configuration is required when using Database construct');
    }
    const dbConfig = props.contextConfig.database;

    // Derive environment-specific values from context (matches reference pattern)
    const isHighAvailability = props.environment === 'prod';
    const removalPolicy = props.contextConfig.general?.removalPolicy === 'RETAIN' ? 
      RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;
    const enableMonitoring = dbConfig.monitoringInterval > 0;

    // Create the master secret
    this.masterSecret = new secretsmanager.Secret(this, 'DBMasterSecret', {
      description: `${id}: PostgreSQL Master Password`,
      secretName: `${props.stackName}/Database/Master-Password`,
      encryptionKey: props.infrastructure.kmsKey,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: DATABASE_CONSTANTS.USERNAME }),
        generateStringKey: 'password',
        excludePunctuation: true,
        passwordLength: DATABASE_CONSTANTS.PASSWORD_LENGTH
      }
    });

    // Create the monitoring role
    const monitoringRole = new iam.Role(this, 'DBMonitoringRole', {
      assumedBy: new iam.ServicePrincipal('monitoring.rds.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonRDSEnhancedMonitoringRole')
      ],
      path: '/'
    });

    // Create subnet group
    const subnetGroup = new rds.SubnetGroup(this, 'DBSubnetGroup', {
      description: `${id} database subnet group`,
      vpc: props.infrastructure.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      }
    });

    // Create parameter group for PostgreSQL
    const engineVersionString = dbConfig.engineVersion || '15.4';
    const engineVersion = engineVersionString.startsWith('15') ? 
      rds.AuroraPostgresEngineVersion.VER_15_4 : 
      rds.AuroraPostgresEngineVersion.VER_16_6;
    const parameterGroup = new rds.ParameterGroup(this, 'DBParameterGroup', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: engineVersion
      }),
      description: `${id} cluster parameter group`,
      parameters: {
        'shared_preload_libraries': 'pg_stat_statements',
        'log_statement': 'all',
        'log_min_duration_statement': '1000',
        'log_connections': '1',
        'log_disconnections': '1'
      }
    });

    // Create the database cluster with conditional configuration for serverless vs provisioned
    const isServerless = dbConfig.instanceClass === 'db.serverless';
    
    if (isServerless) {
      // Aurora Serverless v2 configuration
      this.cluster = new rds.DatabaseCluster(this, 'DBCluster', {
        engine: rds.DatabaseClusterEngine.auroraPostgres({
          version: engineVersion
        }),
        credentials: rds.Credentials.fromSecret(this.masterSecret),
        defaultDatabaseName: DATABASE_CONSTANTS.DEFAULT_DATABASE_NAME,
        port: DATABASE_CONSTANTS.PORT,
        serverlessV2MinCapacity: 0.5,
        serverlessV2MaxCapacity: 4,
        writer: rds.ClusterInstance.serverlessV2('writer'),
        readers: dbConfig.instanceCount > 1 ? 
          Array.from({ length: dbConfig.instanceCount - 1 }, (_, i) => 
            rds.ClusterInstance.serverlessV2(`reader${i + 1}`)
          ) : [],
        parameterGroup,
        subnetGroup,
        vpc: props.infrastructure.vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
        },
        securityGroups: props.securityGroups,
        storageEncrypted: true,
        storageEncryptionKey: props.infrastructure.kmsKey,
        backup: {
          retention: Duration.days(props.contextConfig.database.backupRetentionDays)
        },
        deletionProtection: props.contextConfig.database.deleteProtection,
        removalPolicy: removalPolicy,
        cloudwatchLogsExports: ['postgresql'],
        cloudwatchLogsRetention: props.contextConfig.general.enableDetailedLogging ? 
          logs.RetentionDays.ONE_MONTH : 
          logs.RetentionDays.ONE_WEEK,
        monitoringRole: enableMonitoring ? monitoringRole : undefined,
        monitoringInterval: enableMonitoring ? Duration.seconds(dbConfig.monitoringInterval) : undefined
      });
    } else {
      // Provisioned instances configuration
      const instanceType = ec2.InstanceType.of(
        ec2.InstanceClass.T4G,
        dbConfig.instanceClass.includes('large') ? ec2.InstanceSize.LARGE :
        ec2.InstanceSize.MEDIUM
      );

      this.cluster = new rds.DatabaseCluster(this, 'DBCluster', {
        engine: rds.DatabaseClusterEngine.auroraPostgres({
          version: engineVersion
        }),
        credentials: rds.Credentials.fromSecret(this.masterSecret),
        defaultDatabaseName: DATABASE_CONSTANTS.DEFAULT_DATABASE_NAME,
        port: DATABASE_CONSTANTS.PORT,
        writer: rds.ClusterInstance.provisioned('writer', {
          instanceType,
          enablePerformanceInsights: dbConfig.enablePerformanceInsights,
          performanceInsightRetention: dbConfig.enablePerformanceInsights ? 
            rds.PerformanceInsightRetention.MONTHS_6 : 
            undefined
        }),
        readers: props.contextConfig.database.instanceCount > 1 ? 
          Array.from({ length: props.contextConfig.database.instanceCount - 1 }, (_, i) => 
            rds.ClusterInstance.provisioned(`reader${i + 1}`, {
              instanceType,
              enablePerformanceInsights: props.contextConfig.database.enablePerformanceInsights,
              performanceInsightRetention: props.contextConfig.database.enablePerformanceInsights ? 
                rds.PerformanceInsightRetention.MONTHS_6 : 
                undefined
            })
          ) : [],
        parameterGroup,
        subnetGroup,
        vpc: props.infrastructure.vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
        },
        securityGroups: props.securityGroups,
        storageEncrypted: true,
        storageEncryptionKey: props.infrastructure.kmsKey,
        backup: {
          retention: Duration.days(props.contextConfig.database.backupRetentionDays)
        },
        deletionProtection: props.contextConfig.database.deleteProtection,
        removalPolicy: removalPolicy,
        cloudwatchLogsExports: ['postgresql'],
        cloudwatchLogsRetention: props.contextConfig.general.enableDetailedLogging ? 
          logs.RetentionDays.ONE_MONTH : 
          logs.RetentionDays.ONE_WEEK,
        monitoringRole: enableMonitoring ? monitoringRole : undefined,
        monitoringInterval: enableMonitoring ? Duration.seconds(dbConfig.monitoringInterval) : undefined
      });
    }

    // Store the hostname and reader endpoint
    this.hostname = this.cluster.clusterEndpoint.hostname;
    this.readerEndpoint = this.cluster.clusterReadEndpoint.hostname;
  }
}