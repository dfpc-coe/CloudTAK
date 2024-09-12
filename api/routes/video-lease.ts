import { Static, Type } from '@sinclair/typebox'
import moment from 'moment';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthUserAccess } from '../lib/auth.js';
import Config from '../lib/config.js';
import { sql } from 'drizzle-orm';
import { Token } from '../lib/schema.js';
import { randomUUID } from 'node:crypto';
import { StandardResponse, VideoLeaseResponse } from '../lib/types.js';
import ECSVideoControl from '../lib/control/video-service.js';
import * as Default from '../lib/limits.js';

export const Protocols = Type.Object({
    rtmp: Type.Optional(Type.Object({
        name: Type.String(),
        url: Type.String()
    })),
    rtsp: Type.Optional(Type.Object({
        name: Type.String(),
        url: Type.String()
    })),
    webrtc: Type.Optional(Type.Object({
        name: Type.String(),
        url: Type.String()
    })),
    hls: Type.Optional(Type.Object({
        name: Type.String(),
        url: Type.String()
    })),
    srt: Type.Optional(Type.Object({
        name: Type.String(),
        url: Type.String()
    }))
})

export default async function router(schema: Schema, config: Config) {
    const videoControl = new ECSVideoControl(config);

    await schema.get('/video/lease', {
        name: 'List Leases',
        group: 'VideoLease',
        description: 'List all video leases',
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
            const user = await Auth.as_user(config, req);

            const list = await config.models.VideoLease.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    name ~* ${req.query.filter}
                    AND username = ${user.email}
                `
            });

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
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

            const protocols: Static<typeof Protocols> = {};
            const c = await videoControl.configuration();
            if (!c.configured || !c.url) return res.json({ lease, protocols });

            if (c.config && c.config.rtsp) {
                // Format: rtsp://localhost:8554/mystream
                const url = new URL(`/${lease.path}`, c.url.replace(/^http(s)?:/, 'rtsp:'))
                url.port = c.config.rtspAddress.replace(':', '');

                protocols.rtsp = {
                    name: 'Real-Time Streaming Protocol (RTSP)',
                    url: String(url)
                }
            }

            if (c.config && c.config.rtmp) {
                // Format: rtmp://localhost/mystream
                const url = new URL(`/${lease.path}`, c.url.replace(/^http(s)?:/, 'rtmp:'))
                url.port = '';

                if (lease.stream_user) url.searchParams.append('user', lease.stream_user);
                if (lease.stream_pass) url.searchParams.append('pass', lease.stream_pass);

                protocols.rtmp = {
                    name: 'Real-Time Messaging Protocol (RTMP)',
                    url: String(url)
                }
            }

            if (c.config && c.config.hls) {
                // Format: http://localhost:8888/mystream
                const url = new URL(`/${lease.path}`, c.url);
                url.port = c.config.hlsAddress.replace(':', '');

                protocols.hls = {
                    name: 'HTTP Live Streaming (HLS)',
                    url: String(url)
                }
            }

            if (c.config && c.config.webrtc) {
                // Format: http://localhost:8889/mystream
                const url = new URL(`/${lease.path}`, c.url);
                url.port = c.config.webrtcAddress.replace(':', '');

                protocols.webrtc = {
                    name: 'Web Real-Time Communication (WebRTC)',
                    url: String(url)
                }
            }

            if (c.config && c.config.srt) {
                // Format: srt://localhost:8890?streamid=read:mystream
                const url = new URL(c.url.replace(/^http(s)?:/, 'srt:'))
                url.port = c.config.srtAddress.replace(':', '');

                url.searchParams.append('streamId', `read:${lease.path}`)

                protocols.srt = {
                    name: 'Secure Reliable Transport (SRT)',
                    url: String(url)
                }
            }

            return res.json({ lease, protocols });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/video/lease', {
        name: 'Create Lease',
        group: 'VideoLease',
        description: 'Create a new video Lease',
        body: Type.Object({
            name: Type.String(),
            duration: Type.Integer(),
            path: Type.Optional(Type.String()),
            stream_user: Type.Optional(Type.String()),
            stream_pass: Type.Optional(Type.String()),

            proxy: Type.Optional(Type.String())
        }),
        res: VideoLeaseResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            if (user.access !== AuthUserAccess.ADMIN  &&req.body.duration > 60 * 60 * 16) {
                throw new Err(400, null, 'Only Administrators can request a lease > 16 hours')
            }

            const lease = await videoControl.generate({
                name: req.body.name,
                expiration: moment().add(req.body.duration, 'seconds').toISOString(),
                path: req.body.path || randomUUID(),
                username: user.email,
                proxy: req.body.proxy
            })

            return res.json(lease);
        } catch (err) {
            return Err.respond(err, res);
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
        }),
        res: VideoLeaseResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            let lease;
            if (user.access === AuthUserAccess.ADMIN) {
                lease = await config.models.VideoLease.commit(req.params.lease, req.body);
            } else {
                lease = await config.models.VideoLease.from(req.params.lease);

                if (lease.username === user.email) {
                    lease = await config.models.VideoLease.commit(req.params.lease, req.body);
                } else {
                    throw new Err(400, null, 'You can only update a lease you created');
                }
            }

            return res.json(lease);
        } catch (err) {
            return Err.respond(err, res);
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

            return res.json({
                status: 200,
                message: 'Video Lease Deleted'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
