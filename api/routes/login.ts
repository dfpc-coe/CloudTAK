import jwt from 'jsonwebtoken';
import Err from '@openaddresses/batch-error';
import Auth, { AuthUserAccess } from '../lib/auth.js';
import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import { Type } from '@sinclair/typebox'
import Provider from '../lib/provider.js';
import { UAParser } from 'ua-parser-js';

export default async function router(schema: Schema, config: Config) {
    await schema.post('/login', {
        name: 'Create Login',
        group: 'Login',
        body: Type.Object({
            username: Type.String({
                description: 'Case-Sensitive username, if an email, the client MUST lowercase'
            }),
            password: Type.String()
        }),
        res: Type.Object({
            token: Type.String(),
            access: Type.Enum(AuthUserAccess),
            email: Type.String()
        })
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

                        await config.models.Profile.commit(email, {
                            ...response,
                            last_login: new Date().toISOString()
                        });
                    } catch (err) {
                        console.error(err);

                        await config.models.Profile.commit(email, {
                            last_login: new Date().toISOString()
                        });
                    }
                } else {
                    await config.models.Profile.commit(email, {
                        last_login: new Date().toISOString()
                    });
                }

                profile = await config.models.Profile.from(email);
            } else {
                throw new Err(400, null, 'Server has not been configured');
            }

            let access = AuthUserAccess.USER
            if (profile.system_admin) {
                access = AuthUserAccess.ADMIN
            } else if (profile.agency_admin && profile.agency_admin.length) {
                access = AuthUserAccess.AGENCY
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

            res.json({
                access,
                email: profile.username,
                token: jwt.sign({ access, email: profile.username, s: session.id }, config.SigningSecret, { expiresIn: '16h' })
            })
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/login', {
        name: 'Get Login',
        group: 'Login',
        res: Type.Object({
            email: Type.String(),
            access: Type.Enum(AuthUserAccess)
        })
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
                access: user.access
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
