import { describe, expect, it } from 'vitest';
import { FeatureHistorySource, type DBBreadcrumb, type DBFeatureHistory } from '../../database.ts';
import { historyCollection, historyPointFeature, defaultPopup, HISTORY_DEFAULT_COLOR } from './history.ts';

function row(uid: string, time: string, coordinates: number[], props: Record<string, unknown> = {}): DBFeatureHistory {
    return {
        id: `${uid}@${time}`,
        uid,
        time: Date.parse(time),
        callsign: uid.toUpperCase(),
        type: 'a-f-G',
        path: '/',
        source: FeatureHistorySource.History,
        properties: { id: uid, type: 'a-f-G', callsign: uid.toUpperCase(), time, ...props } as DBFeatureHistory['properties'],
        geometry: { type: 'Point', coordinates },
    };
}

function trail(uid: string, extra: Partial<DBBreadcrumb> = {}): DBBreadcrumb {
    return { id: `${uid}.track`, uid, path: '/', callsign: uid.toUpperCase(), live: false, ...extra };
}

describe('historyCollection', () => {
    it('emits a point per report and one chronological trail per uid in the trail colour', () => {
        const collection = historyCollection([
            row('alpha', '2026-10-26T10:02:00.000Z', [3, 3, 100]),
            row('bravo', '2026-10-26T10:00:00.000Z', [7, 7]),
            row('alpha', '2026-10-26T10:00:00.000Z', [1, 1]),
            row('alpha', '2026-10-26T10:01:00.000Z', [2, 2]),
        ], [trail('alpha', { color: '#123456' })]);

        const points = collection.features.filter((f) => f.geometry.type === 'Point');
        const lines = collection.features.filter((f) => f.geometry.type === 'LineString');

        expect(points).toHaveLength(4);
        expect(points.map((f) => f.properties.id)).toEqual([
            'alpha@2026-10-26T10:00:00.000Z',
            'alpha@2026-10-26T10:01:00.000Z',
            'alpha@2026-10-26T10:02:00.000Z',
            'bravo@2026-10-26T10:00:00.000Z',
        ]);
        expect(points[2].geometry).toEqual({ type: 'Point', coordinates: [3, 3] });
        expect(points[0].properties.color).toBe('#123456');
        expect(points[3].properties.color).toBe(HISTORY_DEFAULT_COLOR);

        expect(lines).toHaveLength(1);
        expect(lines[0].properties).toMatchObject({ uid: 'alpha', color: '#123456', trail: true });
        expect(lines[0].geometry).toEqual({ type: 'LineString', coordinates: [[1, 1], [2, 2], [3, 3]] });
    });

    it('draws legacy coordinates only for trails without history points', () => {
        const collection = historyCollection(
            [row('alpha', '2026-10-26T10:00:00.000Z', [1, 1])],
            [
                trail('alpha', { coordinates: [[0, 0], [1, 1]] }),
                trail('legacy', { coordinates: [[5, 5], [6, 6]], color: '#abcdef' }),
                trail('empty', { coordinates: [[5, 5]] }),
            ]
        );

        const lines = collection.features.filter((f) => f.geometry.type === 'LineString');
        expect(lines).toHaveLength(1);
        expect(lines[0].properties).toMatchObject({ uid: 'legacy', legacy: true, color: '#abcdef' });
        expect(lines[0].geometry).toEqual({ type: 'LineString', coordinates: [[5, 5], [6, 6]] });
    });

    it('skips non-point reports for points and trails', () => {
        const polygon = row('alpha', '2026-10-26T10:00:00.000Z', [0, 0]);
        polygon.geometry = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] };

        const collection = historyCollection([polygon, row('alpha', '2026-10-26T10:01:00.000Z', [1, 1])], []);
        expect(collection.features).toHaveLength(1);
        expect(collection.features[0].geometry.type).toBe('Point');
    });
});

describe('historyPointFeature', () => {
    it('exposes the properties the CoT carried at that time under the point id', () => {
        const feature = historyPointFeature(row('alpha', '2026-10-26T10:00:00.000Z', [1, 1], { speed: 3, remarks: 'then' }));

        expect(feature.id).toBe('alpha@2026-10-26T10:00:00.000Z');
        expect(feature.properties).toMatchObject({
            id: 'alpha@2026-10-26T10:00:00.000Z',
            callsign: 'ALPHA',
            time: '2026-10-26T10:00:00.000Z',
            speed: 3,
            remarks: 'then',
        });
        expect(feature.geometry).toEqual({ type: 'Point', coordinates: [1, 1] });
    });
});

describe('defaultPopup', () => {
    it('escapes the callsign and includes motion when present', () => {
        const html = defaultPopup(row('alpha', '2026-10-26T10:00:00.000Z', [1, 1], { speed: 2.345, course: 90.4 }));

        expect(html).toContain('ALPHA');
        expect(html).toContain('Speed: 2.3 m/s');
        expect(html).toContain('Course: 90°');
        expect(html).toContain('a-f-G');
        expect(html.indexOf('ALPHA')).toBeLessThan(html.indexOf('a-f-G'));
        expect(html.indexOf('a-f-G')).toBeLessThan(html.indexOf('cloudtak-history-popup-time'));

        const named = defaultPopup(row('alpha', '2026-10-26T10:00:00.000Z', [1, 1]), 'Ground');
        expect(named).toContain('Ground');
        expect(named).not.toContain('a-f-G');

        const hostile = row('alpha', '2026-10-26T10:00:00.000Z', [1, 1]);
        hostile.callsign = '<img src=x onerror=alert(1)>';
        expect(defaultPopup(hostile)).not.toContain('<img');
        expect(defaultPopup(hostile)).toContain('&lt;img');
    });
});
