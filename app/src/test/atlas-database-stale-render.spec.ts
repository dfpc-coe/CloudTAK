import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '../database.ts';
import AtlasDatabase from '../workers/atlas-database.ts';
import FeatureOutbox from '../base/feature-outbox.ts';
import FeatureWriter from '../base/feature-writer.ts';
import type Atlas from '../workers/atlas.ts';
import type { InputFeature } from '../types.ts';

const MINUTE = 60 * 1000;

const geometries = {
    Point: { type: 'Point', coordinates: [1, 2] },
    LineString: { type: 'LineString', coordinates: [[1, 2], [2, 3]] },
    Polygon: { type: 'Polygon', coordinates: [[[1, 2], [2, 2], [2, 3], [1, 2]]] },
};

function feature(
    id: string,
    geometry: keyof typeof geometries,
    properties: Record<string, unknown> = {}
): InputFeature {
    const now = Date.now();

    return {
        id,
        type: 'Feature',
        path: '/',
        properties: {
            type: geometry === 'Point' ? 'a-f-G' : 'b-m-p-s-p-i',
            how: 'm-g',
            callsign: id,
            time: new Date(now).toISOString(),
            start: new Date(now).toISOString(),
            stale: new Date(now + MINUTE).toISOString(),
            ...properties,
        },
        geometry: geometries[geometry],
    } as unknown as InputFeature;
}

function setup(display_stale: string) {
    const atlas = {
        token: 'token',
        postMessage: vi.fn(async () => {}),
        profile: {
            display_stale: { value: display_stale },
            creator: async () => ({ uid: 'me', type: 'a-f-G-E-V-C', callsign: 'ME', time: '2026-01-01T00:00:00Z' }),
        },
    } as unknown as Atlas;

    vi.spyOn(FeatureOutbox, 'push').mockResolvedValue(true);

    return new AtlasDatabase(atlas);
}

function props(update: { addOrUpdateProperties?: Array<{ key: string, value: unknown }> } | undefined) {
    return Object.fromEntries((update?.addOrUpdateProperties || []).map((prop) => [prop.key, prop.value]));
}

beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    FeatureWriter.reset();
    await db.feature.clear();
    FeatureOutbox.pending.clear();
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('AtlasDatabase stale render', () => {
    it('removes a stale Polygon and LineString in the same sweep as a stale Point', async () => {
        const store = setup('Immediate');

        const ids = [];
        for (const geometry of ['Point', 'LineString', 'Polygon'] as const) {
            const cot = await store.add(feature(geometry, geometry), { skipSave: true, skipMissionLookup: true });
            if (cot) ids.push(cot.vectorId());
        }

        const added = await store.diff();
        expect(added.add?.map((feat) => feat.id).sort()).toEqual([...ids].sort());

        vi.advanceTimersByTime(2 * MINUTE);

        const swept = await store.diff();
        expect([...(swept.remove as number[])].sort()).toEqual([...ids].sort());
        expect(store.cots.size).toBe(0);
    });

    it('dims a stale Polygon and LineString while they remain on the map', async () => {
        const store = setup('10 Minutes');

        const polygon = await store.add(feature('polygon', 'Polygon', { 'fill-opacity': 0.5, 'stroke-opacity': 0.8 }), { skipSave: true, skipMissionLookup: true });
        const line = await store.add(feature('line', 'LineString'), { skipSave: true, skipMissionLookup: true });
        const point = await store.add(feature('point', 'Point'), { skipSave: true, skipMissionLookup: true });
        if (!polygon || !line || !point) throw new Error('Features were not added');

        const added = await store.diff();
        const fresh = added.add?.find((feat) => feat.id === polygon.vectorId());
        expect(fresh?.properties?.['fill-opacity']).toBe(0.5);
        expect(fresh?.properties?.['stroke-opacity']).toBe(0.8);

        vi.advanceTimersByTime(2 * MINUTE);

        const swept = await store.diff();
        expect(swept.remove).toEqual([]);

        const dimmedPolygon = props(swept.update?.find((update) => update.id === polygon.vectorId()));
        expect(dimmedPolygon['fill-opacity']).toBe(0.25);
        expect(dimmedPolygon['stroke-opacity']).toBe(0.4);

        const dimmedLine = props(swept.update?.find((update) => update.id === line.vectorId()));
        expect(dimmedLine['stroke-opacity']).toBe(0.5);

        const dimmedPoint = props(swept.update?.find((update) => update.id === point.vectorId()));
        expect(dimmedPoint['marker-opacity']).toBe(0.5);
        expect(dimmedPoint['fill-opacity']).toBeUndefined();

        const snapshot = await store.snapshot();
        const snapped = snapshot.find((feat) => feat.id === polygon.vectorId());
        expect(snapped?.properties['fill-opacity']).toBe(0.25);
        expect(polygon.properties['fill-opacity']).toBe(0.5);

        vi.advanceTimersByTime(10 * MINUTE);

        const expired = await store.diff();
        expect(expired.remove).toHaveLength(3);
    });

    it('restores a dimmed Polygon when a fresh report arrives', async () => {
        const store = setup('10 Minutes');

        const polygon = await store.add(feature('polygon', 'Polygon', { 'fill-opacity': 0.5 }), { skipSave: true, skipMissionLookup: true });
        if (!polygon) throw new Error('Feature was not added');
        await store.diff();

        vi.advanceTimersByTime(2 * MINUTE);
        await store.diff();

        await store.add(feature('polygon', 'Polygon', { 'fill-opacity': 0.5 }), { skipSave: true, skipMissionLookup: true });

        const refreshed = await store.diff();
        const updates = (refreshed.update || []).filter((update) => update.id === polygon.vectorId());
        expect(updates.length).toBeGreaterThan(0);
        for (const update of updates) expect(props(update)['fill-opacity']).toBe(0.5);
    });

    it('never dims or removes an archived Polygon', async () => {
        const store = setup('Immediate');

        const polygon = await store.add(feature('polygon', 'Polygon', { type: 'u-d-f', archived: true, 'fill-opacity': 0.5 }), { skipSave: true, skipMissionLookup: true });
        if (!polygon) throw new Error('Feature was not added');
        await store.diff();

        vi.advanceTimersByTime(2 * MINUTE);

        const swept = await store.diff();
        expect(swept.remove).toEqual([]);
        expect(swept.update).toEqual([]);

        const snapshot = await store.snapshot();
        expect(snapshot.find((feat) => feat.id === polygon.vectorId())?.properties['fill-opacity']).toBe(0.5);
    });
});
