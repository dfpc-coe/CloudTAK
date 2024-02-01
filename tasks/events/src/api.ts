import os from 'node:os';
import { fetch } from 'undici';
import fsp from 'node:fs/promises';
import fs from 'node:fs';
import { Readable } from 'node:stream';
import path from 'node:path';
import { Event } from './index.js'

export default class API {
    static async uploadMission(event: Event, mission: {
        name: string;
        filename: string;
        token?: string;
        connection?: number;
    }) {
        const {size} = fs.statSync(event.Local);
        const url = new URL(`/api/marti/missions/${encodeURIComponent(mission.name)}/upload`, process.env.TAK_ETL_API);
        url.searchParams.append('name', mission.filename);
        if (mission.connection) url.searchParams.append('connection', String(mission.connection));

        const res = await fetch(url, {
            method: 'POST',
            duplex: 'half',
            headers: {
                'Authorization': `Bearer ${mission.token ? mission.token : event.Token}`,
                'Content-Length': String(size),
                'Content-Type': 'application/octet-stream'
            },
            body: Readable.toWeb(fs.createReadStream(event.Local))
        });

        const json = await res.json();

        if (!res.ok) {
            const err = json as { message: string };
            throw new Error(err.message);
        }

        return json;
    }

    static async transformData(event: Event) {
        const res = await fetch(new URL(`/api/data/${event.ID}/${path.parse(event.Key).name}`, process.env.TAK_ETL_API), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${event.Token}`
            }
        });

        return await res.json();
    }

    static async fetchData(event: Event): Promise<{
        id: number;
        name: string;
        created: number;
        updated: number;
        description: string;
        connection: number;
        auto_transform: boolean;
        mission_sync: boolean;
        assets: string[];
    }> {
        const res = await fetch(new URL(`/api/data/${event.ID}`, process.env.TAK_ETL_API), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${event.Token}`
            }
        });

        const json = await res.json();

        if (!res.ok) {
            const err = json as { message: string };
            throw new Error(err.message);
        }

        return json as any;
    }

    static async fetchImport(event: Event): Promise<{
        id: string;
        mode: string;
        name: string;
        config: {
            id: string;
            token: string;
        }
    }> {
        const res = await fetch(new URL(`/api/import/${event.ID}`, process.env.TAK_ETL_API), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${event.Token}`
            },
        });

        const json = await res.json();

        if (!res.ok) {
            const err = json as { message: string };
            throw new Error(err.message);
        }

        return json as any;
    }

    static async updateImport(event: Event, body: object) {
        const res = await fetch(new URL(`/api/import/${event.ID}`, process.env.TAK_ETL_API), {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${event.Token}`
            },
            body: JSON.stringify(body)
        });

        const json = await res.json();

        if (!res.ok) {
            const err = json as { message: string };
            throw new Error(err.message);
        }

        return json as any;
    }
}
