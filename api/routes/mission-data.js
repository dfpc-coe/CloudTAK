import Err from '@openaddresses/batch-error';
import Layer from '../lib/types/layer.js';
import LayerLive from '../lib/types/layers_live.js';
import LayerFile from '../lib/types/layers_file.js';
import { XML as COT } from '@tak-ps/node-cot';
import Cacher from '../lib/cacher.js';
import { sql } from 'slonik';

export default async function router(schema, config) {
    await schema.get('/connection/:connectionid/mission', {
        name: 'List Data',
        group: 'MissionData',
        auth: 'user',
        ':connectionid': 'integer',
        description: 'List Mission Data',
        //res: 'res.ListLayers.json'
    }, async (req, res) => {
        try {
            const tak = config.conns.get(req.params.connectionid).tak;
            const list = await tak.api.MissionData.list();

            console.error(list)
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
