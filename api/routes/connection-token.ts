import { Type } from '@sinclair/typebox'
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import jwt from 'jsonwebtoken';
import { sql } from 'drizzle-orm';
import { GenericListOrder } from '@openaddresses/batch-generic';
import { ConnectionToken } from '../lib/schema.js';
import Schema from '@openaddresses/batch-schema';
import { StandardResponse, CreateConnectionTokenResponse, ConnectionTokenResponse } from '../lib/types.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/connection/:connectionid/token', {
        name: 'List Tokens',
        group: 'ConnectionToken',
        description: 'List all tokens associated with a given connection',
        params: Type.Object({
            connectionid: Type.Integer()
        }),
        query: Type.Object({
            limit: Type.Integer({ default: 10 }),
            page: Type.Integer({ default: 0 }),
            order: Type.Enum(GenericListOrder, { default: GenericListOrder.ASC }),
            sort: Type.Optional(Type.String({default: 'created', enum: Object.keys(ConnectionToken)})),
            filter: Type.Optional(Type.String({default: ''}))
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(ConnectionTokenResponse)
        })
    }, async (req, res) => {
        try {
            await Auth.is_connection(config, req, {
                resources: []
            }, req.params.connectionid);

            const list = await config.models.ConnectionToken.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    name ~* ${req.query.filter}
                    AND connection = ${req.params.connectionid}
                `
            });

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/connection/:connectionid/token', {
        name: 'Create Tokens',
        group: 'ConnectionToken',
        description: 'Create a new API token for programatic access',
        params: Type.Object({
            connectionid: Type.Integer()
        }),
        body: Type.Object({
            name: Type.String()
        }),
        res: CreateConnectionTokenResponse
    }, async (req, res) => {
        try {
            await Auth.is_connection(config, req, {
                resources: []
            }, req.params.connectionid);

            const token = await config.models.ConnectionToken.generate({
                name: req.body.name,
                token: 'etl.' + jwt.sign({ id: req.params.connectionid, access: 'connection' }, config.SigningSecret),
                connection: req.params.connectionid
            });

            return res.json(token);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.patch('/connection/:connectionid/token/:id', {
        name: 'Update Token',
        group: 'ConnectionToken',
        params: Type.Object({
            connectionid: Type.Integer(),
            id: Type.Integer()
        }),
        description: 'Update properties of a Token',
        body: Type.Object({
            name: Type.Optional(Type.String())
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            await Auth.is_connection(config, req, {
                resources: []
            }, req.params.connectionid);

            const token = await config.models.ConnectionToken.from(sql`id = ${req.params.id}::INT`);
            if (token.connection !== req.params.connectionid) throw new Err(400, null, `Token does not belong to Connection ${req.params.connectionid}`);

            await config.models.Token.commit(sql`id = ${token.id}::INT`, {
                updated: sql`Now()`,
                ...req.body
            });

            return res.json({ status: 200, message: 'Connection Token Updated' });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/connection/:connectionid/token/:id', {
        name: 'Delete Tokens',
        group: 'Token',
        description: 'Delete a user\'s API Token',
        params: Type.Object({
            connectionid: Type.Integer(),
            id: Type.Integer()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            await Auth.is_connection(config, req, {
                resources: []
            }, req.params.connectionid);

            const token = await config.models.ConnectionToken.from(sql`id = ${req.params.id}::INT`);
            if (token.connection !== req.params.connectionid) throw new Err(400, null, `Token does not belong to Connection ${req.params.connectionid}`);

            await config.models.ConnectionToken.delete(sql`id = ${token.id}::INT`);

            return res.json({ status: 200, message: 'Connection Token Deleted' });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
