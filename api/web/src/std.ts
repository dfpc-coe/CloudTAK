import createClient from "openapi-fetch";
import KV from './base/kv.ts'
import type { Middleware } from "openapi-fetch";
import type { paths } from '@cloudtak/api-types'
import type { APIError } from './types.js'
import type { Router } from 'vue-router'
import { openSecondaryView, resolveRuntimeUrl } from './base/capacitor.ts';
import { db } from './database.ts';

export async function createServer() {
    const baseUrl = await getRuntimeServerUrl();

    const server = createClient<paths>({
        baseUrl,
    });

    const authMiddleware: Middleware = {
        async onRequest({ request }) {
            const token = await getRuntimeToken();

            if (token && !request.headers.has('Authorization')) {
                request.headers.set('Authorization', `Bearer ${token}`);
            }

            return request;
        },
    };

    server.use(authMiddleware);

    return server;
}

export const server = await createServer();

async function getRuntimeToken(): Promise<string | undefined> {
    if (!isWebWorker()) {
        return localStorage.token || undefined;
    }

    return (await db.config.get('token'))?.value as string | undefined;
}

async function getRuntimeServerUrl(): Promise<string> {
    if (!isWebWorker() && localStorage.server) {
        return localStorage.server;
    }

    return (await KV.value('serverUrl')) || resolveRuntimeUrl('/').origin;
}

export function stdurl(url: string | URL): URL {
    try {
        url = new URL(url);
    } catch (err) {
        if (err instanceof TypeError) {
            url = new URL(String(self.location.origin).replace(/\/$/, '') + url);
        } else {
            throw err;
        }
    }

    return url;
}

/**
 * Standardize interactions with the backend API
 *
 * @param {URL|String} url      - Full URL or API fragment to request
 * @param {Object} [opts={}]    - Options
 */
export async function std(
    url: string | URL,
    opts: {
        token?: string;
        download?: boolean | string;
        headers?: Record<string, string>;
        body?: unknown;
        method?: string;
    } = {}
): Promise<unknown> {
    url = stdurl(url)
    if (!opts) opts = {};

    if (!opts.headers) opts.headers = {};

    const authToken = opts.token || await getRuntimeToken();

    if (!(opts.body instanceof FormData) && typeof opts.body === 'object' && !opts.headers['Content-Type']) {
        opts.body = JSON.stringify(opts.body);
        opts.headers['Content-Type'] = 'application/json';
    }

    if (authToken && !opts.headers.Authorization) {
        opts.headers['Authorization'] = 'Bearer ' + authToken;
    }

    const res = await fetch(url, opts as RequestInit);

    if ((res.status < 200 || res.status >= 400) && ![401].includes(res.status)) {
        let bdy: Record<string, unknown> | APIError;
        try {
            bdy = await res.json() as Record<string, unknown>;
        } catch (cause) {
            throw new Error(`Status Code: ${res.status}: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
        }

        const errbody = bdy as APIError;
        const err = new Error(errbody.message || `Status Code: ${res.status}`);
        // @ts-expect-error TODO Fix this
        err.body = bdy;
        throw err;
    } else if (res.status === 401) {
        if (!isWebWorker()) {
            delete localStorage.token;
        }
        throw new Error('401');
    }

    const ContentType = res.headers.get('Content-Type');
    const ContentDisposition = res.headers.get('Content-Disposition');

    if (opts.download) {
        let name = 'download';
        if (typeof opts.download === 'string') {
            name = opts.download;
        } else if (ContentDisposition) {
            const regex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            const matches = regex.exec(ContentDisposition);
            if (matches && matches[1]) {
                name = matches[1].replace(/['"]/g, '');
            }
        }

        const object = new File([await res.blob()], name);
        const file = window.URL.createObjectURL(object);

        const link = document.createElement('a');
        link.href = file;
        link.download = name; // This is the magic attribute

        // Append to body, click, and then remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the blob URL to prevent memory leaks
        window.URL.revokeObjectURL(file);

        return res;
    } else if (ContentType && ContentType.includes('application/json')) {
        return await res.json();
    } else {
        return res;
    }
}

export function humanSeconds(seconds: number): string {
        const date = new Date(seconds * 1000);
        const str = [];
        if (date.getUTCDate()-1 !== 0) str.push(date.getUTCDate()-1 + " days");
        if (date.getUTCHours() !== 0 ) str.push(date.getUTCHours() + " hrs");
        if (date.getUTCMinutes() !== 0) str.push(date.getUTCMinutes() + " mins");
        if (date.getUTCSeconds() !== 0) str.push(date.getUTCSeconds() + " secs");
        if (date.getUTCMilliseconds() !== 0) str.push(date.getUTCMilliseconds() + " ms");
        return str.join(', ');
}

function isWebWorker() {
    return typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
}


export function stdclick($router: Router, event: MouseEvent | KeyboardEvent, path: string) {
    if (event.ctrlKey === true) {
        const routeData = $router.resolve(path);
        void openSecondaryView(routeData.href);
    } else {
        $router.push(path);
    }
}
