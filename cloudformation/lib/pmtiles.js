import cf from '@openaddresses/cloudfriend';
import fs from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

export default {
    Resources: {
        PMTilesLambdaSecurityGroup: {
            Type: 'AWS::EC2::SecurityGroup',
            Properties: {
                GroupDescription: 'Security Group for PMTiles Lambda',
                VpcId: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-vpc'])),
                SecurityGroupEgress: [{
                    IpProtocol: '-1',
                    CidrIp: '0.0.0.0/0'
                }]
            }
        },
        EFSFileSystem: {
            Type: 'AWS::EFS::FileSystem',
            Properties: {
                Encrypted: true,
                FileSystemTags: [{
                    Key: 'Name',
                    Value: cf.join('-', [cf.stackName, 'pmtiles-efs'])
                }]
            }
        },
        EFSSecurityGroup: {
            Type: 'AWS::EC2::SecurityGroup',
            Properties: {
                GroupDescription: 'Security Group for EFS',
                VpcId: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-vpc'])),
                SecurityGroupIngress: [{
                    IpProtocol: 'tcp',
                    FromPort: 2049,
                    ToPort: 2049,
                    SourceSecurityGroupId: cf.ref('PMTilesLambdaSecurityGroup')
                }]
            }
        },
        EFSMountTargetA: {
            Type: 'AWS::EFS::MountTarget',
            Properties: {
                FileSystemId: cf.ref('EFSFileSystem'),
                SubnetId: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-subnet-private-a'])),
                SecurityGroups: [cf.ref('EFSSecurityGroup')]
            }
        },
        EFSMountTargetB: {
            Type: 'AWS::EFS::MountTarget',
            Properties: {
                FileSystemId: cf.ref('EFSFileSystem'),
                SubnetId: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-subnet-private-b'])),
                SecurityGroups: [cf.ref('EFSSecurityGroup')]
            }
        },
        EFSPoint: {
            Type: 'AWS::EFS::AccessPoint',
            Properties: {
                FileSystemId: cf.ref('EFSFileSystem'),
                PosixUser: {
                    Uid: '1000',
                    Gid: '1000'
                },
                RootDirectory: {
                    CreationInfo: {
                        OwnerGid: '1000',
                        OwnerUid: '1000',
                        Permissions: '755'
                    },
                    Path: '/pmtiles'
                }
            }
        },
        EFSCleanupLambda: {
            Type: 'AWS::Lambda::Function',
            DependsOn: ['EFSMountTargetA', 'EFSMountTargetB'],
            Properties: {
                FunctionName: cf.join([cf.stackName, '-efs-cleanup']),
                MemorySize: 128,
                Timeout: 900,
                Description: 'Cleanup old files from EFS',
                Runtime: 'nodejs24.x',
                Handler: 'index.handler',
                Role: cf.getAtt('EFSCleanupLambdaRole', 'Arn'),
                Code: {
                    ZipFile: fs.readFileSync(path.join(__dirname, './pmtiles-lambda.js'), 'utf8')
                },
                VpcConfig: {
                    SecurityGroupIds: [cf.ref('PMTilesLambdaSecurityGroup')],
                    SubnetIds: [
                        cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-subnet-private-a'])),
                        cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-subnet-private-b']))
                    ]
                },
                FileSystemConfigs: [{
                    Arn: cf.join(['arn:', cf.partition, ':elasticfilesystem:', cf.region, ':', cf.accountId, ':access-point/', cf.ref('EFSPoint')]),
                    LocalMountPath: '/mnt/efs'
                }]
            }
        },
        EFSCleanupLambdaRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
                AssumeRolePolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Principal: {
                            Service: 'lambda.amazonaws.com'
                        },
                        Action: 'sts:AssumeRole'
                    }]
                },
                ManagedPolicyArns: [
                    cf.join(['arn:', cf.partition, ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole']),
                    cf.join(['arn:', cf.partition, ':iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole'])
                ]
            }
        },
        EFSCleanupSchedule: {
            Type: 'AWS::Events::Rule',
            Properties: {
                Description: 'Schedule for EFS Cleanup',
                ScheduleExpression: 'rate(1 day)',
                State: 'ENABLED',
                Targets: [{
                    Arn: cf.getAtt('EFSCleanupLambda', 'Arn'),
                    Id: 'EFSCleanupLambdaTarget'
                }]
            }
        },
        EFSCleanupPermission: {
            Type: 'AWS::Lambda::Permission',
            Properties: {
                FunctionName: cf.ref('EFSCleanupLambda'),
                Action: 'lambda:InvokeFunction',
                Principal: 'events.amazonaws.com',
                SourceArn: cf.getAtt('EFSCleanupSchedule', 'Arn')
            }
        },
        PMTilesDNS: {
            Type: 'AWS::Route53::RecordSet',
            Properties: {
                HostedZoneId: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-hosted-zone-id'])),
                Type : 'A',
                Name: cf.join(['tiles.map.', cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-hosted-zone-name']))]),
                Comment: cf.join(' ', [cf.stackName, 'PMTiles API DNS Entry']),
                AliasTarget: {
                    DNSName: cf.getAtt('PMTilesApiDomainV2', 'RegionalDomainName'),
                    EvaluateTargetHealth: true,
                    HostedZoneId: cf.getAtt('PMTilesApiDomainV2', 'RegionalHostedZoneId')
                }
            }
        },
        PMTilesLambda: {
            Type: 'AWS::Lambda::Function',
            DependsOn: ['SigningSecret', 'EFSMountTargetA', 'EFSMountTargetB'],
            Properties: {
                FunctionName: cf.join([cf.stackName, '-pmtiles']),
                MemorySize: 256,
                Timeout: 60,
                Description: 'Return Mapbox Vector Tiles from a PMTiles Store',
                PackageType: 'Image',
                Environment: {
                    Variables: {
                        StackName: cf.stackName,
                        ASSET_BUCKET: cf.ref('AssetBucket'),
                        PMTILES_URL: cf.join(['https://tiles.map.', cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-hosted-zone-name']))]),
                        SigningSecret: cf.sub('{{resolve:secretsmanager:${AWS::StackName}/api/secret:SecretString::AWSCURRENT}}')
                    }
                },
                Role: cf.getAtt('PMTilesLambdaRole', 'Arn'),
                Code: {
                    ImageUri: cf.join([cf.accountId, '.dkr.ecr.', cf.region, '.amazonaws.com/tak-vpc-', cf.ref('Environment'), '-cloudtak-api:pmtiles-', cf.ref('GitSha')])
                },
                VpcConfig: {
                    SecurityGroupIds: [cf.ref('PMTilesLambdaSecurityGroup')],
                    SubnetIds: [
                        cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-subnet-private-a'])),
                        cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-subnet-private-b']))
                    ]
                },
                FileSystemConfigs: [{
                    Arn: cf.join(['arn:', cf.partition, ':elasticfilesystem:', cf.region, ':', cf.accountId, ':access-point/', cf.ref('EFSPoint')]),
                    LocalMountPath: '/mnt/efs'
                }]
            }
        },
        PMTilesLambdaRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
                RoleName: cf.join([cf.stackName, '-pmtiles']),
                AssumeRolePolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Principal: {
                            Service: 'lambda.amazonaws.com'
                        },
                        Action: 'sts:AssumeRole'
                    }]
                },
                Path: '/',
                Policies: [{
                    PolicyName: cf.join([cf.stackName, '-pmtiles']),
                    PolicyDocument: {
                        Statement: [{
                            Effect: 'Allow',
                            Action: [
                                's3:List*',
                                's3:Get*',
                                's3:Head*',
                                's3:Describe*'
                            ],
                            Resource: [
                                cf.join(['arn:', cf.partition, ':s3:::', cf.join('-', [cf.stackName, cf.accountId, cf.region])]),
                                cf.join(['arn:', cf.partition, ':s3:::', cf.join('-', [cf.stackName, cf.accountId, cf.region]), '/*'])
                            ]
                        }]
                    }

                }],
                ManagedPolicyArns: [
                    cf.join(['arn:', cf.partition, ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole']),
                    cf.join(['arn:', cf.partition, ':iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole'])
                ]
            }
        },
        PMTilesApiDomainV2: {
            Type: 'AWS::ApiGatewayV2::DomainName',
            Properties: {
                DomainName: cf.join(['tiles.map.', cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-hosted-zone-name']))]),
                DomainNameConfigurations: [{
                    CertificateArn: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-acm'])),
                    EndpointType: 'REGIONAL'
                }]
            }
        },
        PMTilesApiMapV2: {
            Type: 'AWS::ApiGatewayV2::ApiMapping',
            DependsOn: ['PMTilesApiDomainV2', 'PMTilesAPIStage'],
            Properties: {
                DomainName: cf.ref('PMTilesApiDomainV2'),
                ApiId: cf.ref('PMTilesLambdaAPIV2'),
                Stage: '$default'
            }
        },
        PMTilesLambdaAPIV2: {
            Type: 'AWS::ApiGatewayV2::Api',
            Properties: {
                Name: cf.stackName,
                ProtocolType: 'HTTP',
                DisableExecuteApiEndpoint: true,
                CorsConfiguration: {
                    AllowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token', 'X-Amz-User-Agent'],
                    AllowMethods: ['OPTIONS', 'GET', 'PUT', 'POST', 'DELETE', 'PATCH', 'HEAD'],
                    AllowOrigins: ['*']
                }
            }
        },
        PMTilesLambdaAPIIntegration: {
            Type: 'AWS::ApiGatewayV2::Integration',
            Properties: {
                ApiId: cf.ref('PMTilesLambdaAPIV2'),
                IntegrationType: 'AWS_PROXY',
                IntegrationUri: cf.join(['arn:', cf.partition, ':apigateway:', cf.region, ':lambda:path/2015-03-31/functions/', cf.getAtt('PMTilesLambda', 'Arn'), '/invocations']),
                PayloadFormatVersion: '1.0'
            }
        },
        PMTilesLambdaAPIRoute: {
            Type: 'AWS::ApiGatewayV2::Route',
            Properties: {
                ApiId: cf.ref('PMTilesLambdaAPIV2'),
                RouteKey: 'GET /{proxy+}',
                AuthorizationType: 'NONE',
                Target: cf.join(['integrations/', cf.ref('PMTilesLambdaAPIIntegration')])
            }
        },
        PMTilesAPIStage: {
            Type: 'AWS::ApiGatewayV2::Stage',
            Properties: {
                ApiId: cf.ref('PMTilesLambdaAPIV2'),
                StageName: '$default',
                AutoDeploy: true
            }
        },
        PMTilesLambdaAPIPermission: {
            Type: 'AWS::Lambda::Permission',
            Properties: {
                FunctionName: cf.ref('PMTilesLambda'),
                Action: 'lambda:InvokeFunction',
                Principal: 'apigateway.amazonaws.com',
                SourceArn: cf.join(['arn:', cf.partition, ':execute-api:', cf.region, ':', cf.accountId, ':', cf.ref('PMTilesLambdaAPIV2'), '/*/*/{proxy+}'])
            }
        }
    },
    Outputs: {
        PMTilesAPI: {
            Description: 'PMTiles API',
            Value: cf.join(['https://tiles.map.', cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-hosted-zone-name']))]),
            Export: {
                Name: cf.join([cf.stackName, '-pmtiles-api'])
            }
        },
        PMTilesAPICNAME: {
            Description: 'PMTiles API CNAME target',
            Value: cf.join([cf.getAtt('PMTilesApiDomainV2', 'RegionalDomainName'), '.']),
            Export: {
                Name: cf.join([cf.stackName, '-pmtiles-api-cname-target'])
            }
        }
    }
};
