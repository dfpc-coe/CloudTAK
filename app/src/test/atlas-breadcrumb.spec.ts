import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const server = vi.hoisted(() => ({
    GET: vi.fn(),
    PUT: vi.fn(),
    DELETE: vi.fn(),
    PATCH: vi.fn(),
}));

vi.mock('../std.ts', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../std.ts')>()),
    server,
}));

import { db, FeatureHistorySource } from '../database.ts';
import AtlasDatabase from '../workers/atlas-database.ts';
import AtlasBreadcrumb from '../workers/atlas-breadcrumb.ts';
import FeatureHistory from '../base/feature-history.ts';
import type Atlas from '../workers/atlas.ts';
import type { InputFeature } from '../types.ts';

function feat(uid: string, time: string, coordinates: number[] = [0, 0], props: Record<string, unknown> = {}): InputFeature {
    // Far enough out that the worker never treats the report as already stale
    const stale = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    return {
        id: uid,
        type: 'Feature',
        path: '/',
        properties: { type: 'a-f-G', how: 'm-g', callsign: uid.toUpperCase(), 'marker-color': '#00ff00', time, start: time, stale, ...props },
        geometry: { type: 'Point', coordinates },
    } as unknown as InputFeature;
}

function setup() {
    const atlas = {
        token: 'token',
        postMessage: vi.fn(async () => undefined),
        profile: {
            uid: () => 'me',
            creator: async () => ({ uid: 'me', type: 'a-f-G-E-V-C', callsign: 'ME', time: '2026-01-01T00:00:00Z' }),
        },
    } as unknown as Atlas;

    return new AtlasDatabase(atlas);
}

beforeEach(async () => {
    await db.feature.clear();
    await db.breadcrumb.clear();
    await db.feature_history.clear();
});

describe('AtlasBreadcrumb live recording', () => {
    it('records a history point per distinct report while enabled, without a track CoT', async () => {
        const store = setup();

        await store.add(feat('alpha', '2026-10-26T10:00:00.000Z', [1, 1]));
        expect(await FeatureHistory.count('alpha')).toBe(0);

        await store.breadcrumb.set('alpha', true);
        expect(await store.breadcrumb.get('alpha')).toBe(true);
        expect(await store.breadcrumb.listEnabled()).toEqual(['alpha']);

        const trail = await db.breadcrumb.get('alpha.track');
        expect(trail).toMatchObject({ uid: 'alpha', callsign: 'ALPHA', color: '#00ff00', live: true });

        await store.add(feat('alpha', '2026-10-26T10:01:00.000Z', [2, 2], { speed: 4 }));
        await store.add(feat('alpha', '2026-10-26T10:01:00.000Z', [2, 2], { speed: 4 }));
        await store.add(feat('alpha', '2026-10-26T10:02:00.000Z', [3, 3], { speed: 5 }));

        const rows = await FeatureHistory.list({ uid: 'alpha' });
        expect(rows.map((r) => [r.time, r.source, r.properties.speed])).toEqual([
            [Date.parse('2026-10-26T10:01:00.000Z'), FeatureHistorySource.Live, 4],
            [Date.parse('2026-10-26T10:02:00.000Z'), FeatureHistorySource.Live, 5],
        ]);
        expect(rows[1].geometry).toEqual({ type: 'Point', coordinates: [3, 3] });

        expect(store.cots.has('alpha.track')).toBe(false);

        await store.breadcrumb.set('alpha', false);
        await store.add(feat('alpha', '2026-10-26T10:03:00.000Z', [4, 4]));
        expect(await FeatureHistory.count('alpha')).toBe(2);
        expect((await db.breadcrumb.get('alpha.track'))?.live).toBe(false);
    });

    it('restores the enabled set from persisted trails on load', async () => {
        await db.breadcrumb.put({ id: 'alpha.track', uid: 'alpha', path: '/', callsign: 'ALPHA', live: true });
        await db.breadcrumb.put({ id: 'bravo.track', uid: 'bravo', path: '/', callsign: 'BRAVO', live: false });

        const crumb = new AtlasBreadcrumb(setup());
        await crumb.load();

        expect(await crumb.get('alpha')).toBe(true);
        expect(await crumb.get('bravo')).toBe(false);
    });
});

describe('AtlasBreadcrumb.ingest', () => {
    it('records loaded history for several uids and creates trail metadata from the newest report', async () => {
        const store = setup();
        await store.add(feat('alpha', '2026-10-26T10:05:00.000Z', [9, 9]));

        const count = await store.breadcrumb.ingest([
            feat('alpha', '2026-10-26T10:02:00.000Z', [3, 3]),
            feat('alpha', '2026-10-26T10:00:00.000Z', [1, 1]),
            feat('bravo', '2026-10-26T10:00:30.000Z', [5, 5], { callsign: 'BRAVO-OLD' }),
            feat('bravo', '2026-10-26T10:01:30.000Z', [6, 6], { callsign: 'BRAVO-NEW' }),
            { id: 'charlie', type: 'Feature', path: '/', properties: { type: 'a-f-G', callsign: 'C' }, geometry: { type: 'Point', coordinates: [0, 0] } } as unknown as InputFeature,
        ]);

        expect(count).toBe(4);
        expect(await FeatureHistory.count()).toBe(4);
        expect((await FeatureHistory.list({ uid: 'alpha' })).map((r) => r.time)).toEqual([
            Date.parse('2026-10-26T10:00:00.000Z'),
            Date.parse('2026-10-26T10:02:00.000Z'),
        ]);

        expect(await db.breadcrumb.get('alpha.track')).toMatchObject({ uid: 'alpha', callsign: 'ALPHA', color: '#00ff00', live: false });
        expect(await db.breadcrumb.get('bravo.track')).toMatchObject({ uid: 'bravo', callsign: 'BRAVO-NEW', live: false });
        expect(await db.breadcrumb.get('charlie.track')).toBeUndefined();

        // Loading again is idempotent
        await store.breadcrumb.ingest([feat('alpha', '2026-10-26T10:02:00.000Z', [3, 3])]);
        expect(await FeatureHistory.count('alpha')).toBe(2);
    });

    it('keeps live recording on when history is loaded for an enabled uid', async () => {
        const store = setup();
        await store.breadcrumb.set('alpha', true);

        await store.breadcrumb.ingest([feat('alpha', '2026-10-26T09:00:00.000Z', [1, 1])]);
        expect((await db.breadcrumb.get('alpha.track'))?.live).toBe(true);

        await store.add(feat('alpha', '2026-10-26T10:00:00.000Z', [2, 2]));
        expect((await FeatureHistory.list({ uid: 'alpha' })).map((r) => r.source)).toEqual([
            FeatureHistorySource.History,
            FeatureHistorySource.Live,
        ]);
    });
});

describe('AtlasBreadcrumb removal', () => {
    it('remove() drops the trail, its points and live recording', async () => {
        const store = setup();
        await store.breadcrumb.set('alpha', true);
        await store.breadcrumb.ingest([feat('alpha', '2026-10-26T09:00:00.000Z', [1, 1])]);

        await store.breadcrumb.remove('alpha');

        expect(await db.breadcrumb.get('alpha.track')).toBeUndefined();
        expect(await FeatureHistory.count('alpha')).toBe(0);
        expect(await store.breadcrumb.get('alpha')).toBe(false);
    });

    it('deleting the CoT takes its trail with it', async () => {
        const store = setup();
        await store.add(feat('alpha', '2026-10-26T10:00:00.000Z', [1, 1]));
        await store.breadcrumb.set('alpha', true);
        await store.add(feat('alpha', '2026-10-26T10:01:00.000Z', [2, 2]));
        expect(await FeatureHistory.count('alpha')).toBe(1);

        await store.remove('alpha', { skipNetwork: true });

        expect(await db.breadcrumb.get('alpha.track')).toBeUndefined();
        expect(await FeatureHistory.count('alpha')).toBe(0);
        expect(await store.breadcrumb.get('alpha')).toBe(false);
    });

    it('legacy merge() keeps bare coordinates on the trail row', async () => {
        const store = setup();

        await store.breadcrumb.merge('alpha', [[1, 1], [2, 2]]);
        await store.breadcrumb.merge('alpha', [[0, 0]]);
        await store.breadcrumb.merge('alpha', [[-2, -2], [-1, -1]]);

        expect((await db.breadcrumb.get('alpha.track'))?.coordinates).toEqual([[-2, -2], [-1, -1], [1, 1], [2, 2]]);
        expect(await FeatureHistory.count('alpha')).toBe(0);
    });
});
