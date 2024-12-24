import type { APIError } from './types.js'
import type { Router } from 'vue-router'

export function stdurl(url: string | URL): URL {
    try {
        url = new URL(url);
    } catch (err) {
        if (err instanceof TypeError) {
            url = new URL((process.env.API_URL || window.location.origin) + url);
        } else {
            throw err;
        }
    }

    // Allow serving through Vue for hotloading
    // Disable if serving over 5000 as that's likely a docker compose install
    if (
        url.hostname === 'localhost'
        && url.port !== '5000'
    ) url.port = '5001'

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
        download?: boolean | string;
        headers?: Record<string, string>;
        body?: unknown;
        method?: string;
    } = {}
): Promise<unknown> {
    url = stdurl(url)
    if (!opts) opts = {};

    if (!opts.headers) opts.headers = {};

    if (!(opts.body instanceof FormData) && typeof opts.body === 'object' && !opts.headers['Content-Type']) {
        opts.body = JSON.stringify(opts.body);
        opts.headers['Content-Type'] = 'application/json';
    }

    if (localStorage.token && !opts.headers.Authorization) {
        opts.headers['Authorization'] = 'Bearer ' + localStorage.token;
    }

    const res = await fetch(url, opts as RequestInit);

    let bdy = {};
    if ((res.status < 200 || res.status >= 400) && ![401].includes(res.status)) {
        try {
            bdy = await res.json();
        } catch (err) {
            throw new Error(`Status Code: ${res.status}: ${err instanceof Error ? err.message : String(err)}`);
        }

        const errbody = bdy as APIError;
        const err = new Error(errbody.message || `Status Code: ${res.status}`);
        // @ts-expect-error TODO Fix this
        err.body = bdy;
        throw err;
    } else if (res.status === 401) {
        delete localStorage.token;
        throw new Error('401');
    }

    const ContentType = res.headers.get('Content-Type');

    if (opts.download) {
        const object = new File([await res.blob()], typeof opts.download === 'string' ? opts.download : 'download');
        const file = window.URL.createObjectURL(object);
        window.location.assign(file);
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

export function stdclick($router: Router, event: MouseEvent, path: string) {
    if (event.ctrlKey === true) {
        const routeData = $router.resolve(path);
        window.open(routeData.href, '_blank');
    } else {
        $router.push(path);
    }
}
