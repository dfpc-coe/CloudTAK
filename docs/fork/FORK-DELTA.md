# Fork delta: how TAK-NZ differs from upstream in `api/`, `app/` and `tasks/`

This document explains **why** each TAK-NZ change to the synced application code
exists. That rationale is the reason this file is worth keeping: it is the one
thing git cannot reconstruct for you.

## What is authoritative, and what is not

**The file inventory is not maintained here.** It is derived from git on demand,
so it can never be stale:

```bash
# every file where TAK-NZ differs from the synced upstream tree
git diff --numstat vendor/upstream...HEAD -- api/ app/ tasks/

# the full diff for one area
git diff vendor/upstream...HEAD -- api/stateless/routes/login.ts
```

> **Layout change at v13.102.0.** Upstream moved the web frontend from `api/web/`
> to a root-level `app/`, and `api/Dockerfile` to a root `Dockerfile` (the image
> now builds `api/` and `app/` side by side). TAK-NZ follows: `scripts/sync-upstream.sh`
> vendors `app/` too, and the CDK docker asset, workflows and scripts build from the
> repository root. Any `api/web/...` path in an older commit or README maps to
> `app/...`. The root `Dockerfile` and `.dockerignore` are **not** vendored (they sit
> outside `SYNC_PATHS`), so diff them against upstream's by hand on each sync.

At v13.70.0 that was **98 code files** plus **113 logo/icon assets** under
`app/public/logos/`. `vendor/upstream` tracks the synced upstream tree; the
version currently synced is in [`.upstream-version`](../../.upstream-version).

**This document is the rationale layer on top of that diff.** It is grouped by
concern rather than by file, because most changes span several files, and it is
keyed by the paths that exist *today*. When you move or rename something, update
the paths here.

> ### Why there are no `.patch` files any more
>
> Until v13.70.0 this directory also held 45 `.patch` files. They were deleted,
> and the reasoning is worth recording so nobody recreates them.
>
> They stopped being applicable long before they were deleted. Upstream syncs are
> a real 3-way merge via the `vendor/upstream` branch, so TAK-NZ changes are
> carried forward by git and never need reinstating — see
> [`docs/UPSTREAM-SYNC.md`](../UPSTREAM-SYNC.md). Their only remaining job was as
> a reference while resolving merge conflicts.
>
> They failed even at that. Measured at v13.70.0, when they were removed:
>
> - **8 of 45** still matched the tree under `git apply --reverse --check`.
> - **19 of 45** had *every* target path missing; 8 more were partly missing.
>   Upstream's restructure moved `api/lib/` into `api/common/` and
>   `api/stateless/lib/`, and `api/routes/` into `api/stateless/routes/`. Git's
>   merge followed those renames automatically. The patch headers did not.
>
> So at the exact moment you would reach for one, it pointed at a path that no
> longer existed — worse than nothing, because it looked authoritative.
>
> Earlier problems, recorded here because they explain why the model was wrong
> rather than merely out of date:
>
> - `apply-patches.sh` applied patches **sequentially**, but they were
>   **cumulative diffs from a shared baseline**. Those two models contradict each
>   other for any file touched by more than one patch, and 19 of 57 files were.
>   Running the script against its own baseline died at patch 031, because 030 had
>   already added those lines. Nothing in the repo ever invoked the script, and it
>   has been removed.
> - They were **incomplete as a recovery mechanism**: the fork modified 83
>   upstream files and the patches covered 57. The 26 with no patch included the
>   OIDC test suite, `ConfigLogin.vue`, `SettingsCallsign.vue`, `lib/style.ts` and
>   `lib/logos.ts`. Reinstating from patches alone would have silently dropped all
>   of them — the same class of failure that lost TAK certificate provisioning
>   during the v13 port.
>
> The deleted files remain in git history if you ever need one.

---

## Authentication and identity

The largest single area. TAK-NZ replaces upstream's authentication with an in-app
OIDC flow against Authentik, and provisions TAK certificates as part of login.

### In-app OIDC login

`api/stateless/routes/login.ts`, `api/stateless/lib/oidc.ts`,
`api/common/auth.ts`, `api/stateless/routes/server.ts`, `api/common/types.ts`,
`app/src/components/Login.vue`, `app/src/stores/app.ts`

An Authorization Code flow run by the application itself. `oidcParser()`,
`isOidcEnabled()` and `isOidcForced()` live in `api/common/auth.ts`;
`GET /server/oidc` exposes `oidc_enabled` / `oidc_forced` publicly so the login
page can decide what to render, backed by `oidc_enabled` on `ServerResponse`.

**The user is identified by `preferred_username`, falling back to `email`.**
`Profile.username` (the CloudTAK primary key for a user) used to be populated
unconditionally from the userinfo `email` claim, which both assumed every
Authentik account has an email attribute and assumed CloudTAK's own record key
should be that email rather than the Authentik `username`. Neither holds once
Authentik usernames diverge from email (some are not email-shaped, some accounts
have no email at all). `preferred_username` is used as-is if present (no
lowercasing — Authentik usernames are a case-sensitive unique field, so
lowercasing risks merging two distinct accounts), falling back to a lowercased
`email` only if `preferred_username` is absent. The callback still 400s if
userinfo returns neither claim.

This replaced an earlier ALB-based design where the load balancer performed the
OIDC handshake and injected JWT headers. Two consequences of that move are easy
to misread as unnecessary:

- - The OIDC callback issues its session through upstream's `issueSession()`
  (`api/stateless/lib/user/session.ts`), so an SSO login gets the same token pair as
  `POST /login` - including the single-use refresh token, which rides in the fragment
  payload and is persisted by `applySession()`. Upstream's DB-driven `oidc::*`
  settings (and their defaults) are deliberately not carried; SSO is env-driven.
- `Login.vue` reads the session from the `/login#sso=<payload>` URL **fragment**,
  not a query string, deliberately — a fragment stays out of server access logs
  and browser history.
- `getUsername()` / `storedUsername` are populated at the very top of
  `onMounted()`, before any login-consuming branch runs. They used to be set
  afterwards, which meant `applySession()`'s stale-profile-wipe check always saw
  `storedUsername=null` on a fresh SSO redirect. A browser previously used for one
  Authentik account could then leak its cached profile and WebSocket state into a
  different user's new session.

`OIDC_FORCED` still allows system admins to log in locally via
`/login?local=true`: the frontend skips the auto-redirect and shows the form, and
the backend returns 403 for non-admins, which the frontend converts into an SSO
redirect.

See [`README-OIDC.md`](README-OIDC.md) and
[`README-OIDC-FORCED.md`](README-OIDC-FORCED.md).

### TAK certificate enrollment, and the concurrency lock

`api/stateless/lib/authentik-provider.ts`, `api/stateless/routes/login.ts`

`enrollUserCertificate(username, takServerUrl)` sets a random temporary password
on the Authentik account, generates a TAK client certificate via
`APIAuthPassword` + `Credentials.generate()`, then revokes the temp password in a
`finally` block. The v13 port dropped certificate provisioning entirely, leaving
every OIDC user with an empty `auth` — restoring it is why this exists.

**The advisory lock is load-bearing.** Because the temporary password is set on
the *shared* Authentik account, two concurrent logins for the same user can
interleave: one request's password-set lands between the other's password-set and
its TAK Server login, and that login fails with a stale-credential `400`/`405`.
This was confirmed in production logs — a `499` aborted `/login/oidc` followed
5.6s later by a `302`-completing one, same user. The set-password → TAK-login →
revoke sequence is wrapped in `pg_advisory_xact_lock`, keyed on a hash of the
username, so it serialises correctly across ECS tasks.

**Certificate enrollment and attribute sync have separate `try`/`catch` blocks,
deliberately.** They used to share one, so a cert-enrollment failure aborted the
block before the callsign/group/role sync ran at all — the sync was never
reached, let alone failed. Do not recombine them.

**Both enrollment paths must resolve the real Authentik `username` before using
it as the certificate CN/clientUid.** The M2M path
(`enrollUserCertificateViaM2M`) now calls `findUserByEmailOrUsername()` up front,
same as the temp-password fallback always has — it previously built the CSR
`commonName` and `clientUid` directly from whatever identifier the OIDC callback
passed in (the `preferred_username`/`email` claim), which is not guaranteed to
equal the Authentik `username` field. Without the lookup, a person's certificate
subject would differ depending on which of the two enrollment paths happened to
succeed for them.

See [`README-CERT-ENROLLMENT-RACE.md`](README-CERT-ENROLLMENT-RACE.md).

### Authentik attribute sync

`api/stateless/routes/login.ts`, `api/stateless/lib/authentik-provider.ts`

Attribute sync is unconditional on first login (`profile.created ===
profile.updated`) so the "Welcome" wizard is suppressed for SSO users; later
logins respect `SYNC_AUTHENTIK_ATTRIBUTES_ON_LOGIN`.

TAK attributes (`tak::callsign`, `tak::remarks`, `tak::group`, `tak::role`) are
written via `ProfileConfig.commit()`. They were previously passed to
`Profile.commit()`, which silently dropped them because they are not columns on
the `profile` table.

`login()` returns `tak_role` from `attributes.takRole`.

**`tak_group`/`tak_role` are validated against the `TAKGroup`/`TAKRole` enums
before they leave `login()`, not passed through verbatim.** Authentik
attributes (`takColor`, `takRole`) are admin-editable free text with no
enforcement that they match CloudTAK's enum values. An invalid value used to
flow straight through into `ProfileConfig` on every login — `tak_group`/
`tak_role` are stored as free text, so the write always succeeded — and broke
that user's account: `GET /api/profile`'s response schema validates both
fields against the enum, so once a bad value was stored every subsequent
profile fetch failed with a 400, and the map (which depends on a successful
profile fetch during boot) could never load for that user. This happened in
practice from an externally-set `takColor` attribute of the literal string
`"None"`. `asTakGroup()`/`asTakRole()` (exported for the unit tests in
`api/test/authentik-provider.test.ts`) now drop an attribute that isn't a
recognised enum value and log the rejection, rather than writing it — `login.ts`'s
existing "only set if truthy" logic then leaves any previously-synced valid
value untouched instead of overwriting it with garbage.

**On the callsign suffix:** `login()` used to append `" (Web)"` to
`attributes.takCallsign`. That was **removed at v13.70.0** to match upstream. The
`" (Web)"` suffix is deliberately *kept* on the certificate `clientUid`, which is
a different identifier and prevents a browser session's certificate colliding
with the same person's device certificate.

### Authentik service accounts and LDAP

`api/stateless/lib/authentik-provider.ts`, `api/stateless/routes/ldap.ts`,
`api/stateless/routes/connection.ts`, `api/stateless/routes/agency.ts`,
`app/src/components/ETL/Connection/AgencyBadge.vue`

- `deleteMachineUser()` deletes safely behind a `machineUser: true` guard.
- All three LDAP routes fall through to Authentik when CoTAK is not configured.
- On-demand Authentik profile ID lookup when `profile.id` is null.
- Agency changes on a connection are restricted to system admins.
- `AgencyResponse` gains an optional `description` field.

### Certificate lifecycle

`api/stateless/lib/cert-health.ts`, `api/stateless/routes/connection.ts`,
`api/stateless/routes/connection-layer.ts`

`needsCertRenewal()` reports missing, invalid, or expiring-within-N-days.
Connection delete revokes the TAK certificate and deletes the Authentik service
account. `POST /connection/:id/cert/renew` and `GET /layer/:id/health` expose
renewal and health. Renewal authenticates by password rather than by the
certificate being replaced, which may already be revoked.

See [`README-CERT-RENEWAL.md`](README-CERT-RENEWAL.md).

### Auth-failure logout

`app/src/utils/events.ts`, `app/src/stores/map.ts`,
`app/src/workers/atlas.ts`, `app/src/stores/app.ts`

A `Session_Logout` event redirects to `/api/logout` from the main thread on
auth or connection error. `appStore.logout()` also redirects there to expire
cookies.

See [`README-AUTO-LOGOUT.md`](README-AUTO-LOGOUT.md).

---

## Configuration and deployment

### Server configuration and admin provisioning

`api/common/config.ts`, `Dockerfile`, `api/nginx.conf.js`

The root `Dockerfile` is upstream's with one change: `npm ci` instead of
`npm install` for both `api/` and `app/`, so a commit always builds against its
committed lockfiles (an `npm install` once floated maplibre-gl to 6.4.1 and broke
vector hillshading with no commit of ours to blame).

`CLOUDTAK_Server_*` environment seeding, `MediaSecret` / DynamoDB / VPC config
fields, and admin profile provisioning. Also `tileOriginHostnames`, parsed from
`CLOUDTAK_TILE_ORIGINS`.

`api/nginx.conf.js` generates the Content-Security-Policy header, including
`frame-ancestors` and the embedding allowlist, and injects the trusted tile CDN
origins into `connect-src` / `img-src` at container start.

The `large_client_header_buffers` increase was **removed** once OIDC moved
in-app — it existed only for large ALB-injected OIDC cookies.

See [`README-ADMIN-ENV-VARS.md`](README-ADMIN-ENV-VARS.md).

### Sibling-stack export names (webhooks and inbound email)

`api/stateless/lib/aws/lambda.ts` (`Lambda.siblingExport`),
`api/test/lambda-sibling-export.test.ts`, `api/test/connection-layer-email.srv.test.ts`,
`cdk/lib/constructs/mail.ts`, `cdk/lib/constructs/webhooks.ts`

Each layer's CloudFormation stack imports values exported by the stack that owns
webhooks and inbound email (`ApiId`, invoke role, SSM layer prefix). Upstream
derives the export name with
`config.StackName.replace(/^tak-cloudtak-/, 'tak-cloudtak-webhooks-')`.
TAK-NZ's stack is `TAK-<env>-CloudTAK`, which that lowercase prefix never matches,
so the replace was a no-op and the import named an export nothing publishes
(`TAK-Dev-CloudTAK-api`): **layer stacks with webhooks or email enabled could not be
created**. This affected the webhook imports too, not just mail.

`Lambda.siblingExport(StackName, 'webhooks' | 'mail', suffix)` keeps upstream's
derivation for `tak-cloudtak-*` names and otherwise returns
`<StackName>-<sibling>-<suffix>`, which is what the CDK exports:
`TAK-<Env>-CloudTAK-webhooks-api`, `-webhooks-role`, `-mail-layer-prefix`.
The email srv test now expects `test-mail-layer-prefix`.

**On sync:** re-apply if `git diff vendor/upstream...HEAD -- api/stateless/lib/aws/lambda.ts`
shows the five `importValue(...)` calls back in the `.replace(...)` form.

### Inbound email infrastructure (CDK only)

`cdk/lib/constructs/mail.ts`, `cdk/lib/lambda/mail-router.cjs`,
`cdk/lib/constructs/cloudtak-api.ts`, `cdk/lib/cloudtak-stack.ts`

Port of upstream `cloudformation/mail.template.js` (v13.102.4): SES Mail Manager
ingress point, rule set, archive and traffic policy, a mail bucket, the router
Lambda and its alarms, plus the `MAIL_DOMAIN` env var, the API task role's SSM
statement and the ETL role's `s3:GetObject` on the bucket. The router code is a
verbatim copy of upstream `cloudformation/lib/mail-lambda.cjs`; **diff it against
upstream on each sync**. Differences from upstream are all naming: the router may
invoke `TAK-<Env>-CloudTAK-layer-*` (not `tak-cloudtak-<env>-layer-*`), the layer
prefix is `/TAK-<Env>-CloudTAK/mail/layer/`, and the ETL grant is attached to
`TAK-<Env>-CloudTAK-etl` from the stack. It creates DNS records
`MX mail.<hostname>.<zone>` and `TXT _dmarc.mail.<hostname>.<zone>`. See
[`../EMAIL.md`](../EMAIL.md) for the flow and security notes (the ingress point is
a public, OPEN SMTP endpoint).

### CloudTAK web plugins (WEB_PLUGINS)

`app/package.json`, `app/package-lock.json`, `cdk/cdk.json`, `cdk/lib/utils/web-plugins.ts`,
`cdk/lib/cloudtak-stack.ts`, `.github/workflows/demo-build.yml`,
`.github/workflows/production-build.yml`

The root `Dockerfile` already accepts a `WEB_PLUGINS` build arg and `api/bin/plugin.ts`
(unchanged from upstream) clones each listed repository into `app/plugins/<name>` after
`COPY app/` and before `npm run lint && npm run check && npm run build`. TAK-NZ only
adds the plumbing to set that arg and the dependency the first plugin needs.

- **`pdfjs-dist` 4.10.38 (exact pin) in `app/package.json` and the lockfile.** Required
  by the `cloudtak-plugin-rubbersheet` plugin (TAK-NZ fork of
  `AdventureSeeker423/cloudtak-plugin-rubbersheet`). `npm ci` runs before plugins are
  cloned, so a plugin cannot add its own dependencies; they must already be in the app
  lockfile. The lockfile diff is `pdfjs-dist` plus its optional `@napi-rs/canvas*`
  packages only. **On sync:** if `app/package.json` or the lockfile conflicts, keep
  upstream's, re-add `pdfjs-dist@4.10.38` with `npm install --save-exact`, and check
  `git diff` shows no unrelated lockfile changes.
- **`cloudtak.webPlugins` in `cdk/cdk.json`** (TAK-NZ only, per environment). `dev-test`
  lists the rubbersheet fork, `cloudtak-plugin-weather` and `cloudtak-plugin-sar`; `prod` is `""`. The stack resolves the effective value
  as `--context WebPlugins` (or `webPlugins`), then the `WEB_PLUGINS` env var, then
  `cdk.json`, validates it (https GitHub URLs only) and adds it to the main
  `CloudTAKDockerAsset` build args only when non-empty, so images without plugins keep
  the same asset hash.
- **Build workflows.** `demo-build.yml` reads the `dev-test` value and
  `production-build.yml` the `prod` value, validates it with the same regex, folds it
  into the image tag hash only when non-empty and passes `--build-arg WEB_PLUGINS`
  to the main image build. `demo-build.yml` also triggers on `cdk/cdk.json` changes.
- **No change to `api/bin/plugin.ts` or the `Dockerfile`.** It clones the plugin's
  default branch tip with `--depth 1`; there is no ref pinning.

See [`../DEPLOYMENT_GUIDE.md`](../DEPLOYMENT_GUIDE.md#installing-cloudtak-plugins-web_plugins)
for how to use it.

Plugins that put controls at the bottom of the map share one convention so their bars do not cover each other (yield, minimize, selector dot). See [`PLUGIN-PANELS.md`](PLUGIN-PANELS.md).

### Weather plugin relay (`/api/weather`)
`api/stateless/routes/weather.ts`, `api/stateless/lib/weather/relay-*.ts`,
`api/test/weather-relay-lib.test.ts`, `api/test/weather.srv.test.ts`, `api/test/weather-images.ts`,
`api/test/fixtures/get_schema.json`, `cdk/cdk.json`, `cloudtak-config.env.example`,
`scripts/set-weather-proxy-config.sh`

New files only, except the schema fixture and the `cdk.json` edits (plus `cloudtak-config.env.example`
and the docs). The relay serves `GET /api/weather/status`
and `GET /api/weather/tile/:z/:x/:y.png` for the `cloudtak-plugin-weather` plugin and
fetches tiles from the weather-proxy with a server-side key.

- **Tile image type.** The relay serves PNG or WebP tiles. Rainbow `clouds` tiles are WebP, but
  the weather-proxy labels every tile `image/png`, so the relay checks the image bytes (PNG or
  WebP), sends the detected `Content-Type` (the route path keeps `.png`) and answers 502 for
  anything else.
- **Snapshots.** `relay-snapshot.ts` (new) asks the proxy's `GET /snapshot?layer=` for the newest
  snapshot of each layer (Rainbow publishes `clouds` later than rain). `GET /api/weather/status`
  keeps its five fields and adds `latest` (`{snapshot, source: 'rainbow' | 'computed'}` per layer,
  omitted when the relay is disabled), `stepSeconds: 600` and `windowSeconds: 7200`. The lookup is
  cached 30 s per layer, shared by concurrent callers, skipped while the upstream is paused, and
  waits at most 2.5 s; any failure (older proxy answering 404, 400, 5xx, bad JSON, timeout) gives
  `source: 'computed'` and the status still answers 200. The tile route accepts a snapshot from
  `latest - 7200` up to any newer value: a newer one is served as the layer's latest, an older one
  is `400 snapshot out of range`. The cache key holds the effective snapshot, so a client clock
  that runs ahead of a lagging layer shares one cache entry and one upstream call.
- **Cache policy.** A tile is immutable only when the request named its snapshot (a 10-digit
  `snapshot` equal to the effective one, so not absent, not `latest`, not clamped to a lagging
  layer) and the upstream `X-Weather-Snapshot` equals it (and the answer is not a fallback, error
  or `no-store`): relay TTL 7200 s and `Cache-Control: private, max-age=3600`. A cache hit gives
  `max-age=3600` only to a pinned request; an unpinned request on the same entry gets
  `max-age=600`, and an entry filled by an unpinned request keeps a 600 s TTL. Without the header
  (older proxy) or with a different value the TTL stays 600 s with `max-age=600`; fallback tiles are not cached at the relay and get
  `max-age=30`. An upstream `400` is now answered as `400` (was `502`). The audit log line also
  has `snapshot` and `immutable`. Upstream-owned files are untouched; the schema fixture does not
  change because the new status fields are optional response fields.
- **Schema fixture.** `api/test/fixtures/get_schema.json` gained the two weather keys,
  because `schema.srv.test.ts` deep-equals it against `GET /api/schema`. **On sync:**
  re-run that test with `UPDATE=1` and keep upstream's keys.
- **Env vars.** `WEATHER_PROXY_URL`, `WEATHER_PROXY_KEY`, `WEATHER_RATE_LIMIT`, read from
  the environment (S3 config file). There are no `FullConfig` keys, so `types.ts`,
  `defaults.ts`, `config.ts` and `AdminConfig.vue` stay identical to upstream and cannot
  conflict on sync.
- **`cdk.json`.** `dev-test` `webPlugins` also lists
  `https://github.com/TAK-NZ/cloudtak-plugin-weather.git`.
- **Licence.** The plugin repo is AGPL-3.0-only because its `lib/host.ts` imports
  `app/src/std.ts`.
- **Upstream pressure.** The weather-proxy allows 600 requests per minute per client IP and
  re-arms its counter TTL on every allowed hit. The relay caps upstream fetches at 500 per
  minute per API task. When the proxy answers 429, or that cap is hit, the task stops calling
  the proxy for 5 to 120 s (the proxy's `Retry-After`, default 30 s). In that time cache hits
  are still served and cache misses get `429` with `Retry-After` and `Cache-Control: no-store`.
  The pause is in memory and per process. `WEATHER_RATE_LIMIT` (per user) is unchanged.
- **Session token in URLs and access logs.** The plugin loads tiles through MapLibre, which
  cannot send an `Authorization` header, so tile URLs carry `?token=<session token>`. The
  platform access log (`morgan 'combined'` in `@openaddresses/batch-schema`, which skips only
  2xx and 3xx responses) writes the full URL of every other response, so a 401, 403, 429 or
  502 tile response would log a valid session token. Other CloudTAK tile routes already work
  this way. The upstream-owned logger is not edited. Instead `weather.ts` has a `/weather`
  middleware that hands the access log a copy of `req.originalUrl` with `token=***` and keeps
  the real URL in `res.locals.weatherUrl` for the handler (covered by `weather.srv.test.ts`
  test 19). Tokens are session tokens, so short sessions limit the exposure of anything logged
  elsewhere, for example by a proxy in front of the API. A tile loader that sends an
  `Authorization` header would remove the query token.
- **Operator script.** `scripts/set-weather-proxy-config.sh` (new file, TAK-NZ only; `scripts/**`
  is not in the CDK image asset) writes the three variables into the live `cloudtak-config.env`
  in the BaseInfra config bucket, with a local backup, and never prints the key.

See [`../DEPLOYMENT_GUIDE.md`](../DEPLOYMENT_GUIDE.md#weather-plugin-cloudtak-plugin-weather)
for setup.
### SAR plugin relay (`/api/sar`)
`api/stateless/routes/sar.ts`, `api/stateless/lib/sar/relay-*.ts`,
`api/test/sar-relay-lib.test.ts`, `api/test/sar.srv.test.ts`,
`api/test/fixtures/get_schema.json`, `cloudtak-config.env.example`
New files only, except the schema fixture, `app/plugin.ts` (the `feature.add` / `feature.remove`
entry below), `cloudtak-config.env.example` and the docs. The
relay serves `GET /api/sar/status`, `POST /api/sar/travel-time` and `POST /api/sar/tarr` for the
`cloudtak-plugin-sar` plugin and calls the SAR engine (`POST {SAR_SERVICE_URL}/travel-time` or
`/tarr`) with a server-side key in
the `x-api-key` header. It follows the weather relay: same config parsing, the weather
`FixedWindowLimiter` (imported, not copied), `@tak-ps/node-safeurl` for the upstream call, and an
audit line. Apart from `app/plugin.ts`, upstream-owned files are untouched.
- **Endpoints.** `GET /api/sar/status` returns `{apiVersion: 1, enabled, modes}` (`modes` is
  `['travel-time', 'tarr']` whatever the configuration; a plugin that gets no `modes` treats the
  relay as travel-time only) and never calls the engine (60 calls per user and minute). `POST /api/sar/travel-time` takes
  `{ipp: {lat, lng}, speed_kmh, intervals_hours, radius_km?}`. Bounds: latitude -48 to -33.5,
  longitude 165.5 to 179.5, speed 0.1 to 10 km/h, 1 to 8 bands of 0.25 to 24 hours, radius 1 to
  30 km. Both need a user session. The platform validator coerces number strings and drops
  unknown keys; the relay rebuilds the engine request from the parsed values (bands sorted and
  unique), so nothing else is forwarded.
- **TARR.** `POST /api/sar/tarr` takes `{ipp: {lat, lng}, profile, ecoregion?, terrain?}` with the
  same `ipp` bounds. `profile` is 1 to 40 characters from `A-Za-z0-9 ()-`; `ecoregion` and
  `terrain` are 1 to 20 letters. The relay does not know the profile list (it would drift); the
  engine checks membership and answers 400, which the relay reports as
  `The SAR service rejected the request`. The request has no radius, speed or interval: the
  engine derives them. The relay rebuilds `{ipp, profile, ecoregion?, terrain?}` from the parsed
  values and calls `{SAR_SERVICE_URL}/tarr`. It uses the same 8 KB cap, error shape and mapping
  as travel-time. A 200 is accepted only with `mode: 'tarr'`; a travel-time answer on the TARR
  route (or the reverse) is a 502.
- **Order in the POST handlers.** Session, configuration (502 when disabled), per-user rate limit
  (`SAR_RATE_LIMIT`, default 6 a minute, `429` with `Retry-After`), engine call. Travel-time and
  TARR share one limiter, so one call of each uses two of the allowed calls.
- **Answers.** Every response carries `Cache-Control: no-store`. The engine's answer is mapped as
  follows and engine messages are never forwarded, except the 422 message:

  | Engine | Relay |
  |---|---|
  | 200 with `status: 'ok'`, `mode: 'travel-time'` and a `FeatureCollection` | 200 with only `status, mode, contours, parameters, bbox, warnings, data, attribution, disclaimer, timings_s` |
  | TARR: 200 with `status: 'ok'`, `mode: 'tarr'` and a `FeatureCollection` | 200 with the same keys plus `calibration` |
  | 200 with invalid JSON or another shape | 502 `SAR service unavailable` |
  | 422 with a string `message` | 422 with the message (control characters removed, at most 300 characters) plus `code` (lowercase token, for example `area_too_dense` for dense city requests), `suggested_radius_km` (finite, 1 to 30) and `suggested_max_hours` (finite, 0.25 to 24), each only when valid. Other upstream fields are dropped. A 422 without `code` (sea, lake, out of range) passes through the same way |
  | 422 not parseable | 502 |
  | 400 | 400 `The SAR service rejected the request` |
  | 413 | 413 `Request too large` |
  | 401, 403, 404, 405, other 4xx, redirect, network error, blocked address, relay disabled | 502 `SAR service unavailable` (401 and 403 also log that the key was rejected, at most once a minute) |
  | 500 | 500 `Analysis failed. Try again, or try a smaller area.` |
  | 502, 503, 504, timeout, HTML error page | 504 `SAR service timed out` with `Retry-After: 30` |
  | relay rate limit | 429 `Too many SAR requests` with `Retry-After` |

- **Timeout.** The relay waits 70 s for the engine (a cold calculation takes up to about a
  minute). The ALB idle timeout is 4000 s, so no CDK change is needed.
- **Body cap.** A `/sar` router middleware answers `413` when `Content-Length` or the re-serialised
  body is over 8192 bytes. The platform body parser in `stateless/lib/server/api.ts`
  (upstream-owned, `limit: 50`) still reads up to 50 MB before this runs. **Known limitation:**
  the cap protects the engine, not the API's memory.
- **Audit line.** `console.info(JSON.stringify({type: 'sar', username, status, ms, speed_kmh,
  intervals, radius_km, upstream}))`. `intervals` is the number of bands and `radius_km` the
  requested radius (or null). The TARR line is
  `{type: 'sar', mode: 'tarr', username, status, ms, profile, upstream}`. Neither contains the
  coordinates, the key, a session token or an engine body. Strings that are logged pass through a redaction that removes the key, `x-api-key`
  values and bearer tokens.
- **Schema fixture.** `api/test/fixtures/get_schema.json` gained the three SAR keys by hand
  (`schema.srv.test.ts` deep-equals it against `GET /api/schema`). The fixture is already stale on
  `main` (basemap sprite and certificate renew routes), so that test fails before and after this
  change; the failing diff contains no `/sar/` line. **On sync:** re-run that test with
  `UPDATE=1` and keep upstream's keys.
- **Env vars.** `SAR_SERVICE_URL`, `SAR_SERVICE_KEY`, `SAR_RATE_LIMIT`, read from the environment
  (S3 config file) on every call. No `FullConfig` keys, so `types.ts`, `defaults.ts`, `config.ts`
  and `AdminConfig.vue` stay identical to upstream. There is no operator script.
- **`cdk.json`.** `dev-test` `webPlugins` also lists
  `https://github.com/TAK-NZ/cloudtak-plugin-sar.git`. The image build clones the default branch of
  the plugin repo, so the plugin must be merged there before the image is built.
See [`../DEPLOYMENT_GUIDE.md`](../DEPLOYMENT_GUIDE.md#sar-travel-time-plugin-cloudtak-plugin-sar)
for setup.
### Plugin API: `feature.add` and `feature.remove`
`app/plugin.ts`, `app/src/test/plugin-api.spec.ts`
`PluginAPI.feature` had only the read side (`list`, `stream`). The SAR plugin turns its result
into map features that users can move into a Data Sync or a data package, so it needs a write
side. An additive block in `get feature()` (plus two imports and `export type { InputFeature }`)
adds:
- `add(features, {mission?})`: deep-copies the features, sets `origin = {mode: 'Mission', mode_id}`
  on each copy when `mission` is given (the user must be subscribed to that Data Sync, otherwise
  the store rejects), calls `mapStore.worker.db.addAll(copies, {authored: true})`, then
  `mapStore.refresh()`. `authored` is what the draw tool uses: the features are saved to the
  profile and, in a Data Sync, pushed to the TAK Server.
- `remove(ids)`: `mapStore.worker.db.remove(id)` for every id; if any fails, the first failure is
  thrown after all were tried.
- **Rejected alternative.** Importing `useMapStore` by relative path from the plugin, as Rubber
  Sheet imports host files. It needs no host change, but the plugin would depend on the shape of
  the Comlink worker and on an initialised Pinia, and every plugin test would have to mock both.
- **On sync:** keep the block; if upstream adds its own write API, switch to it.

---

## Basemaps, tiles and terrain

### TileJSON, sprites and CSP

`api/common/types.ts`, `api/stateless/routes/basemap.ts`,
`api/stateless/lib/interface-basemap.ts`, `app/src/base/overlay-class.ts`,
`app/src/stores/map.ts`

Adds `sprite` / `glyphs` to the `TileJSON` schema and merges the `tilejson` blob
into PMTiles and non-URL TileJSON responses. Upstream's `sprite` / `glyphs` are
stripped to prevent CSP leakage.

The LINZ topographic sprite is loaded **directly** from
`basemaps.linz.govt.nz`, which serves `Access-Control-Allow-Origin: *`, rather
than proxied through the API. The tile proxy is bypassed in the TileJSON endpoint
when the basemap hostname is in the trusted set. An earlier design proxied the
sprite through `GET /api/basemap/sprite/:name.json|.png` and registered sprites
per overlay reactively; that caused timing races and was replaced by loading the
sprite unconditionally in the map init style.

The Open Waters chart sprite (`freenauticalchart`, from `tiles.openwaters.io`) is loaded the
same way, and `IconManager` skips `freenauticalchart:` image ids like it does
`linz-topographic:` ones. The matching style layers are CloudTAK `styles` arrays in
`config/Seamap_Vector_Map_Styles/`: `Seamap_Overlay_CDN.migrated.json` (the `seamap` source,
55 layers) and `Seascape_Overlay_CDN.migrated.json` (the Seascape layers from Seamap's own
`style.json`, 5 layers, which is what the Open Waters viewer draws). Both are zxy/mvt/vector
overlays that must be set to Tile Size 512, because at the form default of 256 MapLibre
evaluates zoom one level deeper. `tiles.openwaters.io` must be in `CLOUDTAK_TILE_ORIGINS`, or the
browser blocks the sprite. Labels use `Open Sans Bold`, the only face declared in `font-faces`.
The depth shading and hillshade layers are omitted, because the shared `__terrain__` source
would apply them to the land DEM. Setup is in
[`OPEN-WATERS-OVERLAYS.md`](../OPEN-WATERS-OVERLAYS.md).

`vector_layers` is emitted **only when actually known**. Upstream's
`[{id:'out'}]` default is CloudTAK's ETL convention and is wrong for proxied LINZ
tiles; there is no `vector_layers` column, so it always fired. v13.26.0 emitted
none. Cosmetic — MapLibre warns and still renders — but the ~285 console errors
masked a real hillshade bug.

See [`README-SPRITE-DUPLICATE.md`](README-SPRITE-DUPLICATE.md).

### Hillshade and terrain sources

`api/stateless/lib/interface-basemap.ts`, `app/src/base/overlay-class.ts`

`ensureTerrainSource()` and the `__terrain__` sentinel let a hillshade layer
reference a raster-dem source that may not exist yet; `OverlayManager` re-attempts
deferred hillshade layers when the source arrives, and
`BasemapProtocol.isValidStyle()` accepts hillshade layers using either.

**The source must be added by passing the TileJSON `url` to `addSource()`, not a
spread TileJSON object.** MapLibre 6.4.1 rejects unknown properties
(`tilejson`, `version`, `name`, `description`, `scheme`, `center`, `actions`), and
`Style.addSource()` returns early when it does — so `__terrain__` never existed
and relief shading silently vanished.

Related: `initOverlays()` calls `this.updateBackground()` after
`OverlayManager.appendLoaded(...)`, because `visibleBasemaps()` reads `loaded`,
which was still empty when `addLayers()` ran — that was the missing ocean fill.

Layer-id prefixing is done server-side since v13.113.0, by
`ProfileOverlayControl.normalizeStyles()` in `api/common/control/profile-overlay.ts`
(upstream removed the client `Overlay.replace()` / `create()` save path, and with it
our `namespaceStyles()` helper). It is idempotent, so re-selecting a basemap cannot
grow ids like `23-23-23-Background`. **TAK-NZ change:** upstream rewrites `source`
on every non-`background` layer; we also skip `hillshade`, because those layers
point at the shared `__terrain__` raster-dem source rather than the overlay's own.
Without that exemption a stored hillshade layer is re-pointed at a source it cannot
use. Drop it if upstream ever supports a shared terrain source.

### Server-side elevation

`api/stateless/lib/terrain.ts`, `api/stateless/lib/interface-basemap.ts`,
`api/stateless/routes/search.ts`,
`app/src/components/CloudTAK/Query/Elevation.vue`

`Elevation.vue` used MapLibre's `queryTerrainElevation()`, which only returns a
value once 3D terrain rendering is active — a GPU-heavy mode not otherwise needed
for a one-off lookup, and reported to crash some hardware.

`BasemapProtocol.tileBuffer()` fetches a single tile's bytes in-process by reusing
each protocol's existing `_tile()` behind a minimal in-memory `Response` stand-in,
so it works for any protocol with no per-protocol changes. `getElevation()`
resolves the configured `map::terrain` basemap, computes the covering tile and
pixel via `pointToTileFraction()`, decodes with `sharp`, and applies the Mapbox
Terrain-RGB or Terrarium formula according to the basemap's `encoding`. Wired into
`GET /search/reverse/:longitude/:latitude/elevation`, falling back to the
client-supplied `elevation` param when no terrain basemap is configured.

See [`README-SERVER-SIDE-ELEVATION.md`](README-SERVER-SIDE-ELEVATION.md).

### Query Mode tides
`api/stateless/lib/{tides,coast,coastline-data}.ts`, `api/stateless/routes/search.ts`,
`scripts/build-coastline.mjs`,
`api/derived-types.d.ts`, `api/test/fixtures/get_schema.json`,
`app/src/components/CloudTAK/Query/Tides.vue`,
`app/src/components/CloudTAK/QueryView.vue`, `app/src/types.ts`
Query Mode shows predicted tides for the tapped point: the nearest station, the
next high and low, the current level and trend, and a chart with a table of
highs and lows. Predictions come from the Open Waters tides API
(`https://api.openwaters.io/tides`, harmonic constituents via Slackwater; for NZ
the data is LINZ, CC BY 4.0, so the station's `attribution` text is shown).
- **Server side, not browser direct.** `GET /search/reverse/:longitude/:latitude/tides`
  fetches upstream, so the CSP `connect-src` needs no new origin and the result is
  cached in-process (30 minutes, keyed by 0.01 degree coordinates, units and the
  hour-truncated window start, at most 500 entries).
- **Distance cutoff.** The upstream API always returns the nearest station, even
  2000 km away. `MAX_STATION_DISTANCE_KM` (200) in `tides.ts` turns a farther
  station into `tides: null`, which the panel shows as "No Tide Station Nearby".
  Stations between `NEAR_STATION_KM` (50, in `Tides.vue`) and 200 km are shown
  with a "Distant station" warning, because on a sparse open coast (the NZ West
  Coast has a station every 150 km or more) a far station beats no answer.
  Upstream failures are a 502, not `null`.
- **Units.** The client passes the user's `display_elevation` (`meter` or `feet`)
  as `units`; the server maps it to the upstream `meters` or `feet`. Station
  distance follows `display_distance`.
- **Window.** 12 hours before to 36 hours after now (about 290 ten-minute points).
  The 24 hour chart view is a slice of that.
- **Times** are shown in the station's IANA time zone by default, with a toggle to
  the device zone. A missing or invalid zone falls back to UTC, as in the Sun
  Phase section.
- The chart uses the existing `chart.js` dependency with a linear time axis (there
  is no date adapter) and a small inline plugin for the now line and the
  high/low labels.
- **Inland points have no Tides section.** The station distance cannot tell a point in the
  middle of an island from one far out at sea, so `coast.ts` measures the distance to the
  sea instead. A point on land more than `INLAND_KM` (10) from the coast gets
  `{ tides: null, inland: true }` without calling the tide service, and `Tides.vue` renders
  nothing. The section is also held back for 400 ms while it loads, so a quick inland
  answer does not flash a spinner. Coastal or offshore points without a station still show
  "No Tide Station Nearby".
- **Coastline data.** `coastline-data.ts` is generated by `scripts/build-coastline.mjs` from
  Natural Earth 1:10m land (public domain): the polygons that lie wholly inside the
  south-west Pacific and Australia, simplified to about 100 m (about 1 MB; the whole layer is
  10 MB). It is a TypeScript module because `tsc` does not copy a JSON file into `dist/`.
  **It fails open:** a point not inside a kept polygon (open water, harbours, Antarctica,
  Europe...) is never inland, so the tides still show. Tapping a harbour or the sea gives a
  distance of 0. The generalised coastline reads small estuaries as land, so Christchurch's
  centre measures 9.8 km from the sea, just under the threshold.
- **Same card as the weather area.** The tide card is a `TablerSlidedown` with click anywhere
  to expand and collapse, as `Weather.vue` is, instead of its own button, chevron and box.
  The slidedown keeps the expanded content in the DOM, so the chart renders whenever it has
  data rather than waiting for an expand flag.
- **Short footer.** The visible note is "Predictions only. Not for navigation." The licence
  text the service returns (it differs by source: LINZ stations carry LINZ's wording) is
  required by the data licences, so it is kept behind a "Data sources" toggle, not rewritten.

### PMTiles task

`tasks/pmtiles/**`

Elevation and profile route additions with their test suites, plus
`tasks/pmtiles/src/lib/auth.ts`. Note the LINZ vector style JSON files in
`LINZ_Vector_Map_Styles/` prefix every `fill-pattern`, `line-pattern` and
`icon-image` with `linz-topographic:` to match the sprite id MapLibre assigns to
non-default named sprites.

### Basemap tile proxy: upstream User-Agent, Referer and errors

`api/stateless/routes/basemap.ts`, `api/stateless/lib/basemap/{zxy,hosted}.ts`,
`tasks/pmtiles/routes/basemap.ts`, `tasks/pmtiles/lib/basemap.ts`,
`tasks/pmtiles/lib/basemap/protocol.ts`

Some tile servers answer a browser User-Agent with no Referer with a 403
(`tiles.openrailwaymap.org` does). The proxy used to forward the end user's
User-Agent and relay that 403, which looked like a CloudTAK auth failure.

- The upstream request carries `User-Agent: CloudTAK (+<API_URL>)` and
  `Referer: <API_URL>/` instead of the client's User-Agent. The API appends its
  package version to the User-Agent. The tile server does not, as its own
  `package.json` is `0.0.0`.
- An upstream status of 400 or above, other than 404, becomes a 502 naming the
  upstream host. The upstream body is never relayed.

**Two copies must stay in step.** Since v13.117.0 proxied tiles are served by the
tile server (`BASEMAP_TILES_URL`), not the API, so the API route above only
serves clients that still use the old URL. The v13.117.0 sync lost this fix for
the tile server until it was ported there. Upstream has the bug in both places
and has not fixed it, so check both after a sync. On the tile server the
headers come from `Basemap.upstreamHeaders()` and the 502 mapping lives in
`BasemapProtocol.pipe()`.

Tests: `api/test/basemap-zxy-proxy.test.ts`, `tasks/pmtiles/test/basemap-proxy.test.ts`
and the two header and 502 cases in `tasks/pmtiles/test/basemap-tiles.srv.test.ts`.

---

## Icons, sprites and styling

`api/stateless/routes/icons.ts`, `api/stateless/lib/logos.ts`,
`api/common/style.ts`, `app/src/stores/modules/icons.ts`,
`app/public/logos/**`

- An iconset with no spritesheet data returns an empty sprite rather than a 400.
- The sprite-key regex handles icon filenames containing dots.
- `GET /api/icon` sends `ETag` and `Cache-Control: private, no-cache` when
  filtered to a single iconset, so browsers revalidate and get a 304 instead of
  re-downloading up to 10 MB of base64 icon data after an IndexedDB clear.
  Unfiltered requests get `no-store`. It was `public, max-age=3600` before: the
  URL does not change when an iconset is re-imported or edited, so the browser
  kept serving the old icon list for up to an hour (a hard refresh was needed),
  and `public` allowed shared caches to store a per-user response.
- Large raster icons are scaled to 32px max via canvas, so an oversized icon
  cannot fill the screen.
- 113 logo and app-icon assets are TAK.NZ branding.

See [`README-EMPTY-ICONSET-FIX.md`](README-EMPTY-ICONSET-FIX.md) and
[`README-SPRITE-ICON-DOTS.md`](README-SPRITE-ICON-DOTS.md).

### ATAK icon set

`app/src/stores/modules/menu.ts`,
`app/src/components/CloudTAK/DrawTools.vue`,
`app/src/components/CloudTAK/util/DrawOverlay.vue`,
`app/src/components/CloudTAK/Inputs/{RangeInput,RangeRingsInput,GeoJSONInput}.vue`

ATAK-CIV icons for the navigation menu (16 of 18) and drawing tools (12 of 13),
supplied by two TAK-NZ-only modules under `app/src/base/` that upstream will
never create, so they cannot conflict. Each consuming file changes in exactly two
places — one import and one `.map()` — leaving upstream's arrays byte-identical.
Selection and provenance are in `branding/atak-icons/`; attribution is in
`NOTICE` at the repo root.

`DrawOverlay.vue` binds the ATAK icons to upstream's Tabler import names so its
template stays byte-identical. The sector icon's mask id is made unique per
component instance, because the palette and this pane can both render it at once.

---

## Overlays and profile

`api/common/control/profile-overlay.ts`, `api/stateless/routes/profile-overlays.ts`,
`api/stateless/routes/profile.ts`, `api/stateless/lib/control/profile.ts`,
`app/src/components/CloudTAK/Menu/MenuOverlays.vue`

Upstream (v13.102) moved overlay rules into `ProfileOverlayControl`. A duplicate
overlay POST now patches the existing overlay in place; TAK-NZ additionally
**unhides** it unless the caller passes `visible` (`upsert()`, non-mission
overlays), and `delete()` also deletes the overlay's associated iconset.
`icon_rotation` boolean parsing in `ProfileControl.defaultUnits()` was inverted
(`=== 'false'` where it should have been `=== 'true'`); upstream's test for the
unset default still expects `true`, so that test fails - a known, pre-existing gap.

Pinned-overlay stacking (Map Features on top, basemap on bottom) is now upstream's
own (`OverlayManager.compareStack` / `isPinned` / `loadedAnchorOverlayFrom`); the
TAK-NZ `byPosInternalLast`, `OverlayCard` component split and touch long-press
handler were dropped in its favour. What `MenuOverlays.vue` still carries: the
auto-provisioned hidden `raster-dem` terrain overlay is not listed as a card.

**Stale styles after a type change.** Upstream v13.113 removed the client
`Overlay.replace()`, which used to reset an overlay's styles when a basemap went from
vector to raster. A raster overlay that kept vector style layers rendered blank
(`layer "..." requires a vector source`), and the hillshade layer, whose source is the
shared `__terrain__`, still drew on every map. Two TAK-NZ guards:
`ProfileOverlayControl.staleStyles()` (used by `patch()` and `upsert()`) clears the
stored styles when `type` changes and the request carries none, and
`Overlay.init()` falls back to the default raster style when a raster overlay holds
any layer other than `raster` or `background`. Keep both through syncs.

**Stacking over layers CloudTAK does not manage.** Upstream's
`OverlayManager.applyOrder()` repacked every overlay's layers directly below Map
Features, which carried a re-added basemap over plugin layers such as the weather
radar (kept directly below Map Features by the plugin's `markerAnchor()`). TAK-NZ
`applyOrder()` moves only overlays that are out of order, and a basemap goes to the
bottom of the map via `Overlay.moveToBottom()`. A newly added ordinary overlay still
lands directly under Map Features, above the radar. `overlay-order.spec.ts` covers
this; on a sync, re-check that file's `applyOrder` tests first.

See [`README-IDEMPOTENT-OVERLAY.md`](README-IDEMPOTENT-OVERLAY.md).

---

## Channels folder tree

`app/src/components/CloudTAK/Menu/MenuChannels.vue`,
`app/src/components/CloudTAK/util/{ChannelTreeItem,StandardItemChannel}.vue`,
`app/src/utils/channel-tree.ts`, `app/src/workers/atlas-profile.ts`,
`api/common/channel-folder-separator.ts`, `api/common/config.ts`,
`api/stateless/routes/config.ts`, `api/test/fixtures/get_schema.json`

TAK-NZ channel names encode a hierarchy with `" - "` (`BCH - Alerts - MetService`),
and a name can be both a channel and a folder (`Teams - AWS` and
`Teams - AWS - Test`). Upstream's Channels panel is a flat list, so the panel
builds a tree instead. The same approach drives the TAKTeamManager dashboard.

- `channel-tree.ts` splits names on a separator that defaults to `" - "`. One node per path can carry a channel and children, which is how
  `Teams - AWS` stays a single row. Names with an empty segment stay flat at the
  root, and a second name that trims to an existing path is kept as a flat
  channel, so no channel is dropped.
- `MenuChannels.vue` keeps the full channel name for all state changes and uses
  the last segment only as the label. Filters match the full name and open every
  folder while a filter is active.
- `setChannels(names, active)` is new in `atlas-profile.ts`. A folder toggle sends
  one channel-list update instead of one PUT per channel; `setChannel` now calls it.
- `StandardItemChannel.vue` gained an optional `label` prop.
- **Configurable separator.** `CHANNEL_FOLDER_SEPARATOR` (the same variable TAK Team
  Manager reads) comes from the S3 `cloudtak-config.env`. `Config` resolves it once at
  start (`channelFolderSeparator`, read from the environment like
  `tileOriginHostnames`, so `ConfigInit` stays untouched) and `GET /api/config/channels`
  returns `{ separator }` to any signed-in user. `MenuChannels.vue` falls back to
  `" - "` if the request fails. `channel-folder-separator.ts` strips one matched pair of
  quotes, because ECS passes the quotes of `KEY="value"` through, and falls back to the
  default for an empty or whitespace-only value.
- **Types and schema fixture.** The new route is in `api/derived-types.d.ts` and in
  `api/test/fixtures/get_schema.json`. The derived-types entry was first written by hand;
  the file was then regenerated from `map.test.tak.nz` and the entry came out identical.

Other channel pickers (`GroupSelect`, `GroupSelectDropdown`,
`PropertyCoreEntityChannels`, `Subscriptions`) are still flat lists.

---

## Chat

`api/stateful/lib/connection-web.ts`, `api/stateful/lib/connection-pool.ts`,
`app/src/base/chatroom.ts`, `app/src/base/chatroom-chats.ts`,
`app/src/components/CloudTAK/Menu/MenuChat.vue`,
`app/src/components/CloudTAK/Notifications.vue`

**Directed-chat routing is a security fix, not a tidy-up.** The plugin
dest-routing block used to *replace* the UID-based `<marti><dest uid="..."/>` with
a callsign-only dest. TAK Server resolves callsign destinations through a single
global, non-unique `callsign -> subscription` map, and CloudTAK gives every new
profile the same default callsign (`"CloudTAK User"`) — so a directed chat could
reach the wrong user. It now uses `chat.addDest({ callsign })` to add the callsign
dest *alongside* the UID dest. UID-based explicit brokering still wins for
routing, and plugins reading `xmlDetail` still find a callsign.

A bare `<dest callsign="...">` sibling under `<detail>` was also dropped. It had
been added on the assumption that TAK Server strips `<marti>` before building
`xmlDetail`; checking TAK Server's own source
(`StreamingProtoBufHelper.cot2protoBuf()`, `takserver-plugins`) shows it extracts
a fixed allowlist and passes everything else, `<marti>` included, through
unmodified. The `addDest()` call alone suffices.

Other fixes in this area:

- `connection-pool.ts` includes `from.uid` in the WebSocket `chat` push echoed to
  the sender. Without it the client's optimistic local echo was overwritten with
  `sender_uid === undefined`, rendering your own message on the wrong side until
  reload.
- `Chatroom.deleteChats()` deletes the message ids from `db.chatroom_chats` after
  the server delete succeeds. This gap exists upstream too but is invisible there,
  because upstream's wipe-and-repopulate `refresh()` incidentally covers it.
- `chatroom-chats.ts`'s `refresh()` indexes `items[0]`, the newest message, when
  updating `chatroom.updated`. It used to take the last item, the oldest in the
  page.
- `MenuChat.vue` keys its local-DB subscription and server refresh off the
  resolved chatroom name rather than the literal `'new'` URL segment. Every
  "start chat" button routes via `/menu/chats/new?callsign=...`, so an existing
  conversation opened that way showed empty.
- `sendMessage()` sets a `skipNextRefresh` flag before navigating away from
  `/new`, so the post-send refresh cannot race the TAK Server echo and roll back
  optimistic state.
- A debug `console.log(JSON.stringify(feat))` that logged full mission-chat
  payloads, message text included, to server logs was removed.

See [`README-CHAT-FUNCTIONALITY.md`](README-CHAT-FUNCTIONALITY.md),
[`README-CHAT-ECHO-SENDER-UID.md`](README-CHAT-ECHO-SENDER-UID.md) and
[`README-CHAT-DELETE-LOCAL-SYNC.md`](README-CHAT-DELETE-LOCAL-SYNC.md).

---

## WebSocket lifecycle and the login race

`app/src/workers/atlas-connection.ts`, `app/src/workers/atlas.ts`,
`app/src/workers/atlas-database.ts`, `app/src/workers/atlas-profile.ts`,
`app/src/stores/map.ts`, `app/src/components/Login.vue`,
`app/src/components/CloudTAK/Map.vue`

Exponential-backoff reconnect, capped at 5 attempts over 1s → 10s, with
auth-failure detection.

**The mount/unmount guards in `mapStore` are not defensive padding.** `Login.vue`
used to signal completion with `emit('login')`, which `App.vue` routed to the
async `appStore.refreshLogin()` while discarding its promise, then navigated
immediately. `refreshLogin()` sets `appStore.loading = true` synchronously, and
`App.vue` gates `<router-view>` on that flag — so any interleaving where the route
reached `/` while it was still set tore down the just-mounted `Map.vue` and
remounted it a tick later, running `mapStore.destroy()` and `mapStore.init()`
concurrently against the same singleton.

That overlap is unrecoverable: `startWorker()` early-returns while `_rawWorker` is
still set, so the new `init()` binds to a worker the teardown is about to
`terminate()`, and Comlink RPCs against a terminated worker never settle. The
result was a permanent loading spinner with no timeout anywhere in the chain.

The fix has three parts, all of which need to stay together:

1. `Login.vue` awaits `appStore.refreshLogin()` via `settleSession()` before
   navigating, and bails out if the session did not verify. Auth state settles
   while still on `/login`, where App.vue's gate is exempt, so `Map.vue` mounts
   exactly once.
2. `mapStore` gains **module-level** `destroyPromise` and `lifecycle` handles —
   deliberately not state-resident, since `$reset()` would roll them back.
   `destroy()` coalesces concurrent teardowns and bumps the counter; `init()`
   waits for any in-flight teardown, then re-checks at each await whether it has
   been superseded, returning `false` and disposing any orphaned MapLibre
   instance. The graceful worker-shutdown RPC is bounded at 2s before
   `terminate()`, because `init()` waits on it.
3. `Map.vue` honours `init()`'s boolean return and stops wiring up a superseded
   mount.
4. **The Atlas worker handles are not Pinia state either.** The Comlink remote
   (`atlasWorker`, a module-level `shallowRef`), the raw `Worker` and the ready
   promise live outside the store; `hasWorker` is the reactive check components
   use. A Comlink proxy answers every property read — including Vue's internal
   `__v_raw` — with another proxy, so when `$reset()` wrote `undefined` over a
   state-resident remote, the reactive `set` trap's `toRaw(oldValue)` recursed
   until `RangeError: Maximum call stack size exceeded`. That aborted the reset
   half way (leaving a closed `BroadcastChannel` and stale flags) and, because
   `Map.vue`'s teardown calls did not catch it, surfaced as the "Website Error"
   dialog on `/login` after a rejected session. `Map.vue` now catches teardown
   failures in both `onBeforeUnmount` and the boot-retry loop, so a failed
   teardown can never replace the original boot error. Regression test:
   `app/src/test/map-store-destroy.spec.ts`. Upstream still holds `_worker` in
   state ([dfpc-coe/CloudTAK#2014](https://github.com/dfpc-coe/CloudTAK/issues/2014)).

See [`README-WEBSOCKET-RECONNECTION.md`](README-WEBSOCKET-RECONNECTION.md) and
[`README-OIDC-WEBSOCKET-FIXES.md`](README-OIDC-WEBSOCKET-FIXES.md).

---

## Self-location rendering

`app/src/base/cot.ts`, `app/src/workers/atlas-profile.ts`

`COT.styleProperties()` applied group-based `marker-color` / `icon-opacity` to
every Point feature carrying a `group`, including the user's own self-location.
Because `marker-opacity` was never set alongside it, node-cot's `from_geojson()`
defaulted alpha to ~50% — emitting a semi-transparent `<color argb>` that native
ATAK and WinTAK never send for team members, and the suspected cause of team
markers rendering faded or invisible on ATAK 5.7.

`isSelf` is its own **top-level** branch, not an `else if`. An earlier attempt
excluded self only from the first branch, so self with no pre-existing icon fell
through to the generic fallback, got `properties.icon` set, and rendered a second
icon on top of the GeolocateControl puck. The branch also explicitly `delete`s
`marker-color`, `marker-opacity`, `icon-opacity` and `icon` on both the fresh
properties and the long-lived `COT#_properties`, because `Object.assign` never
clears keys a payload omits — so stale values self-heal on the next update.

`COT.selfUid` is set in `AtlasProfile.uid()` rather than relying solely on
`AtlasDatabase.init()`, closing a race where the first self-location update could
fire before it was populated.

---

## Web compass heading

`app/src/stores/device/{orientation,web-compass,heading,declination,heading-reference}.ts`
(+ `*.spec.ts`), `app/src/stores/map.ts`, `app/src/lib/geolocate/main.ts` (comment only),
`app/src/components/CloudTAK/GPSPanel/GPSPanel.vue`,
`app/src/components/CloudTAK/Menu/MenuSettingsDisplay.vue`

Chrome 151+ on Android added `DeviceOrientationEvent.requestPermission`. Upstream's
web branch treated that as "this is iOS" and listened to the **relative**
`deviceorientation` event (`absolute === false`, Android game rotation vector). Its yaw
has an arbitrary reference that resets whenever the sensor restarts (page start and
every resume), so the heading showed a round value such as 90 or 0, offset from the
real one. Separately, `360 - alpha` is wrong when the phone is held upright (Euler
ill-conditioning, up to 90°) and ignores `screen.orientation.angle`.

- `web-compass.ts` holds the new web branch; `OrientationPermission.addListener()`
  only delegates to it. It never shows a relative event as a compass: it accepts
  `deviceorientationabsolute`, events with `absolute === true`, or numeric iOS
  `webkitCompassHeading`, chosen by what the events carry, not by whether
  `requestPermission` exists. It drops the first samples after resume
  (`visibilitychange` / bfcache `pageshow`) and emits `null` with one warning if no
  usable event arrives within 3 s. The native Capacitor branch is unchanged.
- `heading.ts` computes the heading from the device axes (tilt and screen-angle
  compensated) instead of `360 - alpha`.
- **True north by default.** Android Chrome reports magnetic north, iOS
  `webkitCompassHeading` is already true. `declination.ts` applies the World Magnetic
  Model (`geomagnetism`, Apache-2.0, already a dependency) using
  `mapStore.gpsCoordinates`; without a location the heading stays magnetic. The
  "Heading Reference" setting (Settings > Display) switches to magnetic. It is stored in
  `localStorage` (`heading-reference.ts`) so it needs no API or database change. The
  puck cone and map rotation use the same value, so they change by the declination
  (about 23° in Wellington).
- `map.ts` passes the callback value through `finiteOrNull` and a location getter.
- `GPSPanel.vue` labels a GPS course fallback `COG`, and with no heading at all shows
  `--°` as a button that requests the orientation permission from the tap (needed
  when Chrome moves the sensor permission to "ask").
- `OrientationPermission.refreshStatus()` no longer reports `prompt` for Chromium just
  because `requestPermission` exists.
- **Not done:** the Android native Capgo plugin reports magnetic north; declination is
  not applied on that path yet.

Drop the `orientation.ts` / `web-compass.ts` / `heading.ts` part when upstream adopts
an equivalent fix (reject relative events, choose the source by behaviour,
tilt-compensated heading). The true-north setting and the `COG` label are TAK-NZ
additions that would need to be proposed upstream separately.

---

## Data Sync users, default role and password

`api/stateless/lib/control/mission.ts`, `api/stateless/routes/marti-mission.ts`,
`app/src/base/subscription.ts`,
`app/src/components/CloudTAK/Menu/Mission/{MissionUsers,MissionInfo}.vue`,
`app/src/components/CloudTAK/Menu/MenuMission.vue`,
`app/src/components/CloudTAK/util/UserClientSelect.vue`,
`app/src/workers/{atlas-connection,atlas-database,atlas-profile}.ts`

- **Removing a user.** The unsubscribe call TAK Server exposes is the "leave this mission"
  call of a client: it only drops the live connection and filters on the caller's username,
  so it never removed anyone else. `DELETE .../user` now calls node-tak's
  `Mission.removeUser()` (a role-less `PUT .../role`, what ATAK does). It needs
  `MISSION_SET_ROLE`, so the button follows `canManageRoles`.
- **Role changes.** TAK Server refuses a role below the mission's default role unless the
  mission has a password (`validateRoleAssignment`, hardcoded). `MissionUsers.vue` greys
  those roles out, and `serverMessage()` in `subscription.ts` unwraps TAK Server's JSON
  error text so the reason is shown.
- **Default role and password.** `PATCH /marti/missions/:guid` accepts `defaultRole` and
  `password` (a string sets or replaces it, `null` removes it), using node-tak 12.36's
  `Mission.update()`, `setPassword()` and `removePassword()`. The password calls pass the
  acting user's UID as `creatorUid`. The "Access" section of `MissionInfo.vue` shows and
  edits both through `Subscription.update()`. This follows upstream PR #2020; our earlier
  `MissionControl` helpers and the `PUT`/`DELETE .../password` routes were removed.
- **Chat and role fetches.** The Data Sync chat box needs `MISSION_WRITE` (TAK Server drops
  chat from read-only subscribers). `Subscription.load` and `Subscription.update` no longer
  fetch the caller's role more than once per subscribe.
- **Subscriber list.** TAK Server stores one subscription per client UID, so a person using
  CloudTAK, ATAK and WinTAK appears several times under the same username. `MissionUsers.vue`
  groups rows by username (callsigns are neither unique nor stable). Roles are changed per
  user: `PUT .../role` with a `username` makes TAK Server update every subscription of that
  username (`setRoleByUsername`), without one only the given client UID
  (`setRoleByClientUid`). Chatting with a client and removing it act on one client UID, so
  users with several clients get an indented row per client for those two actions.
- **Last owner.** TAK Server lets the last owner demote or remove themselves, and a CloudTAK
  admin has no access to a Data Sync they are not subscribed to (only a TAK Server admin is
  treated as owner). `MissionControl.assertOwnerRemains()` refuses with a 409 when a role
  change or removal would leave no owner subscription, matching what TAK Server would touch
  (username-wide for a role change with a username, one client UID otherwise). The UI greys
  out the same actions. It only knows about owners that have a saved subscription.
- **Stale local copy.** `Subscription.fetch()` now persists what it fetched, and
  `MenuMission.vue` refreshes in the background after opening from the local copy.
  Otherwise fields added later (`defaultRole`) stayed empty for missions opened before.
- **Invites.** `UserClientSelect.vue` hides current members and pending invitees. TAK Server
  answers a duplicate invite with a bare 500.
- **ATAK's role-change warning.** ATAK shows "running an older version of the TAK platform"
  unless the `takv` platform starts with `ATAK` (tested: `ATAK-CIV` and `ATAK-CloudTAK`
  clear it, `CloudTAK` does not; the version number does not matter). CloudTAK announces
  `ATAK-CloudTAK` (`atlas-profile.ts`) and now handles `t-x-m-r`, the role-change push, by
  refreshing the role (`atlas-connection.ts`, `atlas-database.ts`). Nothing reads the
  platform value, and TAK Team Manager classifies CloudTAK from the Client UID alone.
  Revert the platform line to restore the honest name at the cost of ATAK's warning.
- **Listing Data Syncs.** `GET /marti/mission` with `passwordProtected=true` uses TAK Server's
  paged list (`MissionControl.list`). TAK Server's unpaged list takes each Data Sync from its shared
  cache, copies it shallowly (`Mission(Mission other)` shares the collections) and calls `clear()`
  on the copy when the Data Sync has a password, so every list call emptied the items, layers and
  files of every password protected Data Sync until the cache entry was rebuilt. `/cot` then
  returned nothing. ATAK and WinTAK still trigger it when they list Data Syncs. Falls back to the
  unpaged list if the paged endpoint fails. Remove once TAK Server is fixed.
- **Creating a password protected Data Sync.** `POST /marti/mission` sets the keywords itself
  instead of leaving it to `Mission.create()`. node-tak (12.36.3 and earlier) replaces the created
  Mission with the response of its keywords call, and that response has no `token`; TAK Server
  returns the creator's token only on creation. Without it, subscribing to the new Data Sync
  failed with "No token role provided" and the New Data Sync dialog stayed open. Remove this
  once node-tak keeps the token.
- **Invite QR code.** `MissionInfo.vue` fetches the QR with a normal request that carries the
  `MissionAuthorization` header and shows it from a blob URL. It was an `<img src>` with the
  login token in the query string. An `<img>` cannot send the header, so the API fell back to
  the token stored on the user's overlay, which a password protected Data Sync refused with
  a 403. The route itself is unchanged from upstream.
  The code sits on a white frame with 2.5rem padding in both themes. It used to be inverted in
  dark mode, which no QR reader can decode, and had less than the 4 modules of quiet zone.
- `api/derived-types.d.ts` was edited by hand for the consolidated `PATCH` (the password
  routes removed, `password` added to the body). Regenerate it from Test after deploying.

Upstream now has the removal and the default role/password controls. What remains ours is
the role-change guard in `MissionUsers.vue`, the stale-copy refresh, `t-x-m-r` handling and
the `ATAK-CloudTAK` platform.

---

## Breadcrumb trail actions

`app/src/base/trail.ts`, `app/src/components/CloudTAK/util/{TrailActions,TrailPointBanner,Breadcrumb}.vue`,
`app/src/components/CloudTAK/{CoTView,Menu/MenuFeatView,Menu/MenuHistory}.vue`,
`app/src/stores/modules/history.ts`, `app/src/components/CloudTAK/Map.vue`,
`app/src/components/CloudTAK/RadialMenu/RadialMenu.vue`

- Upstream v13.115 turned a trail into `feature_history` points drawn by the HistoryLayer.
  It is no longer a selectable `<uid>.track` feature, so it cannot be selected or deleted
  where it is seen, and the only removal is the trash button in the History menu, which
  nothing links to. Deleting the CoT removes its trail as well.
- The Breadcrumb dropdown of a CoT has a Trail section (point count and span, Zoom,
  History, Clear Trail) and the Breadcrumb button shows a dot whenever a trail exists, not
  only while it records. Clear asks for a second click in place: the dropdown closes on any
  click outside its menu, so the usual confirmation dialog (teleported to the body) would
  be unmounted before the click is handled.
- Clicking within 8px of the trail line opens the radial menu in a new `trail` mode
  (`HistoryLayer.onTrailClick` calls `mapStore.radialClick`) with only the items that make
  sense for a trail: open the CoT, zoom, History and clear (no confirmation, like the
  radial delete of a CoT). Clicking one of the dots opens the same menu centred on the
  dot instead of upstream's jump to the feature viewer, with an extra "Point details" item
  that opens that viewer (`HistoryLayer.open`), so what the CoT reported at that moment is
  still reachable. `RadialMenu.vue` gained the `trail` items and three icons
  (`radial-zoom`, `radial-history`, `radial-point`), and `Map.vue`'s `handleRadial` the
  `trail:*` events; the radial's key also includes `properties.radialKey`, so clicking
  another dot of the same trail re-centres it. The viewer shows the trail actions in a
  banner (`TrailPointBanner.vue`). `/menu/history?uid=` lists a single trail.
- The new UI is in new TAK-NZ-only files (`trail.ts`, `TrailActions.vue`,
  `TrailPointBanner.vue`); the synced files carry small edits so a sync conflicts as
  little as possible.

Drop this when upstream gives the trail its own entry points from the CoT and the map.

---

## Routing: NZTA road events
`api/stateless/lib/routing/nzta-events.ts` (new), `api/stateless/lib/routing/agol.ts`,
`api/stateless/lib/interface-route.ts`, `api/stateless/routes/search.ts`,
`app/src/components/CloudTAK/Menu/MenuRoutesNew.vue`
- **Why:** an ArcGIS route knows nothing about NZTA closures. `/search/route?nzta=true`
  (the checkbox on `/menu/routes/new`, on by default) makes the route go round active
  full closures and lists NZTA delays on the route. Off, outside New Zealand, or for a
  walking mode, the route is exactly what upstream returns.
- **Closures:** the NZTA feed (`journeys.nzta.govt.nz/assets/map-data-cache/delays.json`,
  cached for a minute) is read while ArcGIS solves. If a closure that is in force
  during the trip lies within 0.3 km of the route, one second solve is made with every
  such closure as a restriction barrier (points in `barriers`, lines in
  `polylineBarriers`, at most 100 features, nearest first). The detour is reported as
  extra km and minutes. If no route exists, or ArcGIS refuses the barriers, the direct
  route is returned with a note.
- **Delays are reported, not routed.** The feed gives delay length only as free text
  ("expect up to 10 minute delays"), and ArcGIS's own traffic may already reflect some
  of it, so delays never change the route or its time. The remarks list the events
  within 1 km of the route (worst first, at most 8) and a total "up to N min", counting
  an event only if the trip overlaps the hours its comment states ("between 7am and
  7pm"). Wording that does not parse is listed but adds no minutes.
- **Fails soft:** if the feed cannot be read the route is still returned, with a line
  saying events are unknown.
- **Where it shows:** the NZTA text is placed first in the route's `remarks`, ahead of the
  turn-by-turn directions.
- Logic follows the `TAK-NZ/tak-infra` `lambda/arcgis-geocode` reference implementation.
  Only "depart now" is supported, and `startTime` is not sent, so ArcGIS time is whatever
  the travel mode gives.
- `api/derived-types.d.ts` was edited by hand for the new `nzta` query parameter;
  regenerating it from a live API produces the same entry.
**Not done:** delay minutes as ArcGIS added-cost barriers. See the risks (an "up to"
upper bound, hours limits, possible double counting with ArcGIS traffic).
---
## Terminology and UI

`app/src/components/CloudTAK/MainMenuContents.vue`,
`app/src/components/CloudTAK/util/{ChannelInfo,EmptyInfo,ShareToMission,Share,SelectFeats,SettingsCallsign,NotificationIcon}.vue`,
`app/src/components/CloudTAK/Menu/{MenuContacts,MenuVideos,MenuSettings,MenuFilesRow}.vue`,
`app/src/components/CloudTAK/Map.vue`,
`app/src/components/PageFooter.vue`,
`app/{index,admin,connection,docs,video}.html`, `app/vite.config.ts`

- The Application Switcher dropdown is removed; logout redirects to
  `/api/logout`.
- Creator/author rows show the username without a `mailto:` link
  (`Property/PropertyAuthor.vue`, used by `CoTView.vue` and `CoreEntityView.vue`).
  Authentik usernames need not be email addresses. `PropertyEmail.vue` is left
  as upstream ships it so it cannot conflict.
- Upstream's "Missions" are presented as "Data Syncs" where they face the user
  (route paths, store/prop names and DB fields stay `mission`/`missions`), and
  the `EmptyInfo` type check was corrected to match. Not yet applied
  everywhere - some menu titles under `Menu/Mission/` still say "Mission".
- The contacts badge count is fixed and a manual refresh added.
- The video menu is hidden when no media server is configured.
- Upstream's `.maplibregl-ctrl-scale` CSS overrides are removed to keep MapLibre's
  default styling; only `margin: 0` is re-added, because dropping the whole block
  also dropped the positioning.

See [`README-HIDE-LOGIN-FORM.md`](README-HIDE-LOGIN-FORM.md).

---

## Tests

`api/test/login-oidc.srv.test.ts`, `api/test/manifest.srv.test.ts`,
`tasks/pmtiles/test/**`

The OIDC login suite and the PMTiles elevation/profile suites are TAK-NZ
additions. Note the OIDC suite was one of the files the old patch set did not
cover at all.

**Known gap:** nothing covers `AuthentikProvider.login()`'s `takCallsign` →
`tak_callsign` mapping.

---

## Notes for future syncs

1. **Regenerate `api/derived-types.d.ts`** after the new API is live, then commit
   it on the sync branch before merging:
   ```bash
   cd api && npx openapi-typescript https://map.test.tak.nz/api/swagger --output derived-types.d.ts && cd ..
   ```
   It tends to be several versions stale between syncs. `tasks/events` no longer
   has its own copy — upstream removed that file at v13.70.0.

2. **Check for orphaned migrations** before upgrading an environment:
   ```bash
   MIGRATIONS_JOURNAL=<journal for the target version> node scripts/check-migrations.mjs
   ```

3. **Keep the paths in this document current.** It is keyed by real paths, and
   upstream restructures directories — that is precisely what invalidated the
   patch files it replaced. After a sync that moves files, re-run the `git diff`
   at the top and fix any heading that no longer resolves.
