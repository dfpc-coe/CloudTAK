import Err from '@openaddresses/batch-error';
import Server from '../lib/types/server.js';
import Auth from '../lib/auth.js';

export default async function router(schema, config) {
    await schema.get('/server', {
        name: 'Get Server',
        group: 'Server',
        auth: 'user',
        description: 'Get Server',
        res: 'res.Server.json'
    }, async (req, res) => {
        try {
            await Auth.is_auth(req);

            if (!config.server) {
                return res.json({
                    status: 'unconfigured',
                })
            } else {
                return res.json({
                    status: 'configured',
                    name: config.server.name
                });
            }
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
