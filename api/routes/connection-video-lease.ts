import { Type } from '@sinclair/typebox'
import moment from 'moment';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthResourceAccess }  from '../lib/auth.js';
import Config from '../lib/config.js';
import { sql } from 'drizzle-orm';
import { Token } from '../lib/schema.js';
import { randomUUID } from 'node:crypto';
import { StandardResponse, VideoLeaseResponse } from '../lib/types.js';
import { VideoLease_SourceType } from '../lib/enums.js';
import ECSVideoControl, { Protocols } from '../lib/control/video-service.js';
import * as Default from '../lib/limits.js';
import TAKAPI, { APIAuthCertificate } from '../lib/tak-api.js';

export default async function router(schema: Schema, config: Config) {
    const videoControl = new ECSVideoControl(config);

    await schema.get('/connection/:connectionid/video/lease', {
        name: 'List Leases',
        group: 'VideoLease',
        description: 'List all video leases',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
        }),
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.Optional(Type.String({ default: 'created', enum: Object.keys(Token) })),
            filter: Default.Filter
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(VideoLeaseResponse)
        })
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }
                ]
            }, req.params.connectionid);

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

/*
    await schema.get('/video/lease/:lease', {
        name: 'Get Lease',
        group: 'VideoLease',
        description: 'Get a single Video Lease',
        params: Type.Object({
            lease: Type.String()
        }),
        res: Type.Object({
            lease: VideoLeaseResponse,
            protocols: Protocols
        })
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const lease = await videoControl.from(req.params.lease, {
                username: user.email,
                admin: user.access === AuthUserAccess.ADMIN
            });

            res.json({
                lease,
                protocols: await videoControl.protocols(lease)
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.post('/video/lease', {
        name: 'Create Lease',
        group: 'VideoLease',
        description: 'Create a new video Lease',
        body: Type.Object({
            name: Type.String({
                description: 'Human readable name'
            }),
            ephemeral: Type.Boolean({
                description: 'CloudTAK View lease - hidden in streaming list',
                default: false
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
            secure: Type.Boolean({
                default: false,
                description: 'Increase stream security by enforcing a seperate read and write username/password'
            }),
            source_type: Type.Optional(Type.Enum(VideoLease_SourceType)),
            source_model: Type.Optional(Type.String()),
            channel: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            path: Type.Optional(Type.String()),
            proxy: Type.Optional(Type.String())
        }),
        res: Type.Object({
            lease: VideoLeaseResponse,
            protocols: Protocols
        })
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            if (user.access !== AuthUserAccess.ADMIN && req.body.duration > 60 * 60 * 24) {
                throw new Err(400, null, 'Only Administrators can request a lease > 24 hours')
            } else if (user.access !== AuthUserAccess.ADMIN && req.body.permanent) {
                throw new Err(400, null, 'Only Administrators can request permanent leases')
            } else if (user.access !== AuthUserAccess.ADMIN && req.body.path) {
                throw new Err(400, null, 'Only Administrators can request custom paths in leases')
            }

            const lease = await videoControl.generate({
                name: req.body.name,
                ephemeral: req.body.ephemeral,
                channel: req.body.channel,
                expiration: req.body.permanent ? null : moment().add(req.body.duration, 'seconds').toISOString(),
                source_type: req.body.source_type,
                source_model: req.body.source_model,
                path: req.body.path || randomUUID(),
                secure: req.body.secure,
                username: user.email,
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

    await schema.patch('/video/lease/:lease', {
        name: 'Update Lease',
        group: 'VideoLease',
        description: 'Update a video Lease',
        params: Type.Object({
            lease: Type.String()
        }),
        body: Type.Object({
            name: Type.Optional(Type.String()),
            duration: Type.Integer({
                minimum: 0,
                default: 60 * 60,
                description: 'Duration in Seconds'
            }),
            source_type: Type.Optional(Type.Enum(VideoLease_SourceType)),
            source_model: Type.Optional(Type.String()),
            channel: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            secure: Type.Optional(Type.Boolean()),
            permanent: Type.Boolean({
                default: false,
                description: 'System Admins can create non-expiring leases'
            })
        }),
        res: Type.Object({
            lease: VideoLeaseResponse,
            protocols: Protocols
        })
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            if (user.access !== AuthUserAccess.ADMIN && req.body.duration && req.body.duration > 60 * 60 * 24) {
                throw new Err(400, null, 'Only Administrators can request a lease > 24 hours')
            } else if (user.access !== AuthUserAccess.ADMIN && req.body.permanent) {
                throw new Err(400, null, 'Only Administrators can request permanent leases')
            }

            const lease = await videoControl.commit(req.params.lease, {
                name: req.body.name,
                channel: req.body.channel ? req.body.channel : null,
                secure: req.body.secure,
                expiration: req.body.permanent ? null : moment().add(req.body.duration, 'seconds').toISOString(),
                source_type: req.body.source_type,
                source_model: req.body.source_model,
            }, {
                username: user.email,
                admin: user.access === AuthUserAccess.ADMIN
            });

            res.json({
                lease,
                protocols: await videoControl.protocols(lease)
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.delete('/video/lease/:lease', {
        name: 'Delete Lease',
        group: 'VideoLease',
        description: 'Delete a video Lease',
        params: Type.Object({
            lease: Type.String()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            await videoControl.delete(req.params.lease, {
                username: user.email,
                admin: user.access === AuthUserAccess.ADMIN
            });

            res.json({
                status: 200,
                message: 'Video Lease Deleted'
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });
*/
}
