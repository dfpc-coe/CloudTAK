import MissionData from './api/mission-data.js';
import https from 'https';
import fetch from 'node-fetch';

/**
 * Handle TAK HTTP API Operations
 * @class
 */
export default class TAKAPI {
    constructor(type, opts) {
        this.type = type;
        this.opts = opts;

        this.url = new URL(`https://${opts.url.hostname}:8080`);

        this.agent = new https.Agent({
            cert: this.opts.cert,
            key: this.opts.key,
            keepAlive: false
        });

        this.MissionData = new MissionData(this);
    }

    stdurl(url) {
        try {
            url = new URL(url);
        } catch (err) {
            url = new URL(url, this.url);
        }

        return url;
    }

    /**
     * Standardize interactions with the backend API
     *
     * @param {URL|String} url      - Full URL or API fragment to request
     * @param {Object} [opts={}]    - Options
     */
    async fetch(url, opts = {}) {
        url = this.stdurl(url)

        console.error('TAK API', url);

        try {
            if (!opts.headers) opts.headers = {};

            if (!(opts.body instanceof FormData) && typeof opts.body === 'object' && !opts.headers['Content-Type']) {
                opts.body = JSON.stringify(opts.body);
                opts.headers['Content-Type'] = 'application/json';
            }

            if (!opts.headers.Authorization) {
                console.error('NEED TO SET AUTH');
            }

            opts.agent = this.agent;

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
            console.error(err);
            throw new Error(err.message);
        }
    }
}
