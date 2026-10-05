import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../../common/auth.js';
import type ConfigStateless from '../config.js';
import {
    VideoConnectionList,
    VideoConnectionListInput,
} from '@tak-ps/node-tak/lib/api/video';
import TAKServerControl from '../../common/control/takserver.js';

export default async function router(schema: Schema, config: ConfigStateless) {
    const takserver = new TAKServerControl(config);
    await schema.get('/server/video', {
        name: 'List Video',
        group: 'ServerVideos',
        description: 'Helper API to get list video streams',
        query: VideoConnectionListInput,
        res: VideoConnectionList,
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const auth = config.serverCert();
            const api = await takserver.withAuth(auth);

            const list = await api.Video.list(req.query);

            res.json(list);
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
