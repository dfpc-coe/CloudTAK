/**
 * Icon Manager - on-demand style image resolution
 *
 * Registered as the map's missing style image resolver
 * (`Map.setMissingStyleImageResolver`): when a symbol layer references an
 * image id MapLibre doesn't have, the resolver hydrates it before the tile
 * renders. Images therefore only occupy MapLibre memory once a feature
 * actually requests them.
 *
 * Supported id shapes:
 *  - `2525C:<sidc>` / `2525D:<sidc>` / `2525E:<sidc>`
 *                            - milsymbol-generated military symbols
 *  - `<base>-colored-<hex>`  - runtime-recolored variant of another image
 *  - `<iconsetUid>:<path>`   - iconset icons served from Dexie with a network
 *                              fallback for icons that haven't synced locally
 *
 * Bulk hydration of the Dexie icon cache is owned by the Atlas worker (see
 * workers/atlas-sync.ts) and primes the offline cache; only iconsets whose
 * content changed purge their MapLibre images, while first-time cached
 * iconsets merely retry fallback placeholders.
 */
import { Preferences } from '@capacitor/preferences';
import ms from 'milsymbol'
import * as mapgl from 'maplibre-gl'
import Icon from '../../base/icon.ts'
import IconsetManager from '../../base/iconset.ts';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { stdurl } from '../../std.ts';
import { db, type DBSprite } from '../../database.ts';

/** Target render width (px) used when rasterizing SVG iconset icons; height preserves the source aspect ratio. */
const SVG_RENDER_WIDTH = 32;

/**
 * Custom MapLibre protocol used to serve built-in spritesheets out of Dexie
 * (with a network fallback). MapLibre will request `<url>.json` /
 * `<url>.png` (and the `@2x` variants) so the handler must accept any of
 * those suffixes.
 */
const SPRITE_PROTOCOL = 'cloudtak-sprite';
let spriteProtocolRegistered = false;

export default class IconManager {
    private map: MapLibreMap;
    private inflight = new Map<string, Promise<void>>();
    private loggedErrors = new Set<string>();
    private fallbackBitmap: ImageBitmap | null = null;
    /**
     * Image ids registered with the generic fallback bitmap (or recolored
     * from one) because the real icon couldn't be loaded at resolve time.
     * These are retried once the owning iconset lands in Dexie.
     */
    private fallbackIds = new Set<string>();

    constructor(map: MapLibreMap) {
        this.map = map;

        map.setMissingStyleImageResolver((id) => this.resolve(id));
    }

    private logWarnOnce(key: string, message: string, context?: Record<string, unknown>): void {
        if (this.loggedErrors.has(key)) return;
        this.loggedErrors.add(key);

        console.warn(message, context ?? {});
    }

    private logErrorOnce(key: string, message: string, error: unknown, context?: Record<string, unknown>): void {
        if (this.loggedErrors.has(key)) return;
        this.loggedErrors.add(key);

        console.error(message, {
            ...(context ?? {}),
            error
        });
    }

    /**
     * MapLibre style sprite descriptor. Iconset icons are served on demand
     * from Dexie via the missing style image resolver; only the small
     * built-in `default` sprite is loaded up-front because it provides the
     * CoT-type fallbacks.
     *
     * The default sprite itself is also served from the Dexie cache via the
     * `cloudtak-sprite://` protocol (see `registerSpriteProtocol`) so it
     * survives offline reloads instead of re-downloading on every page load.
     */
    static defaultSprite(): Array<{ id: string; url: string }> {
        IconManager.registerSpriteProtocol();

        return [{
            id: 'default',
            url: `${SPRITE_PROTOCOL}://default`
        }];
    }

    /**
     * Register the global MapLibre protocol that resolves
     * `cloudtak-sprite://<id>(@2x)?.(json|png)` requests against the Dexie
     * `sprite` table, falling back to the API and persisting the response so
     * subsequent loads are served from disk.
     */
    static registerSpriteProtocol(): void {
        if (spriteProtocolRegistered) return;
        spriteProtocolRegistered = true;

        mapgl.addProtocol(SPRITE_PROTOCOL, async (params) => {
            // MapLibre appends `.json`/`.png` (and `@2x`) suffixes after
            // normalizing via `new URL()`, so ids may appear with or without a
            // trailing slash. `@` is excluded from the id class so the optional
            // pixel-ratio suffix matches its own group instead of the id.
            const match = /^cloudtak-sprite:\/\/([^/.@]+)\/?(?:@\dx)?\.(json|png)$/.exec(params.url);
            if (!match) throw new Error(`Unsupported sprite URL: ${params.url}`);

            const [, id, ext] = match;

            let row = await db.sprite.get(id);
            if (!row) row = await fetchAndCacheSprite(id);

            if (ext === 'json') {
                return { data: row.json };
            }

            return { data: await row.image.arrayBuffer() };
        });
    }

    /**
     * Missing style image resolver entry point. MapLibre awaits the returned
     * promise before rendering the requesting tile, so the image must be
     * registered by the time it settles.
     *
     * Must never reject: a rejected resolver promise fails the whole image
     * batch for the tile, so failures are logged and the id is left
     * unresolved (MapLibre then fires the legacy `styleimagemissing` event
     * and renders the feature without an icon).
     */
    async resolve(id: string): Promise<void> {
        const inflight = this.inflight.get(id);
        if (inflight) return inflight;

        const work = this.resolveImage(id)
            .catch((error: unknown) => {
                this.logErrorOnce(
                    `resolve:${id}`,
                    'Failed to resolve missing style image',
                    error,
                    { imageId: id }
                );
            })
            .finally(() => {
                this.inflight.delete(id);
            });

        this.inflight.set(id, work);
        return work;
    }

    private async resolveImage(id: string): Promise<void> {
        if (this.map.hasImage(id)) return;

        if (id.startsWith('2525C:') || id.startsWith('2525D:') || id.startsWith('2525E:')) {
            const sidc = id.replace(/^2525[CDE]:/, '');
            const symbol = new ms.Symbol(sidc, { size: 24 }).asCanvas();

            this.addImage(id, await createImageBitmap(symbol));
        } else if (id.includes('-colored-')) {
            const separator = id.lastIndexOf('-colored-');
            const baseId = id.slice(0, separator);
            const color = '#' + id.slice(separator + '-colored-'.length);

            // The base image may itself be an on-demand icon that hasn't
            // been requested yet - resolve it before recoloring.
            if (!this.map.hasImage(baseId)) await this.resolve(baseId);

            this.addColoredImage(id, baseId, color);
        } else if (id.includes(':')) {
            await this.loadIconsetImage(id);
        } else {
            this.logWarnOnce(
                `unhandled:${id}`,
                'Unhandled missing style image',
                { imageId: id }
            );
        }
    }

    /**
     * Resolve an `<iconsetUid>:<path>` image id from Dexie, falling back to
     * fetching the single icon from the API (for iconsets that haven't been
     * hydrated locally) and finally to a generic point icon.
     */
    private async loadIconsetImage(id: string): Promise<void> {
        const row = await Icon.get(id);
        const blob = row ? row.data : await Icon.fetchRemote(id);

        if (blob) {
            this.fallbackIds.delete(id);
            this.addImage(id, await this.decodeIconBlob(blob));
            return;
        }

        this.logWarnOnce(
            `missing-iconset-icon:${id}`,
            'Iconset icon not found locally or remotely, using fallback',
            { imageId: id }
        );

        this.fallbackIds.add(id);
        this.addImage(id, await this.getFallbackBitmap());
    }

    private addImage(id: string, image: ImageBitmap | ImageData): void {
        if (!this.map.hasImage(id)) {
            this.map.addImage(id, image);
        }
    }

    /**
     * Remove all MapLibre images belonging to the given iconsets (including
     * colored variants, whose ids share the `<uid>:` prefix). MapLibre
     * re-requests removed images through the missing style image resolver
     * the next time a feature needs them, so purging is all that's required
     * to pick up refreshed Dexie content.
     */
    purgeIconsets(uids: string[]): void {
        const prefixes = uids.map((uid) => `${uid}:`);
        if (!prefixes.length) return;

        for (const id of this.map.listImages()) {
            if (prefixes.some((prefix) => id.startsWith(prefix))) {
                this.fallbackIds.delete(id);
                this.map.removeImage(id);
            }
        }
    }

    /**
     * Retry fallback placeholder images belonging to the given iconsets.
     * Used when an iconset is cached in Dexie for the first time: icons that
     * already resolved successfully (via the network fallback) are identical
     * to the newly cached rows and are left untouched - only ids stuck on
     * the generic fallback bitmap are dropped so they re-resolve.
     */
    purgeFallbacks(uids: string[]): void {
        const prefixes = uids.map((uid) => `${uid}:`);
        if (!prefixes.length || !this.fallbackIds.size) return;

        for (const id of [...this.fallbackIds]) {
            if (prefixes.some((prefix) => id.startsWith(prefix))) {
                this.fallbackIds.delete(id);
                if (this.map.hasImage(id)) this.map.removeImage(id);
            }
        }
    }

    async deleteIconset(uid: string): Promise<void> {
        await IconsetManager.delete(uid);
        this.purgeIconsets([uid]);
    }

    /**
     * Decode an iconset blob into an `ImageBitmap`.
     *
     * Raster formats (PNG/JPEG/...) decode directly via `createImageBitmap`.
     * SVG blobs need special handling: `createImageBitmap` cannot decode
     * `image/svg+xml` blobs in some browsers (notably Firefox, which rejects
     * with a `DOMException`), so those are rasterized through an
     * `HTMLImageElement` + `<canvas>` instead.
     */
    private async decodeIconBlob(blob: Blob): Promise<ImageBitmap> {
        if (blob.type === 'image/svg+xml') {
            return await this.decodeSvgBlob(blob);
        }

        try {
            return await createImageBitmap(blob);
        } catch {
            // Fall back to the canvas rasterization path for blobs that
            // `createImageBitmap` can't decode directly (e.g. SVGs served
            // without an accurate MIME type).
            return await this.decodeSvgBlob(blob);
        }
    }

    /**
     * Rasterize an SVG blob into an `ImageBitmap` via an `HTMLImageElement`
     * drawn onto a `<canvas>`. Many iconset SVGs only declare a `viewBox` and
     * no intrinsic `width`/`height`; without an explicit size browsers fall
     * back to a 300x150 default, so the size is derived from the viewBox and
     * set explicitly before rasterizing.
     */
    private async decodeSvgBlob(blob: Blob): Promise<ImageBitmap> {
        const text = await blob.text();

        const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
        const svgEl = doc.documentElement;

        if (!svgEl || svgEl.nodeName.toLowerCase() !== 'svg') {
            throw new Error('Invalid SVG icon payload');
        }

        let width = parseFloat(svgEl.getAttribute('width') ?? '');
        let height = parseFloat(svgEl.getAttribute('height') ?? '');

        if (!(width > 0) || !(height > 0)) {
            const viewBox = (svgEl.getAttribute('viewBox') ?? '')
                .split(/[\s,]+/)
                .map(Number);

            if (viewBox.length === 4 && viewBox[2] > 0 && viewBox[3] > 0) {
                width = viewBox[2];
                height = viewBox[3];
            }
        }

        if (!(width > 0) || !(height > 0)) {
            width = SVG_RENDER_WIDTH;
            height = SVG_RENDER_WIDTH;
        }

        // Rasterize at a fixed 32px width so icons render consistently, while
        // preserving the source aspect ratio.
        const scale = SVG_RENDER_WIDTH / width;
        const renderWidth = Math.max(1, Math.round(width * scale));
        const renderHeight = Math.max(1, Math.round(height * scale));

        svgEl.setAttribute('width', String(renderWidth));
        svgEl.setAttribute('height', String(renderHeight));

        const normalized = new XMLSerializer().serializeToString(svgEl);
        const url = URL.createObjectURL(new Blob([normalized], { type: 'image/svg+xml' }));

        try {
            const img = new Image();
            img.decoding = 'async';

            await new Promise<void>((resolve, reject) => {
                img.onload = () => { resolve(); };
                img.onerror = () => { reject(new Error('Failed to decode SVG icon')); };
                img.src = url;
            });

            const canvas = document.createElement('canvas');
            canvas.width = renderWidth;
            canvas.height = renderHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas 2D context unavailable for SVG icon');

            ctx.drawImage(img, 0, 0, renderWidth, renderHeight);

            return await createImageBitmap(canvas);
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    private async getFallbackBitmap(): Promise<ImageBitmap> {
        if (this.fallbackBitmap) return this.fallbackBitmap;

        const size = 24;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        this.fallbackBitmap = await createImageBitmap(canvas);

        return this.fallbackBitmap;
    }

    /**
     * Register a recolored copy of an already-registered base image.
     */
    private addColoredImage(id: string, baseId: string, color: string): void {
        const base = this.map.getImage(baseId);
        if (!base) {
            this.logWarnOnce(
                `missing-icon:${baseId}`,
                'Base icon not found in map when attempting recolor',
                { baseId, color, coloredIconId: id }
            );
            return;
        }

        const imageData = new ImageData(
            new Uint8ClampedArray(base.data.data),
            base.data.width,
            base.data.height
        );

        this.recolorWhitePixels(imageData, color);

        // A recolor of a fallback placeholder is itself a placeholder and
        // should be retried once the real base icon becomes available.
        if (this.fallbackIds.has(baseId)) this.fallbackIds.add(id);
        else this.fallbackIds.delete(id);

        this.addImage(id, imageData);
    }

    /**
     * Replace white/light pixels with the target color
     */
    private recolorWhitePixels(imageData: ImageData, color: string): void {
        const data = imageData.data;
        const [r, g, b] = this.hexToRgb(color);

        for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];

            if (alpha === 0) continue;

            if (this.isWhitePixel(data[i], data[i + 1], data[i + 2])) {
                data[i] = r;
                data[i + 1] = g;
                data[i + 2] = b;
            }
        }
    }

    /**
     * Check if a pixel is considered "white" (should be recolored)
     */
    private isWhitePixel(r: number, g: number, b: number): boolean {
        return r > 200 && g > 200 && b > 200;
    }

    /**
     * Convert hex color to RGB values
     */
    private hexToRgb(hex: string): [number, number, number] {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16)
        ] : [0, 255, 0]; // Default to green if parsing fails
    }
}

/**
 * Fallback path for the sprite protocol: when Dexie has no row for the
 * requested built-in sprite (typically only on a brand-new install where icon
 * hydration hasn't completed yet) fetch it from the API and persist it so the
 * next request is served from disk.
 */
async function fetchAndCacheSprite(id: string): Promise<DBSprite> {
    const token = await getToken();
    const jsonUrl = stdurl(`/api/iconset/${id}/sprite.json`);
    const pngUrl = stdurl(`/api/iconset/${id}/sprite.png`);
    if (token) jsonUrl.searchParams.set('token', token);
    if (token) pngUrl.searchParams.set('token', token);

    const [jsonRes, pngRes] = await Promise.all([fetch(jsonUrl), fetch(pngUrl)]);
    if (!jsonRes.ok) throw new Error(`Failed to load sprite '${id}' json (${jsonRes.status})`);
    if (!pngRes.ok) throw new Error(`Failed to load sprite '${id}' png (${pngRes.status})`);

    const json = await jsonRes.json() as Record<string, unknown>;
    const image = await pngRes.blob();

    const row: DBSprite = { id, updated: Date.now(), json, image };
    await db.sprite.put(row);
    return row;
}

async function getToken(): Promise<string> {
    const { value } = await Preferences.get({ key: 'token' });
    if (!value) throw new Error('No authentication token available');
    return value;
}
