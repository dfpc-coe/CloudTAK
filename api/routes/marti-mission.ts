import { Static, Type } from '@sinclair/typebox'
import path from 'node:path';
import qr from 'qr-image';
import tokml from 'tokml';
import Schema from '@openaddresses/batch-schema';
import { Feature } from '@tak-ps/node-cot'
import S3 from '../lib/aws/s3.js';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { GenericMartiResponse, StandardResponse } from '../lib/types.js';
import {
    MissionOptions,
    MissionRole,
    Mission,
    MissionChangesInput,
    MissionListInput,
    MissionChange,
    MissionDeleteInput,
    MissionCreateInput,
    MissionSubscriber
} from '@tak-ps/node-tak/lib/api/mission';
import {
    TAKList,
} from '@tak-ps/node-tak/lib/api/types';
import { TAKAPI, APIAuthCertificate, } from '@tak-ps/node-tak';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/marti/missions/:name', {
        name: 'Get Mission',
        group: 'MartiMissions',
        params: Type.Object({
            name: Type.String(),
        }),
        description: 'Helper API to get a single mission',
        query: Type.Object({
            password: Type.Optional(Type.String()),
            changes: Type.Boolean({
                default: false,
                description: 'If true, include changes array in the resulting Mission'
            }),
            logs: Type.Boolean({
                default: false,
                description: 'If true, include logs array in the resulting Mission'
            }),
            secago: Type.Optional(Type.Integer()),
            start: Type.Optional(Type.String()),
            end: Type.Optional(Type.String())
        }),
        res: Mission
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                ? { token: String(req.headers['missionauthorization']) }
                : await config.conns.subscription(user.email, req.params.name)

            const mission = await api.Mission.get(
                req.params.name,
                req.query,
                opts
            );

            res.json(mission);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/marti/missions/:guid/cot', {
        name: 'Mission Features',
        group: 'MartiMissions',
        params: Type.Object({
            guid: Type.String(),
        }),
        description: 'Helper API to get latest CoTs',
        res: Type.Object({
            type: Type.String(),
            features: Type.Array(Feature.Feature)
        })
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                ? { token: String(req.headers['missionauthorization']) }
                : await config.conns.subscription(user.email, req.params.guid)

            const features = await api.Mission.latestFeats(req.params.guid, opts);

            res.json({ type: 'FeatureCollection', features });
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.delete('/marti/missions/:guid/cot/:uid', {
        name: 'Mission Features Delete',
        group: 'MartiMissions',
        params: Type.Object({
            guid: Type.String(),
            uid: Type.String()
        }),
        description: 'Delete an upload by hash',
        res: GenericMartiResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const profile = await config.models.Profile.from(user.email);
            const auth = profile.auth;

            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                ? { token: String(req.headers['missionauthorization']) }
                : await config.conns.subscription(user.email, req.params.guid)

            const missionContent = await api.Mission.detachContents(
                req.params.guid,
                {
                    uid: req.params.uid
                },
                opts
            );

            res.json(missionContent);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/marti/missions/:name/qr', {
        name: 'Mission QR',
        group: 'MartiMissions',
        params: Type.Object({
            name: Type.String(),
        }),
        description: 'Return an SVG of a QR Code for a mission',
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req, { token: true });
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                ? { token: String(req.headers['missionauthorization']) }
                : await config.conns.subscription(user.email, req.params.name)

            const mission = await api.Mission.get(
                req.params.name,
                {},
                opts
            );

            res.type('svg');

            const svg = qr.image([
                `${config.server.url.replace('ssl://', '')}:ssl`,
                `${config.server.api.replace('https://', '')}-ssl-${mission.name}`,
                mission.name
            ].join(','), { type: 'svg' });

            svg.pipe(res);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/marti/missions/:name/changes', {
        name: 'Mission Changes',
        group: 'MartiMissions',
        params: Type.Object({
            name: Type.String(),
        }),
        description: 'Helper API to get mission changes',
        query: MissionChangesInput,
        res: TAKList(MissionChange)
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                ? { token: String(req.headers['missionauthorization']) }
                : await config.conns.subscription(user.email, req.params.name)

            const changes = await api.Mission.changes(
                req.params.name,
                req.query,
                opts
            );

            res.json(changes);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.delete('/marti/missions/:name', {
        name: 'Mission Delete',
        group: 'MartiMissions',
        params: Type.Object({
            name: Type.String(),
        }),
        description: 'Helper API to delete a single mission',
        query: MissionDeleteInput,
        res: GenericMartiResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                ? { token: String(req.headers['missionauthorization']) }
                : await config.conns.subscription(user.email, req.params.name)

            const mission = await api.Mission.delete(
                req.params.name,
                req.query,
                opts
            );

            res.json(mission);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.post('/marti/mission', {
        name: 'Create Mission',
        group: 'MartiMissions',
        description: 'Helper API to create a mission',
        body: Type.Omit(MissionCreateInput, ['creatorUid']),
        res: Mission
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const mission = await api.Mission.create({
                ...req.body,
                creatorUid: `ANDROID-CloudTAK-${user.email}`
            });

            res.json(mission);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.patch('/marti/missions/:name', {
        name: 'Update Mission',
        group: 'MartiMissions',
        description: 'Helper API to create a mission',
        params: Type.Object({
            name: Type.String(),
        }),
        body: Type.Object({
            description: Type.Optional(Type.String()),
            keywords: Type.Optional(Type.Array(Type.String())),
        }),
        res: Mission
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                ? { token: String(req.headers['missionauthorization']) }
                : await config.conns.subscription(user.email, req.params.name)

            const mission = await api.Mission.update(
                req.params.name,
                req.body,
                opts
            );

            res.json(mission);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/marti/mission', {
        name: 'List Missions',
        group: 'MartiMissions',
        description: 'Helper API to list missions',
        query: MissionListInput,
        res: TAKList(Mission)
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const missions = await api.Mission.list(req.query);

            res.json(missions);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/marti/missions/:name/archive', {
        name: 'Mission Archive',
        group: 'MartiMissions',
        params: Type.Object({
            name: Type.String(),
        }),
        query: Type.Object({
            format: Type.String({
                default: 'zip',
                enum: ['zip', 'geojson', 'kml'],
                description: 'The archive format to return'
            }),
            download: Type.Boolean({
                default: false,
                description: 'If set, the response will include a Content-Disposition Header'
            })
        }),
        description: 'Get a Mission Archive Zip'
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                ? { token: String(req.headers['missionauthorization']) }
                : await config.conns.subscription(user.email, req.params.name)

            if (req.query.download) {
                res.setHeader('Content-Disposition', `attachment; filename="${req.params.name}.${req.query.format}"`);
            }

            if (req.query.format === 'zip') {
                const archive = await api.Mission.getArchive(
                    req.params.name,
                    opts
                );

                res.setHeader('Content-Type', 'application/zip');

                archive.pipe(res);
            } else if (['geojson', 'kml'].includes(req.query.format)) {
                const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                    ? { token: String(req.headers['missionauthorization']) }
                    : await config.conns.subscription(user.email, req.params.name)

                const fc = {
                    type: 'FeatureCollection',
                    features: await api.Mission.latestFeats(req.params.name, opts)
                };

                if (req.query.format === 'geojson') {
                    res.set('Content-Type', 'application/geo+json');
                    const output = Buffer.from(JSON.stringify(fc, null, 4));

                    res.set('Content-Length', String(Buffer.byteLength(output)));
                    res.write(output);
                    res.end();
                } else if (req.query.format === 'kml') {
                    res.set('Content-Type', 'application/vnd.google-earth.kml+xml');

                    const output = Buffer.from(tokml(fc, {
                        documentName: req.params.name,
                        documentDescription: 'Exported from CloudTAK',
                        simplestyle: true,
                        name: 'callsign',
                        description: 'remarks'
                    }));

                    res.set('Content-Length', String(Buffer.byteLength(output)));
                    res.write(output);
                    res.end();
                } else {
                    throw new Err(400, null, `Unknown Export Format: ${req.query.format}`);
                }
            }
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/marti/missions/:name/role', {
        name: 'Mission Role',
        group: 'MartiMissions',
        params: Type.Object({
            name: Type.String(),
        }),
        description: 'Return a role associated with your user',
        res: MissionRole
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                ? { token: String(req.headers['missionauthorization']) }
                : await config.conns.subscription(user.email, req.params.name)

            const role = await api.Mission.role(
                req.params.name,
                opts
            );

            res.json(role);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/marti/missions/:name/subscriptions', {
        name: 'Mission Subscriptions',
        group: 'MartiMissions',
        params: Type.Object({
            name: Type.String(),
        }),
        description: 'List subscriptions associated with a mission',
        res: GenericMartiResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                ? { token: String(req.headers['missionauthorization']) }
                : await config.conns.subscription(user.email, req.params.name)

            const subs = await api.Mission.subscriptions(
                req.params.name,
                opts
            );

            res.json(subs);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/marti/missions/:name/subscriptions/roles', {
        name: 'Mission Subscriptions',
        group: 'MartiMissions',
        params: Type.Object({
            name: Type.String(),
        }),
        description: 'List subscriptions associated with a mission',
        res: TAKList(MissionSubscriber)
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                ? { token: String(req.headers['missionauthorization']) }
                : await config.conns.subscription(user.email, req.params.name)

            const roles = await api.Mission.subscriptionRoles(
                req.params.name,
                opts
            );

            res.json(roles);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/marti/missions/:name/contacts', {
        name: 'Mission Contacts',
        group: 'MartiMissions',
        params: Type.Object({
            name: Type.String(),
        }),
        description: 'List contacts associated with a mission',
        res: Type.Array(Type.Object({
            filterGroups: Type.Array(Type.String()),
            notes: Type.String(),
            callsign: Type.String(),
            team: Type.String(),
            role: Type.String(),
            takv: Type.String(),
            uid: Type.String(),
        })),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                ? { token: String(req.headers['missionauthorization']) }
                : await config.conns.subscription(user.email, req.params.name)

            const missions = await api.Mission.contacts(
                req.params.name,
                opts
            );

            res.json(missions);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.put('/marti/missions/:name/upload', {
        name: 'Mission Attach',
        group: 'MartiMissions',
        params: Type.Object({
            name: Type.String(),
        }),
        description: 'Attach via upload',
        body: Type.Object({
            assets: Type.Array(Type.Object({
                type: Type.Literal('profile'),
                id: Type.String()
            }), {
                default: []
            }),
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const profile = await config.models.Profile.from(user.email);
            const auth = profile.auth;
            const creatorUid = profile.username;

            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const contents: string[] = [];

            for (const asset of req.body.assets) {
                const file = await config.models.ProfileFile.from(asset.id);

                if (file.username !== user.email) {
                    throw new Err(400, null, 'You can only attach your own files');
                }

                const content = await api.Files.upload({
                    name: file.name,
                    contentLength: file.size,
                    keywords: [],
                    creatorUid: creatorUid,
                }, await S3.get(`profile/${user.email}/${file.id}${path.parse(file.name).ext}`));

                contents.push(content.Hash);
            }

            const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                ? { token: String(req.headers['missionauthorization']) }
                : await config.conns.subscription(user.email, req.params.name)


            await api.Mission.attachContents(
                req.params.name,
                {
                    hashes: contents
                },
                opts
            );

            res.json({
                status: 200,
                message: 'Files Attached'
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.post('/marti/missions/:name/upload', {
        name: 'Mission Upload',
        group: 'MartiMissions',
        params: Type.Object({
            name: Type.String(),
        }),
        description: 'Create an upload',
        query: Type.Object({
            name: Type.String()
        }),
        res: GenericMartiResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const profile = await config.models.Profile.from(user.email);
            const auth = profile.auth;
            const creatorUid = profile.username;

            const name = String(req.query.name);

            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const content = await api.Files.upload({
                name: name,
                contentLength: Number(req.headers['content-length']),
                keywords: [],
                creatorUid: creatorUid,
            }, req);

            // @ts-expect-error Morgan will throw an error after not getting req.ip and there not being req.connection.remoteAddress
            req.connection = {
                // @ts-expect-error not a known type
                remoteAddress: req._remoteAddress
            }

            const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                ? { token: String(req.headers['missionauthorization']) }
                : await config.conns.subscription(user.email, req.params.name)

            const missionContent = await api.Mission.attachContents(
                req.params.name,
                {
                    hashes: [content.Hash]
                },
                opts
            );

            res.json(missionContent);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.delete('/marti/missions/:name/upload/:hash', {
        name: 'Mission Upload Delete',
        group: 'MartiMissions',
        params: Type.Object({
            name: Type.String(),
            hash: Type.String()
        }),
        description: 'Delete an upload by hash',
        res: GenericMartiResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const profile = await config.models.Profile.from(user.email);
            const auth = profile.auth;

            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                ? { token: String(req.headers['missionauthorization']) }
                : await config.conns.subscription(user.email, req.params.name)

            const missionContent = await api.Mission.detachContents(
                req.params.name,
                {
                    hash: req.params.hash
                },
                opts
            );

            res.json(missionContent);
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
