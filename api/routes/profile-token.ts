import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import jwt from 'jsonwebtoken';
import { sql } from 'drizzle-orm';
import { ProfileToken } from '../lib/schema.js';
import { StandardResponse, CreateProfileTokenResponse, ProfileTokenResponse } from '../lib/types.js';
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/profile/token', {
        name: 'List Tokens',
        group: 'ProfileToken',
        description: 'List all tokens associated with the requester\'s account',
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({
                default: 'created',
                enum: Object.keys(ProfileToken)
            }),
            filter: Default.Filter
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(ProfileTokenResponse)
        })
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const list = await config.models.ProfileToken.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    name ~* ${req.query.filter}
                    AND username = ${user.email}
                `
            });

            res.json(list);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.post('/profile/token', {
        name: 'Create Tokens',
        group: 'ProfileToken',
        description: 'Create a new API token for programatic access',
        body: Type.Object({
            name: Type.String()
        }),
        res: CreateProfileTokenResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const token = await config.models.ProfileToken.generate({
                ...req.body,
                token: 'etl.' + jwt.sign({ id: user.email, access: 'profile' }, config.SigningSecret),
                username: user.email
            });

            res.json(token);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.patch('/profile/token/:id', {
        name: 'Update Token',
        group: 'ProfileToken',
        params: Type.Object({
            id: Type.Integer(),
        }),
        description: 'Update properties of a Token',
        body: Type.Object({
            name: Type.Optional(Type.String())
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const token = await config.models.ProfileToken.from(sql`id = ${Number(req.params.id)}::INT`);
            if (token.username !== user.email) throw new Err(403, null, 'You can only modify your own tokens');

            await config.models.ProfileToken.commit(sql`id = ${token.id}::INT`, {
                updated: sql`Now()`,
                ...req.body
            });

            res.json({ status: 200, message: 'Token Updated' });
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.delete('/profile/token/:id', {
        name: 'Delete Tokens',
        group: 'ProfileToken',
        description: 'Delete a user\'s API Token',
        params: Type.Object({
            id: Type.Integer(),
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const token = await config.models.ProfileToken.from(sql`id = ${Number(req.params.id)}::INT`);
            if (token.username !== user.email) throw new Err(403, null, 'You can only modify your own tokens');

            await config.models.ProfileToken.delete(sql`id = ${token.id}::INT`);

            res.json({ status: 200, message: 'Token Deleted' });
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
