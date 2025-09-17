import { Static, Type } from '@sinclair/typebox'
import { StandardResponse } from '../lib/types.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import * as Default from '../lib/limits.js';
import { MissionOptions } from '@tak-ps/node-tak/lib/api/mission';
import { MissionLayer, MissionLayerType } from '@tak-ps/node-tak/lib/api/mission-layer';
import {
    TAKItem,
    TAKList
} from '@tak-ps/node-tak/lib/api/types';
import { TAKAPI, APIAuthCertificate, } from '@tak-ps/node-tak';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/marti/missions/:name/layer', {
        name: 'List Layers',
        group: 'MartiMissionLayer',
        params: Type.Object({
            name: Type.String()
        }),
        description: 'Helper API list mission layers',
        res: TAKList(MissionLayer)
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                ? { token: String(req.headers['missionauthorization']) }
                : await config.conns.subscription(user.email, req.params.name)

            const list = await api.MissionLayer.list(
                req.params.name,
                opts
            );

            res.json(list);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/marti/missions/:name/layer/:layerid', {
        name: 'Get Layer',
        group: 'MartiMissionLayer',
        params: Type.Object({
            name: Type.String(),
            layerid: Type.String()
        }),
        description: 'Helper API to get mission layer',
        res: TAKItem(MissionLayer)
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                ? { token: String(req.headers['missionauthorization']) }
                : await config.conns.subscription(user.email, req.params.name)

            const layer = await api.MissionLayer.get(
                req.params.name,
                req.params.layerid,
                opts
            );

            res.json(layer);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.post('/marti/missions/:name/layer', {
        name: 'Create Layer',
        group: 'MartiMissionLayer',
        params: Type.Object({
            name: Type.String()
        }),
        body: Type.Object({
            name: Default.NameField,
            type: Type.Enum(MissionLayerType),
            uid: Type.Optional(Type.String()),
            parentUid: Type.Optional(Type.String()),
            afterUid: Type.Optional(Type.String()),
        }),
        description: 'Helper API to create mission layers',
        res: TAKItem(MissionLayer)
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                ? { token: String(req.headers['missionauthorization']) }
                : await config.conns.subscription(user.email, req.params.name)

            const create = await api.MissionLayer.create(
                req.params.name,
                {
                    ...req.body,
                    creatorUid: user.email
                },
                opts
            );

            res.json(create);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.patch('/marti/missions/:name/layer/:uid', {
        name: 'Update Layer',
        group: 'MartiMissionLayer',
        params: Type.Object({
            name: Type.String(),
            uid: Type.String()
        }),
        body: Type.Object({
            name: Type.Optional(Default.NameField),
        }),
        description: 'Helper API to update mission layers',
        res: StandardResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            if (req.body.name) {
                const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                    ? { token: String(req.headers['missionauthorization']) }
                    : await config.conns.subscription(user.email, req.params.name)

                await api.MissionLayer.rename(
                    req.params.name,
                    req.params.uid,
                    {
                        name: req.body.name,
                        creatorUid: user.email
                    },
                    opts
                );
            }

            res.json({
                status: 200,
                message: 'Layer Updated'
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.delete('/marti/missions/:name/layer/:uid', {
        name: 'Delete Layer',
        group: 'MartiMissionLayer',
        params: Type.Object({
            name: Type.String(),
            uid: Type.String()
        }),
        description: 'Helper API to delete mission layers',
        res: StandardResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                ? { token: String(req.headers['missionauthorization']) }
                : await config.conns.subscription(user.email, req.params.name)

            await api.MissionLayer.delete(
                req.params.name,
                {
                    uid: [ req.params.uid ],
                    creatorUid: user.email
                },
                opts
            );

            res.json({
                status: 200,
                message: 'Layer Deleted'
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
