import jwt from 'jsonwebtoken';
import Err from '@openaddresses/batch-error';
import Auth, { AuthUserAccess, isOidcEnabled, isOidcForced } from '../../common/auth.js';
// `Config` (the base) is what oidcConfig() needs - it only reads API_URL, so it
// stays usable from either server half. The router itself gets ConfigStateless.
import type Config from '../../common/config.js';
import type ConfigStateless from '../config.js';
import Schema from '@openaddresses/batch-schema';
import { Type } from '@sinclair/typebox';
import Provider from '../lib/provider.js';
import ProfileControl from '../lib/control/profile.js';
import { X509Certificate, createHash, timingSafeEqual } from 'crypto';
import { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak';
import { discovery, authorizationUrl, exchangeCode, userinfo } from '../lib/oidc.js';
import type { OIDCConfig } from '../lib/oidc.js';
import { sql } from 'drizzle-orm';
import { LoginResponse, issueSession, refreshSession } from '../lib/user/session.js';

/** Returns true when the cert PEM is missing, unparseable, or expires within 7 days. */
function certNeedsRenewal(certPem: string | undefined): boolean {
    if (!certPem) return true;
    try {
        const cert = new X509Certificate(certPem);
        const expiresAt = new Date(cert.validTo);
        if (Number.isNaN(expiresAt.getTime())) return true;
        return expiresAt.getTime() < Date.now() + 7 * 24 * 60 * 60 * 1000;
    } catch {
        return true;
    }
}

/**
 * TAK-NZ: native app SSO handoff.
 *
 * The mobile app cannot finish an SSO login inside its own WebView (the bundled
 * app and the server are different origins), so it runs the flow in the system
 * browser and gets control back through a custom URL scheme. Any app can claim
 * a custom scheme, so the URL it receives carries only a short-lived `code`,
 * never a session. The code is redeemed at POST /login/oidc/exchange together
 * with the PKCE-style `verifier` that only the app that began the login holds
 * (the browser only ever sees its SHA-256 `app_challenge`).
 */
const APP_CHALLENGE_PATTERN = '^[A-Za-z0-9_-]{43}$';

function appScheme(): string {
    return process.env.MOBILE_APP_SCHEME || 'nz.tak.app';
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Hand control back to the mobile app. A page with a meta refresh and a visible
 * link is used instead of a bare 302 because browsers differ in whether they
 * follow a redirect to a custom scheme without a user gesture.
 */
function redirectToApp(res: { status: (code: number) => unknown; type: (type: string) => unknown; send: (body: string) => unknown }, params: Record<string, string>): void {
    const target = `${appScheme()}://login?${new URLSearchParams(params).toString()}`;
    const href = escapeHtml(target);
    res.status(200);
    res.type('html');
    res.send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0;url=${href}">
<title>Return to TAK.NZ</title>
</head>
<body>
<p>Returning to the TAK.NZ app&hellip;</p>
<p><a href="${href}">Open TAK.NZ</a></p>
</body>
</html>`);
}

/**
 * Build the generic OIDC engine config from environment variables. The
 * discovery/client/secret/redirect/scopes values are IdP-agnostic; Authentik-
 * specific behaviour (role sync, cert enrollment, attribute sync, logout) is
 * layered on top in the callback route below via AuthentikProvider.
 */
function oidcConfig(config: Config): OIDCConfig {
    if (!isOidcEnabled()) {
        throw new Err(403, null, 'OIDC authentication is not enabled');
    }

    const discoveryUrl = process.env.OIDC_DISCOVERY_URL;
    const client = process.env.OIDC_CLIENT_ID;
    const secret = process.env.OIDC_CLIENT_SECRET;

    if (!discoveryUrl || !client || !secret) {
        throw new Err(400, null, 'OIDC authentication is not fully configured');
    }

    return {
        discovery: discoveryUrl,
        client,
        secret,
        redirect: process.env.OIDC_REDIRECT_URI || `${config.API_URL}/api/login/oidc/callback`,
        scopes: process.env.OIDC_SCOPES || 'openid profile email groups',
    };
}

export default async function router(schema: Schema, config: ConfigStateless) {
    await schema.post('/login', {
        security: [],
        name: 'Create Login',
        group: 'Login',
        body: Type.Object({
            username: Type.String({
                description: 'Case-Sensitive username, if an email, the client MUST lowercase',
            }),
            password: Type.String(),
        }),
        res: LoginResponse,
    }, async (req, res) => {
        try {
            let profile;

            if (config.server.auth.key && config.server.auth.cert && config.server.webtak) {
                const provider = new Provider(config);
                const email = await provider.login(req.body.username, req.body.password);

                const cotak = config.user?.get('cotak');
                if (cotak && cotak.configured) {
                    try {
                        const response = await cotak.login(email);

                        // `phone` is stored as a profile setting rather than a Profile column
                        const { phone, ...profileData } = response;

                        await config.models.Profile.commit(email, {
                            ...profileData,
                            last_login: new Date().toISOString(),
                        });

                        if (phone !== undefined) {
                            await config.models.ProfileConfig.commit(email, { 'tak::phone': String(phone ?? '') });
                        }
                    } catch (err) {
                        console.error(err);

                        await config.models.Profile.commit(email, {
                            last_login: new Date().toISOString(),
                        });
                    }
                } else {
                    await config.models.Profile.commit(email, {
                        last_login: new Date().toISOString(),
                    });
                }

                profile = await config.models.Profile.from(email);

                // When OIDC is forced, only system admins may use local username/password login.
                // Regular users must authenticate via SSO (/login/oidc).
                // System admins can bypass by navigating to /login?local=true.
                if (isOidcForced() && !profile.system_admin) {
                    throw new Err(403, null, 'Local login is restricted to system admins. Please use SSO.');
                }
            } else {
                throw new Err(400, null, 'Server has not been configured');
            }

            res.json(await issueSession(config, req, profile));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/login/refresh', {
        security: [],
        name: 'Refresh Login',
        group: 'Login',
        description: 'Exchange a refresh token for a new login token - the refresh token is single use, a replacement is returned and the session expiry is extended',
        body: Type.Object({
            refresh: Type.String(),
        }),
        res: LoginResponse,
    }, async (req, res) => {
        try {
            res.json(await refreshSession(config, req.body.refresh));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/login', {
        name: 'Get Login',
        group: 'Login',
        res: Type.Object({
            email: Type.String(),
            access: Type.Enum(AuthUserAccess),
        }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const profile = await config.models.Profile.from(user.email);

            // If the server hasn't been configured the user won't have a valid cert
            if (config.server.auth.key && config.server.auth.cert) {
                const provider = new Provider(config);
                await provider.valid(profile);
            }

            res.json({
                email: user.email,
                access: user.access,
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    /**
     * Begin an OIDC SSO login - redirects the browser to the configured IdP's
     * authorization endpoint. The IdP redirects back to /login/oidc/callback
     * with an authorization code.
     */
    await schema.get('/login/oidc', {
        security: [],
        name: 'OIDC Login',
        group: 'Login',
        description: 'Redirect the browser to the configured OIDC Identity Provider to begin an SSO login',
        query: Type.Object({
            redirect: Type.Optional(Type.String({
                description: 'In-App location to navigate to after a successful login',
            })),
            app_challenge: Type.Optional(Type.String({
                description: 'Mobile app only: base64url SHA-256 (43 characters) of a secret verifier held by the app. When set, the login hands back to the app by URL scheme with a one-time code instead of a web session',
            })),
        }),
    }, async (req, res) => {
        // Checked here rather than as a schema pattern so a bad value is a plain 400
        if (req.query.app_challenge !== undefined && !new RegExp(APP_CHALLENGE_PATTERN).test(req.query.app_challenge)) {
            return Err.respond(new Err(400, null, 'app_challenge must be a base64url SHA-256 digest'), res);
        }

        try {
            const oidc = oidcConfig(config);
            const disc = await discovery(oidc.discovery);

            const state = jwt.sign({
                t: 'oidc',
                ...(req.query.redirect ? { r: req.query.redirect } : {}),
                ...(req.query.app_challenge ? { c: req.query.app_challenge } : {}),
            }, config.SigningSecret, { expiresIn: '10m' });

            res.redirect(authorizationUrl(disc, oidc, state));
        } catch (err) {
            console.error('OIDC login error:', err);
            const message = err instanceof Error ? err.message : 'SSO Login Failed';
            if (req.query.app_challenge) return redirectToApp(res, { sso_error: message });

            // `local=true` prevents Login.vue's forced-SSO check from immediately
            // redirecting back here when OIDC_FORCED is set - without it, a
            // persistent config error (e.g. a bad OIDC_DISCOVERY_URL) would loop
            // forever with the error never shown. Login.vue additionally treats
            // the presence of `sso_error` itself as reason not to auto-redirect,
            // so this is defense in depth rather than the only thing preventing it.
            res.redirect(`/login?local=true&sso_error=${encodeURIComponent(message)}`);
        }
    });

    /**
     * OIDC Authorization Code callback. Exchanges the code for tokens directly
     * with the IdP over TLS, fetches the userinfo claims (including group
     * membership, used for Authentik role sync below), then runs the same
     * profile create/update + certificate enrollment + attribute sync logic
     * previously triggered by the ALB OIDC headers.
     */
    await schema.get('/login/oidc/callback', {
        security: [],
        name: 'OIDC Login Callback',
        group: 'Login',
        description: 'OIDC Authorization Code callback - exchanges the code, validates the user and establishes a CloudTAK session',
        query: Type.Object({
            code: Type.Optional(Type.String()),
            state: Type.Optional(Type.String()),
            error: Type.Optional(Type.String()),
            error_description: Type.Optional(Type.String()),
        }),
    }, async (req, res) => {
        // Set once the state proves this login began in the mobile app, so that
        // every outcome (including failures) returns to the app, not the web page
        let fromApp = false;
        try {
            if (req.query.error) {
                throw new Err(401, null, req.query.error_description || req.query.error);
            } else if (!req.query.code || !req.query.state) {
                throw new Err(400, null, 'OIDC Callback is missing code or state');
            }

            let state: { t?: string; r?: string; c?: string };
            try {
                state = jwt.verify(req.query.state, config.SigningSecret) as { t?: string; r?: string; c?: string };
            } catch (err) {
                throw new Err(401, err instanceof Error ? err : null, 'Invalid OIDC State - Please try logging in again');
            }
            if (state.t !== 'oidc') throw new Err(401, null, 'Invalid OIDC State - Please try logging in again');
            fromApp = typeof state.c === 'string' && state.c.length > 0;

            const oidc = oidcConfig(config);
            const disc = await discovery(oidc.discovery);
            const tokens = await exchangeCode(disc, oidc, req.query.code);
            const claims = await userinfo(disc, tokens.access_token);

            // Identify the user by `preferred_username` first - the OIDC-standard
            // claim for the name the IdP would use to log the user in - falling
            // back to `email` for IdPs/configurations that don't populate it.
            // Unlike `email`, `preferred_username` is not guaranteed to be
            // case-insensitive (Authentik usernames are a case-sensitive unique
            // field), so it is used as-is; only the email fallback is lowercased,
            // matching this route's historical behaviour for that claim.
            let email: string;
            if (typeof claims.preferred_username === 'string' && claims.preferred_username) {
                email = claims.preferred_username;
            } else if (typeof claims.email === 'string' && claims.email) {
                email = claims.email.toLowerCase();
            } else {
                throw new Err(400, null, 'OIDC UserInfo did not return a preferred_username or email claim');
            }

            if (!config.server.auth.key || !config.server.auth.cert || !config.server.webtak) {
                throw new Err(400, null, 'Server has not been configured');
            }

            // Block accounts configured for local-only login. The redirect
            // MUST include `local=true` - without it, Login.vue's forced-SSO
            // check sees no `local` param and immediately calls loginWithSSO()
            // again on the very page this redirects to, which re-authenticates
            // as the same local-only account and lands back here: an infinite
            // SSO <-> /login redirect loop that never surfaces `sso_error` to
            // the user (nothing reads it - see Login.vue).
            const localOnlyAccounts = (process.env.LOCAL_ONLY_ACCOUNTS || '')
                .split(',').map((a: string) => a.trim()).filter(Boolean);
            if (localOnlyAccounts.includes(email)) {
                if (fromApp) return redirectToApp(res, { sso_error: 'This account requires local login' });
                return res.redirect(`/login?local=true&sso_error=${encodeURIComponent('This account requires local login. Use /login?local=true')}`);
            }

            // Parse group membership for role assignment. Authentik includes
            // `groups` in the userinfo response when the groups scope/claim
            // mapping is attached to the OAuth2 provider (see the OIDC setup
            // Lambda / CDK construct).
            const groups: string[] = Array.isArray(claims.groups) ? claims.groups as string[] : [];
            const systemAdminGroup = process.env.OIDC_SYSTEM_ADMIN_GROUP || 'CloudTAKSystemAdmin';
            const agencyAdminPrefix = process.env.OIDC_AGENCY_ADMIN_GROUP_PREFIX || 'CloudTAKAgency';

            const isSystemAdmin = groups.includes(systemAdminGroup);
            const agencyAdminIdSet = new Set<number>();
            for (const group of groups) {
                if (group.startsWith(agencyAdminPrefix)) {
                    const agencyId = parseInt(group.substring(agencyAdminPrefix.length), 10);
                    if (!isNaN(agencyId) && agencyId > 0) agencyAdminIdSet.add(agencyId);
                }
            }
            const agencyAdminIds: number[] = [...agencyAdminIdSet];

            const profileControl = new ProfileControl(config);
            let profile;

            try {
                profile = await config.models.Profile.from(email);

                // Update group membership on every login
                await config.models.Profile.commit(email, {
                    system_admin: isSystemAdmin,
                    agency_admin: agencyAdminIds,
                    last_login: new Date().toISOString(),
                });
                profile = await config.models.Profile.from(email);
            } catch (err) {
                if (err instanceof Error && err.message.includes('Item Not Found')) {
                    // First OIDC login — auto-create profile using ProfileControl
                    // to inherit any admin-configured system defaults
                    profile = await profileControl.generate({
                        username: email,
                        auth: { ca: [], key: '', cert: '' },
                        system_admin: isSystemAdmin,
                        agency_admin: agencyAdminIds,
                        last_login: new Date().toISOString(),
                    });
                } else {
                    throw err;
                }
            }

            // Provision or renew TAK client certificate + sync Authentik attributes.
            // Both operations share a single AuthentikProvider instance and commit
            // their updates together to avoid two round-trips to the database.
            // A failure here is non-fatal — the user still gets a JWT and can
            // try again on the next login, but TAK-connected features won't work
            // until the cert is present.
            if (process.env.AUTHENTIK_API_TOKEN_SECRET_ARN
                && process.env.AUTHENTIK_URL
                && config.server.webtak) {
                try {
                    const AuthentikProvider = (await import('../lib/authentik-provider.js')).default;
                    const authentik = await AuthentikProvider.init(config);
                    const updates: Record<string, unknown> = {};

                    // Certificate provisioning — runs for new users (empty cert),
                    // existing users whose cert is expired or expiring within 7 days,
                    // and existing users whose cert TAK Server has revoked.
                    //
                    // Expiry is readable straight out of the PEM. Revocation is not,
                    // and TAK Server exposes no validity endpoint, so it takes a probe.
                    // Without that probe a revoked SSO user is stranded: the cert still
                    // looks healthy here so nothing re-enrolls, but GET /login rejects
                    // it, so the frontend clears the token and bounces back to SSO —
                    // indefinitely. Local password login has always recovered inside
                    // AuthProvider.valid(); SSO has no password to re-enroll with,
                    // which is why it has to be handled here.
                    let needsCert = certNeedsRenewal(profile.auth?.cert);

                    if (!needsCert && profile.auth?.cert && profile.auth?.key) {
                        try {
                            const cert_api = await TAKAPI.init(
                                new URL(String(config.server.api)),
                                new APIAuthCertificate(profile.auth.cert, profile.auth.key),
                            );
                            const probe = await cert_api.Certificate.probe();

                            if (!probe.accepted) {
                                needsCert = true;
                                console.log(`TAK certificate for ${email} was rejected by TAK Server (${probe.reason}) - re-enrolling`);
                            }
                        } catch (err) {
                            // Fail safe. An unreachable or erroring TAK Server must not
                            // be mistaken for revocation, otherwise every login during
                            // an outage would churn a fresh certificate for no reason.
                            console.error(`Could not verify TAK certificate for ${email} (assuming still valid):`, err);
                        }
                    }

                    // This has its own try/catch, deliberately separate from attribute
                    // sync below: cert enrollment mutates a temporary password on the
                    // shared Authentik user account, so two concurrent OIDC callbacks
                    // for the same user (e.g. a double-fired browser redirect) can race
                    // and cause one enrollment attempt to fail with a stale-credential
                    // error from TAK Server. That failure must not prevent the
                    // callsign/group/role sync from running and committing.
                    if (needsCert) {
                        try {
                            console.log(`Enrolling TAK certificate for OIDC user: ${email}`);
                            const certs = await authentik.enrollUserCertificate(email, config.server.webtak, tokens.access_token);
                            updates.auth = certs;
                            console.log(`TAK certificate enrolled successfully for: ${email}`);
                        } catch (err) {
                            console.error(`Authentik cert enrollment error for ${email} (continuing):`, err);
                        }
                    }

                    // Attribute sync — callsign, colour group, role, etc.
                    // Always runs on first login (created === updated means the profile has
                    // never been modified) so the "Welcome" wizard is suppressed.
                    // On subsequent logins gated on SYNC_AUTHENTIK_ATTRIBUTES_ON_LOGIN so
                    // admins can opt out of overwriting user-customised values.
                    try {
                        const isFirstLogin = profile.created === profile.updated;
                        if (isFirstLogin || process.env.SYNC_AUTHENTIK_ATTRIBUTES_ON_LOGIN === 'true') {
                            const userInfo = await authentik.login(email);

                            // name is a real column on the profile table — commit via Profile.
                            if (userInfo.name && userInfo.name !== 'Unknown') {
                                updates.name = userInfo.name;
                            }

                            // tak_callsign / tak_group / tak_role / tak_remarks live in
                            // profile_settings (ProfileConfig), NOT on the profile table.
                            // Profile.commit() silently drops unknown columns, so these MUST
                            // go through ProfileConfig.commit() with the tak:: key namespace.
                            const profileConfigUpdates: Record<string, unknown> = {};
                            if (userInfo.tak_callsign) {
                                profileConfigUpdates['tak::callsign'] = userInfo.tak_callsign;
                                profileConfigUpdates['tak::remarks'] = userInfo.tak_callsign;
                            }
                            if (userInfo.tak_group) {
                                profileConfigUpdates['tak::group'] = userInfo.tak_group;
                            }
                            if (userInfo.tak_role) {
                                profileConfigUpdates['tak::role'] = userInfo.tak_role;
                            }

                            // Whether any real value was synced. Captured before the
                            // `_managed` markers below are added, because those are
                            // written on every sync and would otherwise always make
                            // the map non-empty - which would bump `updated` (and so
                            // suppress the Welcome wizard) even when Authentik supplied
                            // no attributes at all.
                            const syncedValues = Object.keys(profileConfigUpdates).length > 0;

                            // Record which fields Authentik owns so the API can tell the
                            // frontend to lock them (see ProfileControl.from). Written
                            // unconditionally, including `false`, so that clearing an
                            // attribute in Authentik releases the lock on the next login
                            // rather than leaving the field stuck read-only forever.
                            profileConfigUpdates['tak::callsign_managed'] = Boolean(userInfo.tak_callsign);
                            profileConfigUpdates['tak::group_managed'] = Boolean(userInfo.tak_group);
                            profileConfigUpdates['tak::role_managed'] = Boolean(userInfo.tak_role);

                            await config.models.ProfileConfig.commit(email, profileConfigUpdates);

                            if (syncedValues) {
                                // The frontend (hasNoConfiguration() in atlas-profile.ts) and the
                                // isFirstLogin check above both key off `profile.created ===
                                // profile.updated` to decide whether the user still needs the
                                // "Welcome" callsign/group/role wizard. Profile.commit() is a plain
                                // SQL UPDATE that never touches `updated` unless it's explicitly
                                // passed in the values - so without this, a successful Authentik
                                // attribute sync above would populate the real callsign/group/role
                                // but `updated` would stay pinned to `created` forever, and the
                                // wizard would keep reappearing on every login despite the data
                                // already being correct. Bumping `updated` here is what actually
                                // suppresses the dialog once real values have been synced in.
                                updates.updated = sql`Now()`;
                            }
                        }
                    } catch (err) {
                        console.error(`Authentik attribute sync error for ${email} (continuing):`, err);
                    }

                    // Commit profile-table updates (auth cert, name) if any.
                    if (Object.keys(updates).length > 0) {
                        await config.models.Profile.commit(email, updates);
                        profile = await config.models.Profile.from(email);
                    }
                } catch (err) {
                    console.error(`Authentik cert/attribute sync error for ${email} (continuing):`, err);
                }
            }

            if (fromApp && state.c) {
                // Everything above (profile, certificate, attribute sync) is done;
                // the session itself is only issued when the app redeems this code
                // with its verifier at POST /login/oidc/exchange
                const code = jwt.sign({ t: 'oidc-app', e: email, c: state.c }, config.SigningSecret, { expiresIn: '2m' });
                return redirectToApp(res, { code });
            }

            // Same session + token pair issuance as POST /login, so SSO users also
            // get a refresh token and the configured token/refresh lifetimes
            const login = await issueSession(config, req, profile);

            const payload = Buffer.from(JSON.stringify({
                ...login,
                ...(state.r ? { redirect: state.r } : {}),
            })).toString('base64url');

            // The session is passed in the URL Fragment so it is never sent to the
            // server or written to access logs - the Login page consumes and clears it
            return res.redirect(`/login#sso=${payload}`);
        } catch (err) {
            console.error('OIDC login error:', err);
            const message = err instanceof Error ? err.message : 'SSO Login Failed';
            if (fromApp) return redirectToApp(res, { sso_error: message });
            // See the comment on the equivalent redirect in /login/oidc above -
            // `local=true` stops this from looping forever under OIDC_FORCED.
            return res.redirect(`/login?local=true&sso_error=${encodeURIComponent(message)}`);
        }
    });

    /**
     * Redeem the one-time code the SSO callback handed to the mobile app. The
     * code is only useful together with the verifier the app generated before
     * it opened the browser, so an app that merely intercepts the URL scheme
     * cannot turn it into a session.
     */
    await schema.post('/login/oidc/exchange', {
        security: [],
        name: 'OIDC App Login Exchange',
        group: 'Login',
        description: 'Exchange the one-time code returned to the mobile app after an SSO login, plus the PKCE verifier, for a CloudTAK session',
        body: Type.Object({
            code: Type.String(),
            verifier: Type.String({ minLength: 32, maxLength: 128 }),
        }),
        res: LoginResponse,
    }, async (req, res) => {
        try {
            let claims: { t?: string; e?: string; c?: string };
            try {
                claims = jwt.verify(req.body.code, config.SigningSecret) as { t?: string; e?: string; c?: string };
            } catch (err) {
                throw new Err(401, err instanceof Error ? err : null, 'Invalid or expired login code - Please try logging in again');
            }
            if (claims.t !== 'oidc-app' || !claims.e || !claims.c) {
                throw new Err(401, null, 'Invalid or expired login code - Please try logging in again');
            }
            const expected = Buffer.from(claims.c, 'base64url');
            const actual = createHash('sha256').update(req.body.verifier).digest();
            if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
                throw new Err(401, null, 'Login verification failed - Please try logging in again');
            }
            const profile = await config.models.Profile.from(claims.e);
            res.json(await issueSession(config, req, profile));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    /**
     * Logout endpoint — redirects to the IdP end-session endpoint (if
     * configured) so the Authentik session is also terminated, or to /login.
     */
    await schema.get('/logout', {
        security: [],
        name: 'Logout',
        group: 'Login',
        description: 'Logout and redirect to the IdP end-session endpoint if OIDC is configured',
    }, async (req, res) => {
        try {
            if (process.env.AUTHENTIK_URL && process.env.AUTHENTIK_APP_SLUG) {
                const authentikBase = process.env.AUTHENTIK_URL.replace(/\/$/, '');
                return res.redirect(`${authentikBase}/application/o/${process.env.AUTHENTIK_APP_SLUG}/end-session/`);
            }

            return res.redirect('/login');
        } catch (err) {
            console.error('Logout error:', err);
            Err.respond(err, res);
        }
    });
}
