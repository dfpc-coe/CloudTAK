import Modeler, { Param } from '@openaddresses/batch-generic';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { ProfileChat } from '../schema.js';
import { sql, eq } from 'drizzle-orm';

export default class ProfileChatModel extends Modeler<typeof ProfileChat> {
    constructor(
        pool: PostgresJsDatabase<any>,
    ) {
        super(pool, ProfileChat);
    }

    async chats(username: string): Promise<boolean> {
        const pgres = await this.pool.select({
            chatroom: this.generic.username
        }).from(this.generic)
            .where(eq(this.generic.username, username))

        return true;
    }
}
