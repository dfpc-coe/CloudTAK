/**
 * Icon Color Manager for runtime icon recoloring
 */
import { Preferences } from '@capacitor/preferences';
import ms from 'milsymbol'
import * as mapgl from 'maplibre-gl'
import Icon, { type IconHydrateResult } from '../../base/icon.ts'
import IconsetManager from '../../base/iconset.ts';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { stdurl } from '../../std.ts';
import { db, type DBIconset, type DBSprite } from '../../database.ts';

/** Image id for the on-demand fallback when an iconset icon isn't available locally. */
const FALLBACK_IMAGE_ID = '__cloudtak_fallback_point__';

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
    private cache = new Map<string, HTMLCanvasElement>();
    private map: MapLibreMap;
    private loggedMissingImageIds = new Set<string>();
    private loggedErrors = new Set<string>();
    private inflightImage = new Map<string, Promise<boolean>>();
    private fallbackBitmap: ImageBitmap | null = null;
    private requestedIconsetImageIds = new Set<string>();

    constructor(map: MapLibreMap) {
        this.map = map;
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

    static async from(uid: string): Promise<DBIconset | undefined> {
        return await db.iconset.get(uid);
    }

    /**
     * MapLibre style sprite descriptor. The custom iconset spritesheets are no
     * longer loaded here; icons are served on demand from Dexie via
     * `onStyleImageMissing`. Only the small built-in `default` sprite is loaded
     * up-front because it provides the CoT-type fallbacks.
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
            // MapLibre normalizes the declared sprite URL through `new URL()`
            // before appending the `.json`/`.png` (and `@2x`) suffixes, so the
            // handler sees URLs in two shapes:
            //   cloudtak-sprite://<id>.json          (no path separator)
            //   cloudtak-sprite://<id>/.json         (URL-normalized form)
            //   cloudtak-sprite://<id>@2x.png        (HiDPI, no separator)
            //   cloudtak-sprite://<id>/@2x.png       (HiDPI, normalized)
            // `@` must be excluded from the id class so the optional
            // pixel-ratio suffix is matched by its dedicated group instead of
            // being swallowed into the id.
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
     * Hydrate the local Dexie icon cache from the API.
     *
     * This method also handles main-thread concerns like purging stale MapLibre
     * images when the local Dexie cache changes.
     */
    async hydrate(opts: { force?: boolean } = {}): Promise<void> {
        const result = await Icon.hydrate({ token: await getToken(), force: !!opts.force }) as IconHydrateResult;
        await this.applyHydrateResult(result);
    }

    /**
     * Ensure a single iconset is present in Dexie. Used by overlays that
     * reference a specific iconset so it is available even if the user-wide
     * hydrate hasn't completed yet.
     */
    async addIconset(uid: string, opts: { force?: boolean } = {}): Promise<void> {
        const updated = await Icon.addIconset(uid, { token: await getToken(), force: !!opts.force });
        if (updated) await this.reloadIconsetImages(uid);
    }

    async removeIconset(uid: string): Promise<void> {
        const cached = await IconsetManager.from(uid);
        await IconsetManager.delete(uid, { localOnly: true });

        if (cached) {
            this.purgeMapImagesForIconset(uid);
            this.removeRequestedImagesForIconset(uid);
        }
    }

    async deleteIconset(uid: string): Promise<void> {
        await IconsetManager.delete(uid);
        this.purgeMapImagesForIconset(uid);
        this.removeRequestedImagesForIconset(uid);
    }

    private async applyHydrateResult(result: IconHydrateResult): Promise<void> {
        if (result.skipped) return;

        for (const uid of result.removed) {
            this.purgeMapImagesForIconset(uid);
            this.removeRequestedImagesForIconset(uid);
        }

        await Promise.all(result.changed.map((uid) => this.reloadIconsetImages(uid)));
    }

    private purgeMapImagesForIconset(uid: string): void {
        const prefix = `${uid}:`;
        for (const id of this.map.listImages()) {
            if (id.startsWith(prefix)) {
                this.map.removeImage(id);
            }
        }
    }

    public async onStyleImageMissing(e: { id: string }): Promise<void> {
        try {
            if (e.id.startsWith('2525D:')) {
                const sidc = e.id.replace('2525D:', '');
                const size = 24;
                const data = new ms.Symbol(sidc, { size }).asCanvas();

                this.map.addImage(e.id, await createImageBitmap(data));
            } else if (e.id.includes('-colored-')) {
                // This is a colored icon, we need to load it from the icon manager
                const parts = e.id.split('-colored-');
                const originalIconId = parts[0];
                const color = '#' + parts[1];

                if (originalIconId.includes(':')) {
                    this.requestedIconsetImageIds.add(originalIconId);
                    this.requestedIconsetImageIds.add(e.id);
                }

                // Iconset icons are only loaded on demand via this same handler.
                // When MapLibre asks for the colored variant first, the
                // underlying base image hasn't been registered yet, so we need
                // to hydrate it from Dexie before recoloring. Without this the
                // recolor step finds no source image and silently bails out,
                // leaving the marker with a callsign but no icon.
                if (originalIconId.includes(':') && !this.map.hasImage(originalIconId)) {
                    await this.loadIconsetImage(originalIconId);
                }

                this.getColoredIcon(originalIconId, color);
            } else if (e.id.includes(':')) {
                this.requestedIconsetImageIds.add(e.id);
                await this.loadIconsetImage(e.id);
            } else if (!this.loggedMissingImageIds.has(e.id)) {
                this.loggedMissingImageIds.add(e.id);
                console.info('Unhandled style image missing event', {
                    imageId: e.id
                });
            }
        } catch (error) {
            this.logErrorOnce(
                `styleimagemissing:${e.id}`,
                'Failed to handle style image missing event',
                error,
                { imageId: e.id }
            );

            throw error;
        }
    }

    /**
     * Resolve an `<iconsetUid>:<path>` image id from Dexie and register it with
     * MapLibre. Falls back to a generic point icon when the icon isn't cached.
     */
    private async loadIconsetImage(id: string): Promise<boolean> {
        if (this.map.hasImage(id)) return true;

        const inflight = this.inflightImage.get(id);
        if (inflight) return inflight;

        const work = (async () => {
            try {
                const row = await Icon.get(id);

                if (row) {
                    const bitmap = await this.decodeIconBlob(row.data);
                    if (!this.map.hasImage(id)) {
                        this.map.addImage(id, bitmap);
                    }
                    return true;
                }

                const fallback = await this.getFallbackBitmap();
                if (!this.map.hasImage(id)) {
                    this.map.addImage(id, fallback);
                }

                this.logWarnOnce(
                    `missing-iconset-icon:${id}`,
                    'Iconset icon not found in local cache, using fallback',
                    { imageId: id }
                );

                return false;
            } finally {
                this.inflightImage.delete(id);
            }
        })();

        this.inflightImage.set(id, work);
        return work;
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

    private async reloadIconsetImages(uid: string): Promise<void> {
        const prefix = `${uid}:`;
        const ids = new Set([
            ...Array.from(this.requestedIconsetImageIds).filter((id) => id.startsWith(prefix)),
            ...this.map.listImages().filter((id) => id.startsWith(prefix))
        ]);

        this.purgeMapImagesForIconset(uid);

        await Promise.all(Array.from(ids).map((id) => this.reloadRequestedIconsetImage(id)));
    }

    private async reloadRequestedIconsetImage(id: string): Promise<void> {
        if (id.includes('-colored-')) {
            const parts = id.split('-colored-');
            const originalIconId = parts[0];
            const color = '#' + parts[1];

            this.cache.delete(id);
            const loaded = await this.loadIconsetImage(originalIconId);
            if (!loaded) return;

            this.getColoredIcon(originalIconId, color);
            this.requestedIconsetImageIds.delete(id);
            return;
        }

        const loaded = await this.loadIconsetImage(id);
        if (loaded) this.requestedIconsetImageIds.delete(id);
    }

    private removeRequestedImagesForIconset(uid: string): void {
        const prefix = `${uid}:`;
        for (const id of Array.from(this.requestedIconsetImageIds)) {
            if (id.startsWith(prefix)) this.requestedIconsetImageIds.delete(id);
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

        // Also register under a stable id so it can be reused via `iconImage`
        // expressions without going through the missing-image handler.
        if (!this.map.hasImage(FALLBACK_IMAGE_ID)) {
            this.map.addImage(FALLBACK_IMAGE_ID, this.fallbackBitmap);
        }

        return this.fallbackBitmap;
    }

    /**
     * Get or create a colored version of an icon
     */
    public getColoredIcon(iconId: string, color: string): string {
        const coloredIconId = `${iconId}-colored-${color.slice(1)}`;

        if (!this.cache.has(coloredIconId)) {
            this.createColoredIcon(iconId, color, coloredIconId);
        }

        return coloredIconId;
    }

    /**
     * Create a colored version of an icon and add it to the map
     */
    private createColoredIcon(iconId: string, color: string, coloredIconId: string): void {
        // Get the original icon from the map
        const originalImage = this.map.getImage(iconId);
        if (!originalImage) {
            this.logWarnOnce(
                `missing-icon:${iconId}`,
                'Icon not found in map when attempting recolor',
                {
                    iconId,
                    color,
                    coloredIconId
                }
            );
            return;
        }

        try {
            // Create canvas for recoloring
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                this.logWarnOnce(
                    `missing-canvas-context:${coloredIconId}`,
                    'Canvas context unavailable while recoloring icon',
                    {
                        iconId,
                        color,
                        coloredIconId
                    }
                );

                return;
            }

            canvas.width = originalImage.data.width;
            canvas.height = originalImage.data.height;

            // Create ImageData from the original image
            const imageData = new ImageData(
                new Uint8ClampedArray(originalImage.data.data),
                originalImage.data.width,
                originalImage.data.height
            );

            // Recolor white pixels
            this.recolorWhitePixels(imageData, color);

            // Draw to canvas
            ctx.putImageData(imageData, 0, 0);

            // Cache and add to map
            this.cache.set(coloredIconId, canvas);

            // Convert canvas to ImageData for map
            const canvasImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            if (!this.map.hasImage(coloredIconId)) {
                this.map.addImage(coloredIconId, {
                    width: canvas.width,
                    height: canvas.height,
                    data: canvasImageData.data
                });
            }
        } catch (error) {
            this.logErrorOnce(
                `colored-icon:${coloredIconId}`,
                'Failed to create colored icon',
                error,
                {
                    iconId,
                    color,
                    coloredIconId
                }
            );

            throw error;
        }
    }

    /**
     * Replace white/light pixels with the target color
     */
    private recolorWhitePixels(imageData: ImageData, color: string): void {
        const data = imageData.data;
        const [r, g, b] = this.hexToRgb(color);

        for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];

            // Skip transparent pixels
            if (alpha === 0) continue;

            // Check if pixel is white or light colored
            if (this.isWhitePixel(data[i], data[i + 1], data[i + 2])) {
                data[i] = r;     // Red
                data[i + 1] = g; // Green
                data[i + 2] = b; // Blue
                // Keep original alpha
            }
        }
    }

    /**
     * Check if a pixel is considered "white" (should be recolored)
     */
    private isWhitePixel(r: number, g: number, b: number): boolean {
        // Consider pixels white if they are very light (above 200 in all channels)
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
