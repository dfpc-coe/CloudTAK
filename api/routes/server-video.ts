import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import {
    VideoConnectionList,
    VideoConnectionListInput,
} from '@tak-ps/node-tak/lib/api/video';
import { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/server/video', {
        name: 'List Video',
        group: 'ServerVideos',
        description: 'Helper API to get list video streams',
        query: VideoConnectionListInput,
        res: VideoConnectionList
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const auth = config.serverCert();
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const list = await api.Video.list(req.query);

            res.json(list);
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
