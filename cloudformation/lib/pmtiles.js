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
                Runtime: 'nodejs20.x',
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
                    Arn: cf.join(['arn:aws:elasticfilesystem:', cf.region, ':', cf.accountId, ':access-point/', cf.ref('EFSPoint')]),
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
                    'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
                    'arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole'
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
                    DNSName: cf.getAtt('PMTilesApiDomain', 'RegionalDomainName'),
                    EvaluateTargetHealth: true,
                    HostedZoneId: cf.getAtt('PMTilesApiDomain', 'RegionalHostedZoneId')
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
                    Arn: cf.join(['arn:aws:elasticfilesystem:', cf.region, ':', cf.accountId, ':access-point/', cf.ref('EFSPoint')]),
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
        PMTilesApiGatewayRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
                AssumeRolePolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Action: 'sts:AssumeRole',
                        Principal: {
                            Service: ['apigateway.amazonaws.com']
                        }
                    }]
                },
                Policies: [{
                    PolicyName: cf.join([cf.stackName, '-pmtiles-api-gateway']),
                    PolicyDocument: {
                        Version: '2012-10-17',
                        Statement: [{
                            Effect: 'Allow',
                            Action: [
                                'lambda:InvokeFunction'
                            ],
                            Resource: [
                                cf.getAtt('PMTilesLambda', 'Arn')
                            ]
                        }]
                    }
                }]
            }
        },
        PMTilesApiDomain: {
            Type: 'AWS::ApiGateway::DomainName',
            Properties: {
                DomainName: cf.join(['tiles.map.', cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-hosted-zone-name']))]),
                RegionalCertificateArn: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-acm'])),
                EndpointConfiguration: {
                    Types: ['REGIONAL']
                }
            }
        },
        PMTilesApiMap: {
            Type: 'AWS::ApiGateway::BasePathMapping',
            Properties: {
                DomainName: cf.ref('PMTilesApiDomain'),
                RestApiId: cf.ref('PMTilesLambdaAPI')
            }
        },
        PMTilesLambdaAPI: {
            Type: 'AWS::ApiGateway::RestApi',
            Properties: {
                Name: cf.stackName,
                DisableExecuteApiEndpoint: true,
                EndpointConfiguration: {
                    Types: ['REGIONAL']
                }
            }
        },
        PMTilesLambdaAPIResource: {
            Type: 'AWS::ApiGateway::Resource',
            Properties: {
                ParentId: cf.getAtt('PMTilesLambdaAPI', 'RootResourceId'),
                PathPart: '{proxy+}',
                RestApiId: cf.ref('PMTilesLambdaAPI')
            }
        },
        PMTilesAPIDeployment: {
            Type: 'AWS::ApiGateway::Deployment',
            DependsOn: ['PMTilesLambdaAPIResourceGET'],
            Properties: {
                Description: cf.stackName,
                RestApiId: cf.ref('PMTilesLambdaAPI')
            }
        },
        PMtilesLambdaAPIStage: {
            Type: 'AWS::ApiGateway::Stage',
            Properties: {
                DeploymentId: cf.ref('PMTilesAPIDeployment'),
                RestApiId: cf.ref('PMTilesLambdaAPI'),
                StageName: 'tiles'
            }
        },
        PMTilesLambdaAPIResourceGET: {
            Type: 'AWS::ApiGateway::Method',
            Properties: {
                AuthorizationType: 'NONE',
                HttpMethod: 'GET',
                Integration: {
                    Credentials:  cf.getAtt('PMTilesApiGatewayRole', 'Arn'),
                    IntegrationHttpMethod: 'POST',
                    Type: 'AWS_PROXY',
                    Uri: cf.join(['arn:', cf.partition, ':apigateway:', cf.region, ':lambda:path/2015-03-31/functions/', cf.getAtt('PMTilesLambda', 'Arn'), '/invocations'])
                },
                ResourceId: cf.ref('PMTilesLambdaAPIResource'),
                RestApiId: cf.ref('PMTilesLambdaAPI')
            }
        },
        PMTilesLambdaAPIResourceOPIONS: {
            Type: 'AWS::ApiGateway::Method',
            Properties: {
                HttpMethod: 'OPTIONS',
                ResourceId: cf.ref('PMTilesLambdaAPIResource'),
                RestApiId: cf.ref('PMTilesLambdaAPI'),
                AuthorizationType: 'NONE',
                Integration: {
                    IntegrationResponses: [{
                        ResponseParameters: {
                            'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
                            'method.response.header.Access-Control-Allow-Origin': "'*'",
                            'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,GET,PUT,POST,DELETE,PATCH,HEAD'"
                        },
                        StatusCode: '204'
                    }],
                    RequestTemplates: {
                        'application/json': '{ statusCode: 200 }'
                    },
                    Type: 'MOCK'
                },
                MethodResponses: [{
                    ResponseParameters: {
                        'method.response.header.Access-Control-Allow-Headers': true,
                        'method.response.header.Access-Control-Allow-Origin': true,
                        'method.response.header.Access-Control-Allow-Methods': true
                    },
                    StatusCode: '204'
                }]
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
            Value: cf.join([cf.getAtt('PMTilesApiDomain', 'RegionalDomainName'), '.']),
            Export: {
                Name: cf.join([cf.stackName, '-pmtiles-api-cname-target'])
            }
        }
    }
};
