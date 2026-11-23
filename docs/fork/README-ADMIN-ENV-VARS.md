# Admin Environment Variables Patch (000)

## Overview
This patch adds support for configuring CloudTAK server settings via environment variables, based on upstream PR #712.

## Changes
- Adds `CLOUDTAK_Server_*` environment variable support for server configuration
- Adds support for P12 certificate loading from AWS Secrets Manager
- Adds VPC-related configuration (VpcId, SubnetPublicA, SubnetPublicB, MediaSecurityGroup)
- Adds MediaSecret and DynamoDB configuration

## Modifications from PR #712
- **Removed Cacher references**: PR #712 references `./cacher.js` which doesn't exist in upstream. These references have been removed from our patch.

## Known TypeScript Errors
The following TypeScript errors are expected and will be resolved when upstream merges related PRs:
- `lib/config.ts(195,51)`: Server generation with Record<string, unknown>
- `lib/config.ts(343,45)`: Profile generation with password in auth

These errors don't affect runtime functionality.

## Upstream Status
- Based on: [PR #712](https://github.com/dfpc-coe/CloudTAK/pull/712)
- Status: Not yet merged
- Note: Once PR #712 is merged, this patch can be removed

## Usage
Environment variables can be set to configure the server:
```bash
CLOUDTAK_Server_name="Production Server"
CLOUDTAK_Server_url="ssl://tak.example.com:8089"
CLOUDTAK_Server_api="https://tak.example.com:8443"
CLOUDTAK_Server_webtak="https://tak.example.com:8444"
CLOUDTAK_Server_auth_p12_secret_arn="arn:aws:secretsmanager:..."
CLOUDTAK_Server_auth_password="password"
CLOUDTAK_Server_auth_p12_refresh_interval=3600
```

When the admin certificate comes from `CLOUDTAK_Server_auth_p12_secret_arn`, the API and the hub re-read the secret
every `CLOUDTAK_Server_auth_p12_refresh_interval` seconds (default 3600, `0` turns the timer off). A changed
certificate is written to the `server` table, applied in memory and the hub reconnects its admin connection. A
call made with the admin certificate that fails with a closed socket or TLS alert also triggers one reload (at most
once a minute) and is retried once. A failed load logs `AdminCertReloadFailed` and keeps the certificate in use.
## SAR travel-time relay (`SAR_SERVICE_URL`, `SAR_SERVICE_KEY`, `SAR_RATE_LIMIT`)
These variables configure the `/api/sar` relay for the `cloudtak-plugin-sar` plugin. They are plain
environment variables, not `CLOUDTAK_Server_*` settings.

| Variable | Required | Rule | Default |
|----------|----------|------|---------|
| `SAR_SERVICE_URL` | Yes | `https` URL of the SAR engine, may include a path such as `/sar`; no query, fragment or credentials; a trailing slash is stripped | none (relay disabled) |
| `SAR_SERVICE_KEY` | Yes | Characters `[A-Za-z0-9._~-]`, 16 to 128 long | none (relay disabled) |
| `SAR_RATE_LIMIT` | No | Travel-time calculations per user per minute, whole number 1 to 60 | 6 |

- **Where:** `s3://<config bucket>/cloudtak-config.env`, applied with
  `--context useS3CloudTAKConfigFile=true` when the API task starts. See `cloudtak-config.env.example`.
- **Relay disabled:** when the URL or the key is missing or invalid, `GET /api/sar/status` returns
  `enabled: false`, the plugin stays hidden and no call is made to the engine. An invalid value is
  reported once in the log by name only.
- **Secret handling:** the key is never logged and never sent to browsers.
- **Details:** see the SAR section of [`FORK-DELTA.md`](FORK-DELTA.md#sar-plugin-relay-apisar) and
  [`../DEPLOYMENT_GUIDE.md`](../DEPLOYMENT_GUIDE.md#sar-travel-time-plugin-cloudtak-plugin-sar).
