import createClient from "openapi-fetch";
import { Browser } from '@capacitor/browser';
import { Preferences } from '@capacitor/preferences';
import KV from './base/kv.ts'
import type { Middleware } from "openapi-fetch";
import type { paths } from '@cloudtak/api-types'
import type { APIError } from './types.js'
import type { Router } from 'vue-router'
import { isNativePlatform, openSecondaryView } from './base/capacitor.ts';
import { reportError } from './lib/reporting/index.ts';
import { db } from './database.ts';

export const serverUrl = await getRuntimeServerUrl();
export const server = await getServer();

export async function getServer() {
    const server = createClient<paths>({
        baseUrl: serverUrl,
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

    const errorReportMiddleware: Middleware = {
        async onResponse({ request, response }) {
            const status = response.status;

            const shouldReport =
                status >= 500 ||
                (status >= 400 && ![401, 403].includes(status));

            if (!shouldReport) return;

            // Avoid infinite loop - never report failures on the error endpoint itself.
            if (request.url.includes('/api/error')) return;

            let body: string;
            try {
                body = (await response.clone().text()) || '<empty>';
            } catch {
                body = '<unreadable>';
            }

            reportError(`HTTP ${status}: ${request.method} ${request.url}`, body);
        },
    };

    server.use(authMiddleware, errorReportMiddleware);

    return server;
}

export async function getRuntimeToken(): Promise<string | undefined> {
    if (!isWebWorker()) {
        const { value } = await Preferences.get({ key: 'token' });
        return value || undefined;
    }

    return (await db.config.get('token'))?.value as string | undefined;
}

async function getRuntimeServerUrl(): Promise<string> {
    if (!isWebWorker()) {
        const { value } = await Preferences.get({ key: 'serverUrl' });
        return value || getRuntimeOrigin();
    }

    return (await KV.value('serverUrl')) || getRuntimeOrigin();
}

function getRuntimeOrigin(): string {
    if (typeof location !== 'undefined' && location.origin) {
        return location.origin;
    }

    if (typeof window !== 'undefined' && window.location.origin) {
        return window.location.origin;
    }

    if (typeof self !== 'undefined' && self.location.origin) {
        return self.location.origin;
    }

    return 'http://localhost';
}

export function stdurl(url: string | URL): URL {
    try {
        url = new URL(url);
    } catch (err) {
        if (err instanceof TypeError) {
            url = new URL(String(serverUrl).replace(/\/$/, '') + url);
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
        signal?: AbortSignal;
        timeout?: number;
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

    // Guard every request with a timeout so a stalled connection (common on
    // native cold-starts where the network stack is not yet warm) rejects
    // instead of hanging forever and trapping the UI on the loading splash.
    const timeoutMs = opts.timeout ?? DEFAULT_REQUEST_TIMEOUT_MS;
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
    const signal = opts.signal
        ? anySignal([opts.signal, timeoutController.signal])
        : timeoutController.signal;

    let res: Response;
    try {
        res = await fetch(url, { ...(opts as RequestInit), signal });
    } catch (err) {
        if (timeoutController.signal.aborted) {
            throw new Error(`Request timed out after ${timeoutMs}ms: ${String(url)}`, { cause: err });
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }

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
        // Verify the token is actually invalid before removing it.
        // An upstream service may return an unrelated 401 that does not
        // mean the stored token has expired or been revoked.
        const loginHeaders: Record<string, string> = {};
        if (authToken) loginHeaders['Authorization'] = `Bearer ${authToken}`;
        const loginRes = await fetch(stdurl('/login'), { headers: loginHeaders });

        if (loginRes.status === 401 && !isWebWorker()) {
            await Preferences.remove({ key: 'token' });
        }

        throw new Error('401');
    }

    const ContentType = res.headers.get('Content-Type');
    if (opts.download) {
        downloadBlob(await res.blob(), res, typeof opts.download === 'string' ? opts.download : 'download');

        return res;
    } else if (ContentType && ContentType.includes('application/json')) {
        return await res.json();
    } else {
        return res;
    }
}

/**
 * Default timeout applied to every API request issued through `std()`.
 */
const DEFAULT_REQUEST_TIMEOUT_MS = 20000;

/**
 * Combine multiple AbortSignals into a single signal that aborts when any of
 * the inputs abort. Avoids relying on `AbortSignal.any`, which is unavailable
 * in older WebKit/WKWebView runtimes.
 */
function anySignal(signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();

    for (const signal of signals) {
        if (signal.aborted) {
            controller.abort();
            break;
        }

        signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    return controller.signal;
}

export function downloadBlob(blob: Blob, response: Response, fallbackName: string): void {
    const contentDisposition = response.headers.get('Content-Disposition');
    let name = fallbackName;

    if (contentDisposition) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
        if (matches?.[1]) {
            name = matches[1].replace(/['"]/g, '');
        }
    }

    const fileUrl = URL.createObjectURL(new File([blob], name));
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(fileUrl);
}

export async function downloadUrl(
    url: string | URL,
    opts: {
        filename?: string;
        token?: boolean;
        native?: boolean;
    } = {}
): Promise<void> {
    if (isWebWorker()) throw new Error('Downloads require a browser context');

    const href = stdurl(url);

    if (opts.token) {
        const token = await getRuntimeToken();
        if (token) href.searchParams.set('token', token);
    }

    if (opts.native !== false && isNativePlatform()) {
        await Browser.open({ url: href.toString() });
        return;
    }

    const link = document.createElement('a');
    link.href = href.toString();
    link.rel = 'noopener';
    if (opts.filename) link.download = opts.filename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

