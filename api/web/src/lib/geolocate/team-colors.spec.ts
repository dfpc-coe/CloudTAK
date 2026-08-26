import { describe, expect, it } from 'vitest';
import { TEAM_COLORS, strokeColorFor } from './main.ts';
import { TEAM_COLORS as COT_TEAM_COLORS, strokeColorFor as cotStrokeColorFor } from '../../base/cot.ts';

/**
 * The self-location puck (this module) keeps its own copy of TEAM_COLORS and
 * strokeColorFor(), mirroring base/cot.ts, so the puck stays outside the CoT
 * styling pipeline. These tests guard against the two copies drifting apart.
 */

describe('geolocate TEAM_COLORS', () => {
    it('is identical to the rendered-CoT-marker TEAM_COLORS in base/cot.ts', () => {
        expect(TEAM_COLORS).toEqual(COT_TEAM_COLORS);
    });
});

describe('geolocate strokeColorFor', () => {
    it('behaves identically to base/cot.ts\'s strokeColorFor for every team colour', () => {
        for (const hex of Object.values(TEAM_COLORS)) {
            expect(strokeColorFor(hex)).toBe(cotStrokeColorFor(hex));
        }
    });

    it('picks a black border for a light puck colour', () => {
        expect(strokeColorFor('#FFFFFF')).toBe('#000000');
    });

    it('picks a white border for a dark puck colour', () => {
        expect(strokeColorFor('#0000FF')).toBe('#ffffff');
    });

    it('falls back to white for an unparseable colour', () => {
        expect(strokeColorFor('not-a-color')).toBe('#ffffff');
    });
});
