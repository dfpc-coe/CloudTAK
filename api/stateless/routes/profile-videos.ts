import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import moment from 'moment';
import type ConfigStateless from '../config.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthUserAccess } from '../../common/auth.js';
import { StandardResponse, ProfileVideoResponse, ProfileVideoPosition } from '../../common/types.js';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import ECSVideoControl from '../lib/control/video-service.js';
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: ConfigStateless) {
    const videoControl = new ECSVideoControl(config);

    await schema.get('/profile/video', {
        name: 'Get Videos',
        group: 'ProfileVideo',
        description: `
            Return a list of Profile Videos
        `,
        query: Type.Object({
            limit: Type.Integer({ default: 1000 }),
            page: Default.Page,
            order: Default.Order,
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(ProfileVideoResponse),
        }),

    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req, { token: true });

            const list = await config.models.ProfileVideo.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                where: sql`
                    username = ${user.email}
                `,
            });

            res.json(list);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/profile/video', {
        name: 'Create Video',
        group: 'ProfileVideo',
        description: `
            Push a new Profile Video to the Video Wall

            Either an existing Video Lease ID or a Stream URL must be provided.
            If a URL is provided it is resolved to an existing lease where possible,
            otherwise a proxy lease is created on behalf of the user.
        `,
        body: Type.Object({
            lease: Type.Optional(Type.Integer({ description: 'Existing Video Lease ID' })),
            url: Type.Optional(Type.String({ description: 'Video Stream URL' })),
            name: Type.Optional(Type.String({ description: 'Human readable name - used if a new proxy lease is created' })),
            position: Type.Optional(ProfileVideoPosition),
        }),
        res: ProfileVideoResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const admin = user.access === AuthUserAccess.ADMIN;

            let lease: number | undefined = undefined;

            if (req.body.lease !== undefined) {
                lease = (await videoControl.from(req.body.lease, {
                    username: user.email,
                    admin,
                })).id;
            } else if (req.body.url !== undefined) {
                let requested: URL;
                try {
                    requested = new URL(req.body.url);
                } catch (err) {
                    throw new Err(400, err instanceof Error ? err : new Error(String(err)), 'Invalid Video Stream URL');
                }

                const media = await videoControl.url();
                const uuid = requested.pathname.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);

                if (media && media.hostname === requested.hostname && uuid && uuid[0]) {
                    try {
                        lease = (await videoControl.from(uuid[0], {
                            username: user.email,
                            admin,
                        })).id;
                    } catch (err) {
                        if (!(err instanceof Err)) throw err;
                        // The URL points at a lease the user cannot access directly
                        // Fall through and create a user owned proxy lease
                    }
                }

                if (lease === undefined) {
                    lease = (await videoControl.generate({
                        name: req.body.name || 'Video Wall Stream',
                        ephemeral: true,
                        expiration: moment().add(24, 'hours').toISOString(),
                        source_id: null,
                        path: randomUUID(),
                        username: user.email,
                        recording: false,
                        publish: false,
                        secure: false,
                        share: false,
                        proxy: req.body.url,
                    })).id;
                }
            } else {
                throw new Err(400, null, 'Either a lease or url must be provided');
            }

            const existing = await config.models.ProfileVideo.list({
                where: sql`
                    username = ${user.email}
                    AND lease = ${lease}
                `,
            });

            if (existing.total > 0) {
                res.json(existing.items[0]);
                return;
            }

            let position: Static<typeof ProfileVideoPosition> | undefined = req.body.position;

            if (!position) {
                const videos = await config.models.ProfileVideo.list({
                    limit: 1000,
                    where: sql`
                        username = ${user.email}
                    `,
                });

                // Place new videos at the bottom of the wall
                let y = 0;
                for (const video of videos.items) {
                    y = Math.max(y, video.position.y + video.position.h);
                }

                position = { x: 0, y, w: 4, h: 6 };
            }

            const video = await config.models.ProfileVideo.generate({
                lease,
                position,
                username: user.email,
            });

            res.json(video);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/profile/video/:id', {
        name: 'Update Video',
        group: 'ProfileVideo',
        description: `
            Update a Profile Video - used to persist Video Wall placement
        `,
        params: Type.Object({
            id: Type.String(),
        }),
        body: Type.Object({
            position: Type.Optional(ProfileVideoPosition),
        }),
        res: ProfileVideoResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const video = await config.models.ProfileVideo.from(sql`
                id = ${req.params.id} AND username = ${user.email}
            `);

            const updated = await config.models.ProfileVideo.commit(video.id, {
                ...req.body,
                updated: sql`Now()`,
            });

            res.json(updated);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/profile/video/:id', {
        name: 'Delete Video',
        group: 'ProfileVideo',
        description: `
            Delete a Video
        `,
        params: Type.Object({
            id: Type.String(),
        }),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            await config.models.ProfileVideo.delete(sql`
                id = ${req.params.id} AND username = ${user.email}
            `);

            res.json({
                status: 200,
                message: 'Video Deleted',
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/profile/video/:id', {
        name: 'Get Video',
        group: 'ProfileVideo',
        description: `
            Get a video
        `,
        params: Type.Object({
            id: Type.String(),
        }),
        res: ProfileVideoResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const video = await config.models.ProfileVideo.from(sql`
                id = ${req.params.id} AND username = ${user.email}
            `);

            res.json(video);
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
