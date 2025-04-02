import os from 'node:os';
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
import { Basemap as BasemapParser } from '@tak-ps/node-cot';
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

            if (req.headers['content-type'] && req.headers['content-type'].startsWith('multipart/form-data')) {
                const bb = busboy({
                    headers: req.headers,
                    limits: {
                        files: 1
                    }
                });

                let singleFile: Promise<DataPackage> | undefined = undefined;
                bb.on('file', (fieldname, file, meta) => {
                    singleFile = (async () => {
                        const { ext } = path.parse(meta.filename);
                        const filePath = path.resolve(os.tmpdir(), `${crypto.randomUUID()}${ext}`);
                        await fsp.writeFile(filePath, file);

                        try {
                            return await DataPackage.parse(filePath)
                        } catch (err) {
                            console.error('ok - treaing as unique file (not a DataPackage)', err);

                            const pkg = new DataPackage(id, id);

                            pkg.settings.name = meta.filename;
                            await pkg.addFile(filePath, {
                                name: meta.filename,
                            });

                            return pkg;
                        }
                    })();
                }).on('finish', async () => {
                    if (!singleFile) throw new Err(400, null, 'No File Provided');

                    const pkg = await singleFile;
                    const out = await pkg.finalize();

                    const hash = await DataPackage.hash(out);

                    await api.Files.uploadPackage({
                        name: pkg.settings.name, creatorUid, hash
                    }, fs.createReadStream(out));

                    await pkg.destroy();

                    const pkgres = await api.Package.list({
                        uid: hash
                    });

                    if (!pkgres.results.length) throw new Err(404, null, 'Package not found');

                    res.json(pkgres.results[0]);
                });

                req.pipe(bb);
            } else {
                throw new Err(400, null, 'Unsupported Content-Type');
            }
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.put('/marti/package', {
        name: 'Create COT Package',
        group: 'MartiPackages',
        description: 'Helper API to create share package',
        body: Type.Object({
            type: Type.Optional(Type.Literal('FeatureCollection')),
            name: Type.Optional(Type.String({
                description: 'Data Package Name'
            })),
            public: Type.Boolean({
                default: false,
                description: 'Should the Data Package be a public package, if so it will be published to the Data Package list'
            }),
            uids: Type.Array(Type.String(), {
                default: []
            }),
            basemaps: Type.Array(Type.Number(), {
                default: []
            }),
            features: Type.Array(Type.Object({
                id: Type.String(),
                type: Type.Literal('Feature'),
                properties: Type.Any(),
                geometry: Type.Any()
            }), {
                default: []
            })
        }),
        res: Content
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const profile = await config.models.Profile.from(user.email);
            const auth = profile.auth;
            const creatorUid = profile.username;

            if (!req.body.basemaps.length && !req.body.features.length) {
                throw new Err(400, null, 'Cannot share an empty package');
            }

            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const id = crypto.randomUUID();
            const pkg = new DataPackage(id, req.body.name || id);

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

            for (const basemapid of req.body.basemaps) {
                const basemap = await config.models.Basemap.from(basemapid);
                if (basemap.username && basemap.username !== user.email && user.access === AuthUserAccess.USER) {
                    throw new Err(400, null, 'You don\'t have permission to access this resource');
                }
                const xml: string = (new BasemapParser({
                    customMapSource: {
                        name: { _text: basemap.name },
                        minZoom: { _text: basemap.minzoom },
                        maxZoom: { _text: basemap.maxzoom },
                        tileType: { _text: basemap.format },
                        tileUpdate: { _text: 'None' },
                        url: { _text: basemap.url },
                        backgroundColor: { _text: '#000000' },
                    }
                })).to_xml();

                await pkg.addFile(xml, {
                    name: `basemap-${basemap.id}.xml`
                });
            }

            for (const hash of attachmentMap.keys()) {
                const uid = attachmentMap.get(hash);
                if (!uid) continue;

                const attachment = await S3.list(`attachment/${hash}/`);

                if (attachment.length < 1 || !attachment[0].Key) continue;
                await pkg.addFile(await S3.get(attachment[0].Key), {
                    name: path.parse(attachment[0].Key).base,
                    attachment: uid
                });
            }

            const out = await pkg.finalize()

            const { size } = await fsp.stat(out);

            let content;
            if (req.body.public) {
                const hash = await DataPackage.hash(out);

                await api.Files.uploadPackage({
                    name: pkg.settings.name, creatorUid, hash
                }, fs.createReadStream(out));

                // TODO Ask ARA for a Content endpoint to lookup by hash to mirror upload API
                content = {
                    UID: id,
                    SubmissionDateTime: new Date().toISOString(),
                    Keywords: [],
                    MIMEType: 'application/octet-stream',
                    SubmissionUser: user.email,
                    PrimaryKey: hash,
                    Hash: hash,
                    CreatorUid: creatorUid,
                    Name: pkg.settings.name
                }
            } else {
                content = await api.Files.upload({
                    name: id,
                    contentLength: size,
                    keywords: [],
                    creatorUid,
                }, fs.createReadStream(out));
            }

            await pkg.destroy();

            const client = config.conns.get(profile.username);

            if (client && req.body.uids.length) {
                const cot = new FileShare({
                    filename: id,
                    name: id,
                    senderCallsign: profile.tak_callsign,
                    senderUid: `ANDROID-CloudTAK-${profile.username}`,
                    senderUrl: `${config.server.api}/Marti/sync/content?hash=${content.Hash}`,
                    sha256: content.Hash,
                    sizeInBytes: size
                });

                if (!cot.raw.event.detail) cot.raw.event.detail = {};
                cot.raw.event.detail.marti = {
                    dest: req.body.uids.map((uid) => {
                        return { _attributes: { uid: uid } };
                    })
                }

                client.tak.write([cot]);
            }

            res.json(content)
        } catch (err) {
             Err.respond(err, res);
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

            res.json({
                total: pkg.resultCount,
                items: pkg.results
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/marti/package/:uid', {
        name: 'Get Package',
        group: 'MartiPackages',
        description: 'Helper API to get a single package',
        params: Type.Object({
            uid: Type.String()
        }),
        res: Package
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const pkg = await api.Package.list({
                uid: req.params.uid
            });

            if (!pkg.results.length) throw new Err(404, null, 'Package not found');

            res.json(pkg.results[0]);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.delete('/marti/package/:uid', {
        name: 'Delete Package',
        group: 'MartiPackages',
        description: 'Helper API to delete a single package',
        params: Type.Object({
            uid: Type.String()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const auth = config.serverCert();

            const api = await TAKAPI.init(
                new URL(String(config.server.api)),
                new APIAuthCertificate(auth.cert, auth.key)
            );

            const pkgs = await api.Package.list({
                uid: req.params.uid
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

            res.json({
                status: 200,
                message: 'Package Deleted'
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
