import type { Static } from '@sinclair/typebox';
import { sql } from 'drizzle-orm';
import Err from '@openaddresses/batch-error';
import type { AuthUser } from '../../../common/auth.js';
import type { CoreEntityBoard, CoreEntityBoardColumn, CoreEntityBoardEvent } from '../../../common/schema.js';
import { CoreEntityBoardColumn_Type } from '../../../common/enums.js';
import type {
    CoreEntityResponse,
    CoreEntityBoardResponse,
    CoreEntityBoardColumnResponse,
    CoreEntityBoardEventResponse,
} from '../../../common/types.js';
import type ConfigStateless from '../../config.js';
import { ETLEventAction } from '../../../common/etl-events.js';
import { userChannels } from '../tak-channels.js';

/** Upper bound on Boards, Columns & placed Events returned for a single request */
export const MAX_LIST = 1000;

export function boardResponse(
    board: typeof CoreEntityBoard.$inferSelect,
): Static<typeof CoreEntityBoardResponse> {
    return {
        id: board.id,
        created: board.created,
        updated: board.updated,
        channel: Number(board.channel),
        name: board.name,
        description: board.description,
    };
}

export function columnResponse(
    column: typeof CoreEntityBoardColumn.$inferSelect,
): Static<typeof CoreEntityBoardColumnResponse> {
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

export function placementResponse(
    placement: typeof CoreEntityBoardEvent.$inferSelect,
    event: Static<typeof CoreEntityResponse>,
): Static<typeof CoreEntityBoardEventResponse> {
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

/**
 * Access control and the automatically managed Board & Column rows shared by
 * the KanBan Board endpoints
 */
export default class BoardControl {
    config: ConfigStateless;

    constructor(config: ConfigStateless) {
        this.config = config;
    }

    /** Best effort ETL Event delivery - a failure is logged and never fails the request that caused it */
    deliver(delivery: Promise<void>, subject: string): void {
        delivery.catch((err) => {
            console.error(`not ok - failed to deliver ETL Event for ${subject}:`, err);
        });
    }

    /**
     * Boards are visible to System Admins and any user with the Board's
     * Channel currently active
     */
    async ensureChannelAccess(user: AuthUser, channel: number): Promise<void> {
        if (user.is_admin()) return;

        const channels = await userChannels(this.config, user.email);

        if (!channels.has(channel)) {
            throw new Err(403, null, 'You do not have permission to access Boards for this Channel');
        }
    }

    /** Resolve a Board and check the caller may see the Channel it belongs to */
    async boardAccess(user: AuthUser, id: string): Promise<typeof CoreEntityBoard.$inferSelect> {
        const board = await this.config.models.CoreEntityBoard.from(id);

        await this.ensureChannelAccess(user, Number(board.channel));

        return board;
    }

    /**
     * Resolve a Column alongside the Board it belongs to - the Board is
     * returned as well so callers that need both don't pay for a second
     * access check
     */
    async columnAccess(user: AuthUser, id: string): Promise<{
        column: typeof CoreEntityBoardColumn.$inferSelect;
        board: typeof CoreEntityBoard.$inferSelect;
    }> {
        const column = await this.config.models.CoreEntityBoardColumn.from(id);

        return { column, board: await this.boardAccess(user, column.board) };
    }

    /** Resolve a placed Event alongside the Board it sits on */
    async placementAccess(user: AuthUser, id: string): Promise<{
        placement: typeof CoreEntityBoardEvent.$inferSelect;
        board: typeof CoreEntityBoard.$inferSelect;
    }> {
        const placement = await this.config.models.CoreEntityBoardEvent.from(id);

        return { placement, board: await this.boardAccess(user, placement.board) };
    }

    /**
     * Every Board has a single automatically managed Column of type nominated
     * that newly nominated Events land in by default
     */
    async ensureNominatedColumn(board: typeof CoreEntityBoard.$inferSelect): Promise<typeof CoreEntityBoardColumn.$inferSelect> {
        const existing = await this.config.models.CoreEntityBoardColumn.list({
            limit: 1,
            where: sql`board = ${board.id} AND type = ${CoreEntityBoardColumn_Type.NOMINATED}`,
        });

        if (existing.items.length) return existing.items[0];

        const column = await this.config.models.CoreEntityBoardColumn.generate({
            board: board.id,
            name: 'Nominated',
            type: CoreEntityBoardColumn_Type.NOMINATED,
            position: 0,
        });

        this.deliver(
            this.config.etlEvents.boardColumn(ETLEventAction.Create, Number(board.channel), columnResponse(column)),
            `Column ${column.id}`,
        );

        return column;
    }

    /**
     * Every Channel has a single automatically managed Board that nominations
     * from the Event view land on
     */
    async ensureChannelBoard(channel: number): Promise<void> {
        const existing = await this.config.models.CoreEntityBoard.list({
            limit: 1,
            where: sql`channel = ${channel}`,
        });

        let board = existing.items[0];

        if (!board) {
            board = await this.config.models.CoreEntityBoard.generate({
                channel: BigInt(channel),
                name: 'Events',
            });

            this.deliver(this.config.etlEvents.board(ETLEventAction.Create, boardResponse(board)), `Board ${board.id}`);
        }

        await this.ensureNominatedColumn(board);
    }
}
