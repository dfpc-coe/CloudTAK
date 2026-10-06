import cf from '@openaddresses/cloudfriend';

const HIGH = [cf.join(['arn:', cf.partition, ':sns:', cf.region, ':', cf.accountId, ':tak-cloudtak-', cf.ref('Environment'), '-high-urgency'])];

/**
 * Destination countries that a US origination number may message.
 * Every other country AWS End User Messaging supports is BLOCKed by the
 * protect configuration to prevent international toll fraud.
 */
const ALLOWED_COUNTRIES = ['US', 'PR', 'VI', 'GU', 'AS', 'MP'];

/**
 * Country codes accepted by the protect configuration API, taken from
 * GetProtectConfigurationCountryRuleSet in us-gov-east-1 on 2026-10-06.
 * Codes outside this list are rejected with INVALID_PARAMETER.
 */
const SUPPORTED_COUNTRIES = `
    AC AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO
    BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CO CR CV CW CX CY CZ DE DJ DK DM DO
    DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT
    GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IS IT JE JM JO JP KE KG KH KI KM KN KR KW
    KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT
    MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS
    PT PW PY QA RE RO RS RU RW SA SB SC SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SZ TC TD
    TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK
    YE YT ZA ZM ZW
`.trim().split(/\s+/);

const FAILURE_EVENTS = [
    'TEXT_INVALID',
    'TEXT_INVALID_MESSAGE',
    'TEXT_UNREACHABLE',
    'TEXT_CARRIER_UNREACHABLE',
    'TEXT_BLOCKED',
    'TEXT_CARRIER_BLOCKED',
    'TEXT_SPAM',
    'TEXT_UNKNOWN',
    'TEXT_TTL_EXPIRED',
    'TEXT_PROTECT_BLOCKED'
];

const MandatoryKeywords = {
    HELP: { Message: cf.ref('HelpMessage') },
    STOP: { Message: cf.ref('StopMessage') }
};

export default cf.merge({
    Description: 'Outbound SMS for CloudTAK via AWS End User Messaging SMS',
    Parameters: {
        Environment: {
            Description: 'VPC/ECS Stack to deploy into',
            Type: 'String',
            Default: 'prod'
        },
        NumberType: {
            Description: 'Type of US origination number to request. TOLL_FREE must be registered in the console before it can send to unverified numbers; SIMULATOR is for testing only. TEN_DLC and LONG_CODE require registrations CloudFormation cannot create - request them manually and use ExistingOriginationIdentityArn instead',
            Type: 'String',
            Default: 'TOLL_FREE',
            AllowedValues: ['TOLL_FREE', 'SIMULATOR']
        },
        ExistingOriginationIdentityArn: {
            Description: 'Optional ARN of an existing, registered phone number or sender ID to send from. When set, no new phone number is requested',
            Type: 'String',
            Default: '',
            AllowedPattern: '^(arn:\\S+)?$'
        },
        HelpMessage: {
            Description: 'Automatic reply when a recipient texts HELP',
            Type: 'String',
            Default: 'CloudTAK alerts. Reply STOP to unsubscribe. Contact your CloudTAK administrator for support.',
            MaxLength: 1600
        },
        StopMessage: {
            Description: 'Automatic reply when a recipient texts STOP',
            Type: 'String',
            Default: 'You have been unsubscribed from CloudTAK alerts and will receive no further messages.',
            MaxLength: 1600
        },
        TwoWayEnabled: {
            Description: 'Deliver inbound replies to an SNS topic',
            Type: 'String',
            Default: 'false',
            AllowedValues: ['true', 'false']
        },
        EventLogRetentionDays: {
            Description: 'Days that message delivery events are retained in CloudWatch Logs',
            Type: 'Number',
            Default: 30,
            AllowedValues: [1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1096, 1827, 2192, 2557, 2922, 3288, 3653]
        }
    },
    Conditions: {
        RequestPhoneNumber: cf.equals(cf.ref('ExistingOriginationIdentityArn'), ''),
        TwoWay: cf.equals(cf.ref('TwoWayEnabled'), 'true')
    },
    Resources: {
        /**
         * Opt-out list — recipients who reply STOP are added automatically
         * and all further sends to them are suppressed.
         */
        SMSOptOutList: {
            Type: 'AWS::SMSVOICE::OptOutList',
            Properties: {
                OptOutListName: cf.stackName
            }
        },

        /**
         * Protect configuration — only ALLOWED_COUNTRIES may be messaged.
         */
        SMSProtectConfiguration: {
            Type: 'AWS::SMSVOICE::ProtectConfiguration',
            Properties: {
                DeletionProtectionEnabled: false,
                CountryRuleSet: {
                    SMS: SUPPORTED_COUNTRIES.map((CountryCode) => {
                        return {
                            CountryCode,
                            ProtectStatus: ALLOWED_COUNTRIES.includes(CountryCode) ? 'ALLOW' : 'BLOCK'
                        };
                    })
                },
                Tags: [{
                    Key: 'Name',
                    Value: cf.stackName
                }]
            }
        },

        /**
         * Event logging — every text message event is written to CloudWatch
         * Logs and failures raise the CloudTAK high urgency alarm.
         */
        SMSEventLogs: {
            Type: 'AWS::Logs::LogGroup',
            Properties: {
                LogGroupName: cf.join(['/aws/sms-voice/', cf.stackName]),
                RetentionInDays: cf.ref('EventLogRetentionDays')
            }
        },
        SMSEventRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
                AssumeRolePolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Principal: {
                            Service: 'sms-voice.amazonaws.com'
                        },
                        Action: 'sts:AssumeRole',
                        Condition: {
                            StringEquals: {
                                'aws:SourceAccount': cf.accountId
                            },
                            ArnLike: {
                                'aws:SourceArn': cf.join(['arn:', cf.partition, ':sms-voice:', cf.region, ':', cf.accountId, ':configuration-set/', cf.stackName])
                            }
                        }
                    }]
                },
                Policies: [{
                    PolicyName: cf.join([cf.stackName, '-events']),
                    PolicyDocument: {
                        Version: '2012-10-17',
                        Statement: [{
                            Effect: 'Allow',
                            Action: [
                                'logs:CreateLogStream',
                                'logs:DescribeLogStreams',
                                'logs:PutLogEvents'
                            ],
                            Resource: [cf.getAtt('SMSEventLogs', 'Arn')]
                        }]
                    }
                }]
            }
        },
        SMSFailureMetric: {
            Type: 'AWS::Logs::MetricFilter',
            Properties: {
                LogGroupName: cf.ref('SMSEventLogs'),
                FilterPattern: '{ ' + FAILURE_EVENTS.map((e) => `($.eventType = "${e}")`).join(' || ') + ' }',
                MetricTransformations: [{
                    MetricNamespace: cf.stackName,
                    MetricName: 'TextMessageFailures',
                    MetricValue: '1',
                    DefaultValue: 0
                }]
            }
        },
        SMSFailureAlarm: {
            Type: 'AWS::CloudWatch::Alarm',
            Properties: {
                AlarmName: cf.join('-', [cf.stackName, 'TextMessageFailures', cf.region]),
                Namespace: cf.stackName,
                MetricName: 'TextMessageFailures',
                ComparisonOperator: 'GreaterThanThreshold',
                Threshold: 0,
                EvaluationPeriods: 1,
                Statistic: 'Sum',
                Period: 300,
                AlarmActions: HIGH,
                TreatMissingData: 'notBreaching'
            }
        },

        /**
         * Configuration set — passed on every SendTextMessage call to apply
         * the protect configuration and event logging.
         */
        SMSConfigurationSet: {
            Type: 'AWS::SMSVOICE::ConfigurationSet',
            Properties: {
                ConfigurationSetName: cf.stackName,
                ProtectConfigurationId: cf.ref('SMSProtectConfiguration'),
                EventDestinations: [{
                    EventDestinationName: 'CloudWatchLogs',
                    Enabled: true,
                    MatchingEventTypes: ['TEXT_ALL'],
                    CloudWatchLogsDestination: {
                        IamRoleArn: cf.getAtt('SMSEventRole', 'Arn'),
                        LogGroupArn: cf.getAtt('SMSEventLogs', 'Arn')
                    }
                }]
            }
        },

        /**
         * Phone number — requested unless an existing origination identity
         * is supplied.  Retained on stack deletion as registered numbers
         * take weeks to replace and continue to bill until released.
         */
        SMSPhoneNumber: {
            Type: 'AWS::SMSVOICE::PhoneNumber',
            Condition: 'RequestPhoneNumber',
            DeletionPolicy: 'Retain',
            UpdateReplacePolicy: 'Retain',
            Properties: {
                IsoCountryCode: 'US',
                NumberType: cf.ref('NumberType'),
                NumberCapabilities: ['SMS'],
                MandatoryKeywords,
                OptOutListName: cf.ref('SMSOptOutList'),
                SelfManagedOptOutsEnabled: false,
                DeletionProtectionEnabled: false,
                Tags: [{
                    Key: 'Name',
                    Value: cf.stackName
                }]
            }
        },

        /**
         * Two-way — inbound replies are published to an SNS topic.
         */
        SMSInboundTopic: {
            Type: 'AWS::SNS::Topic',
            Condition: 'TwoWay',
            Properties: {
                TopicName: cf.join([cf.stackName, '-inbound'])
            }
        },
        SMSInboundTopicPolicy: {
            Type: 'AWS::SNS::TopicPolicy',
            Condition: 'TwoWay',
            Properties: {
                Topics: [cf.ref('SMSInboundTopic')],
                PolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Principal: {
                            Service: 'sms-voice.amazonaws.com'
                        },
                        Action: 'sns:Publish',
                        Resource: cf.ref('SMSInboundTopic'),
                        Condition: {
                            StringEquals: {
                                'aws:SourceAccount': cf.accountId
                            },
                            ArnLike: {
                                'aws:SourceArn': cf.join(['arn:', cf.partition, ':sms-voice:', cf.region, ':', cf.accountId, ':*'])
                            }
                        }
                    }]
                }
            }
        },
        SMSTwoWayRole: {
            Type: 'AWS::IAM::Role',
            Condition: 'TwoWay',
            Properties: {
                AssumeRolePolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Principal: {
                            Service: 'sms-voice.amazonaws.com'
                        },
                        Action: 'sts:AssumeRole',
                        Condition: {
                            StringEquals: {
                                'aws:SourceAccount': cf.accountId
                            },
                            ArnLike: {
                                'aws:SourceArn': cf.join(['arn:', cf.partition, ':sms-voice:', cf.region, ':', cf.accountId, ':*'])
                            }
                        }
                    }]
                },
                Policies: [{
                    PolicyName: cf.join([cf.stackName, '-inbound']),
                    PolicyDocument: {
                        Version: '2012-10-17',
                        Statement: [{
                            Effect: 'Allow',
                            Action: ['sns:Publish'],
                            Resource: [cf.ref('SMSInboundTopic')]
                        }]
                    }
                }]
            }
        },

        /**
         * Pool — the origination identity CloudTAK sends from.  Pooling
         * allows additional numbers to be added later without changing
         * the identity used by the API.
         */
        SMSPool: {
            Type: 'AWS::SMSVOICE::Pool',
            Properties: {
                OriginationIdentities: [
                    cf.if('RequestPhoneNumber', cf.getAtt('SMSPhoneNumber', 'Arn'), cf.ref('ExistingOriginationIdentityArn'))
                ],
                MandatoryKeywords,
                OptOutListName: cf.ref('SMSOptOutList'),
                SelfManagedOptOutsEnabled: false,
                SharedRoutesEnabled: false,
                DeletionProtectionEnabled: false,
                TwoWay: cf.if('TwoWay', {
                    Enabled: true,
                    ChannelArn: cf.ref('SMSInboundTopic'),
                    ChannelRole: cf.getAtt('SMSTwoWayRole', 'Arn')
                }, {
                    Enabled: false
                }),
                Tags: [{
                    Key: 'Name',
                    Value: cf.stackName
                }]
            }
        },

        /**
         * Send policy — grants CloudTAK the ability to send from the pool
         * and manage opt-outs.  Attached to the ETL role; attach the
         * exported ARN to any other role that needs to send.
         */
        SMSSendPolicy: {
            Type: 'AWS::IAM::ManagedPolicy',
            Properties: {
                ManagedPolicyName: cf.join([cf.stackName, '-send']),
                Roles: [cf.join(['tak-cloudtak-', cf.ref('Environment')])],
                PolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Action: ['sms-voice:SendTextMessage'],
                        Resource: [
                            cf.getAtt('SMSPool', 'Arn'),
                            cf.getAtt('SMSConfigurationSet', 'Arn')
                        ]
                    },{
                        Effect: 'Allow',
                        Action: ['sms-voice:DescribePools'],
                        Resource: [cf.getAtt('SMSPool', 'Arn')]
                    },{
                        Effect: 'Allow',
                        Action: ['sms-voice:DescribePhoneNumbers'],
                        Resource: [cf.join(['arn:', cf.partition, ':sms-voice:', cf.region, ':', cf.accountId, ':phone-number/*'])]
                    },{
                        Effect: 'Allow',
                        Action: ['sms-voice:DescribeConfigurationSets'],
                        Resource: [cf.getAtt('SMSConfigurationSet', 'Arn')]
                    },{
                        Effect: 'Allow',
                        Action: [
                            'sms-voice:DescribeOptedOutNumbers',
                            'sms-voice:PutOptedOutNumber',
                            'sms-voice:DeleteOptedOutNumber'
                        ],
                        Resource: [cf.getAtt('SMSOptOutList', 'Arn')]
                    },{
                        Effect: 'Allow',
                        Action: [
                            'sms-voice:DescribeAccountAttributes',
                            'sms-voice:DescribeSpendLimits'
                        ],
                        Resource: '*'
                    }, cf.if('TwoWay', {
                        Effect: 'Allow',
                        Action: ['sns:Subscribe', 'sns:GetTopicAttributes'],
                        Resource: [cf.ref('SMSInboundTopic')]
                    }, cf.noValue)]
                }
            }
        }
    },
    Outputs: {
        PoolId: {
            Description: 'Pool ID to pass as OriginationIdentity to SendTextMessage',
            Value: cf.ref('SMSPool'),
            Export: {
                Name: cf.join([cf.stackName, '-pool-id'])
            }
        },
        PoolArn: {
            Description: 'Pool ARN',
            Value: cf.getAtt('SMSPool', 'Arn'),
            Export: {
                Name: cf.join([cf.stackName, '-pool-arn'])
            }
        },
        ConfigurationSet: {
            Description: 'Configuration set name to pass as ConfigurationSetName to SendTextMessage',
            Value: cf.ref('SMSConfigurationSet'),
            Export: {
                Name: cf.join([cf.stackName, '-configuration-set'])
            }
        },
        OptOutList: {
            Description: 'Opt-out list name',
            Value: cf.ref('SMSOptOutList'),
            Export: {
                Name: cf.join([cf.stackName, '-opt-out-list'])
            }
        },
        ProtectConfigurationId: {
            Description: 'Protect configuration ID',
            Value: cf.ref('SMSProtectConfiguration'),
            Export: {
                Name: cf.join([cf.stackName, '-protect-configuration-id'])
            }
        },
        PhoneNumber: {
            Condition: 'RequestPhoneNumber',
            Description: 'Requested origination phone number in E.164 format',
            Value: cf.getAtt('SMSPhoneNumber', 'PhoneNumber'),
            Export: {
                Name: cf.join([cf.stackName, '-phone-number'])
            }
        },
        SendPolicyArn: {
            Description: 'Managed policy ARN granting send access to the pool',
            Value: cf.ref('SMSSendPolicy'),
            Export: {
                Name: cf.join([cf.stackName, '-send-policy'])
            }
        },
        InboundTopicArn: {
            Condition: 'TwoWay',
            Description: 'SNS topic that inbound replies are published to',
            Value: cf.ref('SMSInboundTopic'),
            Export: {
                Name: cf.join([cf.stackName, '-inbound-topic'])
            }
        },
        EventLogGroup: {
            Description: 'CloudWatch Logs group that receives message delivery events',
            Value: cf.ref('SMSEventLogs'),
            Export: {
                Name: cf.join([cf.stackName, '-event-logs'])
            }
        }
    }
});
