import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { GenericMartiResponse } from '../lib/types.js';
import { MissionSubscriber, Mission, ChangesInput, ListInput } from '../lib/api/mission.js';
import TAKAPI, {
    APIAuthCertificate,
} from '../lib/tak-api.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/marti/missions/:name', {
        name: 'KML Export',
        group: 'MartiExport',
        params: Type.Object({
            name: Type.String(),
        }),
        description: 'Helper API to export Timeseries KML data from TAK',
        body:
        res: Mission
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const mission = await api.Mission.get(req.params.name, req.query);

            return res.json(mission);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
