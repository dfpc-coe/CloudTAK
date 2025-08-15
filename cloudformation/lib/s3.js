import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
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
                BucketName: cf.join('-', [cf.stackName, cf.accountId, cf.region])
            }
        }
    }
};
