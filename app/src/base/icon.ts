import { server } from '../std.ts';
import { db, type DBIcon, type DBIconset } from '../database.ts';
import type { paths } from '@cloudtak/api-types';
import type { Iconset, Icon as RemoteIcon } from '../types.ts';
import IconsetCache from './iconset.ts';
import Sprite from './sprite.ts';

type IconCreate = paths['/api/iconset/{:iconset}/icon']['post']['requestBody']['content']['application/json'];
type IconUpdate = paths['/api/iconset/{:iconset}/icon/{:icon}']['patch']['requestBody']['content']['application/json'];

/** Built-in sprite ids that ship with the API and are mirrored to Dexie. */
const BUILTIN_SPRITES = ['default'] as const;

export interface IconHydrateResult {
    added: string[];
    /** Iconsets refetched because the remote `version`/`updated` differs. */
    updated: string[];
    /** Iconsets that were removed locally because they no longer exist remotely. */
    removed: string[];
    /** Iconsets whose icon fetch failed; they are retried on the next hydrate. */
    failed: string[];
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

    /** Return the cached icons for the given keys, in order, skipping any that are not cached */
    static async many(icons: string[]): Promise<DBIcon[]> {
        return (await db.icon.bulkGet(icons)).filter((icon): icon is DBIcon => !!icon);
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

    /** Folder portion of an icon path, '' when the icon sits at the iconset root */
    static folder(path: string): string {
        const idx = path.lastIndexOf('/');
        return idx === -1 ? '' : path.slice(0, idx);
    }

    /** Final path segment of an icon path */
    static leaf(path: string): string {
        return path.slice(path.lastIndexOf('/') + 1);
    }

    static stripExt(name: string): string {
        return name.replace(/\.(png|svg|jpg|jpeg|gif)$/i, '');
    }

    /** Normalise a `<uid>/<path>.png` or `<uid>:<path>` reference to the `<uid>:<path>` cache key */
    static key(icon: string): string {
        return Icon.stripExt(icon.includes(':') ? icon : icon.replace('/', ':'));
    }

    /** Split an icon reference into its iconset uid and extensionless path */
    static parse(icon: string): { iconset: string, path: string } | undefined {
        const key = Icon.key(icon);
        const separator = key.indexOf(':');
        if (separator <= 0 || separator === key.length - 1) return undefined;

        return {
            iconset: key.slice(0, separator),
            path: key.slice(separator + 1)
        };
    }

    /** Fetch an icon from the server by row id or path */
    static async fetch(iconset: string, icon: number | string): Promise<RemoteIcon> {
        const { data, error } = await server.GET('/api/iconset/{:iconset}/icon/{:icon}', {
            params: { path: { ':iconset': iconset, ':icon': icon } }
        });

        if (error) throw new Error(error.message);
        if (!data) throw new Error('Failed to fetch icon');

        return data;
    }

    static async create(iconset: string, body: IconCreate, opts: { regen?: boolean } = {}): Promise<RemoteIcon> {
        const { data, error } = await server.POST('/api/iconset/{:iconset}/icon', {
            params: {
                path: { ':iconset': iconset },
                query: { regen: opts.regen ?? true }
            },
            body
        });

        if (error) throw new Error(error.message);
        if (!data) throw new Error('Failed to create icon');

        return data;
    }

    static async update(iconset: string, id: number, body: IconUpdate): Promise<RemoteIcon> {
        const { data, error } = await server.PATCH('/api/iconset/{:iconset}/icon/{:icon}', {
            params: { path: { ':iconset': iconset, ':icon': id } },
            body
        });

        if (error) throw new Error(error.message);
        if (!data) throw new Error('Failed to update icon');

        return data;
    }

    static async delete(iconset: string, id: number): Promise<void> {
        const { error } = await server.DELETE('/api/iconset/{:iconset}/icon/{:icon}', {
            params: { path: { ':iconset': iconset, ':icon': id } }
        });

        if (error) throw new Error(error.message);
    }

    /** Server row id of a cached icon, resolved by path when the cached row predates it */
    static async remoteId(icon: Pick<DBIcon, 'id' | 'iconset' | 'path'>): Promise<number> {
        if (icon.id !== undefined) return icon.id;

        return (await Icon.fetch(icon.iconset, icon.path)).id;
    }

    /**
     * Rename an icon on the server, moving it between folders when the
     * folder portion of `path` changes. The caller resyncs the iconset.
     */
    static async rename(icon: Pick<DBIcon, 'id' | 'iconset' | 'path'>, path: string): Promise<void> {
        await Icon.update(icon.iconset, await Icon.remoteId(icon), { name: path });
    }

    /**
     * Upload image files as `<folder>/<file name>`, then regenerate the
     * spritesheet once. The caller resyncs the iconset.
     */
    static async upload(iconset: string, files: File[], folder = ''): Promise<void> {
        try {
            for (const file of files) {
                const data = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result));
                    reader.onerror = () => reject(reader.error ?? new Error(`Failed to read ${file.name}`));
                    reader.readAsDataURL(file);
                });

                await Icon.create(iconset, {
                    name: folder ? `${folder}/${file.name}` : file.name,
                    data
                }, { regen: false });
            }
        } finally {
            await IconsetCache.regenerate(iconset);
        }
    }

    /**
     * True when the icons cached for an iconset don't match `remote`
     * (defaults to the cached metadata itself).
     */
    static stale(
        cached: DBIconset | undefined,
        remote: Pick<Iconset, 'version' | 'updated'> | undefined = cached
    ): boolean {
        return !cached
            || !remote
            || cached.icons_version !== remote.version
            || cached.icons_updated !== remote.updated;
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
        const { data: iconset, error } = await server.GET('/api/iconset/{:iconset}', {
            params: { path: { ':iconset': uid } }
        });

        if (error) throw new Error(error.message);

        const cached = await db.iconset.get(uid);
        if (!opts.force && !Icon.stale(cached, iconset)) return false;

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
        const ref = Icon.parse(id);
        if (!ref) return undefined;

        try {
            return dataUrlToBlob((await Icon.fetch(ref.iconset, ref.path)).data);
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
        if (!Icon.stale(cached, iconset)) continue;

        toSync.push(iconset);
        if (cached?.icons_version === undefined) added.push(uid);
        else updated.push(uid);
    }

    const removed: string[] = [];
    for (const uid of localByUid.keys()) {
        if (!remoteByUid.has(uid)) removed.push(uid);
    }

    await Promise.all(removed.map((uid) => IconsetCache.delete(uid, { localOnly: true })));

    const failed: string[] = [];
    await Promise.all(toSync.map((iconset) => syncIconset(iconset).catch((err) => {
        console.error(`Failed to sync iconset '${iconset.uid}'`, err);
        failed.push(iconset.uid);
    })));

    await Promise.all(BUILTIN_SPRITES.map((id) => Sprite.get(id).catch((err) => {
        console.error(`Failed to hydrate built-in sprite '${id}'`, err);
    })));

    return {
        added,
        updated,
        removed,
        failed
    };
}

async function syncIconset(iconset: Iconset): Promise<void> {
    const { data: list, error } = await server.GET('/api/icon', {
        params: { query: { iconset: iconset.uid, limit: 0, page: 0, order: 'asc', filter: '' } }
    });

    if (error) throw new Error(error.message);

    const rows: DBIcon[] = [];
    const prefix = `${iconset.uid}/`;
    for (const icon of list.items) {
        const blob = dataUrlToBlob(icon.data);
        const sourcePath = icon.path && icon.path.startsWith(prefix)
            ? icon.path.slice(prefix.length)
            : icon.name;
        const path = Icon.stripExt(sourcePath);

        rows.push({
            name: `${iconset.uid}:${path}`,
            id: icon.id,
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
        await db.iconset.put({
            ...iconset,
            icons_version: iconset.version,
            icons_updated: iconset.updated
        });
    });
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
