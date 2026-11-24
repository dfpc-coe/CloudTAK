import Modeler from '@openaddresses/batch-generic';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { ProfileChat } from '../schema.js';
import { ProfileChatStatus } from '../enums.js';
import { sql, eq, and } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export type ChatList = {
    total: number;
    items: Array<{
        chatroom: string;
        created: string;
    }>;
};

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

    /**
     * Store a Chat once per (username, message_id) - TAK Server store-and-forward
     * and client retries redeliver a message under its original messageId
     *
     * @param opts.restatus - On conflict, replace the stored status (a resend of an outgoing message)
     */
    async ingest(
        input: InferInsertModel<typeof ProfileChat>,
        opts: { restatus?: boolean } = {},
    ): Promise<{ chat: InferSelectModel<typeof ProfileChat>; created: boolean }> {
        const inserted = await this.pool.insert(this.generic)
            .values(input)
            .onConflictDoNothing({ target: [this.generic.username, this.generic.message_id] })
            .returning();

        if (inserted.length) return { chat: inserted[0], created: true };

        const where = and(
            eq(this.generic.username, input.username),
            eq(this.generic.message_id, input.message_id),
        );

        const existing = opts.restatus
            ? await this.pool.update(this.generic)
                .set({ status: input.status, updated: sql<string>`Now()` })
                .where(where)
                .returning()
            : await this.pool.select().from(this.generic).where(where);

        if (!existing.length) throw new Error(`Chat ${input.message_id} could not be stored`);

        return { chat: existing[0], created: false };
    }

    /**
     * Mark every unread message in a chatroom as read, returning the messages that changed
     */
    async read(username: string, chatroom: string): Promise<Array<InferSelectModel<typeof ProfileChat>>> {
        return await this.pool.update(this.generic)
            .set({ read: true, updated: sql<string>`Now()` })
            .where(and(
                eq(this.generic.username, username),
                eq(this.generic.chatroom, chatroom),
                eq(this.generic.read, false),
            ))
            .returning();
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
