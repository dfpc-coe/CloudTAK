import { Type, Static } from '@sinclair/typebox'
import { sql, eq } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { ProfileResponse, ProfileListResponse } from '../lib/types.js'
import Config from '../lib/config.js';
import { TAKRole, TAKGroup } from '@tak-ps/node-tak/lib/api/types'
import { Profile, ProfileSession } from '../lib/schema.js';
import * as Default from '../lib/limits.js';
import ProfileControl from '../lib/control/profile.js';

const UserPatchBody = Type.Object({
    tak_callsign: Type.Optional(Type.String()),
    tak_remarks: Type.Optional(Type.String()),
    tak_group: Type.Optional(Type.Enum(TAKGroup)),
    tak_type: Type.Optional(Type.String()),
    tak_role: Type.Optional(Type.Enum(TAKRole)),

    system_admin: Type.Optional(Type.Boolean())
});

type UserPatchBodyType = Static<typeof UserPatchBody>;
type UserPatchValue = UserPatchBodyType[keyof UserPatchBodyType];

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
        body: UserPatchBody,
        res: ProfileResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const profileBody = req.body as UserPatchBodyType;
            const profile_body: { system_admin?: boolean } = {};
            const profile_config: Record<string, UserPatchValue> = {};

            for (const key of Object.keys(profileBody) as Array<keyof UserPatchBodyType>) {
                if (key === 'system_admin') {
                     profile_body.system_admin = profileBody[key];
                } else {
                     profile_config[String(key).replace('_', '::')] = profileBody[key];
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

    await schema.get('/user/:username/session', {
        name: 'List User Sessions',
        group: 'User',
        description: 'Let Admins list login sessions for a given user',
        params: Type.Object({
            username: Type.String(),
        }),
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({
                default: 'created',
                enum: Object.keys(ProfileSession)
            }),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(Type.Object({
                id: Type.Integer(),
                username: Type.String(),
                created: Type.String(),
                ip: Type.String(),
                device_type: Type.String(),
                browser: Type.String(),
                os: Type.String(),
                user_agent: Type.String(),
                active: Type.Boolean(),
            }))
        })
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const list = await config.models.ProfileSession.list({
                limit: req.query.limit,
                page: req.query.page,
                sort: req.query.sort,
                order: req.query.order,
                where: eq(ProfileSession.username, req.params.username),
            });

            const activeSessions = new Set<number>();
            for (const client of config.wsClients.get(req.params.username) || []) {
                if (client.session !== undefined) activeSessions.add(client.session);
            }

            res.json({
                total: list.total,
                items: list.items.map((item) => ({
                    ...item,
                    active: activeSessions.has(item.id),
                }))
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
