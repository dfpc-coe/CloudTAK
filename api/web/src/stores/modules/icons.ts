/**
 * Icon Color Manager for runtime icon recoloring
 */
import ms from 'milsymbol'
import Icon from '../../base/icon.ts'
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { IconsetList, Iconset, IconList } from '../../types.ts';
import { std, stdurl } from '../../std.ts';
import { db, type DBIconset, type DBIcon } from '../../base/database.ts';

const HYDRATE_CACHE_KEY = 'iconsets:hydrated';
/** Skip a fresh hydrate if the local cache was last refreshed within this many ms. */
const HYDRATE_FRESH_MS = 60_000;
/** Image id for the on-demand fallback when an iconset icon isn't available locally. */
const FALLBACK_IMAGE_ID = '__cloudtak_fallback_point__';

export default class IconManager {
    private cache = new Map<string, HTMLCanvasElement>();
    private map: MapLibreMap;
    private loggedMissingImageIds = new Set<string>();
    private loggedErrors = new Set<string>();
    private inflightImage = new Map<string, Promise<void>>();
    private fallbackBitmap: ImageBitmap | null = null;

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
     * Diffs the server iconset list against what's stored locally and only
     * refetches icons for iconsets that are new or whose `version`/`updated`
     * differs. Iconsets that no longer exist on the server are purged.
     *
     * Behaviour:
     *  - When Dexie already has data and was refreshed recently the call
     *    returns immediately and the diff runs in the background.
     *  - When `force` is true the diff always runs inline.
     */
    async hydrate(opts: { force?: boolean } = {}): Promise<void> {
        const force = !!opts.force;

        if (!force) {
            const marker = await db.cache.get(HYDRATE_CACHE_KEY);
            const iconsetCount = await db.iconset.count();
            const fresh = marker && (Date.now() - marker.updated) < HYDRATE_FRESH_MS;

            if (iconsetCount > 0 && fresh) {
                return;
            }

            if (iconsetCount > 0 && marker) {
                // Local cache exists but is stale -- run diff in the background
                // so the map can finish initialising without waiting on icons.
                setTimeout(() => {
                    void this.runDiff().catch((err: unknown) => {
                        console.error('Background icon hydrate failed', err);
                    });
                }, 0);
                return;
            }
        }

        await this.runDiff();
    }

    private async runDiff(): Promise<void> {
        const remote = await std('/api/iconset?limit=0') as IconsetList;

        const remoteByUid = new Map<string, Iconset>();
        for (const iconset of remote.items) {
            remoteByUid.set(iconset.uid, iconset);
        }

        const local = await db.iconset.toArray();
        const localByUid = new Map<string, DBIconset>();
        for (const iconset of local) {
            localByUid.set(iconset.uid, iconset);
        }

        const toSync: Iconset[] = [];
        for (const [uid, iconset] of remoteByUid) {
            const cached = localByUid.get(uid);
            if (
                !cached
                || cached.version !== iconset.version
                || cached.updated !== iconset.updated
            ) {
                toSync.push(iconset);
            }
        }

        const toRemove: string[] = [];
        for (const uid of localByUid.keys()) {
            if (!remoteByUid.has(uid)) toRemove.push(uid);
        }

        await Promise.all(toRemove.map((uid) => this.purgeIconset(uid)));

        await Promise.all(toSync.map((iconset) => this.syncIconset(iconset)));

        await db.cache.put({ key: HYDRATE_CACHE_KEY, updated: Date.now() });
    }

    private async syncIconset(iconset: Iconset): Promise<void> {
        const list = await std(`/api/icon?iconset=${encodeURIComponent(iconset.uid)}&limit=0`) as IconList;

        const rows: DBIcon[] = [];
        for (const icon of list.items) {
            const blob = await dataUrlToBlob(icon.data);
            const path = stripExt(icon.name);
            const name = `${iconset.uid}:${path}`;

            rows.push({
                name,
                iconset: iconset.uid,
                path,
                type2525b: icon.type2525b ?? null,
                updated: icon.updated,
                data: blob
            });
        }

        await db.transaction('rw', db.icon, db.iconset, async () => {
            await db.icon.where('iconset').equals(iconset.uid).delete();
            if (rows.length) await db.icon.bulkPut(rows);
            await db.iconset.put(iconset);
        });

        // Purge any registered map images for this iconset so they get
        // re-resolved against the new Dexie data on next render.
        for (const id of this.map.listImages()) {
            if (id.startsWith(`${iconset.uid}:`)) {
                this.map.removeImage(id);
            }
        }
    }

    private async purgeIconset(uid: string): Promise<void> {
        await db.transaction('rw', db.icon, db.iconset, async () => {
            await db.icon.where('iconset').equals(uid).delete();
            await db.iconset.delete(uid);
        });

        for (const id of this.map.listImages()) {
            if (id.startsWith(`${uid}:`)) {
                this.map.removeImage(id);
            }
        }
    }

    /**
     * Ensure a single iconset is present in Dexie. Used by overlays that
     * reference a specific iconset so it is available even if the user-wide
     * hydrate hasn't completed yet.
     */
    async addIconset(uid: string): Promise<void> {
        const iconset = await std(`/api/iconset/${uid}`) as Iconset;
        const cached = await db.iconset.get(uid);

        if (
            cached
            && cached.version === iconset.version
            && cached.updated === iconset.updated
        ) {
            return;
        }

        await this.syncIconset(iconset);
    }

    async removeIconset(uid: string): Promise<void> {
        await this.purgeIconset(uid);
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

function stripExt(name: string): string {
    return name.replace(/\.(png|svg|jpg|jpeg|gif)$/i, '');
}

async function dataUrlToBlob(data: string): Promise<Blob> {
    let mime = 'image/png';
    let base64 = data;

    if (data.startsWith('data:')) {
        const match = /^data:([^;,]+);base64,(.*)$/.exec(data);
        if (!match) {
            // Non-base64 data URL — fall back to fetch decoding.
            const res = await fetch(data);
            return await res.blob();
        }
        mime = match[1];
        base64 = match[2];
    }

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return new Blob([bytes], { type: mime });
}
