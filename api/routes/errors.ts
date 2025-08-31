import { sql } from 'drizzle-orm';
import { Type } from '@sinclair/typebox'
import { Param } from '@openaddresses/batch-generic';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import * as Default from '../lib/limits.js';
import { ErrorResponse, StandardResponse } from '../lib/types.js'
import Config from '../lib/config.js';
import { Errors } from '../lib/schema.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/error', {
        name: 'List Errors',
        group: 'User',
        description: 'Let admins see errors coming out of the system',
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({
                default: 'created',
                enum: Object.keys(Errors)
            }),
            username: Type.Optional(Type.String()),
            filter: Default.Filter
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(ErrorResponse)
        })
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const list = await config.models.Errors.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    message ~* ${req.query.filter}
                    AND (${Param(req.query.username)}::TEXT IS NULL OR ${Param(req.query.username)}::TEXT = username)
                `
            });

            res.json(list);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.post('/error', {
        name: 'Create Error',
        group: 'User',
        description: 'Create a new error',
        body: Type.Object({
            message: Type.String(),
            trace: Type.Optional(Type.String())
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            await config.models.Errors.generate({
                username: user.email,
                ...req.body
            });

            res.json({
                status: 200,
                message: 'Error Logged'
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
