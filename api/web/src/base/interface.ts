/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Observable } from 'dexie';
import { db } from '../database.ts';

export interface BaseInterface_ListOptions {
    sync?: boolean;
}

export interface BaseInterface_FromOptions {
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
     * Returns when the local cache was last populated for this manager.
     */
    static async hydrated(): Promise<Date | null> {
        const cache = await db.cache.get(this.listCacheKey);

        if (!cache) {
            return null;
        }

        return new Date(cache.updated);
    }

    /**
     * Returns a list of all items in the database
     *
     * If the sync option is set to true, the method will first trigger a sync to update the local database with the latest data from the server before returning the list of items.
     */
    static async list(
        opts?: BaseInterface_ListOptions
    ): Promise<unknown[]> {
        throw new Error('Method not implemented.');
    }

    /**
     * Returns a list of all items in the database and updates in real-time when the list changes
     */
    static liveList(): Observable<unknown[]> {
        throw new Error('Method not implemented.');
    }

    /**
     * Trigger a sync to update the local database with the latest data from the server
     */
    static async sync(): Promise<void> {
        throw new Error('Method not implemented.');
    }

    /**
     * Returns a single item from the database by its unique identifier
     *
     * @param id - The unique identifier of the item to retrieve
     * @param opts - Optional parameters for fetching the item, such as whether to trigger a sync before fetching
     */
    static async from(
        id: string,
        opts?: BaseInterface_FromOptions
    ): Promise<unknown> {
        throw new Error('Method not implemented.');
    }

    /**
     * Returns a single item from the database by its unique identifier and updates in real-time when the item changes
     *
     * @param id - The unique identifier of the item to retrieve
     */
    static liveFrom(id: string): Observable<unknown> {
        throw new Error('Method not implemented.');
    }

    /**
     * Generates a new item, attempt to save it via the API and save it to the database
     */
    static async generate(data: unknown): Promise<unknown> {
        throw new Error('Method not implemented.');
    }

    /**
     * Updates an item in the database by its unique identifier and attempts to update it via the API
     *
     * @param id - The unique identifier of the item to update
     * @param data - The data to update the item with
     */
    static async update(id: string, data: unknown): Promise<void> {
        throw new Error('Method not implemented.');
    }

    /**
     * Deletes an item from the database by its unique identifier and attempts to delete it via the API
     *
     * @param id - The unique identifier of the item to delete
     */
    static async delete(id?: unknown): Promise<void> {
        throw new Error('Method not implemented.');
    }
}
