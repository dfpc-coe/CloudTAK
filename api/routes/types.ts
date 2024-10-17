import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import { Type } from '@sinclair/typebox'
import { CoTTypes } from '@tak-ps/node-cot';

export default async function router(schema: Schema, config: Config) {
    const types = await CoTTypes.default.load();

    await schema.get('/type/cot/:type', {
        name: 'Get CoT',
        group: 'COTTypes',
        description: 'Get Type',
        params: Type.Object({
            type: Type.String()
        }),
        res: CoTTypes.TypeFormat_COT
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const type = req.params.type.replace(/a-.-/, 'a-.-');

            const info = types.cots.get(type);

            if (!info) {
                res.json({
                    cot: req.params.type,
                    full: req.params.type,
                    desc: 'Unknown CoT Type'
                })
            } else {
                res.json(info);
            }
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
