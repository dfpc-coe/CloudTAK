import Modeler from '@openaddresses/batch-generic';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { CoreEventBoard, CoreEventBoardEvent } from '../schema.js';
import { eq } from 'drizzle-orm';

export default class CoreEventBoardEventModel extends Modeler<typeof CoreEventBoardEvent> {
    constructor(
        pool: PostgresJsDatabase<Record<string, unknown>>,
    ) {
        super(pool, CoreEventBoardEvent);
    }

    /** Every placement of a Core Event alongside the Channel of the Board it sits on */
    async placements(event: string): Promise<Array<{
        placement: typeof CoreEventBoardEvent.$inferSelect;
        channel: number;
    }>> {
        const pgres = await this.pool
            .select({ placement: CoreEventBoardEvent, channel: CoreEventBoard.channel })
            .from(CoreEventBoardEvent)
            .innerJoin(CoreEventBoard, eq(CoreEventBoard.id, CoreEventBoardEvent.board))
            .where(eq(CoreEventBoardEvent.event, event));

        return pgres.map(row => ({ placement: row.placement, channel: Number(row.channel) }));
    }
}
