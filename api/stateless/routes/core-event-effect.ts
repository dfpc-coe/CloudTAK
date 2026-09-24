import { Type } from '@sinclair/typebox';
import { StandardResponse, CoreEventEffectResponse } from '../../common/types.js';
import { sql } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthResource, AuthResourceAccess } from '../../common/auth.js';
import { CoreEventEffect } from '../../common/schema.js';
import { CoreEventEffect_Status } from '../../common/enums.js';
import type ConfigStateless from '../config.js';
import EventControl from '../lib/control/event.js';
import DeviceControl from '../lib/control/device.js';
import * as Default from '../lib/limits.js';

/**
 * Devices acting on a Core Event - a token needs both the Event scope and
 * the Effect scope for an operation
 */
export default async function router(schema: Schema, config: ConfigStateless) {
    const eventControl = new EventControl(config);
    const deviceControl = new DeviceControl(config);

    const resources = [
        { access: AuthResourceAccess.CONNECTION },
        { access: AuthResourceAccess.LAYER },
    ];

    const EventParam = Type.Object({
        event: Type.String({ format: 'uuid' }),
    });

    const EffectParam = Type.Object({
        event: Type.String({ format: 'uuid' }),
        effect: Type.String({ format: 'uuid' }),
    });

    /** Load an Effect, ensuring it belongs to the Event in the URL */
    async function loadEffect(event: string, effect: string) {
        const loaded = await config.models.CoreEventEffect.from(effect);
        if (loaded.event !== event) throw new Err(404, null, 'Effect does not belong to this Event');
        return loaded;
    }

    await schema.get('/core/event/:event/effect', {
        name: 'List Effects',
        group: 'CoreEventEffect',
        security: Auth.security(['event:read', 'effect:read'], { connection: true }),
        description: 'List the Devices acting on a Core Event',
        params: EventParam,
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({
                default: 'created',
                enum: Object.keys(CoreEventEffect),
            }),
            filter: Default.Filter,
            status: Type.Optional(Type.Enum(CoreEventEffect_Status, {
                description: 'Only return Effects in the given status',
            })),
            device: Type.Optional(Type.String({
                format: 'uuid',
                description: 'Only return Effects of the given Device',
            })),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(CoreEventEffectResponse),
        }),
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                scope: ['event:read', 'effect:read'],
                resources,
            });

            const connection = auth instanceof AuthResource ? await eventControl.resourceConnection(auth) : null;
            const event = await config.models.CoreEvent.augmented_from(req.params.event);
            await eventControl.ensureEventAccess(auth, event, connection);

            const status = req.query.status === undefined ? sql`True` : sql`status = ${req.query.status}`;
            const device = req.query.device === undefined ? sql`True` : sql`device = ${req.query.device}`;

            const list = await config.models.CoreEventEffect.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    event = ${req.params.event}
                    AND action ~* ${req.query.filter}
                    AND ${status}
                    AND ${device}
                `,
            });

            res.json(list);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/core/event/:event/effect/:effect', {
        name: 'Get Effect',
        group: 'CoreEventEffect',
        security: Auth.security(['event:read', 'effect:read'], { connection: true }),
        description: 'Get a Device acting on a Core Event',
        params: EffectParam,
        res: CoreEventEffectResponse,
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                scope: ['event:read', 'effect:read'],
                resources,
            });

            const connection = auth instanceof AuthResource ? await eventControl.resourceConnection(auth) : null;
            const event = await config.models.CoreEvent.augmented_from(req.params.event);
            await eventControl.ensureEventAccess(auth, event, connection);

            res.json(await loadEffect(req.params.event, req.params.effect));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/core/event/:event/effect', {
        name: 'Create Effect',
        group: 'CoreEventEffect',
        security: Auth.security(['event:update', 'effect:create'], { connection: true }),
        description: 'Task a Device to act on a Core Event',
        params: EventParam,
        body: Type.Object({
            device: Type.String({
                format: 'uuid',
                description: 'Core Device acting on the Event',
            }),
            action: Type.String({
                minLength: 1,
                description: 'What the Device is doing - ie: navigate to, loiter',
            }),
            status: Type.Enum(CoreEventEffect_Status, {
                default: CoreEventEffect_Status.TASKED,
            }),
            started: Type.Optional(Type.String({
                format: 'date-time',
                description: 'Time at which the Device began acting on the Event - defaults to the time of creation',
            })),
            ended: Type.Optional(Type.Union([Type.Null(), Type.String({
                format: 'date-time',
                description: 'Time at which the Device stopped acting on the Event',
            })])),
            metadata: Type.Record(Type.String(), Type.Unknown(), {
                default: {},
                description: 'Action specific parameters - ie: loiter radius',
            }),
        }),
        res: CoreEventEffectResponse,
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                scope: ['event:update', 'effect:create'],
                resources,
            });

            const connection = auth instanceof AuthResource ? await eventControl.resourceConnection(auth) : null;
            const event = await config.models.CoreEvent.augmented_from(req.params.event);
            await eventControl.ensureEventEditable(auth, event, connection);

            const device = await config.models.CoreDevice.augmented_from(req.body.device);
            await deviceControl.ensureDeviceAccess(auth, device, connection);

            const effect = await config.models.CoreEventEffect.generate({
                ...req.body,
                event: req.params.event,
            });

            res.json(effect);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/core/event/:event/effect/:effect', {
        name: 'Update Effect',
        group: 'CoreEventEffect',
        security: Auth.security(['event:update', 'effect:update'], { connection: true }),
        description: 'Update a Device acting on a Core Event',
        params: EffectParam,
        body: Type.Object({
            action: Type.Optional(Type.String({ minLength: 1 })),
            status: Type.Optional(Type.Enum(CoreEventEffect_Status)),
            started: Type.Optional(Type.String({
                format: 'date-time',
            })),
            ended: Type.Optional(Type.Union([Type.Null(), Type.String({
                format: 'date-time',
            })])),
            metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown(), {
                description: 'Action specific parameters - replaces the existing metadata object',
            })),
        }),
        res: CoreEventEffectResponse,
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                scope: ['event:update', 'effect:update'],
                resources,
            });

            const connection = auth instanceof AuthResource ? await eventControl.resourceConnection(auth) : null;
            const event = await config.models.CoreEvent.augmented_from(req.params.event);
            await eventControl.ensureEventEditable(auth, event, connection);

            await loadEffect(req.params.event, req.params.effect);

            const effect = await config.models.CoreEventEffect.commit(req.params.effect, {
                ...req.body,
                updated: sql`Now()`,
            });

            res.json(effect);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/core/event/:event/effect/:effect', {
        name: 'Delete Effect',
        group: 'CoreEventEffect',
        security: Auth.security(['event:update', 'effect:delete'], { connection: true }),
        description: 'Remove a Device acting on a Core Event',
        params: EffectParam,
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                scope: ['event:update', 'effect:delete'],
                resources,
            });

            const connection = auth instanceof AuthResource ? await eventControl.resourceConnection(auth) : null;
            const event = await config.models.CoreEvent.augmented_from(req.params.event);
            await eventControl.ensureEventEditable(auth, event, connection);

            await loadEffect(req.params.event, req.params.effect);

            await config.models.CoreEventEffect.delete(req.params.effect);

            res.json({ status: 200, message: 'Effect Deleted' });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
