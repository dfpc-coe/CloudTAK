// ATAK team colours (Icon2525cIconAdapter.teamToColor())
export const TEAM_COLORS: Record<string, string> = {
    White: '#FFFFFF',
    Yellow: '#FFFF00',
    Orange: '#FF7700',
    Magenta: '#FF00FF',
    Red: '#FF0000',
    Maroon: '#7F0000',
    Purple: '#7F007F',
    'Dark Blue': '#00007F',
    Blue: '#0000FF',
    Cyan: '#00FFFF',
    Teal: '#007F7F',
    Green: '#00FF00',
    'Dark Green': '#007F00',
    Brown: '#A0714F',
};

// Black border for light fills, white otherwise
export function strokeColorFor(hex: string): string {
    const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!match) return '#ffffff';

    const r = parseInt(match[1], 16);
    const g = parseInt(match[2], 16);
    const b = parseInt(match[3], 16);

    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance > 0.6 ? '#000000' : '#ffffff';
}
