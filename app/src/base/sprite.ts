import { db, type DBSprite } from '../database.ts';
import { stdurl, getRuntimeToken } from '../std.ts';

export default class Sprite {
    /** Return a built-in spritesheet from Dexie, fetching it from the API when it isn't cached */
    static async get(id: string): Promise<DBSprite> {
        return await db.sprite.get(id) ?? await Sprite.refresh(id);
    }

    static async refresh(id: string): Promise<DBSprite> {
        const token = await getRuntimeToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

        const [jsonRes, pngRes] = await Promise.all([
            fetch(stdurl(`/api/iconset/${id}/sprite.json`), { headers }),
            fetch(stdurl(`/api/iconset/${id}/sprite.png`), { headers })
        ]);

        if (!jsonRes.ok) throw new Error(`Failed to load sprite '${id}' json (${jsonRes.status})`);
        if (!pngRes.ok) throw new Error(`Failed to load sprite '${id}' png (${pngRes.status})`);

        const row: DBSprite = {
            id,
            updated: Date.now(),
            json: await jsonRes.json() as Record<string, unknown>,
            image: await pngRes.blob()
        };

        await db.sprite.put(row);

        return row;
    }
}
