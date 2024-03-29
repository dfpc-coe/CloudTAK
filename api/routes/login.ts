import path from 'node:path';
import jwt from 'jsonwebtoken';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Cacher from '../lib/cacher.js';
import busboy from 'busboy';
import Config from '../lib/config.js';
import xml2js from 'xml2js';
import { Readable } from 'node:stream';
import stream2buffer from '../lib/stream.js';
import bboxPolygon from '@turf/bbox-polygon';
import { Param, GenericListOrder } from '@openaddresses/batch-generic'
import { sql } from 'drizzle-orm';
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
            token: Type.String(),
            access: Type.String(),
            email: Type.String()
        })
    }, async (req, res) => {
        try {
            const email = await provider.login(req.body.username, req.body.password);

            if (config.server.provider_url) {
                try {
                    const response = await provider.external(email);

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

            const access = profile.system_admin ? 'admin' : 'user';

            return res.json({ access, email, token: jwt.sign({ access, email }, config.SigningSecret) })
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/login', {
        name: 'Get Login',
        group: 'Login',
        res: Type.Object({
            email: Type.String(),
            access: Type.String()
        })
    }, async (req, res) => {
        const user = await Auth.as_user(config, req);

        try {
            return res.json({
                email: user.email,
                access: user.access
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
