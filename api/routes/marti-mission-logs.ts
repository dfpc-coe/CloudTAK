import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.ts';
import Config from '../lib/config.ts';
import bodyparser from 'body-parser';
import Profile from '../lib/types/profile.ts';
import Connection from '../lib/types/connection.ts';
import S3 from '../lib/aws/s3.ts';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import TAKAPI, {
    APIAuthToken,
    APIAuthCertificate,
    APIAuthPassword
} from '../lib/tak-api.ts';

export default async function router(schema: any, config: Config) {
    await schema.post('/marti/missions/:name/log', {
        name: 'Create Log',
        group: 'MartiMissionLog',
        auth: 'user',
        ':name': 'string',
        description: 'Helper API to add a log to a mission',
        query: {
            type: 'object',
            properties: {
                connection: {
                    type: 'integer'
                },
            }
        },
        body: {
            type: 'object',
            required: ['content'],
            properties: {
                content: {
                    type: 'string'
                }
            }
        },
        res: 'res.Marti.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            let auth;
            let creatorUid;
            if (req.query.connection) {
                auth = (await Connection.from(config.pool, req.query.connection)).auth;
                creatorUid = `CloudTAK-Conn-${req.query.connection}`;
            } else {
                if (!req.auth.email) throw new Err(400, null, 'Mission Log can only be modified by an authenticated user');
                auth = (await Profile.from(config.pool, req.auth.email)).auth;
                creatorUid = req.auth.email;
            }
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const mission = await api.MissionLog.create(req.params.name, {
                creatorUid: creatorUid,
                content: req.body.content
            });
            return res.json(mission);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
