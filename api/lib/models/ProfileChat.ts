import Modeler from '@openaddresses/batch-generic';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { ProfileChat } from '../schema.js';
import { sql, eq } from 'drizzle-orm';

export type ChatList = {
    total: number;
    items: Array<{
        chatroom: string;
        created: string;
    }>;
};

export enum ProfileChatStatus {
    SENT = 'sent',
    PENDING = 'pending',
    FAILED = 'failed',
    DELIVERED = 'delivered',
    READ = 'read',
}

// A status can only progress forward (ie a late "delivered" receipt won't downgrade "read")
const StatusRank = sql.raw(`
    CASE status
        WHEN 'sent' THEN 1
        WHEN 'pending' THEN 2
        WHEN 'failed' THEN 3
        WHEN 'delivered' THEN 4
        WHEN 'read' THEN 5
        ELSE 0
    END
`);

export default class ProfileChatModel extends Modeler<typeof ProfileChat> {
    constructor(
        pool: PostgresJsDatabase<Record<string, unknown>>,
    ) {
        super(pool, ProfileChat);
    }

    /**
     * Apply a Chat Receipt (b-t-f-d/r/p/s) to the original message it refers to
     */
    async receipt(
        username: string,
        message_id: string,
        status: ProfileChatStatus,
    ): Promise<void> {
        await this.pool.update(this.generic)
            .set({
                status,
                updated: sql<string>`Now()`,
            })
            .where(sql`
                username = ${username}
                AND message_id = ${message_id}
                AND COALESCE(${StatusRank}, 0) < CASE ${status}
                    WHEN 'sent' THEN 1
                    WHEN 'pending' THEN 2
                    WHEN 'failed' THEN 3
                    WHEN 'delivered' THEN 4
                    WHEN 'read' THEN 5
                    ELSE 0
                END
            `);
    }

    async chats(username: string): Promise<ChatList> {
        const pgres = await this.pool.select({
            chatroom: this.generic.chatroom,
            created: sql<string>`MAX(${this.generic.created})`,
        }).from(this.generic)
            .where(eq(this.generic.username, username))
            .groupBy(sql`username, chatroom`);

        return {
            total: pgres.length,
            items: pgres as Array<{ chatroom: string; created: string }>,
        };
    }
}
