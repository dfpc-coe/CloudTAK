import { fetch } from 'undici';
import fs from 'node:fs';
import { Readable } from 'node:stream';
import path from 'node:path';
import { Event } from './index.js'

export type Import = {
    id: string;
    mode: string;
    name: string;
    username: string;
    config: {
        id: string;
    }
};

export default class API {
    static async fetchLayer(event: {
        layer: number;
        token: string;
    }): Promise<{
        layer: number;
        connection: number;
    }> {
        const url = new URL(`/api/layer/${event.layer}`, process.env.TAK_ETL_API);

        const res = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${event.token}`
            },
        });

        const json = await res.json();

        if (!res.ok) {
            console.error(JSON.stringify(json))
            const err = json as { message: string };
            throw new Error(err.message);
        }

        const jsont = json as {
            connection: number;
        };

        return {
            layer: event.layer,
            connection: jsont.connection
        }
    }

    static async fetchSchema(event: {
        connection: number;
        layer: number;
        token: string;
    }) {
        const url = new URL(`/api/connection${event.connection}/layer/${event.layer}/task/schema`, process.env.TAK_ETL_API);
        url.searchParams.append('type', 'schema:output');
        const res = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${event.token}`
            },
        });

        const json = await res.json();

        if (!res.ok) {
            console.error(JSON.stringify(json))
            const err = json as { message: string };
            throw new Error(err.message);
        }

        return json as any;
    }

    static async putFeature(event: {
        token: string;
        broadcast: boolean;
        body: object;
    }) {
        const url = new URL(`/api/profile/feature`, process.env.TAK_ETL_API);
        url.searchParams.append('broadcast', String(event.broadcast));
        const res = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${event.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(event.body)
        });

        const json = await res.json();

        if (!res.ok) {
            console.error(JSON.stringify(json))
            const err = json as { message: string };
            throw new Error(err.message);
        }

        return json as any;
    }

    static async updateLayer(event: {
        connection: number;
        layer: number;
        token: string;
        body: object;
    }) {
        const res = await fetch(new URL(`/api/connection/${event.connection}/layer/${event.layer}`, process.env.TAK_ETL_API), {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${event.token}`
            },
            body: JSON.stringify(event.body)
        });

        const json = await res.json();

        if (!res.ok) {
            console.error(JSON.stringify(json))
            const err = json as { message: string };
            throw new Error(err.message);
        }

        return json as any;
    }

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

    static async uploadDataMission(event: Event, mission: {
        filename: string;
        token?: string;
        connection: number;
    }) {
        const {size} = fs.statSync(event.Local);
        const url = new URL(`/api/connection/${mission.connection}/data/${event.ID}/upload`, process.env.TAK_ETL_API);
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

        const json = await res.json();

        if (!res.ok) {
            console.error(JSON.stringify(json))
            const err = json as { message: string };
            throw new Error(err.message);
        }

        return json;
    }

    static async transformData(event: Event, opts: {
        connection: number;
    }) {
        const res = await fetch(new URL(`/api/connection/${opts.connection}/data/${event.ID}/${path.parse(event.Key).name}`, process.env.TAK_ETL_API), {
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
                'Authorization': `Bearer ${event.Token}`
            }
        });

        const json = await res.json();

        if (!res.ok) {
            console.error(JSON.stringify(json))
            const err = json as { message: string };
            throw new Error(err.message);
        }

        return json as any;
    }

    static async createBatch(event: Event, imported: Import): Promise<Import> {
        const res = await fetch(new URL(`/api/import/${imported.id}/batch`, process.env.TAK_ETL_API), {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${event.UserToken}`
            },
        });

        const json = await res.json();

        if (!res.ok) {
            console.error(JSON.stringify(json))
            const err = json as { message: string };
            throw new Error(err.message);
        }

        return json as any;
    }

    static async fetchImport(event: Event): Promise<Import> {
        const res = await fetch(new URL(`/api/import/${event.ID}`, process.env.TAK_ETL_API), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${event.Token}`
            },
        });

        const json = await res.json();

        if (!res.ok) {
            console.error(JSON.stringify(json))
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
            console.error(JSON.stringify(json))
            const err = json as { message: string };
            throw new Error(err.message);
        }

        return json as any;
    }
}
