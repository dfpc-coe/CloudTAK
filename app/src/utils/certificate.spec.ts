import { describe, it, expect } from 'vitest';
import { certificateExpiryState, NEAR_EXPIRY_MS } from './certificate.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-08-24T00:00:00Z');

describe('certificateExpiryState', () => {
    it('returns null for missing or unparseable validTo', () => {
        expect(certificateExpiryState(undefined, NOW)).toBeNull();
        expect(certificateExpiryState(null, NOW)).toBeNull();
        expect(certificateExpiryState('', NOW)).toBeNull();
        expect(certificateExpiryState('not a date', NOW)).toBeNull();
    });

    it('returns expired once validTo is in the past', () => {
        expect(certificateExpiryState(new Date(NOW - 1).toISOString(), NOW)).toBe('expired');
        expect(certificateExpiryState(new Date(NOW - 400 * DAY_MS).toISOString(), NOW)).toBe('expired');
    });

    it('returns near-expiry inside the window', () => {
        expect(certificateExpiryState(new Date(NOW + DAY_MS).toISOString(), NOW)).toBe('near-expiry');
        expect(certificateExpiryState(new Date(NOW + NEAR_EXPIRY_MS).toISOString(), NOW)).toBe('near-expiry');
    });

    it('returns null for a healthy certificate', () => {
        expect(certificateExpiryState(new Date(NOW + NEAR_EXPIRY_MS + 1).toISOString(), NOW)).toBeNull();
        expect(certificateExpiryState(new Date(NOW + 365 * DAY_MS).toISOString(), NOW)).toBeNull();
    });

    it('parses the OpenSSL date format returned by the API', () => {
        expect(certificateExpiryState('Aug 20 02:23:43 2027 GMT', NOW)).toBeNull();
        expect(certificateExpiryState('Aug 20 02:23:43 2025 GMT', NOW)).toBe('expired');
    });
});
