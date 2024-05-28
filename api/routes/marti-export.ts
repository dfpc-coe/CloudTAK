import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { ExportInput } from '../lib/api/export.js';
import TAKAPI, {
    APIAuthCertificate,
} from '../lib/tak-api.js';

export default async function router(schema: Schema, config: Config) {
    await schema.post('/marti/export', {
        name: 'KML Export',
        group: 'MartiExport',
        description: 'Helper API to export Timeseries KML data from TAK',
        body: ExportInput
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req, { admin: true });

            console.error(config.server);
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(config.server.auth.cert, config.server.auth.key));

            const exp = await api.Export.export(req.body);

            exp.pipe(res);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
