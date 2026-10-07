import { Type } from '@sinclair/typebox';
import { StandardResponse, CoreDeviceResponse, CoreEntityLink, CoreEntityStyle, GeoJSONFeatureGeometryPoint } from '../../common/types.js';
import { sql, getTableColumns } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthUser, AuthResource, AuthResourceAccess } from '../../common/auth.js';
import { CoreEntity } from '../../common/schema.js';
import { sharedWith, setChannels } from '../../common/models/CoreEntity.js';
import type ConfigStateless from '../config.js';
import { userChannels } from '../../common/control/tak-channels.js';
import DeviceControl from '../lib/control/device.js';
import { uniqueViolation } from '../lib/pg-error.js';
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
                enum: Object.keys(getTableColumns(CoreEntity)).filter(key => key !== 'kind'),
            }),
            filter: Default.Filter,
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

            const channel = filterChannels.length === 0 ? sql`True` : sharedWith(filterChannels);

            let where;
            if (auth instanceof AuthResource) {
                const connection = await deviceControl.resourceConnection(auth);

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
            geometry: Type.Optional(Type.Union([Type.Null(), GeoJSONFeatureGeometryPoint], {
                description: 'Last known location of the Device',
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
            links: Type.Array(CoreEntityLink, {
                default: [],
                description: 'Named URLs associated with the Device',
            }),
            style: Type.Object(CoreEntityStyle.properties, {
                default: {},
                description: 'Point styling for the Device',
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

            const connection = auth instanceof AuthResource ? await deviceControl.resourceConnection(auth) : null;

            const id = await config.pg.transaction(async (tx) => {
                const id = await config.models.CoreDevice.generateDevice({
                    ...body,
                    username: auth instanceof AuthUser ? auth.email : null,
                    connection,
                }, tx);

                await setChannels(tx, id, channels);

                return id;
            }).catch(uniqueViolation('external_id is already used by another Device of the Connection'));

            res.json(await config.models.CoreDevice.augmented_from(id));
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
            geometry: Type.Optional(Type.Union([Type.Null(), GeoJSONFeatureGeometryPoint])),
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
            links: Type.Optional(Type.Array(CoreEntityLink, {
                description: 'Named URLs associated with the Device - replaces the existing links array',
            })),
            style: Type.Optional(Type.Object(CoreEntityStyle.properties, {
                description: 'Point styling for the Device - replaces the existing style object',
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

            if (Object.keys(body).length > 0) {
                await config.models.CoreDevice.commitDevice(req.params.device, body)
                    .catch(uniqueViolation('external_id is already used by another Device of the Connection'));
            }

            if (channels !== undefined) await setChannels(config.pg, req.params.device, channels);

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

            const device = await config.models.CoreDevice.augmented_from(req.params.device);

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
