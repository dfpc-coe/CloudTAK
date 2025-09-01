import { Type } from '@sinclair/typebox'
import moment from 'moment';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthUserAccess, AuthUser, AuthResource, AuthResourceAccess } from '../lib/auth.js';
import Config from '../lib/config.js';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { StandardResponse, VideoLeaseResponse } from '../lib/types.js';
import { VideoLease_SourceType, AllBoolean, AllBooleanCast } from '../lib/enums.js';
import { VideoLease } from '../lib/schema.js'
import { eq } from 'drizzle-orm';
import ECSVideoControl, { Action, Protocols, PathConfig, PathListItem, ProtocolPopulation } from '../lib/control/video-service.js';
import * as Default from '../lib/limits.js';
import { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak';

export default async function router(schema: Schema, config: Config) {
    const videoControl = new ECSVideoControl(config);

    await schema.post('/video/auth', {
        name: 'Auth Lease',
        group: 'VideoLease',
        description: `Authenticate a request to view a lease`,
        body: Type.Object({
            user: Type.String(),
            password: Type.String(),
            ip: Type.String(),
            action: Type.Enum(Action),
            path: Type.String(),
            protocol: Type.String(),
            id: Type.Union([Type.Null(), Type.String()]),
            query: Type.String()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            if (req.body.user === 'management' && req.body.password === config.MediaSecret) {
                res.json({ status: 200, message: 'Authorized' });
            } else if ([Action.PUBLISH, Action.READ, Action.PLAYBACK].includes(req.body.action)) {
                const lease = await config.models.VideoLease.from(eq(VideoLease.path, req.body.path))

                if (req.body.action === Action.PUBLISH && lease.stream_user && lease.stream_pass) {
                    if (req.body.user !== lease.stream_user || req.body.password !== lease.stream_pass) {
                        throw new Err(401, null, 'Unauthorized');
                    } else {
                        res.json({ status: 200, message: 'Authorized' });
                    }
                } else if (req.body.action === Action.PUBLISH && !lease.stream_user && !lease.stream_pass) {
                    res.json({ status: 200, message: 'Authorized' });
                } else if (req.body.action === Action.READ && lease.read_user && lease.read_pass) {
                    if (req.body.user !== lease.read_user || req.body.password !== lease.read_pass) {
                        throw new Err(401, null, 'Unauthorized');
                    } else {
                        res.json({ status: 200, message: 'Authorized' });
                    }
                } else if (req.body.action === Action.READ && !lease.read_user && !lease.read_pass) {
                    res.json({ status: 200, message: 'Authorized' });
                } else if (req.body.action === Action.PLAYBACK && !lease.recording) {
                    throw new Err(401, null, 'Unauthorized - Recording Disabled');
                } else if (req.body.action === Action.PLAYBACK && lease.read_user && lease.read_pass) {
                    if (req.body.user !== lease.read_user || req.body.password !== lease.read_pass) {
                        throw new Err(401, null, 'Unauthorized');
                    } else {
                        res.json({ status: 200, message: 'Authorized' });
                    }
                } else if (req.body.action === Action.PLAYBACK && !lease.read_user && !lease.read_pass) {
                    res.json({ status: 200, message: 'Authorized' });
                } else {
                    res.json({ status: 401, message: 'Unauthorized' });
                }
            } else {
                throw new Err(401, null, 'Unauthorized');
            }
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/video/active', {
        name: 'Active Lease',
        group: 'VideoLease',
        description: `
            Return information about an active lease given read credentials

            If a user has a valid read URL, the API endpoint will allow an authenticated user
            to get metadata to agument the video stream itself
        `,
        query: Type.Object({
            url: Type.String()
        }),
        res: Type.Object({
            leasable: Type.Boolean({ description: 'If a lease request is made, is it likely to succeed' }),
            message: Type.Optional(Type.String()),
            metadata: Type.Optional(Type.Object({
                name: Type.String(),
                username: Type.Union([Type.Null(), Type.String()]),
                active: Type.Boolean(),
                watchers: Type.Integer(),
                source_id: Type.Optional(Type.Union([Type.Null(), Type.String()])),
                source_type: Type.Enum(VideoLease_SourceType),
                source_model: Type.String(),
                protocols: Protocols
            }))
        })
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const requested = new URL(req.query.url);

            const url = await videoControl.url();
            const uuid = requested.pathname.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);

            if (!url) {
                res.json({
                    leasable: false,
                    message: 'CloudTAK does not have a media server configured'
                })
            } else if (url.hostname !== requested.hostname) {
                res.json({
                    leasable: true,
                    message: 'CloudTAK has a media server provisioned and can attempt to serve the stream'
                })
            } else if (!uuid || !uuid[0]) {
                res.json({
                    leasable: true,
                    message: 'CloudTAK could not parse a UUID from the provided stream'
                })
            } else {
                const lease = await config.models.VideoLease.from(eq(VideoLease.path, uuid[0]));
                const path = await videoControl.path(lease.path);

                const base = {
                    name: lease.name,
                    username: lease.username,
                    active: path.ready,
                    watchers: path.readers.length,
                    source_id: lease.source_id,
                    source_type: lease.source_type,
                    source_model: lease.source_model || ''
                };

                const protocols = await videoControl.protocols(lease, ProtocolPopulation.READ)

                if (!lease.read_user && !lease.read_pass) {
                    res.json({
                        leasable: false,
                        metadata: {
                            ...base,
                            protocols
                        }
                    });
                } else if (lease.read_user && lease.read_pass) {
                    if (
                        !req.query.url.includes(lease.read_user)
                        || !req.query.url.includes(lease.read_pass)
                    ) {
                        throw new Err(400, null, 'Invalid Access credentials');
                    }

                    res.json({
                        leasable: false,
                        metadata: {
                            ...base,
                            protocols
                        }
                    });
                } else {
                    throw new Err(400, null, 'Clould not determine lease state');
                }
            }
        } catch (err) {
            if (err instanceof TypeError && err.message.includes('Invalid URL')) {
                Err.respond(new Err(400, null, 'Invalid URL'), res);
            }

             Err.respond(err, res);
        }
    });

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
            sort: Type.String({
                default: 'created',
                enum: Object.keys(VideoLease)
            }),
            expired: Type.Enum(AllBoolean, {
                default: AllBoolean.FALSE
            }),
            ephemeral: Type.Enum(AllBoolean, {
                default: AllBoolean.FALSE
            }),
            filter: Default.Filter
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(VideoLeaseResponse)
        })
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                resources: [ { access: AuthResourceAccess.LEASE, id: undefined } ]
            })

            const ephemeral = AllBooleanCast(req.query.ephemeral);
            const expired = AllBooleanCast(req.query.expired)

            if (req.query.impersonate && (auth instanceof AuthResource || (auth instanceof AuthUser && (auth as AuthUser).is_admin()))) {
                const impersonate: string | null = req.query.impersonate === true ? null : req.query.impersonate;

                res.json(await config.models.VideoLease.list({
                    limit: req.query.limit,
                    page: req.query.page,
                    order: req.query.order,
                    sort: req.query.sort,
                    where: sql`
                        name ~* ${req.query.filter}
                        AND (${ephemeral}::BOOLEAN IS NULL OR ephemeral = ${ephemeral})
                        AND (
                            ${expired}::BOOLEAN IS NULL
                            OR (${expired}::BOOLEAN IS True AND expiration < Now() AND expiration IS NOT NULL)
                            OR (${expired}::BOOLEAN IS False AND (expiration > Now() OR expiration IS NULL))
                        )
                        AND (${impersonate}::TEXT IS NULL OR username = ${impersonate}::TEXT)
                    `
                }));
            } else {
                const user = await Auth.as_user(config, req);

                const profile = await config.models.Profile.from(user.email);
                const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));

                const groups = (await api.Group.list({ useCache: true }))
                    .data.map((group) => group.name);

                res.json(await config.models.VideoLease.list({
                    limit: req.query.limit,
                    page: req.query.page,
                    order: req.query.order,
                    sort: req.query.sort,
                    where: sql`
                        name ~* ${req.query.filter}
                        AND (username = ${user.email} OR channel IN ${groups})
                        AND (${ephemeral}::BOOLEAN IS NULL OR ephemeral = ${ephemeral})
                        AND (
                            ${expired}::BOOLEAN IS NULL
                            OR (${expired}::BOOLEAN IS True AND expiration < Now())
                            OR (${expired}::BOOLEAN IS False AND expiration > Now())
                        )
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
            lease: Type.Integer()
        }),
        res: Type.Object({
            lease: VideoLeaseResponse,
            config: Type.Optional(PathConfig),
            path: Type.Optional(PathListItem),
            protocols: Protocols
        })
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const lease = await videoControl.from(req.params.lease, {
                username: user.email,
                admin: user.access === AuthUserAccess.ADMIN
            });

            const protocols = await videoControl.protocols(lease)

            try {
                res.json({
                    lease,
                    protocols,
                    path: await videoControl.path(lease.path),
                    config: await videoControl.pathConfig(lease.path),
                });
            } catch (err) {
                console.error(err);
                res.json({ lease, protocols });
            }
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
            const user = await Auth.as_user(config, req);

            if (user.access !== AuthUserAccess.ADMIN && req.body.duration > 60 * 60 * 24) {
                throw new Err(400, null, 'Only Administrators can request a lease > 24 hours')
            } else if (user.access !== AuthUserAccess.ADMIN && req.body.permanent) {
                throw new Err(400, null, 'Only Administrators can request permanent leases')
            }

            const lease = await videoControl.generate({
                name: req.body.name,
                ephemeral: req.body.ephemeral,
                channel: req.body.channel,
                expiration: req.body.permanent ? null : moment().add(req.body.duration, 'seconds').toISOString(),
                source_id: req.body.source_id,
                source_type: req.body.source_type,
                source_model: req.body.source_model,
                recording: req.body.recording,
                publish: req.body.publish,
                path: randomUUID(),
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
            lease: Type.Integer()
        }),
        body: Type.Object({
            name: Type.Optional(Type.String()),
            duration: Type.Integer({
                minimum: 0,
                default: 60 * 60,
                description: 'Duration in Seconds'
            }),
            source_id: Type.Optional(Type.Union([Type.Null(), Type.String()])),
            source_type: Type.Optional(Type.Enum(VideoLease_SourceType)),
            source_model: Type.Optional(Type.String()),
            channel: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            secure: Type.Optional(Type.Boolean()),
            recording: Type.Boolean({
                description: 'Record streams to disk'
            }),
            publish: Type.Boolean({
                description: 'Publish stream URL to TAK Server Video Manager'
            }),
            permanent: Type.Boolean({
                default: false,
                description: 'System Admins can create non-expiring leases'
            }),
            proxy: Type.Optional(Type.String())
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
                recording: req.body.recording,
                publish: req.body.publish,
                expiration: req.body.permanent ? null : moment().add(req.body.duration, 'seconds').toISOString(),
                source_id: req.body.source_id,
                source_type: req.body.source_type,
                source_model: req.body.source_model,
                proxy: req.body.proxy,
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
            lease: Type.Integer()
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
}
