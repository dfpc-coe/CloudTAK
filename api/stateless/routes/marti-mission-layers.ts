import { Static, Type } from '@sinclair/typebox';
import { StandardResponse } from '../../common/types.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../../common/auth.js';
import type ConfigStateless from '../config.js';
import ProfileControl from '../lib/control/profile.js';
import * as Default from '../lib/limits.js';
import { MissionOptions } from '@tak-ps/node-tak/lib/api/mission';
import { MissionLayer, MissionLayerType } from '@tak-ps/node-tak/lib/api/mission-layer';
import {
    TAKItem,
    TAKList,
} from '@tak-ps/node-tak/lib/api/types';
import { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak';

export default async function router(schema: Schema, config: ConfigStateless) {
    const profileControl = new ProfileControl(config);

    await schema.get('/marti/missions/:guid/layer', {
        name: 'List Layers',
        group: 'MartiMissionLayer',
        params: Type.Object({
            guid: Type.String(),
        }),
        description: 'Helper API list mission layers',
        res: TAKList(MissionLayer),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                ? { token: String(req.headers['missionauthorization']) }
                : await profileControl.subscription(user.email, req.params.guid);

            const list = await api.MissionLayer.list(
                req.params.guid,
                opts,
            );

            res.json(list);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/marti/missions/:guid/layer/:layerid', {
        name: 'Get Layer',
        group: 'MartiMissionLayer',
        params: Type.Object({
            guid: Type.String(),
            layerid: Type.String(),
        }),
        description: 'Helper API to get mission layer',
        res: TAKItem(MissionLayer),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                ? { token: String(req.headers['missionauthorization']) }
                : await profileControl.subscription(user.email, req.params.guid);

            const layer = await api.MissionLayer.get(
                req.params.guid,
                req.params.layerid,
                opts,
            );

            res.json(layer);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/marti/missions/:guid/layer', {
        name: 'Create Layer',
        group: 'MartiMissionLayer',
        params: Type.Object({
            guid: Type.String(),
        }),
        body: Type.Object({
            name: Default.NameField,
            type: Type.Enum(MissionLayerType),
            uid: Type.Optional(Type.String()),
            parentUid: Type.Optional(Type.String()),
            afterUid: Type.Optional(Type.String()),
        }),
        description: 'Helper API to create mission layers',
        res: TAKItem(MissionLayer),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                ? { token: String(req.headers['missionauthorization']) }
                : await profileControl.subscription(user.email, req.params.guid);

            const create = await api.MissionLayer.create(
                req.params.guid,
                {
                    ...req.body,
                    creatorUid: user.email,
                },
                opts,
            );

            res.json(create);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.put('/marti/missions/:guid/layer/:uid/cot', {
        name: 'Attach Layer CoTs',
        group: 'MartiMissionLayer',
        params: Type.Object({
            guid: Type.String(),
            uid: Type.String(),
        }),
        body: Type.Object({
            uids: Type.Array(Type.String(), { minItems: 1 }),
        }),
        description: 'Helper API to file existing Mission CoTs under a mission layer, moving them from any layer they are currently filed under',
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                ? { token: String(req.headers['missionauthorization']) }
                : await profileControl.subscription(user.email, req.params.guid);

            await api.MissionLayer.attachUids(
                req.params.guid,
                req.params.uid,
                {
                    uids: req.body.uids,
                    creatorUid: user.email,
                },
                opts,
            );

            res.json({
                status: 200,
                message: 'CoTs Attached to Layer',
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/marti/missions/:guid/layer/:uid/cot/:cotuid', {
        name: 'Detach Layer CoT',
        group: 'MartiMissionLayer',
        params: Type.Object({
            guid: Type.String(),
            uid: Type.String(),
            cotuid: Type.String(),
        }),
        description: 'Helper API to move a Mission CoT out of a mission layer and back to the mission root - the CoT remains part of the Mission',
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                ? { token: String(req.headers['missionauthorization']) }
                : await profileControl.subscription(user.email, req.params.guid);

            await api.MissionLayer.setParent(
                req.params.guid,
                {
                    layerUids: [req.params.cotuid],
                    creatorUid: user.email,
                },
                opts,
            );

            res.json({
                status: 200,
                message: 'CoT Detached from Layer',
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/marti/missions/:guid/layer/:uid', {
        name: 'Update Layer',
        group: 'MartiMissionLayer',
        params: Type.Object({
            guid: Type.String(),
            uid: Type.String(),
        }),
        body: Type.Object({
            name: Type.Optional(Default.NameField),
        }),
        description: 'Helper API to update mission layers',
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            if (req.body.name) {
                const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                    ? { token: String(req.headers['missionauthorization']) }
                    : await profileControl.subscription(user.email, req.params.guid);

                await api.MissionLayer.rename(
                    req.params.guid,
                    req.params.uid,
                    {
                        name: req.body.name,
                        creatorUid: user.email,
                    },
                    opts,
                );
            }

            res.json({
                status: 200,
                message: 'Layer Updated',
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/marti/missions/:guid/layer/:uid', {
        name: 'Delete Layer',
        group: 'MartiMissionLayer',
        params: Type.Object({
            guid: Type.String(),
            uid: Type.String(),
        }),
        description: 'Helper API to delete mission layers',
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                ? { token: String(req.headers['missionauthorization']) }
                : await profileControl.subscription(user.email, req.params.guid);

            await api.MissionLayer.delete(
                req.params.guid,
                {
                    uid: [req.params.uid],
                    creatorUid: user.email,
                },
                opts,
            );

            res.json({
                status: 200,
                message: 'Layer Deleted',
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
