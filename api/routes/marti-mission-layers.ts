import { Type } from '@sinclair/typebox'
import { GenericMartiResponse } from '../lib/types.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import TAKAPI, {
    APIAuthCertificate,
} from '../lib/tak-api.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/marti/missions/:name/layer', {
        name: 'List Layers',
        group: 'MartiMissionLayer',
        params: Type.Object({
            name: Type.String()
        }),
        description: 'Helper API list mission layers',
        res: GenericMartiResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const list = await api.MissionLayer.list(req.params.name);

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
