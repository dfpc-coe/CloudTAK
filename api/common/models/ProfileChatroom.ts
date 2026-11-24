import Modeler from '@openaddresses/batch-generic';
import Err from '@openaddresses/batch-error';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { ProfileChatroom, ProfileChat } from '../schema.js';
import { ProfileChatroomType } from '../enums.js';
import { sql, eq, and } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import type { Feature } from '@tak-ps/node-cot';
import type { ChatroomMember } from '../types.js';

export type Chatroom = InferSelectModel<typeof ProfileChatroom>;

export type ChatroomSummary = Chatroom & {
    unread: number;
};

export type ChatroomInput = {
    id: string;
    name: string;
    type: ProfileChatroomType;
    parent?: string | null;
};

export type ChatroomMembership = {
    members: Array<ChatroomMember>;
    hierarchy?: Feature.ChatHierarchyNode;

    /**
     * The sender created the Group - its view of the membership replaces the stored one.
     * Any other sender can only add members, matching ATAK
     */
    owner: boolean;
};

export function mergeMembers(
    stored: Array<ChatroomMember>,
    incoming: Array<ChatroomMember>,
    owner: boolean,
): Array<ChatroomMember> {
    const known = new Map(stored.map((member) => [member.uid, member]));
    const merged = new Map(owner ? [] : known);

    for (const member of incoming) {
        const named = member.callsign !== member.uid;
        merged.set(member.uid, named ? member : (known.get(member.uid) ?? member));
    }

    return [...merged.values()];
}

export default class ProfileChatroomModel extends Modeler<typeof ProfileChatroom> {
    constructor(
        pool: PostgresJsDatabase<Record<string, unknown>>,
    ) {
        super(pool, ProfileChatroom);
    }

    async room(username: string, id: string): Promise<Chatroom> {
        const rooms = await this.pool.select()
            .from(this.generic)
            .where(and(
                eq(this.generic.username, username),
                eq(this.generic.id, id),
            ));

        if (!rooms.length) throw new Err(404, null, 'Chatroom Not Found');

        return rooms[0];
    }

    /**
     * Create the Chatroom a message belongs to, or bump it if it already exists
     *
     * A Direct Chatroom that predates UID keyed Chatrooms is keyed by callsign
     * and is adopted by the first message that reveals the UID behind it
     */
    async ensure(username: string, input: ChatroomInput): Promise<Chatroom> {
        if (input.type === ProfileChatroomType.DIRECT && input.id !== input.name) {
            await this.pool.update(this.generic)
                .set({ id: input.id })
                .where(sql`
                    ${this.generic.username} = ${username}
                    AND ${this.generic.id} = ${input.name}
                    AND ${this.generic.type} = ${ProfileChatroomType.DIRECT}
                    AND NOT EXISTS (
                        SELECT 1
                            FROM profile_chatroom existing
                            WHERE existing.username = ${username}
                                AND existing.id = ${input.id}
                    )
                `);
        }

        const rooms = await this.pool.insert(this.generic)
            .values({
                username,
                id: input.id,
                name: input.name,
                type: input.type,
                parent: input.parent ?? null,
            })
            .onConflictDoUpdate({
                target: [this.generic.username, this.generic.id],
                set: {
                    name: input.name,
                    updated: sql<string>`Now()`,
                },
            })
            .returning();

        return rooms[0];
    }

    /**
     * Apply the membership carried by a message to a Group Chatroom
     */
    async membership(username: string, id: string, input: ChatroomMembership): Promise<Chatroom> {
        return await this.pool.transaction(async (tx) => {
            const where = and(
                eq(this.generic.username, username),
                eq(this.generic.id, id),
            );

            const rooms = await tx.select().from(this.generic).where(where).for('update');
            if (!rooms.length) throw new Err(404, null, 'Chatroom Not Found');

            const updated = await tx.update(this.generic)
                .set({
                    members: mergeMembers(rooms[0].members, input.members, input.owner),
                    hierarchy: input.owner
                        ? (input.hierarchy ?? rooms[0].hierarchy)
                        : (rooms[0].hierarchy ?? input.hierarchy ?? null),
                })
                .where(where)
                .returning();

            return updated[0];
        });
    }

    /**
     * Remove a Group Chatroom that its owner deleted from the given parent Group
     */
    async removeChild(username: string, parent: string, id: string): Promise<boolean> {
        const removed = await this.pool.delete(this.generic)
            .where(and(
                eq(this.generic.username, username),
                eq(this.generic.id, id),
                eq(this.generic.type, ProfileChatroomType.GROUP),
                eq(this.generic.parent, parent),
            ))
            .returning({ id: this.generic.id });

        return removed.length > 0;
    }

    async summaries(username: string): Promise<Array<ChatroomSummary>> {
        return await this.pool.select({
            username: this.generic.username,
            id: this.generic.id,
            created: this.generic.created,
            updated: sql<string>`COALESCE(MAX(${ProfileChat.created}), ${this.generic.updated})`,
            type: this.generic.type,
            name: this.generic.name,
            parent: this.generic.parent,
            members: this.generic.members,
            hierarchy: this.generic.hierarchy,
            last_read: this.generic.last_read,
            unread: sql<number>`(COUNT(*) FILTER (WHERE ${ProfileChat.read} = False))::INT`,
        }).from(this.generic)
            .leftJoin(ProfileChat, and(
                eq(ProfileChat.username, this.generic.username),
                eq(ProfileChat.chatroom, this.generic.id),
            ))
            .where(eq(this.generic.username, username))
            .groupBy(this.generic.username, this.generic.id);
    }

    /**
     * Record the newest message the user has seen, returning the Chatroom
     */
    async seen(username: string, id: string, message_id: string): Promise<Chatroom> {
        const rooms = await this.pool.update(this.generic)
            .set({
                last_read: sql<string>`(
                    SELECT created
                        FROM profile_chats
                        WHERE username = ${username}
                            AND chatroom = ${id}
                            AND message_id = ${message_id}
                )`,
            })
            .where(sql`
                ${this.generic.username} = ${username}
                AND ${this.generic.id} = ${id}
                AND EXISTS (
                    SELECT 1
                        FROM profile_chats
                        WHERE username = ${username}
                            AND chatroom = ${id}
                            AND message_id = ${message_id}
                )
            `)
            .returning();

        if (!rooms.length) throw new Err(404, null, 'Chat Not Found in Chatroom');

        return rooms[0];
    }

    async remove(username: string, id: string): Promise<void> {
        await this.pool.delete(this.generic)
            .where(and(
                eq(this.generic.username, username),
                eq(this.generic.id, id),
            ));
    }
}
