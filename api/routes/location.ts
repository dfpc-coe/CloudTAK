import { Type, Static } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { CoTParser, Feature } from '@tak-ps/node-cot';
import { StandardResponse } from '../lib/types.js';
import { ProfileConnConfig } from '../lib/connection-config.js';
import type { ConnectionClient } from '../lib/connection-pool.js';

/**
 * Routes for posting an authenticated user's location as a CoT.
 *
 * The web client streams positions over the per-user WebSocket
 * connection (see lib/connection-web.ts), but native wrappers (iOS /
 * Android) cannot keep a WebSocket alive while backgrounded. This HTTP
 * route gives those clients a way to push individual GeoJSON Features
 * which are then converted to CoT and forwarded to TAK Server using
 * the same `client.tak.write` pipeline as the WebSocket path.
 *
 * Body shape mirrors the WebSocket payload — a single GeoJSON Feature.
 * Properties such as `callsign`, `type`, `how`, `time`, `start`,
 * `stale`, `contact`, `group`, `takv` are forwarded as-is and consumed
 * by node-cot's `CoTParser.from_geojson`. Callers are responsible for
 * supplying a stable `id` (CoT UID) — typically `ANDROID-CloudTAK-<email>`
 * for self-position to match the convention used by the web app and
 * connection pool (see lib/connection-pool.ts).
 */
export default async function router(schema: Schema, config: Config) {
    await schema.post('/profile/location', {
        name: 'Submit Location',
        group: 'ProfileLocation',
        description: `
            Submit a single GeoJSON Feature representing the user's
            location (or any other CoT payload) over HTTP. The feature
            is converted to a CoT by node-cot and forwarded to TAK
            Server using the user's profile certificate.

            Intended for native (iOS / Android) wrappers that cannot
            keep the per-user WebSocket alive while backgrounded.
        `,
        body: Feature.InputFeature,
        res: StandardResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req, { token: true });

            if (!config.conns) {
                throw new Err(500, null, 'Server not configured with Connection Pool');
            }

            // Lazily attach the user's profile connection to the pool
            // if no WebSocket has done so yet — mirrors the bootstrap
            // performed in index.ts on WebSocket upgrade.
            let client = config.conns.get(user.email) as ConnectionClient | undefined;

            if (!client) {
                const profile = await config.models.Profile.from(user.email);
                if (!profile.auth.cert || !profile.auth.key) {
                    throw new Err(400, null, 'No Certificate found on profile');
                }

                client = await config.conns.add(
                    new ProfileConnConfig(config, user.email, profile.auth)
                );

                if (client.tak.client && !client.tak.client.authorized) {
                    await new Promise<void>((resolve, reject) => {
                        const timeout = setTimeout(() => {
                            reject(new Err(504, null, 'Timed out waiting for TAK Server connection'));
                        }, 10_000);

                        (client as ConnectionClient).tak.once('secureConnect', () => {
                            clearTimeout(timeout);
                            resolve();
                        });
                    });
                }
            }

            if (!client.config || !client.config.enabled) {
                throw new Err(503, null, 'TAK Connection is currently paused');
            }

            const feat = req.body as Static<typeof Feature.InputFeature>;

            let cot;
            try {
                cot = await CoTParser.from_geojson(feat);
            } catch (err) {
                throw new Err(400, null, `Invalid GeoJSON Feature: ${err instanceof Error ? err.message : String(err)}`);
            }

            client.tak.write([cot], { stripFlow: true });

            // Echo through the connection pool so the user's own
            // WebSocket subscribers (open browser tabs, etc.) see the
            // update — TAK Server does not rebroadcast to the sender.
            await config.conns.cots(client.config, [cot]);

            res.json({
                status: 200,
                message: 'Location Submitted'
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
