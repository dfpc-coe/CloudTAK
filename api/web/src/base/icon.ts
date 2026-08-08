import { std, stdurl, getRuntimeToken } from '../std.ts';
import { db, type DBIcon, type DBIconset } from '../database.ts';
import type { Icon as IconType, Iconset, IconList } from '../types.ts';
import IconsetCache from './iconset.ts';

/** Built-in sprite ids that ship with the API and are mirrored to Dexie. */
const BUILTIN_SPRITES = ['default'] as const;

export interface IconHydrateResult {
    added: string[];
    /** Iconsets refetched because the remote `version`/`updated` differs. */
    updated: string[];
    /** Iconsets that were removed locally because they no longer exist remotely. */
    removed: string[];
}

let inflight: Promise<IconHydrateResult> | null = null;

export default class Icon {
    static async has(icon: string): Promise<boolean> {
        return await db.icon
            .where("name")
            .equals(icon)
            .count() > 0;
    }

    static async get(icon: string): Promise<DBIcon | undefined> {
        return await db.icon.get(icon);
    }

    /**
     * Return all cached icons ordered by key.
     */
    static async all(): Promise<DBIcon[]> {
        return await db.icon.orderBy('name').toArray();
    }

    /**
     * Return all icons belonging to a given iconset uid, ordered by path.
     */
    static async list(iconsetUid: string): Promise<DBIcon[]> {
        return await db.icon.where('iconset').equals(iconsetUid).sortBy('path');
    }

    /**
     * Diff the server iconset list against Dexie and refetch icons for any
     * iconsets that are new or whose `version`/`updated` differs. Concurrent
     * calls coalesce onto the in-flight diff.
     */
    static async hydrate(): Promise<IconHydrateResult> {
        if (inflight) return inflight;

        inflight = runDiff().finally(() => {
            inflight = null;
        });

        return inflight;
    }

    /**
     * Ensure a single iconset is present in Dexie. Returns true if Dexie was
     * actually updated so the caller can purge stale map images.
     */
    static async addIconset(uid: string, opts: { force?: boolean } = {}): Promise<boolean> {
        const iconset = await std(`/api/iconset/${uid}`) as Iconset;

        const cached = await db.iconset.get(uid);
        if (
            !opts.force
            &&
            cached
            && cached.version === iconset.version
            && cached.updated === iconset.updated
        ) {
            return false;
        }

        await syncIconset(iconset);
        return true;
    }

    /**
     * Fetch a single `<iconsetUid>:<path>` icon directly from the API.
     * Used as the network fallback when an icon isn't cached in Dexie yet
     * (e.g. an overlay referencing an iconset that hasn't synced). Returns
     * undefined when the icon can't be retrieved.
     */
    static async fetchRemote(id: string): Promise<Blob | undefined> {
        const separator = id.indexOf(':');
        if (separator <= 0 || separator === id.length - 1) return undefined;

        const iconset = id.slice(0, separator);
        const path = id.slice(separator + 1);

        try {
            const icon = await std(
                `/api/iconset/${encodeURIComponent(iconset)}/icon/${encodeURIComponent(path)}`
            ) as IconType;

            return dataUrlToBlob(icon.data);
        } catch {
            return undefined;
        }
    }
}

async function runDiff(): Promise<IconHydrateResult> {
    const local = await db.iconset.toArray();
    const remote = await IconsetCache.list({ sync: true }) as Iconset[];

    const remoteByUid = new Map<string, Iconset>();
    for (const iconset of remote) {
        remoteByUid.set(iconset.uid, iconset);
    }

    const localByUid = new Map<string, DBIconset>();
    for (const iconset of local) {
        localByUid.set(iconset.uid, iconset);
    }

    const toSync: Iconset[] = [];
    const added: string[] = [];
    const updated: string[] = [];
    for (const [uid, iconset] of remoteByUid) {
        const cached = localByUid.get(uid);
        if (!cached) {
            toSync.push(iconset);
            added.push(uid);
        } else if (
            cached.version !== iconset.version
            || cached.updated !== iconset.updated
        ) {
            toSync.push(iconset);
            updated.push(uid);
        }
    }

    const removed: string[] = [];
    for (const uid of localByUid.keys()) {
        if (!remoteByUid.has(uid)) removed.push(uid);
    }

    await Promise.all(removed.map((uid) => IconsetCache.delete(uid, { localOnly: true })));
    await Promise.all(toSync.map((iconset) => syncIconset(iconset)));
    await Promise.all(BUILTIN_SPRITES.map((id) => syncBuiltinSprite(id)));

    return {
        added,
        updated,
        removed
    };
}

/**
 * Mirror a built-in spritesheet (PNG + JSON layout) into Dexie so the main
 * thread can serve it via the `cloudtak-sprite://` MapLibre protocol
 * without re-hitting the network on every page load.
 */
async function syncBuiltinSprite(id: string): Promise<void> {
    try {
        const token = await getRuntimeToken();
        const jsonUrl = stdurl(`/api/iconset/${id}/sprite.json`);
        const pngUrl = stdurl(`/api/iconset/${id}/sprite.png`);
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

        const [jsonRes, pngRes] = await Promise.all([
            fetch(jsonUrl, { headers }),
            fetch(pngUrl, { headers })
        ]);

        if (!jsonRes.ok) throw new Error(`sprite json ${jsonRes.status}`);
        if (!pngRes.ok) throw new Error(`sprite png ${pngRes.status}`);

        const json = await jsonRes.json() as Record<string, unknown>;
        const image = await pngRes.blob();

        await db.sprite.put({
            id,
            updated: Date.now(),
            json,
            image
        });
    } catch (err) {
        console.error(`Failed to hydrate built-in sprite '${id}'`, err);
    }
}

async function syncIconset(iconset: Iconset): Promise<void> {
    const list = await std(
        `/api/icon?iconset=${encodeURIComponent(iconset.uid)}&limit=0`
    ) as IconList;

    const rows: DBIcon[] = [];
    const prefix = `${iconset.uid}/`;
    for (const icon of list.items) {
        const blob = dataUrlToBlob(icon.data);
        const sourcePath = icon.path && icon.path.startsWith(prefix)
            ? icon.path.slice(prefix.length)
            : icon.name;
        const path = stripExt(sourcePath);

        rows.push({
            name: `${iconset.uid}:${path}`,
            iconset: iconset.uid,
            path,
            type2525b: icon.type2525b ?? null,
            updated: icon.updated,
            data: blob
        });
    }

    await db.transaction('rw', db.icon, db.iconset, async () => {
        await db.icon.where('iconset').equals(iconset.uid).delete();
        if (rows.length) await db.icon.bulkPut(rows);
        await db.iconset.put(iconset);
    });
}

function stripExt(name: string): string {
    return name.replace(/\.(png|svg|jpg|jpeg|gif)$/i, '');
}

function dataUrlToBlob(data: string): Blob {
    let mime = 'image/png';
    let base64 = data;

    if (data.startsWith('data:')) {
        const match = /^data:([^;,]+);base64,(.*)$/.exec(data);
        if (match) {
            mime = match[1];
            base64 = match[2];
        }
    }

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return new Blob([bytes], { type: mime });
}
