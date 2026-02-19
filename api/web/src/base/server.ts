import { db } from './database.ts';
import { liveQuery, type Observable } from 'dexie';
import { std, stdurl } from '../std.ts';
import type { Server, Server_Update } from '../types.ts';
import type { DBServer } from './database.ts';

export default class ServerManager {
    static live(): Observable<Server | undefined> {
        return liveQuery(async () => {
             const s = await db.server.get('server');
             return s;
        });
    }

    static async get(token?: string): Promise<Server> {
        const server = await db.server.get('server');

        if (server) return server;

        return await ServerManager.sync(token);
    }

    static async sync(token?: string): Promise<Server> {
        const url = stdurl('/api/server');
        const res = await std(url, { token }) as Server;

        const server = res as DBServer;
        server._id = 'server';

        await db.server.put(server);

        return server;
    }

    static async update(server: Server_Update, token?: string): Promise<Server> {
        const url = stdurl('/api/server');
        const res = await std(url, {
            method: 'PATCH',
            token,
            body: server
        }) as Server;

        const s = res as DBServer;
        s._id = 'server';

        await db.server.put(s);

        return s;
    }

    static async create(server: Server_Update, token?: string): Promise<Server> {
        const url = stdurl('/api/server');
        const res = await std(url, {
            method: 'POST',
            token,
            body: server
        }) as Server;

        const s = res as DBServer;
        s._id = 'server';

        await db.server.put(s);

        return s;
    }
}


