import cf from '@mapbox/cloudfriend';

export default {
    Resources: {
        DDBTable: {
            Type: 'AWS::DynamoDB::Table',
            Properties: {
                AttributeDefinitions: [{
                    AttributeName: 'Id',
                    AttributeType: 'S'
                },{
                    AttributeName: 'Callsign',
                    AttributeType: 'S'
                },{
                    AttributeName: 'Geometry',
                    AttributeType: 'M'
                },{
                    AttributeName: 'Properties',
                    AttributeType: 'M'
                }],
                KeySchema: [{
                    AttributeName: 'Id',
                    KeyType: 'HASH'
                }],
                GlobalSecondaryIndexes: [{
                    IndexName: 'Callsign',
                    KeySchema: [{
                        AttributeName: 'Callsign',
                        KeyType: 'HASH'
                    }],
                    Projection: {
                        ProjectionType: 'KEYS_ONLY'
                    },
                    ProvisionedThroughput: {
                        ReadCapacityUnits: 5,
                        WriteCapacityUnits: 5
                    }
                }],
                ProvisionedThroughput: {
                    ReadCapacityUnits: 5,
                    WriteCapacityUnits: 5
                }
            }
        },
        WriteCapacityScalableTarget: {
            Type: 'AWS::ApplicationAutoScaling::ScalableTarget',
            Properties: {
                MaxCapacity: 15,
                MinCapacity: 5,
                ResourceId: cf.join('/', [ 'table', cf.ref('DDBTable') ]),
                RoleARN: cf.getAtt('ScalingRole', 'Arn'),
                ScalableDimension: 'dynamodb:table:WriteCapacityUnits',
                ServiceNamespace: 'dynamodb'
            }
        },
        ScalingRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
                AssumeRolePolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Principal: {
                            Service: [ 'application-autoscaling.amazonaws.com' ]
                        },
                        Action: [ 'sts:AssumeRole' ]
                    }]
                },
                Path: '/',
                Policies: [{
                    PolicyName: 'root',
                    PolicyDocument: {
                        Version: '2012-10-17',
                        Statement: [{
                            Effect: 'Allow',
                            Action: [
                                'dynamodb:DescribeTable',
                                'dynamodb:UpdateTable',
                                'cloudwatch:PutMetricAlarm',
                                'cloudwatch:DescribeAlarms',
                                'cloudwatch:GetMetricStatistics',
                                'cloudwatch:SetAlarmState',
                                'cloudwatch:DeleteAlarms'
                            ],
                            Resource: '*'
                        }]
                    }
                }]
            }
        },
        WriteScalingPolicy: {
            Type: 'AWS::ApplicationAutoScaling::ScalingPolicy',
            Properties: {
                PolicyName: 'WriteAutoScalingPolicy',
                PolicyType: 'TargetTrackingScaling',
                ScalingTargetId: cf.ref('WriteCapacityScalableTarget'),
                TargetTrackingScalingPolicyConfiguration: {
                    TargetValue: 50.0,
                    ScaleInCooldown: 60,
                    ScaleOutCooldown: 60,
                    PredefinedMetricSpecification: {
                        PredefinedMetricType: 'DynamoDBWriteCapacityUtilization'
                    }
                }
            }
        }
    }
}
