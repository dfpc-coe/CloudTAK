# OIDC Authentication

CloudTAK (TAK.NZ fork) supports Single Sign-On via OpenID Connect, with automatic X.509 certificate
enrollment so SSO users get full TAK functionality — web UI and TAK client connectivity — without
manual certificate handling.

> **Architecture note (Aug 2026):** CloudTAK performs the OIDC Authorization Code flow **itself**, as
> the relying party. An earlier implementation delegated the handshake to an AWS ALB `authenticate-oidc`
> listener action; that approach was abandoned. There is no ALB OIDC listener, no `x-amzn-oidc-*` header
> parsing, and no ALB session cookies. See [Why not ALB OIDC](#why-not-alb-oidc) for the rationale.

## Architecture

```
Browser clicks "Login with SSO"
        │
        ▼
GET /api/login/oidc                        ← CloudTAK signs a short-lived state JWT (10m)
        │
        ▼
Redirect to IdP authorization endpoint     ← discovered from OIDC_DISCOVERY_URL
        │
        ▼
User authenticates with Authentik
        │
        ▼
GET /api/login/oidc/callback?code=…&state=…
        │
        ├── verify state JWT (must carry t: 'oidc')
        ├── exchange code for tokens directly with the IdP over TLS
        ├── fetch /userinfo claims (incl. group membership)
        ├── identify the user by `preferred_username`, falling back to `email`
        ├── create or update the CloudTAK profile
        ├── enroll / renew the TAK client certificate
        └── sync Authentik attributes (callsign, group, role)
        │
        ▼
Redirect to /login#sso=<base64url payload>  ← URL *fragment*, never sent to the server
        │
        ▼
Login.vue consumes and clears the fragment, establishes the session
```

The session payload is delivered in the URL fragment rather than a query string so it never appears in
server access logs or browser history.

## Backend components

| File | Responsibility |
|---|---|
| `api/lib/oidc.ts` | IdP-agnostic OIDC engine: `discovery()`, `authorizationUrl()`, `exchangeCode()`, `userinfo()` |
| `api/routes/login.ts` | `GET /login/oidc`, `GET /login/oidc/callback`, `GET /logout`, plus `oidcConfig()` |
| `api/lib/auth.ts` | `isOidcEnabled()`, `isOidcForced()` |
| `api/routes/server.ts` | `GET /server/oidc` — public status endpoint |
| `api/lib/authentik-provider.ts` | Authentik-specific: cert enrollment, role/attribute sync, machine users |
| `app/src/components/Login.vue` | SSO button, fragment consumption, forced-SSO handling |

The split is deliberate: `oidc.ts` and the login routes are provider-agnostic (any OIDC-compliant IdP),
while everything Authentik-specific is isolated in `authentik-provider.ts`.

## API endpoints

### Public (no authentication)

- **`GET /api/server/oidc`** — lets the login page decide what to render before a session exists:
  ```json
  { "oidc_enabled": true, "oidc_forced": true, "authentik_url": "https://account.example.com" }
  ```
- **`GET /api/login/oidc`** — begins the flow. Optional `?redirect=` for post-login navigation, carried
  through the signed state JWT. On failure redirects to `/login?sso_error=<message>`.
- **`GET /api/login/oidc/callback`** — Authorization Code callback. Rejects a missing/invalid/expired
  state JWT, or one whose `t` claim isn't `oidc`.

  **Identity claim.** CloudTAK's `Profile.username` (its primary key for the user) is populated from the
  userinfo `preferred_username` claim, falling back to `email` (lowercased) if `preferred_username` is
  absent. `preferred_username` is used as-is, without lowercasing, since Authentik usernames are a
  case-sensitive unique field - lowercasing it could silently merge two distinct accounts that differ
  only by case. This lets users without an email attribute in Authentik (and users whose Authentik
  username differs from their email) log in; the callback fails with `400` only if userinfo returns
  neither claim. `AuthentikProvider.findUserByEmailOrUsername()` (see Certificate enrollment below)
  resolves whichever identifier was used back to the canonical Authentik user record for cert enrollment
  and attribute sync, so the two lookups stay consistent even when username and email differ.
- **`GET /api/logout`** — redirects to the IdP end-session endpoint
  (`{AUTHENTIK_URL}/application/o/{AUTHENTIK_APP_SLUG}/end-session/`) when configured, otherwise to
  `/login`.

## Configuration

### Environment variables

Provider-agnostic OIDC:

| Variable | Purpose |
|---|---|
| `OIDC_ENABLED` | `'true'` enables the SSO button and the OIDC routes |
| `OIDC_FORCED` | `'true'` auto-redirects to the IdP; local login restricted to `LOCAL_ONLY_ACCOUNTS` and system admins |
| `OIDC_DISCOVERY_URL` | `.well-known/openid-configuration` URL |
| `OIDC_CLIENT_ID` | OAuth2 client ID |
| `OIDC_CLIENT_SECRET` | OAuth2 client secret (injected from Secrets Manager) |
| `OIDC_SCOPES` | default `openid profile email groups` |
| `OIDC_REDIRECT_URI` | defaults to `{API_URL}/api/login/oidc/callback` |
| `LOCAL_ONLY_ACCOUNTS` | comma-separated usernames (the same identifiers CloudTAK stores as `Profile.username` - see below) exempt from forced SSO |

Authentik-specific:

| Variable | Purpose |
|---|---|
| `AUTHENTIK_URL` | Authentik base URL (API calls + logout redirect) |
| `AUTHENTIK_APP_SLUG` | application slug, used for the end-session URL |
| `AUTHENTIK_API_TOKEN_SECRET_ARN` | Secrets Manager ARN for the Authentik admin API token |
| `SYNC_AUTHENTIK_ATTRIBUTES_ON_LOGIN` | re-apply callsign/group/role on **every** login (default `true`) |
| `OIDC_SYSTEM_ADMIN_GROUP` | group granting system admin (default `CloudTAKSystemAdmin`) |
| `OIDC_AGENCY_ADMIN_GROUP_PREFIX` | agency admin group prefix (default `CloudTAKAgency`) |
| `AUTHENTIK_CHANNEL_GROUP_PREFIX` | channel group prefix (default `tak_`) |

### Infrastructure

`cdk/lib/constructs/cloudtak-oidc-setup.ts` provisions the Authentik OAuth2 provider and application
during deployment and returns the client ID/secret to the API container. Because CloudTAK runs the flow
itself, the ALB needs **no** OIDC listener action — it forwards normally, and `oidcSetup` exists purely
to create the IdP-side client.

Enable per environment in `cdk.json`:

```jsonc
"cloudtak": {
  "oidcEnabled": true,
  "oidcForced": true,
  "authentikAppSlug": "cloudtak",
  "syncAuthentikAttributesOnLogin": true,
  "oidcSystemAdminGroup": "CloudTAKSystemAdmin",
  "oidcAgencyAdminGroupPrefix": "CloudTAKAgency",
  "localOnlyAccounts": ["ckadmin"]
}
```

## SCIM user provisioning (optional)

CloudTAK accepts SCIM 2.0 at `/api/scim/v2` (`Users`, plus `Groups`, which are accepted but not stored).
Set `"scimEnabled": true` next to `oidcEnabled` to have the stack wire up both ends, with no admin steps:

| Piece | Where | What it does |
|---|---|---|
| Bearer token | Secrets Manager `TAK-<stack>-CloudTAK-ScimToken` | 48 generated characters, encrypted with the stack KMS key |
| CloudTAK API | container env `SCIM_ENABLED=true`, secret `SCIM_TOKEN` | Checks that token on every SCIM request. The `scim::*` settings in the database (and the admin UI) are ignored while this is on |
| Authentik | SCIM provider `TAK-CloudTAK-SCIM`, created by the OIDC setup Lambda | Sends Authentik users to `<CloudTAK URL>/api/scim/v2` with the same token. It is attached to the CloudTAK application as a backchannel provider |

The provider uses Authentik's own User and Group SCIM mappings, plus a `scim-exclude-ckadmin` mapping that
skips the built-in `ckadmin` account, which exists only in CloudTAK. Service accounts are not provisioned.
The Lambda runs on every deploy, so a rotated token is picked up on both sides together.

`scimEnabled` requires `oidcEnabled` (the stack refuses to synthesize otherwise). It defaults to off. On an
environment where the provider was created by hand, turning it on takes the provider over by name and
replaces its token. Expect a short run of `401`s from Authentik's sync between the Lambda and the new API
task going live.

## Certificate enrollment

On login, `AuthentikProvider.enrollUserCertificate()` provisions a TAK client certificate for new users
and renews it for existing users whose certificate is expired or expiring within 7 days. Two paths:

1. **M2M bearer exchange (preferred).** The user's own OIDC access token is exchanged at Authentik's
   token endpoint using the JWT-bearer client-assertion grant (RFC 7523), tying the exchanged token to
   that user's identity rather than a generic service account. The result is presented as a bearer token
   to TAK Server's `/Marti/api/tls/config` and `/Marti/api/tls/signClient/v2`. Requires TAK Server to
   trust the Authentik provider as a federated OIDC provider.
2. **Temporary-password fallback.** Sets a random temporary password on the Authentik account, logs into
   TAK Server with it, signs the CSR, then immediately overwrites the password to revoke it. Wrapped in a
   Postgres advisory lock keyed on the username, so concurrent logins for the same user cannot interleave
   and invalidate each other's credentials. See `docs/fork/README-CERT-ENROLLMENT-RACE.md`.

Enrollment failure is non-fatal: the user still gets a session, and enrollment retries on next login.

## Role and attribute sync

Authentik group membership maps to CloudTAK authorisation:

- `OIDC_SYSTEM_ADMIN_GROUP` → `system_admin`
- `OIDC_AGENCY_ADMIN_GROUP_PREFIX{N}` → `agency_admin: [N, …]`

User attributes map to TAK identity: `takCallsign` → `tak::callsign` (suffixed `" (Web)"` so a browser
session doesn't collide with the same person's ATAK/WinTAK device callsign), `takColor` → `tak::group`,
`takRole` → `tak::role`.

Sync runs on first login always, and on subsequent logins only when
`SYNC_AUTHENTIK_ATTRIBUTES_ON_LOGIN=true`. Attributes are written only when the IdP supplies a non-empty
value, so a missing attribute never clobbers an existing profile value.

**IdP-managed field locks.** When the IdP supplies callsign/group/role and sync is enabled, those fields
are read-only for the user: `ProfileControl.from()` returns `tak_callsign_locked` / `tak_group_locked` /
`tak_role_locked`, the callsign settings UI disables the inputs, and `PATCH /profile` drops locked keys
server-side. The lock flags live on `ProfileResponse` but not on `Profile`, so they're absent from
`ProfilePatchBody` and a user cannot unlock their own fields.

## Security considerations

- Tokens are exchanged **server-to-server over TLS**; the browser never receives an IdP token.
- The state parameter is a signed JWT with a 10-minute expiry and a `t: 'oidc'` type claim — this is the
  CSRF defence for the callback.
- The CloudTAK session is delivered in a URL **fragment**, keeping it out of access logs and history.
- `Login.vue` populates `storedUsername` before any login-consuming branch runs, so a browser previously
  used for a different IdP account cannot leak cached profile/WebSocket state into a new session.
- Client secret and Authentik admin token are held in Secrets Manager, never in environment plaintext.
- Temporary enrollment passwords are revoked immediately in a `finally` block.

## Why not ALB OIDC

The earlier ALB `authenticate-oidc` implementation was removed because delegating the handshake to the
load balancer caused structural problems:

- **JWT verification friction.** ALB signs `x-amzn-oidc-data` with ES256 using IEEE P1363 signatures
  (64-byte `r||s`), not the DER encoding JWT libraries expect, requiring custom verification plus
  per-region key fetching from `public-keys.auth.elb.{region}.amazonaws.com/{kid}`.
- **Cookie sharding.** ALB splits its session cookie across `AWSELBAuthSessionCookie-0..3`, overflowing
  nginx's default header buffers and forcing `large_client_header_buffers` increases just to stay up.
- **No logout endpoint.** Signing out meant manually expiring all four cookie shards.
- **No application control over the flow.** Because the ALB intercepts before CloudTAK sees the request,
  app-level behaviour (forced SSO with a local-admin bypass, correct session-setup ordering on redirect)
  was hard to implement correctly.
- **AWS-only.** It tied authentication to ALB, unusable for non-AWS deployments.

Upstream tracking: [#1171](https://github.com/dfpc-coe/CloudTAK/issues/1171) (ALB approach, closed by us
as abandoned) and [#661](https://github.com/dfpc-coe/CloudTAK/issues/661) (relying-party OIDC, the
approach implemented here). Authentik provider integration is
[#1180](https://github.com/dfpc-coe/CloudTAK/issues/1180).

## Troubleshooting

**SSO button missing** — check `GET /api/server/oidc` returns `oidc_enabled: true`; confirm
`OIDC_ENABLED` on the running task.

**`OIDC authentication is not fully configured`** — one of `OIDC_DISCOVERY_URL`, `OIDC_CLIENT_ID`,
`OIDC_CLIENT_SECRET` is unset. `oidcConfig()` throws before redirecting.

**`Invalid OIDC State`** — the state JWT expired (>10 min between clicking SSO and completing login) or
`SigningSecret` changed. Retry the login.

**Redirect URI mismatch at the IdP** — Authentik's configured redirect must exactly match
`{API_URL}/api/login/oidc/callback`. Verify what `cloudtak-oidc-setup` provisioned.

**Certificate not enrolled** — enrollment is non-fatal and logged. Look for `Enrolling TAK certificate
for OIDC user` and `[M2M]` lines; M2M failure falls back to the temporary-password path, which logs
separately. Requires `config.server.webtak` plus the Authentik token ARN.

**Callsign/group/role fields unexpectedly editable** — the lock markers are written only during the OIDC
callback. A session predating a deployment won't have them until the user logs out and back in.

**Settings changes silently reverting** — expected when the IdP owns the field and
`SYNC_AUTHENTIK_ATTRIBUTES_ON_LOGIN=true`. The UI should show a lock; if it doesn't, the cached profile
is stale (see above).

## Related documentation

- `docs/fork/README-OIDC.md` — patch-level detail
- `docs/fork/README-CERT-ENROLLMENT-RACE.md` — enrollment concurrency
- `docs/fork/FORK-DELTA.md` — authoritative patch status
