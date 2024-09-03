import { Static, Type } from '@sinclair/typebox'
import { StandardResponse, GenericMartiResponse } from '../lib/types.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import { MissionOptions } from '../lib/api/mission.js';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import TAKAPI, {
    APIAuthCertificate,
} from '../lib/tak-api.js';

export default async function router(schema: Schema, config: Config) {
    await schema.post('/marti/missions/:name/log', {
        name: 'Create Log',
        group: 'MartiMissionLog',
        params: Type.Object({
            name: Type.String(),
        }),
        description: 'Helper API to add a log to a mission',
        body: Type.Object({
            content: Type.String()
        }),
        res: GenericMartiResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const auth = (await config.models.Profile.from(user.email)).auth;
            const creatorUid = user.email;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                ? { token: String(req.headers['missionauthorization']) }
                : await config.conns.subscription(user.email, req.params.name)

            const mission = await api.MissionLog.create(
                req.params.name,
                {
                    creatorUid: creatorUid,
                    content: req.body.content
                },
                opts
            );

            return res.json(mission);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/marti/missions/:name/log/:log', {
        name: 'Delete Log',
        group: 'MartiMissionLog',
        params: Type.Object({
            name: Type.String(),
            log: Type.String()
        }),
        description: 'Helper API to delete a log',
        res: StandardResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const opts: Static<typeof MissionOptions> = req.headers['missionauthorization']
                ? { token: String(req.headers['missionauthorization']) }
                : await config.conns.subscription(user.email, req.params.name)

            await api.MissionLog.delete(
                req.params.log,
                opts
            );

            return res.json({
                status: 200,
                message: 'Log Entry Deleted'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
