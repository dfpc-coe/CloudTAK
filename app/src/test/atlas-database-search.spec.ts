import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import AtlasDatabase from '../workers/atlas-database.ts';
import COT from '../base/cot.ts';
import type Atlas from '../workers/atlas.ts';
import type { Feature } from '../types.ts';

function setup(feats: Array<{ id: string, callsign?: string, remarks?: string }>) {
    const atlas = { postMessage: vi.fn(async () => undefined) } as unknown as Atlas;
    const db = new AtlasDatabase(atlas);

    for (const feat of feats) {
        db.cots.set(feat.id, new COT({
            id: feat.id,
            type: 'Feature',
            path: '/',
            properties: {
                id: feat.id,
                type: 'a-f-G',
                how: 'm-g',
                callsign: feat.callsign,
                remarks: feat.remarks,
                center: [0, 0, 0]
            },
            geometry: { type: 'Point', coordinates: [0, 0, 0] }
        } as unknown as Feature, undefined, { skipSave: true }));
    }

    return db;
}

const ids = (cots: Set<COT>) => Array.from(cots, (cot) => cot.id);

describe('AtlasDatabase.search', () => {
    it('matches callsign or remarks case-insensitively with callsign matches first', async () => {
        const db = setup([
            { id: 'remarks-1', callsign: '123 Main St', remarks: 'Phone: 555-0100' },
            { id: 'other', callsign: 'Lot 9', remarks: 'Generator on site' },
            { id: 'callsign-1', callsign: 'Phone Tree' },
            { id: 'no-callsign', remarks: 'Has a PHONE' }
        ]);

        expect(ids(await db.search('phone'))).toEqual(['callsign-1', 'remarks-1', 'no-callsign']);
    });

    it('applies the limit after ranking and ignores pending deletes', async () => {
        const db = setup([
            { id: 'remarks-1', callsign: 'A', remarks: 'water' },
            { id: 'remarks-2', callsign: 'B', remarks: 'water' },
            { id: 'callsign-1', callsign: 'Water 1' },
            { id: 'callsign-2', callsign: 'Water 2' }
        ]);
        db.pendingDelete.add('callsign-1');

        expect(ids(await db.search('water', { limit: 2 }))).toEqual(['callsign-2', 'remarks-1']);
    });

    it('returns nothing for a blank query', async () => {
        const db = setup([{ id: 'a', callsign: 'Anything' }]);

        expect(await db.search('   ')).toEqual(new Set());
    });
});
