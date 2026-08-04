import { Type, Static } from '@sinclair/typebox';
import {
    StandardResponse,
    CoreEventBoardResponse,
    CoreEventBoardColumnResponse,
    CoreEventBoardEventResponse,
    CoreEventResponse,
} from '../../common/types.js';
import { sql } from 'drizzle-orm';
import { GenericListOrder } from '@openaddresses/batch-generic';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthUser } from '../../common/auth.js';
import { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak';
import { CoreEventBoard, CoreEventBoardColumn, CoreEventBoardEvent } from '../../common/schema.js';
import { CoreEventBoardColumn_Type } from '../../common/enums.js';
import type ConfigStateless from '../config.js';
import activeChannels from '../lib/tak-channels.js';
import * as Default from '../lib/limits.js';

/** Upper bound on Boards, Columns & placed Events returned for a single request */
const MAX_LIST = 1000;

/**
 * Route order matters - the literal /board/column & /board/event paths have
 * to be registered before /board/:board or Express hands them to the
 * parameterised Board routes
 */
export default async function router(schema: Schema, config: ConfigStateless) {
    async function userChannels(email: string): Promise<Set<number>> {
        const profile = await config.models.Profile.from(email);
        const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));
        return await activeChannels(api);
    }

    /**
     * Boards are visible to System Admins and any user with the Board's
     * Channel currently active
     */
    async function ensureChannelAccess(user: AuthUser, channel: number): Promise<void> {
        if (user.is_admin()) return;

        const channels = await userChannels(user.email);

        if (!channels.has(channel)) {
            throw new Err(403, null, 'You do not have permission to access Boards for this Channel');
        }
    }

    /** Resolve a Board and check the caller may see the Channel it belongs to */
    async function boardAccess(user: AuthUser, id: string): Promise<typeof CoreEventBoard.$inferSelect> {
        const board = await config.models.CoreEventBoard.from(id);

        await ensureChannelAccess(user, Number(board.channel));

        return board;
    }

    /**
     * Every Board has a single automatically managed Column of type nominated
     * that newly nominated Events land in by default
     */
    async function ensureNominatedColumn(board: string): Promise<typeof CoreEventBoardColumn.$inferSelect> {
        const existing = await config.models.CoreEventBoardColumn.list({
            limit: 1,
            where: sql`board = ${board} AND type = ${CoreEventBoardColumn_Type.NOMINATED}`,
        });

        if (existing.items.length) return existing.items[0];

        return await config.models.CoreEventBoardColumn.generate({
            board,
            name: 'Nominated',
            type: CoreEventBoardColumn_Type.NOMINATED,
            position: 0,
        });
    }

    /**
     * Every Channel has a single automatically managed Board that nominations
     * from the Event view land on
     */
    async function ensureChannelBoard(channel: number): Promise<void> {
        const existing = await config.models.CoreEventBoard.list({
            limit: 1,
            where: sql`channel = ${channel}`,
        });

        const board = existing.items.length
            ? existing.items[0]
            : await config.models.CoreEventBoard.generate({
                    channel: BigInt(channel),
                    name: 'Events',
                });

        await ensureNominatedColumn(board.id);
    }

    function boardResponse(
        board: typeof CoreEventBoard.$inferSelect,
    ): Static<typeof CoreEventBoardResponse> {
        return {
            id: board.id,
            created: board.created,
            updated: board.updated,
            channel: Number(board.channel),
            name: board.name,
            description: board.description,
        };
    }

    function columnResponse(
        column: typeof CoreEventBoardColumn.$inferSelect,
    ): Static<typeof CoreEventBoardColumnResponse> {
        return {
            id: column.id,
            created: column.created,
            updated: column.updated,
            board: column.board,
            name: column.name,
            description: column.description,
            color: column.color,
            type: column.type,
            position: column.position,
        };
    }

    function placementResponse(
        placement: typeof CoreEventBoardEvent.$inferSelect,
        event: Static<typeof CoreEventResponse>,
    ): Static<typeof CoreEventBoardEventResponse> {
        return {
            id: placement.id,
            created: placement.created,
            updated: placement.updated,
            board: placement.board,
            column: placement.column,
            position: placement.position,
            event,
        };
    }

    await schema.get('/board', {
        name: 'List Boards',
        group: 'CoreEventBoard',
        description: 'List the KanBan Boards of a Channel',
        query: Type.Object({
            channel: Type.Integer({
                minimum: 0,
                description: 'TAK Channel bitpos to list Boards for',
            }),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(CoreEventBoardResponse),
        }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            await ensureChannelAccess(user, req.query.channel);

            await ensureChannelBoard(req.query.channel);

            const boards = await config.models.CoreEventBoard.list({
                limit: MAX_LIST,
                where: sql`channel = ${req.query.channel}`,
                sort: 'name',
                order: GenericListOrder.ASC,
            });

            res.json({
                total: boards.total,
                items: boards.items.map(boardResponse),
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/board', {
        name: 'Create Board',
        group: 'CoreEventBoard',
        description: 'Create a new KanBan Board on a Channel - a Nominated Column is created alongside it',
        body: Type.Object({
            channel: Type.Integer({
                minimum: 0,
                description: 'TAK Channel bitpos the Board belongs to',
            }),
            name: Default.NameField,
            description: Type.Optional(Default.DescriptionField),
        }),
        res: CoreEventBoardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            await ensureChannelAccess(user, req.body.channel);

            const board = await config.models.CoreEventBoard.generate({
                channel: BigInt(req.body.channel),
                name: req.body.name,
                description: req.body.description,
            });

            await ensureNominatedColumn(board.id);

            res.json(boardResponse(board));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/board/column', {
        name: 'List Columns',
        group: 'CoreEventBoardColumn',
        description: 'List the Columns of a KanBan Board',
        query: Type.Object({
            board: Type.String({
                format: 'uuid',
                description: 'Board to list Columns for',
            }),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(CoreEventBoardColumnResponse),
        }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const board = await boardAccess(user, req.query.board);

            await ensureNominatedColumn(board.id);

            const columns = await config.models.CoreEventBoardColumn.list({
                limit: MAX_LIST,
                where: sql`board = ${board.id}`,
                sort: 'position',
                order: GenericListOrder.ASC,
            });

            res.json({
                total: columns.total,
                items: columns.items.map(columnResponse),
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/board/column', {
        name: 'Create Column',
        group: 'CoreEventBoardColumn',
        description: 'Create a new Column on a KanBan Board',
        body: Type.Object({
            board: Type.String({
                format: 'uuid',
                description: 'Board the Column belongs to',
            }),
            name: Default.NameField,
            description: Type.Optional(Default.DescriptionField),
            color: Type.Optional(Type.String({
                pattern: '^(#[0-9a-fA-F]{6})?$',
                description: 'Hex colour the Column is rendered with - ie: #ff0000 - or an empty string for the default',
            })),
            position: Type.Optional(Type.Integer({
                minimum: 0,
                description: 'Horizontal position of the Column - defaults to after the existing Columns',
            })),
        }),
        res: CoreEventBoardColumnResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const board = await boardAccess(user, req.body.board);

            let position = req.body.position;
            if (position === undefined) {
                const existing = await config.models.CoreEventBoardColumn.list({
                    limit: 1,
                    where: sql`board = ${board.id}`,
                    sort: 'position',
                    order: GenericListOrder.DESC,
                });

                position = existing.items.length ? existing.items[0].position + 1 : 0;
            }

            const column = await config.models.CoreEventBoardColumn.generate({
                board: board.id,
                name: req.body.name,
                description: req.body.description,
                color: req.body.color,
                type: CoreEventBoardColumn_Type.CUSTOM,
                position,
            });

            res.json(columnResponse(column));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/board/column/:column', {
        name: 'Update Column',
        group: 'CoreEventBoardColumn',
        description: 'Rename, restyle or re-order a Column of a KanBan Board',
        params: Type.Object({
            column: Type.String({
                format: 'uuid',
            }),
        }),
        body: Type.Object({
            name: Type.Optional(Default.NameField),
            description: Type.Optional(Default.DescriptionField),
            color: Type.Optional(Type.String({
                pattern: '^(#[0-9a-fA-F]{6})?$',
                description: 'Hex colour the Column is rendered with - ie: #ff0000 - or an empty string for the default',
            })),
            position: Type.Optional(Type.Integer({ minimum: 0 })),
        }),
        res: CoreEventBoardColumnResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            let column = await config.models.CoreEventBoardColumn.from(req.params.column);

            await boardAccess(user, column.board);

            if (Object.keys(req.body).length > 0) {
                column = await config.models.CoreEventBoardColumn.commit(req.params.column, {
                    ...req.body,
                    updated: sql`Now()`,
                });
            }

            res.json(columnResponse(column));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/board/column/:column', {
        name: 'Delete Column',
        group: 'CoreEventBoardColumn',
        description: 'Delete a Column - Events placed in the Column are removed from the Board but are not deleted',
        params: Type.Object({
            column: Type.String({
                format: 'uuid',
            }),
        }),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const column = await config.models.CoreEventBoardColumn.from(req.params.column);

            await boardAccess(user, column.board);

            if (column.type === CoreEventBoardColumn_Type.NOMINATED) {
                throw new Err(400, null, 'The Nominated Column cannot be deleted');
            }

            await config.models.CoreEventBoardColumn.delete(req.params.column);

            res.json({ status: 200, message: 'Column Deleted' });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/board/event', {
        name: 'List Board Events',
        group: 'CoreEventBoardEvent',
        description: 'List the Core Events placed on a KanBan Board along with the Column each sits in',
        query: Type.Object({
            board: Type.String({
                format: 'uuid',
                description: 'Board to list placed Events for',
            }),
            column: Type.Optional(Type.String({
                format: 'uuid',
                description: 'Only return Events placed in the given Column',
            })),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(CoreEventBoardEventResponse),
        }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const board = await boardAccess(user, req.query.board);

            const placements = await config.models.CoreEventBoardEvent.list({
                limit: MAX_LIST,
                where: req.query.column === undefined
                    ? sql`board = ${board.id}`
                    : sql`board = ${board.id} AND "column" = ${req.query.column}`,
                sort: 'position',
                order: GenericListOrder.ASC,
            });

            const events = new Map<string, Static<typeof CoreEventResponse>>();
            if (placements.items.length) {
                const list = await config.models.CoreEvent.augmented_list({
                    limit: placements.items.length,
                    where: sql`id IN ${placements.items.map(p => p.event)}`,
                });

                for (const event of list.items) {
                    events.set(event.id, event);
                }
            }

            const items: Array<Static<typeof CoreEventBoardEventResponse>> = [];
            for (const placement of placements.items) {
                const event = events.get(placement.event);

                // A deleted Event cascades its placements away - a missing
                // Event here would be a torn read, not a real placement
                if (!event) continue;

                items.push(placementResponse(placement, event));
            }

            res.json({
                total: items.length,
                items,
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.put('/board/event', {
        name: 'Place Event',
        group: 'CoreEventBoardEvent',
        description: `
            Nominate a Core Event into a Column or move it between the Columns
            of a Board - the Event must be shared with the Board's Channel
        `,
        body: Type.Object({
            column: Type.String({
                format: 'uuid',
                description: 'Column to place the Event in',
            }),
            event: Type.String({
                format: 'uuid',
                description: 'Core Event to place',
            }),
            position: Type.Integer({
                minimum: 0,
                default: 0,
                description: 'Vertical position of the Event within the Column',
            }),
        }),
        res: CoreEventBoardEventResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const column = await config.models.CoreEventBoardColumn.from(req.body.column);

            const board = await boardAccess(user, column.board);

            const event = await config.models.CoreEvent.augmented_from(req.body.event);

            if (!event.channels.map(c => Number(c)).includes(Number(board.channel))) {
                throw new Err(400, null, 'The Event is not shared with the Board\'s Channel');
            }

            const existing = await config.models.CoreEventBoardEvent.list({
                limit: 1,
                where: sql`board = ${board.id} AND event = ${req.body.event}`,
            });

            let placement;
            if (existing.items.length) {
                placement = await config.models.CoreEventBoardEvent.commit(existing.items[0].id, {
                    column: column.id,
                    position: req.body.position,
                    updated: sql`Now()`,
                });
            } else {
                placement = await config.models.CoreEventBoardEvent.generate({
                    board: board.id,
                    column: column.id,
                    event: req.body.event,
                    position: req.body.position,
                });
            }

            res.json(placementResponse(placement, event));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/board/event/:placement', {
        name: 'Update Placement',
        group: 'CoreEventBoardEvent',
        description: 'Move an already placed Core Event to another Column of the same Board or re-order it within its Column',
        params: Type.Object({
            placement: Type.String({
                format: 'uuid',
            }),
        }),
        body: Type.Object({
            column: Type.Optional(Type.String({
                format: 'uuid',
                description: 'Column of the same Board to move the Event into',
            })),
            position: Type.Optional(Type.Integer({ minimum: 0 })),
        }),
        res: CoreEventBoardEventResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            let placement = await config.models.CoreEventBoardEvent.from(req.params.placement);

            await boardAccess(user, placement.board);

            if (req.body.column !== undefined) {
                const column = await config.models.CoreEventBoardColumn.from(req.body.column);

                if (column.board !== placement.board) {
                    throw new Err(400, null, 'The Column belongs to a different Board');
                }
            }

            if (Object.keys(req.body).length > 0) {
                placement = await config.models.CoreEventBoardEvent.commit(req.params.placement, {
                    ...req.body,
                    updated: sql`Now()`,
                });
            }

            res.json(placementResponse(
                placement,
                await config.models.CoreEvent.augmented_from(placement.event),
            ));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/board/event/:placement', {
        name: 'Remove Event',
        group: 'CoreEventBoardEvent',
        description: 'Remove a Core Event from a Board - the Event itself is not deleted',
        params: Type.Object({
            placement: Type.String({
                format: 'uuid',
            }),
        }),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const placement = await config.models.CoreEventBoardEvent.from(req.params.placement);

            await boardAccess(user, placement.board);

            await config.models.CoreEventBoardEvent.delete(req.params.placement);

            res.json({ status: 200, message: 'Event removed from Board' });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/board/:board', {
        name: 'Get Board',
        group: 'CoreEventBoard',
        description: 'Get a single KanBan Board',
        params: Type.Object({
            board: Type.String({
                format: 'uuid',
            }),
        }),
        res: CoreEventBoardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const board = await boardAccess(user, req.params.board);

            res.json(boardResponse(board));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/board/:board', {
        name: 'Update Board',
        group: 'CoreEventBoard',
        description: 'Rename a KanBan Board or update its description',
        params: Type.Object({
            board: Type.String({
                format: 'uuid',
            }),
        }),
        body: Type.Object({
            name: Type.Optional(Default.NameField),
            description: Type.Optional(Default.DescriptionField),
        }),
        res: CoreEventBoardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            let board = await boardAccess(user, req.params.board);

            if (Object.keys(req.body).length > 0) {
                board = await config.models.CoreEventBoard.commit(req.params.board, {
                    ...req.body,
                    updated: sql`Now()`,
                });
            }

            res.json(boardResponse(board));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/board/:board', {
        name: 'Delete Board',
        group: 'CoreEventBoard',
        description: 'Delete a KanBan Board along with its Columns - Events placed on the Board are not deleted',
        params: Type.Object({
            board: Type.String({
                format: 'uuid',
            }),
        }),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const board = await boardAccess(user, req.params.board);

            const boards = await config.models.CoreEventBoard.list({
                limit: 2,
                where: sql`channel = ${board.channel}`,
            });

            // The Channel's last Board would be re-created by the next list
            // call - refuse rather than silently resurrecting it empty
            if (boards.total <= 1) {
                throw new Err(400, null, 'The last Board of a Channel cannot be deleted');
            }

            await config.models.CoreEventBoard.delete(req.params.board);

            res.json({ status: 200, message: 'Board Deleted' });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
