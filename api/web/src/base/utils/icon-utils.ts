/**
 * Icon utility functions for CloudTAK
 */

/**
 * Check if an icon should be colored (has white areas that can be recolored)
 */
export function shouldColorIcon(iconId: string, markerColor?: string): boolean {
    if (!markerColor) return false;
    
    const sourceType = getIconSourceType(iconId);
    // Only color sprite-based icons (CoT icons), not full-color 2525D symbols
    return sourceType === 'sprite' || sourceType === 'cot-sidc';
}

/**
 * Generate colored icon ID
 */
export function getColoredIconId(iconId: string, color: string): string {
    return `${iconId}-colored-${color.replace('#', '')}`;
}