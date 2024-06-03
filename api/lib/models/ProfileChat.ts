import Modeler from '@openaddresses/batch-generic';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { ProfileChat } from '../schema.js';
import { sql, eq } from 'drizzle-orm';

export type ChatList = {
    total: number;
    items: Array<{
        chatroom: string;
    }>
}

export default class ProfileChatModel extends Modeler<typeof ProfileChat> {
    constructor(
        pool: PostgresJsDatabase<Record<string, unknown>>,
    ) {
        super(pool, ProfileChat);
    }

    async chats(username: string): Promise<ChatList> {
        const pgres = await this.pool.select({
            chatroom: this.generic.chatroom
        }).from(this.generic)
            .where(eq(this.generic.username, username))
            .groupBy(sql`username, chatroom`)

        return {
            total: pgres.length,
            items: pgres
        }
    }
}
