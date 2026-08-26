import { Type } from '@sinclair/typebox';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import { PERMISSIONS } from '@tak-ps/etl';
import Auth from '../../common/auth.js';
import type ConfigStateless from '../config.js';

export default async function router(schema: Schema, config: ConfigStateless) {
    await schema.get('/scope', {
        name: 'List Scopes',
        group: 'Scope',
        description: 'List the permission scopes that can be granted to Layer & Connection tokens',
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(Type.Object({
                resource: Type.String({ description: 'The resource the scopes apply to - ie `video`' }),
                levels: Type.Array(Type.String(), { description: 'Access levels the resource can be granted at' }),
                scopes: Type.Array(Type.String(), { description: 'Grantable `<resource>:<level>` strings including the `<resource>:*` wildcard' }),
            })),
        }),
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const items = Object.keys(PERMISSIONS).map((resource) => {
                const levels = PERMISSIONS[resource];
                return {
                    resource,
                    levels,
                    scopes: [`${resource}:*`, ...levels.map(level => `${resource}:${level}`)],
                };
            });

            res.json({ total: items.length, items });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
