import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        AssetBucket: {
            Type: 'AWS::S3::Bucket',
            Properties: {
                BucketName: cf.join('-', [cf.stackName, cf.accountId, cf.region])
            }
        }
    }
};
