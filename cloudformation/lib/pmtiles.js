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
                        CORS: '*'
                    }
                },
                Role: cf.ref('PMTilesLambdaRole'),
                Code: {
                    ImageUri: cf.join([cf.accountId, '.dkr.ecr.', cf.region, `.amazonaws.com/coe-ecr-etl-tasks:pmtiles-`, cf.ref('GitSha')])
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
                                's3:Describe*',
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
        }
    },

        /*
        PMTilesCloudFront: {
            Type: 'AWS::CloudFront::Distribution',
            Properties: {
                DistributionConfig: {
                    CacheBehaviors: [{
                        LambdaFunctionAssociations: [{
                            EventType: "string-value",
                            LambdaFunctionARN: "string-value"
                        }]
                    }],
                    DefaultCacheBehavior: {
                        LambdaFunctionAssociations: [{
                            EventType: "string-value",
                            LambdaFunctionARN: "string-value"
                        }]
                    },
                    IPV6Enabled: true,
                    Origins: [{
                        "CustomOriginConfig": {
                            "OriginKeepaliveTimeout": "integer-value",
                            "OriginReadTimeout": "integer-value"
                        }
                    }]
            }
        }
    }
    */
};
