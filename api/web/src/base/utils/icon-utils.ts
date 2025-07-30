/**
 * Icon utility functions for CloudTAK
 */

/**
 * Generate colored icon ID
 */
export function getColoredIconId(iconId: string, color: string): string {
    return `${iconId}-colored-${color.replace('#', '')}`;
}