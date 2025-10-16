import os from 'node:os';
import dns from 'node:dns/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import busboy from 'busboy';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Type, Static } from '@sinclair/typebox'
import { sql } from 'drizzle-orm';
import S3 from '../lib/aws/s3.js';
import { CoTParser, FileShare, DataPackage } from '@tak-ps/node-cot';
import TileJSON from '../lib/control/tilejson.js';
import { StandardResponse } from '../lib/types.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthUserAccess }  from '../lib/auth.js';
import Config from '../lib/config.js';
import { Basemap as BasemapParser } from '@tak-ps/node-cot';
import { Content } from '@tak-ps/node-tak/lib/api/files';
import { Package } from '@tak-ps/node-tak/lib/api/package';
import { TAKAPI, APIAuthCertificate, } from '@tak-ps/node-tak';
import {
    MissionOptions,
} from '@tak-ps/node-tak/lib/api/mission';

export default async function router(schema: Schema, config: Config) {
    await schema.post('/marti/package', {
        name: 'Create File Package',
        group: 'MartiPackages',
        description: 'Helper API to create package',
        query: Type.Object({
            name: Type.Optional(Type.String({})),
            groups: Type.Optional(Type.Union([
                Type.Array(Type.String()),
                Type.String()
            ])),
            keywords: Type.Optional(Type.Union([
                Type.Array(Type.String()),
                Type.String()
            ])),
        }),
        res: Package
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const profile = await config.models.Profile.from(user.email);
            const auth = profile.auth;
            const creatorUid = profile.username;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));
            const id = crypto.randomUUID();

            let keywords: string[] | undefined = undefined;
            let groups: string[] | undefined = undefined;
            if (req.query.groups && typeof req.query.groups === 'string') {
                groups = [ req.query.groups ];
            } else if (req.query.groups && Array.isArray(req.query.groups)) {
                groups = req.query.groups;
            }

            if (req.query.keywords && typeof req.query.keywords === 'string') {
                keywords = [ req.query.keywords ];
            } else if (req.query.groups && Array.isArray(req.query.keywords)) {
                keywords = req.query.keywords;
            }

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

                        await pipeline(
                            file,
                            await fs.createWriteStream(filePath)
                        )

                        try {
                            return await DataPackage.parse(filePath)
                        } catch (err) {
                            console.error('ok - treating as unique file (not a DataPackage)', err);

                            const pkg = new DataPackage(id, id);

                            pkg.settings.name = req.query.name || meta.filename;
                            await pkg.addFile(filePath, {
                                name: meta.filename,
                            });

                            return pkg;
                        }
                    })();
                }).on('finish', async () => {
                    try {
                        if (!singleFile) throw new Err(400, null, 'No File Provided');

                        const pkg = await singleFile;
                        const out = await pkg.finalize();

                        const hash = await DataPackage.hash(out);

                        await api.Files.uploadPackage({
                            name: pkg.settings.name,
                            creatorUid, hash,
                            keywords, groups,
                        }, fs.createReadStream(out));

                        await pkg.destroy();

                        const pkgres = await api.Package.list({
                            uid: hash
                        });

                        if (!pkgres.results.length) throw new Err(404, null, 'Package not found');

                        res.json(pkgres.results[0]);
                    } catch (err) {
                        Err.respond(err, res);
                    }
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
        name: 'Create Package',
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
            groups: Type.Optional(Type.Array(Type.String(), {
                description: 'Channels that the Data Package should be shared with, use in conjunction with public=true'
            })),
            keywords: Type.Array(Type.String(), {
                default: [],
                description: 'Hash Tags to assign to the package'
            }),
            destinations: Type.Array(Type.Object({
                uid: Type.Optional(Type.String({
                    description: 'A User UID to share the package with'
                })),
                group: Type.Optional(Type.String({
                    description: 'A Channel/Group to share the package with'
                })),
                mission: Type.Optional(Type.String({
                    description: 'A Mission GUID to share the package with, note the user must be actively subscribed to the Mission'
                }))
            }), {
                default: [],
                description: 'A list of destinations to automatically share the data package with'
            }),
            assets: Type.Array(Type.Object({
                type: Type.Literal('profile'),
                id: Type.String()
            }), {
                default: []
            }),
            basemaps: Type.Array(Type.Number(), {
                default: [],
                description: 'A list of CloudTAK basemap IDs to include in the package'
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

            if (!req.body.basemaps.length && !req.body.features.length && !req.body.assets.length) {
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

                await pkg.addCoT(await CoTParser.from_geojson(feat))
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
                        url: { _text: TileJSON.proxyShare(config, basemap) },
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

            for (const asset of req.body.assets) {
                const file = await config.models.ProfileFile.from(asset.id);

                if (file.username !== user.email) {
                    throw new Err(400, null, 'You can only attach your own files');
                }

                await pkg.addFile(await S3.get(`profile/${user.email}/${file.id}${path.parse(file.name).ext}`), {
                    name: file.name
                });
            }

            const out = await pkg.finalize()

            const { size } = await fsp.stat(out);

            let content;
            if (req.body.public) {
                const hash = await DataPackage.hash(out);

                await api.Files.uploadPackage({
                    name: pkg.settings.name, creatorUid, hash,
                    keywords: req.body.keywords,
                    groups: req.body.groups
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
                    keywords: req.body.keywords,
                    creatorUid,
                }, fs.createReadStream(out));
            }

            const client = config.conns.get(profile.username);

            if (
                client
                    && req.body.destinations.length
                    && req.body.destinations.filter((d) => !d.mission).length
            ) {
                const url = new URL(config.server.api);

                const cot = new FileShare({
                    filename: id,
                    name: id,
                    senderCallsign: profile.tak_callsign,
                    senderUid: `ANDROID-CloudTAK-${profile.username}`,
                    // iTAK currently doesn't support DNS - Ref: https://issues.tak.gov/projects/ITAK/issues/ITAK-57
                    senderUrl: `https://${(await dns.lookup(url.hostname)).address}:${url.port}/Marti/sync/content?hash=${content.Hash}`,
                    sha256: content.Hash,
                    sizeInBytes: size
                });

                if (!cot.raw.event.detail) cot.raw.event.detail = {};
                cot.raw.event.detail.marti = {
                    dest: req.body.destinations
                        .filter((d) => !d.mission)
                        .map((dest) => {
                            return { _attributes: dest };
                        })
                }

                client.tak.write([cot]);
            }

            if (req.body.destinations.length && req.body.destinations.filter((d) => d.mission).length) {
                const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

                const guids = req.body.destinations.filter((d) => d.mission).map((d) => d.mission) as string[];

                const ovs = new Map();
                (await config.models.ProfileOverlay.list({
                    where: sql`
                        username = ${user.email}
                        AND mode = 'mission'
                    `
                })).items.map(o => ovs.set(o.mode_id, o));

                for (const guid of guids) {
                    if (!ovs.get(guid)) {
                        throw new Err(400, null, `You are not subscribed to mission ${guid}`);
                    }

                    const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                        ? { token: String(req.headers['missionauthorization']) }
                        : await config.conns.subscription(user.email, guid)

                    await api.Mission.upload(
                        guid,
                        user.email,
                        fs.createReadStream(out),
                        opts
                    );
                }
            }

            res.json(content)

            await pkg.destroy();
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
        description: `
            Helper API to get metadata for a single package

            DataPackages uploaded once will have a single entry by UID, however DataPackages uploaded multiple times
            will have the same UID but multiple hash values with the latest having the most recent submission date

            By default this api will return the latest package, however if you provide a hash query parameter it will return that specific package
        `,
        params: Type.Object({
            uid: Type.String()
        }),
        query: Type.Object({
            hash: Type.Optional(Type.String())
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

            pkg.results.sort((a, b) => {
                return new Date(a.SubmissionDateTime).getTime() - new Date(b.SubmissionDateTime).getTime();
            });

            if (req.query.hash) {
                const match = pkg.results.find((p) => p.Hash === req.query.hash);
                if (!match) throw new Err(404, null, 'Package found but no matching hash');
                return res.json(match);
            } else {
                res.json(pkg.results[pkg.results.length - 1]);
            }
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.delete('/marti/package/:uid', {
        name: 'Delete Package',
        group: 'MartiPackages',
        description: 'Helper API to delete a package',
        params: Type.Object({
            uid: Type.String()
        }),
        query: Type.Object({
            hash: Type.Optional(Type.String())
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

            pkgs.results.sort((a, b) => {
                return new Date(a.SubmissionDateTime).getTime() - new Date(b.SubmissionDateTime).getTime();
            });

            const pkg = pkgs.results[pkgs.results.length - 1];

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
