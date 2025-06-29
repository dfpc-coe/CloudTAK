import Err from '@openaddresses/batch-error';
import Auth, { AuthResourceAccess } from '../lib/auth.js';
import Config from '../lib/config.js';
import { TAKAPI, APIAuthCertificate, } from '@tak-ps/node-tak';
import { Type } from '@sinclair/typebox'
import { GenericMartiResponse } from '../lib/types.js';
import Schema from '@openaddresses/batch-schema';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/connection/:connectionid/channel', {
        name: 'List Channels',
        group: 'Connection',
        description: 'List channels that a given connection is broadcasting to',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 })
        }),
        res: GenericMartiResponse
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            }, req.params.connectionid);

            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(connection.auth.cert, connection.auth.key));

            const list = await api.Group.list({
                useCache: true
            });

            res.json(list);
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
