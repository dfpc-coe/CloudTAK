import { Type } from '@sinclair/typebox'
import moment from 'moment';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthUserAccess } from '../lib/auth.js';
import Config from '../lib/config.js';
import { sql } from 'drizzle-orm';
import { Token } from '../lib/schema.js';
import { randomUUID } from 'node:crypto';
import { StandardResponse, VideoLeaseResponse } from '../lib/types.js';
import ECSVideoControl, { Protocols } from '../lib/control/video-service.js';
import * as Default from '../lib/limits.js';
import TAKAPI, { APIAuthCertificate } from '../lib/tak-api.js';

export default async function router(schema: Schema, config: Config) {
    const videoControl = new ECSVideoControl(config);

    await schema.get('/video/lease', {
        name: 'List Leases',
        group: 'VideoLease',
        description: 'List all video leases',
        query: Type.Object({
            impersonate: Type.Optional(Type.Union([
                Type.Boolean({ description: 'List all of the given resource, regardless of ACL' }),
                Type.String({ description: 'Filter the given resource by a given username' }),
            ])),
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.Optional(Type.String({ default: 'created', enum: Object.keys(Token) })),
            ephemeral: Type.Optional(Type.Boolean({ default: false })),
            filter: Default.Filter
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(VideoLeaseResponse)
        })
    }, async (req, res) => {
        try {
            if (req.query.impersonate) {
                await Auth.as_user(config, req, { admin: true });

                const impersonate: string | null = req.query.impersonate === true ? null : req.query.impersonate;

                res.json(await config.models.VideoLease.list({
                    limit: req.query.limit,
                    page: req.query.page,
                    order: req.query.order,
                    sort: req.query.sort,
                    where: sql`
                        name ~* ${req.query.filter}
                        AND ephemeral = ${req.query.ephemeral}
                        AND (${impersonate}::TEXT IS NULL OR username = ${impersonate}::TEXT)
                    `
                }));
            } else {
                const user = await Auth.as_user(config, req);

                const profile = await config.models.Profile.from(user.email);
                const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));

                const groups = (await api.Group.list({ useCache: true })).data.map((group) => {
                    return group.name;
                });

                res.json(await config.models.VideoLease.list({
                    limit: req.query.limit,
                    page: req.query.page,
                    order: req.query.order,
                    sort: req.query.sort,
                    where: sql`
                        name ~* ${req.query.filter}
                        AND (username = ${user.email} OR channel IN ${groups})
                        AND ephemeral = ${req.query.ephemeral}
                    `
                }));
            }
        } catch (err) {
             Err.respond(err, res);
        }
    });

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

            let lease;
            if (user.access === AuthUserAccess.ADMIN) {
                lease = await config.models.VideoLease.from(req.params.lease);
            } else {
                lease = await config.models.VideoLease.from(req.params.lease);

                if (lease.username !== user.email) {
                    throw new Err(400, null, 'You can only delete a lease you created');
                }
            }

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
            channel: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            path: Type.Optional(Type.String()),
            stream_user: Type.Optional(Type.String()),
            stream_pass: Type.Optional(Type.String()),
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
                path: req.body.path || randomUUID(),
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
            channel: Type.Optional(Type.Union([Type.String(), Type.Null()])),
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
                expiration: req.body.permanent ? null : moment().add(req.body.duration, 'seconds').toISOString(),
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

            if (user.access === AuthUserAccess.ADMIN) {
                await videoControl.delete(req.params.lease);
            } else {
                const lease = await config.models.VideoLease.from(req.params.lease);

                if (lease.username === user.email) {
                    await videoControl.delete(req.params.lease);
                } else {
                    throw new Err(400, null, 'You can only delete a lease you created');
                }
            }

            res.json({
                status: 200,
                message: 'Video Lease Deleted'
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
