import { Type } from '@sinclair/typebox';
import { StandardResponse, CoreEntityResponse, CoreEntityLink, CoreEntityStyle, CoreEntityMission, CoreEntityExternalIdInput, GeoJSONFeatureGeometryPoint } from '../../common/types.js';
import { sql, getTableColumns } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthUser, AuthResource, AuthResourceAccess } from '../../common/auth.js';
import { CoreEntity, CoreEntityEvent } from '../../common/schema.js';
import { sharedWith, setChannels, setExternalId, toExternalId } from '../../common/models/CoreEntity.js';
import { CoreEntity_Priority, LayerMapping_Destination } from '../../common/enums.js';
import type ConfigStateless from '../config.js';
import { userChannels } from '../../common/control/tak-channels.js';
import { notifyCoreEntity } from '../lib/core-entity.js';
import EventControl from '../lib/control/event.js';
import { placementResponse } from '../lib/control/board.js';
import { ETLEventAction } from '../../common/etl-events.js';
import { uniqueViolation } from '../lib/pg-error.js';
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: ConfigStateless) {
    const eventControl = new EventControl(config);
    const resourceConnection = eventControl.resourceConnection.bind(eventControl);
    const isEventCreator = eventControl.isEventCreator.bind(eventControl);
    const ensureEventAccess = eventControl.ensureEventAccess.bind(eventControl);

    await schema.get('/core/event', {
        name: 'List Events',
        group: 'CoreEvent',
        security: Auth.security('event:read', { connection: true }),
        description: 'List Core Events',
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({
                default: 'created',
                enum: Object.keys(getTableColumns(CoreEntity)).filter(key => key !== 'kind'),
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
            items: Type.Array(CoreEntityResponse),
        }),
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                scope: 'event:read',
                resources: [
                    { access: AuthResourceAccess.CONNECTION },
                    { access: AuthResourceAccess.LAYER },
                ],
            });

            const filterChannels = req.query.channel === undefined
                ? []
                : Array.isArray(req.query.channel) ? req.query.channel : [req.query.channel];

            const channel = filterChannels.length === 0 ? sql`True` : sharedWith(filterChannels);

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

                where = sql`
                    name ~* ${req.query.filter}
                    AND (username = ${user.email} OR ${sharedWith(channels)})
                    AND ${channel}
                `;
            }

            const list = await config.models.CoreEntity.augmented_list({
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
        security: Auth.security('event:read', { connection: true }),
        description: 'Get a Core Event',
        params: Type.Object({
            event: Type.String({
                format: 'uuid',
            }),
        }),
        res: CoreEntityResponse,
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                scope: 'event:read',
                resources: [
                    { access: AuthResourceAccess.CONNECTION },
                    { access: AuthResourceAccess.LAYER },
                ],
            });

            const connection = auth instanceof AuthResource ? await resourceConnection(auth) : null;

            const event = await config.models.CoreEntity.augmented_from(req.params.event);

            await ensureEventAccess(auth, event, connection);

            res.json(event);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/core/event', {
        name: 'Create Event',
        group: 'CoreEvent',
        security: Auth.security('event:create', { connection: true }),
        description: 'Create a new Core Event',
        body: Type.Object({
            name: Default.NameField,
            type: Type.String({
                description: 'MIL-STD-2525E Symbol ID',
            }),
            priority: Type.Enum(CoreEntity_Priority, {
                default: CoreEntity_Priority.NONE,
            }),
            geometry: GeoJSONFeatureGeometryPoint,
            location: Type.String({
                default: '',
                description: 'Human readable location of the Event - ie: an address',
            }),
            remarks: Type.String({
                default: '',
            }),
            started: Type.Optional(Type.String({
                format: 'date-time',
                description: 'Time at which the Event started - defaults to the time of creation',
            })),
            ended: Type.Optional(Type.Union([Type.Null(), Type.String({
                format: 'date-time',
                description: 'Time at which the Event ends - a future time keeps the Event active until then, omit for an open ended Event',
            })])),
            external_id: Type.Optional(CoreEntityExternalIdInput),
            editable: Type.Boolean({
                default: true,
                description: 'Can users other than the creator edit the Event',
            }),
            metadata: Type.Record(Type.String(), Type.Unknown(), {
                default: {},
                description: 'User defined key/value Event metadata',
            }),
            links: Type.Array(CoreEntityLink, {
                default: [],
                description: 'Named URLs associated with the Event',
            }),
            missions: Type.Array(CoreEntityMission, {
                default: [],
                description: 'TAK Server Missions associated with the Event',
            }),
            style: Type.Object(CoreEntityStyle.properties, {
                default: {},
                description: 'Point styling for the Event',
            }),
            channels: Type.Array(Type.Integer({ minimum: 0 }), {
                uniqueItems: true,
                minItems: 1,
                description: 'TAK Server Channels to share the Event with - at least one is required',
            }),
        }),
        res: CoreEntityResponse,
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                scope: 'event:create',
                resources: [
                    { access: AuthResourceAccess.CONNECTION },
                    { access: AuthResourceAccess.LAYER },
                ],
            });

            const { channels, external_id, ...body } = req.body;

            const connection = auth instanceof AuthResource ? await resourceConnection(auth) : null;

            const id = await config.pg.transaction(async (tx) => {
                const id = await config.models.CoreEntity.generateEvent({
                    ...body,
                    username: auth instanceof AuthUser ? auth.email : null,
                    connection,
                }, tx);

                await setChannels(tx, id, channels);

                if (external_id !== undefined) await setExternalId(tx, { id, kind: LayerMapping_Destination.COREENTITY, connection }, toExternalId(external_id));

                return id;
            }).catch(uniqueViolation('external_id is already used by another Event of the Connection'));

            const created = await config.models.CoreEntity.augmented_from(id);

            notifyCoreEntity(config, ETLEventAction.Create, created);

            res.json(created);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/core/event/:event', {
        name: 'Update Event',
        group: 'CoreEvent',
        security: Auth.security('event:update', { connection: true }),
        description: 'Update properties of a Core Event',
        params: Type.Object({
            event: Type.String({
                format: 'uuid',
            }),
        }),
        body: Type.Object({
            name: Type.Optional(Default.NameField),
            type: Type.Optional(Type.String()),
            missions: Type.Optional(Type.Array(CoreEntityMission, {
                description: 'TAK Server Missions associated with the Event - replaces the existing missions array',
            })),
            priority: Type.Optional(Type.Enum(CoreEntity_Priority)),
            geometry: Type.Optional(GeoJSONFeatureGeometryPoint),
            location: Type.Optional(Type.String()),
            remarks: Type.Optional(Type.String()),
            active: Type.Optional(Type.Boolean({
                description: 'Convenience over ended - false ends the Event now, true clears ended',
            })),
            started: Type.Optional(Type.String({
                format: 'date-time',
            })),
            ended: Type.Optional(Type.Union([Type.Null(), Type.String({
                format: 'date-time',
                description: 'Time at which the Event ends - push a future time out to keep the Event active, null leaves it open ended',
            })])),
            external_id: Type.Optional(CoreEntityExternalIdInput),
            editable: Type.Optional(Type.Boolean()),
            metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown(), {
                description: 'User defined key/value Event metadata - replaces the existing metadata object',
            })),
            links: Type.Optional(Type.Array(CoreEntityLink, {
                description: 'Named URLs associated with the Event - replaces the existing links array',
            })),
            style: Type.Optional(Type.Object(CoreEntityStyle.properties, {
                description: 'Point styling for the Event - replaces the existing style object',
            })),
            channels: Type.Optional(Type.Array(Type.Integer({ minimum: 0 }), {
                uniqueItems: true,
                minItems: 1,
                description: 'TAK Server Channels to share the Event with - replaces the existing Channels, an Event must always be shared with at least one',
            })),
        }),
        res: CoreEntityResponse,
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                scope: 'event:update',
                resources: [
                    { access: AuthResourceAccess.CONNECTION },
                    { access: AuthResourceAccess.LAYER },
                ],
            });

            const connection = auth instanceof AuthResource ? await resourceConnection(auth) : null;

            const event = await config.models.CoreEntity.augmented_from(req.params.event);

            await ensureEventAccess(auth, event, connection);

            const { channels, external_id, ...body } = req.body;

            const changed = Object.keys(body).length > 0 || external_id !== undefined;

            const creator = isEventCreator(auth, event, connection);

            if (channels !== undefined && !creator) {
                throw new Err(403, null, 'Only the Event creator can modify sharing');
            }

            if (body.editable !== undefined && !creator) {
                throw new Err(403, null, 'Only the Event creator can modify the editable flag');
            }

            if (changed && !event.editable && !creator) {
                throw new Err(403, null, 'The Event creator has disabled editing of this Event');
            }

            if (changed) {
                const { active, ...columns } = body;

                // An explicit ended in the body wins - ending an Event never
                // moves an end time that has already passed
                let ended: typeof body.ended | ReturnType<typeof sql> = body.ended;
                if (body.ended === undefined) {
                    if (active === false) {
                        ended = sql`LEAST(COALESCE(${CoreEntityEvent.ended}, Now()), Now())`;
                    } else if (active === true) {
                        ended = null;
                    }
                }

                await config.pg.transaction(async (tx) => {
                    await config.models.CoreEntity.commitEvent(req.params.event, {
                        ...columns,
                        ...(ended === undefined ? {} : { ended }),
                    }, tx);

                    if (external_id !== undefined) await setExternalId(tx, { id: event.id, kind: LayerMapping_Destination.COREENTITY, connection: event.connection }, toExternalId(external_id));
                }).catch(uniqueViolation('external_id is already used by another Event of the Connection'));
            }

            if (channels !== undefined) await setChannels(config.pg, req.params.event, channels);

            const updated = await config.models.CoreEntity.augmented_from(req.params.event);

            if (changed || channels !== undefined) {
                notifyCoreEntity(config, ETLEventAction.Update, updated);
            }

            res.json(updated);
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

            const event = await config.models.CoreEntity.augmented_from(req.params.event);

            if (!user.is_admin() && event.username !== user.email) {
                throw new Err(403, null, 'Only the Event creator can delete this Event');
            }

            // Deleting the Event cascades its Board placements, which subscribers see as removals
            const placements = await config.models.CoreEntityBoardEvent.placements(req.params.event);

            await config.models.CoreEntity.delete(req.params.event);

            config.etlEvents.event(ETLEventAction.Delete, event).catch((err) => {
                console.error(`not ok - failed to deliver delete ETL Event for Core Event ${event.id}:`, err);
            });

            for (const { placement, channel } of placements) {
                config.etlEvents.boardEvent(ETLEventAction.Delete, channel, placementResponse(placement, event)).catch((err) => {
                    console.error(`not ok - failed to deliver delete ETL Event for Placement ${placement.id}:`, err);
                });
            }

            res.json({ status: 200, message: 'Core Event Deleted' });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
