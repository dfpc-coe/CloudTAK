import { Type } from '@sinclair/typebox'
import TAK from '@tak-ps/node-tak';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { GenericMartiResponse } from '../lib/types.js';
import { MissionSubscriber, Mission, ChangesInput } from '../lib/api/mission.js';
import { Profile } from '../lib/schema.js';
import S3 from '../lib/aws/s3.js';
import TAKAPI, {
    APIAuthToken,
    APIAuthCertificate,
    APIAuthPassword
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
            logs: Type.Optional(Type.String()),
            secago: Type.Optional(Type.String()),
            start: Type.Optional(Type.String()),
            end: Type.Optional(Type.String())
        }),
        res: Mission
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const query: Record<string, string> = {};
            for (const q in req.query) query[q] = String(req.query[q]);
            const mission = await api.Mission.get(req.params.name, query);

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
            const features = await api.Mission.latestFeats(req.params.name);
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

            const changes = await api.Mission.changes(req.params.name, req.query);

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
        query: Type.Object({
            creatorUid: Type.Optional(Type.String()),
            deepDelete: Type.Optional(Type.Boolean())
        }),
        res: GenericMartiResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const query: Record<string, string> = {};
            for (const q in req.query) query[q] = String(req.query[q]);
            const mission = await api.Mission.delete(req.params.name, query);
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
            group: Type.Optional(Type.Array(Type.String())),
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
            expiration: Type.Optional(Type.String()),
            inviteOnly: Type.Optional(Type.String()),
            allowDupe: Type.Optional(Type.String()),
        }),
        res: GenericMartiResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const query: any = {};
            for (const q in req.query) query[q] = String(req.query[q]);
            const mission = await api.Mission.create(req.params.name, query);
            return res.json(mission);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/marti/mission', {
        name: 'List Missions',
        group: 'MartiMissions',
        description: 'Helper API to list missions',
        query: Type.Object({
            passwordProtected: Type.Optional(Type.Boolean()),
            defaultRole: Type.Optional(Type.Boolean()),
            nameFilter: Type.Optional(Type.String()),
            tool: Type.Optional(Type.String()),
        }),
        res: GenericMartiResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const query: Record<string, string> = {};
            for (const q in req.query) query[q] = String(req.query[q]);
            const missions = await api.Mission.list(query);
            return res.json(missions);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/marti/missions/:name/subscription', {
        name: 'Mission Subscription',
        group: 'MartiMissions',
        params: Type.Object({
            name: Type.String(),
        }),
        description: 'Return subscriptions associated with your user',
        res: MissionSubscriber
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const sub = await api.Mission.subscription(String(req.params.name));

            return res.json(sub);
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

            const subs = await api.Mission.subscriptions(String(req.params.name));

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

            const roles = await api.Mission.subscriptionRoles(String(req.params.name));

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

            const missions = await api.Mission.contacts(String(req.params.name));

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
                // @ts-expect-error
                remoteAddress: req._remoteAddress
            }

            const missionContent = await api.Mission.attachContents(req.params.name, {
                hashes: [content.Hash]
            });

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

            const missionContent = await api.Mission.detachContents(req.params.name, {
                hash: req.params.hash
            });

            return res.json(missionContent);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
