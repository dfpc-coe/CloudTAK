import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import {
    VideoConnection,
    VideoConnectionCreateInput,
    VideoConnectionUpdateInput,
    VideoConnectionList,
    VideoConnectionListInput,
} from '@tak-ps/node-tak/lib/api/video';
import {
    StandardResponse
} from '../lib/types.js';
import { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/marti/video', {
        name: 'List Video',
        group: 'MartiVideos',
        description: 'Helper API to get list video streams',
        query: VideoConnectionListInput,
        res: VideoConnectionList
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

    await schema.get('/marti/video/:uid', {
        name: 'Get Video',
        group: 'MartiVideos',
        description: 'Helper API to get video stream',
        params: Type.Object({
            uid: Type.String()
        }),
        res: VideoConnection
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const conn = await api.Video.get(req.params.uid);

            res.json(conn);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.post('/marti/video', {
        name: 'Create Video',
        group: 'MartiVideos',
        description: 'Helper API to create video streams',
        body: VideoConnectionCreateInput,
        res: VideoConnection
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const videoConn = await api.Video.create(req.body);

            res.json(videoConn);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.put('/marti/video/:uid', {
        name: 'Replace Video',
        group: 'MartiVideos',
        description: 'Helper API to update video streams',
        params: Type.Object({
            uid: Type.String()
        }),
        body: VideoConnectionUpdateInput,
        res: VideoConnection
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const videoConn = await api.Video.update({
                uuid: req.params.uid,
                ...req.body
            });

            res.json(videoConn);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.delete('/marti/video/:uid', {
        name: 'Delete Video',
        group: 'MartiVideos',
        description: 'Helper API to delete video stream',
        params: Type.Object({
            uid: Type.String()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            await api.Video.delete(req.params.uid);

            res.json({
                status: 200,
                message: 'Video Stream Deleted'
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
