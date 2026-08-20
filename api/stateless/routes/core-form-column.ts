import { Type, Static } from '@sinclair/typebox';
import { StandardResponse, CoreFormResponse, CoreFormColumnResponse } from '../../common/types.js';
import { sql } from 'drizzle-orm';
import { GenericListOrder } from '@openaddresses/batch-generic';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../../common/auth.js';
import type { CoreFormColumn } from '../../common/schema.js';
import type ConfigStateless from '../config.js';
import BoardControl, { MAX_LIST } from '../lib/control/board.js';

function attachmentResponse(
    attachment: typeof CoreFormColumn.$inferSelect,
    form: Static<typeof CoreFormResponse>,
): Static<typeof CoreFormColumnResponse> {
    return {
        id: attachment.id,
        created: attachment.created,
        updated: attachment.updated,
        column: attachment.column,
        required: attachment.required,
        form,
    };
}

export default async function router(schema: Schema, config: ConfigStateless) {
    const boardControl = new BoardControl(config);

    await schema.get('/board/column/:column/form', {
        name: 'List Column Forms',
        group: 'CoreFormColumn',
        description: 'List the Forms attached to a Board Column',
        params: Type.Object({
            column: Type.String({
                format: 'uuid',
            }),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(CoreFormColumnResponse),
        }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const { column } = await boardControl.columnAccess(user, req.params.column);

            const attachments = await config.models.CoreFormColumn.list({
                limit: MAX_LIST,
                where: sql`"column" = ${column.id}`,
                sort: 'created',
                order: GenericListOrder.ASC,
            });

            const forms = new Map<string, Static<typeof CoreFormResponse>>();
            if (attachments.items.length) {
                const list = await config.models.CoreForm.augmented_list({
                    limit: attachments.items.length,
                    where: sql`id IN ${attachments.items.map(a => a.form)}`,
                });

                for (const form of list.items) {
                    forms.set(form.id, form);
                }
            }

            const items: Array<Static<typeof CoreFormColumnResponse>> = [];
            for (const attachment of attachments.items) {
                const form = forms.get(attachment.form);

                // A deleted Form cascades its attachments away - a missing
                // Form here would be a torn read, not a real attachment
                if (!form) continue;

                items.push(attachmentResponse(attachment, form));
            }

            res.json({
                total: items.length,
                items,
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.put('/board/column/:column/form', {
        name: 'Attach Form',
        group: 'CoreFormColumn',
        description: `
            Attach a Form to a Board Column or update whether an attached Form
            is required - the Form must be shared with the Board's Channel
        `,
        params: Type.Object({
            column: Type.String({
                format: 'uuid',
            }),
        }),
        body: Type.Object({
            form: Type.String({
                format: 'uuid',
                description: 'Form to attach to the Column',
            }),
            required: Type.Boolean({
                default: false,
                description: 'Must the Form be completed for Events in the Column',
            }),
        }),
        res: CoreFormColumnResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const { column, board } = await boardControl.columnAccess(user, req.params.column);

            const form = await config.models.CoreForm.augmented_from(req.body.form);

            if (!form.channels.map(c => Number(c)).includes(Number(board.channel))) {
                throw new Err(400, null, 'The Form is not shared with the Board\'s Channel');
            }

            const existing = await config.models.CoreFormColumn.list({
                limit: 1,
                where: sql`"column" = ${column.id} AND form = ${form.id}`,
            });

            let attachment;
            if (existing.items.length) {
                attachment = await config.models.CoreFormColumn.commit(existing.items[0].id, {
                    required: req.body.required,
                    updated: sql`Now()`,
                });
            } else {
                attachment = await config.models.CoreFormColumn.generate({
                    column: column.id,
                    form: form.id,
                    required: req.body.required,
                });
            }

            res.json(attachmentResponse(attachment, form));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/board/column/:column/form/:form', {
        name: 'Detach Form',
        group: 'CoreFormColumn',
        description: 'Detach a Form from a Board Column - the Form itself is not deleted',
        params: Type.Object({
            column: Type.String({
                format: 'uuid',
            }),
            form: Type.String({
                format: 'uuid',
            }),
        }),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const { column } = await boardControl.columnAccess(user, req.params.column);

            const existing = await config.models.CoreFormColumn.list({
                limit: 1,
                where: sql`"column" = ${column.id} AND form = ${req.params.form}`,
            });

            if (!existing.items.length) {
                throw new Err(404, null, 'The Form is not attached to this Column');
            }

            await config.models.CoreFormColumn.delete(existing.items[0].id);

            res.json({ status: 200, message: 'Form detached from Column' });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
