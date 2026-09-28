import cf from '@openaddresses/cloudfriend';

// Layers are addressed as <layer uuid>@<mail domain> and register their
// function ARN as an SSM Parameter under LAYER_PREFIX
const router = `const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

const ssm = new SSMClient({});
const lambda = new LambdaClient({});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function deliver(uuid, mail, receipt) {
    let arn;
    try {
        const res = await ssm.send(new GetParameterCommand({
            Name: process.env.LAYER_PREFIX + uuid
        }));
        arn = res.Parameter.Value;
    } catch (err) {
        if (err.name !== 'ParameterNotFound') throw err;
        console.log('ok - no layer registered for ' + uuid);
        return;
    }

    await lambda.send(new InvokeCommand({
        FunctionName: arn,
        InvocationType: 'Event',
        Payload: Buffer.from(JSON.stringify({
            type: 'email',
            bucket: process.env.MAIL_BUCKET,
            key: mail.messageId,
            mail,
            receipt
        }))
    }));

    console.log('ok - delivered ' + mail.messageId + ' to ' + uuid);
}

exports.handler = async (event) => {
    const deliveries = [];

    for (const record of event.Records || []) {
        const { mail, receipt } = record.ses;

        const layers = new Set();
        for (const recipient of receipt.recipients || []) {
            const address = String(recipient).toLowerCase();
            const at = address.lastIndexOf('@');
            const local = address.slice(0, at);
            const domain = address.slice(at + 1);

            if (domain === process.env.MAIL_DOMAIN.toLowerCase() && UUID.test(local)) {
                layers.add(local);
            }
        }

        for (const uuid of layers) deliveries.push(deliver(uuid, mail, receipt));
    }

    const failed = (await Promise.allSettled(deliveries)).filter((d) => d.status === 'rejected');
    for (const failure of failed) console.error(failure.reason);
    if (failed.length) throw new Error(failed.length + ' deliveries failed');
};
`;

export default cf.merge({
    Description: 'Inbound email paging & ETL Layer delivery via AWS SES Mail Manager for CloudTAK',
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
        MailExpirationDays: {
            Type: 'Number',
            Description: 'Days that raw email delivered to ETL Layers is retained in S3',
            Default: 7
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
         * Bucket — raw MIME of every received message, keyed by message ID,
         * read by ETL Layers as the Lambda payload only contains headers.
         */
        MailBucket: {
            Type: 'AWS::S3::Bucket',
            Properties: {
                BucketName: cf.join('-', [cf.stackName, cf.accountId, cf.region]),
                PublicAccessBlockConfiguration: {
                    BlockPublicAcls: true,
                    BlockPublicPolicy: true,
                    IgnorePublicAcls: true,
                    RestrictPublicBuckets: true
                },
                BucketEncryption: {
                    ServerSideEncryptionConfiguration: [{
                        ServerSideEncryptionByDefault: {
                            SSEAlgorithm: 'AES256'
                        }
                    }]
                },
                LifecycleConfiguration: {
                    Rules: [{
                        Id: 'ExpireMail',
                        Status: 'Enabled',
                        ExpirationInDays: cf.ref('MailExpirationDays'),
                        AbortIncompleteMultipartUpload: {
                            DaysAfterInitiation: 1
                        }
                    }]
                }
            }
        },

        /**
         * Rule role — assumed by Mail Manager to execute rule actions.
         */
        MailRuleRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
                AssumeRolePolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Principal: {
                            Service: 'ses.amazonaws.com'
                        },
                        Action: 'sts:AssumeRole',
                        Condition: {
                            StringEquals: {
                                'aws:SourceAccount': cf.accountId
                            },
                            ArnLike: {
                                'aws:SourceArn': cf.join(['arn:', cf.partition, ':ses:', cf.region, ':', cf.accountId, ':mailmanager-rule-set/*'])
                            }
                        }
                    }]
                },
                Policies: [{
                    PolicyName: cf.join([cf.stackName, '-rule-actions']),
                    PolicyDocument: {
                        Version: '2012-10-17',
                        Statement: [{
                            Effect: 'Allow',
                            Action: ['s3:PutObject'],
                            Resource: [cf.join(['arn:', cf.partition, ':s3:::', cf.ref('MailBucket'), '/*'])]
                        },{
                            Effect: 'Allow',
                            Action: ['s3:ListBucket'],
                            Resource: [cf.join(['arn:', cf.partition, ':s3:::', cf.ref('MailBucket')])]
                        },{
                            Effect: 'Allow',
                            Action: ['lambda:InvokeFunction'],
                            Resource: [cf.getAtt('MailRouterFunction', 'Arn')]
                        }]
                    }
                }]
            }
        },

        /**
         * Router — resolves each recipient to a registered ETL Layer and
         * invokes it with the S3 location of the message.
         */
        MailRouterLogs: {
            Type: 'AWS::Logs::LogGroup',
            Properties: {
                LogGroupName: cf.join(['/aws/lambda/', cf.stackName, '-router']),
                RetentionInDays: 7
            }
        },
        MailRouterFunction: {
            Type: 'AWS::Lambda::Function',
            DependsOn: ['MailRouterLogs'],
            Properties: {
                FunctionName: cf.join([cf.stackName, '-router']),
                Description: 'Route inbound email to ETL Layers',
                Handler: 'index.handler',
                Runtime: 'nodejs22.x',
                MemorySize: 128,
                Timeout: 30,
                Role: cf.getAtt('MailRouterFunctionRole', 'Arn'),
                Environment: {
                    Variables: {
                        MAIL_BUCKET: cf.ref('MailBucket'),
                        MAIL_DOMAIN: cf.join([
                            cf.ref('SubdomainPrefix'),
                            '.',
                            cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-hosted-zone-name']))
                        ]),
                        LAYER_PREFIX: cf.join(['/', cf.stackName, '/layer/'])
                    }
                },
                Code: {
                    ZipFile: router
                }
            }
        },
        MailRouterFunctionRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
                AssumeRolePolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Principal: {
                            Service: ['lambda.amazonaws.com']
                        },
                        Action: ['sts:AssumeRole']
                    }]
                },
                Policies: [{
                    PolicyName: cf.join([cf.stackName, '-router']),
                    PolicyDocument: {
                        Version: '2012-10-17',
                        Statement: [{
                            Effect: 'Allow',
                            Action: ['ssm:GetParameter'],
                            Resource: [cf.join(['arn:', cf.partition, ':ssm:', cf.region, ':', cf.accountId, ':parameter/', cf.stackName, '/layer/*'])]
                        },{
                            Effect: 'Allow',
                            Action: ['lambda:InvokeFunction'],
                            Resource: [cf.join(['arn:', cf.partition, ':lambda:', cf.region, ':', cf.accountId, ':function:tak-cloudtak-', cf.ref('Environment'), '-layer-*'])]
                        }]
                    }
                }],
                ManagedPolicyArns: [cf.join(['arn:', cf.partition, ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'])]
            }
        },

        /**
         * ETL policy — allow ETL Layers to read delivered messages.
         */
        MailETLPolicy: {
            Type: 'AWS::IAM::Policy',
            Properties: {
                PolicyName: cf.join([cf.stackName, '-etl']),
                Roles: [cf.join(['tak-cloudtak-', cf.ref('Environment')])],
                PolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Action: ['s3:GetObject'],
                        Resource: [cf.join(['arn:', cf.partition, ':s3:::', cf.ref('MailBucket'), '/*'])]
                    }]
                }
            }
        },

        /**
         * Rule set — every message is archived, then written to S3 and
         * handed to the router for delivery to ETL Layers.
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
                },{
                    Name: 'DeliverLayers',
                    Conditions: [],
                    Actions: [{
                        WriteToS3: {
                            S3Bucket: cf.ref('MailBucket'),
                            RoleArn: cf.getAtt('MailRuleRole', 'Arn'),
                            ActionFailurePolicy: 'DROP'
                        }
                    },{
                        InvokeLambda: {
                            FunctionArn: cf.getAtt('MailRouterFunction', 'Arn'),
                            InvocationType: 'EVENT',
                            RoleArn: cf.getAtt('MailRuleRole', 'Arn'),
                            ActionFailurePolicy: 'CONTINUE'
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
        },
        MailBucket: {
            Description: 'Bucket that raw email delivered to ETL Layers is written to',
            Value: cf.ref('MailBucket'),
            Export: {
                Name: cf.join([cf.stackName, '-bucket'])
            }
        },
        LayerPrefix: {
            Description: 'SSM Parameter prefix that ETL Layers register their function ARN under, keyed by Layer UUID',
            Value: cf.join(['/', cf.stackName, '/layer/']),
            Export: {
                Name: cf.join([cf.stackName, '-layer-prefix'])
            }
        }
    }
});
