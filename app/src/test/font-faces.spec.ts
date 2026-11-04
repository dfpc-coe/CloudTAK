import { describe, expect, it } from 'vitest';
import type { MLFontFace } from 'maplibre-gl';
import FontManager from '../stores/modules/fonts.ts';

const RANGE = /^U\+[0-9A-F]{1,6}(-[0-9A-F]{1,6})?$/;

function faces(name: string): MLFontFace[] {
    const value = FontManager.fontFaces()[name];
    if (!Array.isArray(value)) throw new Error(`${name} is not a font face list`);
    return value;
}

describe('FontManager.fontFaces', () => {
    it('declares bundled files for the default label font', () => {
        const bold = faces('Open Sans Bold');
        expect(bold.length).toBeGreaterThan(0);

        for (const face of bold) {
            expect(face.url).toMatch(/\.woff2(\?.*)?$/);
            expect(face['unicode-range']?.length).toBeGreaterThan(0);
            for (const range of face['unicode-range'] ?? []) expect(range).toMatch(RANGE);
        }
    });

    it('covers ASCII from the first face so Latin labels never fall back', () => {
        const [latin] = faces('Open Sans Bold');
        expect(latin['unicode-range']).toContain('U+0000-00FF');
    });
});
