import { Type, Static } from '@sinclair/typebox';
import { StandardResponse, CoreEventResponse, GeoJSONFeatureGeometryPoint } from '../../common/types.js';
import { sql, eq } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthUser } from '../../common/auth.js';
import { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak';
import { CoreEvent, CoreEventChannel } from '../../common/schema.js';
import { CoreEvent_Priority } from '../../common/enums.js';
import type ConfigStateless from '../config.js';
import activeChannels from '../lib/tak-channels.js';
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: ConfigStateless) {
    async function userChannels(email: string): Promise<Set<number>> {
        const profile = await config.models.Profile.from(email);
        const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));
        return await activeChannels(api);
    }

    /**
     * An Event is visible to its creator, System Admins, and any user with an
     * active channel the Event has been shared with
     */
    async function ensureEventAccess(user: AuthUser, event: Static<typeof CoreEventResponse>): Promise<void> {
        if (user.is_admin() || event.username === user.email) return;

        const shared = (event.channels || []).map(c => Number(c));
        if (shared.length) {
            const active = await userChannels(user.email);
            if (shared.some(c => active.has(c))) return;
        }

        throw new Err(403, null, 'You do not have permission to access this Event');
    }

    await schema.get('/core/event', {
        name: 'List Events',
        group: 'CoreEvent',
        description: 'List Core Events',
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({
                default: 'created',
                enum: Object.keys(CoreEvent),
            }),
            filter: Default.Filter,
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(CoreEventResponse),
        }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            let where;
            if (user.is_admin()) {
                where = sql`name ~* ${req.query.filter}`;
            } else {
                const channels = [...await userChannels(user.email)];

                where = channels.length
                    ? sql`
                        name ~* ${req.query.filter}
                        AND (
                            username = ${user.email}
                            OR EXISTS (
                                SELECT 1
                                FROM core_event_channel
                                WHERE core_event_channel.event = core_event.id
                                AND core_event_channel.channel IN ${channels}
                            )
                        )
                    `
                    : sql`
                        name ~* ${req.query.filter}
                        AND username = ${user.email}
                    `;
            }

            const list = await config.models.CoreEvent.augmented_list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where,
            });

            res.json(list);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/core/event/:event', {
        name: 'Get Event',
        group: 'CoreEvent',
        description: 'Get a Core Event',
        params: Type.Object({
            event: Type.String({
                format: 'uuid',
            }),
        }),
        res: CoreEventResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const event = await config.models.CoreEvent.augmented_from(req.params.event);

            await ensureEventAccess(user, event);

            res.json(event);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/core/event', {
        name: 'Create Event',
        group: 'CoreEvent',
        description: 'Create a new Core Event',
        body: Type.Object({
            name: Default.NameField,
            type: Type.String({
                description: 'MIL-STD-2525E Symbol ID',
            }),
            priority: Type.Enum(CoreEvent_Priority, {
                default: CoreEvent_Priority.NONE,
            }),
            geometry: GeoJSONFeatureGeometryPoint,
            location: Type.String({
                default: '',
                description: 'Human readable location of the Event - ie: an address',
            }),
            remarks: Type.String({
                default: '',
            }),
            channels: Type.Array(Type.Integer({ minimum: 0 }), {
                uniqueItems: true,
                default: [],
                description: 'TAK Server Channels to share the Event with',
            }),
        }),
        res: CoreEventResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const { channels, ...body } = req.body;

            const event = await config.models.CoreEvent.generate({
                ...body,
                username: user.email,
            });

            if (channels.length > 0) {
                await config.pg.insert(CoreEventChannel)
                    .values(channels.map(ch => ({
                        event: event.id,
                        channel: BigInt(ch),
                    })));
            }

            res.json(await config.models.CoreEvent.augmented_from(event.id));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/core/event/:event', {
        name: 'Update Event',
        group: 'CoreEvent',
        description: 'Update properties of a Core Event',
        params: Type.Object({
            event: Type.String({
                format: 'uuid',
            }),
        }),
        body: Type.Object({
            name: Type.Optional(Default.NameField),
            type: Type.Optional(Type.String()),
            priority: Type.Optional(Type.Enum(CoreEvent_Priority)),
            geometry: Type.Optional(GeoJSONFeatureGeometryPoint),
            location: Type.Optional(Type.String()),
            remarks: Type.Optional(Type.String()),
            channels: Type.Optional(Type.Array(Type.Integer({ minimum: 0 }), { uniqueItems: true })),
        }),
        res: CoreEventResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const event = await config.models.CoreEvent.augmented_from(req.params.event);

            await ensureEventAccess(user, event);

            const { channels, ...body } = req.body;

            if (channels !== undefined && !user.is_admin() && event.username !== user.email) {
                throw new Err(403, null, 'Only the Event creator can modify sharing');
            }

            if (Object.keys(body).length > 0) {
                await config.models.CoreEvent.commit(req.params.event, {
                    ...body,
                    updated: sql`Now()`,
                });
            }

            if (channels !== undefined) {
                await config.pg.delete(CoreEventChannel)
                    .where(eq(CoreEventChannel.event, req.params.event));

                if (channels.length > 0) {
                    await config.pg.insert(CoreEventChannel)
                        .values(channels.map(ch => ({
                            event: req.params.event,
                            channel: BigInt(ch),
                        })));
                }
            }

            res.json(await config.models.CoreEvent.augmented_from(req.params.event));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/core/event/:event', {
        name: 'Delete Event',
        group: 'CoreEvent',
        description: 'Delete a Core Event',
        params: Type.Object({
            event: Type.String({
                format: 'uuid',
            }),
        }),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const event = await config.models.CoreEvent.from(req.params.event);

            if (!user.is_admin() && event.username !== user.email) {
                throw new Err(403, null, 'Only the Event creator can delete this Event');
            }

            await config.models.CoreEvent.delete(req.params.event);

            res.json({ status: 200, message: 'Core Event Deleted' });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
