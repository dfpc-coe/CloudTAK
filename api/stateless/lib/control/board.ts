import type { Static } from '@sinclair/typebox';
import { sql } from 'drizzle-orm';
import Err from '@openaddresses/batch-error';
import type { AuthUser } from '../../../common/auth.js';
import type { CoreEventBoard, CoreEventBoardColumn, CoreEventBoardEvent } from '../../../common/schema.js';
import { CoreEventBoardColumn_Type } from '../../../common/enums.js';
import type {
    CoreEventResponse,
    CoreEventBoardResponse,
    CoreEventBoardColumnResponse,
    CoreEventBoardEventResponse,
} from '../../../common/types.js';
import type ConfigStateless from '../../config.js';
import { userChannels } from '../tak-channels.js';

/** Upper bound on Boards, Columns & placed Events returned for a single request */
export const MAX_LIST = 1000;

export function boardResponse(
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

export function columnResponse(
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

export function placementResponse(
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

/**
 * Access control and the automatically managed Board & Column rows shared by
 * the KanBan Board endpoints
 */
export default class BoardControl {
    config: ConfigStateless;

    constructor(config: ConfigStateless) {
        this.config = config;
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
    async boardAccess(user: AuthUser, id: string): Promise<typeof CoreEventBoard.$inferSelect> {
        const board = await this.config.models.CoreEventBoard.from(id);

        await this.ensureChannelAccess(user, Number(board.channel));

        return board;
    }

    /**
     * Resolve a Column alongside the Board it belongs to - the Board is
     * returned as well so callers that need both don't pay for a second
     * access check
     */
    async columnAccess(user: AuthUser, id: string): Promise<{
        column: typeof CoreEventBoardColumn.$inferSelect;
        board: typeof CoreEventBoard.$inferSelect;
    }> {
        const column = await this.config.models.CoreEventBoardColumn.from(id);

        return { column, board: await this.boardAccess(user, column.board) };
    }

    /** Resolve a placed Event alongside the Board it sits on */
    async placementAccess(user: AuthUser, id: string): Promise<{
        placement: typeof CoreEventBoardEvent.$inferSelect;
        board: typeof CoreEventBoard.$inferSelect;
    }> {
        const placement = await this.config.models.CoreEventBoardEvent.from(id);

        return { placement, board: await this.boardAccess(user, placement.board) };
    }

    /**
     * Every Board has a single automatically managed Column of type nominated
     * that newly nominated Events land in by default
     */
    async ensureNominatedColumn(board: string): Promise<typeof CoreEventBoardColumn.$inferSelect> {
        const existing = await this.config.models.CoreEventBoardColumn.list({
            limit: 1,
            where: sql`board = ${board} AND type = ${CoreEventBoardColumn_Type.NOMINATED}`,
        });

        if (existing.items.length) return existing.items[0];

        return await this.config.models.CoreEventBoardColumn.generate({
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
    async ensureChannelBoard(channel: number): Promise<void> {
        const existing = await this.config.models.CoreEventBoard.list({
            limit: 1,
            where: sql`channel = ${channel}`,
        });

        const board = existing.items.length
            ? existing.items[0]
            : await this.config.models.CoreEventBoard.generate({
                    channel: BigInt(channel),
                    name: 'Events',
                });

        await this.ensureNominatedColumn(board.id);
    }
}
