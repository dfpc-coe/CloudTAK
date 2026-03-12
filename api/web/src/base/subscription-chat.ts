import { db } from './database.ts';
import type { DBSubscriptionChat } from './database.ts';
import { liveQuery, type Observable } from 'dexie';
import type Atlas from '../workers/atlas.ts';
import type { Remote } from 'comlink';

/**
 * High Level Wrapper around Mission Chat messages stored in the local Dexie DB.
 *
 * Chat messages are CoT features with type `b-t-f` that arrive via the mission
 * feature endpoint. They are stored separately from map features so they can be
 * queried and displayed as a chronological chat thread.
 */
export default class SubscriptionChat {
    guid: string;
    name: string;

    constructor(guid: string, name: string) {
        this.guid = guid;
        this.name = name;
    }

    liveUnreadCount(): Observable<number> {
        return liveQuery(async () => {
            return await db.subscription_chat
                .where('mission')
                .equals(this.guid)
                .filter(c => c.unread === true)
                .count();
        });
    }

    async list(): Promise<Array<DBSubscriptionChat>> {
        const chats = await db.subscription_chat
            .where('mission')
            .equals(this.guid)
            .toArray();

        chats.sort((a, b) => {
            return new Date(a.created).getTime() - new Date(b.created).getTime();
        });

        return chats;
    }

    async read(): Promise<void> {
        await db.subscription_chat
            .where('mission')
            .equals(this.guid)
            .modify({ unread: false });
    }

    async send(
        message: string,
        sender: { uid: string; callsign: string },
        worker: Remote<Atlas>
    ): Promise<void> {
        const id = crypto.randomUUID();
        const created = new Date().toISOString();

        await db.subscription_chat.put({
            id: id,
            mission: this.guid,
            chatroom: this.name,
            sender: sender.callsign,
            sender_uid: sender.uid,
            message: message,
            created: created,
            unread: false,
        });

        const location = (await worker.profile?.location)?.coordinates || [0, 0];

        await worker.conn.sendCOT({
            chatroom: this.name,
            parent: 'DataSyncMissionsList',
            from: {
                uid: sender.uid,
                callsign: sender.callsign
            },
            to: {
                uid: this.name,
                callsign: this.name
            },
            mission: this.name,
            message: message,
            messageId: id,
            time: created,
            location
        }, 'chat');
    }
}
