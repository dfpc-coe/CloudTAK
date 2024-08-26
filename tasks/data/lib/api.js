import { fetch } from 'undici';

export default class API {
    static async updateImport(importid, token, body) {
        const res = await fetch(new URL(`/api/import/${importid}`, process.env.ETL_API), {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        const json = await res.json();

        if (!res.ok) {
            console.error(JSON.stringify(json));
            throw new Error(json.message);
        }

        return json;
    }
}
