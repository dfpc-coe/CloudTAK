import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { GenericMartiResponse } from '../lib/types.js';
import { MissionRole, Mission, ChangesInput, ListInput, DeleteInput } from '../lib/api/mission.js';
import TAKAPI, {
    APIAuthCertificate,
} from '../lib/tak-api.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/marti/missions/:name', {
        name: 'Get Mission',
        group: 'MartiMissions',
        params: Type.Object({
            name: Type.String(),
        }),
        description: 'Helper API to get a single mission',
        query: Type.Object({
            password: Type.Optional(Type.Boolean()),
            changes: Type.Optional(Type.Boolean()),
            logs: Type.Optional(Type.Boolean()),
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

            const mission = await api.Mission.get(
                req.params.name,
                req.query,
                await config.conns.subscription(user.email, req.params.name)
            );

            return res.json(mission);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/marti/missions/:name/cot', {
        name: 'Mission Changes',
        group: 'MartiMissions',
        params: Type.Object({
            name: Type.String(),
        }),
        description: 'Helper API to get latest CoTs',
        res: Type.Object({
            type: Type.String(),
            features: Type.Array(Type.Any())
        })
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const features = await api.Mission.latestFeats(
                req.params.name,
                await config.conns.subscription(user.email, req.params.name)
            );

            return res.json({ type: 'FeatureCollection', features });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/marti/missions/:name/changes', {
        name: 'Mission Changes',
        group: 'MartiMissions',
        params: Type.Object({
            name: Type.String(),
        }),
        description: 'Helper API to get mission changes',
        query: ChangesInput,
        res: GenericMartiResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const changes = await api.Mission.changes(
                req.params.name,
                req.query,
                await config.conns.subscription(user.email, req.params.name)
            );

            return res.json(changes);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/marti/missions/:name', {
        name: 'Mission Delete',
        group: 'MartiMissions',
        params: Type.Object({
            name: Type.String(),
        }),
        description: 'Helper API to delete a single mission',
        query: DeleteInput,
        res: GenericMartiResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const mission = await api.Mission.delete(
                req.params.name,
                req.query,
                await config.conns.subscription(user.email, req.params.name)
            );
            return res.json(mission);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/marti/missions/:name', {
        name: 'Create Mission',
        group: 'MartiMissions',
        params: Type.Object({
            name: Type.String(),
        }),
        description: 'Helper API to create a mission',
        query: Type.Object({
            creatorUid: Type.Optional(Type.String()),
            group: Type.Optional(Type.String()),
            description: Type.Optional(Type.String()),
            chatRoom: Type.Optional(Type.String()),
            baseLayer: Type.Optional(Type.String()),
            bbox: Type.Optional(Type.String()),
            boundingPolygon: Type.Optional(Type.String()),
            path: Type.Optional(Type.String()),
            classification: Type.Optional(Type.String()),
            tool: Type.Optional(Type.String()),
            password: Type.Optional(Type.String()),
            defaultRole: Type.Optional(Type.String()),
            expiration: Type.Optional(Type.Integer()),
            inviteOnly: Type.Optional(Type.Boolean()),
            allowDupe: Type.Optional(Type.Boolean()),
        }),
        res: Mission
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const mission = await api.Mission.create(req.params.name, {
                ...req.query,
                group: req.query.group ? req.query.group.split(',') : req.query.group,
                // @ts-expect-error Handle string or string[]
                bbox: req.query.bbox ? req.query.bbox.split(',') : req.query.bbox,
                creatorUid: user.email
            });

            return res.json(mission);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/marti/mission', {
        name: 'List Missions',
        group: 'MartiMissions',
        description: 'Helper API to list missions',
        query: ListInput,
        res: GenericMartiResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const missions = await api.Mission.list(req.query);

            return res.json(missions);
        } catch (err) {
            return Err.respond(err, res);
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

            const role = await api.Mission.role(
                req.params.name,
                await config.conns.subscription(user.email, req.params.name)
            );

            return res.json(role);
        } catch (err) {
            return Err.respond(err, res);
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

            const subs = await api.Mission.subscriptions(
                req.params.name,
                await config.conns.subscription(user.email, req.params.name)
            );

            return res.json(subs);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/marti/missions/:name/subscriptions/roles', {
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

            const roles = await api.Mission.subscriptionRoles(
                req.params.name,
                await config.conns.subscription(user.email, req.params.name)
            );

            return res.json(roles);
        } catch (err) {
            return Err.respond(err, res);
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

            const missions = await api.Mission.contacts(
                req.params.name,
                await config.conns.subscription(user.email, req.params.name)
            );

            return res.json(missions);
        } catch (err) {
            return Err.respond(err, res);
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

            const missionContent = await api.Mission.attachContents(
                req.params.name,
                {
                    hashes: [content.Hash]
                },
                await config.conns.subscription(user.email, req.params.name)
            );

            return res.json(missionContent);
        } catch (err) {
            return Err.respond(err, res);
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

            const missionContent = await api.Mission.detachContents(
                req.params.name,
                {
                    hash: req.params.hash
                },
                await config.conns.subscription(user.email, req.params.name)
            );

            return res.json(missionContent);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
