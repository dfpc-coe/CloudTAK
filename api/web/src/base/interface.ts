/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Observable } from 'dexie';

export interface BaseInterface_ListOptions {
    sync?: boolean;
}

export default class BaseInterface {
    /**
     * A unique key used for caching the list of items in memory, the dexie cache database contains the key
     * and the date/time when the value was last synced with the database. This allows the library to determine
     * when to invalidate the cache and fetch fresh data from the database.
     */
    static readonly listCacheKey: string = 'default'

    /**
     * Returns the total number of items in the database
     */
    static async count(): Promise<number> {
        throw new Error('Method not implemented.');
    }

    /**
     * Returns the total number of items in the database and updates in real-time when the count changes
     */
    static liveCount(): Observable<number> {
        throw new Error('Method not implemented.');
    }

    /**
     * Returns a list of all items in the database
     *
     * If the sync option is set to true, the method will first trigger a sync to update the local database with the latest data from the server before returning the list of items.
     */
    static async list<T>(
        opts?: BaseInterface_ListOptions
    ): Promise<T[]> {
        throw new Error('Method not implemented.');
    }

    /**
     * Returns a list of all items in the database and updates in real-time when the list changes
     */
    static liveList<T>(): Observable<T[]> {
        throw new Error('Method not implemented.');
    }

    /**
     * Trigger a sync to update the local database with the latest data from the server
     */
    static async sync(): Promise<void> {
        throw new Error('Method not implemented.');
    }

    static async get<T>(id: string): Promise<T> {
        throw new Error('Method not implemented.');
    }

    static liveGet<T>(id: string): Observable<T> {
        throw new Error('Method not implemented.');
    }
}
