import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        PublicBucket: {
            Type: 'AWS::S3::Bucket',
            Properties: {
                BucketName: cf.join('-', [cf.stackName, cf.accountId, cf.region, 'public']),
                PublicAccessBlockConfiguration: {
                    RestrictPublicBuckets: false,
                    IgnorePublicAcls: false,
                    BlockPublicPolicy: false,
                    BlockPublicAcls: false
                },
                CorsConfiguration: {
                    CorsRules: [{
                        AllowedHeaders: ['Content-Type', 'Content-Length'],
                        AllowedMethods: ['GET'],
                        AllowedOrigins: [cf.join(['https://', cf.ref('HostedURL')])]
                    }]
                },
                OwnershipControls: {
                    Rules: [{
                        ObjectOwnership: "BucketOwnerEnforced"
                    }]
                }
            }
        },
        PublicBucketPolicy: {
            Type: "AWS::S3::BucketPolicy",
            Properties: {
                Bucket: cf.ref('PublicBucket'),
                PolicyDocument: {
                    Version: "2012-10-17",
                    Statement: [{
                        Sid: 'Statement1',
                        Effect: 'Allow',
                        Principal: '*',
                        Action: 's3:GetObject',
                        Resource: [
                            cf.join(['arn:', cf.partition, ':s3:::', cf.ref('PublicBucket'), '/*']),
                            cf.join(['arn:', cf.partition, ':s3:::', cf.ref('PublicBucket')])
                        ]
                    }]
                }
            }
        },
        AssetBucketLambdaPermission: {
            Type: 'AWS::Lambda::Permission',
            Properties: {
                Action: 'lambda:InvokeFunction',
                FunctionName: cf.getAtt('EventLambda', 'Arn'),
                Principal: 's3.amazonaws.com',
                SourceArn: cf.join(['arn:', cf.partition, ':s3:::', cf.stackName, '-', cf.accountId, '-', cf.region]),
                SourceAccount: cf.accountId
            }
        },
        AssetBucket: {
            Type: 'AWS::S3::Bucket',
            DependsOn: ['AssetBucketLambdaPermission'],
            Properties: {
                BucketName: cf.join('-', [cf.stackName, cf.accountId, cf.region]),
                NotificationConfiguration: {
                    LambdaConfigurations: [{
                        Event: 's3:ObjectCreated:*',
                        Function: cf.getAtt('EventLambda', 'Arn')
                    }]
                }
            }
        }
    }
};
