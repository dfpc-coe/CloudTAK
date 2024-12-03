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
                    DomainName: cf.join(['tiles.', cf.ref('HostedURL')]),
                    RegionalCertificateArn: cf.join(['arn:', cf.partition, ':acm:', cf.region, ':', cf.accountId, ':certificate/', cf.ref('SSLCertificateIdentifier')]),
                    EndpointConfiguration: {
                        Types: ['REGIONAL']
                    }
                }
            },
            CloudTAKWebhooksApiMap: {
                Type: 'AWS::ApiGateway::BasePathMapping',
                Properties: {
                    DomainName: cf.ref('CloudTAKWebhooksApiDomain'),
                    RestApiId: cf.ref('CloudTAKWebhooksLambdaAPI')
                }
            },
            CloudTAKWebhooksLambdaAPI: {
                Type: 'AWS::ApiGateway::RestApi',
                Properties: {
                    Name: 'CloudTAK Webhooks Rest API',
                    DisableExecuteApiEndpoint: true,
                    EndpointConfiguration: {
                        Types: ['REGIONAL']
                    }
                }
            },
            CloudTAKWebhooksLambdaAPIResource: {
                Type: 'AWS::ApiGateway::Resource',
                Properties: {
                    ParentId: cf.getAtt('CloudTAKWebhooksLambdaAPI', 'RootResourceId'),
                    PathPart: '{proxy+}',
                    RestApiId: cf.ref('CloudTAKWebhooksLambdaAPI')
                }
            },
            CloudTAKWebhooksAPIDeployment: {
                Type: 'AWS::ApiGateway::Deployment',
                DependsOn: ['CloudTAKWebhooksLambdaAPIResourceGET'],
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
                    StageName: 'tiles'
                }
            },
        }
    },
);
