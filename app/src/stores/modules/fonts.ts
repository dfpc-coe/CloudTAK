/**
 * Label fonts - binds each style `text-font` name to bundled font files via
 * the style spec `font-faces` property. The style declares no `glyphs` URL,
 * so MapLibre draws every label locally from these files and falls back to
 * system fonts for codepoints they do not cover.
 */
import type { FontFacesSpecification, MLFontFace } from 'maplibre-gl';
import latin from '@fontsource/open-sans/files/open-sans-latin-700-normal.woff2?url&no-inline';
import latinExt from '@fontsource/open-sans/files/open-sans-latin-ext-700-normal.woff2?url&no-inline';
import vietnamese from '@fontsource/open-sans/files/open-sans-vietnamese-700-normal.woff2?url&no-inline';
import greek from '@fontsource/open-sans/files/open-sans-greek-700-normal.woff2?url&no-inline';
import greekExt from '@fontsource/open-sans/files/open-sans-greek-ext-700-normal.woff2?url&no-inline';
import cyrillic from '@fontsource/open-sans/files/open-sans-cyrillic-700-normal.woff2?url&no-inline';
import cyrillicExt from '@fontsource/open-sans/files/open-sans-cyrillic-ext-700-normal.woff2?url&no-inline';
import hebrew from '@fontsource/open-sans/files/open-sans-hebrew-700-normal.woff2?url&no-inline';

/** Unicode ranges match the @fontsource/open-sans subsets */
const OPEN_SANS_BOLD: MLFontFace[] = [{
    url: latin,
    'unicode-range': ['U+0000-00FF', 'U+0131', 'U+0152-0153', 'U+02BB-02BC', 'U+02C6', 'U+02DA', 'U+02DC', 'U+0304', 'U+0308', 'U+0329', 'U+2000-206F', 'U+20AC', 'U+2122', 'U+2191', 'U+2193', 'U+2212', 'U+2215', 'U+FEFF', 'U+FFFD']
}, {
    url: latinExt,
    'unicode-range': ['U+0100-02BA', 'U+02BD-02C5', 'U+02C7-02CC', 'U+02CE-02D7', 'U+02DD-02FF', 'U+0304', 'U+0308', 'U+0329', 'U+1D00-1DBF', 'U+1E00-1E9F', 'U+1EF2-1EFF', 'U+2020', 'U+20A0-20AB', 'U+20AD-20C0', 'U+2113', 'U+2C60-2C7F', 'U+A720-A7FF']
}, {
    url: vietnamese,
    'unicode-range': ['U+0102-0103', 'U+0110-0111', 'U+0128-0129', 'U+0168-0169', 'U+01A0-01A1', 'U+01AF-01B0', 'U+0300-0301', 'U+0303-0304', 'U+0308-0309', 'U+0323', 'U+0329', 'U+1EA0-1EF9', 'U+20AB']
}, {
    url: greek,
    'unicode-range': ['U+0370-0377', 'U+037A-037F', 'U+0384-038A', 'U+038C', 'U+038E-03A1', 'U+03A3-03FF']
}, {
    url: greekExt,
    'unicode-range': ['U+1F00-1FFF']
}, {
    url: cyrillic,
    'unicode-range': ['U+0301', 'U+0400-045F', 'U+0490-0491', 'U+04B0-04B1', 'U+2116']
}, {
    url: cyrillicExt,
    'unicode-range': ['U+0460-052F', 'U+1C80-1C8A', 'U+20B4', 'U+2DE0-2DFF', 'U+A640-A69F', 'U+FE2E-FE2F']
}, {
    url: hebrew,
    'unicode-range': ['U+0307-0308', 'U+0590-05FF', 'U+200C-2010', 'U+20AA', 'U+25CC', 'U+FB1D-FB4F']
}];

export default class FontManager {
    static fontFaces(): FontFacesSpecification {
        return {
            'Open Sans Bold': OPEN_SANS_BOLD
        };
    }
}
