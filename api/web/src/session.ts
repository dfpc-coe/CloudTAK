import { Preferences } from '@capacitor/preferences';
import KV from './base/kv.ts';
import { db } from './database.ts';
import { isNativePlatform } from './base/capacitor.ts';

export default class Session {
    /**
     * Persist the server URL into the KV store (and Preferences on native).
     */
    static async serverUrl(serverUrl: string): Promise<void> {
        await KV.generate('serverUrl', serverUrl);
        await Preferences.set({ key: 'serverUrl', value: serverUrl });
    }

    /**
     * Persist login details for the authenticated user.
     */
    static async login(opts: {
        token: string;
        username: string;
    }): Promise<void> {
        await Preferences.set({ key: 'token', value: opts.token });

        // Mirror the token into the KV store so workers can authenticate
        await KV.generate('token', opts.token);
        await KV.generate('username', opts.username);
    }

    /**
     * Return the username of the existing session, if one is present.
     */
    static async username(): Promise<string | undefined> {
        return await KV.value('username');
    }

    /**
     * Remove the active token from all stores. The Dexie database is left
     * intact so that a re-login (e.g. after an expired token) does not need to
     * resynchronize all data.
     */
    static async clear(): Promise<void> {
        await Preferences.remove({ key: 'token' });
        await KV.delete('token');
    }

    /**
     * Fully clear the session - removes the token and wipes the Dexie database.
     * Used on explicit sign-out or when a different user logs in.
     *
     * Dexie's `delete()`/`open()` is used (instead of
     * `indexedDB.deleteDatabase`) so the live connection is closed cleanly and
     * immediately reopened, leaving the database ready for subsequent reads and
     * writes instead of hanging on a blocked delete request.
     */
    static async destroy(): Promise<void> {
        await this.clear();

        await db.delete();
        await db.open();
    }
}
