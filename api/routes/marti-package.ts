import fs from 'node:fs'
import crypto from 'node:crypto';
import xmljs from 'xml-js';
import { Type } from '@sinclair/typebox'
import archiver from 'archiver';
import TAK from '@tak-ps/node-tak';
import Schema from '@openaddresses/batch-schema';
import { CoT } from '@tak-ps/node-tak';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { StandardResponse, GenericMartiResponse } from '../lib/types.js';
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
            type: Type.String(),
            features: Type.Array(Type.Object({
                id: Type.String(),
                type: Type.String(),
                properties: Type.Any(),
                geometry: Type.Any()
            }))
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const archive = archiver('zip', { zlib: { level: 9 } });
            const manifest = {
                MissionPackageManifest: {
                    _attributes: { version: 2 },
                    Configuration: {
                        Parameter: [{
                            _attributes: { name: "onReceiveImport", value: "true" },
                            _attributes: { name: "onReceiveDelete", value: "true" },
                        }],
                        Contents: {
                            Content: []
                        }
                    }
                }
            };

            for (const feat of req.body.features) {
                const cot = CoT.from_geojson(feat);
                manifest.MissionPackageManifest.Configuration.Contents.Content.push({
                    _attributes: { ignore: "false", zipEntry: `${feat.id}/${feat.id}.cot` },
                    Parameter: [{ name: 'uid', value: feat.id }, { name: 'name', value: feat.properties.callsign }]
                })
                archive.append(cot.to_xml(), { name: `${feat.id}/${feat.id}.cot` });
            }

            archive.append(Buffer.from(xmljs.js2xml(manifest, { compact: true })), { name: 'MANIFEST/manifest.xml' });

            archive.pipe(fs.createWriteStream('/tmp/download.zip'));
            archive.finalize();

            return res.json({
                status: 200,
                message: 'Data Package Created'
            });
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
