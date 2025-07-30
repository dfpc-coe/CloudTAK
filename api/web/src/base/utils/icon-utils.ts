/**
 * Icon utility functions for CloudTAK
 */

import { getSidcForCot, hasSidcMapping } from './cot-sidc-mapping.ts';

/**
 * Determine the icon source type for a given icon ID
 */
export function getIconSourceType(iconId: string): 'cot-sidc' | '2525d' | 'color-square-38' | 'color-square' | 'sprite' | 'unknown' {
    if (hasSidcMapping(iconId)) {
        return 'cot-sidc';
    }
    
    if (iconId.startsWith('2525D:')) {
        return '2525d';
    }
    
    if (iconId.startsWith('color-square-38-')) {
        return 'color-square-38';
    }
    
    if (iconId.startsWith('color-square-')) {
        return 'color-square';
    }
    
    // Assume it's in a sprite if none of the above match
    return 'sprite';
}

/**
 * Get the SIDC code for an icon, handling both direct SIDC and CoT mappings
 */
export function getIconSidc(iconId: string): string | undefined {
    // Check CoT mapping first
    const cotSidc = getSidcForCot(iconId);
    if (cotSidc) {
        return cotSidc;
    }
    
    // Check if it's a direct SIDC reference
    if (iconId.startsWith('2525D:')) {
        return iconId.replace('2525D:', '');
    }
    
    return undefined;
}

/**
 * Check if an icon can be generated dynamically (not requiring sprite)
 */
export function canGenerateIcon(iconId: string): boolean {
    const sourceType = getIconSourceType(iconId);
    return sourceType !== 'sprite' && sourceType !== 'unknown';
}

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