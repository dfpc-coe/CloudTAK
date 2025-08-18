import { Type } from '@sinclair/typebox'
import moment from 'moment';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthResourceAccess }  from '../lib/auth.js';
import Config from '../lib/config.js';
import { sql } from 'drizzle-orm';
import { VideoLease } from '../lib/schema.js';
import { randomUUID } from 'node:crypto';
import { StandardResponse, VideoLeaseResponse } from '../lib/types.js';
import { VideoLease_SourceType } from '../lib/enums.js';
import ECSVideoControl, { Protocols } from '../lib/control/video-service.js';
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: Config) {
    const videoControl = new ECSVideoControl(config);

    await schema.get('/connection/:connectionid/video/lease', {
        name: 'List Leases',
        group: 'ConnectionVideoLease',
        description: 'List all video leases',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
        }),
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({
                default: 'created',
                enum: Object.keys(VideoLease)
            }),
            filter: Default.Filter
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(VideoLeaseResponse)
        })
    }, async (req, res) => {
        try {
            const { connection, layer } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    { access: AuthResourceAccess.LAYER, id: undefined }
                ]
            }, req.params.connectionid);

            if (layer && layer.connection !== connection.id) {
                throw new Err(400, null, 'Layer does not belong to this connection');
            }

            res.json(await config.models.VideoLease.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    name ~* ${req.query.filter}
                    AND connection = ${req.params.connectionid}
                `
            }));
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.delete('/connection/:connectionid/video/lease', {
        name: 'Delete Leases',
        group: 'ConnectionVideoLease',
        description: 'Delete all video leases for a given connection',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const { profile, connection, layer } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    { access: AuthResourceAccess.LAYER, id: undefined }
                ]
            }, req.params.connectionid);

            if (layer && layer.connection !== connection.id) {
                throw new Err(400, null, 'Layer does not belong to this connection');
            }

            for await (const lease of config.models.VideoLease.iter({
                where: sql`
                    connection = ${req.params.connectionid}
                `
            })) {
                await videoControl.delete(lease.id, {
                    connection: req.params.connectionid,
                    admin: profile ? profile.system_admin : false
                });
            }

            res.json({
                status: 200,
                message: 'Video Leases Deleted'
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid/video/lease/:lease', {
        name: 'Get Lease',
        group: 'ConnectionVideoLease',
        description: 'Get a single Video Lease',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
            lease: Type.Integer()
        }),
        res: Type.Object({
            lease: VideoLeaseResponse,
            protocols: Protocols
        })
    }, async (req, res) => {
        try {
            const { profile, connection, layer } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    { access: AuthResourceAccess.LAYER, id: undefined }
                ]
            }, req.params.connectionid);

            if (connection.readonly) throw new Err(400, null, 'Connection is Read-Only mode');

            if (layer && layer.connection !== connection.id) {
                throw new Err(400, null, 'Layer does not belong to this connection');
            }

            const lease = await videoControl.from(req.params.lease, {
                connection: req.params.connectionid,
                admin: profile ? profile.system_admin : false
            });

            res.json({
                lease,
                protocols: await videoControl.protocols(lease)
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.post('/connection/:connectionid/video/lease', {
        name: 'Create Lease',
        group: 'ConnectionVideoLease',
        description: 'Create a new video Lease',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
        }),
        body: Type.Object({
            name: Type.String({
                description: 'Human readable name'
            }),
            duration: Type.Integer({
                minimum: 0,
                default: 60 * 60,
                description: 'Duration in Seconds'
            }),
            permanent: Type.Boolean({
                default: false,
                description: 'System Admins can create non-expiring leases'
            }),
            recording: Type.Boolean({
                default: false,
                description: 'Record streams to disk'
            }),
            publish: Type.Boolean({
                default: false,
                description: 'Publish stream URL to TAK Server Video Manager'
            }),
            secure: Type.Boolean({
                default: false,
                description: 'Increase stream security by enforcing a seperate read and write username/password'
            }),
            source_id: Type.Optional(Type.Union([Type.Null(), Type.String()])),
            source_type: Type.Optional(Type.Enum(VideoLease_SourceType)),
            source_model: Type.Optional(Type.String()),
            channel: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            proxy: Type.Optional(Type.String())
        }),
        res: Type.Object({
            lease: VideoLeaseResponse,
            protocols: Protocols
        })
    }, async (req, res) => {
        try {
            const { connection, layer, profile } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    { access: AuthResourceAccess.LAYER, id: undefined }
                ]
            }, req.params.connectionid);

            if (connection.readonly) throw new Err(400, null, 'Connection is Read-Only mode');

            if (layer && layer.connection !== connection.id) {
                throw new Err(400, null, 'Layer does not belong to this connection');
            }

            if ((!profile || !profile.system_admin) && req.body.duration > 60 * 60 * 24) {
                throw new Err(400, null, 'Only Administrators can request a lease > 24 hours')
            }

            const lease = await videoControl.generate({
                name: req.body.name,
                channel: req.body.channel,
                expiration: req.body.permanent ? null : moment().add(req.body.duration, 'seconds').toISOString(),
                ephemeral: false,
                source_id: req.body.source_id,
                source_type: req.body.source_type,
                source_model: req.body.source_model,
                recording: req.body.recording,
                publish: req.body.publish,
                path: randomUUID(),
                secure: req.body.secure,
                connection: req.params.connectionid,
                layer: layer ? layer.id : undefined,
                proxy: req.body.proxy
            })

            res.json({
                lease,
                protocols: await videoControl.protocols(lease)
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.patch('/connection/:connectionid/video/lease/:lease', {
        name: 'Update Lease',
        group: 'ConnectionVideoLease',
        description: 'Update a video Lease',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
            lease: Type.Integer()
        }),
        body: Type.Object({
            name: Type.Optional(Type.String()),
            duration: Type.Optional(Type.Integer({
                minimum: 0,
                description: 'Duration in Seconds'
            })),
            source_id: Type.Optional(Type.Union([Type.Null(), Type.String()])),
            source_type: Type.Optional(Type.Enum(VideoLease_SourceType)),
            source_model: Type.Optional(Type.String()),
            channel: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            secure: Type.Optional(Type.Boolean()),
            secure_rotate: Type.Boolean({
                default: false,
                description: 'Rotate Read-User Credentials if using seperate read/write user - infers secure: true'
            }),
            permanent: Type.Optional(Type.Boolean({
                description: 'System Admins can create non-expiring leases'
            })),
            recording: Type.Optional(Type.Boolean({
                description: 'Record streams to disk'
            })),
            publish: Type.Optional(Type.Boolean({
                description: 'Publish stream URL to TAK Server Video Manager'
            })),
            proxy: Type.Optional(Type.String()),
        }),
        res: Type.Object({
            lease: VideoLeaseResponse,
            protocols: Protocols
        })
    }, async (req, res) => {
        try {
            const { connection, layer, profile } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    { access: AuthResourceAccess.LAYER, id: undefined }
                ]
            }, req.params.connectionid);

            if (connection.readonly) throw new Err(400, null, 'Connection is Read-Only mode');

            if (layer && layer.connection !== connection.id) {
                throw new Err(400, null, 'Layer does not belong to this connection');
            }

            if ((!profile || !profile.system_admin) && req.body.duration && req.body.duration > 60 * 60 * 24) {
                throw new Err(400, null, 'Only Administrators can request a lease > 24 hours')
            } else if ((!profile || !profile.system_admin) && req.body.permanent) {
                throw new Err(400, null, 'Only Administrators can request permanent leases')
            }

            if (req.body.secure === false && req.body.secure_rotate) {
                throw new Err(400, null, 'Secure_Rotate infers Secure: true');
            }

            if (req.body.secure_rotate) req.body.secure = true;

            let expiration: null | string | undefined = undefined;
            if (req.body.permanent) {
                expiration = null;
            } else if (req.body.duration) {
                expiration = moment().add(req.body.duration, 'seconds').toISOString()
            }

            const lease = await videoControl.commit(req.params.lease, {
                name: req.body.name,
                channel: req.body.channel ? req.body.channel : null,
                secure: req.body.secure,
                secure_rotate: req.body.secure_rotate,
                expiration,
                recording: req.body.recording,
                publish: req.body.publish,
                source_id: req.body.source_id,
                source_type: req.body.source_type,
                source_model: req.body.source_model,
                proxy: req.body.proxy
            }, {
                connection: req.params.connectionid,
                admin: profile ? profile.system_admin : false
            });

            res.json({
                lease,
                protocols: await videoControl.protocols(lease)
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.delete('/connection/:connectionid/video/lease/:lease', {
        name: 'Delete Lease',
        group: 'ConnectionVideoLease',
        description: 'Delete a video Lease',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
            lease: Type.Integer()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const { connection, layer, profile } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    { access: AuthResourceAccess.LAYER, id: undefined }
                ]
            }, req.params.connectionid);

            if (connection.readonly) throw new Err(400, null, 'Connection is Read-Only mode');

            if (layer && layer.connection !== connection.id) {
                throw new Err(400, null, 'Layer does not belong to this connection');
            }

            await videoControl.delete(req.params.lease, {
                connection: req.params.connectionid,
                admin: profile ? profile.system_admin : false
            });

            res.json({
                status: 200,
                message: 'Video Lease Deleted'
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
