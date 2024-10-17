import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import {
    VideoList,
    VideoListInput,
} from '../lib/api/video.js';
import TAKAPI, {
    APIAuthCertificate,
} from '../lib/tak-api.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/marti/video', {
        name: 'List Video',
        group: 'MartiVideos',
        params: Type.Object({
            name: Type.String(),
        }),
        description: 'Helper API to get list video streams',
        query: VideoListInput,
        res: VideoList
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const list = await api.Video.list(req.query);

            res.json(list);
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
