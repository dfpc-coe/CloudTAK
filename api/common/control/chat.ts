import Err from '@openaddresses/batch-error';
import { randomUUID } from 'node:crypto';
import { sql, eq, and, inArray } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import type CoT from '@tak-ps/node-cot';
import type { HubConfig } from './import.js';
import { profileUid, profileCallsign } from './takserver.js';
import {
    Chatroom, ChatroomExternal, ChatroomMember, ChatMessage, ChatMessageExternal,
    ChatMessageReceipt, ChatReaction, Profile,
} from '../schema.js';
import { ChatroomType, ChatMemberRole, ChatMessageStatus } from '../enums.js';
import type { ChatMember, ChatMessageMetadata, ChatroomExternalMetadata } from '../types.js';
import * as TAK from '../chat/tak.js';
import type { GeoChatFeature } from '../chat/tak.js';

const UidPrefix = profileUid('');

const StatusRank: Record<ChatMessageStatus, number> = {
    [ChatMessageStatus.SENT]: 1,
    [ChatMessageStatus.PENDING]: 2,
    [ChatMessageStatus.FAILED]: 3,
    [ChatMessageStatus.DELIVERED]: 4,
    [ChatMessageStatus.READ]: 5,
};

export type Room = InferSelectModel<typeof Chatroom>;
export type Member = InferSelectModel<typeof ChatroomMember>;
export type Message = InferSelectModel<typeof ChatMessage>;

export type RoomView = {
    id: string;
    type: ChatroomType;
    name: string;
    created: string;
    updated: string;
    role: ChatMemberRole;
    muted: boolean;
    unread: number;
    last_read: string | null;
    members: Array<{ uid: string; callsign: string; role: ChatMemberRole; local: boolean }>;
};

export type MessageView = {
    id: string;
    chatroom: string;
    created: string;
    updated: string;
    sender_uid: string;
    sender_callsign: string;
    body: string;
    reply_to: string | null;
    metadata: ChatMessageMetadata;
    edited: string | null;
    deleted: string | null;
    status: ChatMessageStatus | null;
    reactions: Array<{ emoji: string; uids: Array<string> }>;
};

export type SendInput = {
    id?: string;
    body: string;
    reply_to?: string;
    metadata?: ChatMessageMetadata;
};

function directKey(a: string, b: string): string {
    return `direct:${[a, b].sort().join('|')}`;
}

function broadcastKey(username: string): string {
    return `broadcast:${username}`;
}

/** ISO 8601 text straight from Postgres - timestamps parsed by the driver take on the offset of the host */
function iso(column: unknown) {
    return sql<string>`to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
}

/**
 * Chatrooms, their Members & Messages
 *
 * CloudTAK is the system of record. Members that are users of this server are reached
 * over their WebSocket sessions, every other Member through GeoChat on the TAK Server
 */
export default class ChatControl {
    config: HubConfig;

    constructor(config: HubConfig) {
        this.config = config;
    }

    get db() {
        return this.config.models.Chatroom.pool;
    }

    async identity(username: string): Promise<ChatMember & { username: string }> {
        return {
            username,
            uid: profileUid(username),
            callsign: await profileCallsign(this.config, username),
        };
    }

    /** Usernames of the given UIDs that belong to users of this server */
    async locals(uids: Array<string>): Promise<Map<string, string>> {
        const candidates = uids
            .filter((uid) => uid.startsWith(UidPrefix))
            .map((uid) => uid.slice(UidPrefix.length));

        if (!candidates.length) return new Map();

        const profiles = await this.db.select({ username: Profile.username })
            .from(Profile)
            .where(inArray(Profile.username, candidates));

        return new Map(profiles.map((profile) => [profileUid(profile.username), profile.username]));
    }

    async members(chatroom: string): Promise<Array<Member>> {
        return await this.db.select()
            .from(ChatroomMember)
            .where(eq(ChatroomMember.chatroom, chatroom))
            .orderBy(ChatroomMember.id);
    }

    async member(username: string, chatroom: string): Promise<Member> {
        const members = await this.db.select()
            .from(ChatroomMember)
            .where(and(
                eq(ChatroomMember.chatroom, chatroom),
                eq(ChatroomMember.username, username),
            ));

        if (!members.length) throw new Err(404, null, 'Chatroom Not Found');

        return members[0];
    }

    async room(id: string): Promise<Room> {
        const rooms = await this.db.select().from(Chatroom).where(eq(Chatroom.id, id));
        if (!rooms.length) throw new Err(404, null, 'Chatroom Not Found');
        return rooms[0];
    }

    async external(chatroom: string): Promise<{ id: string; metadata: ChatroomExternalMetadata } | undefined> {
        const externals = await this.db.select()
            .from(ChatroomExternal)
            .where(and(
                eq(ChatroomExternal.chatroom, chatroom),
                eq(ChatroomExternal.system, TAK.TAKSystem),
            ));

        return externals.length ? { id: externals[0].external_id, metadata: externals[0].metadata } : undefined;
    }

    /**
     * Add Members to a Chatroom, refreshing the callsign of those already in it
     */
    async join(
        chatroom: string,
        members: Array<ChatMember & { role?: ChatMemberRole }>,
    ): Promise<void> {
        if (!members.length) return;

        const locals = await this.locals(members.map((member) => member.uid));

        for (const member of members) {
            const named = !!member.callsign && member.callsign !== member.uid;

            const insert = this.db.insert(ChatroomMember).values({
                chatroom,
                uid: member.uid,
                callsign: member.callsign || member.uid,
                username: locals.get(member.uid) ?? null,
                role: member.role ?? ChatMemberRole.MEMBER,
            });

            if (named || member.role) {
                await insert.onConflictDoUpdate({
                    target: [ChatroomMember.chatroom, ChatroomMember.uid],
                    set: {
                        ...(named ? { callsign: member.callsign } : {}),
                        ...(member.role ? { role: member.role } : {}),
                    },
                });
            } else {
                await insert.onConflictDoNothing();
            }
        }
    }

    /**
     * The 1:1 Chatroom between a user and anyone else, created on first use
     *
     * A Chatroom that predates UID keyed Chatrooms is keyed by callsign
     * and is adopted by the first use that reveals the UID behind it
     */
    async direct(me: ChatMember, peer: ChatMember): Promise<Room> {
        if (me.uid === peer.uid) throw new Err(400, null, 'A Direct Chatroom needs another Member');

        const key = directKey(me.uid, peer.uid);
        let rooms = await this.db.select().from(Chatroom).where(eq(Chatroom.key, key));

        if (!rooms.length && peer.callsign && peer.callsign !== peer.uid) {
            const legacy = directKey(me.uid, peer.callsign);

            rooms = await this.db.update(Chatroom)
                .set({ key })
                .where(eq(Chatroom.key, legacy))
                .returning();

            if (rooms.length) {
                await this.db.update(ChatroomMember)
                    .set({ uid: peer.uid })
                    .where(and(
                        eq(ChatroomMember.chatroom, rooms[0].id),
                        eq(ChatroomMember.uid, peer.callsign),
                    ));
            }
        }

        if (!rooms.length) {
            rooms = await this.db.insert(Chatroom)
                .values({ type: ChatroomType.DIRECT, key })
                .onConflictDoUpdate({ target: Chatroom.key, set: { key } })
                .returning();
        }

        await this.join(rooms[0].id, [me, peer]);

        return rooms[0];
    }

    /**
     * A user's own view of `All Chat Rooms` - who a broadcast reaches is decided by the
     * TAK Server Channels of its sender so the room is never shared between users
     */
    async broadcast(me: ChatMember & { username: string }): Promise<Room> {
        const key = broadcastKey(me.username);

        const rooms = await this.db.insert(Chatroom)
            .values({ type: ChatroomType.BROADCAST, name: TAK.BroadcastChatroom, key })
            .onConflictDoUpdate({ target: Chatroom.key, set: { key } })
            .returning();

        await this.join(rooms[0].id, [me]);

        return rooms[0];
    }

    /**
     * Create a Group owned by a user of this server
     */
    async group(username: string, input: { name: string; members: Array<ChatMember> }): Promise<RoomView> {
        const me = await this.identity(username);

        const rooms = await this.db.insert(Chatroom)
            .values({ type: ChatroomType.GROUP, name: input.name })
            .returning();

        await this.db.insert(ChatroomExternal).values({
            chatroom: rooms[0].id,
            system: TAK.TAKSystem,
            external_id: rooms[0].id,
            metadata: { parent: 'UserGroups' },
        });

        await this.join(rooms[0].id, [
            { ...me, role: ChatMemberRole.OWNER },
            ...input.members.filter((member) => member.uid !== me.uid),
        ]);

        await this.notifyRoom(rooms[0].id);

        return await this.view(username, rooms[0].id);
    }

    async views(username: string, id?: string): Promise<Array<RoomView>> {
        const rows = await this.db.execute<{
            id: string;
            type: ChatroomType;
            name: string;
            created: string;
            updated: string;
            role: ChatMemberRole;
            muted: boolean;
            last_read: string | null;
            unread: number;
            visible: number;
        }>(sql`
            SELECT
                room.id,
                room.type,
                room.name,
                ${iso(sql`room.created`)} AS created,
                ${iso(sql`room.updated`)} AS updated,
                me.role,
                me.muted,
                ${iso(sql`me.last_read`)} AS last_read,
                (
                    SELECT COUNT(*)
                        FROM chat_message message
                        WHERE message.chatroom = room.id
                            AND message.created >= me.joined
                            AND message.created > COALESCE(me.last_read, me.joined)
                            AND message.sender_uid <> me.uid
                            AND message.deleted IS NULL
                )::INT AS unread,
                (
                    SELECT COUNT(*)
                        FROM chat_message message
                        WHERE message.chatroom = room.id
                            AND message.created >= me.joined
                )::INT AS visible
            FROM
                chatroom_member me
                    INNER JOIN chatroom room
                        ON room.id = me.chatroom
            WHERE
                me.username = ${username}
                AND (${id ?? null}::UUID IS NULL OR room.id = ${id ?? null}::UUID)
            ORDER BY
                room.updated DESC
        `);

        if (!rows.length) return [];

        const members = await this.db.select()
            .from(ChatroomMember)
            .where(inArray(ChatroomMember.chatroom, rows.map((row) => row.id)))
            .orderBy(ChatroomMember.id);

        const uid = profileUid(username);

        return rows
            // A Direct Chatroom the user cleared stays out of the way until it is used again
            .filter((row) => id || row.type !== ChatroomType.DIRECT || row.visible > 0 || row.last_read === null)
            .map((row) => {
                const roster = members.filter((member) => member.chatroom === row.id);
                const peer = roster.find((member) => member.uid !== uid);

                return {
                    id: row.id,
                    type: row.type,
                    name: row.type === ChatroomType.DIRECT ? (peer?.callsign ?? row.name) : row.name,
                    created: row.created,
                    updated: row.updated,
                    role: row.role,
                    muted: row.muted,
                    unread: row.unread,
                    last_read: row.last_read,
                    members: roster.map((member) => ({
                        uid: member.uid,
                        callsign: member.callsign,
                        role: member.role,
                        local: member.username !== null,
                    })),
                };
            });
    }

    async list(username: string): Promise<Array<RoomView>> {
        await this.broadcast(await this.identity(username));
        return await this.views(username);
    }

    async view(username: string, id: string): Promise<RoomView> {
        const views = await this.views(username, id);
        if (!views.length) throw new Err(404, null, 'Chatroom Not Found');
        return views[0];
    }

    async update(
        username: string,
        id: string,
        input: { name?: string; muted?: boolean; last_read?: string },
    ): Promise<RoomView> {
        const member = await this.member(username, id);
        const room = await this.room(id);

        if (input.name !== undefined) {
            if (room.type !== ChatroomType.GROUP || member.role !== ChatMemberRole.OWNER) {
                throw new Err(403, null, 'Only the owner of a Group can rename it');
            }

            await this.db.update(Chatroom).set({ name: input.name }).where(eq(Chatroom.id, id));
        }

        if (input.muted !== undefined) {
            await this.db.update(ChatroomMember).set({ muted: input.muted }).where(eq(ChatroomMember.id, member.id));
        }

        if (input.last_read !== undefined) await this.read(member, room, input.last_read);

        if (input.name !== undefined) await this.notifyRoom(id);

        return await this.view(username, id);
    }

    /**
     * Record the newest Message a Member has seen and tell the senders of what that covers
     */
    private async read(member: Member, room: Room, message: string): Promise<void> {
        const seen = await this.db.select({ id: ChatMessage.id })
            .from(ChatMessage)
            .where(and(eq(ChatMessage.chatroom, room.id), eq(ChatMessage.id, message)));

        if (!seen.length) throw new Err(404, null, 'Message Not Found in Chatroom');

        const at = sql`(SELECT created FROM chat_message WHERE id = ${message})`;

        await this.db.update(ChatroomMember)
            .set({ last_read: at })
            .where(and(
                eq(ChatroomMember.id, member.id),
                sql`COALESCE(${ChatroomMember.last_read}, '-infinity') < ${at}`,
            ));

        const unread = await this.db.execute<{ id: string; sender_uid: string; sender_callsign: string }>(sql`
            SELECT message.id, message.sender_uid, message.sender_callsign
                FROM chat_message message
                    INNER JOIN chatroom_member me
                        ON me.id = ${member.id}
                WHERE message.chatroom = ${room.id}
                    AND message.created <= ${at}
                    AND message.created >= me.joined
                    AND message.sender_uid <> me.uid
                    AND NOT EXISTS (
                        SELECT 1
                            FROM chat_message_receipt receipt
                            WHERE receipt.message = message.id
                                AND receipt.uid = me.uid
                                AND receipt.read IS NOT NULL
                    )
        `);

        if (!unread.length) return;

        await this.db.insert(ChatMessageReceipt)
            .values(unread.map((row) => ({ message: row.id, uid: member.uid, read: sql<string>`Now()` })))
            .onConflictDoUpdate({
                target: [ChatMessageReceipt.message, ChatMessageReceipt.uid],
                set: { read: sql`Now()` },
            });

        // Receipts are only exchanged for 1:1 chats, matching ATAK
        if (room.type !== ChatroomType.DIRECT || !member.username) return;

        const locals = await this.locals(unread.map((row) => row.sender_uid));
        const me = { uid: member.uid, callsign: member.callsign };
        const receipts: Array<CoT> = [];

        for (const row of unread) {
            await this.status(row.id, ChatMessageStatus.READ);

            if (locals.has(row.sender_uid)) continue;

            const externals = await this.db.select()
                .from(ChatMessageExternal)
                .where(and(
                    eq(ChatMessageExternal.message, row.id),
                    eq(ChatMessageExternal.system, TAK.TAKSystem),
                ));

            receipts.push(TAK.directReceipt(
                me,
                { uid: row.sender_uid, callsign: row.sender_callsign },
                'read',
                externals.length ? externals[0].external_id : row.id,
            ));
        }

        if (receipts.length) {
            await this.config.hub.submitCots({ connection: member.username, ifPooled: true, cots: receipts });
        }
    }

    /**
     * Replace the Members of a Group - only its owner can
     */
    async roster(username: string, id: string, members: Array<ChatMember>): Promise<RoomView> {
        const me = await this.member(username, id);
        const room = await this.room(id);

        if (room.type !== ChatroomType.GROUP || me.role !== ChatMemberRole.OWNER) {
            throw new Err(403, null, 'Only the owner of a Group can change its Members');
        }

        const before = await this.members(id);
        const keep = new Set([me.uid, ...members.map((member) => member.uid)]);
        const removed = before.filter((member) => !keep.has(member.uid));

        if (removed.length) {
            await this.db.delete(ChatroomMember).where(inArray(ChatroomMember.id, removed.map((member) => member.id)));
        }

        await this.join(id, members.filter((member) => member.uid !== me.uid));

        for (const member of removed) {
            if (member.username) this.notify(member.username, { type: 'chatroom:delete', data: { id } });
        }

        await this.notifyRoom(id);

        // The owner's GeoChat carries the membership that TAK clients replace theirs with
        await this.announce(me, room, [...before, ...await this.members(id)]);

        return await this.view(username, id);
    }

    /**
     * Leave a Chatroom. The owner of a Group deletes it for everyone, a Direct
     * or Broadcast Chatroom is cleared for the user and returns with its next Message
     */
    async leave(username: string, id: string): Promise<void> {
        const me = await this.member(username, id);
        const room = await this.room(id);

        if (room.type !== ChatroomType.GROUP) {
            await this.db.update(ChatroomMember)
                .set({ joined: sql`Now()`, last_read: sql`Now()` })
                .where(eq(ChatroomMember.id, me.id));

            this.notify(username, { type: 'chatroom:delete', data: { id } });
            return;
        }

        const members = await this.members(id);

        if (me.role === ChatMemberRole.OWNER) {
            const external = await this.external(id);

            if (external && members.some((member) => !member.username)) {
                try {
                    await this.config.hub.submitCots({
                        connection: username,
                        ifPooled: true,
                        cots: [TAK.groupDelete(me, { id: external.id, name: room.name }, members, external.metadata, randomUUID())],
                    });
                } catch (err) {
                    console.error(`Error: Failed to announce deletion of Chatroom ${id}:`, err);
                }
            }

            await this.db.delete(Chatroom).where(eq(Chatroom.id, id));

            for (const member of members) {
                if (member.username) this.notify(member.username, { type: 'chatroom:delete', data: { id } });
            }

            return;
        }

        await this.db.delete(ChatroomMember).where(eq(ChatroomMember.id, me.id));

        this.notify(username, { type: 'chatroom:delete', data: { id } });
        await this.notifyRoom(id);
    }

    async messageViews(ids: Array<string>): Promise<Array<MessageView>> {
        if (!ids.length) return [];

        const rows = await this.db.execute<Omit<MessageView, 'reactions'>>(sql`
            SELECT
                message.id,
                message.chatroom,
                ${iso(sql`message.created`)} AS created,
                ${iso(sql`message.updated`)} AS updated,
                message.sender_uid,
                message.sender_callsign,
                CASE WHEN message.deleted IS NULL THEN message.body ELSE '' END AS body,
                message.reply_to,
                CASE WHEN message.deleted IS NULL THEN message.metadata ELSE '{}'::JSONB END AS metadata,
                ${iso(sql`message.edited`)} AS edited,
                ${iso(sql`message.deleted`)} AS deleted,
                message.status
            FROM
                chat_message message
            WHERE
                message.id IN ${ids}
            ORDER BY
                message.created DESC,
                message.id
        `);

        const reactions = await this.db.select()
            .from(ChatReaction)
            .where(inArray(ChatReaction.message, ids))
            .orderBy(ChatReaction.created);

        return rows.map((row) => {
            const grouped = new Map<string, Array<string>>();

            for (const reaction of reactions) {
                if (reaction.message !== row.id) continue;
                grouped.set(reaction.emoji, [...(grouped.get(reaction.emoji) ?? []), reaction.uid]);
            }

            return {
                ...row,
                reactions: [...grouped.entries()].map(([emoji, uids]) => ({ emoji, uids })),
            };
        });
    }

    async messageView(id: string): Promise<MessageView> {
        const views = await this.messageViews([id]);
        if (!views.length) throw new Err(404, null, 'Message Not Found');
        return views[0];
    }

    /**
     * Messages of a Chatroom the user can see, newest first
     *
     * @param opts.before - Only Messages created before this Message
     * @param opts.since  - Only Messages changed after this time, for incremental sync
     */
    async messages(
        username: string,
        id: string,
        opts: { limit: number; before?: string; since?: string; filter?: string },
    ): Promise<{ total: number; items: Array<MessageView> }> {
        const me = await this.member(username, id);

        const where = sql`
            ${ChatMessage.chatroom} = ${id}
            AND ${ChatMessage.created} >= (SELECT joined FROM chatroom_member WHERE id = ${me.id})
            AND (${opts.before ?? null}::UUID IS NULL OR ${ChatMessage.created} < (
                SELECT created FROM chat_message WHERE id = ${opts.before ?? null}::UUID
            ))
            AND (${opts.since ?? null}::TIMESTAMPTZ IS NULL OR ${ChatMessage.updated} > ${opts.since ?? null}::TIMESTAMPTZ)
            AND (${opts.filter ?? null}::TEXT IS NULL OR (
                ${ChatMessage.deleted} IS NULL
                AND ${ChatMessage.body} ILIKE '%' || ${opts.filter ?? null}::TEXT || '%'
            ))
        `;

        const total = await this.db.select({ count: sql<number>`COUNT(*)::INT` }).from(ChatMessage).where(where);

        const rows = await this.db.select({ id: ChatMessage.id })
            .from(ChatMessage)
            .where(where)
            .orderBy(sql`${ChatMessage.created} DESC`)
            .limit(opts.limit);

        return { total: total[0].count, items: await this.messageViews(rows.map((row) => row.id)) };
    }

    /**
     * Store a Message once and deliver it to every Member
     */
    async send(username: string, id: string, input: SendInput): Promise<MessageView> {
        const me = await this.member(username, id);
        const room = await this.room(id);

        if (input.id) {
            const existing = await this.db.select().from(ChatMessage).where(eq(ChatMessage.id, input.id));

            if (existing.length) {
                if (existing[0].chatroom !== id || existing[0].sender_uid !== me.uid) {
                    throw new Err(400, null, 'Message ID is already in use');
                }

                // A retry of a Message that did not reach the TAK Server
                if (existing[0].status === ChatMessageStatus.FAILED) {
                    await this.db.update(ChatMessage)
                        .set({ status: null })
                        .where(eq(ChatMessage.id, input.id));

                    return await this.deliver(me, room, existing[0]);
                }

                return await this.messageView(input.id);
            }
        }

        if (input.reply_to) {
            const parent = await this.db.select({ id: ChatMessage.id })
                .from(ChatMessage)
                .where(and(eq(ChatMessage.id, input.reply_to), eq(ChatMessage.chatroom, id)));

            if (!parent.length) throw new Err(400, null, 'Message being replied to is not in this Chatroom');
        }

        const callsign = await profileCallsign(this.config, username);

        const stored = await this.db.transaction(async (tx) => {
            const messages = await tx.insert(ChatMessage)
                .values({
                    ...(input.id ? { id: input.id } : {}),
                    chatroom: id,
                    sender_uid: me.uid,
                    sender_callsign: callsign,
                    body: input.body,
                    reply_to: input.reply_to ?? null,
                    metadata: input.metadata ?? {},
                })
                .returning();

            await tx.insert(ChatMessageExternal).values({
                message: messages[0].id,
                chatroom: id,
                system: TAK.TAKSystem,
                external_id: messages[0].id,
            });

            const at = sql`(SELECT created FROM chat_message WHERE id = ${messages[0].id})`;

            await tx.update(Chatroom).set({ updated: at }).where(eq(Chatroom.id, id));

            await tx.update(ChatroomMember)
                .set({ last_read: at, callsign })
                .where(eq(ChatroomMember.id, me.id));

            return messages[0];
        });

        return await this.deliver({ ...me, callsign }, room, stored);
    }

    /**
     * What TAK clients are shown for a Message - anything GeoChat cannot express becomes plain text
     */
    private async plain(message: Message): Promise<string> {
        if (!message.reply_to) return message.body;

        const parents = await this.db.select().from(ChatMessage).where(eq(ChatMessage.id, message.reply_to));
        if (!parents.length || parents[0].deleted) return message.body;

        const quote = parents[0].body.length > 80 ? `${parents[0].body.slice(0, 77)}...` : parents[0].body;

        return `> ${parents[0].sender_callsign}: ${quote.replace(/\s+/g, ' ')}\n${message.body}`;
    }

    private async geochat(me: Member, room: Room, members: Array<Member>, message: Message): Promise<CoT | undefined> {
        const from = { uid: me.uid, callsign: me.callsign };
        const body = await this.plain(message);

        if (room.type === ChatroomType.BROADCAST) return TAK.broadcastChat(from, body, message.id);

        const externals = members.filter((member) => !member.username);
        if (!externals.length) return undefined;

        if (room.type === ChatroomType.DIRECT) {
            return TAK.directChat(from, { uid: externals[0].uid, callsign: externals[0].callsign }, body, message.id);
        }

        const external = await this.external(room.id);
        if (!external) return undefined;

        return TAK.groupChat(from, { id: external.id, name: room.name }, members, external.metadata, body, message.id, {
            owner: me.role === ChatMemberRole.OWNER,
        });
    }

    private async deliver(me: Member, room: Room, message: Message): Promise<MessageView> {
        const members = await this.members(room.id);

        let status = ChatMessageStatus.SENT;

        try {
            const cot = await this.geochat(me, room, members, message);

            if (cot && me.username) {
                const location = message.metadata.location;
                if (location && (location[0] !== 0 || location[1] !== 0)) cot.position([location[0], location[1]]);

                await this.config.hub.submitCots({
                    connection: me.username,
                    cots: [cot],
                    ensureProfile: true,
                    confirm: true,
                });
            }
        } catch (err) {
            console.error(`Error: Failed to send Message ${message.id} to the TAK Server:`, err);
            status = ChatMessageStatus.FAILED;
        }

        await this.db.update(ChatMessage)
            .set({ status })
            .where(and(
                eq(ChatMessage.id, message.id),
                sql`COALESCE(${ChatMessage.status}, '') IN ('', 'sent', 'failed')`,
            ));

        const view = await this.messageView(message.id);

        // A Message that did not reach the TAK Server is only shown to its sender, who can retry it
        const audience = status === ChatMessageStatus.FAILED && members.some((member) => !member.username)
            ? members.filter((member) => member.id === me.id)
            : members;

        await this.notifyMessage(room, audience, view, 'chat');

        return view;
    }

    /** Tell TAK clients the membership of a Group its owner changed */
    private async announce(me: Member, room: Room, audience: Array<Member>): Promise<void> {
        if (!me.username || !audience.some((member) => !member.username)) return;

        const external = await this.external(room.id);
        if (!external) return;

        const members = await this.members(room.id);
        const dests = new Map(audience.map((member) => [member.uid, member]));

        try {
            const cot = TAK.groupChat(
                me,
                { id: external.id, name: room.name },
                members,
                external.metadata,
                `${me.callsign} updated the members of ${room.name}`,
                randomUUID(),
                { owner: true },
            );

            // Members that were removed are told as well, they are no longer in the hierarchy
            for (const member of dests.values()) {
                if (member.uid !== me.uid && !members.some((m) => m.uid === member.uid)) cot.addDest({ uid: member.uid });
            }

            await this.config.hub.submitCots({ connection: me.username, ifPooled: true, cots: [cot] });
        } catch (err) {
            console.error(`Error: Failed to announce Members of Chatroom ${room.id}:`, err);
        }
    }

    private async own(username: string, id: string, message: string): Promise<{ me: Member; room: Room; row: Message }> {
        const me = await this.member(username, id);
        const room = await this.room(id);

        const rows = await this.db.select()
            .from(ChatMessage)
            .where(and(eq(ChatMessage.id, message), eq(ChatMessage.chatroom, id)));

        if (!rows.length || new Date(rows[0].created) < new Date(me.joined)) throw new Err(404, null, 'Message Not Found');

        return { me, room, row: rows[0] };
    }

    async edit(username: string, id: string, message: string, body: string): Promise<MessageView> {
        const { me, room, row } = await this.own(username, id, message);

        if (row.sender_uid !== me.uid) throw new Err(403, null, 'Only the sender can edit a Message');
        if (row.deleted) throw new Err(400, null, 'Message has been deleted');

        await this.db.update(ChatMessage)
            .set({ body, edited: sql`Now()`, updated: sql`Now()` })
            .where(eq(ChatMessage.id, message));

        return await this.changed(room, message);
    }

    async remove(username: string, id: string, message: string): Promise<MessageView> {
        const { me, room, row } = await this.own(username, id, message);

        if (row.sender_uid !== me.uid) throw new Err(403, null, 'Only the sender can delete a Message');

        await this.db.update(ChatMessage)
            .set({ deleted: sql`Now()`, updated: sql`Now()` })
            .where(eq(ChatMessage.id, message));

        await this.db.delete(ChatReaction).where(eq(ChatReaction.message, message));

        return await this.changed(room, message);
    }

    async react(username: string, id: string, message: string, emoji: string, on: boolean): Promise<MessageView> {
        const { me, room, row } = await this.own(username, id, message);

        if (row.deleted) throw new Err(400, null, 'Message has been deleted');

        if (on) {
            await this.db.insert(ChatReaction)
                .values({ message, uid: me.uid, emoji })
                .onConflictDoNothing();
        } else {
            await this.db.delete(ChatReaction).where(and(
                eq(ChatReaction.message, message),
                eq(ChatReaction.uid, me.uid),
                eq(ChatReaction.emoji, emoji),
            ));
        }

        await this.db.update(ChatMessage).set({ updated: sql`Now()` }).where(eq(ChatMessage.id, message));

        return await this.changed(room, message);
    }

    private async changed(room: Room, message: string): Promise<MessageView> {
        const view = await this.messageView(message);
        await this.notifyMessage(room, await this.members(room.id), view, 'chat:update');
        return view;
    }

    /** Move the delivery status of a Message forward, never back */
    private async status(message: string, status: ChatMessageStatus): Promise<boolean> {
        const rows = await this.db.select().from(ChatMessage).where(eq(ChatMessage.id, message));
        if (!rows.length) return false;

        if (StatusRank[status] <= (rows[0].status ? StatusRank[rows[0].status] : 0)) return false;

        await this.db.update(ChatMessage)
            .set({ status, updated: sql`Now()` })
            .where(eq(ChatMessage.id, message));

        const room = await this.room(rows[0].chatroom);
        await this.changed(room, message);

        return true;
    }

    notify(username: string, payload: { type: string; data: unknown }): void {
        this.config.hub.wsNotify(username, { ...payload, connection: username }).catch((err) => {
            console.error(`Error: Failed to notify ${username} of ${payload.type}:`, err);
        });
    }

    private async notifyMessage(
        room: Room,
        members: Array<Member>,
        message: MessageView,
        type: 'chat' | 'chat:update',
    ): Promise<void> {
        const sender = members.find((member) => member.uid === message.sender_uid);

        for (const member of members) {
            if (!member.username) continue;

            // Delivery status is only of interest to whoever sent the Message
            const own = member.uid === message.sender_uid;

            this.notify(member.username, {
                type,
                data: {
                    message: own ? message : { ...message, status: null },
                    chatroom: {
                        id: room.id,
                        type: room.type,
                        name: room.type === ChatroomType.DIRECT
                            ? (members.find((m) => m.uid !== member.uid)?.callsign ?? sender?.callsign ?? room.name)
                            : room.name,
                        muted: member.muted,
                    },
                },
            });
        }
    }

    /** Push the current state of a Chatroom to every Member that is a user of this server */
    async notifyRoom(id: string): Promise<void> {
        for (const member of await this.members(id)) {
            if (!member.username) continue;

            try {
                this.notify(member.username, { type: 'chatroom', data: await this.view(member.username, id) });
            } catch (err) {
                console.error(`Error: Failed to notify ${member.username} of Chatroom ${id}:`, err);
            }
        }
    }

    /**
     * A Chat Receipt (b-t-f-d/r/p/s) received from the TAK Server for a Message a user sent
     */
    async receiptTAK(username: string, feat: GeoChatFeature, status: ChatMessageStatus, source?: string): Promise<void> {
        const messageId = feat.properties.chat?.messageId;
        if (!messageId) return;

        const me = profileUid(username);
        const sender = TAK.chatSender(feat, source);

        const rows = await this.db.execute<{ id: string }>(sql`
            SELECT message.id
                FROM chat_message_external external
                    INNER JOIN chat_message message
                        ON message.id = external.message
                    INNER JOIN chatroom_member member
                        ON member.chatroom = message.chatroom
                WHERE external.system = ${TAK.TAKSystem}
                    AND external.external_id = ${messageId}
                    AND member.username = ${username}
                    AND message.sender_uid = ${me}
        `);

        for (const row of rows) {
            if (sender.uid && (status === ChatMessageStatus.DELIVERED || status === ChatMessageStatus.READ)) {
                const column = status === ChatMessageStatus.READ ? 'read' : 'delivered';

                await this.db.insert(ChatMessageReceipt)
                    .values({ message: row.id, uid: sender.uid, [column]: sql<string>`Now()` })
                    .onConflictDoUpdate({
                        target: [ChatMessageReceipt.message, ChatMessageReceipt.uid],
                        set: { [column]: sql`Now()` },
                    });
            }

            await this.status(row.id, status);
        }
    }

    /**
     * A GeoChat received from the TAK Server on the connection of a user
     *
     * The same GeoChat arrives once per Member that is online - it is stored by whichever comes first
     */
    async ingestTAK(username: string, feat: GeoChatFeature, source?: string): Promise<MessageView | undefined> {
        const chat = feat.properties.chat;
        if (!chat) return undefined;

        const me = await this.identity(username);
        const sender = TAK.chatSender(feat, source);
        if (!sender.uid) return undefined;

        const own = sender.uid === me.uid;
        const messageId = TAK.chatMessageId(feat);
        const target = TAK.chatRoom(chat, sender, me.uid);

        if (chat.deleteChild) {
            if (!own) await this.deletedTAK(sender, chat.deleteChild);
            return undefined;
        }

        let room: Room;

        if (target.type === 'broadcast') {
            room = await this.broadcast(me);
        } else if (target.type === 'direct') {
            room = await this.direct(me, target.peer);
        } else {
            const joined = await this.groupTAK(me, sender, target, chat);
            if (!joined) return undefined;
            room = joined;
        }

        const body = (feat.properties.remarks || '').trim();

        // TAK Aware announces a change of Members with an empty Message
        if (!body) return undefined;

        const message = await this.store(room, sender, messageId, body);
        if (!message) return undefined;

        const members = await this.members(room.id);
        const view = await this.messageView(message.id);

        await this.notifyMessage(room, members, view, 'chat');

        if (room.type === ChatroomType.DIRECT && !own) {
            this.config.hub.submitCots({
                connection: username,
                ifPooled: true,
                cots: [TAK.directReceipt(me, sender, 'delivered', messageId)],
            }).catch((err) => {
                console.error(`Error: Failed to send Delivered Receipt for ${messageId}:`, err);
            });
        }

        return view;
    }

    /** Store a Message received from TAK unless another connection already did */
    private async store(room: Room, sender: ChatMember, external: string, body: string): Promise<Message | undefined> {
        return await this.db.transaction(async (tx) => {
            // Serialise per Chatroom so two connections receiving the same GeoChat cannot both store it
            await tx.execute(sql`SELECT 1 FROM chatroom WHERE id = ${room.id} FOR UPDATE`);

            const existing = await tx.select({ id: ChatMessageExternal.id })
                .from(ChatMessageExternal)
                .where(and(
                    eq(ChatMessageExternal.chatroom, room.id),
                    eq(ChatMessageExternal.system, TAK.TAKSystem),
                    eq(ChatMessageExternal.external_id, external),
                ));

            if (existing.length) return undefined;

            const messages = await tx.insert(ChatMessage)
                .values({
                    chatroom: room.id,
                    sender_uid: sender.uid,
                    sender_callsign: sender.callsign,
                    body,
                })
                .returning();

            await tx.insert(ChatMessageExternal).values({
                message: messages[0].id,
                chatroom: room.id,
                system: TAK.TAKSystem,
                external_id: external,
            });

            const at = sql`(SELECT created FROM chat_message WHERE id = ${messages[0].id})`;

            await tx.update(Chatroom).set({ updated: at }).where(eq(Chatroom.id, room.id));

            await tx.update(ChatroomMember)
                .set({ last_read: at })
                .where(and(eq(ChatroomMember.chatroom, room.id), eq(ChatroomMember.uid, sender.uid)));

            return messages[0];
        });
    }

    /**
     * The Chatroom of a Group GeoChat, created from the first Message that names it
     */
    private async groupTAK(
        me: ChatMember,
        sender: ChatMember,
        target: { id: string; name: string; parent?: string },
        chat: TAK.GeoChat,
    ): Promise<Room | undefined> {
        const { members, listed } = TAK.chatMembers(chat, sender);
        const owner = listed && chat.groupOwner === 'true';

        const externals = await this.db.select()
            .from(ChatroomExternal)
            .where(and(
                eq(ChatroomExternal.system, TAK.TAKSystem),
                eq(ChatroomExternal.external_id, target.id),
            ));

        if (!externals.length) {
            const room = await this.db.transaction(async (tx) => {
                const rooms = await tx.insert(Chatroom)
                    .values({ type: ChatroomType.GROUP, name: target.name })
                    .returning();

                const claimed = await tx.insert(ChatroomExternal)
                    .values({
                        chatroom: rooms[0].id,
                        system: TAK.TAKSystem,
                        external_id: target.id,
                        metadata: { parent: target.parent, hierarchy: chat.hierarchy },
                    })
                    .onConflictDoNothing()
                    .returning();

                if (!claimed.length) {
                    await tx.delete(Chatroom).where(eq(Chatroom.id, rooms[0].id));
                    return undefined;
                }

                return rooms[0];
            });

            if (!room) return await this.groupTAK(me, sender, target, chat);

            await this.join(room.id, [
                ...members.filter((member) => member.uid !== sender.uid && member.uid !== me.uid),
                { ...sender, role: chat.groupOwner === 'true' ? ChatMemberRole.OWNER : ChatMemberRole.MEMBER },
                ...(sender.uid === me.uid ? [] : [me]),
            ]);

            await this.notifyRoom(room.id);

            return room;
        }

        const room = await this.room(externals[0].chatroom);
        const before = await this.members(room.id);
        const known = before.find((member) => member.uid === sender.uid);

        // A Group owned by a user of this server takes its membership from them alone
        if (before.some((member) => member.role === ChatMemberRole.OWNER && member.username)) {
            return known ? room : undefined;
        }

        // The owner replaces the membership, anyone else can only add to it - matching ATAK
        const trusted = owner && known?.role === ChatMemberRole.OWNER;
        const keep = new Set([me.uid, sender.uid, ...members.map((member) => member.uid)]);
        const removed = trusted ? before.filter((member) => !keep.has(member.uid)) : [];
        const added = [me, ...members].filter((member) => !before.some((m) => m.uid === member.uid));
        const renamed = trusted && target.name !== room.name;

        if (removed.length) {
            await this.db.delete(ChatroomMember).where(inArray(ChatroomMember.id, removed.map((member) => member.id)));
        }

        await this.join(room.id, [me, ...members]);

        if (renamed) await this.db.update(Chatroom).set({ name: target.name }).where(eq(Chatroom.id, room.id));

        if (trusted && chat.hierarchy) {
            await this.db.update(ChatroomExternal)
                .set({ metadata: { parent: target.parent, hierarchy: chat.hierarchy } })
                .where(eq(ChatroomExternal.id, externals[0].id));
        }

        if (removed.length || added.length || renamed) {
            for (const member of removed) {
                if (member.username) this.notify(member.username, { type: 'chatroom:delete', data: { id: room.id } });
            }

            await this.notifyRoom(room.id);
        }

        return renamed ? await this.room(room.id) : room;
    }

    /** The owner of a Group announced over TAK that it was deleted */
    private async deletedTAK(sender: ChatMember, group: string): Promise<void> {
        const rows = await this.db.select({ chatroom: ChatroomExternal.chatroom, role: ChatroomMember.role })
            .from(ChatroomExternal)
            .innerJoin(ChatroomMember, eq(ChatroomMember.chatroom, ChatroomExternal.chatroom))
            .where(and(
                eq(ChatroomExternal.system, TAK.TAKSystem),
                eq(ChatroomExternal.external_id, group),
                eq(ChatroomMember.uid, sender.uid),
            ));

        if (!rows.length || rows[0].role !== ChatMemberRole.OWNER) return;

        const members = await this.members(rows[0].chatroom);

        await this.db.delete(Chatroom).where(eq(Chatroom.id, rows[0].chatroom));

        for (const member of members) {
            if (member.username) this.notify(member.username, { type: 'chatroom:delete', data: { id: rows[0].chatroom } });
        }
    }
}
