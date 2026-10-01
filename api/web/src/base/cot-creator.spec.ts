import { describe, expect, it } from 'vitest';
import type { Feature } from '../types.ts';
import COT, { OriginMode } from './cot.ts';

function cot(props: Partial<Feature['properties']>): COT {
    return new COT({
        id: 'test-cot',
        type: 'Feature',
        properties: { id: 'test-cot', type: 'u-d-p', ...props },
        geometry: { type: 'Point', coordinates: [0, 0] }
    } as Feature, { mode: OriginMode.MISSION }, { skipSave: true });
}

describe('COT.creator', () => {
    it('returns undefined with no creator or usable author link', () => {
        expect(cot({}).creator).toBeUndefined();
        expect(cot({ links: [{ url: 'https://example.com' }] }).creator).toBeUndefined();
        expect(cot({ links: [{ relation: 'p-p', uid: 'no-type' }] }).creator).toBeUndefined();
        expect(cot({ links: [{ relation: 'p-p', type: 'a-f-G-U-C' }] }).creator).toBeUndefined();
    });

    it('prefers the creator detail', () => {
        const c = cot({
            creator: { uid: 'creator-uid', type: 'a-f-G-U-C', callsign: 'Creator' },
            links: [{ uid: 'link-uid', type: 'a-f-G-U-C', relation: 'p-p', parent_callsign: 'Link' }]
        });

        expect(c.creator).toEqual({ uid: 'creator-uid', type: 'a-f-G-U-C', callsign: 'Creator' });
    });

    it('derives the author from a p-p link', () => {
        const c = cot({
            links: [
                { relation: 't-s', uid: 'responder' },
                {
                    uid: '5C357E69-449E-4A15-ADCD-C441C016A768',
                    production_time: '2026-09-30T17:26:44Z',
                    type: 'a-f-G-U-C',
                    parent_callsign: 'BPD-C Clark-151',
                    relation: 'p-p'
                }
            ]
        });

        expect(c.creator).toEqual({
            uid: '5C357E69-449E-4A15-ADCD-C441C016A768',
            type: 'a-f-G-U-C',
            callsign: 'BPD-C Clark-151',
            time: '2026-09-30T17:26:44Z'
        });
    });

    it('omits callsign and time the link does not carry', () => {
        const c = cot({ links: [{ uid: 'ANDROID-1', type: 'a-f-G-U-C', relation: 'p-p' }] });

        expect(c.creator).toEqual({ uid: 'ANDROID-1', type: 'a-f-G-U-C' });
    });
});
