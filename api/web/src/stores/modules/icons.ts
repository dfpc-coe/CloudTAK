/**
 * Icon Color Manager for runtime icon recoloring
 */
import ms from 'milsymbol'
import Icon from '../../base/icon.ts'
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { IconsetList, Iconset } from '../../types.ts';
import { std, stdurl } from '../../std.ts';
import { db, type DBIconset } from '../../base/database.ts';

export default class IconManager {
    private cache = new Map<string, HTMLCanvasElement>();
    private map: MapLibreMap;
    private loggedMissingImageIds = new Set<string>();
    private loggedErrors = new Set<string>();

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

    async addIconset(uid: string): Promise<void> {
        const iconset = await std(`/api/iconset/${uid}`) as Iconset;

        await db.iconset.put(iconset);

        this.map.addSprite(
            iconset.uid,
            String(stdurl(`/api/iconset/${iconset.uid}/sprite?token=${localStorage.token}`))
        );
    }

    async removeIconset(uid: string): Promise<void> {
        this.map.removeSprite(uid);
        await db.iconset.delete(uid);
    }

    static async sprites(): Promise<Array<{
        id: string,
        url: string
    }>> {
        const sprites = [{
            id: 'default',
            url: String(stdurl(`/api/iconset/default/sprite?token=${localStorage.token}`))
        }]

        // Eventually make a sprite URL part of the overlay so KMLs can load a sprite package & add paging support
        const iconsets = await std('/api/iconset?limit=100') as IconsetList;

        await db.iconset.bulkPut(iconsets.items);

        for (const iconset of iconsets.items) {
            sprites.push({
                id: iconset.uid,
                url: String(stdurl(`/api/iconset/${iconset.uid}/sprite?token=${localStorage.token}`))
            });
        }

        return sprites;
    }

    public async updateImages(): Promise<void> {
        const images = this.map.listImages();

        await Icon.populate(images);
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
