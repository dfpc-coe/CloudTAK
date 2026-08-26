import { describe, expect, it } from 'vitest';
import { TEAM_COLORS, strokeColorFor } from './cot.ts';

/**
 * Regression coverage for the team colour / marker border fix: CloudTAK
 * previously rendered TAK team colours using Tabler UI framework
 * brand-palette CSS variables (e.g. `--tblr-dribbble` for Magenta), which do
 * not match what ATAK actually renders for the same team name, and always
 * drew a fixed white marker border that disappears against a light basemap
 * or a light marker colour (White/Yellow/Cyan teams).
 */

describe('TEAM_COLORS', () => {
    it('matches ATAK\'s Icon2525cIconAdapter.teamToColor() values', () => {
        expect(TEAM_COLORS).toEqual({
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
        });
    });

    it('has 14 entries - every TAK team colour, none omitted', () => {
        expect(Object.keys(TEAM_COLORS)).toHaveLength(14);
    });
});

describe('strokeColorFor', () => {
    it('picks a black border for light marker colours', () => {
        expect(strokeColorFor(TEAM_COLORS.White)).toBe('#000000');
        expect(strokeColorFor(TEAM_COLORS.Yellow)).toBe('#000000');
        expect(strokeColorFor(TEAM_COLORS.Cyan)).toBe('#000000');
    });

    it('picks a white border for dark marker colours', () => {
        expect(strokeColorFor(TEAM_COLORS.Red)).toBe('#ffffff');
        expect(strokeColorFor(TEAM_COLORS.Maroon)).toBe('#ffffff');
        expect(strokeColorFor(TEAM_COLORS.Blue)).toBe('#ffffff');
        expect(strokeColorFor(TEAM_COLORS['Dark Blue'])).toBe('#ffffff');
        expect(strokeColorFor(TEAM_COLORS['Dark Green'])).toBe('#ffffff');
    });

    it('is case-insensitive and tolerates a missing leading #', () => {
        expect(strokeColorFor('#ffffff')).toBe('#000000');
        expect(strokeColorFor('ffffff')).toBe('#000000');
        expect(strokeColorFor('FFFFFF')).toBe('#000000');
    });

    it('falls back to white for a value that cannot be parsed as #rrggbb', () => {
        expect(strokeColorFor('')).toBe('#ffffff');
        expect(strokeColorFor('not-a-color')).toBe('#ffffff');
        expect(strokeColorFor('#fff')).toBe('#ffffff');
        expect(strokeColorFor('#gggggg')).toBe('#ffffff');
    });

    it('sits right at the luminance threshold boundary', () => {
        // Luminance exactly 0.6 * 255 = 153 -> not > 0.6, so white border
        expect(strokeColorFor('#999999')).toBe('#ffffff');
        // One step brighter crosses the threshold -> black border
        expect(strokeColorFor('#9a9a9a')).toBe('#000000');
    });
});
