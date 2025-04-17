import cf from '@openaddresses/cloudfriend';

export default cf.merge(
    {
        Description: 'Incoming Webhook support for CloudTAK',
        Parameters: {
            GitSha: {
                Description: 'GitSha that is currently being deployed',
                Type: 'String'
            },
            Environment: {
                Description: 'VPC/ECS Stack to deploy into',
                Type: 'String',
                Default: 'prod'
            },
            HostedURL: {
                Description: 'URL of domain/subdomain at which the API is hosted ie: "webhooks.example.com"',
                Type: 'String'
            },
            SSLCertificateIdentifier: {
                Description: 'ACM SSL Certificate for top level wildcard: *.example.com and second level *.map.example.com',
                Type: 'String'
            }
        },
        Resources: {
            CloudTAKWebhooksApiDomain: {
                Type: 'AWS::ApiGateway::DomainName',
                Properties: {
                    DomainName: cf.ref('HostedURL'),
                    RegionalCertificateArn: cf.join(['arn:', cf.partition, ':acm:', cf.region, ':', cf.accountId, ':certificate/', cf.ref('SSLCertificateIdentifier')]),
                    EndpointConfiguration: {
                        Types: ['REGIONAL']
                    }
                }
            },
            CloudTAKWebhooksApiGatewayRole: {
                Type: 'AWS::IAM::Role',
                Properties: {
                    RoleName: cf.stackName,
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
                                    cf.join(['arn:', cf.partition, ':lambda:', cf.region, ':', cf.accountId, ':function:coe-etl-', cf.ref('Environment'), '-layer-*']),
                                    cf.getAtt('CloudTAKWebhooksHealthCheckFunction', 'Arn')
                                ]
                            }]
                        }
                    }]
                }
            },
            CloudTAKWebhooksLambdaAPI: {
                Type: 'AWS::ApiGatewayV2::Api',
                Properties: {
                    Name: cf.stackName,
                    DisableExecuteApiEndpoint: true,
                    ProtocolType: 'HTTP'
                }
            },
            CloudTAKWebhooksAPIDeployment: {
                Type: 'AWS::ApiGatewayV2::Deployment',
                DependsOn: ['CloudTAKWebhooksApiGatewayResource'],
                Properties: {
                    Description: cf.stackName,
                    ApiId: cf.ref('CloudTAKWebhooksLambdaAPI')
                }
            },
            CloudTAKWebhooksLambdaAPIStage: {
                Type: 'AWS::ApiGatewayV2::Stage',
                Properties: {
                    DeploymentId: cf.ref('CloudTAKWebhooksAPIDeployment'),
                    ApiId: cf.ref('CloudTAKWebhooksLambdaAPI'),
                    AutoDeploy: true,
                    StageName: '$default'
                }
            },
            CloudTAKWebhooksApiMap: {
                Type: 'AWS::ApiGatewayV2::ApiMapping',
                Properties: {
                    Stage: cf.ref('CloudTAKWebhooksLambdaAPIStage'),
                    DomainName: cf.ref('CloudTAKWebhooksApiDomain'),
                    ApiId: cf.ref('CloudTAKWebhooksLambdaAPI')
                }
            },
            CloudTAKWebhooksApiGatewayResource: {
                Type: 'AWS::ApiGatewayV2::Route',
                Properties: {
                    ApiId: cf.ref('CloudTAKWebhooksLambdaAPI'),
                    RouteKey: 'GET /health',
                    Target: cf.join(['integrations/', cf.ref('CloudTAKWebhooksApiGatewayResourceMethod')])
                }
            },
            CloudTAKWebhooksHealthCheckFunction: {
                Type: 'AWS::Lambda::Function',
                Properties: {
                    FunctionName: cf.join([cf.stackName, '-health']),
                    Handler: 'index.handler',
                    Role: cf.getAtt('CloudTAKWebhooksHealthCheckFunctionRole', 'Arn'),
                    Code: {
                        ZipFile: "def handler(event, context):\n    return {\n        'statusCode': 200,\n        'body': 'Hello from Lambda!'\n    }"
                    },
                    Runtime: 'python3.13'
                }
            },
            CloudTAKWebhooksHealthCheckFunctionRole: {
                Type: 'AWS::IAM::Role',
                Properties: {
                    AssumeRolePolicyDocument: {
                        Version: '2012-10-17',
                        Statement: [{
                            Effect: 'Allow',
                            Principal: {
                                Service: ['lambda.amazonaws.com']
                            },
                            Action: ['sts:AssumeRole']
                        }]
                    },
                    ManagedPolicyArns: [cf.join(['arn:', cf.partition, ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'])]
                }
            },
            CloudTAKWebhooksApiGatewayResourceMethod: {
                Type: 'AWS::ApiGatewayV2::Integration',
                Properties: {
                    ApiId: cf.ref('CloudTAKWebhooksLambdaAPI'),
                    IntegrationType: 'AWS_PROXY',
                    IntegrationUri: cf.getAtt('CloudTAKWebhooksHealthCheckFunction', 'Arn'),
                    CredentialsArn: cf.getAtt('CloudTAKWebhooksApiGatewayRole', 'Arn'),
                    PayloadFormatVersion: '2.0'
                }
            }
        },
        Outputs: {
            HostedURL: {
                Description: 'Hosted API Base',
                Export: {
                    Name: cf.stackName
                },
                Value: cf.join(['https://', cf.ref('HostedURL')])
            },
            RoleArn: {
                Description: 'Invocation Role ARN',
                Export: {
                    Name: cf.join([cf.stackName, '-role'])
                },
                Value: cf.getAtt('CloudTAKWebhooksApiGatewayRole', 'Arn')
            },
            ApiId: {
                Description: 'Base ID of API Gateway',
                Export: {
                    Name: cf.join([cf.stackName, '-api'])
                },
                Value: cf.ref('CloudTAKWebhooksLambdaAPI')
            }
        }
    }
);
