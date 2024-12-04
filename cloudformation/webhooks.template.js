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
                Description: 'URL of domain/subdomain at which the API is hosted ie: "map.example.com"',
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
            CloudTAKWebhooksApiMap: {
                Type: 'AWS::ApiGateway::BasePathMapping',
                Properties: {
                    Stage: cf.ref('CloudTAKWebhooksLambdaAPIStage'),
                    DomainName: cf.ref('CloudTAKWebhooksApiDomain'),
                    RestApiId: cf.ref('CloudTAKWebhooksLambdaAPI')
                }
            },
            CloudTAKWebhooksLambdaAPIResourceGET: {
                Type: 'AWS::ApiGateway::Method',
                Properties: {
                    AuthorizationType: 'NONE',
                    HttpMethod: 'GET',
                    Integration: {
                        IntegrationResponses: [{
                            StatusCode: 200
                        }],
                        RequestTemplates: {
                            'application/json': '{ statusCode: 200 }'
                        },
                        Type: 'MOCK'
                    },
                    MethodResponses: [{
                        StatusCode: 200
                    }],
                    ResourceId: cf.ref('CloudTAKWebhooksLambdaAPIResource'),
                    RestApiId: cf.ref('CloudTAKWebhooksLambdaAPI')
                }
            },
            CloudTAKWebhooksLambdaAPI: {
                Type: 'AWS::ApiGateway::RestApi',
                Properties: {
                    Name: cf.stackName,
                    DisableExecuteApiEndpoint: true,
                    EndpointConfiguration: {
                        Types: ['REGIONAL']
                    }
                }
            },
            CloudTAKWebhooksLambdaAPIResource: {
                Type: 'AWS::ApiGateway::Resource',
                Properties: {
                    PathPart: 'health',
                    ParentId: cf.getAtt('CloudTAKWebhooksLambdaAPI', 'RootResourceId'),
                    RestApiId: cf.ref('CloudTAKWebhooksLambdaAPI')
                }
            },
            CloudTAKWebhooksAPIDeployment: {
                Type: 'AWS::ApiGateway::Deployment',
                DependsOn: 'CloudTAKWebhooksLambdaAPIResourceGET',
                Properties: {
                    Description: cf.stackName,
                    RestApiId: cf.ref('CloudTAKWebhooksLambdaAPI')
                }
            },
            CloudTAKWebhooksLambdaAPIStage: {
                Type: 'AWS::ApiGateway::Stage',
                Properties: {
                    DeploymentId: cf.ref('CloudTAKWebhooksAPIDeployment'),
                    RestApiId: cf.ref('CloudTAKWebhooksLambdaAPI'),
                    StageName: 'webhooks'
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
            ParentId: {
                Description: 'Base ID of API Gateway',
                Export: {
                    Name: cf.join([cf.stackName, '-rest-base'])
                },
                Value: cf.getAtt('CloudTAKWebhooksLambdaAPI', 'RootResourceId'),
            },
            RestApiId: {
                Description: 'Base ID of API Gateway',
                Export: {
                    Name: cf.join([cf.stackName, '-rest'])
                },
                Value: cf.ref('CloudTAKWebhooksLambdaAPI')
            }
        }
    }
);
