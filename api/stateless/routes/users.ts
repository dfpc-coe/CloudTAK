import { Type, Static } from '@sinclair/typebox';
import { sql, eq, asc, desc, getTableColumns } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../../common/auth.js';
import { ProfileResponse, ProfileListResponse, CertificateResponse } from '../../common/types.js';
import type ConfigStateless from '../config.js';
import { TAKRole, TAKGroup } from '@tak-ps/node-tak/lib/api/types';
import { Profile, ProfileSession } from '../../common/schema.js';
import * as Default from '../lib/limits.js';
import ProfileControl from '../lib/control/profile.js';
import Provider from '../lib/provider.js';

const UserResponse = Type.Composite([
    ProfileResponse,
    Type.Object({
        certificate: Type.Optional(CertificateResponse),
    }),
]);

const UserPatchBody = Type.Object({
    tak_callsign: Type.Optional(Type.String()),
    tak_remarks: Type.Optional(Type.String()),
    tak_group: Type.Optional(Type.Enum(TAKGroup)),
    tak_type: Type.Optional(Type.String()),
    tak_role: Type.Optional(Type.Enum(TAKRole)),

    system_admin: Type.Optional(Type.Boolean()),
});

type UserPatchBodyType = Static<typeof UserPatchBody>;
type UserPatchValue = UserPatchBodyType[keyof UserPatchBodyType];

export default async function router(schema: Schema, config: ConfigStateless) {
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
                enum: Object.keys(getTableColumns(Profile)),
            }),
            filter: Default.Filter,
            disabled: Type.Optional(Type.Boolean({
                description: 'Only return users that have (true) or have not (false) been deprovisioned',
            })),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(ProfileListResponse),
        }),
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const columns = getTableColumns(Profile);
            const column = columns[req.query.sort as keyof typeof columns];
            if (!column) throw new Err(400, null, `Invalid sort: ${req.query.sort}`);

            // Users that have never logged in (SCIM provisioned) sort after every real login
            let orderBy = req.query.order === 'desc' ? desc(column) : asc(column);
            if (req.query.sort === 'last_login') {
                orderBy = req.query.order === 'desc' ? sql`${column} DESC NULLS LAST` : sql`${column} ASC NULLS FIRST`;
            }

            const pgres = await config.models.Profile.pool.select({
                count: sql<string>`count(*) OVER()`.as('count'),
                profile: Profile,
            })
                .from(Profile)
                .where(sql`
                    (username ~* ${req.query.filter} OR name ~* ${req.query.filter})
                    ${req.query.disabled === undefined ? sql`` : sql`AND disabled = ${req.query.disabled}`}
                `)
                .orderBy(orderBy)
                .limit(req.query.limit)
                .offset(req.query.page * req.query.limit);

            const profiles = pgres.map(row => row.profile);
            const presence = await config.hub.wsPresence(profiles.map(user => user.username));

            res.json({
                total: pgres.length ? parseInt(pgres[0].count) : 0,
                items: profiles.map((user) => {
                    return {
                        active: presence[user.username].active,
                        certificate: Provider.certificate(user.auth?.cert),
                        ...user,
                        name: user.name || 'Unknown',
                    };
                }),
            });
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
        res: UserResponse,
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

            res.json({
                ...profile,
                certificate: Provider.certificate((await config.models.Profile.from(req.params.username)).auth?.cert),
            });
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
        res: UserResponse,
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const profile = await profileControl.from(req.params.username);

            const cert = (await config.models.Profile.from(req.params.username)).auth?.cert;
            const certificate = Provider.certificate(cert);

            if (certificate && cert) {
                // Best effort - the TAK Server revocation record supplements the local metadata
                try {
                    const status = await new Provider(config).status(cert);
                    if (status) {
                        certificate.known = status.known;
                        certificate.revoked = status.revoked;
                        certificate.revocationDate = status.revocationDate;
                    }
                } catch (err) {
                    console.error(err);
                }
            }

            res.json({
                ...profile,
                certificate,
            });
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
                enum: Object.keys(ProfileSession),
            }),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(Type.Object({
                id: Type.String(),
                username: Type.String(),
                created: Type.String(),
                ip: Type.String(),
                device_type: Type.String(),
                browser: Type.String(),
                os: Type.String(),
                user_agent: Type.String(),
                active: Type.Boolean(),
            })),
        }),
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

            const presence = await config.hub.wsPresence([req.params.username]);
            const activeSessions = new Set<string>(presence[req.params.username].sessions);

            res.json({
                total: list.total,
                items: list.items.map(item => ({
                    ...item,
                    active: activeSessions.has(item.id),
                })),
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
