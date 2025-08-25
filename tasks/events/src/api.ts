import { fetch } from 'undici';
import fs from 'node:fs';
import { Readable } from 'node:stream';

export default class API {
    static async fetch({
        token: string,
    })

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
}
