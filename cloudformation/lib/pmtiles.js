import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        PMTilesLambda: {

        },
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
};
