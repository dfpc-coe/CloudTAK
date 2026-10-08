import { describe, expect, it } from 'vitest';
import { QUICK_PIC_TYPE, quickPicFeature, quickPicName } from './quick-pic.ts';

describe('quickPicName', () => {
    it('formats a sortable local timestamp', () => {
        expect(quickPicName(new Date(2026, 9, 7, 8, 5, 3))).toBe('QuickPic-20261007-080503');
    });
});

describe('quickPicFeature', () => {
    it('builds an archived ATAK Quick Pic marker linked to the attachment hash', () => {
        const date = new Date('2026-10-07T14:00:00.000Z');

        const feat = quickPicFeature({
            id: 'abc',
            hash: 'deadbeef',
            callsign: 'QuickPic-20261007-080000',
            coordinates: [-105.1234567, 39.7654321],
            altitude: 1609.344,
            date
        });

        expect(QUICK_PIC_TYPE).toBe('b-i-x-i');
        expect(feat).toEqual({
            id: 'abc',
            type: 'Feature',
            path: '/',
            properties: {
                id: 'abc',
                type: 'b-i-x-i',
                how: 'h-g-i-g-o',
                archived: true,
                time: '2026-10-07T14:00:00.000Z',
                start: '2026-10-07T14:00:00.000Z',
                stale: '2026-10-07T14:00:00.000Z',
                center: [-105.123457, 39.765432, 1609.3],
                callsign: 'QuickPic-20261007-080000',
                attachments: ['deadbeef'],
            },
            geometry: {
                type: 'Point',
                coordinates: [-105.123457, 39.765432, 1609.3]
            }
        });
    });

    it('omits altitude when the fix has none', () => {
        const feat = quickPicFeature({
            id: 'abc',
            hash: 'deadbeef',
            callsign: 'x',
            coordinates: [1, 2],
            altitude: null
        });

        expect(feat.geometry).toEqual({ type: 'Point', coordinates: [1, 2] });
    });
});
