import { Type } from '@sinclair/typebox';
import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { ProfilePaging } from '../lib/schema.js';
import type { Static } from '@sinclair/typebox';
import { ProfilePagingResponse, StandardResponse } from '../lib/types.js';
import { ProfilePaging_Type } from '../lib/enums.js';
import { generateSecret, generateCode, verifyCode, sendCode } from '../lib/paging.js';
import { sql } from 'drizzle-orm';
import * as Default from '../lib/limits.js';

type PagingResponseShape = Static<typeof ProfilePagingResponse>;

function toSafe(paging: {
    id: number;
    username: string;
    seed: string;
    verified: boolean;
    enabled: boolean;
    type: string;
    value: string;
    created: string;
    updated: string;
}): PagingResponseShape {
    return {
        id: paging.id,
        username: paging.username,
        verified: paging.verified,
        enabled: paging.enabled,
        type: paging.type,
        value: paging.value,
        created: paging.created,
        updated: paging.updated,
    };
}

export default async function router(schema: Schema, config: Config) {
    await schema.get('/profile/paging', {
        name: 'List Paging Sources',
        group: 'ProfilePaging',
        description: 'Return a list of notification/paging sources for the authenticated user',
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({
                default: 'created',
                enum: Object.keys(ProfilePaging),
            }),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(ProfilePagingResponse),
        }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const paging = await config.models.ProfilePaging.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`username = ${user.email}`,
            });

            res.json(paging);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/profile/paging', {
        name: 'Create Paging Source',
        group: 'ProfilePaging',
        description: 'Create a new paging source. A verification code will be sent to the provided address/number.',
        body: Type.Object({
            type: Type.Enum(ProfilePaging_Type),
            value: Type.String({ minLength: 1 }),
        }),
        res: ProfilePagingResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const seed = await generateSecret();
            const code = await generateCode(seed);

            const paging = await config.models.ProfilePaging.generate({
                username: user.email,
                type: req.body.type,
                value: req.body.value,
                seed,
                verified: false,
                enabled: false,
            });

            await sendCode(req.body.type, req.body.value, code);

            // Omit seed from response by returning only the safe fields
            const { seed: _seed, ...safe } = paging;
            res.json(safe);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/profile/paging/:pagingid', {
        name: 'Get Paging Source',
        group: 'ProfilePaging',
        description: 'Return a single paging source belonging to the authenticated user',
        params: Type.Object({
            pagingid: Type.Integer(),
        }),
        res: ProfilePagingResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const paging = await config.models.ProfilePaging.from(req.params.pagingid);

            if (paging.username !== user.email) {
                throw new Err(403, null, 'You do not own this paging source');
            }

            const { seed: _seed, ...safe } = paging;
            res.json(safe);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/profile/paging/:pagingid', {
        name: 'Update Paging Source',
        group: 'ProfilePaging',
        description: 'Update a paging source. Changing the value resets verification and resends a new code.',
        params: Type.Object({
            pagingid: Type.Integer(),
        }),
        body: Type.Object({
            enabled: Type.Optional(Type.Boolean()),
            value: Type.Optional(Type.String({ minLength: 1 })),
        }),
        res: ProfilePagingResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const existing = await config.models.ProfilePaging.from(req.params.pagingid);

            if (existing.username !== user.email) {
                throw new Err(403, null, 'You do not own this paging source');
            }

            let updates: Record<string, unknown> = {};

            if (req.body.enabled !== undefined) {
                updates.enabled = req.body.enabled;
            }

            if (req.body.value !== undefined && req.body.value !== existing.value) {
                // Re-prove ownership of the new address/number
                const seed = await generateSecret();
                const code = await generateCode(seed);

                updates = {
                    ...updates,
                    value: req.body.value,
                    seed,
                    verified: false,
                    enabled: false,
                };

                await sendCode(existing.type as ProfilePaging_Type, req.body.value, code);
            }

            const paging = await config.models.ProfilePaging.commit(req.params.pagingid, updates);

            const { seed: _seed, ...safe } = paging;
            res.json(safe);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/profile/paging/:pagingid/verify', {
        name: 'Verify Paging Source',
        group: 'ProfilePaging',
        description: 'Submit the 6-digit TOTP code sent to the paging source. On success, the source is marked verified.',
        params: Type.Object({
            pagingid: Type.Integer(),
        }),
        body: Type.Object({
            code: Type.String({ minLength: 6, maxLength: 6 }),
        }),
        res: ProfilePagingResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const paging = await config.models.ProfilePaging.from(req.params.pagingid);

            if (paging.username !== user.email) {
                throw new Err(403, null, 'You do not own this paging source');
            }

            if (paging.verified) {
                throw new Err(400, null, 'Paging source is already verified');
            }

            if (!await verifyCode(req.body.code, paging.seed)) {
                throw new Err(400, null, 'Invalid verification code');
            }

            const updated = await config.models.ProfilePaging.commit(req.params.pagingid, {
                verified: true,
            });

            const { seed: _seed, ...safe } = updated;
            res.json(safe);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/profile/paging/:pagingid/resend', {
        name: 'Resend Paging Verification',
        group: 'ProfilePaging',
        description: 'Resend the verification code to the paging source using the existing seed.',
        params: Type.Object({
            pagingid: Type.Integer(),
        }),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const paging = await config.models.ProfilePaging.from(req.params.pagingid);

            if (paging.username !== user.email) {
                throw new Err(403, null, 'You do not own this paging source');
            }

            if (paging.verified) {
                throw new Err(400, null, 'Paging source is already verified');
            }

            const code = await generateCode(paging.seed);
            await sendCode(paging.type as ProfilePaging_Type, paging.value, code);

            res.json({ status: 200, message: 'Verification code resent' });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/profile/paging/:pagingid', {
        name: 'Delete Paging Source',
        group: 'ProfilePaging',
        description: 'Delete a paging source belonging to the authenticated user',
        params: Type.Object({
            pagingid: Type.Integer(),
        }),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const paging = await config.models.ProfilePaging.from(req.params.pagingid);

            if (paging.username !== user.email) {
                throw new Err(403, null, 'You do not own this paging source');
            }

            await config.models.ProfilePaging.delete(req.params.pagingid);

            res.json({ status: 200, message: 'Paging Source Deleted' });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
