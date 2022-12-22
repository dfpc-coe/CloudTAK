import cf from '@mapbox/cloudfriend';

export default {
    Resources: {
        DataBucketProduction: {
            Type: 'AWS::S3::Bucket',
            Properties: {
                BucketName: cf.join('-', [cf.stackName, cf.accountId, cf.region]),
                AccessControl: 'PublicRead',
                PublicAccessBlockConfiguration: {
                    BlockPublicAcls: false,
                    BlockPublicPolicy: false,
                    IgnorePublicAcls: false,
                    RestrictPublicBuckets: false
                }
            }
        },
        DataBucketProductionPolicy: {
            Type: 'AWS::S3::BucketPolicy',
            Properties: {
                Bucket: cf.ref('DataBucketProduction'),
                PolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [{
                        Sid: 'PublicReadGetObject',
                        Effect: 'Allow',
                        Principal: '*',
                        Action: 's3:GetObject',
                        Resource: cf.join(['arn:aws:s3:::', cf.ref('DataBucketProduction'), '/*'])
                    }]
                }
            }
        }
    }
};
