import { Type } from '@sinclair/typebox'
import TAK from '@tak-ps/node-tak';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { GenericMartiResponse } from '../lib/types.js';
import { Package } from '../lib/api/package.js';
import { Profile } from '../lib/schema.js';
import S3 from '../lib/aws/s3.js';
import TAKAPI, {
    APIAuthToken,
    APIAuthCertificate,
    APIAuthPassword
} from '../lib/tak-api.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/marti/package', {
        name: 'List Packages',
        group: 'MartiPackages',
        description: 'Helper API to get a single package',
        res: Type.Object({
            total: Type.Integer(), 
            items: Type.Array(Package)
        })
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const pkg = await api.Package.list();

            return res.json({
                total: pkg.resultCount,
                items: pkg.results
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}