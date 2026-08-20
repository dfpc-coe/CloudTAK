import { Type, Static } from '@sinclair/typebox';
import { StandardResponse, CoreFormResponse } from '../../common/types.js';
import { sql, eq } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthUser } from '../../common/auth.js';
import { CoreForm, CoreFormBoard } from '../../common/schema.js';
import type ConfigStateless from '../config.js';
import BoardControl from '../lib/control/board.js';
import { userChannels } from '../lib/tak-channels.js';
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: ConfigStateless) {
    const boardControl = new BoardControl(config);

    /** Is the requester the author of the Form - the user that created it or a System Admin */
    function isFormAuthor(user: AuthUser, form: Static<typeof CoreFormResponse>): boolean {
        return user.is_admin() || form.username === user.email;
    }

    /**
     * A Form is visible to its author, System Admins, and any user with an
     * active channel a Board the Form is related to belongs to
     */
    async function ensureFormAccess(user: AuthUser, form: Static<typeof CoreFormResponse>): Promise<void> {
        if (isFormAuthor(user, form)) return;

        if (form.boards.length) {
            const channels = [...await userChannels(config, user.email)];

            if (channels.length) {
                const boards = await config.models.CoreEventBoard.list({
                    limit: 1,
                    where: sql`id IN ${form.boards} AND channel IN ${channels}`,
                });

                if (boards.total > 0) return;
            }
        }

        throw new Err(403, null, 'You do not have permission to access this Form');
    }

    /**
     * Replace the Boards a Form is related to - the caller must have access
     * to each of the given Boards
     */
    async function commitBoards(user: AuthUser, form: string, boards: string[]): Promise<void> {
        for (const board of boards) {
            await boardControl.boardAccess(user, board);
        }

        await config.pg.delete(CoreFormBoard)
            .where(eq(CoreFormBoard.form, form));

        if (boards.length > 0) {
            await config.pg.insert(CoreFormBoard)
                .values(boards.map(board => ({ form, board })));
        }
    }

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
            board: Type.Optional(Type.String({
                format: 'uuid',
                description: 'Only return Forms related to the given Board',
            })),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(CoreFormResponse),
        }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const board = req.query.board === undefined
                ? sql`True`
                : sql`EXISTS (
                    SELECT 1
                    FROM core_form_board
                    WHERE core_form_board.form = core_form.id
                    AND core_form_board.board = ${req.query.board}
                )`;

            let where;
            if (user.is_admin()) {
                where = sql`
                    name ~* ${req.query.filter}
                    AND ${board}
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
                                FROM core_form_board
                                JOIN core_event_board ON core_event_board.id = core_form_board.board
                                WHERE core_form_board.form = core_form.id
                                AND core_event_board.channel IN ${channels}
                            )
                        )
                        AND ${board}
                    `
                    : sql`
                        name ~* ${req.query.filter}
                        AND username = ${user.email}
                        AND ${board}
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

            const form = await config.models.CoreForm.augmented_from(req.params.form);

            await ensureFormAccess(user, form);

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
            boards: Type.Array(Type.String({ format: 'uuid' }), {
                uniqueItems: true,
                default: [],
                description: 'KanBan Boards the Form can be used on',
            }),
        }),
        res: CoreFormResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const { boards, ...body } = req.body;

            const form = await config.models.CoreForm.generate({
                ...body,
                username: user.email,
            });

            await commitBoards(user, form.id, boards);

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
            boards: Type.Optional(Type.Array(Type.String({ format: 'uuid' }), {
                uniqueItems: true,
                description: 'KanBan Boards the Form can be used on - replaces the existing Board relations',
            })),
        }),
        res: CoreFormResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const form = await config.models.CoreForm.augmented_from(req.params.form);

            if (!isFormAuthor(user, form)) {
                throw new Err(403, null, 'Only the Form author can update this Form');
            }

            const { boards, ...body } = req.body;

            if (Object.keys(body).length > 0) {
                await config.models.CoreForm.commit(req.params.form, {
                    ...body,
                    updated: sql`Now()`,
                });
            }

            if (boards !== undefined) {
                await commitBoards(user, req.params.form, boards);
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

            if (!isFormAuthor(user, form)) {
                throw new Err(403, null, 'Only the Form author can delete this Form');
            }

            await config.models.CoreForm.delete(req.params.form);

            res.json({ status: 200, message: 'Core Form Deleted' });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
