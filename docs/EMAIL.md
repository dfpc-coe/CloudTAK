# CloudTAK Inbound Email for ETL Layers

ETL layers with **Email Delivery** enabled receive messages sent to
`<layer uuid>@mail.<api hostname>.<zone>` (for example
`<uuid>@mail.map.tak.nz`). The infrastructure is the CDK port of upstream's
`cloudformation/mail.template.js` (v13.102.4) and lives in
`cdk/lib/constructs/mail.ts`.

Everything except the ingress point is deployed with every stack. The ingress point and MX record can be switched off with `cloudtak.enableInboundMail` (see [Turning inbound mail off](#turning-inbound-mail-off-cost)).

## Flow

1. The sender's mail server resolves the **MX record** and delivers to the SES
   Mail Manager **ingress point**.
2. The **traffic policy** accepts only recipients ending in `@<mail domain>`
   (default DENY) and messages up to 10 MiB.
3. The **rule set** runs two rules: `ArchiveAll` (Mail Manager archive, kept
   when the stack is deleted), then `DeliverLayers` (write raw MIME to the mail
   bucket, then invoke the router Lambda asynchronously).
4. The **router Lambda** (`TAK-<Env>-CloudTAK-mail-router`) reads the SSM
   parameter `<layer prefix><uuid>` (JSON `{arn, senders}`), applies the
   per-layer sender allow-list, and async-invokes the layer function with
   `{type: 'email', bucket, key, mail, receipt}`.
5. The layer reads the raw message from the mail bucket (its role, `TAK-<Env>-CloudTAK-etl`,
   has `s3:GetObject` on it).

The SSM parameter is created by the API inside each layer's own CloudFormation
stack, which is why the API task role has `ssm:PutParameter` and friends on the
layer prefix.

## DNS records created

Both are created in the hosted zone that CloudTAK and Webhooks already use.

| Record | Name | Value |
|--------|------|-------|
| MX | `mail.<hostname>.<zone>` | `10 <ingress point A record>` |
| TXT | `_dmarc.mail.<hostname>.<zone>` | `v=DMARC1; p=none;` |

The mail domain is `mail.` + the API host. It must equal `MAIL_DOMAIN` as the API
computes it (`api/common/config.ts`); the CDK sets `MAIL_DOMAIN` explicitly on
both the stateless and stateful containers from the same rule. Do not point
another MX at that name.

## Resources

| Resource | Notes |
|----------|-------|
| `AWS::SES::MailManagerTrafficPolicy` | DENY by default, ALLOW recipient `ENDS_WITH @<mail domain>`, 10 MiB max |
| `AWS::SES::MailManagerArchive` | 6 month retention, `Retain` on stack deletion |
| `AWS::SES::MailManagerRuleSet` | `ArchiveAll`, then `DeliverLayers` (WriteToS3 + InvokeLambda EVENT) |
| `AWS::SES::MailManagerIngressPoint` | `OPEN`, TLS `OPTIONAL`. Only created when `cloudtak.enableInboundMail` is true (see below) |
| S3 bucket | `tak-<env>-cloudtak-mail-<account>-<region>`, SSE-S3, all public access blocked, objects expire after 7 days, incomplete multipart uploads abort after 1 day |
| Router Lambda | Node.js 24, 128 MB, 30 s, logs kept 7 days. Code is `cdk/lib/lambda/mail-router.cjs`, a verbatim copy of upstream `cloudformation/lib/mail-lambda.cjs` |
| Router alarms | Errors > 0, Throttles > 0, Duration p99 > 25 s, to the high-urgency topic |

The 7 day expiry, archive retention and size limit are props on the `Mail`
construct (`mailExpirationDays`, `archiveRetentionPeriod`, `maxMessageSizeBytes`).

## Turning inbound mail off (cost)

The ingress point is a flat charge of about $49 a month whether or not any mail
arrives. `cloudtak.enableInboundMail` in `cdk/cdk.json` (context override of the
same name, defaults to `true` when unset) controls it:

| Profile | `enableInboundMail` |
|---------|---------------------|
| `dev-test` | `false` |
| `prod` | `true` |

When it is `false`, only the ingress point, the MX record and the two
`mail-ingress-point-*` exports are removed. The bucket, router Lambda, rule set,
traffic policy, archive, DMARC record, alarms and the other exports stay, so the
API, the ETL role and layer stacks keep deploying. Mail sent to a layer's
address bounces, so ETL layers that rely on inbound email stop receiving it.
Set it back to `true` and redeploy to restore mail.

## CloudFormation exports

| Export | Value |
|--------|-------|
| `TAK-{Env}-CloudTAK-mail-layer-prefix` | `/TAK-{Env}-CloudTAK/mail/layer/` (imported by layer stacks) |
| `TAK-{Env}-CloudTAK-mail-bucket` | Mail bucket name |
| `TAK-{Env}-CloudTAK-mail-domain` | Mail domain |
| `TAK-{Env}-CloudTAK-mail-ingress-point-id` | Ingress point ID (only when inbound mail is enabled) |
| `TAK-{Env}-CloudTAK-mail-ingress-point-arecord` | Ingress point A record, the MX target (only when inbound mail is enabled) |
| `TAK-{Env}-CloudTAK-mail-archive-id` | Archive ID |

The API finds the layer prefix through a small fork patch,
`Lambda.siblingExport()` in `api/stateless/lib/aws/lambda.ts`
(see [`fork/FORK-DELTA.md`](fork/FORK-DELTA.md)).

## Security notes

- The ingress point is **OPEN**: public SMTP, reachable by anyone, with TLS
  optional. There is no authentication of inbound mail.
- Exposure is bounded by the traffic policy: only recipients at the mail domain,
  10 MiB per message.
- Each layer has a sender allow-list matched against the `From` header. An empty
  list accepts **any** sender, and `From` can be forged, so treat it as a filter
  and not a security boundary. DMARC is `p=none` (monitor only).
- Raw mail stays in S3 for 7 days and in the Mail Manager archive for 6 months.
  Do not send sensitive content to a layer address.
- SES Mail Manager inbound is available in ap-southeast-2 (Sydney).
