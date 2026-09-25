import Err from '@openaddresses/batch-error';
import Auth, { AuthUserAccess } from '../../common/auth.js';
import type ConfigStateless from '../config.js';
import Schema from '@openaddresses/batch-schema';
import { Type } from '@sinclair/typebox';
import Provider from '../lib/provider.js';
import { LoginResponse, issueSession, refreshSession } from '../lib/user/session.js';

export default async function router(schema: Schema, config: ConfigStateless) {
    await schema.post('/login', {
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
            const oidc = await config.models.Setting.typedMany({
                'oidc::enabled': false,
                'oidc::enforced': false,
            });

            if (oidc['oidc::enabled'] && oidc['oidc::enforced']) {
                throw new Err(403, null, 'Username/Password login is disabled - Please use SSO');
            }

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
            } else {
                throw new Err(400, null, 'Server has not been configured');
            }

            res.json(await issueSession(config, req, profile));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/login/refresh', {
        name: 'Refresh Login',
        group: 'Login',
        description: 'Exchange a refresh token for a new login token - the refresh token is single use and a replacement is returned',
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
}
