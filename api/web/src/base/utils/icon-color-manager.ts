/**
 * Icon Color Manager for runtime icon recoloring
 */

import type { Map as MapLibreMap } from 'maplibre-gl';

export class IconColorManager {
    private cache = new Map<string, HTMLCanvasElement>();
    private map: MapLibreMap;

    constructor(map: MapLibreMap) {
        this.map = map;
    }

    /**
     * Get or create a colored version of an icon
     */
    getColoredIcon(iconId: string, color: string): string {
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
            console.warn(`Icon ${iconId} not found in map`);
            return;
        }

        // Create canvas for recoloring
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

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
        this.map.addImage(coloredIconId, {
            width: canvas.width,
            height: canvas.height,
            data: canvasImageData.data
        });
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