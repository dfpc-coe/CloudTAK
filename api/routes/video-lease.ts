import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import jwt from 'jsonwebtoken';
import { sql } from 'drizzle-orm';
import { Token } from '../lib/schema.js';
import { StandardResponse, CreateProfileTokenResponse, ProfileTokenResponse } from '../lib/types.js';
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/video/lease', {
        name: 'List Leases',
        group: 'VideoLease',
        description: 'List all vide',
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.Optional(Type.String({default: 'created', enum: Object.keys(Token) })),
            filter: Default.Filter
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(ProfileTokenResponse)
        })
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const list = await config.models.VideoLease.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    name ~* ${req.query.filter}
                    AND username = ${user.email}
                `
            });

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/video/lease', {
        name: 'Create Lease',
        group: 'VideoLease',
        description: 'Create a new video Lease',
        body: Type.Object({
            name: Type.String()
        }),
        res: CreateProfileTokenResponse,
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
}
