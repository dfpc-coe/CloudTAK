import { Type } from '@sinclair/typebox'
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Schema from '@openaddresses/batch-schema';
import { StandardResponse } from '../lib/types.js';
import Config from '../lib/config.js';
import { Package } from '@tak-ps/node-tak/lib/api/package';
import { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/server/package', {
        name: 'List Packages',
        group: 'ServerPackage',
        description: 'Get Pacakge List',
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(Package)
        })
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const auth = config.serverCert();
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const list = await api.Package.list({})

            res.json({
                total: list.resultCount,
                items: list.results
            })
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.delete('/server/package/:hash', {
        name: 'Delete Package',
        group: 'ServerPackage',
        description: 'Delete Package',
        params: Type.Object({
            hash: Type.String()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const auth = config.serverCert();
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            await api.Files.adminDelete(req.params.hash)

            res.json({
                status: 200,
                message: 'Package Deleted'
            })
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
