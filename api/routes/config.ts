import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { sql } from 'drizzle-orm';
import Config from '../lib/config.js';
import { ServerResponse } from '../lib/types.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/config', {
        name: 'Get Config',
        group: 'Config',
        description: 'Get Config',
        query: Type.Object({
            keys: Type.Array(Type.String())
        }),
        res: Type.Any()
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const final: Record<string, string> = {};
            (await Promise.all((req.query.keys.map((key) => {
                return config.models.Setting.from(key);
            })))).map((k) => {
                return final[k.key] = k.value;
            });

            return res.json(final);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
