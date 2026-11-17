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
  RemovalPolicy,
  SecretValue,
  Fn
} from 'aws-cdk-lib';
import type { ContextEnvironmentConfig } from '../stack-config';
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
   * Context-based environment configuration (direct from cdk.json)
   */
  envConfig: ContextEnvironmentConfig;

  /**
   * VPC for deployment
   */
  vpc: ec2.IVpc;

  /**
   * KMS key for encryption
   */
  kmsKey: kms.IKey;

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
   * True when the cluster runs Aurora Serverless v2 (`db.serverless`), false
   * when it uses provisioned instances. Derived from the instance class, not
   * the environment name. Monitoring uses it because some CloudWatch metrics
   * (e.g. FreeLocalStorage) are only published for provisioned instances.
   */
  public readonly isServerless: boolean;

  /**
   * The database hostname
   */
  public readonly hostname: string;

  /**
   * The database reader endpoint hostname (for read replicas)
   */
  public readonly readerEndpoint: string;

  /**
   * The connection string secret
   */
  public readonly connectionStringSecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id);

    // Validate required database configuration
    if (!props.envConfig.database) {
      throw new Error('Database configuration is required when using Database construct');
    }
    const dbConfig = props.envConfig.database;

    // Derive environment-specific values from context (matches reference pattern)
    const isHighAvailability = props.environment === 'prod';
    const removalPolicy = props.envConfig.general?.removalPolicy === 'RETAIN' ? 
      RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;
    const enableMonitoring = dbConfig.monitoringInterval > 0;

    // Create the master secret
    this.masterSecret = new secretsmanager.Secret(this, 'DBMasterSecret', {
      description: `${id}: PostgreSQL Master Password`,
      secretName: `TAK-${props.envConfig.stackName}-CloudTAK/Database/Master-Password`,
      encryptionKey: props.kmsKey,
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
      path: '/service-role/'
    });

    // Create subnet group
    const subnetGroup = new rds.SubnetGroup(this, 'DBSubnetGroup', {
      description: `${id} database subnet group`,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      }
    });

    // Create parameter group for PostgreSQL.
    // Derive the Aurora engine version directly from the configured version
    // string so the config is the single source of truth. Using
    // AuroraPostgresEngineVersion.of(fullVersion, majorVersion) (rather than a
    // hard-coded VER_x_y constant) means a new minor can be adopted from config
    // alone, without waiting for the aws-cdk-lib enum to add it - the enum lags
    // behind AWS engine releases (e.g. 18.6 has no VER_18_6 constant yet).
    //
    // The major version (the first dotted segment) also selects the parameter
    // group family (aurora-postgresql<major>). Changing the major version
    // therefore replaces the cluster parameter group and triggers an in-place
    // major upgrade of the cluster. See docs/AURORA-MAJOR-UPGRADE.md before
    // changing database.engineVersion across a major version.
    //
    // Note: AWS::RDS::DBCluster has no AllowMajorVersionUpgrade property (only
    // AWS::RDS::DBInstance does), so there is no cluster-level override to set.
    // The parameter group has no fixed physical name, so the replacement group
    // gets a generated name and does not collide with the old one.
    const engineVersionString = dbConfig.engineVersion || '18.6';
    const majorVersion = engineVersionString.split('.')[0];
    const engineVersion = rds.AuroraPostgresEngineVersion.of(engineVersionString, majorVersion);
    const parameterGroup = new rds.ParameterGroup(this, 'DBParameterGroup', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: engineVersion
      }),
      description: `${id} cluster parameter group`,
      parameters: {
        'shared_preload_libraries': 'pg_stat_statements',
        'log_statement': 'all',
        'log_min_duration_statement': '1000',
        // PG18 changed log_connections from a boolean to a list of connection
        // stages ('1' is no longer an allowed value); 'all' is the PG18 superset
        // of the previous boolean behaviour.
        'log_connections': Number(majorVersion) >= 18 ? 'all' : '1',
        'log_disconnections': '1'
      }
    });

    // Create the database cluster with conditional configuration for serverless vs provisioned
    const isServerless = dbConfig.instanceClass === 'db.serverless';
    this.isServerless = isServerless;
    
    if (isServerless) {
      // Aurora Serverless v2 configuration
      this.cluster = new rds.DatabaseCluster(this, 'DBCluster', {
        engine: rds.DatabaseClusterEngine.auroraPostgres({
          version: engineVersion
        }),
        credentials: rds.Credentials.fromSecret(this.masterSecret),
        defaultDatabaseName: DATABASE_CONSTANTS.DEFAULT_DATABASE_NAME,
        port: DATABASE_CONSTANTS.PORT,
        networkType: rds.NetworkType.DUAL,
        serverlessV2MinCapacity: 2,
        serverlessV2MaxCapacity: 4,
        writer: rds.ClusterInstance.serverlessV2('writer'),
        readers: dbConfig.instanceCount > 1 ? 
          Array.from({ length: dbConfig.instanceCount - 1 }, (_, i) => 
            rds.ClusterInstance.serverlessV2(`reader${i + 1}`)
          ) : [],
        parameterGroup,
        subnetGroup,
        vpc: props.vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
        },
        securityGroups: props.securityGroups,
        storageEncrypted: true,
        storageEncryptionKey: props.kmsKey,
        backup: {
          retention: Duration.days(props.envConfig.database.backupRetentionDays)
        },
        deletionProtection: props.envConfig.database.deleteProtection,
        removalPolicy: removalPolicy,
        cloudwatchLogsExports: props.envConfig.database.enableCloudWatchLogs ? ['postgresql'] : undefined,
        cloudwatchLogsRetention: props.envConfig.general.enableDetailedLogging ? 
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
        networkType: rds.NetworkType.DUAL,
        // The RDS Data API (HTTP endpoint) is not supported on T instance classes, and a
        // cluster that has it enabled makes CloudFormation fail with "The instance class that
        // you specified doesn't support the HTTP endpoint" when the writer moves off
        // db.serverless. Set it to false explicitly so a cluster that had it switched on (for
        // example through the console query editor) is updated before its instance class
        // changes. Nothing in CloudTAK uses the Data API; the API connects over pg.
        enableDataApi: false,
        writer: rds.ClusterInstance.provisioned('writer', {
          instanceType,
          enablePerformanceInsights: dbConfig.enablePerformanceInsights,
          performanceInsightRetention: dbConfig.enablePerformanceInsights ? 
            rds.PerformanceInsightRetention.MONTHS_6 : 
            undefined
        }),
        readers: props.envConfig.database.instanceCount > 1 ? 
          Array.from({ length: props.envConfig.database.instanceCount - 1 }, (_, i) => 
            rds.ClusterInstance.provisioned(`reader${i + 1}`, {
              instanceType,
              enablePerformanceInsights: props.envConfig.database.enablePerformanceInsights,
              performanceInsightRetention: props.envConfig.database.enablePerformanceInsights ? 
                rds.PerformanceInsightRetention.MONTHS_6 : 
                undefined
            })
          ) : [],
        parameterGroup,
        subnetGroup,
        vpc: props.vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
        },
        securityGroups: props.securityGroups,
        storageEncrypted: true,
        storageEncryptionKey: props.kmsKey,
        backup: {
          retention: Duration.days(props.envConfig.database.backupRetentionDays)
        },
        deletionProtection: props.envConfig.database.deleteProtection,
        removalPolicy: removalPolicy,
        cloudwatchLogsExports: props.envConfig.database.enableCloudWatchLogs ? ['postgresql'] : undefined,
        cloudwatchLogsRetention: props.envConfig.general.enableDetailedLogging ? 
          logs.RetentionDays.ONE_MONTH : 
          logs.RetentionDays.ONE_WEEK,
        monitoringRole: enableMonitoring ? monitoringRole : undefined,
        monitoringInterval: enableMonitoring ? Duration.seconds(dbConfig.monitoringInterval) : undefined
      });
    }

    // Store the hostname and reader endpoint
    this.hostname = this.cluster.clusterEndpoint.hostname;
    this.readerEndpoint = this.cluster.clusterReadEndpoint.hostname;

    // Create connection string secret
    this.connectionStringSecret = new secretsmanager.Secret(this, 'ConnectionStringSecret', {
      description: `${id}: PostgreSQL Connection String`,
      secretName: `TAK-${props.envConfig.stackName}-CloudTAK/Database/Connection-String`,
      encryptionKey: props.kmsKey,
      secretStringValue: SecretValue.unsafePlainText(
        Fn.sub('postgresql://${username}:${password}@${endpoint}:5432/tak_ps_etl?sslmode=require', {
          username: '{{resolve:secretsmanager:TAK-' + props.envConfig.stackName + '-CloudTAK/Database/Master-Password:SecretString:username:AWSCURRENT}}',
          password: '{{resolve:secretsmanager:TAK-' + props.envConfig.stackName + '-CloudTAK/Database/Master-Password:SecretString:password:AWSCURRENT}}',
          endpoint: this.hostname
        })
      )
    });
  }
}