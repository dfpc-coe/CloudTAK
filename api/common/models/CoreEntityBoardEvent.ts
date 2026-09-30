import Modeler from '@openaddresses/batch-generic';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { CoreEntityBoard, CoreEntityBoardEvent } from '../schema.js';
import { eq } from 'drizzle-orm';

export default class CoreEntityBoardEventModel extends Modeler<typeof CoreEntityBoardEvent> {
    constructor(
        pool: PostgresJsDatabase<Record<string, unknown>>,
    ) {
        super(pool, CoreEntityBoardEvent);
    }

    /** Every placement of a Core Event alongside the Channel of the Board it sits on */
    async placements(event: string): Promise<Array<{
        placement: typeof CoreEntityBoardEvent.$inferSelect;
        channel: number;
    }>> {
        const pgres = await this.pool
            .select({ placement: CoreEntityBoardEvent, channel: CoreEntityBoard.channel })
            .from(CoreEntityBoardEvent)
            .innerJoin(CoreEntityBoard, eq(CoreEntityBoard.id, CoreEntityBoardEvent.board))
            .where(eq(CoreEntityBoardEvent.event, event));

        return pgres.map(row => ({ placement: row.placement, channel: Number(row.channel) }));
    }
}
