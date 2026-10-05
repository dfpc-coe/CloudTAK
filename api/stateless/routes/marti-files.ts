import { Type } from '@sinclair/typebox';
import { StandardResponse } from '../../common/types.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../../common/auth.js';
import type ConfigStateless from '../config.js';
import { authenticatedProfile } from '../../common/control/profile.js';
import TAKServerControl from '../../common/control/takserver.js';

export default async function router(schema: Schema, config: ConfigStateless) {
    const takserver = new TAKServerControl(config);
    await schema.delete('/marti/api/files/:hash', {
        name: 'Delete File',
        group: 'MartiFiles',
        params: Type.Object({
            hash: Type.String(),
        }),
        query: Type.Object({
            token: Type.Optional(Type.String()),
        }),
        description: 'Helper API to delete files by file hash',
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req, { token: true });
            const profile = await authenticatedProfile(config, user.email);
            const api = await takserver.withAuth(profile.auth);
            await api.Files.delete(req.params.hash);

            res.json({
                status: 200,
                message: 'File Deleted',
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/marti/api/files/:hash', {
        name: 'Download File',
        group: 'MartiFiles',
        params: Type.Object({
            hash: Type.String(),
        }),
        query: Type.Object({
            name: Type.Optional(Type.String()),
            token: Type.Optional(Type.String()),
        }),
        description: 'Helper API to download files by file hash',
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req, { token: true });
            const profile = await authenticatedProfile(config, user.email);
            const api = await takserver.withAuth(profile.auth);

            res.setHeader('Content-Disposition', `attachment; filename="${req.query.name || req.params.hash}"`);

            const file = await api.Files.download(req.params.hash);

            file.pipe(res);
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
