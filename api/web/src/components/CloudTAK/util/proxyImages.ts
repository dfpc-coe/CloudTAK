import { stdurl } from '../../../std.ts';

/**
 * Rewrite remote <img> sources in an HTML fragment to load through the
 * CloudTAK image proxy so they are permitted by the Content-Security-Policy
 */
export function proxyHtmlImages(html: string, token?: string | null): string {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const apiOrigin = stdurl('/').origin;

    for (const img of doc.querySelectorAll('img[src]')) {
        const src = img.getAttribute('src') || '';

        let url: URL;
        try {
            url = new URL(src);
        } catch {
            continue;
        }

        if (!['http:', 'https:'].includes(url.protocol)) continue;
        if (url.origin === apiOrigin) continue;

        const proxied = stdurl('/api/proxy/image');
        proxied.searchParams.set('url', url.href);
        if (token) proxied.searchParams.set('token', token);

        img.setAttribute('src', proxied.href);
    }

    return doc.body.innerHTML;
}

/**
 * Extract an HTML description (`{"@type":"html","value":...}`) from feature
 * properties with remote images routed through the proxy
 */
export function featureHtmlDescription(properties: Record<string, unknown> | null | undefined, token?: string | null): string | null {
    const raw = properties?.description;
    if (typeof raw !== 'string' || !raw) return null;

    try {
        const desc = JSON.parse(raw);
        if (desc && desc['@type'] === 'html' && desc.value) {
            return proxyHtmlImages(String(desc.value), token);
        }
    } catch {
        return null;
    }

    return null;
}
