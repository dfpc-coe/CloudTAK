import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import { GenericListOrder } from '@openaddresses/batch-generic';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { Profile } from '../lib/schema.js';
import ECSVideo from '../lib/aws/ecs-video.js';
import { VideoResponse } from '../lib/types.js';

export default async function router(schema: Schema, config: Config) {
    const video = new ECSVideo(config);

    await schema.get('/video', {
        name: 'List Video Servers',
        group: 'Video',
        description: 'Let Admins list video servers',
        query: Type.Object({
            limit: Type.Integer({ default: 10 }),
            page: Type.Integer({ default: 0 }),
            order: Type.Enum(GenericListOrder, { default: GenericListOrder.ASC }),
            sort: Type.Optional(Type.String({default: 'last_login', enum: Object.keys(Profile)})),
            filter: Type.Optional(Type.String({default: ''}))
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(VideoResponse)
        })
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const test = await video.definitions();

            const list = {
                total: 0,
                items: []
            }

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
