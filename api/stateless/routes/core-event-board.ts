import { Type, Static } from '@sinclair/typebox';
import { StandardResponse, CoreEventBoardResponse, CoreEventBoardEventResponse, CoreEventResponse } from '../../common/types.js';
import { sql } from 'drizzle-orm';
import { GenericListOrder } from '@openaddresses/batch-generic';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthUser } from '../../common/auth.js';
import { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak';
import { CoreEventBoard } from '../../common/schema.js';
import { CoreEventBoard_Type } from '../../common/enums.js';
import type ConfigStateless from '../config.js';
import activeChannels from '../lib/tak-channels.js';
import * as Default from '../lib/limits.js';

/** Upper bound on Boards & placed Events returned for a single Channel */
const MAX_LIST = 1000;

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

    /**
     * Every Channel has a single automatically managed Board of type
     * nominated that newly nominated Events land on by default
     */
    async function ensureNominatedBoard(channel: number): Promise<void> {
        const existing = await config.models.CoreEventBoard.list({
            limit: 1,
            where: sql`channel = ${channel} AND type = ${CoreEventBoard_Type.NOMINATED}`,
        });

        if (existing.total === 0) {
            await config.models.CoreEventBoard.generate({
                channel: BigInt(channel),
                name: 'Nominated',
                type: CoreEventBoard_Type.NOMINATED,
                position: 0,
            });
        }
    }

    function boardResponse(
        board: typeof CoreEventBoard.$inferSelect,
        events: Array<Static<typeof CoreEventBoardEventResponse>>,
    ): Static<typeof CoreEventBoardResponse> {
        return {
            id: board.id,
            created: board.created,
            updated: board.updated,
            channel: Number(board.channel),
            name: board.name,
            description: board.description,
            color: board.color,
            type: board.type,
            position: board.position,
            events,
        };
    }

    await schema.get('/core/event/board', {
        name: 'List Boards',
        group: 'CoreEventBoard',
        description: 'List the KanBan Boards of a Channel along with the Core Events placed on them',
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

            await ensureNominatedBoard(req.query.channel);

            const boards = await config.models.CoreEventBoard.list({
                limit: MAX_LIST,
                where: sql`channel = ${req.query.channel}`,
                sort: 'position',
                order: GenericListOrder.ASC,
            });

            const placements = await config.models.CoreEventBoardEvent.list({
                limit: MAX_LIST,
                where: sql`channel = ${req.query.channel}`,
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

            const byBoard = new Map<string, Array<Static<typeof CoreEventBoardEventResponse>>>();
            for (const placement of placements.items) {
                const event = events.get(placement.event);
                if (!event) continue;

                const arr = byBoard.get(placement.board) || [];
                arr.push({
                    id: placement.id,
                    created: placement.created,
                    updated: placement.updated,
                    board: placement.board,
                    channel: Number(placement.channel),
                    position: placement.position,
                    event,
                });
                byBoard.set(placement.board, arr);
            }

            res.json({
                total: boards.total,
                items: boards.items.map((board) => {
                    return boardResponse(board, byBoard.get(board.id) || []);
                }),
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/core/event/board', {
        name: 'Create Board',
        group: 'CoreEventBoard',
        description: 'Create a new KanBan Board on a Channel',
        body: Type.Object({
            channel: Type.Integer({
                minimum: 0,
                description: 'TAK Channel bitpos the Board belongs to',
            }),
            name: Default.NameField,
            description: Type.Optional(Default.DescriptionField),
            color: Type.Optional(Type.String({
                pattern: '^(#[0-9a-fA-F]{6})?$',
                description: 'Hex colour the Board is rendered with - ie: #ff0000 - or an empty string for the default',
            })),
            position: Type.Optional(Type.Integer({
                minimum: 0,
                description: 'Horizontal position of the Board - defaults to after the existing Boards',
            })),
        }),
        res: CoreEventBoardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            await ensureChannelAccess(user, req.body.channel);

            let position = req.body.position;
            if (position === undefined) {
                const existing = await config.models.CoreEventBoard.list({
                    limit: 1,
                    where: sql`channel = ${req.body.channel}`,
                    sort: 'position',
                    order: GenericListOrder.DESC,
                });

                position = existing.items.length ? existing.items[0].position + 1 : 0;
            }

            const board = await config.models.CoreEventBoard.generate({
                channel: BigInt(req.body.channel),
                name: req.body.name,
                description: req.body.description,
                color: req.body.color,
                type: CoreEventBoard_Type.CUSTOM,
                position,
            });

            res.json(boardResponse(board, []));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/core/event/board/:board', {
        name: 'Update Board',
        group: 'CoreEventBoard',
        description: 'Rename or re-order a KanBan Board',
        params: Type.Object({
            board: Type.String({
                format: 'uuid',
            }),
        }),
        body: Type.Object({
            name: Type.Optional(Default.NameField),
            description: Type.Optional(Default.DescriptionField),
            color: Type.Optional(Type.String({
                pattern: '^(#[0-9a-fA-F]{6})?$',
                description: 'Hex colour the Board is rendered with - ie: #ff0000 - or an empty string for the default',
            })),
            position: Type.Optional(Type.Integer({ minimum: 0 })),
        }),
        res: CoreEventBoardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            let board = await config.models.CoreEventBoard.from(req.params.board);

            await ensureChannelAccess(user, Number(board.channel));

            if (Object.keys(req.body).length > 0) {
                board = await config.models.CoreEventBoard.commit(req.params.board, {
                    ...req.body,
                    updated: sql`Now()`,
                });
            }

            const placements = await config.models.CoreEventBoardEvent.list({
                limit: MAX_LIST,
                where: sql`board = ${board.id}`,
                sort: 'position',
                order: GenericListOrder.ASC,
            });

            const events: Array<Static<typeof CoreEventBoardEventResponse>> = [];
            for (const placement of placements.items) {
                events.push({
                    id: placement.id,
                    created: placement.created,
                    updated: placement.updated,
                    board: placement.board,
                    channel: Number(placement.channel),
                    position: placement.position,
                    event: await config.models.CoreEvent.augmented_from(placement.event),
                });
            }

            res.json(boardResponse(board, events));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/core/event/board/:board', {
        name: 'Delete Board',
        group: 'CoreEventBoard',
        description: 'Delete a KanBan Board - Events placed on the Board are removed from the Board but are not deleted',
        params: Type.Object({
            board: Type.String({
                format: 'uuid',
            }),
        }),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const board = await config.models.CoreEventBoard.from(req.params.board);

            await ensureChannelAccess(user, Number(board.channel));

            if (board.type === CoreEventBoard_Type.NOMINATED) {
                throw new Err(400, null, 'The Nominated Board cannot be deleted');
            }

            await config.models.CoreEventBoard.delete(req.params.board);

            res.json({ status: 200, message: 'Board Deleted' });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.put('/core/event/board/:board/event/:event', {
        name: 'Place Event',
        group: 'CoreEventBoard',
        description: `
            Nominate a Core Event to a Board or move it between the Boards
            of a Channel - the Event must be shared with the Board's Channel
        `,
        params: Type.Object({
            board: Type.String({
                format: 'uuid',
            }),
            event: Type.String({
                format: 'uuid',
            }),
        }),
        body: Type.Object({
            position: Type.Integer({
                minimum: 0,
                default: 0,
                description: 'Vertical position of the Event within the Board',
            }),
        }),
        res: CoreEventBoardEventResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const board = await config.models.CoreEventBoard.from(req.params.board);

            await ensureChannelAccess(user, Number(board.channel));

            const event = await config.models.CoreEvent.augmented_from(req.params.event);

            if (!event.channels.map(c => Number(c)).includes(Number(board.channel))) {
                throw new Err(400, null, 'The Event is not shared with the Board\'s Channel');
            }

            const existing = await config.models.CoreEventBoardEvent.list({
                limit: 1,
                where: sql`channel = ${board.channel} AND event = ${req.params.event}`,
            });

            let placement;
            if (existing.items.length) {
                placement = await config.models.CoreEventBoardEvent.commit(existing.items[0].id, {
                    board: req.params.board,
                    position: req.body.position,
                    updated: sql`Now()`,
                });
            } else {
                placement = await config.models.CoreEventBoardEvent.generate({
                    board: req.params.board,
                    event: req.params.event,
                    channel: board.channel,
                    position: req.body.position,
                });
            }

            res.json({
                id: placement.id,
                created: placement.created,
                updated: placement.updated,
                board: placement.board,
                channel: Number(placement.channel),
                position: placement.position,
                event,
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/core/event/board/:board/event/:event', {
        name: 'Remove Event',
        group: 'CoreEventBoard',
        description: 'Remove a Core Event from a Board - the Event itself is not deleted',
        params: Type.Object({
            board: Type.String({
                format: 'uuid',
            }),
            event: Type.String({
                format: 'uuid',
            }),
        }),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const board = await config.models.CoreEventBoard.from(req.params.board);

            await ensureChannelAccess(user, Number(board.channel));

            await config.models.CoreEventBoardEvent.delete(
                sql`board = ${req.params.board} AND event = ${req.params.event}`,
            );

            res.json({ status: 200, message: 'Event removed from Board' });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
