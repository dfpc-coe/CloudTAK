import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import ECSVideoControl, { Configuration, PathListItem } from '../lib/control/video-service.js';

export default async function router(schema: Schema, config: Config) {
    const videoControl = new ECSVideoControl(config);

    await schema.get('/video/service', {
        name: 'Video Service',
        group: 'VideoService',
        description: 'Get Video Service Configuration',
        res: Configuration
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const configuration = await videoControl.configuration();

            res.json(configuration);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/video/service/path/:path', {
        name: 'Video Paths',
        group: 'VideoService',
        description: 'Get information about a given path',
        params: Type.Object({
            path: Type.String()
        }),
        res: Type.Object({
            path: PathListItem
        })
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            res.json({
                path: await videoControl.path(req.params.path),
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
