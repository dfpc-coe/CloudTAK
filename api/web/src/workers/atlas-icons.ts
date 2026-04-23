/*
 * AtlasIcons - Hydrate the local Dexie iconset / icon cache from the API.
 *
 * Performs all network IO and base64 -> Blob decoding off the main thread so
 * the frontend `IconManager` only deals with cheap on-demand
 * `createImageBitmap` calls when MapLibre asks for a missing image.
 */

import { std, stdurl } from '../std.ts';
import { db, type DBIcon, type DBIconset } from '../base/database.ts';
import type { IconsetList, Iconset, IconList } from '../types.ts';
import type Atlas from './atlas.ts';

const HYDRATE_CACHE_KEY = 'iconsets:hydrated';
/** Skip a fresh hydrate if the local cache was last refreshed within this many ms. */
const HYDRATE_FRESH_MS = 60_000;

/** Built-in sprite ids that ship with the API and are mirrored to Dexie. */
const BUILTIN_SPRITES = ['default'] as const;

export interface IconHydrateResult {
    /** Iconsets that were added or refreshed during the diff. */
    changed: string[];
    /** Iconsets that were removed locally because they no longer exist remotely. */
    removed: string[];
    /** True when the diff was skipped because the local cache was fresh. */
    skipped: boolean;
}

export default class AtlasIcons {
    atlas: Atlas;

    private inflight: Promise<IconHydrateResult> | null = null;

    constructor(atlas: Atlas) {
        this.atlas = atlas;
    }

    /**
     * Diff the server iconset list against Dexie and refetch icons for any
     * iconsets that are new or whose `version`/`updated` differs.
     *
     * Behaviour:
     *  - When Dexie already has data and was refreshed recently the call
     *    returns immediately (`skipped: true`) and the diff runs in the
     *    background; the next call will see the updated cache marker.
     *  - When `force` is true the diff always runs inline.
     */
    async hydrate(opts: { force?: boolean } = {}): Promise<IconHydrateResult> {
        const force = !!opts.force;

        if (!force) {
            const marker = await db.cache.get(HYDRATE_CACHE_KEY);
            const iconsetCount = await db.iconset.count();
            const spriteCount = await db.sprite.count();
            const fresh = !!marker && (Date.now() - marker.updated) < HYDRATE_FRESH_MS;

            if (iconsetCount > 0 && spriteCount >= BUILTIN_SPRITES.length && fresh) {
                return { changed: [], removed: [], skipped: true };
            }

            if (iconsetCount > 0 && spriteCount >= BUILTIN_SPRITES.length && marker) {
                // Local cache exists but is stale -- run the diff in the
                // background so callers don't block on icon hydration.
                void this.runDiffOnce().catch((err: unknown) => {
                    console.error('Background icon hydrate failed', err);
                });
                return { changed: [], removed: [], skipped: true };
            }
        }

        return await this.runDiffOnce();
    }

    /**
     * Ensure a single iconset is present in Dexie. Returns true if Dexie was
     * actually updated so the caller can purge stale map images.
     */
    async addIconset(uid: string): Promise<boolean> {
        const iconset = await std(`/api/iconset/${uid}`, {
            token: this.atlas.token
        }) as Iconset;

        const cached = await db.iconset.get(uid);
        if (
            cached
            && cached.version === iconset.version
            && cached.updated === iconset.updated
        ) {
            return false;
        }

        await this.syncIconset(iconset);
        return true;
    }

    /**
     * Remove an iconset and all of its icons from Dexie. Returns true when
     * something was actually removed.
     */
    async removeIconset(uid: string): Promise<boolean> {
        const cached = await db.iconset.get(uid);
        if (!cached) return false;

        await db.transaction('rw', db.icon, db.iconset, async () => {
            await db.icon.where('iconset').equals(uid).delete();
            await db.iconset.delete(uid);
        });

        return true;
    }

    private runDiffOnce(): Promise<IconHydrateResult> {
        if (this.inflight) return this.inflight;

        this.inflight = (async () => {
            try {
                return await this.runDiff();
            } finally {
                this.inflight = null;
            }
        })();

        return this.inflight;
    }

    private async runDiff(): Promise<IconHydrateResult> {
        const remote = await std('/api/iconset?limit=0', {
            token: this.atlas.token
        }) as IconsetList;

        const remoteByUid = new Map<string, Iconset>();
        for (const iconset of remote.items) {
            remoteByUid.set(iconset.uid, iconset);
        }

        const local = await db.iconset.toArray();
        const localByUid = new Map<string, DBIconset>();
        for (const iconset of local) {
            localByUid.set(iconset.uid, iconset);
        }

        const toSync: Iconset[] = [];
        for (const [uid, iconset] of remoteByUid) {
            const cached = localByUid.get(uid);
            if (
                !cached
                || cached.version !== iconset.version
                || cached.updated !== iconset.updated
            ) {
                toSync.push(iconset);
            }
        }

        const removed: string[] = [];
        for (const uid of localByUid.keys()) {
            if (!remoteByUid.has(uid)) removed.push(uid);
        }

        await Promise.all(removed.map((uid) => this.removeIconset(uid)));
        await Promise.all(toSync.map((iconset) => this.syncIconset(iconset)));
        await Promise.all(BUILTIN_SPRITES.map((id) => this.syncBuiltinSprite(id)));

        await db.cache.put({ key: HYDRATE_CACHE_KEY, updated: Date.now() });

        return {
            changed: toSync.map((i) => i.uid),
            removed,
            skipped: false
        };
    }

    /**
     * Mirror a built-in spritesheet (PNG + JSON layout) into Dexie so the main
     * thread can serve it via the `cloudtak-sprite://` MapLibre protocol
     * without re-hitting the network on every page load.
     */
    private async syncBuiltinSprite(id: string): Promise<void> {
        try {
            const jsonUrl = stdurl(`/api/iconset/${id}/sprite.json`);
            const pngUrl = stdurl(`/api/iconset/${id}/sprite.png`);
            const headers = { Authorization: `Bearer ${this.atlas.token}` };

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

    private async syncIconset(iconset: Iconset): Promise<void> {
        const list = await std(
            `/api/icon?iconset=${encodeURIComponent(iconset.uid)}&limit=0`,
            { token: this.atlas.token }
        ) as IconList;

        const rows: DBIcon[] = [];
        for (const icon of list.items) {
            const blob = dataUrlToBlob(icon.data);
            const path = stripExt(icon.name);

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
