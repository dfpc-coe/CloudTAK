import path from 'node:path';
import crypto from 'node:crypto';
import busboy from 'busboy';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { Type } from '@sinclair/typebox'
import S3 from '../lib/aws/s3.js';
import CoT, { FileShare, DataPackage } from '@tak-ps/node-cot';
import { StandardResponse } from '../lib/types.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthUserAccess }  from '../lib/auth.js';
import Config from '../lib/config.js';
import { Content } from '../lib/api/files.js';
import { Package } from '../lib/api/package.js';
import TAKAPI, {
    APIAuthCertificate,
} from '../lib/tak-api.js';

export default async function router(schema: Schema, config: Config) {
    await schema.post('/marti/package', {
        name: 'Create File Package',
        group: 'MartiPackages',
        description: 'Helper API to create package',
        res: Package
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const profile = await config.models.Profile.from(user.email);
            const auth = profile.auth;
            const creatorUid = profile.username;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const id = crypto.randomUUID();
            const pkg = new DataPackage(id, id);

            if (req.headers['content-type'] && req.headers['content-type'].startsWith('multipart/form-data')) {
                const bb = busboy({
                    headers: req.headers,
                    limits: {
                        files: 1
                    }
                });

                bb.on('file', async (fieldname, file, meta) => {
                    try {
                        pkg.settings.name = meta.filename;
                        pkg.addFile(file, {
                            name: meta.filename,
                        });
                    } catch (err) {
                        return Err.respond(err, res);
                    }
                }).on('finish', async () => {
                    const out = await pkg.finalize()

                    const hash = await DataPackage.hash(out);

                    await api.Files.uploadPackage({
                        name: pkg.settings.name, creatorUid, hash
                    }, fs.createReadStream(out));

                    await pkg.destroy();

                    const pkgres = await api.Package.list({
                        uid: hash
                    });

                    if (!pkgres.results.length) throw new Err(404, null, 'Package not found');

                    return res.json(pkgres.results[0]);
                });

                return req.pipe(bb);
            } else {
                throw new Err(400, null, 'Unsupported Content-Type');
            }
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.put('/marti/package', {
        name: 'Create COT Package',
        group: 'MartiPackages',
        description: 'Helper API to create share package',
        body: Type.Object({
            type: Type.Literal('FeatureCollection'),
            uids: Type.Optional(Type.Array(Type.String())),
            features: Type.Array(Type.Object({
                id: Type.String(),
                type: Type.Literal('Feature'),
                properties: Type.Any(),
                geometry: Type.Any()
            }), {
                minItems: 1
            })
        }),
        res: Content
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const profile = await config.models.Profile.from(user.email);
            const auth = profile.auth;
            const creatorUid = profile.username;

            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const id = crypto.randomUUID();
            const pkg = new DataPackage(id, id);

            pkg.setEphemeral();

            // Hash => CoT UID
            const attachmentMap: Map<string, string> = new Map();
            for (const feat of req.body.features) {
                if (feat.properties.attachments && feat.properties.attachments.length) {
                    for (const hash of feat.properties.attachments) {
                        attachmentMap.set(hash, feat.id);
                    }
                }

                await pkg.addCoT(CoT.from_geojson(feat))
            }

            for (const [hash, uid] of Object.entries(attachmentMap)) {
                const attachment = await S3.list(`attachment/${hash}/`);
                if (attachment.length < 1) continue;
                await pkg.addFile(S3.get(attachment[0].Key), {
                    name: path.parse(attachment[0].Key).base
                });

                // TODO: Link Attachment to COT
            }

            const out = await pkg.finalize()

            const { size } = await fsp.stat(out);

            const content = await api.Files.upload({
                name: id,
                contentLength: size,
                keywords: [],
                creatorUid: creatorUid,
            }, fs.createReadStream(out));

            await pkg.destroy();

            const client = config.conns.get(profile.username);
            const cot = new FileShare({
                filename: id,
                name: id,
                senderCallsign: profile.tak_callsign,
                senderUid: `ANDROID-CloudTAK-${profile.username}`,
                senderUrl: `${config.server.api}/Marti/sync/content?hash=${content.Hash}`,
                sha256: content.Hash,
                sizeInBytes: size
            });

            if (client && req.body.uids) {
                cot.raw.event.detail.marti = {
                    dest: req.body.uids.map((uid) => {
                        return { _attributes: { uid: uid } };
                    })
                }
            }

            client.tak.write([cot]);

            return res.json(content)
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
        name: 'Get Package',
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

    await schema.delete('/marti/package/:hash', {
        name: 'Delete Package',
        group: 'MartiPackages',
        description: 'Helper API to delete a single package',
        params: Type.Object({
            hash: Type.String()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const api = await TAKAPI.init(
                new URL(String(config.server.api)),
                new APIAuthCertificate(
                    config.server.auth.cert,
                    config.server.auth.key
                )
            );

            const pkgs = await api.Package.list({
                uid: req.params.hash
            });

            if (!pkgs.results.length) {
                throw new Err(404, null, 'Package not found');
            }

            const pkg = pkgs.results[0];

            if (
                user.access !== AuthUserAccess.ADMIN
                && pkg.SubmissionUser !== user.email
            ) {
                throw new Err(403, null, 'Insufficient Acces to delete Package');
            }

            await api.Files.adminDelete(pkg.Hash);

            return res.json({
                status: 200,
                message: 'Package Deleted'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
