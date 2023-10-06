import MissionData from './api/mission-data.js';
import Credentials from './api/credentials.js';
import Groups from './api/groups.js';
import Contacts from './api/contacts.js';
import { CookieJar, Cookie } from 'tough-cookie';
import { CookieAgent } from 'http-cookie-agent/undici';
import Err from '@openaddresses/batch-error';

export class APIAuth {
    async init(base: URL) {}
    async fetch(api: TAKAPI, opts: any) {}
}

export class APIAuthPassword extends APIAuth {
    username: string;
    password: string;
    jwt?: string;

    constructor(username: string, password: string) {
        super();
        this.username = username;
        this.password = password;
    }

    async init(base: URL) {
        const url = new URL('/oauth/token', base);
        url.searchParams.append('grant_type', 'password');
        url.searchParams.append('username', this.username);
        url.searchParams.append('password', this.password);

        const authres = await fetch(url);

        if (!authres.ok) throw new Err(400, new Error(await authres.text()), 'Non-200 Response from Auth Server - Token');

        const body = await authres.json();
        this.jwt = body.access_token
    }

    async fetch(api: TAKAPI, opts: any) {
        const jar = new CookieJar();

        await jar.setCookie(new Cookie({ key: 'access_token', value: this.jwt }), String(api.url));

        const agent = new CookieAgent({ cookies: { jar } });

        opts.credentials = 'include';
        opts.dispatcher = agent;
    }
}

export class APIAuthToken extends APIAuth {
    jwt?: string;

    constructor(jwt: string) {
        super();
        this.jwt = jwt;
    }

    async fetch(api: TAKAPI, opts: any) {
    }
}

export class APIAuthCertificate extends APIAuth {
    cert: string;
    key: string;

    constructor(cert: string, key: string) {
        super();
        this.cert = cert;
        this.key = key;
    }

    async fetch(api: TAKAPI, opts: any) {
    }
}

/**
 * Handle TAK HTTP API Operations
 * @class
 */
export default class TAKAPI {
    auth: APIAuth;
    url: URL;
    MissionData: MissionData;
    Credentials: Credentials;
    Contacts: Contacts;
    Groups: Groups;

    static async init(url: URL, auth: APIAuth): Promise<TAKAPI> {
        const api = new TAKAPI();
        api.url = url;
        api.auth = auth;

        await api.auth.init(api.url);

        api.MissionData = new MissionData(api);
        api.Credentials = new Credentials(api);
        api.Contacts = new Contacts(api);
        api.Groups = new Groups(api);

        return api;
    }

    stdurl(url: string | URL) {
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
    async fetch(url: URL, opts: any = {}, raw=false) {
        url = this.stdurl(url);

        try {
            if (!opts.headers) opts.headers = {};

            if (!(opts.body instanceof FormData) && typeof opts.body === 'object' && !opts.headers['Content-Type']) {
                opts.body = JSON.stringify(opts.body);
                opts.headers['Content-Type'] = 'application/json';
            }

            await this.auth.fetch(this, opts)

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
