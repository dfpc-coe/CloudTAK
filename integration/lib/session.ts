import type { Page } from '@playwright/test';
 
/**
 * The web client stores its JWT in IndexedDB (Dexie db "CloudTAK", table
 * "config", key "token" - see api/web/src/std.ts), not localStorage.
 */
export async function getStoredToken(page: Page): Promise<string | undefined> {
    return page.evaluate(() => new Promise<string | undefined>((resolve) => {
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