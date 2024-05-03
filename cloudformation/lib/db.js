import cf from '@openaddresses/cloudfriend';

export default {
    Parameters: {
        DatabaseType: {
            Type: 'String',
            Default: 'db.t3.micro',
            Description: 'Database size to create',
            AllowedValues: [
                'db.t3.micro',
                'db.m6g.large'
            ]
        }
    },
    Resources: {
        DBMasterSecret: {
            Type: 'AWS::SecretsManager::Secret',
            Properties: {
                Description: cf.join([cf.stackName, ' RDS Master Password']),
                GenerateSecretString: {
                    SecretStringTemplate: '{"username": "tak"}',
                    GenerateStringKey: 'password',
                    ExcludePunctuation: true,
                    PasswordLength: 32
                },
                Name: cf.join([cf.stackName, '/rds/secret']),
                KmsKeyId: cf.ref('KMS')
            }
        },
        DBMasterSecretAttachment: {
            Type: 'AWS::SecretsManager::SecretTargetAttachment',
            Properties: {
                SecretId: cf.ref('DBMasterSecret'),
                TargetId: cf.ref('DBInstance'),
                TargetType: 'AWS::RDS::DBInstance'
            }
        },
        DBMonitoringRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
                AssumeRolePolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [{
                        Sid: '',
                        Effect: 'Allow',
                        Principal: {
                            Service: 'monitoring.rds.amazonaws.com'
                        },
                        Action: 'sts:AssumeRole'
                    }]
                },
                ManagedPolicyArns: [
                    cf.join(['arn:', cf.partition, ':iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole'])
                ],
                Path: '/'
            }
        },
        DBInstance: {
            Type: 'AWS::RDS::DBInstance',
            DependsOn: ['DBMasterSecret'],
            Properties: {
                Engine: 'postgres',
                AllowMajorVersionUpgrade: false,
                DBName: 'tak_ps_etl',
                CopyTagsToSnapshot: true,
                DBInstanceIdentifier: cf.stackName,
                MonitoringInterval: 60,
                MonitoringRoleArn: cf.getAtt('DBMonitoringRole', 'Arn'),
                KmsKeyId: cf.ref('KMS'),
                EngineVersion: '16.2',
                StorageEncrypted: true,
                MasterUsername: cf.sub('{{resolve:secretsmanager:${AWS::StackName}/rds/secret:SecretString:username:AWSCURRENT}}'),
                MasterUserPassword: cf.sub('{{resolve:secretsmanager:${AWS::StackName}/rds/secret:SecretString:password:AWSCURRENT}}'),
                PreferredMaintenanceWindow: 'Sun:23:00-Sun:23:30',
                PreferredBackupWindow: '22:00-23:00',
                EnablePerformanceInsights: true,
                PerformanceInsightsKMSKeyId: cf.ref('KMS'),
                PerformanceInsightsRetentionPeriod: 7,
                AllocatedStorage: 200,
                MaxAllocatedStorage: 200,
                BackupRetentionPeriod: 10,
                StorageType: 'gp2',
                DBInstanceClass: cf.ref('DatabaseType'),
                VPCSecurityGroups: [cf.ref('DBVPCSecurityGroup')],
                DBSubnetGroupName: cf.ref('DBSubnet'),
                PubliclyAccessible: true,
                DeletionProtection: true
            }
        },
        DBSubnet: {
            Type: 'AWS::RDS::DBSubnetGroup',
            Properties: {
                DBSubnetGroupDescription: cf.join('-', [cf.stackName, 'rds-subnets']),
                SubnetIds: [
                    cf.importValue(cf.join(['coe-vpc-', cf.ref('Environment'), '-subnet-private-a'])),
                    cf.importValue(cf.join(['coe-vpc-', cf.ref('Environment'), '-subnet-private-b']))
                ]
            }
        },
        DBVPCSecurityGroup: {
            Type: 'AWS::EC2::SecurityGroup',
            Properties: {
                Tags: [{
                    Key: 'Name',
                    Value: cf.join('-', [cf.stackName, 'rds-sg'])
                }],
                GroupName: cf.join('-', [cf.stackName, 'rds-sg']),
                GroupDescription: 'Allow RDS Database Ingress',
                VpcId: cf.importValue(cf.join(['coe-vpc-', cf.ref('Environment'), '-vpc'])),
                SecurityGroupIngress: [{
                    IpProtocol: '-1',
                    SourceSecurityGroupId: cf.getAtt('ServiceSecurityGroup', 'GroupId')
                },{
                    IpProtocol: '-1',
                    CidrIp: '0.0.0.0/0'
                }]
            }
        }
    },
    Outputs: {
        DB: {
            Description: 'Postgres Connection String',
            Value: cf.join([
                'postgresql://',
                cf.sub('{{resolve:secretsmanager:${AWS::StackName}/rds/secret:SecretString:username:AWSCURRENT}}'),
                ':',
                cf.sub('{{resolve:secretsmanager:${AWS::StackName}/rds/secret:SecretString:password:AWSCURRENT}}'),
                '@',
                cf.getAtt('DBInstance', 'Endpoint.Address'),
                ':5432/tak_ps_etl'
            ])
        }
    }
};
