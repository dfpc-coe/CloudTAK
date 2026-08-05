import jwt from 'jsonwebtoken';
import Err from '@openaddresses/batch-error';
import { AuthUserAccess } from '../../common/auth.js';
import type ConfigStateless from '../config.js';
import Schema from '@openaddresses/batch-schema';
import { Type } from '@sinclair/typebox';
import Provider from '../lib/provider.js';
import { discovery, authorizationUrl, exchangeCode, userinfo } from '../lib/oidc.js';
import type { OIDCConfig } from '../lib/oidc.js';
import { UAParser } from 'ua-parser-js';

export default async function router(schema: Schema, config: ConfigStateless) {
    async function oidcConfig(): Promise<OIDCConfig> {
        const settings = await config.models.Setting.typedMany({
            'oidc::enabled': false,
            'oidc::discovery': '',
            'oidc::client': '',
            'oidc::secret': '',
            'oidc::redirect': '',
            'oidc::scopes': '',
        });

        if (!settings['oidc::enabled']) {
            throw new Err(403, null, 'OIDC Authentication is not enabled');
        } else if (!settings['oidc::discovery'] || !settings['oidc::client'] || !settings['oidc::secret']) {
            throw new Err(400, null, 'OIDC Authentication is not fully configured');
        }

        return {
            discovery: settings['oidc::discovery'],
            client: settings['oidc::client'],
            secret: settings['oidc::secret'],
            redirect: settings['oidc::redirect'] || String(new URL('/api/login/oidc/callback', config.API_URL)),
            scopes: settings['oidc::scopes'],
        };
    }

    function loginError(res: { redirect: (url: string) => void }, err: unknown): void {
        console.error('Error: OIDC Login:', err);

        // Duck-typed as `instanceof Err` is unreliable across module instances
        const message = err && typeof err === 'object' && 'safe' in err && typeof err.safe === 'string'
            ? err.safe
            : 'SSO Login Failed';
        res.redirect(`/login?sso_error=${encodeURIComponent(message)}`);
    }

    await schema.get('/login/oidc', {
        name: 'OIDC Login',
        group: 'Login',
        description: 'Redirect the browser to the configured OIDC Identity Provider to begin an SSO login',
        query: Type.Object({
            redirect: Type.Optional(Type.String({
                description: 'In-App location to navigate to after a successful login',
            })),
        }),
    }, async (req, res) => {
        try {
            const oidc = await oidcConfig();
            const disc = await discovery(oidc.discovery);

            const state = jwt.sign({
                t: 'oidc',
                ...(req.query.redirect ? { r: req.query.redirect } : {}),
            }, config.SigningSecret, { expiresIn: '10m' });

            res.redirect(authorizationUrl(disc, oidc, state));
        } catch (err) {
            loginError(res, err);
        }
    });

    await schema.get('/login/oidc/callback', {
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
        try {
            if (req.query.error) {
                throw new Err(401, null, req.query.error_description || req.query.error);
            } else if (!req.query.code || !req.query.state) {
                throw new Err(400, null, 'OIDC Callback is missing code or state');
            }

            let state: { t?: string; r?: string };
            try {
                state = jwt.verify(req.query.state, config.SigningSecret) as { t?: string; r?: string };
            } catch (err) {
                throw new Err(401, err instanceof Error ? err : null, 'Invalid OIDC State - Please try logging in again');
            }

            if (state.t !== 'oidc') throw new Err(401, null, 'Invalid OIDC State - Please try logging in again');

            if (!config.server.auth.key || !config.server.auth.cert || !config.server.webtak) {
                throw new Err(400, null, 'Server has not been configured');
            }

            const oidc = await oidcConfig();
            const disc = await discovery(oidc.discovery);

            const tokens = await exchangeCode(disc, oidc, req.query.code);
            const claims = await userinfo(disc, tokens.access_token);

            if (typeof claims.email !== 'string' || !claims.email) {
                throw new Err(400, null, 'OIDC UserInfo did not return an email claim');
            }

            const email = claims.email.toLowerCase();

            const provider = new Provider(config);
            await provider.loginOIDC(email, tokens.access_token);

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

            const profile = await config.models.Profile.from(email);

            let access = AuthUserAccess.USER;
            if (profile.system_admin) {
                access = AuthUserAccess.ADMIN;
            } else if (profile.agency_admin && profile.agency_admin.length) {
                access = AuthUserAccess.AGENCY;
            }

            const userAgent = req.headers['user-agent'] || '';
            const ua = UAParser(userAgent);

            const session = await config.models.ProfileSession.generate({
                username: profile.username,
                created: new Date().toISOString(),
                ip: String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown'),
                device_type: ua.device.type || 'Desktop',
                browser: [ua.browser.name, ua.browser.version].filter(Boolean).join(' ') || 'Unknown',
                os: [ua.os.name, ua.os.version].filter(Boolean).join(' ') || 'Unknown',
                user_agent: userAgent,
            });

            const payload = Buffer.from(JSON.stringify({
                access,
                email: profile.username,
                session: session.id,
                token: jwt.sign({ access, email: profile.username, s: session.id }, config.SigningSecret, { expiresIn: '16h' }),
                ...(state.r ? { redirect: state.r } : {}),
            })).toString('base64url');

            // The session is passed in the URL Fragment so it is never sent to the
            // server or written to access logs - the Login page consumes and clears it
            res.redirect(`/login#sso=${payload}`);
        } catch (err) {
            loginError(res, err);
        }
    });
}
