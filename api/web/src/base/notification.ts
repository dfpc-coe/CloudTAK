import { db } from './database.ts'
import type { DBNotification } from './database.ts';
import { v4 as randomUUID } from 'uuid';

export default class TAKNotification {
    id: string;
    type: string;
    name: string;
    body: string;
    url: string;
    created: string;
    toast: boolean;
    read: boolean;

    constructor(
        id: string,
        type: string,
        name: string,
        body: string,
        url: string,
        opts?: {
            read?: boolean,
            toast?: boolean,
            created?: string
        }
    ) {
        this.id = id;
        this.type = type;
        this.name = name;
        this.body = body;
        this.url = url;
        this.created = opts?.created || new Date().toISOString();
        this.toast = opts?.toast || false;
        this.read = opts?.read || false;
    }

    /**
     * Return a Notification instance if one already exists in the local DB,
     */
    static async from(
        id: string
    ): Promise<TAKNotification | null> {
        const exists = await db.notification
            .get(id)

        if (!exists) {
            return null;
        }

        return new TAKNotification(
            exists.id,
            exists.type,
            exists.name,
            exists.body,
            exists.url,
            {
                read: exists.read,
                toast: exists.toast,
                created: exists.created
            }
        );
    }

    static async create(
        type: string,
        name: string,
        body: string,
        url: string,
        toast?: boolean
    ): Promise<TAKNotification> {
        const id = randomUUID();

        const notification = new TAKNotification(
            id,
            type,
            name,
            body,
            url,
            {
                created: new Date().toISOString(),
                toast: toast || false,
                read: false
            }
        );

        await db.notification.add({
            id: notification.id,
            type: notification.type,
            name: notification.name,
            body: notification.body,
            url: notification.url,
            created: notification.created,
            toast: notification.toast,
            read: notification.read
        });

        return notification;
    }

    static async update(id: string, opts: {
        read?: boolean,
        toast?: boolean
    }): Promise<void> {
        const n = await TAKNotification.from(id);
        await n?.update(opts);
    }

    async update(opts: {
        read?: boolean
        toast?: boolean
    }): Promise<void> {
        await db.notification.put({
            id: this.id,
            type: this.type,
            name: this.name,
            body: this.body,
            url: this.url,
            created: this.created,
            toast: opts.toast ?? this.toast,
            read: opts.read ?? this.read
        });
    }

    async popup(): Promise<void> {
        if ('Notification' in self && Notification && Notification.permission !== 'denied') {
            const n = new Notification(this.name, {
                body: this.body
            });

            n.onclick = (event) => {
                event.preventDefault(); // prevent the browser from focusing the Notification's tab
            };
        }
    }

    static async clear(): Promise<void> {
        await db.notification.clear();
    }

    async delete(): Promise<void> {
        await db.notification.delete(this.id);
    }

    static async count(): Promise<number> {
        const collection = await db.notification.toCollection();

        return await collection
            .count();
    }

    static async list(): Promise<DBNotification[]> {
        const collection = await db.notification.toCollection();

        return await collection
            .sortBy('created');
    }
}
