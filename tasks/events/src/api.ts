import os from 'node:os';
import { fetch } from 'undici';
import fsp from 'node:fs/promises';
import fs from 'node:fs';
import { Readable } from 'node:stream';
import path from 'node:path';
import { Event } from './index.js'

export default class API {
    static async uploadMission(md: Event, imported: {
        name: string;
        config: {
            id: string;
            token: string;
        }
    }) {
        const {size} = fs.statSync(md.Local);

        const url = new URL(`/api/marti/missions/${encodeURIComponent(imported.config.id)}/upload`, process.env.TAK_ETL_API);
        url.searchParams.append('name', imported.name);
        const res = await fetch(url, {
            method: 'POST',
            duplex: 'half',
            headers: {
                'Authorization': `Bearer ${imported.config.token}`,
                'Content-Length': String(size),
                'Content-Type': 'application/octet-stream'
            },
            body: Readable.toWeb(fs.createReadStream(md.Local))
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
        name: string;
        description: string;
        auto_transform: boolean;
    }> {
        const res = await fetch(new URL(`/api/data/${event.ID}`, process.env.TAK_ETL_API), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${event.Token}`
            }
        });

        const resbody = await res.json() as {
            [k: string]: string | boolean;
        };
        
        return {
            name: String(resbody.name),
            description: String(resbody.description),
            auto_transform: Boolean(resbody.auto_transform)
        }
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
