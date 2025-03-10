import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        PMTilesLambda: {
            Type: 'AWS::Lambda::Function',
            DependsOn: ['SigningSecret'],
            Properties: {
                FunctionName: cf.join([cf.stackName, '-pmtiles']),
                MemorySize: 256,
                Timeout: 15,
                Description: 'Return Mapbox Vector Tiles from a PMTiles Store',
                PackageType: 'Image',
                Environment: {
                    Variables: {
                        StackName: cf.stackName,
                        ASSET_BUCKET: cf.ref('AssetBucket'),
                        APIROOT: cf.join(['https://tiles.', cf.ref('HostedURL')]),
                        SigningSecret: cf.sub('{{resolve:secretsmanager:${AWS::StackName}/api/secret:SecretString::AWSCURRENT}}')
                    }
                },
                Role: cf.getAtt('PMTilesLambdaRole', 'Arn'),
                Code: {
                    ImageUri: cf.join([cf.accountId, '.dkr.ecr.', cf.region, '.amazonaws.com/coe-ecr-etl:pmtiles-', cf.ref('GitSha')])
                }
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
                    cf.join(['arn:', cf.partition, ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'])
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
                DomainName: cf.join(['tiles.', cf.ref('HostedURL')]),
                RegionalCertificateArn: cf.join(['arn:', cf.partition, ':acm:', cf.region, ':', cf.accountId, ':certificate/', cf.ref('SSLCertificateIdentifier')]),
                EndpointConfiguration: {
                    Types: ['REGIONAL']
                }
            }
        },
        PMTilesApiMap: {
           Type: 'AWS::ApiGatewayV2::ApiMapping',
           Properties: {
               DomainName: cf.ref('PMTilesApiDomain'),
               ApiId: cf.ref('PMTilesLambdaAPI'),
               Stage: cf.ref('PMtilesLambdaAPIStage')
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
            Value: cf.join(['https://tiles.', cf.ref('HostedURL')]),
            Export: {
                Name: cf.join([cf.stackName, '-pmtiles-api'])
            }
        },
        PMTilesAPICNAME: {
            Description: 'PMTiles API CNAME target',
            Value: cf.join([ cf.getAtt('PMTilesApiDomain', 'RegionalDomainName'), '.']),
            Export: {
                Name: cf.join([cf.stackName, '-pmtiles-api-cname-target'])
            }
        }
    }
};
