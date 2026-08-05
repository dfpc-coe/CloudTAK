import { Type, Static } from '@sinclair/typebox';
import { StandardResponse, CoreEventResponse, CoreEventLink, CoreEventStyle, GeoJSONFeatureGeometryPoint } from '../../common/types.js';
import { sql, eq } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthUser, AuthResource, AuthResourceAccess } from '../../common/auth.js';
import { CoreEvent, CoreEventChannel } from '../../common/schema.js';
import { CoreEvent_Priority } from '../../common/enums.js';
import type ConfigStateless from '../config.js';
import { userChannels } from '../lib/tak-channels.js';
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: ConfigStateless) {
    /**
     * Resolve the Connection a Connection or Layer resource token belongs to
     */
    async function resourceConnection(auth: AuthResource): Promise<number> {
        if (auth.access === AuthResourceAccess.LAYER) {
            if (auth.id === undefined) throw new Err(401, null, 'Layer Resource Token must contain a Layer ID');
            const layer = await config.models.Layer.from(auth.id);
            if (layer.connection === null) throw new Err(401, null, 'Layer is not associated with a Connection');
            return layer.connection;
        } else {
            if (auth.id === undefined) throw new Err(401, null, 'Connection Resource Token must contain a Connection ID');
            const connection = await config.models.Connection.from(auth.id);
            return connection.id;
        }
    }

    /**
     * Is the requester the creator of the Event - the user that created it,
     * a System Admin, or a Connection/Layer token belonging to the Connection
     * that created it
     */
    function isEventCreator(auth: AuthUser | AuthResource, event: Static<typeof CoreEventResponse>, connection: number | null): boolean {
        if (auth instanceof AuthUser) {
            return auth.is_admin() || event.username === auth.email;
        } else {
            return connection !== null && event.connection === connection;
        }
    }

    /**
     * An Event is visible to its creator, System Admins, any user with an
     * active channel the Event has been shared with, and Connection/Layer
     * tokens belonging to the Connection that created it
     */
    async function ensureEventAccess(auth: AuthUser | AuthResource, event: Static<typeof CoreEventResponse>, connection: number | null): Promise<void> {
        if (isEventCreator(auth, event, connection)) return;

        if (auth instanceof AuthUser) {
            const shared = (event.channels || []).map(c => Number(c));
            if (shared.length) {
                const active = await userChannels(config, auth.email);
                if (shared.some(c => active.has(c))) return;
            }
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
            channel: Type.Optional(Type.Union([
                Type.Integer({ minimum: 0 }),
                Type.Array(Type.Integer({ minimum: 0 })),
            ], {
                description: 'Only return Events shared with the given TAK Channel bitpos - can be provided multiple times to match any of the given Channels',
            })),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(CoreEventResponse),
        }),
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION },
                    { access: AuthResourceAccess.LAYER },
                ],
            });

            const filterChannels = req.query.channel === undefined
                ? []
                : Array.isArray(req.query.channel) ? req.query.channel : [req.query.channel];

            const channel = filterChannels.length === 0
                ? sql`True`
                : sql`EXISTS (
                    SELECT 1
                    FROM core_event_channel
                    WHERE core_event_channel.event = core_event.id
                    AND core_event_channel.channel IN ${filterChannels}
                )`;

            let where;
            if (auth instanceof AuthResource) {
                const connection = await resourceConnection(auth);

                where = sql`
                    name ~* ${req.query.filter}
                    AND connection = ${connection}
                    AND ${channel}
                `;
            } else if (auth.is_admin()) {
                where = sql`
                    name ~* ${req.query.filter}
                    AND ${channel}
                `;
            } else {
                const user = auth;
                const channels = [...await userChannels(config, user.email)];

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
                        AND ${channel}
                    `
                    : sql`
                        name ~* ${req.query.filter}
                        AND username = ${user.email}
                        AND ${channel}
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
            const auth = await Auth.is_auth(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION },
                    { access: AuthResourceAccess.LAYER },
                ],
            });

            const connection = auth instanceof AuthResource ? await resourceConnection(auth) : null;

            const event = await config.models.CoreEvent.augmented_from(req.params.event);

            await ensureEventAccess(auth, event, connection);

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
            ended: Type.Optional(Type.Union([Type.Null(), Type.String({
                format: 'date-time',
                description: 'Time at which the Event ended',
            })])),
            external_id: Type.String({
                default: '',
                description: 'ID of the Event in an external system',
            }),
            editable: Type.Boolean({
                default: true,
                description: 'Can users other than the creator edit the Event',
            }),
            metadata: Type.Record(Type.String(), Type.Unknown(), {
                default: {},
                description: 'User defined key/value Event metadata',
            }),
            links: Type.Array(CoreEventLink, {
                default: [],
                description: 'Named URLs associated with the Event',
            }),
            style: Type.Object(CoreEventStyle.properties, {
                default: {},
                description: 'Point styling for the Event',
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
            const auth = await Auth.is_auth(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION },
                    { access: AuthResourceAccess.LAYER },
                ],
            });

            const { channels, ...body } = req.body;

            const event = await config.models.CoreEvent.generate({
                ...body,
                username: auth instanceof AuthUser ? auth.email : null,
                connection: auth instanceof AuthResource ? await resourceConnection(auth) : null,
            });

            if (channels.length > 0) {
                await config.pg.insert(CoreEventChannel)
                    .values(channels.map(ch => ({
                        event: event.id,
                        channel: BigInt(ch),
                    })));
            }

            // Best effort - a failed immediate submit is recovered by the
            // Admin Connection's next scheduled submit cycle
            config.hub.coreEventSubmit(event.id).catch((err) => {
                console.error(`not ok - failed to immediately submit Core Event ${event.id}:`, err);
            });

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
            mission_guid: Type.Optional(Type.Union([Type.Null(), Type.String({
                format: 'uuid',
            })], {
                description: 'GUID of a TAK Server Mission to associate with the Event - set to null to remove the association',
            })),
            priority: Type.Optional(Type.Enum(CoreEvent_Priority)),
            geometry: Type.Optional(GeoJSONFeatureGeometryPoint),
            location: Type.Optional(Type.String()),
            remarks: Type.Optional(Type.String()),
            active: Type.Optional(Type.Boolean({
                description: 'Set to false to end the Event - the ended timestamp is set automatically',
            })),
            ended: Type.Optional(Type.Union([Type.Null(), Type.String({
                format: 'date-time',
            })])),
            external_id: Type.Optional(Type.String()),
            editable: Type.Optional(Type.Boolean()),
            metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown(), {
                description: 'User defined key/value Event metadata - replaces the existing metadata object',
            })),
            links: Type.Optional(Type.Array(CoreEventLink, {
                description: 'Named URLs associated with the Event - replaces the existing links array',
            })),
            style: Type.Optional(Type.Object(CoreEventStyle.properties, {
                description: 'Point styling for the Event - replaces the existing style object',
            })),
            channels: Type.Optional(Type.Array(Type.Integer({ minimum: 0 }), { uniqueItems: true })),
        }),
        res: CoreEventResponse,
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION },
                    { access: AuthResourceAccess.LAYER },
                ],
            });

            const connection = auth instanceof AuthResource ? await resourceConnection(auth) : null;

            const event = await config.models.CoreEvent.augmented_from(req.params.event);

            await ensureEventAccess(auth, event, connection);

            const { channels, ...body } = req.body;

            const creator = isEventCreator(auth, event, connection);

            if (channels !== undefined && !creator) {
                throw new Err(403, null, 'Only the Event creator can modify sharing');
            }

            if (body.editable !== undefined && !creator) {
                throw new Err(403, null, 'Only the Event creator can modify the editable flag');
            }

            if (Object.keys(body).length > 0 && !event.editable && !creator) {
                throw new Err(403, null, 'The Event creator has disabled editing of this Event');
            }

            if (Object.keys(body).length > 0) {
                // An explicit ended in the body wins; an existing ended is
                // preserved so re-ending doesn't move the original end time
                let ended: typeof body.ended | ReturnType<typeof sql> = body.ended;
                if (body.ended === undefined) {
                    if (body.active === false && !event.ended) {
                        ended = sql`Now()`;
                    } else if (body.active === true) {
                        ended = null;
                    }
                }

                await config.models.CoreEvent.commit(req.params.event, {
                    ...body,
                    ...(ended === undefined ? {} : { ended }),
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

            if (Object.keys(body).length > 0 || channels !== undefined) {
                // Best effort - a failed immediate submit is recovered by the
                // next scheduled cycle; an ended Event ages out via stale
                config.hub.coreEventSubmit(req.params.event).catch((err) => {
                    console.error(`not ok - failed to immediately submit Core Event ${req.params.event}:`, err);
                });
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
