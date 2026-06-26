import { Preferences } from '@capacitor/preferences';
import { isNativePlatform } from './capacitor.ts';

/**
 * Per-device push registration bookkeeping.
 *
 * FCM tokens are device-scoped and rotate over time (reinstall, expiry, etc).
 * To keep a single `push` paging source per device in sync we remember the
 * server-side paging record id (and the last token we registered) locally via
 * Capacitor Preferences. On startup and on every token rotation we upsert that
 * record so notifications continue to be delivered without user intervention.
 */
const PUSH_ID_KEY = 'cloudtak::push::paging_id';
const PUSH_TOKEN_KEY = 'cloudtak::push::token';

let syncing = false;

async function getStored(): Promise<{ id: number | null; token: string | null }> {
    const [{ value: idRaw }, { value: token }] = await Promise.all([
        Preferences.get({ key: PUSH_ID_KEY }),
        Preferences.get({ key: PUSH_TOKEN_KEY }),
    ]);

    const id = idRaw !== null ? Number(idRaw) : NaN;
    return {
        id: Number.isInteger(id) ? id : null,
        token: token ?? null,
    };
}

async function setStored(id: number | null, token: string | null): Promise<void> {
    if (id === null) {
        await Preferences.remove({ key: PUSH_ID_KEY });
    } else {
        await Preferences.set({ key: PUSH_ID_KEY, value: String(id) });
    }

    if (token === null) {
        await Preferences.remove({ key: PUSH_TOKEN_KEY });
    } else {
        await Preferences.set({ key: PUSH_TOKEN_KEY, value: token });
    }
}

/**
 * Register (or refresh) this device's FCM token as a `push` paging source.
 * Safe to call repeatedly — it only writes to the server when the token
 * changes. No-op on non-native platforms or when no token is available.
 */
export async function syncPushToken(token: string | null): Promise<void> {
    if (!isNativePlatform() || !token) return;
    if (syncing) return;

    syncing = true;
    try {
        const { server } = await import('../std.ts');
        const stored = await getStored();

        if (stored.id !== null) {
            if (stored.token === token) return;

            const res = await server.PATCH('/api/profile/paging/{:pagingid}', {
                params: { path: { ':pagingid': stored.id } },
                body: { value: token },
            });

            if (!res.error) {
                await setStored(stored.id, token);
                return;
            }

            // The stored record no longer exists (deleted elsewhere) — recreate it.
            await setStored(null, null);
        }

        const create = await server.POST('/api/profile/paging', {
            body: { type: 'push', value: token },
        });

        if (create.error) throw new Error(create.error.message);
        await setStored(create.data.id, token);
    } catch (err) {
        console.warn('Failed to sync push notification token', err);
    } finally {
        syncing = false;
    }
}

/**
 * Remove this device's locally tracked push registration. Used when a user
 * deletes the current device's registration so it is not re-created on the
 * next launch.
 */
export async function forgetPushToken(token: string | null): Promise<void> {
    const stored = await getStored();
    if (token === null || stored.token === token) {
        await setStored(null, null);
    }
}
