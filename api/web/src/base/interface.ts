import type { Observable } from 'dexie';

export interface BaseInterface_ListOptions {
    sync?: boolean;
}

export interface BaseInterface<T> {
    /**
     * Returns the total number of items in the database
     */
    count(): Promise<number>;

    /**
     * Returns the total number of items in the database and updates in real-time when the count changes
     */
    liveCount(): Observable<number>;

    /**
     * Returns a list of all items in the database
     *
     * If the sync option is set to true, the method will first trigger a sync to update the local database with the latest data from the server before returning the list of items.
     */
    list(
        opts?: BaseInterface_ListOptions
    ): Promise<T[]>;

    /**
     * Returns a list of all items in the database and updates in real-time when the list changes
     */
    liveList(): Observable<T[]>;

    /**
     * Trigger a sync to update the local database with the latest data from the server
     */
    sync(): Promise<void>;

    /**
     * A unique key used for caching the list of items in memory, the dexie cache database contains the key
     * and the date/time when the value was last synced with the database. This allows the library to determine
     * when to invalidate the cache and fetch fresh data from the database.
     */
    readonly listCacheKey: string

    get(id: string): Promise<T>;
    liveGet(id: string): Observable<T>;
}
