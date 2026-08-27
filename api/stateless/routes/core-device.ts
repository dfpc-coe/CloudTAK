import { Type } from '@sinclair/typebox';
import { StandardResponse, CoreDeviceResponse } from '../../common/types.js';
import { sql, eq } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthUser, AuthResource, AuthResourceAccess } from '../../common/auth.js';
import { CoreDevice, CoreDeviceChannel } from '../../common/schema.js';
import type ConfigStateless from '../config.js';
import { userChannels } from '../lib/tak-channels.js';
import DeviceControl from '../lib/control/device.js';
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: ConfigStateless) {
    const deviceControl = new DeviceControl(config);

    await schema.get('/core/device', {
        name: 'List Devices',
        group: 'CoreDevice',
        security: Auth.security('device:read', { connection: true }),
        description: 'List Core Devices',
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({
                default: 'created',
                enum: Object.keys(CoreDevice),
            }),
            filter: Default.Filter,
            event: Type.Optional(Type.String({
                format: 'uuid',
                description: 'Only return Devices assigned to the given Core Event',
            })),
            channel: Type.Optional(Type.Union([
                Type.Integer({ minimum: 0 }),
                Type.Array(Type.Integer({ minimum: 0 })),
            ], {
                description: 'Only return Devices shared with the given TAK Channel bitpos - can be provided multiple times to match any of the given Channels',
            })),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(CoreDeviceResponse),
        }),
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                scope: 'device:read',
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
                    FROM core_device_channel
                    WHERE core_device_channel.device = core_device.id
                    AND core_device_channel.channel IN ${filterChannels}
                )`;

            const event = req.query.event === undefined
                ? sql`True`
                : sql`event = ${req.query.event}`;

            let where;
            if (auth instanceof AuthResource) {
                const connection = await deviceControl.resourceConnection(auth);

                where = sql`
                    name ~* ${req.query.filter}
                    AND connection = ${connection}
                    AND ${channel}
                    AND ${event}
                `;
            } else if (auth.is_admin()) {
                where = sql`
                    name ~* ${req.query.filter}
                    AND ${channel}
                    AND ${event}
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
                                FROM core_device_channel
                                WHERE core_device_channel.device = core_device.id
                                AND core_device_channel.channel IN ${channels}
                            )
                        )
                        AND ${channel}
                        AND ${event}
                    `
                    : sql`
                        name ~* ${req.query.filter}
                        AND username = ${user.email}
                        AND ${channel}
                        AND ${event}
                    `;
            }

            const list = await config.models.CoreDevice.augmented_list({
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

    await schema.get('/core/device/:device', {
        name: 'Get Device',
        group: 'CoreDevice',
        security: Auth.security('device:read', { connection: true }),
        description: 'Get a Core Device',
        params: Type.Object({
            device: Type.String({
                format: 'uuid',
            }),
        }),
        res: CoreDeviceResponse,
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                scope: 'device:read',
                resources: [
                    { access: AuthResourceAccess.CONNECTION },
                    { access: AuthResourceAccess.LAYER },
                ],
            });

            const connection = auth instanceof AuthResource ? await deviceControl.resourceConnection(auth) : null;

            const device = await config.models.CoreDevice.augmented_from(req.params.device);

            await deviceControl.ensureDeviceAccess(auth, device, connection);

            res.json(device);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/core/device', {
        name: 'Create Device',
        group: 'CoreDevice',
        security: Auth.security('device:create', { connection: true }),
        description: 'Create a new Core Device',
        body: Type.Object({
            name: Default.NameField,
            type: Type.String({
                description: 'MIL-STD-2525E Symbol ID',
            }),
            event: Type.Optional(Type.Union([Type.Null(), Type.String({
                format: 'uuid',
            })], {
                description: 'Core Event to assign the Device to',
            })),
            manufacturer: Type.String({
                default: '',
                description: 'Manufacturer of the Device - ie: Ortec, Nucsafe, DJI',
            }),
            model: Type.String({
                default: '',
                description: 'Model of the Device - ie: Micro Detective, IdentiFINDER 2',
            }),
            serial: Type.String({
                default: '',
                description: 'Manufacturer assigned Serial Number',
            }),
            firmware: Type.String({
                default: '',
                description: 'Firmware/Software revision reported by the Device',
            }),
            status: Type.String({
                default: '',
                description: 'General Device health status - ie: Full, Reduced, Unknown',
            }),
            battery: Type.Optional(Type.Union([Type.Null(), Type.Number({
                minimum: 0,
                maximum: 100,
            })], {
                description: 'Battery level as a percentage (0-100) at last report',
            })),
            simulated: Type.Boolean({
                default: false,
                description: 'Is the Device a simulated data source',
            }),
            external_id: Type.String({
                default: '',
                description: 'ID of the Device in an external system',
            }),
            remarks: Type.String({
                default: '',
            }),
            metadata: Type.Record(Type.String(), Type.Unknown(), {
                default: {},
                description: 'User defined key/value Device metadata',
            }),
            channels: Type.Array(Type.Integer({ minimum: 0 }), {
                uniqueItems: true,
                default: [],
                description: 'TAK Server Channels to share the Device with',
            }),
        }),
        res: CoreDeviceResponse,
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                scope: 'device:create',
                resources: [
                    { access: AuthResourceAccess.CONNECTION },
                    { access: AuthResourceAccess.LAYER },
                ],
            });

            const { channels, ...body } = req.body;

            if (body.event) await deviceControl.ensureEventExists(body.event);

            const device = await config.models.CoreDevice.generate({
                ...body,
                username: auth instanceof AuthUser ? auth.email : null,
                connection: auth instanceof AuthResource ? await deviceControl.resourceConnection(auth) : null,
            });

            if (channels.length > 0) {
                await config.pg.insert(CoreDeviceChannel)
                    .values(channels.map(ch => ({
                        device: device.id,
                        channel: BigInt(ch),
                    })));
            }

            res.json(await config.models.CoreDevice.augmented_from(device.id));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/core/device/:device', {
        name: 'Update Device',
        group: 'CoreDevice',
        security: Auth.security('device:update', { connection: true }),
        description: 'Update properties of a Core Device - only the Device creator can make changes',
        params: Type.Object({
            device: Type.String({
                format: 'uuid',
            }),
        }),
        body: Type.Object({
            name: Type.Optional(Default.NameField),
            type: Type.Optional(Type.String()),
            event: Type.Optional(Type.Union([Type.Null(), Type.String({
                format: 'uuid',
            })], {
                description: 'Core Event to assign the Device to - set to null to unassign',
            })),
            manufacturer: Type.Optional(Type.String()),
            model: Type.Optional(Type.String()),
            serial: Type.Optional(Type.String()),
            firmware: Type.Optional(Type.String()),
            status: Type.Optional(Type.String()),
            battery: Type.Optional(Type.Union([Type.Null(), Type.Number({
                minimum: 0,
                maximum: 100,
            })])),
            simulated: Type.Optional(Type.Boolean()),
            external_id: Type.Optional(Type.String()),
            remarks: Type.Optional(Type.String()),
            metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown(), {
                description: 'User defined key/value Device metadata - replaces the existing metadata object',
            })),
            channels: Type.Optional(Type.Array(Type.Integer({ minimum: 0 }), { uniqueItems: true })),
        }),
        res: CoreDeviceResponse,
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                scope: 'device:update',
                resources: [
                    { access: AuthResourceAccess.CONNECTION },
                    { access: AuthResourceAccess.LAYER },
                ],
            });

            const connection = auth instanceof AuthResource ? await deviceControl.resourceConnection(auth) : null;

            const device = await config.models.CoreDevice.augmented_from(req.params.device);

            if (!deviceControl.isDeviceCreator(auth, device, connection)) {
                throw new Err(403, null, 'Only the Device creator can modify this Device');
            }

            const { channels, ...body } = req.body;

            if (body.event) await deviceControl.ensureEventExists(body.event);

            if (Object.keys(body).length > 0) {
                await config.models.CoreDevice.commit(req.params.device, {
                    ...body,
                    updated: sql`Now()`,
                });
            }

            if (channels !== undefined) {
                await config.pg.delete(CoreDeviceChannel)
                    .where(eq(CoreDeviceChannel.device, req.params.device));

                if (channels.length > 0) {
                    await config.pg.insert(CoreDeviceChannel)
                        .values(channels.map(ch => ({
                            device: req.params.device,
                            channel: BigInt(ch),
                        })));
                }
            }

            res.json(await config.models.CoreDevice.augmented_from(req.params.device));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/core/device/:device', {
        name: 'Delete Device',
        group: 'CoreDevice',
        description: 'Delete a Core Device',
        params: Type.Object({
            device: Type.String({
                format: 'uuid',
            }),
        }),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const device = await config.models.CoreDevice.from(req.params.device);

            if (!user.is_admin() && device.username !== user.email) {
                throw new Err(403, null, 'Only the Device creator can delete this Device');
            }

            await config.models.CoreDevice.delete(req.params.device);

            res.json({ status: 200, message: 'Core Device Deleted' });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
