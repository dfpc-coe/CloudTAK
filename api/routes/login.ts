import jwt from 'jsonwebtoken';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
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
            username: Type.String(),
            password: Type.String()
        }),
        res: Type.Object({
            id: Type.Union([Type.Integer(), Type.Null()),
            token: Type.String(),
            access: Type.String(),
            email: Type.String()
        })
    }, async (req, res) => {
        try {
            const email = await provider.login(req.body.username, req.body.password);

            if (config.server.provider_url) {
                try {
                    const response = await config.external.login(email);

                    await config.models.Profile.commit(email, {
                        ...response,
                        last_login: new Date().toISOString()
                    });
                } catch (err) {
                    // If there are upstream errors the user is limited to WebTAK like functionality
                    await config.models.Profile.commit(email, { system_admin: false, agency_admin: [], last_login: new Date().toISOString() });
                    console.error(err);
                }
            } else {
                await config.models.Profile.commit(email, { last_login: new Date().toISOString() });
            }

            const profile = await config.models.Profile.from(email);

            const id = profile.id;
            const access = profile.system_admin ? 'admin' : 'user';

            return res.json({ id, access, email, token: jwt.sign({ access, email }, config.SigningSecret) })
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/login', {
        name: 'Get Login',
        group: 'Login',
        res: Type.Object({
            id: Type.Union([Type.Integer(), Type.Null()),
            email: Type.String(),
            access: Type.String()
        })
    }, async (req, res) => {
        const user = await Auth.as_user(config, req);

        try {
            return res.json({
                id: user.id,
                email: user.email,
                access: user.access
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
