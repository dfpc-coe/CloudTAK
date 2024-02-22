import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import TAKAPI, {
    APIAuthToken,
    APIAuthCertificate,
    APIAuthPassword
} from '../lib/tak-api.js';

export default async function router(schema: Schema, config: Config) {
    await schema.delete('/marti/api/files/:hash', {
        name: 'delete File',
        group: 'MartiFiles',
        params: Type.Object({
            hash: Type.String(),
        }),
        description: 'Helper API to delete files by file hash',
        res: StandardResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req, { token: true });
            const profile = await config.models.Profile.from(user.email);
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));
            const file = await api.Files.delete(req.params.hash);

            return res.json({
                status: 200,
                message: 'File Deleted'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/marti/api/files/:hash', {
        name: 'Download File',
        group: 'MartiFiles',
        params: Type.Object({
            hash: Type.String(),
        }),
        query: {
            type: 'object',
            additionalProperties: false,
            properties: {
                name: { type: 'string' }
            }
        },
        description: 'Helper API to download files by file hash',
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req, { token: true });
            const profile = await config.models.Profile.from(user.email);
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));

            res.setHeader('Content-Disposition', `attachment; filename="${req.query.name || req.params.hash}"`);

            const file = await api.Files.download(req.params.hash);

            let { done, value } = await file.read();
            while (!done) {
                res.write(value);
                ({ done, value } = await file.read());
            }

            res.end()
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
