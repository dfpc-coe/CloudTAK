import memjs from 'memjs';

/**
 * @class
 */
export default class Cacher {
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
    async get(key, miss, isJSON = true) {
        let res;

        try {
            if (!key || this.nocache) throw new Error('Miss');

            let cached = await this.cache.get(key);

            if (!cached.value) throw new Error('Miss');
            if (isJSON) {
                cached = JSON.parse(cached.value);
            } else {
                cached = cached.value;
            }

            return cached;
        } catch (err) {
            if (res) return res;

            const fresh = await miss();

            try {
                if (key && !this.nocache) {
                    if (isJSON) {
                        await this.cache.set(key, JSON.stringify(fresh), {
                            expires: 604800
                        });
                    } else {
                        await this.cache.set(key, fresh, {
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
     *
     * @param {Object} obj Object to test
     * @param {String} key Default Cache Key
     * @return {Any}
     */
    static Miss(obj, key) {
        if (!obj) return key;
        if (Object.keys(obj).length === 0 && obj.constructor === Object) return key;
        return false;
    }

    /**
     * Delete a key from the cache
     *
     * @param {String} key
     */
    async del(key) {
        try {
            await this.cache.delete(key);
        } catch (err) {
            console.error(err);
        }

        return true;
    }

    /**
     * Flush the entire cache
     */
    async flush() {
        try {
            await this.cache.flush();
        } catch (err) {
            throw new Error('Failed to flush cache');
        }
    }
}
