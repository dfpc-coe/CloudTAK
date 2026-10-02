import { describe, it, expect } from 'vitest';
import { parseSenders, validateSenders, MAX_SENDERS } from './senders.ts';

describe('parseSenders', () => {
    it('splits on newlines & commas, trims, lowercases and dedupes', () => {
        expect(parseSenders(' CAD@County.gov \n@agency.org, cad@county.gov\n\n')).toEqual([
            'cad@county.gov',
            '@agency.org',
        ]);
    });

    it('returns an empty list for empty text', () => {
        expect(parseSenders('')).toEqual([]);
        expect(parseSenders(' \n ')).toEqual([]);
    });
});

describe('validateSenders', () => {
    it('accepts addresses and @domains', () => {
        expect(validateSenders([])).toBe('');
        expect(validateSenders(['cad@county.gov', '@agency.org'])).toBe('');
    });

    it('rejects anything else', () => {
        expect(validateSenders(['county.gov'])).toBe('county.gov is not an address or @domain');
        expect(validateSenders(['cad <cad@county.gov>'])).toMatch(/is not an address/);
        expect(validateSenders(['a@b.com c@d.com'])).toMatch(/is not an address/);
        expect(validateSenders([`${'a'.repeat(128)}@b.com`])).toMatch(/is not an address/);
    });

    it('limits the number of senders', () => {
        const senders = Array.from({ length: MAX_SENDERS + 1 }, (_, i) => `user${i}@example.com`);
        expect(validateSenders(senders)).toBe(`No more than ${MAX_SENDERS} senders are allowed`);
        expect(validateSenders(senders.slice(1))).toBe('');
    });
});
