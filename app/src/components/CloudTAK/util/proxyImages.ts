import { stdurl } from '../../../std.ts';

/**
 * Rewrite a remote image URL to load through the CloudTAK image proxy so it
 * is permitted by the Content-Security-Policy - same-origin URLs pass through
 */
export function proxyImageUrl(src: string, token?: string | null): string | null {
    let url: URL;
    try {
        url = new URL(src);
    } catch {
        return null;
    }

    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.origin === stdurl('/').origin) return url.href;

    const proxied = stdurl('/api/proxy/image');
    proxied.searchParams.set('url', url.href);
    if (token) proxied.searchParams.set('token', token);

    return proxied.href;
}

const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|avif|bmp|svg)$/i;

/**
 * Whether a CoT link points at an image, by declared mime type or URL extension
 */
export function isImageLink(link: { url?: string; mime?: string }): boolean {
    if (link.mime && link.mime.toLowerCase().startsWith('image/')) return true;
    if (!link.url) return false;

    try {
        return IMAGE_EXTENSIONS.test(new URL(link.url).pathname);
    } catch {
        return false;
    }
}

/**
 * Rewrite remote <img> sources in an HTML fragment through the image proxy
 */
export function proxyHtmlImages(html: string, token?: string | null): string {
    if (!/<img\b/i.test(html)) return html;

    // A template preserves head-only elements (style, meta, title) that a
    // full document parse would move out of the body
    const template = document.createElement('template');
    template.innerHTML = html;

    for (const img of template.content.querySelectorAll('img[src]')) {
        const proxied = proxyImageUrl(img.getAttribute('src') || '', token);
        if (proxied) img.setAttribute('src', proxied);
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
