import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { promisify } from 'util';
import jwt from 'jsonwebtoken';
import { Param } from '@openaddresses/batch-generic';
import { sql } from 'drizzle-orm';
import { AuthResource } from '@tak-ps/blueprint-login';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/token', {
        name: 'List Tokens',
        group: 'Token',
        description: 'List all tokens associated with the requester\'s account',
        query: 'req.query.ListTokens.json',
        res: 'res.ListTokens.json'
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const list = await config.models.Token.list({
                limit: Number(req.query.limit),
                page: Number(req.query.page),
                order: String(req.query.order),
                sort: String(req.query.sort),
                where: sql`
                    name ~* ${req.query.filter}
                    AND email = ${user.email}
                `
            });

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/token', {
        name: 'Create Tokens',
        group: 'Token',
        description: 'Create a new API token for programatic access',
        body: 'req.body.CreateToken.json',
        res: 'res.CreateToken.json'
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const token = await config.models.Token.generate({
                ...req.body,
                token: 'etl.' + jwt.sign({ id: user.email, access: 'profile' }, config.SigningSecret),
                email: user.email
            });

            return res.json(token);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.patch('/token/:id', {
        name: 'Update Token',
        group: 'Token',
        params: Type.Object({
            id: Type.Integer(),
        }),
        description: 'Update properties of a Token',
        body: 'req.body.PatchToken.json',
        res: StandardResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            let token = await config.models.Token.from(sql`id = ${Number(req.params.id)}::INT`);
            if (token.email !== user.email) throw new Err(400, null, 'You can only modify your own tokens');

            await config.models.Token.commit(sql`id = ${token.id}::INT`, {
                updated: sql`Now()`,
                ...req.body
            });

            return res.json({ status: 200, message: 'Token Updated' });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/token/:id', {
        name: 'Delete Tokens',
        group: 'Token',
        description: 'Delete a user\'s API Token',
        params: Type.Object({
            id: Type.Integer(),
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            let token = await config.models.Token.from(sql`id = ${Number(req.params.id)}::INT`);
            if (token.email !== user.email) throw new Err(400, null, 'You can only modify your own tokens');

            await config.models.Token.delete(sql`id = ${token.id}::INT`);

            return res.json({ status: 200, message: 'Token Deleted' });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
