import Modeler from '@openaddresses/batch-generic';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { ProfilePaging } from '../schema.js';
import { eq } from 'drizzle-orm';

export default class ProfilePagingModel extends Modeler<typeof ProfilePaging> {
    constructor(
        pool: PostgresJsDatabase<Record<string, unknown>>,
    ) {
        super(pool, ProfilePaging);
    }

    async forUser(username: string) {
        return await this.pool.select()
            .from(this.generic)
            .where(eq(this.generic.username, username));
    }
}
