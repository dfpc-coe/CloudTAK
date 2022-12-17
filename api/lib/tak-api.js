import MissionData from './api/mission-data.js';

/**
 * Handle TAK HTTP API Operations
 * @class
 */
export default class TAKAPI {
    constructor(type, opts) {
        this.type = type;
        this.opts = opts;

        this.MissionData = new MissionData(type, opts);
    }

    stdurl(url) {
        try {
            url = new URL(url);
        } catch (err) {
            url = new URL(url, this.opts.url);
        }

        return url;
    }

    /**
     * Standardize interactions with the backend API
     *
     * @param {URL|String} url      - Full URL or API fragment to request
     * @param {Object} [opts={}]    - Options
     */
    fetch(url, opts = {}) {
        url = window.stdurl(url)

        try {
            if (!opts.headers) opts.headers = {};

            if (!(opts.body instanceof FormData) && typeof opts.body === 'object' && !opts.headers['Content-Type']) {
                opts.body = JSON.stringify(opts.body);
                opts.headers['Content-Type'] = 'application/json';
            }

            if (localStorage.token && !opts.headers.Authorization) {
                opts.headers['Authorization'] = 'Bearer ' + localStorage.token;
            }

            const res = await fetch(url, opts);

            let bdy = {};
            if ((res.status < 200 || res.status >= 400) && ![401].includes(res.status)) {
                try {
                    bdy = await res.json();
                } catch (err) {
                    throw new Error(`Status Code: ${res.status}`);
                }

                const err = new Error(bdy.message || `Status Code: ${res.status}`);
                err.body = bdy;
                throw err;
            }

            return await res.json();
        } catch (err) {
            throw new Error(err.message);
        }
    }
}
