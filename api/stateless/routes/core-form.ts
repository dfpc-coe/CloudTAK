import { Type } from '@sinclair/typebox';
import { StandardResponse, CoreFormResponse } from '../../common/types.js';
import { sql, eq } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../../common/auth.js';
import { CoreForm, CoreFormChannel } from '../../common/schema.js';
import type ConfigStateless from '../config.js';
import FormControl from '../lib/control/form.js';
import { userChannels } from '../lib/tak-channels.js';
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: ConfigStateless) {
    const formControl = new FormControl(config);

    await schema.get('/core/form', {
        name: 'List Forms',
        group: 'CoreForm',
        description: 'List Core Forms',
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({
                default: 'created',
                enum: Object.keys(CoreForm),
            }),
            filter: Default.Filter,
            channel: Type.Optional(Type.Union([
                Type.Integer({ minimum: 0 }),
                Type.Array(Type.Integer({ minimum: 0 })),
            ], {
                description: 'Only return Forms shared with the given TAK Channel bitpos - can be provided multiple times to match any of the given Channels',
            })),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(CoreFormResponse),
        }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const filterChannels = req.query.channel === undefined
                ? []
                : Array.isArray(req.query.channel) ? req.query.channel : [req.query.channel];

            const channel = filterChannels.length === 0
                ? sql`True`
                : sql`EXISTS (
                    SELECT 1
                    FROM core_form_channel
                    WHERE core_form_channel.form = core_form.id
                    AND core_form_channel.channel IN ${filterChannels}
                )`;

            let where;
            if (user.is_admin()) {
                where = sql`
                    name ~* ${req.query.filter}
                    AND ${channel}
                `;
            } else {
                const channels = [...await userChannels(config, user.email)];

                where = channels.length
                    ? sql`
                        name ~* ${req.query.filter}
                        AND (
                            username = ${user.email}
                            OR EXISTS (
                                SELECT 1
                                FROM core_form_channel
                                WHERE core_form_channel.form = core_form.id
                                AND core_form_channel.channel IN ${channels}
                            )
                        )
                        AND ${channel}
                    `
                    : sql`
                        name ~* ${req.query.filter}
                        AND username = ${user.email}
                        AND ${channel}
                    `;
            }

            const list = await config.models.CoreForm.augmented_list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where,
            });

            res.json(list);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/core/form/:form', {
        name: 'Get Form',
        group: 'CoreForm',
        description: 'Get a Core Form',
        params: Type.Object({
            form: Type.String({
                format: 'uuid',
            }),
        }),
        res: CoreFormResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const form = await formControl.formAccess(user, req.params.form);

            res.json(form);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/core/form', {
        name: 'Create Form',
        group: 'CoreForm',
        description: 'Create a new Core Form',
        body: Type.Object({
            name: Default.NameField,
            description: Type.Optional(Default.DescriptionField),
            schema: Type.Record(Type.String(), Type.Unknown(), {
                description: 'JSON Schema the Form input is generated & validated from',
            }),
            channels: Type.Array(Type.Integer({ minimum: 0 }), {
                uniqueItems: true,
                default: [],
                description: 'TAK Server Channels to share the Form with',
            }),
        }),
        res: CoreFormResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const { channels, ...body } = req.body;

            formControl.ensureValidSchema(body.schema);

            const form = await config.models.CoreForm.generate({
                ...body,
                username: user.email,
            });

            if (channels.length > 0) {
                await config.pg.insert(CoreFormChannel)
                    .values(channels.map(ch => ({
                        form: form.id,
                        channel: BigInt(ch),
                    })));
            }

            res.json(await config.models.CoreForm.augmented_from(form.id));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/core/form/:form', {
        name: 'Update Form',
        group: 'CoreForm',
        description: 'Update properties of a Core Form',
        params: Type.Object({
            form: Type.String({
                format: 'uuid',
            }),
        }),
        body: Type.Object({
            name: Type.Optional(Default.NameField),
            description: Type.Optional(Default.DescriptionField),
            schema: Type.Optional(Type.Record(Type.String(), Type.Unknown(), {
                description: 'JSON Schema the Form input is generated & validated from - replaces the existing schema',
            })),
            channels: Type.Optional(Type.Array(Type.Integer({ minimum: 0 }), {
                uniqueItems: true,
                description: 'TAK Server Channels to share the Form with - replaces the existing sharing',
            })),
        }),
        res: CoreFormResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const form = await config.models.CoreForm.augmented_from(req.params.form);

            if (!formControl.isFormAuthor(user, form)) {
                throw new Err(403, null, 'Only the Form author can update this Form');
            }

            const { channels, ...body } = req.body;

            if (body.schema !== undefined) {
                formControl.ensureValidSchema(body.schema);
            }

            if (Object.keys(body).length > 0) {
                await config.models.CoreForm.commit(req.params.form, {
                    ...body,
                    updated: sql`Now()`,
                });
            }

            if (channels !== undefined) {
                await config.pg.delete(CoreFormChannel)
                    .where(eq(CoreFormChannel.form, req.params.form));

                if (channels.length > 0) {
                    await config.pg.insert(CoreFormChannel)
                        .values(channels.map(ch => ({
                            form: req.params.form,
                            channel: BigInt(ch),
                        })));
                }
            }

            res.json(await config.models.CoreForm.augmented_from(req.params.form));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/core/form/:form', {
        name: 'Delete Form',
        group: 'CoreForm',
        description: 'Delete a Core Form',
        params: Type.Object({
            form: Type.String({
                format: 'uuid',
            }),
        }),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const form = await config.models.CoreForm.augmented_from(req.params.form);

            if (!formControl.isFormAuthor(user, form)) {
                throw new Err(403, null, 'Only the Form author can delete this Form');
            }

            await config.models.CoreForm.delete(req.params.form);

            res.json({ status: 200, message: 'Core Form Deleted' });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
