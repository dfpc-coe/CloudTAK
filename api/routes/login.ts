import path from 'node:path';
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
import jwt from 'jsonwebtoken';
import { CookieJar, Cookie } from 'tough-cookie';
import { CookieAgent } from 'http-cookie-agent/undici';
import TAKAPI, { APIAuthPassword } from '../lib/tak-api.js';

export default async function router(schema: Schema, config: Config) {
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
            const url = new URL('/oauth/token', config.local ? 'http://localhost:5001' : config.MartiAPI);
            url.searchParams.append('grant_type', 'password');
            url.searchParams.append('username', req.body.username);
            url.searchParams.append('password', req.body.password);

            const authres = await fetch(url, {
                method: 'POST'
            });

            if (!authres.ok) {
                throw new Err(500, new Error(await authres.text()), 'Non-200 Response from Auth Server - Token');
            }

            const body = await authres.json();

            if (body.error === 'invalid_grant' && body.error_description.startsWith('Bad credentials')) {
                throw new Err(400, null, 'Invalid Username or Password');
            } else if (body.error || !body.access_token) {
                throw new Err(500, new Error(body.error_description), 'Unknown Login Error');
            }

            if (config.AuthGroup) {
                const url = new URL('/Marti/api/groups/all', config.local ? 'http://localhost:5001' : config.MartiAPI);

                const jar = new CookieJar();
                await jar.setCookie(new Cookie({
                    key: 'access_token',
                    value: body.access_token
                }), config.local ? 'http://localhost:5001' : config.MartiAPI);

                const agent = new CookieAgent({ cookies: { jar } });

                const groupres = await fetch(url, {
                    credentials: 'include',
                    // @ts-expect-error
                    dispatcher: agent
                });

                if (!groupres.ok) {
                    throw new Err(500, new Error(await authres.text()), 'Non-200 Response from Auth Server - Groups');
                }

                const gbody: {
                    data: Array<{
                        name: string;
                    }>
                }= await groupres.json();

                const groups = gbody.data.map((d: {
                    name: string
                }) => {
                    return d.name
                });

                if (!groups.includes(config.AuthGroup)) {
                    throw new Err(403, null, 'Insufficient Group Privileges');
                }
            }

            const split = Buffer.from(body.access_token, 'base64').toString().split('}').map((ext) => { return ext + '}'});
            if (split.length < 2) throw new Err(500, null, 'Unexpected TAK JWT Format');
            const contents: { sub: string; aud: string; nbf: number; exp: number; iat: number; } = JSON.parse(split[1]);

            try {
                await config.models.Profile.from(req.body.username);
            } catch (err) {
                if (err instanceof Err && err.status === 404) {
                    const api = await TAKAPI.init(new URL(config.MartiAPI), new APIAuthPassword(req.body.username, req.body.password));

                    await config.models.Profile.generate({
                        username: req.body.username,
                        auth: await api.Credentials.generate()
                    });
                } else {
                    return console.error(err);
                }
            }


            return res.json({
                access: 'user',
                token: jwt.sign({ access: 'user', email: contents.sub }, this.secret),
                email: contents.sub
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/login', {
        name: 'Get Login',
        group: 'Login',
        res: Type.Object({
            access: Type.String()
        })
    }, async (req, res) => {
        const auth = await Auth.is_auth(config, req);

        try {
            return res.json({
                access: auth.access
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
