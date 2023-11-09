import Mission from './api/mission.js';
import Credentials from './api/credentials.js';
import Contacts from './api/contacts.js';
import Group from './api/groups.js';
import { CookieJar, Cookie } from 'tough-cookie';
import { CookieAgent } from 'http-cookie-agent/undici';
import Err from '@openaddresses/batch-error';
import { Client } from 'undici';
import { Stream } from 'node:stream';

export class APIAuth {
    async init(base: URL) {
    }
    async fetch(api: TAKAPI, url: URL, opts: any): Promise<any> {
        return await fetch(url, opts);
    }
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

    async fetch(api: TAKAPI, url: URL, opts: any): Promise<any> {
        const jar = new CookieJar();

        await jar.setCookie(new Cookie({ key: 'access_token', value: this.jwt }), String(api.url));

        const agent = new CookieAgent({ cookies: { jar } });

        opts.credentials = 'include';
        opts.dispatcher = agent;

        return await fetch(url, opts);
    }
}

export class APIAuthToken extends APIAuth {
    jwt?: string;

    constructor(jwt: string) {
        super();
        this.jwt = jwt;
    }

    async fetch(api: TAKAPI, url: URL, opts: any): Promise<any> {
        const jar = new CookieJar();

        await jar.setCookie(new Cookie({ key: 'access_token', value: this.jwt }), String(api.url));

        const agent = new CookieAgent({ cookies: { jar } });

        opts.credentials = 'include';
        opts.dispatcher = agent;

        return await fetch(url, opts);
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

    async fetch(api: TAKAPI, url: URL, opts: any): Promise<any> {
        const client = new Client(api.url.origin, {
            connect: {
                key: this.key,
                cert: this.cert,
                rejectUnauthorized: false,
            }
        });

        const res = await client.request({
            path: String(url).replace(api.url.origin, ''),
            ...opts
        });


        return {
            status: res.statusCode,
            body: res.body,
            // Make this similiar to the fetch standard
            headers: new Map(Object.entries(res.headers)),
            text: async () => {
                return String(await this.stream2buffer(res.body));
            },
            json: async () => {
                return JSON.parse(String(await this.stream2buffer(res.body)));
            },
        };
    }

    async stream2buffer(stream: Stream): Promise<Buffer> {
        return new Promise<Buffer> ((resolve, reject) => {
            const _buf = Array<any>();
            stream.on("data", chunk => _buf.push(chunk));
            stream.on("end", () => resolve(Buffer.concat(_buf)));
            stream.on("error", (err: Error) => reject(`error converting stream - ${err}`));
        })
    }
}

/**
 * Handle TAK HTTP API Operations
 * @class
 */
export default class TAKAPI {
    auth: APIAuth;
    url: URL;
    Mission: Mission;
    Credentials: Credentials;
    Contacts: Contacts;
    Group: Group;

    static async init(url: URL, auth: APIAuth): Promise<TAKAPI> {
        const api = new TAKAPI();
        api.url = url;
        api.auth = auth;

        await api.auth.init(api.url);

        api.Mission = new Mission(api);
        api.Credentials = new Credentials(api);
        api.Contacts = new Contacts(api);
        api.Group = new Group(api);

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

            const res = await this.auth.fetch(this, url, opts)

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

            if (res.headers.get('content-type') === 'application/json') {
                return await res.json();
            } else {
                return await res.text();
            }
        } catch (err) {
            throw new Err(400, null, err.message);
        }
    }
}
