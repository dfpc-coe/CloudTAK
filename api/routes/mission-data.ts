import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { Request, Response } from 'express';
import Config from '../lib/config.js';

export default async function router(schema: any, config: Config) {
    await schema.get('/connection/:connectionid/mission', {
        name: 'List Data',
        group: 'MissionData',
        auth: 'user',
        ':connectionid': 'integer',
        description: 'List Mission Data'
        // res: 'res.ListLayers.json'
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);

            const tak = config.conns.get(req.params.connectionid).tak;
            const list = await tak.api.MissionData.list();

            console.error(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
