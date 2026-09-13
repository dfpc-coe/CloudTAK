import { stdurl } from '../../../std.ts';

/**
 * Rewrite remote <img> sources in an HTML fragment to load through the
 * CloudTAK image proxy so they are permitted by the Content-Security-Policy
 */
export function proxyHtmlImages(html: string, token?: string | null): string {
    if (!/<img\b/i.test(html)) return html;

    // A template preserves head-only elements (style, meta, title) that a
    // full document parse would move out of the body
    const template = document.createElement('template');
    template.innerHTML = html;
    const apiOrigin = stdurl('/').origin;

    for (const img of template.content.querySelectorAll('img[src]')) {
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

    return template.innerHTML;
}

/**
 * Extract the value of an HTML description (`{"@type":"html","value":...}`) from feature properties
 */
export function featureHtmlDescription(properties: Record<string, unknown> | null | undefined): string | null {
    const raw = properties?.description;
    if (typeof raw !== 'string' || !raw) return null;

    try {
        const desc = JSON.parse(raw);
        if (desc['@type'] === 'html' && typeof desc.value === 'string' && desc.value) {
            return desc.value;
        }
    } catch {
        return null;
    }

    return null;
}
