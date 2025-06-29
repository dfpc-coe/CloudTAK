import memjs from 'memjs';
import { Client } from 'memjs';

export default class Cacher {
    nocache: boolean;
    cache: Client;

    constructor(nocache = false, silent = false) {
        this.nocache = nocache;

        if (!silent) {
            if (nocache) console.error('ok - Memcached Disabled');
            else console.error('ok - Memcached Enabled');
        }

        this.cache = memjs.Client.create();
    }

    /**
     * Attempt to retrieve a value from memcached, fallback to an async function
     * caching the results and returning
     *
     * @param {String} key memcached key to attempt to retrieve
     * @param {function} miss Async Function to fallback to
     * @param {boolean} [isJSON=true] Should we automatically parse to JSON
     */
    async get<T>(key: string, miss: () => T, isJSON = true): Promise<T> {
        try {
            if (!key || this.nocache) throw new Error('Miss');

            const cached = await this.cache.get(key);

            if (!cached.value) throw new Error('Miss');

            if (isJSON) {
                return JSON.parse(String(cached.value)) as T;
            } else {
                return cached.value as T;
            }
        } catch (err) {
            if (!(err instanceof Error) || (err instanceof Error &&  err.message !== 'Miss')) {
                console.error('Cache Error', err);
            }

            const fresh = await miss();

            try {
                if (key && !this.nocache) {
                    const buff = Buffer.from(String(isJSON ? JSON.stringify(fresh) : fresh));

                    if (buff.length < 1000000) {
                        await this.cache.set(key, buff, {
                            expires: 604800
                        });
                    }
                }
            } catch (err) {
                console.error(err);
            }

            return fresh;
        }
    }

    /**
     * If the cache key is set to false, a cache miss is forced
     * This function forces a cache miss if any query params are set
     */
    static Miss(obj: any, key: string): any {
        if (!obj) return key;
        if (Object.keys(obj).length === 0 && obj.constructor === Object) return key;
        return false;
    }

    /**
     * Delete a key from the cache
     */
    async del(key: string): Promise<void> {
        try {
            await this.cache.delete(key);
        } catch (err) {
            console.error(err);
        }
    }

    /**
     * Flush the entire cache
     */
    async flush(): Promise<void> {
        try {
            await this.cache.flush();
        } catch (err) {
            throw new Error(`Failed to flush cache: ${err}`);
        }
    }

    async end(): Promise<void> {
        this.cache.close();
    }
}
