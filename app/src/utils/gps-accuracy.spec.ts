import { describe, expect, it } from 'vitest';
import { gpsAccuracyColor, isAccurateGpsFix } from './gps-accuracy.ts';

describe('isAccurateGpsFix', () => {
    it('accepts fixes at or under the green threshold', () => {
        expect(isAccurateGpsFix(5)).toBe(true);
        expect(isAccurateGpsFix(50)).toBe(true);
    });

    it('rejects coarse, missing, or non-finite accuracy', () => {
        expect(isAccurateGpsFix(51)).toBe(false);
        expect(isAccurateGpsFix(0)).toBe(false);
        expect(isAccurateGpsFix(undefined)).toBe(false);
        expect(isAccurateGpsFix(NaN)).toBe(false);
        expect(isAccurateGpsFix(Infinity)).toBe(false);
    });
});

describe('gpsAccuracyColor', () => {
    it('maps accuracy bands to green, yellow, red', () => {
        expect(gpsAccuracyColor(50)).toBe('#22c55e');
        expect(gpsAccuracyColor(200)).toBe('#eab308');
        expect(gpsAccuracyColor(201)).toBe('#ef4444');
    });
});
