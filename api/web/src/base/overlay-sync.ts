/*
* Worker-safe Profile Overlay synchronization
*
* Kept separate from base/overlay.ts as OverlayManager imports Overlay
* (overlay-class.ts) which pulls in the map store & maplibre-gl - modules that
* touch `document` at import time and therefore cannot be loaded inside the
* Atlas worker. This module only depends on the local database and API client
* so it can be shared by OverlayManager.sync() and the AtlasSync worker.
*/

import { db, type DBOverlay } from '../database.ts';
import { server } from '../std.ts';
import type { ProfileOverlay, ProfileOverlayList } from '../types.ts';

export const OVERLAY_LIST_CACHE_KEY = 'overlay';

/**
 * Apply a single overlay (delivered inline on a sync event) to the local
 * database - avoids re-listing overlays from the API, which is slow due to
 * per-overlay existence checks
 */
export async function applyOverlay(overlay: ProfileOverlay): Promise<void> {
    await db.transaction('rw', db.overlay, db.cache, async () => {
        // The server enforces a single active overlay per user by clearing
        // the flag on all others when one is made active - mirror that here
        // since the event only carries the mutated overlay
        if (overlay.active) {
            await db.overlay.toCollection().modify((o) => {
                if (o.id !== overlay.id) o.active = false;
            });
        }

        await db.overlay.put(overlay as DBOverlay);

        await touchListCache();
    });
}

/**
 * Remove a single overlay from the local database after it was deleted by
 * another of the user's clients
 */
export async function removeOverlay(id: number): Promise<void> {
    await db.transaction('rw', db.overlay, db.cache, async () => {
        await db.overlay.delete(id);

        await touchListCache();
    });
}

/**
 * Refresh the overlay list cache timestamp so OverlayManager.hydrated()
 * reflects a single-overlay apply/remove. Only refreshes an existing stamp:
 * if no full list sync has run yet the entry stays absent, since a partial
 * write must not mark a never-synced list as hydrated (that would suppress
 * the initial full sync and hide the remaining overlays).
 */
async function touchListCache(): Promise<void> {
    const cache = await db.cache.get(OVERLAY_LIST_CACHE_KEY);
    if (!cache) return;

    await db.cache.put({
        key: OVERLAY_LIST_CACHE_KEY,
        updated: Date.now()
    });
}

/**
 * Refresh the local overlay database with the latest overlays from the server
 */
export async function syncOverlays(): Promise<void> {
    const res = await server.GET('/api/profile/overlay', {
        params: {
            query: {
                limit: 100,
                page: 0,
                order: 'asc',
                sort: 'pos'
            }
        }
    });

    if (res.error) throw new Error(res.error.message);
    if (!res.data) throw new Error('Failed to sync overlays');

    const list = res.data as ProfileOverlayList;

    await db.transaction('rw', db.overlay, db.cache, async () => {
        await db.overlay.clear();

        if (list.items.length) {
            await db.overlay.bulkPut(list.items as DBOverlay[]);
        }

        await db.cache.put({
            key: OVERLAY_LIST_CACHE_KEY,
            updated: Date.now()
        });
    });
}
