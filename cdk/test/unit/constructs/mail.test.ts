import { App, Stack } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Mail, mailDomainFor, mailLayerPrefix } from '../../../lib/constructs/mail';
import { MOCK_CONFIGS } from '../../__fixtures__/mock-configs';
import { CDKTestHelper } from '../../__helpers__/cdk-test-utils';

describe('Mail Construct', () => {
  function build(props: Record<string, unknown> = {}) {
    const app = new App();
    const stack = new Stack(app, 'TAK-Test-CloudTAK', {
      env: { account: '123456789012', region: 'ap-southeast-2' }
    });
    const { hostedZone } = CDKTestHelper.createMockNetwork(stack);
    const topic = new sns.Topic(stack, 'HighUrgency');
    const mail = new Mail(stack, 'Mail', {
      envConfig: MOCK_CONFIGS.DEV_TEST,
      hostedZone,
      alarmTopic: topic,
      ...props
    });
    return { stack, mail, template: Template.fromStack(stack) };
  }

  const { template } = build();

  it('derives the mail domain the API expects (mail.<api host>)', () => {
    const { mail } = build();
    // api/common/config.ts: MAIL_DOMAIN = `mail.${apiUrl.host}`
    expect(mailDomainFor('map.test.com')).toBe('mail.map.test.com');
    expect(mail.mailDomain).toBe('mail.map.test.com');
    expect(mailLayerPrefix('TAK-Dev-CloudTAK')).toBe('/TAK-Dev-CloudTAK/mail/layer/');
  });

  it('creates an OPEN ingress point wired to the rule set and traffic policy', () => {
    template.hasResourceProperties('AWS::SES::MailManagerIngressPoint', {
      Type: 'OPEN',
      TlsPolicy: 'OPTIONAL',
      RuleSetId: Match.anyValue(),
      TrafficPolicyId: Match.anyValue()
    });
  });

  it('omits the ingress point, MX record and ingress exports when disabled', () => {
    const { template: off } = build({ enableIngressPoint: false });
    off.resourceCountIs('AWS::SES::MailManagerIngressPoint', 0);
    off.resourceCountIs('AWS::Route53::RecordSet', 1); // DMARC TXT only
    off.hasResourceProperties('AWS::Route53::RecordSet', { Type: 'TXT' });
    const exportNames = Object.values((off.toJSON().Outputs ?? {}) as Record<string, any>)
      .map((o) => o.Export?.Name);
    expect(exportNames).not.toContain('TAK-Test-CloudTAK-mail-ingress-point-id');
    expect(exportNames).not.toContain('TAK-Test-CloudTAK-mail-ingress-point-arecord');
    // Everything the API and layer stacks depend on is still there
    expect(exportNames).toContain('TAK-Test-CloudTAK-mail-layer-prefix');
    expect(exportNames).toContain('TAK-Test-CloudTAK-mail-bucket');
    expect(exportNames).toContain('TAK-Test-CloudTAK-mail-domain');
    off.resourceCountIs('AWS::SES::MailManagerRuleSet', 1);
    off.resourceCountIs('AWS::SES::MailManagerTrafficPolicy', 1);
  });
  it('traffic policy denies by default, allows only the mail domain, 10 MiB cap', () => {
    template.hasResourceProperties('AWS::SES::MailManagerTrafficPolicy', {
      DefaultAction: 'DENY',
      MaxMessageSizeBytes: 10485760,
      PolicyStatements: [{
        Action: 'ALLOW',
        Conditions: [{
          StringExpression: {
            Evaluate: { Attribute: 'RECIPIENT' },
            Operator: 'ENDS_WITH',
            Values: ['@mail.map.test.com']
          }
        }]
      }]
    });
  });

  it('archive is retained on stack deletion', () => {
    template.hasResource('AWS::SES::MailManagerArchive', {
      DeletionPolicy: 'Retain',
      Properties: { Retention: { RetentionPeriod: 'SIX_MONTHS' } }
    });
  });

  it('rule set archives everything, then writes to S3 and invokes the router', () => {
    template.hasResourceProperties('AWS::SES::MailManagerRuleSet', {
      Rules: [
        {
          Name: 'ArchiveAll',
          Conditions: [],
          Actions: [{ Archive: { TargetArchive: Match.anyValue() } }]
        },
        {
          Name: 'DeliverLayers',
          Conditions: [],
          Actions: [
            {
              WriteToS3: {
                S3Bucket: Match.anyValue(),
                RoleArn: Match.anyValue(),
                ActionFailurePolicy: 'DROP'
              }
            },
            {
              InvokeLambda: {
                FunctionArn: Match.anyValue(),
                InvocationType: 'EVENT',
                RoleArn: Match.anyValue(),
                ActionFailurePolicy: 'CONTINUE'
              }
            }
          ]
        }
      ]
    });
  });

  it('bucket is SSE-S3 encrypted, fully private, with expiry and multipart abort', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'tak-test-cloudtak-mail-123456789012-ap-southeast-2',
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [{
          ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' }
        }]
      },
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true
      },
      LifecycleConfiguration: {
        Rules: [{
          Id: 'ExpireMail',
          Status: 'Enabled',
          ExpirationInDays: 7,
          AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 }
        }]
      }
    });
  });

  it('lifecycle expiry is parameterised', () => {
    const custom = build({ mailExpirationDays: 30 }).template;
    custom.hasResourceProperties('AWS::S3::Bucket', {
      LifecycleConfiguration: { Rules: [Match.objectLike({ ExpirationInDays: 30 })] }
    });
  });

  it('router Lambda: Node 24, 128 MB, 30 s, env, 7-day logs', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'TAK-Test-CloudTAK-mail-router',
      Runtime: 'nodejs24.x',
      Handler: 'index.handler',
      MemorySize: 128,
      Timeout: 30,
      Environment: {
        Variables: {
          MAIL_BUCKET: Match.anyValue(),
          MAIL_DOMAIN: 'mail.map.test.com',
          LAYER_PREFIX: '/TAK-Test-CloudTAK/mail/layer/'
        }
      },
      Code: { ZipFile: Match.stringLikeRegexp('exports\\.handler') }
    });
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/lambda/TAK-Test-CloudTAK-mail-router',
      RetentionInDays: 7
    });
  });

  // ARNs are built with the partition pseudo-parameter, so they synthesize as Fn::Join
  const arn = (rest: string) => ({ 'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, `:${rest}`]] });

  it('router role reads the layer prefix and invokes TAK-NZ layer functions only', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: Match.objectLike({
        Statement: [Match.objectLike({ Principal: { Service: 'lambda.amazonaws.com' } })]
      }),
      Policies: [{
        PolicyName: 'router',
        PolicyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Action: 'ssm:GetParameter',
              Resource: arn('ssm:ap-southeast-2:123456789012:parameter/TAK-Test-CloudTAK/mail/layer/*')
            },
            {
              Effect: 'Allow',
              Action: 'lambda:InvokeFunction',
              // Upstream's `tak-cloudtak-<env>-layer-*` would match none of our layers
              Resource: arn('lambda:ap-southeast-2:123456789012:function:TAK-Test-CloudTAK-layer-*')
            }
          ]
        }
      }]
    });
  });

  it('rule role is assumed by SES with source account and rule-set conditions', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [{
          Effect: 'Allow',
          Action: 'sts:AssumeRole',
          Principal: { Service: 'ses.amazonaws.com' },
          Condition: {
            StringEquals: { 'aws:SourceAccount': '123456789012' },
            ArnLike: {
              'aws:SourceArn': arn('ses:ap-southeast-2:123456789012:mailmanager-rule-set/*')
            }
          }
        }]
      },
      Policies: [{
        PolicyName: 'rule-actions',
        PolicyDocument: {
          Statement: [
            Match.objectLike({ Action: 's3:PutObject' }),
            Match.objectLike({ Action: 's3:ListBucket' }),
            Match.objectLike({ Action: 'lambda:InvokeFunction' })
          ]
        }
      }]
    });
  });

  it('creates Errors, Throttles and Duration p99 alarms on the high-urgency topic', () => {
    template.resourceCountIs('AWS::CloudWatch::Alarm', 3);
    const common = {
      Namespace: 'AWS/Lambda',
      ComparisonOperator: 'GreaterThanThreshold',
      EvaluationPeriods: 1,
      Period: 300,
      TreatMissingData: 'notBreaching',
      AlarmActions: [{ Ref: Match.stringLikeRegexp('HighUrgency') }]
    };
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      ...common,
      AlarmName: 'TAK-Test-CloudTAK-MailRouterErrors',
      MetricName: 'Errors',
      Statistic: 'Sum',
      Threshold: 0
    });
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      ...common,
      AlarmName: 'TAK-Test-CloudTAK-MailRouterThrottles',
      MetricName: 'Throttles',
      Statistic: 'Sum',
      Threshold: 0
    });
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      ...common,
      AlarmName: 'TAK-Test-CloudTAK-MailRouterDuration',
      MetricName: 'Duration',
      ExtendedStatistic: 'p99',
      Threshold: 25000
    });
  });

  it('creates MX and DMARC records for the mail domain in the shared zone', () => {
    template.hasResourceProperties('AWS::Route53::RecordSet', {
      Type: 'MX',
      Name: 'mail.map.test.com.',
      HostedZoneId: 'Z123456789',
      TTL: '300',
      ResourceRecords: [{ 'Fn::Join': ['', ['10 ', { 'Fn::GetAtt': [Match.stringLikeRegexp('IngressPoint'), 'ARecord'] }]] }]
    });
    template.hasResourceProperties('AWS::Route53::RecordSet', {
      Type: 'TXT',
      Name: '_dmarc.mail.map.test.com.',
      HostedZoneId: 'Z123456789',
      ResourceRecords: ['"v=DMARC1; p=none;"']
    });
  });

  it('exports the names the patched API imports', () => {
    const outputs = template.toJSON().Outputs as Record<string, any>;
    const names = Object.values(outputs).map((o) => o.Export?.Name);
    expect(names).toEqual(expect.arrayContaining([
      'TAK-Test-CloudTAK-mail-layer-prefix',
      'TAK-Test-CloudTAK-mail-bucket',
      'TAK-Test-CloudTAK-mail-domain'
    ]));
  });
});
