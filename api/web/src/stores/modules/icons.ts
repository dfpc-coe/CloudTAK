/**
 * Icon Color Manager for runtime icon recoloring
 */
import ms from 'milsymbol'
import Icon from '../../base/icon.ts'
import type { Map as MapLibreMap } from 'maplibre-gl';
import type * as Comlink from 'comlink';
import type Atlas from '../../workers/atlas.ts';
import type { IconHydrateResult } from '../../workers/atlas-icons.ts';
import { stdurl } from '../../std.ts';
import { db, type DBIconset } from '../../base/database.ts';

/** Image id for the on-demand fallback when an iconset icon isn't available locally. */
const FALLBACK_IMAGE_ID = '__cloudtak_fallback_point__';

export default class IconManager {
    private cache = new Map<string, HTMLCanvasElement>();
    private map: MapLibreMap;
    private worker: Comlink.Remote<Atlas>;
    private loggedMissingImageIds = new Set<string>();
    private loggedErrors = new Set<string>();
    private inflightImage = new Map<string, Promise<void>>();
    private fallbackBitmap: ImageBitmap | null = null;

    constructor(map: MapLibreMap, worker: Comlink.Remote<Atlas>) {
        this.map = map;
        this.worker = worker;
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
     */
    static defaultSprite(): Array<{ id: string; url: string }> {
        return [{
            id: 'default',
            url: String(stdurl(`/api/iconset/default/sprite?token=${localStorage.token}`))
        }];
    }

    /**
     * Hydrate the local Dexie icon cache from the API.
     *
     * The actual network IO and base64 -> Blob decoding runs inside the Atlas
     * worker (see `AtlasIcons.hydrate`); this method only handles main-thread
     * concerns like purging stale MapLibre images.
     */
    async hydrate(opts: { force?: boolean } = {}): Promise<void> {
        const result = await this.worker.icons.hydrate({ force: !!opts.force }) as IconHydrateResult;
        this.applyHydrateResult(result);
    }

    /**
     * Ensure a single iconset is present in Dexie. Used by overlays that
     * reference a specific iconset so it is available even if the user-wide
     * hydrate hasn't completed yet.
     */
    async addIconset(uid: string): Promise<void> {
        const updated = await this.worker.icons.addIconset(uid);
        if (updated) this.purgeMapImagesForIconset(uid);
    }

    async removeIconset(uid: string): Promise<void> {
        const removed = await this.worker.icons.removeIconset(uid);
        if (removed) this.purgeMapImagesForIconset(uid);
    }

    private applyHydrateResult(result: IconHydrateResult): void {
        if (result.skipped) return;

        for (const uid of result.removed) this.purgeMapImagesForIconset(uid);
        for (const uid of result.changed) this.purgeMapImagesForIconset(uid);
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
    private async loadIconsetImage(id: string): Promise<void> {
        if (this.map.hasImage(id)) return;

        const inflight = this.inflightImage.get(id);
        if (inflight) return inflight;

        const work = (async () => {
            try {
                const row = await Icon.get(id);

                if (row) {
                    const bitmap = await createImageBitmap(row.data);
                    if (!this.map.hasImage(id)) {
                        this.map.addImage(id, bitmap);
                    }
                    return;
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
            } finally {
                this.inflightImage.delete(id);
            }
        })();

        this.inflightImage.set(id, work);
        return work;
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
