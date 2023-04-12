import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        PMTilesLambda: {
            Type: 'AWS::Lambda::Function',
            Properties: {
                FunctionName: cf.join([cf.stackName, '-pmtiles']),
                MemorySize: 512,
                Timeout: 15,
                Description: 'Return Mapbox Vector Tiles from a PMTiles Store',
                PackageType: 'Image',
                Environment: {
                    Variables: {
                        BUCKET: cf.ref('AssetBucket'),
                        APIROOT: cf.join(['https://', cf.ref('PMTilesLambdaAPI'), '.execute-api.', cf.region, '.amazonaws.com'])
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
                                cf.join(['arn:', cf.partition, ':s3:::', cf.ref('AssetBucket')]),
                                cf.join(['arn:', cf.partition, ':s3:::', cf.ref('AssetBucket'), '/*'])
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
        PMTilesLambdaAPI: {
            Type: 'AWS::ApiGateway::RestApi',
            Properties: {
                Name: 'PMtiles Rest API',
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
                    ConnectionType: 'INTERNET',
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
            Value: cf.join(['https://', cf.ref('PMTilesLambdaAPI'), '.execute-api.', cf.region, '.amazonaws.com']),
            Export: {
                Name: cf.join([cf.stackName, '-pmtiles-api'])
            }
        }
    }
};
