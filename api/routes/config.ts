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
        res: ConfigResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
