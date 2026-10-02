/**
 * Default point creation types.
 *
 * Points are created as 2525E Land Unit SIDCs where possible - u-d-p (Custom
 * Point) & b-m-p-s-m (Spotted) have no 2525E equivalent and remain
 * traditional CoT types.
 */

/** Basic CoT Atom point types previously used by creation UIs mapped to their 2525E SIDC */
export const LegacyPointTypes: Record<string, string> = {
    'a-u-G': '13011000000000000000',
    'a-f-G': '13031000000000000000',
    'a-h-G': '13061000000000000000',
    'a-n-G': '13041000000000000000',
};

/**
 * Normalize a stored default point type - mapping basic CoT Atom types
 * previously stored by the creation UIs to their 2525E SIDC equivalent
 */
export function normalizePointType(type?: string | null): string {
    if (!type) return 'u-d-p';
    return LegacyPointTypes[type] || type;
}
