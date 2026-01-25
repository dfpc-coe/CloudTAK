import { Type } from '@sinclair/typebox'
import { sql } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { ProfileResponse, ProfileListResponse } from '../lib/types.js'
import Config from '../lib/config.js';
import { TAKRole, TAKGroup } from '@tak-ps/node-tak/lib/api/types'
import { Profile } from '../lib/schema.js';
import * as Default from '../lib/limits.js';
import ProfileControl from '../lib/control/profile.js';

export default async function router(schema: Schema, config: Config) {
    const profileControl = new ProfileControl(config);

    await schema.get('/user', {
        name: 'List Users',
        group: 'User',
        description: 'Let Admins see users of the system',
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({
                default: 'last_login',
                enum: Object.keys(Profile)
            }),
            filter: Default.Filter
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(ProfileListResponse)
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

            list.items = list.items.map((user) => {
                return {
                    active: config.wsClients.has(user.username),
                    ...user
                }
            });

            // @ts-expect-error Update Batch-Generic to specify actual geometry type (Point) instead of Geometry
            res.json(list);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.patch('/user/:username', {
        name: 'Update User',
        group: 'User',
        description: 'Update a User',
        params: Type.Object({
            username: Type.String(),
        }),
        body: Type.Object({
            tak_callsign: Type.Optional(Type.String()),
            tak_remarks: Type.Optional(Type.String()),
            tak_group: Type.Optional(Type.Enum(TAKGroup)),
            tak_type: Type.Optional(Type.String()),
            tak_role: Type.Optional(Type.Enum(TAKRole)),

            system_admin: Type.Optional(Type.Boolean())
        }),
        res: ProfileResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const profile_body: any = {};
            const profile_config: any = {};

            for (const key of Object.keys(req.body)) {
                if (key === 'system_admin') {
                     profile_body[key] = (req.body as any)[key];
                } else {
                     profile_config[key.replace('_', '::')] = (req.body as any)[key];
                }
            }

            if (Object.keys(profile_body).length) {
                await config.models.Profile.commit(req.params.username, profile_body);
            }

            if (Object.keys(profile_config).length) {
                await config.models.ProfileConfig.commit(req.params.username, profile_config);
            }

            const profile = await profileControl.from(req.params.username);

            res.json(profile);
        } catch (err) {
             Err.respond(err, res);
        }
    });

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

            const profile = await profileControl.from(req.params.username);

            res.json(profile);
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
