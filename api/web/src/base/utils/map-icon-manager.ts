/**
 * Global map icon manager instance
 */

import type { Map } from 'maplibre-gl';
import { IconColorManager } from './icon-color-manager.ts';
import { shouldColorIcon as shouldColorIconUtil } from './icon-utils.ts';

let iconColorManager: IconColorManager | null = null;

/**
 * Initialize the icon color manager with a map instance
 */
export function initIconColorManager(map: Map): void {
    iconColorManager = new IconColorManager(map);
}

/**
 * Get the global icon color manager instance
 */
export function getIconColorManager(): IconColorManager {
    if (!iconColorManager) {
        throw new Error('Icon color manager not initialized. Call initIconColorManager first.');
    }
    return iconColorManager;
}

/**
 * Get a colored version of an icon
 */
export function getColoredIcon(iconId: string, color: string): string {
    return getIconColorManager().getColoredIcon(iconId, color);
}

/**
 * Check if an icon should be colored based on its properties
 */
export function shouldColorIcon(iconId: string, markerColor?: string): boolean {
    return shouldColorIconUtil(iconId, markerColor);
}