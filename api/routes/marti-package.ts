import fs from 'node:fs';
import crypto from 'node:crypto';
import { Type } from '@sinclair/typebox'
import CoT from '@tak-ps/node-cot';
import DataPackage from '../lib/data-package.js';
import TAK from '@tak-ps/node-tak';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { StandardResponse, GenericMartiResponse } from '../lib/types.js';
import { Content } from '../lib/api/file.js';
import { Package } from '../lib/api/package.js';
import { Profile } from '../lib/schema.js';
import S3 from '../lib/aws/s3.js';
import TAKAPI, {
    APIAuthToken,
    APIAuthCertificate,
    APIAuthPassword
} from '../lib/tak-api.js';

export default async function router(schema: Schema, config: Config) {
    await schema.put('/marti/package', {
        name: 'Create Package',
        group: 'MartiPackages',
        description: 'Helper API to create share package',
        body: Type.Object({
            features: Type.Array(Type.Object({
                id: Type.String(),
                type: Type.Literal('Feature'),
                properties: Type.Any(),
                geometry: Type.Any()
            }))
        }),
        res: Content
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const profile = await config.models.Profile.from(user.email);
            const auth = profile.auth;
            const creatorUid = profile.username;

            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const pkg = new DataPackage();

            const buffs = [];
            pkg.archive.on('data', (d) => { buffs.push(d); });
            pkg.archive.on('end', async () => {
                const buff = Buffer.concat(buffs);
                const content = await api.Files.upload({
                    name: crypto.randomUUID(),
                    contentLength: Buffer.byteLength(buff),
                    keywords: [],
                    creatorUid: creatorUid,
                }, buff);

                return res.json(content)
            })

            for (const feat of req.body.features) {
                pkg.addCoT(CoT.from_geojson(feat))
            }

            pkg.finalize()

        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/marti/package', {
        name: 'List Packages',
        group: 'MartiPackages',
        description: 'Helper API to list packages',
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(Package)
        })
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const pkg = await api.Package.list({
                tool: 'public'
            });

            return res.json({
                total: pkg.resultCount,
                items: pkg.results
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/marti/package/:hash', {
        name: 'List Packages',
        group: 'MartiPackages',
        description: 'Helper API to get a single package',
        params: Type.Object({
            hash: Type.String()
        }),
        res: Package
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const pkg = await api.Package.list({
                uid: req.params.hash
            });

            if (!pkg.results.length) throw new Err(404, null, 'Package not found');

            return res.json(pkg.results[0]);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
