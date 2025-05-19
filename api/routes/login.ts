import jwt from 'jsonwebtoken';
import Err from '@openaddresses/batch-error';
import Auth, { AuthUserAccess } from '../lib/auth.js';
import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import { Type } from '@sinclair/typebox'
import Provider from '../lib/provider.js';

export default async function router(schema: Schema, config: Config) {
    const provider = new Provider(config);

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
            let profile;

            if (config.server.auth.key && config.server.auth.cert) {
                const email = await provider.login(req.body.username, req.body.password);

                if (config.external && config.external.configured) {
                    try {
                        const response = await config.external.login(email);

                        await config.models.Profile.commit(email, {
                            ...response,
                            last_login: new Date().toISOString()
                        });
                    } catch (err) {
                        console.error(err);

                        // If there are upstream errors the user is limited to WebTAK like functionality
                        await config.models.Profile.commit(email, {
                            system_admin: false,
                            agency_admin: [],
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

            res.json({
                access,
                email: profile.username,
                token: jwt.sign({ access, email: profile.username }, config.SigningSecret, { expiresIn: '16h' })
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
