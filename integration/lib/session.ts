import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { cloudtakUrl } from './env.ts';

/**
 * The web client stores its JWT in IndexedDB (Dexie db "CloudTAK", table
 * "config", key "token" - see app/src/std.ts), not localStorage.
 */
export async function getStoredToken(page: Page): Promise<string | undefined> {
    return page.evaluate(() => new Promise<string | undefined>((resolve) => {
        try {
            const fromPreferences = localStorage.getItem('CapacitorStorage.token');
            if (fromPreferences) {
                resolve(fromPreferences);
                return;
            }
        } catch {
            // fall through to IndexedDB
        }
 
        try {
            const open = indexedDB.open('CloudTAK');
            open.onerror = () => resolve(undefined);
            open.onsuccess = () => {
                try {
                    const req = open.result.transaction('config', 'readonly')
                        .objectStore('config').get('token');
                    req.onsuccess = () => resolve(req.result?.value);
                    req.onerror = () => resolve(undefined);
                } catch {
                    resolve(undefined);
                }
            };
        } catch {
            resolve(undefined);
        }
    }));
}

export type MissionOverlay = { guid: string; name: string };

/**
 * Server-side mission subscriptions: profile overlays with mode "mission"
 * (POST /api/profile/overlay is created on subscribe, see MissionInfo.vue).
 */
export async function getMissionOverlays(page: Page): Promise<MissionOverlay[]> {
    const token = await getStoredToken(page);
    const res = await page.request.get(`${cloudtakUrl()}/api/profile/overlay?limit=100`, {
        headers: { Authorization: `Bearer ${token ?? ''}` },
    });
    const body = await res.json() as { items: Array<{ mode: string; mode_id: string | null; name: string }> };
    return body.items
        .filter((overlay) => overlay.mode === 'mission' && typeof overlay.mode_id === 'string')
        .map((overlay) => ({ guid: overlay.mode_id as string, name: overlay.name }));
}

// Guids with a subscribed=true record in the Dexie "subscription" table.
export async function getSubscribedGuids(page: Page): Promise<string[]> {
    return page.evaluate(() => new Promise<string[]>((resolve) => {
        try {
            const open = indexedDB.open('CloudTAK');
            open.onerror = () => resolve([]);
            open.onsuccess = () => {
                try {
                    const req = open.result.transaction('subscription', 'readonly')
                        .objectStore('subscription').getAll();
                    req.onsuccess = () => resolve((req.result as Array<{ guid: string; subscribed?: boolean }>)
                        .filter((sub) => sub.subscribed === true)
                        .map((sub) => sub.guid));
                    req.onerror = () => resolve([]);
                } catch {
                    resolve([]);
                }
            };
        } catch {
            resolve([]);
        }
    }));
}

type GroupChannel = {
    name: string;
    direction: string;
    created: string;
    type: string;
    bitpos: number;
    active: boolean;
    description?: string;
};

export async function ensureChannelActive(page: Page, name: string): Promise<void> {
    const headers = { Authorization: `Bearer ${await getStoredToken(page) ?? ''}` };

    const res = await page.request.get(`${cloudtakUrl()}/api/marti/group?useCache=true`, { headers });
    if (!res.ok()) throw new Error(`Failed to list channels: HTTP ${res.status()}`);
    const body = await res.json() as { data: GroupChannel[] };

    if (body.data.some((channel) => channel.name === name && channel.active)) return;

    const updated = body.data.map((channel) => channel.name === name ? { ...channel, active: true } : channel);
    const put = await page.request.put(`${cloudtakUrl()}/api/marti/group`, { headers, data: updated });
    if (!put.ok()) throw new Error(`Failed to activate channel ${name}: HTTP ${put.status()}`);
}

/**
 * Mission overlays are synced into the Dexie "subscription" table while the
 * map loads; the Data Syncs panel reads subscribed state from there, so wait
 * for the sync before asserting on the Subscribed/Available split.
 */
export async function waitForSubscriptionSync(page: Page): Promise<MissionOverlay[]> {
    const overlays = await getMissionOverlays(page);
    await expect.poll(async () => {
        const subscribed = await getSubscribedGuids(page);
        return overlays.every((overlay) => subscribed.includes(overlay.guid));
    }, { timeout: 30_000, message: 'expected mission overlays to be synced into IndexedDB subscriptions' }).toBe(true);
    return overlays;
}