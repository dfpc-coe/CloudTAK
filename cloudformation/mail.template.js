import cf from '@openaddresses/cloudfriend';

export default cf.merge({
    Description: 'Inbound email paging via AWS SES Mail Manager for CloudTAK',
    Parameters: {
        Environment: {
            Description: 'VPC/ECS Stack to deploy into',
            Type: 'String',
            Default: 'prod'
        },
        SubdomainPrefix: {
            Type: 'String',
            Description: 'Subdomain prefix for the mail ingress point, e.g. "mail.map" yields mail.map.<domain>',
            Default: 'mail.map'
        },
        MaxMessageSizeBytes: {
            Type: 'Number',
            Description: 'Maximum allowed inbound message size in bytes',
            Default: 10485760
        },
        RetentionPeriod: {
            Type: 'String',
            Description: 'Retention period for archived email (SES Mail Manager enum)',
            Default: 'SIX_MONTHS',
            AllowedValues: [
                'THREE_MONTHS',
                'SIX_MONTHS',
                'NINE_MONTHS',
                'ONE_YEAR',
                'EIGHTEEN_MONTHS',
                'TWO_YEARS',
                'THIRTY_MONTHS',
                'THREE_YEARS',
                'FOUR_YEARS',
                'FIVE_YEARS',
                'SIX_YEARS',
                'SEVEN_YEARS',
                'EIGHT_YEARS',
                'NINE_YEARS',
                'TEN_YEARS',
                'PERMANENT'
            ]
        }
    },
    Resources: {
        /**
         * Traffic policy — allow all inbound mail up to MaxMessageSizeBytes.
         */
        PagingTrafficPolicy: {
            Type: 'AWS::SES::MailManagerTrafficPolicy',
            Properties: {
                TrafficPolicyName: cf.stackName,
                DefaultAction: 'ALLOW',
                MaxMessageSizeBytes: cf.ref('MaxMessageSizeBytes'),
                PolicyStatements: []
            }
        },

        /**
         * Archive — long-term storage of every received message.
         */
        PagingArchive: {
            Type: 'AWS::SES::MailManagerArchive',
            DeletionPolicy: 'Retain',
            Properties: {
                ArchiveName: cf.stackName,
                Retention: {
                    RetentionPeriod: cf.ref('RetentionPeriod')
                }
            }
        },

        /**
         * Rule set — single catch-all rule that archives every message.
         */
        PagingRuleSet: {
            Type: 'AWS::SES::MailManagerRuleSet',
            Properties: {
                RuleSetName: cf.stackName,
                Rules: [{
                    Name: 'ArchiveAll',
                    Conditions: [],
                    Actions: [{
                        Archive: {
                            TargetArchive: cf.getAtt('PagingArchive', 'ArchiveId')
                        }
                    }]
                }]
            }
        },

        /**
         * Ingress point — OPEN SMTP endpoint.  Its ARecord attribute is
         * the hostname that the MX record must point to.
         */
        PagingIngressPoint: {
            Type: 'AWS::SES::MailManagerIngressPoint',
            Properties: {
                IngressPointName: cf.stackName,
                Type: 'OPEN',
                TlsPolicy: 'OPTIONAL',
                RuleSetId: cf.getAtt('PagingRuleSet', 'RuleSetId'),
                TrafficPolicyId: cf.getAtt('PagingTrafficPolicy', 'TrafficPolicyId')
            }
        },

        /**
         * MX record — directs inbound SMTP for mail.map.<domain> to the
         * Mail Manager ingress endpoint.
         */
        PagingMXRecord: {
            Type: 'AWS::Route53::RecordSet',
            Properties: {
                HostedZoneId: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-hosted-zone-id'])),
                Name: cf.join([
                    cf.ref('SubdomainPrefix'),
                    '.',
                    cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-hosted-zone-name']))
                ]),
                Type: 'MX',
                TTL: '300',
                ResourceRecords: [
                    cf.join(['10 ', cf.getAtt('PagingIngressPoint', 'ARecord')])
                ],
                Comment: cf.join(' ', [cf.stackName, 'Mail Manager MX Record'])
            }
        },

        /**
         * DMARC TXT record — minimal policy to prevent spoofing of the
         * inbound mail subdomain.  Reports are sent to the same address.
         */
        PagingDMARCRecord: {
            Type: 'AWS::Route53::RecordSet',
            Properties: {
                HostedZoneId: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-hosted-zone-id'])),
                Name: cf.join([
                    '_dmarc.',
                    cf.ref('SubdomainPrefix'),
                    '.',
                    cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-hosted-zone-name']))
                ]),
                Type: 'TXT',
                TTL: '300',
                ResourceRecords: [
                    '"v=DMARC1; p=none;"'
                ],
                Comment: cf.join(' ', [cf.stackName, 'DMARC Record'])
            }
        }
    },
    Outputs: {
        IngressPointId: {
            Description: 'Mail Manager Ingress Point ID',
            Value: cf.getAtt('PagingIngressPoint', 'IngressPointId'),
            Export: {
                Name: cf.join([cf.stackName, '-ingress-point-id'])
            }
        },
        IngressPointARecord: {
            Description: 'A-record hostname used by the MX entry',
            Value: cf.getAtt('PagingIngressPoint', 'ARecord'),
            Export: {
                Name: cf.join([cf.stackName, '-ingress-point-arecord'])
            }
        },
        MailDomain: {
            Description: 'Fully-qualified domain name that receives inbound mail',
            Value: cf.join([
                cf.ref('SubdomainPrefix'),
                '.',
                cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-hosted-zone-name']))
            ]),
            Export: {
                Name: cf.join([cf.stackName, '-mail-domain'])
            }
        },
        ArchiveId: {
            Description: 'Mail Manager Archive ID',
            Value: cf.getAtt('PagingArchive', 'ArchiveId'),
            Export: {
                Name: cf.join([cf.stackName, '-archive-id'])
            }
        }
    }
});
