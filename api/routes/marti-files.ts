import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import TAKAPI, {
    APIAuthToken,
    APIAuthPassword
} from '../lib/tak-api.js';

export default async function router(schema: any, config: Config) {
    await schema.get('/marti/api/files/:hash', {
        name: 'Download File',
        group: 'MartiFiles',
        auth: 'user',
        ':hash': 'string',
        description: 'Helper API to download files by file hash',
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req, true);

            if (!req.auth.email) throw new Err(400, null, 'Files can only be downloaded by a JWT authenticated user');

            const api = await TAKAPI.init(new URL(config.MartiAPI), new APIAuthToken(req.auth.token));

            res.setHeader('Content-Disposition', `attachment; filename="${req.params.hash}.zip"`);

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
