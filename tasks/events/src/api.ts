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
    }) {
        const {size} = fs.statSync(event.Local);

        const url = new URL(`/api/marti/missions/${encodeURIComponent(mission.name)}/upload`, process.env.TAK_ETL_API);
        url.searchParams.append('name', mission.filename);
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

        return await res.json();
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
        auto_transform: boolean;
        mission?: {
            id: number;
            mission: string;
            enabled: boolean;
            data: number;
            assets: string[];
        }
    }> {
        const res = await fetch(new URL(`/api/data/${event.ID}`, process.env.TAK_ETL_API), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${event.Token}`
            }
        });

        const resbody = await res.json() as any;
        return resbody;
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

        const resbody = await res.json() as any;
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${resbody.message}`);
        return resbody;
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

        const resbody = await res.json() as any;
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${resbody.message}`);
        return resbody;
    }
}
