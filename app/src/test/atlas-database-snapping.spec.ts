import 'fake-indexeddb/auto';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import AtlasDatabase from '../workers/atlas-database.ts';
import COT from '../base/cot.ts';
import { db } from '../database.ts';
import type Atlas from '../workers/atlas.ts';
import type { Feature } from '../types.ts';

function setup(points: Array<{ id: string, coord: [number, number] }>) {
    const atlas = { postMessage: vi.fn(async () => undefined) } as unknown as Atlas;
    const store = new AtlasDatabase(atlas);

    for (const point of points) {
        store.cots.set(point.id, new COT({
            id: point.id,
            type: 'Feature',
            path: '/',
            properties: {
                id: point.id,
                type: 'a-f-G',
                how: 'm-g',
                center: [...point.coord, 0]
            },
            geometry: { type: 'Point', coordinates: [...point.coord, 0] }
        } as unknown as Feature, undefined, { skipSave: true }));
    }

    return store;
}

async function missionFeature(mission: string, id: string, coords: number[][], deleted = false) {
    await db.subscription_feature.put({
        id,
        path: '/',
        mission,
        properties: { id, type: 'u-d-f', how: 'h-g-i-g-o', center: [coords[0][0], coords[0][1], 0] } as Feature["properties"],
        geometry: { type: 'LineString', coordinates: coords },
        synced: true,
        deleted,
        attempts: 0
    });
}

const bounds: [number, number][] = [[-1, -1], [1, 1]];
const sorted = (coords: Set<[number, number]>) => Array.from(coords).sort();

beforeEach(async () => {
    await db.subscription_feature.clear();
});

describe('AtlasDatabase.snapping', () => {
    it('returns only Map Feature vertices when no missions are given', async () => {
        const store = setup([{ id: 'in', coord: [0.5, 0.5] }, { id: 'out', coord: [5, 5] }]);
        await missionFeature('m1', 'line', [[0.1, 0.1], [0.2, 0.2]]);

        expect(sorted(await store.snapping(bounds))).toEqual([[0.5, 0.5]]);
    });

    it('adds in-bounds vertices from the requested missions', async () => {
        const store = setup([{ id: 'in', coord: [0.5, 0.5] }]);
        await missionFeature('m1', 'line', [[0.1, 0.1], [0.2, 0.2], [3, 3]]);
        await missionFeature('m2', 'other', [[-0.5, -0.5], [-0.6, -0.6]]);

        expect(sorted(await store.snapping(bounds, { missions: ['m1'] }))).toEqual([
            [0.1, 0.1], [0.2, 0.2], [0.5, 0.5]
        ]);

        expect(sorted(await store.snapping(bounds, { missions: ['m1', 'm2'] }))).toEqual([
            [-0.5, -0.5], [-0.6, -0.6], [0.1, 0.1], [0.2, 0.2], [0.5, 0.5]
        ]);
    });

    it('ignores mission features tombstoned by a pending delete', async () => {
        const store = setup([]);
        await missionFeature('m1', 'gone', [[0.1, 0.1]], true);
        await missionFeature('m1', 'kept', [[0.3, 0.3]]);

        expect(sorted(await store.snapping(bounds, { missions: ['m1'] }))).toEqual([[0.3, 0.3]]);
    });
});
