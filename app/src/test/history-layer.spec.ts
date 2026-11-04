import { describe, it, expect } from 'vitest';
import { historyUidFeatures, historyDiff, historyCollection, trailFeatureId } from '../stores/modules/history.ts';
import { FeatureHistorySource, type DBBreadcrumb, type DBFeatureHistory } from '../database.ts';

function row(uid: string, time: number, lon: number): DBFeatureHistory {
    return {
        id: `${uid}@${new Date(time).toISOString()}`,
        uid,
        time,
        callsign: uid.toUpperCase(),
        type: 'a-f-G',
        path: '/',
        source: FeatureHistorySource.Live,
        properties: { id: uid, callsign: uid.toUpperCase(), type: 'a-f-G' } as DBFeatureHistory['properties'],
        geometry: { type: 'Point', coordinates: [lon, 0] },
    };
}

describe('historyUidFeatures', () => {
    it('emits one point per row and a trail once there are two', () => {
        const one = historyUidFeatures('alpha', [row('alpha', 1000, 1)]);
        expect([...one.keys()]).toEqual(['alpha@1970-01-01T00:00:01.000Z']);

        const two = historyUidFeatures('alpha', [row('alpha', 2000, 2), row('alpha', 1000, 1)], { color: '#00ff00' } as DBBreadcrumb);
        const trail = two.get(trailFeatureId('alpha'));
        expect(trail?.geometry).toEqual({ type: 'LineString', coordinates: [[1, 0], [2, 0]] });
        expect(trail?.properties.color).toBe('#00ff00');
        expect(two.size).toBe(3);
    });

    it('draws legacy coordinates only while the uid has no points', () => {
        const trail = { uid: 'bravo', callsign: 'B', coordinates: [[0, 0], [1, 1]] } as DBBreadcrumb;
        expect(historyUidFeatures('bravo', [], trail).get(trailFeatureId('bravo'))?.properties.legacy).toBe(true);
        expect(historyUidFeatures('bravo', [row('bravo', 1000, 1)], trail).has(trailFeatureId('bravo'))).toBe(false);
    });
});

describe('historyDiff', () => {
    it('adds everything when the uid is new', () => {
        const next = historyUidFeatures('alpha', [row('alpha', 1000, 1), row('alpha', 2000, 2)]);
        const diff = historyDiff(undefined, next);
        expect(diff.add).toHaveLength(3);
        expect(diff.remove).toHaveLength(0);
        expect(diff.update).toHaveLength(0);
    });

    it('adds only the new point and updates the trail in place as it grows', () => {
        const prev = historyUidFeatures('alpha', [row('alpha', 1000, 1), row('alpha', 2000, 2)]);
        const next = historyUidFeatures('alpha', [row('alpha', 1000, 1), row('alpha', 2000, 2), row('alpha', 3000, 3)]);
        const diff = historyDiff(prev, next);

        expect(diff.add?.map((f) => f.id)).toEqual(['alpha@1970-01-01T00:00:03.000Z']);
        expect(diff.remove).toHaveLength(0);
        expect(diff.update).toHaveLength(1);
        expect(diff.update?.[0].id).toBe(trailFeatureId('alpha'));
        expect(diff.update?.[0].newGeometry).toEqual({ type: 'LineString', coordinates: [[1, 0], [2, 0], [3, 0]] });
    });

    it('removes pruned points and the trail when it collapses', () => {
        const prev = historyUidFeatures('alpha', [row('alpha', 1000, 1), row('alpha', 2000, 2)]);
        const next = historyUidFeatures('alpha', [row('alpha', 2000, 2)]);
        const diff = historyDiff(prev, next);

        expect(diff.remove).toEqual(expect.arrayContaining(['alpha@1970-01-01T00:00:01.000Z', trailFeatureId('alpha')]));
        expect(diff.add).toHaveLength(0);
    });

    it('removes everything when the uid is cleared', () => {
        const prev = historyUidFeatures('alpha', [row('alpha', 1000, 1), row('alpha', 2000, 2)]);
        const diff = historyDiff(prev, new Map());
        expect(diff.remove).toHaveLength(3);
    });
});

describe('historyCollection', () => {
    it('gives every feature a unique id so the source can be diffed later', () => {
        const collection = historyCollection(
            [row('alpha', 1000, 1), row('alpha', 2000, 2), row('bravo', 1000, 5)],
            [{ uid: 'charlie', callsign: 'C', coordinates: [[0, 0], [1, 1]] } as DBBreadcrumb]
        );
        const ids = collection.features.map((f) => f.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toContain(trailFeatureId('alpha'));
        expect(ids).toContain(trailFeatureId('charlie'));
        expect(ids).not.toContain(trailFeatureId('bravo'));
    });
});
