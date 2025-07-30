/**
 * Tests for CoT to SIDC mapping
 */

import { getSidcForCot, hasSidcMapping } from '../cot-sidc-mapping.ts';
import { getIconSourceType, getIconSidc, canGenerateIcon } from '../icon-utils.ts';

describe('CoT to SIDC Mapping', () => {
    test('should map known CoT types to SIDC', () => {
        expect(getSidcForCot('a-f-G-U-C-I')).toBe('13060000121100000000000000000000');
        expect(getSidcForCot('a-h-A-M-F-Q')).toBe('14010000121100000000000000000000');
        expect(getSidcForCot('a-f-S-X-M-T-O')).toBe('130330000014011100000000000000');
    });

    test('should return undefined for unknown CoT types', () => {
        expect(getSidcForCot('unknown-type')).toBeUndefined();
        expect(getSidcForCot('')).toBeUndefined();
    });

    test('should correctly identify mapped CoT types', () => {
        expect(hasSidcMapping('a-f-G-U-C-I')).toBe(true);
        expect(hasSidcMapping('unknown-type')).toBe(false);
    });
});

describe('Icon Utils', () => {
    test('should identify icon source types correctly', () => {
        expect(getIconSourceType('a-f-G-U-C-I')).toBe('cot-sidc');
        expect(getIconSourceType('2525D:10031000001211000000')).toBe('2525d');
        expect(getIconSourceType('color-square-38-#ff0000')).toBe('color-square-38');
        expect(getIconSourceType('color-square-#ff0000')).toBe('color-square');
        expect(getIconSourceType('some-sprite-icon')).toBe('sprite');
    });

    test('should get SIDC codes correctly', () => {
        expect(getIconSidc('a-f-G-U-C-I')).toBe('13060000121100000000000000000000');
        expect(getIconSidc('2525D:10031000001211000000')).toBe('10031000001211000000');
        expect(getIconSidc('unknown-icon')).toBeUndefined();
    });

    test('should identify generatable icons', () => {
        expect(canGenerateIcon('a-f-G-U-C-I')).toBe(true);
        expect(canGenerateIcon('2525D:10031000001211000000')).toBe(true);
        expect(canGenerateIcon('color-square-#ff0000')).toBe(true);
        expect(canGenerateIcon('sprite-icon')).toBe(false);
    });
});