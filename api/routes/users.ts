import { Type } from '@sinclair/typebox'
import { sql } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { ProfileResponse } from '../lib/types.js'
import Config from '../lib/config.js';
import { Profile } from '../lib/schema.js';
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/user', {
        name: 'List Users',
        group: 'User',
        description: 'Let Admins see users of the system',
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.Optional(Type.String({default: 'last_login', enum: Object.keys(Profile)})),
            filter: Default.Filter
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(ProfileResponse)
        })
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const list = await config.models.Profile.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    username ~* ${req.query.filter}
                `
            });

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/user', {
        name: 'Create User',
        group: 'User',
        description: 'Create a new user - Used on initial server configuraiton for creating the first administrator',
        body: Type.Object({
            name: Type.String(),
            password: Type.String(),
            username: Type.String(),
            phone: Type.Optional(Type.String()),
        }),
        res: ProfileResponse
    }, async (req, res) => {
        try {
            let user;
            if (config.configure && !config.server.auth.key && !config.server.auth.cert) {

                user = await config.models.Profile.generate({
                    ...req.body,
                    auth: {},
                    system_admin: true
                });

                config.configure = false;
            } else {
                await Auth.as_user(config, req, { admin: true });

                user = await config.models.Profile.generate({
                    ...req.body,
                    auth: {},
                });
            }

            return res.json({
                ...user,
                agency_admin: user.agency_admin || []
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    })

    await schema.get('/user/:username', {
        name: 'Get User',
        group: 'User',
        description: 'Let Admins see a given user of the system',
        params: Type.Object({
            username: Type.String(),
        }),
        res: ProfileResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const user = await config.models.Profile.from(req.params.username);

            return res.json({
                ...user,
                agency_admin: user.agency_admin || []
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
