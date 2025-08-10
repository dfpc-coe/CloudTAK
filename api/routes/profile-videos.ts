import { Type } from '@sinclair/typebox'
import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { StandardResponse, ProfileVideoResponse } from '../lib/types.js'
import { sql } from 'drizzle-orm';
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/profile/video', {
        name: 'Get Videos',
        group: 'ProfileVidoe',
        description: `
            Return a list of Profile Videos
        `,
        query: Type.Object({
            limit: Type.Integer({ default: 1000 }),
            page: Default.Page,
            order: Default.Order
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(ProfileVideoResponse)
        })

    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req, { token: true });

            const list = await config.models.ProfileVideo.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                where: sql`
                    username = ${user.email}
                `
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
            Push a new Profile Video to the database
        `,
        body: Type.Object({
            lease: Type.Integer()
        }),
        res: ProfileVideoResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const video = await config.models.ProfileVideo.generate({
                ...req.body,
                username: user.email
            });

            res.json(video)
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
            id: Type.String()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            await config.models.ProfileVideo.delete(sql`
                id = ${req.params.id} AND username = ${user.email}
            `);

            res.json({
                status: 200,
                message: 'Video Deleted'
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
            id: Type.String()
        }),
        res: ProfileVideoResponse
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
