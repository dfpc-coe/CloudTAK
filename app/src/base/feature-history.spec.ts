import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, FeatureHistorySource } from '../database.ts';
import FeatureHistory, { HISTORY_RETENTION_MS } from './feature-history.ts';
import type { InputFeature } from '../types.ts';

function feat(uid: string, time: string, props: Record<string, unknown> = {}, coordinates: number[] = [0, 0]): InputFeature {
    return {
        id: uid,
        type: 'Feature',
        path: '/',
        properties: { type: 'a-f-G', how: 'm-g', callsign: uid.toUpperCase(), time, start: time, stale: time, ...props },
        geometry: { type: 'Point', coordinates },
    } as unknown as InputFeature;
}

beforeEach(async () => {
    await db.feature_history.clear();
});

describe('FeatureHistory.fromFeature', () => {
    it('snapshots the feature keyed by uid and report time', () => {
        const row = FeatureHistory.fromFeature(feat('alpha', '2026-10-26T10:00:00.000Z', { speed: 3 }, [1, 2, 3]), FeatureHistorySource.History);

        expect(row).toMatchObject({
            id: 'alpha@2026-10-26T10:00:00.000Z',
            uid: 'alpha',
            time: Date.parse('2026-10-26T10:00:00.000Z'),
            callsign: 'ALPHA',
            type: 'a-f-G',
            path: '/',
            source: FeatureHistorySource.History,
            geometry: { type: 'Point', coordinates: [1, 2, 3] },
        });
        expect(row?.properties.speed).toBe(3);
        expect(row?.properties.id).toBe('alpha');
    });

    it('falls back to start when time is missing and rejects unusable reports', () => {
        const noTime = feat('alpha', '2026-10-26T10:00:00.000Z');
        delete (noTime.properties as Record<string, unknown>).time;
        expect(FeatureHistory.fromFeature(noTime, FeatureHistorySource.Live)?.time).toBe(Date.parse('2026-10-26T10:00:00.000Z'));

        const garbage = feat('alpha', 'not-a-date');
        expect(FeatureHistory.fromFeature(garbage, FeatureHistorySource.Live)).toBeNull();

        const noId = feat('', '2026-10-26T10:00:00.000Z');
        expect(FeatureHistory.fromFeature(noId, FeatureHistorySource.Live)).toBeNull();
    });
});

describe('FeatureHistory table', () => {
    it('lists by uid and time window oldest first, overwriting duplicate reports', async () => {
        const rows = [
            feat('alpha', '2026-10-26T10:02:00.000Z'),
            feat('alpha', '2026-10-26T10:00:00.000Z'),
            feat('alpha', '2026-10-26T10:01:00.000Z'),
            feat('bravo', '2026-10-26T10:01:30.000Z'),
            feat('alpha', '2026-10-26T10:01:00.000Z', { speed: 9 }),
        ].map((f) => FeatureHistory.fromFeature(f, FeatureHistorySource.History)!);

        expect(await FeatureHistory.put(rows)).toBe(5);
        expect(await FeatureHistory.count()).toBe(4);
        expect(await FeatureHistory.count('alpha')).toBe(3);

        const alpha = await FeatureHistory.list({ uid: 'alpha' });
        expect(alpha.map((r) => r.time)).toEqual([
            Date.parse('2026-10-26T10:00:00.000Z'),
            Date.parse('2026-10-26T10:01:00.000Z'),
            Date.parse('2026-10-26T10:02:00.000Z'),
        ]);
        expect(alpha[1].properties.speed).toBe(9);

        const window = await FeatureHistory.list({ start: '2026-10-26T10:01:00.000Z', end: '2026-10-26T10:01:30.000Z' });
        expect(window.map((r) => r.id)).toEqual(['alpha@2026-10-26T10:01:00.000Z', 'bravo@2026-10-26T10:01:30.000Z']);

        expect((await FeatureHistory.latest('alpha'))?.id).toBe('alpha@2026-10-26T10:02:00.000Z');
        expect(await FeatureHistory.uids()).toEqual(['alpha', 'bravo']);

        const spans = await FeatureHistory.spans();
        expect(spans.get('alpha')).toEqual({
            count: 3,
            first: Date.parse('2026-10-26T10:00:00.000Z'),
            last: Date.parse('2026-10-26T10:02:00.000Z'),
        });
        expect(spans.get('bravo')?.count).toBe(1);
    });

    it('clears one uid or everything and prunes by age', async () => {
        const now = Date.now();
        const old = new Date(now - HISTORY_RETENTION_MS - 60_000).toISOString();
        const fresh = new Date(now - 60_000).toISOString();

        await FeatureHistory.put([
            FeatureHistory.fromFeature(feat('alpha', old), FeatureHistorySource.History)!,
            FeatureHistory.fromFeature(feat('alpha', fresh), FeatureHistorySource.Live)!,
            FeatureHistory.fromFeature(feat('bravo', fresh), FeatureHistorySource.Live)!,
        ]);

        expect(await FeatureHistory.prune()).toBe(1);
        expect(await FeatureHistory.count('alpha')).toBe(1);

        await FeatureHistory.clear('bravo');
        expect(await FeatureHistory.count('bravo')).toBe(0);
        expect(await FeatureHistory.count('alpha')).toBe(1);

        await FeatureHistory.clear();
        expect(await FeatureHistory.count()).toBe(0);
    });
});
