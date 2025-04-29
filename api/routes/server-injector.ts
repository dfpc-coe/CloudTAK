import { Type } from '@sinclair/typebox'
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { StandardResponse } from '../lib/types.js';
import Schema from '@openaddresses/batch-schema';
import { Injector } from '@tak-ps/node-tak/lib/api/injectors';
import { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/server/injector', {
        name: 'List Injectors',
        group: 'ServerInjector',
        description: 'Get Injector List',
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(Injector)
        })
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

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

    await schema.post('/server/injector', {
        name: 'Create Injector',
        group: 'ServerInjector',
        description: 'Create COT Injector',
        body: Injector,
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(Injector)
        })
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const auth = config.serverCert();
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const list = await api.Injectors.create(req.body);

            res.json({
                total: list.data.length,
                items: list.data
            })
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.delete('/server/injector', {
        name: 'Delete Injector',
        group: 'ServerInjector',
        description: 'Delete COT Injector',
        query: Injector,
        res: StandardResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const auth = config.serverCert();
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            await api.Injectors.delete(req.query);

            res.json({
                status: 200,
                message: 'Injector Deleted'
            })
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
