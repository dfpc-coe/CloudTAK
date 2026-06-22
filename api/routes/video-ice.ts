import { Type } from '@sinclair/typebox';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Config from '../lib/config.js';
import { createHmac } from 'node:crypto';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/video/ice', {
        name: 'Get ICE Servers',
        group: 'VideoICE',
        description: 'Get WebRTC ICE server configuration with time-limited TURN credentials',
        res: Type.Object({
            iceServers: Type.Array(Type.Object({
                urls: Type.Union([Type.String(), Type.Array(Type.String())]),
                username: Type.Optional(Type.String()),
                credential: Type.Optional(Type.String()),
            })),
        }),
    }, async (req, res) => {
        try {
            // Allow CORS for testing (especially from file:// origins)
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

            // Fetch CoTURN configuration from settings
            const coturnUrl = await config.models.Setting.typed('coturn::url').catch(() => null);
            const coturnSecret = await config.models.Setting.typed('coturn::secret').catch(() => null);

            const iceServers: Array<{
                urls: string | string[];
                username?: string;
                credential?: string;
            }> = [];

            // If CoTURN is configured, generate time-limited credentials
            if (coturnUrl && coturnSecret) {
                const host = coturnUrl.value;
                const secret = coturnSecret.value;

                // Generate credentials valid for 1 hour (3600 seconds)
                const ttl = 3600;
                const timestamp = Math.floor(Date.now() / 1000) + ttl;
                const username = `${timestamp}:cloudtak-user`;

                // Generate HMAC-SHA1 password as per TURN REST API spec
                const hmac = createHmac('sha1', secret);
                hmac.update(username);
                const credential = hmac.digest('base64');

                // Add TURN endpoints with both UDP and TCP transports
                iceServers.push({
                    urls: [
                        `turn:${host}:3478?transport=udp`,
                        `turn:${host}:3478?transport=tcp`,
                        `turns:${host}:5349?transport=tcp`,
                    ],
                    username,
                    credential,
                });
            }

            res.json({ iceServers });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
