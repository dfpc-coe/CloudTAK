import Err from '@openaddresses/batch-error';

/**
 * Cesium ion 3D Tiles assets that users may add as overlays. Only list assets
 * whose attribution terms are met by the map attribution control.
 */
export const IonAssets = {
    'osm-buildings': { id: 96188, label: 'OSM Buildings' },
} as const;

export type IonAssetName = keyof typeof IonAssets;

export interface IonAttribution {
    text: string;
    image?: string;
}

export interface IonAccess {
    url: string;
    accessToken?: string;
    attributions: IonAttribution[];
}

interface IonEndpointRaw {
    type?: string;
    url?: string;
    accessToken?: string;
    options?: { url?: string };
    attributions?: Array<{ html?: string }>;
}

const EXPIRY_MARGIN_MS = 5 * 60 * 1000;
const FALLBACK_TTL_MS = 50 * 60 * 1000;

const ENTITIES: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': '\'',
    '&nbsp;': ' ',
    '&copy;': '©',
};

export function isIonAssetName(name: string): name is IonAssetName {
    return Object.prototype.hasOwnProperty.call(IonAssets, name);
}

export function tokenExpiry(token: string): number | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    try {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
    } catch {
        return null;
    }
}

function isCesiumImage(src: string): boolean {
    try {
        const url = new URL(src);
        return url.protocol === 'https:' && (url.hostname === 'cesium.com' || url.hostname.endsWith('.cesium.com'));
    } catch {
        return false;
    }
}

/**
 * Reduce an ion attribution HTML snippet to plain text plus an optional
 * image hosted by Cesium, so no third-party markup reaches the browser.
 */
export function parseAttribution(html: string): IonAttribution {
    const text = html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&[a-z#0-9]+;/gi, entity => ENTITIES[entity] ?? ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const src = html.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1];

    return src && isCesiumImage(src) ? { text, image: src } : { text };
}

export default class IonControl {
    fetch: typeof fetch;
    now: () => number;
    cache: Map<IonAssetName, { token: string; expires: number; access: IonAccess }>;

    constructor(opts: { fetch?: typeof fetch; now?: () => number } = {}) {
        this.fetch = opts.fetch ?? ((input, init) => globalThis.fetch(input, init));
        this.now = opts.now ?? Date.now;
        this.cache = new Map();
    }

    async endpoint(name: IonAssetName, token: string): Promise<IonAccess> {
        const cached = this.cache.get(name);
        if (cached && cached.token === token && cached.expires > this.now()) {
            return cached.access;
        }

        let res: Response;
        try {
            res = await this.fetch(`https://api.cesium.com/v1/assets/${IonAssets[name].id}/endpoint`, {
                headers: { Authorization: `Bearer ${token}` },
            });
        } catch (err) {
            throw new Err(502, err instanceof Error ? err : new Error(String(err)), 'Cesium ion is unreachable');
        }

        if (res.status === 401 || res.status === 403) {
            throw new Err(502, null, 'Cesium ion rejected the token');
        } else if (!res.ok) {
            throw new Err(502, null, `Cesium ion returned ${res.status}`);
        }

        let raw: IonEndpointRaw;
        try {
            raw = await res.json() as IonEndpointRaw;
        } catch (err) {
            throw new Err(502, err instanceof Error ? err : new Error(String(err)), 'Cesium ion returned invalid JSON');
        }

        if (raw.type !== '3DTILES') {
            throw new Err(502, null, `Unsupported Cesium ion asset type: ${raw.type}`);
        }

        const url = raw.url ?? raw.options?.url;
        if (!url) throw new Err(502, null, 'Cesium ion returned no tileset URL');

        const access: IonAccess = {
            url,
            attributions: (raw.attributions ?? []).map(a => parseAttribution(a.html ?? '')),
        };
        if (raw.accessToken) access.accessToken = raw.accessToken;

        const exp = raw.accessToken ? tokenExpiry(raw.accessToken) : null;
        const expires = exp !== null ? exp - EXPIRY_MARGIN_MS : this.now() + FALLBACK_TTL_MS;

        this.cache.set(name, { token, expires, access });

        return access;
    }
}

export const ionControl = new IonControl();
