import fs from 'node:fs';
import { Static, Type } from '@sinclair/typebox'
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { Injector } from '@tak-ps/node-tak/lib/api/injectors';
import { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/server/injector', {
        name: 'List Injectors',
        group: 'Server',
        description: 'Get Injector List',
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(Injector)
        })
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req, { admin: true });

            const auth = config.serverCert();
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const list = await api.Injectors.list()

            res.json({
                total: list.data.length,
                items: list.data
            })
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
