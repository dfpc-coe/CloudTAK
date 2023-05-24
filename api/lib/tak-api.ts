import MissionData from './api/mission-data.js';
import Credentials from './api/credentials.js';
import { CookieJar, Cookie } from 'tough-cookie';
import { CookieAgent } from 'http-cookie-agent/undici';
import Err from '@openaddresses/batch-error';

export interface APIAuthInput {
    username: string;
    password: string;
}

/**
 * Handle TAK HTTP API Operations
 * @class
 */
export default class TAKAPI {
    auth: APIAuthInput;
    authorized?: {
        jwt: string;
    };
    url: URL;
    MissionData: MissionData;
    Credentials: Credentials;

    constructor(url: URL, auth: APIAuthInput) {
        this.auth = auth;

        this.url = url;

        this.MissionData = new MissionData(this);
        this.Credentials = new Credentials(this);
    }

    stdurl(url: string | URL) {
        try {
            url = new URL(url);
        } catch (err) {
            url = new URL(url, this.url);
        }

        return url;
    }

    logout() {
        delete this.authorized;
    }

    async login() {
        const url = new URL('/oauth/token', this.url);
        url.searchParams.append('grant_type', 'password');
        url.searchParams.append('username', this.auth.username);
        url.searchParams.append('password', this.auth.password);

        const authres = await fetch(url);

        if (!authres.ok) throw new Err(400, new Error(await authres.text()), 'Non-200 Response from Auth Server - Token');

        const body = await authres.json();

        this.authorized = {
            jwt: body.access_token
        };
    }

    /**
     * Standardize interactions with the backend API
     *
     * @param {URL|String} url      - Full URL or API fragment to request
     * @param {Object} [opts={}]    - Options
     */
    async fetch(url: URL, opts: any = {}, raw=false) {
        url = this.stdurl(url);

        try {
            if (!opts.headers) opts.headers = {};

            if (!(opts.body instanceof FormData) && typeof opts.body === 'object' && !opts.headers['Content-Type']) {
                opts.body = JSON.stringify(opts.body);
                opts.headers['Content-Type'] = 'application/json';
            }

            if (!opts.headers['Authorization'] && this.authorized) {
                const jar = new CookieJar();

                if (this.authorized) {
                    await jar.setCookie(new Cookie({ key: 'access_token', value: this.authorized.jwt }), String(this.url));
                }

                const agent = new CookieAgent({ cookies: { jar } });

                opts.credentials = 'include';
                opts.dispatcher = agent;
            }

            const res = await fetch(url, opts);

            if (raw) return res;

            let bdy: any = {};
            if ((res.status < 200 || res.status >= 400) && ![401].includes(res.status)) {
                try {
                    bdy = await res.text();
                } catch (err) {
                    throw new Error(`Status Code: ${res.status}`);
                }

                throw new Error(bdy || `Status Code: ${res.status}`);
            }

            if (res.headers.get('Content-Type') === 'application/json') {
                return await res.json();
            } else {
                return await res.text();
            }
        } catch (err) {
            throw new Err(400, null, err.message);
        }
    }
}
