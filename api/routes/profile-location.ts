import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { CoTParser } from '@tak-ps/node-cot';
import { StandardResponse, FeatureResponse } from '../lib/types.js';
import { ProfileConnConfig } from '../lib/connection-config.js';

export default async function router(schema: Schema, config: Config) {
    await schema.put('/profile/location', {
        name: 'Submit Location',
        group: 'ProfileLocation',
        description: `
            Submit a live location update for the authenticated user.
            The feature is converted to CoT and written to the user's TAK
            server connection.
        `,
        body: FeatureResponse,
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            // Ensure the user's TAK profile connection exists and is ready
            let pooledClient = config.conns.get(user.email);
            let awaitSecure: Promise<void> | undefined;

            if (!pooledClient) {
                const profile = await config.models.Profile.from(user.email);
                if (!profile.auth.cert || !profile.auth.key) {
                    throw new Err(400, null, 'Profile auth certificate not configured');
                }

                pooledClient = await config.conns.add(
                    new ProfileConnConfig(config, user.email, profile.auth),
                );
                if (pooledClient.tak.client && !pooledClient.tak.client.authorized) {
                    awaitSecure = new Promise<void>(resolve =>
                        pooledClient.tak.once('secureConnect', resolve),
                    );
                }
            }

            if (awaitSecure) await awaitSecure;

            const cot = await CoTParser.from_geojson(req.body);

            pooledClient.tak.write([cot], {
                stripFlow: true
            });

            res.json({
                status: 200,
                message: 'Location submitted',
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
