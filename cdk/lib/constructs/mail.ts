/**
 * Inbound Email Infrastructure Construct
 *
 * Lets ETL layers receive email. Port of upstream
 * `cloudformation/mail.template.js` (v13.102.4) to CDK.
 *
 * Flow: mail to `<layer uuid>@mail.<api hostname>.<zone>` -> SES Mail Manager
 * ingress point -> rule set: (1) archive everything, (2) write the raw MIME to
 * the mail bucket and invoke the router Lambda. The router looks up the layer's
 * SSM parameter (`<layerPrefix><uuid>`, a JSON `{arn, senders}` registered by
 * the API in the layer's own CloudFormation stack, see
 * api/stateless/lib/aws/lambda.ts), applies the sender allow-list, and
 * async-invokes the layer Lambda with the S3 location of the message.
 *
 * Security notes (read before changing anything here):
 * - The ingress point is OPEN: it is a public SMTP endpoint reachable by anyone
 *   on the internet, and TLS is OPTIONAL (TlsPolicy). This is upstream's design;
 *   there is no authentication on inbound mail.
 * - Exposure is limited by the traffic policy: only recipients that end with
 *   `@<mail domain>` are accepted (default action DENY) and messages are capped
 *   at `maxMessageSizeBytes` (default 10 MiB).
 * - Each layer has a per-layer sender allow-list (`incoming.email_senders`),
 *   matched against the From header by the router. An EMPTY list means ANY
 *   sender is accepted, and the From header is unauthenticated, so treat it as
 *   a filter and not as a security boundary. The DMARC record below is `p=none`
 *   (monitor only).
 * - Raw mail is kept in S3 for `mailExpirationDays` (default 7). Every message
 *   is also kept in the Mail Manager archive (RETAIN on stack deletion).
 * - SES Mail Manager inbound is available in ap-southeast-2 (Sydney).
 *
 * DNS records created in the imported hosted zone:
 * - MX    `mail.<api hostname>.<zone>`        -> `10 <ingress point A record>`
 * - TXT   `_dmarc.mail.<api hostname>.<zone>` -> `v=DMARC1; p=none;`
 *
 * The mail domain MUST equal what the API computes as MAIL_DOMAIN
 * (`mail.${API_URL host}`, api/common/config.ts); `mailDomainFor()` is the one
 * place that derivation lives on the CDK side, and cloudtak-api.ts sets
 * MAIL_DOMAIN explicitly from the same rule.
 *
 * Cost switch: the ingress point is a flat ~$49/month whether or not mail
 * arrives. `cloudtak.enableInboundMail` (cdk.json, default true when unset)
 * turns off just the ingress point, its MX record and its two exports. Everything
 * else (bucket, router, rule set, traffic policy, archive, DMARC, alarms) is
 * still created so the API, the ETL role and the layer stacks keep working, and
 * so turning mail back on is a one-line change. With the ingress point off, mail
 * sent to a layer address bounces.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { ContextEnvironmentConfig } from '../stack-config';

/**
 * Mail domain for a given API host (`map.<zone>` -> `mail.map.<zone>`).
 * Mirrors `mail.${apiUrl.host}` in api/common/config.ts.
 */
export function mailDomainFor(apiHost: string): string {
  return `mail.${apiHost}`;
}

/**
 * SSM parameter path prefix that ETL layers register under, keyed by layer UUID.
 * Shared by the router (reads), the API task role (writes) and the stack export.
 */
export function mailLayerPrefix(stackName: string): string {
  return `/${stackName}/mail/layer/`;
}

export interface MailProps {
  envConfig: ContextEnvironmentConfig;
  /** Hosted zone the Webhooks construct also uses. */
  hostedZone: route53.IHostedZone;
  /** High-urgency alarm topic (Alarms.highUrgencyTopic). */
  alarmTopic: sns.ITopic;
  /** Days raw email delivered to ETL layers is retained in S3. Default 7. */
  mailExpirationDays?: number;
  /** Maximum allowed inbound message size. Default 10 MiB. */
  maxMessageSizeBytes?: number;
  /** Mail Manager archive retention (SES enum). Default SIX_MONTHS. */
  archiveRetentionPeriod?: string;
  /**
   * Create the Mail Manager ingress point and its MX record. The ingress point
   * costs about $49/month flat. Default true. When false no mail can arrive.
   */
  enableIngressPoint?: boolean;
}

export class Mail extends Construct {
  public readonly mailDomain: string;
  public readonly layerPrefix: string;
  public readonly bucket: s3.Bucket;
  public readonly routerFunction: lambda.Function;
  public readonly ruleRole: iam.Role;
  public readonly archive: ses.CfnMailManagerArchive;
  public readonly ruleSet: ses.CfnMailManagerRuleSet;
  public readonly trafficPolicy: ses.CfnMailManagerTrafficPolicy;
  /** Undefined when `enableIngressPoint` is false. */
  public readonly ingressPoint?: ses.CfnMailManagerIngressPoint;

  constructor(scope: Construct, id: string, props: MailProps) {
    super(scope, id);

    const {
      envConfig,
      hostedZone,
      alarmTopic,
      mailExpirationDays = 7,
      maxMessageSizeBytes = 10485760,
      archiveRetentionPeriod = 'SIX_MONTHS',
      enableIngressPoint = true
    } = props;
    const stack = cdk.Stack.of(this);
    const stackName = stack.stackName;
    const resourceName = `${stackName}-mail`;

    // <api hostname>.<zone> is the API host (Route53.serviceUrl); mail hangs off it
    const relativeMailName = mailDomainFor(envConfig.cloudtak.hostname);
    this.mailDomain = mailDomainFor(`${envConfig.cloudtak.hostname}.${hostedZone.zoneName}`);
    this.layerPrefix = mailLayerPrefix(stackName);

    // Traffic policy: only accept mail addressed to the mail domain, capped in size
    this.trafficPolicy = new ses.CfnMailManagerTrafficPolicy(this, 'TrafficPolicy', {
      trafficPolicyName: resourceName,
      defaultAction: 'DENY',
      maxMessageSizeBytes,
      policyStatements: [{
        action: 'ALLOW',
        conditions: [{
          stringExpression: {
            evaluate: { attribute: 'RECIPIENT' },
            operator: 'ENDS_WITH',
            values: [`@${this.mailDomain}`]
          }
        }]
      }]
    });

    // Archive: long-term storage of every received message. Kept on stack delete.
    this.archive = new ses.CfnMailManagerArchive(this, 'Archive', {
      archiveName: resourceName,
      retention: { retentionPeriod: archiveRetentionPeriod }
    });
    this.archive.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

    // Raw MIME of every message delivered to layers, keyed by message ID. The
    // Lambda payload only carries headers, so layers read the body from here.
    this.bucket = new s3.Bucket(this, 'MailBucket', {
      bucketName: `${stackName.toLowerCase()}-mail-${stack.account}-${stack.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      lifecycleRules: [{
        id: 'ExpireMail',
        enabled: true,
        expiration: cdk.Duration.days(mailExpirationDays),
        abortIncompleteMultipartUploadAfter: cdk.Duration.days(1)
      }]
    });

    // Router Lambda role. Layer functions are named `<stackName>-layer-<id>`
    // (api/stateless/lib/aws/lambda.ts), NOT upstream's `tak-cloudtak-<env>-layer-*`.
    const routerRole = new iam.Role(this, 'RouterFunctionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Routes inbound email to CloudTAK ETL layers',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ],
      inlinePolicies: {
        router: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['ssm:GetParameter'],
              resources: [`arn:${stack.partition}:ssm:${stack.region}:${stack.account}:parameter${this.layerPrefix}*`]
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['lambda:InvokeFunction'],
              resources: [`arn:${stack.partition}:lambda:${stack.region}:${stack.account}:function:${stackName}-layer-*`]
            })
          ]
        })
      }
    });

    const routerLogs = new logs.LogGroup(this, 'RouterLogs', {
      logGroupName: `/aws/lambda/${resourceName}-router`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // Vendored copy of upstream cloudformation/lib/mail-lambda.cjs. CommonJS
    // inline code is deployed as index.js (4096 character limit for inline code).
    this.routerFunction = new lambda.Function(this, 'RouterFunction', {
      functionName: `${resourceName}-router`,
      description: 'Route inbound email to ETL Layers',
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'index.handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(30),
      role: routerRole,
      logGroup: routerLogs,
      environment: {
        MAIL_BUCKET: this.bucket.bucketName,
        MAIL_DOMAIN: this.mailDomain,
        LAYER_PREFIX: this.layerPrefix
      },
      code: lambda.Code.fromInline(
        fs.readFileSync(path.join(__dirname, '../lambda/mail-router.cjs'), 'utf8')
      )
    });

    // Rule role: assumed by Mail Manager to execute the rule actions
    this.ruleRole = new iam.Role(this, 'MailRuleRole', {
      assumedBy: new iam.ServicePrincipal('ses.amazonaws.com', {
        conditions: {
          StringEquals: { 'aws:SourceAccount': stack.account },
          ArnLike: {
            'aws:SourceArn': `arn:${stack.partition}:ses:${stack.region}:${stack.account}:mailmanager-rule-set/*`
          }
        }
      }),
      description: 'Allows SES Mail Manager to deliver inbound email to S3 and the router',
      inlinePolicies: {
        'rule-actions': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['s3:PutObject'],
              resources: [this.bucket.arnForObjects('*')]
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['s3:ListBucket'],
              resources: [this.bucket.bucketArn]
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['lambda:InvokeFunction'],
              resources: [this.routerFunction.functionArn]
            })
          ]
        })
      }
    });

    // Rule set: archive everything, then write to S3 and hand to the router
    this.ruleSet = new ses.CfnMailManagerRuleSet(this, 'RuleSet', {
      ruleSetName: resourceName,
      rules: [{
        name: 'ArchiveAll',
        conditions: [],
        actions: [{
          archive: { targetArchive: this.archive.attrArchiveId }
        }]
      }, {
        name: 'DeliverLayers',
        conditions: [],
        actions: [{
          writeToS3: {
            s3Bucket: this.bucket.bucketName,
            roleArn: this.ruleRole.roleArn,
            actionFailurePolicy: 'DROP'
          }
        }, {
          invokeLambda: {
            functionArn: this.routerFunction.functionArn,
            invocationType: 'EVENT',
            roleArn: this.ruleRole.roleArn,
            actionFailurePolicy: 'CONTINUE'
          }
        }]
      }]
    });

    if (enableIngressPoint) {
      // Ingress point: OPEN public SMTP endpoint (see security notes above)
      this.ingressPoint = new ses.CfnMailManagerIngressPoint(this, 'IngressPoint', {
        ingressPointName: resourceName,
        type: 'OPEN',
        tlsPolicy: 'OPTIONAL',
        ruleSetId: this.ruleSet.attrRuleSetId,
        trafficPolicyId: this.trafficPolicy.attrTrafficPolicyId
      });

      // MX: direct inbound SMTP for the mail domain to the ingress endpoint
      new route53.MxRecord(this, 'MxRecord', {
        zone: hostedZone,
        recordName: relativeMailName,
        values: [{ priority: 10, hostName: this.ingressPoint.attrARecord }],
        ttl: cdk.Duration.minutes(5),
        comment: `${resourceName} Mail Manager MX Record`
      });
    }

    // DMARC: monitor-only policy for the inbound mail subdomain
    new route53.TxtRecord(this, 'DmarcRecord', {
      zone: hostedZone,
      recordName: `_dmarc.${relativeMailName}`,
      values: ['v=DMARC1; p=none;'],
      ttl: cdk.Duration.minutes(5),
      comment: `${resourceName} DMARC Record`
    });

    // Router alarms -> high-urgency topic (alarm action only, so idle periods
    // do not page; missing data is not breaching)
    const notify = new cwActions.SnsAction(alarmTopic);
    const routerAlarm = (
      alarmId: string,
      alarmName: string,
      metric: cloudwatch.IMetric,
      threshold: number
    ) => {
      const alarm = new cloudwatch.Alarm(this, alarmId, {
        alarmName: `${stackName}-${alarmName}`,
        metric,
        threshold,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
      });
      alarm.addAlarmAction(notify);
      return alarm;
    };
    const period = cdk.Duration.minutes(5);
    routerAlarm('RouterErrorsAlarm', 'MailRouterErrors',
      this.routerFunction.metricErrors({ period, statistic: 'Sum' }), 0);
    routerAlarm('RouterThrottlesAlarm', 'MailRouterThrottles',
      this.routerFunction.metricThrottles({ period, statistic: 'Sum' }), 0);
    routerAlarm('RouterDurationAlarm', 'MailRouterDuration',
      this.routerFunction.metricDuration({ period, statistic: 'p99' }), 25000);

    // Exports. Names follow the Webhooks pattern (`<stackName>-webhooks-*`) and
    // are what the patched api/stateless/lib/aws/lambda.ts imports.
    new cdk.CfnOutput(this, 'MailLayerPrefix', {
      value: this.layerPrefix,
      description: 'SSM Parameter prefix that ETL Layers register their function ARN under, keyed by Layer UUID',
      exportName: `${stackName}-mail-layer-prefix`
    });
    new cdk.CfnOutput(this, 'MailBucketName', {
      value: this.bucket.bucketName,
      description: 'Bucket that raw email delivered to ETL Layers is written to',
      exportName: `${stackName}-mail-bucket`
    });
    new cdk.CfnOutput(this, 'MailDomain', {
      value: this.mailDomain,
      description: 'Fully-qualified domain name that receives inbound mail',
      exportName: `${stackName}-mail-domain`
    });
    if (this.ingressPoint) {
      new cdk.CfnOutput(this, 'MailIngressPointId', {
        value: this.ingressPoint.attrIngressPointId,
        description: 'Mail Manager Ingress Point ID',
        exportName: `${stackName}-mail-ingress-point-id`
      });
      new cdk.CfnOutput(this, 'MailIngressPointARecord', {
        value: this.ingressPoint.attrARecord,
        description: 'A-record hostname used by the MX entry',
        exportName: `${stackName}-mail-ingress-point-arecord`
      });
    }
    new cdk.CfnOutput(this, 'MailArchiveId', {
      value: this.archive.attrArchiveId,
      description: 'Mail Manager Archive ID',
      exportName: `${stackName}-mail-archive-id`
    });
  }
}
