import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { CoTParser } from '@tak-ps/node-cot';
import { Type } from '@sinclair/typebox';
import { StandardResponse, FeatureResponse } from '../lib/types.js';
import { ProfileConnConfig } from '../lib/connection-config.js';

export default async function router(schema: Schema, config: Config) {
    await schema.put('/profile/location', {
        name: 'Submit Location',
        group: 'ProfileLocation',
        description: `
            Submit a live location update for the authenticated user.
            The feature is converted to CoT and written to the user's TAK
            server connection. The CoT UID is always derived server-side from
            the authenticated user's email, so the id field in the request body
            is ignored.
        `,
        body: Type.Composite([FeatureResponse, Type.Object({ id: Type.Optional(Type.String()) })]),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            // Always derive the CoT UID from the authenticated identity so the
            // client never needs to read its own username from local storage.
            req.body.id = `ANDROID-CloudTAK-${user.email}`;

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
                if (pooledClient!.tak.client && !pooledClient!.tak.client.authorized) {
                    awaitSecure = new Promise<void>(resolve =>
                        pooledClient!.tak.once('secureConnect', resolve),
                    );
                }
            }

            if (awaitSecure) await awaitSecure;

            const cot = await CoTParser.from_geojson(req.body);

            pooledClient.tak.write([cot], {
                stripFlow: true,
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
