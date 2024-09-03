import fetch from './fetch.js';
import { CookieJar, Cookie } from 'tough-cookie';
import { CookieAgent } from 'http-cookie-agent/undici';
import Err from '@openaddresses/batch-error';
import { Client } from 'undici';
import TAKAPI from './tak-api.js';
import stream2buffer  from './stream.js';

export class APIAuth {
    async init(api: TAKAPI) { // eslint-disable-line @typescript-eslint/no-unused-vars

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

    async init(api: TAKAPI) {
        const url = new URL('/oauth/token', api.url);
        url.searchParams.append('grant_type', 'password');
        url.searchParams.append('username', this.username);
        url.searchParams.append('password', this.password);

        const authres = await fetch(url, {
            method: 'POST'
        });

        const text = await authres.text();

        if (authres.status === 401) {
            throw new Err(400, new Error(text), 'TAK Server reports incorrect Username or Password');
        } else if (!authres.ok) {
            throw new Err(400, new Error(text), 'Non-200 Response from Auth Server - Token');
        }

        const body: any = JSON.parse(text);
        this.jwt = body.access_token
    }

    async fetch(api: TAKAPI, url: URL, opts: any): Promise<any> {
        const jar = new CookieJar();

        await jar.setCookie(new Cookie({ key: 'access_token', value: this.jwt }), String(api.url));

        opts.credentials = 'include';

        if (!opts.nocookies) {
            const agent = new CookieAgent({ cookies: { jar } });
            opts.dispatcher = agent;
        }

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


        opts.credentials = 'include';
        if (!opts.nocookies) {
            const agent = new CookieAgent({ cookies: { jar } });
            opts.dispatcher = agent;
        }

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
                return String(await stream2buffer(res.body));
            },
            json: async () => {
                return JSON.parse(String(await stream2buffer(res.body)));
            },
        };
    }
}

