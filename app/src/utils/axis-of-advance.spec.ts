import { describe, expect, it } from 'vitest';
import type { Position } from 'geojson';
import {
    axisOfAdvanceSIDC,
    axisOfAdvancePolygon,
    axisOfAdvanceCenterline,
    controlPointForWidth,
    defaultWidthMeters,
    pathLengthMeters,
    widthFromControlPoint,
} from './axis-of-advance.ts';

// Straight west to east path, roughly 2.6 km long at 39N
const path: Position[] = [
    [-108.4531, 39.0801],
    [-108.4388, 39.0801],
    [-108.4230, 39.0801],
];

describe('axisOfAdvanceSIDC', () => {
    it('builds the 2525D friendly main attack code', () => {
        expect(axisOfAdvanceSIDC('Main Attack')).toBe('10032500001514030000');
    });

    it('swaps the standard identity for affiliation', () => {
        expect(axisOfAdvanceSIDC('Supporting Attack', 'Hostile')).toBe('10062500001514040000');
    });

    it('rejects unknown variants and affiliations', () => {
        expect(() => axisOfAdvanceSIDC('Nope')).toThrow(/Unknown Axis of Advance variant/);
        expect(() => axisOfAdvanceSIDC('Main Attack', 'Martian')).toThrow(/Unknown affiliation/);
    });
});

describe('path measurement', () => {
    it('measures length in metres', () => {
        const len = pathLengthMeters(path);
        expect(len).toBeGreaterThan(2500);
        expect(len).toBeLessThan(2700);
    });

    it('defaults width to a fraction of the length with a floor', () => {
        expect(defaultWidthMeters(path)).toBeCloseTo(pathLengthMeters(path) * 0.15, 6);
        expect(defaultWidthMeters([[0, 0], [0.00001, 0]])).toBe(10);
    });
});

describe('width and control point', () => {
    it('round trips a width through its control point', () => {
        const cp = controlPointForWidth(path, 400);
        expect(widthFromControlPoint(path, cp)).toBeCloseTo(400, 3);
    });

    it('measures width perpendicular to the head segment', () => {
        // 0.001 deg of latitude is ~111 m north of the line, so width ~222 m
        const width = widthFromControlPoint(path, [-108.4300, 39.0811]);
        expect(width).toBeGreaterThan(220);
        expect(width).toBeLessThan(224);
    });

    it('returns zero for a degenerate path', () => {
        expect(widthFromControlPoint([[0, 0]], [1, 1])).toBe(0);
    });
});

describe('axisOfAdvancePolygon', () => {
    it('returns undefined without two points or a positive width', () => {
        expect(axisOfAdvancePolygon([[0, 0]], 100)).toBeUndefined();
        expect(axisOfAdvancePolygon(path, 0)).toBeUndefined();
    });

    it('produces a closed ring with the tip at the head', () => {
        const poly = axisOfAdvancePolygon(path, 400);
        expect(poly).toBeDefined();

        const ring = poly!.coordinates[0];
        expect(ring[0]).toEqual(ring[ring.length - 1]);

        const head = path[path.length - 1];
        const tip = ring.find((c) => Math.abs(c[0] - head[0]) < 1e-9 && Math.abs(c[1] - head[1]) < 1e-9);
        expect(tip).toBeDefined();
    });

    it('is symmetric about a straight centerline', () => {
        const poly = axisOfAdvancePolygon(path, 400)!;
        const lat = path[0][1];
        const ring = poly.coordinates[0].slice(0, -1);
        const north = ring.filter((c) => c[1] > lat + 1e-9).length;
        const south = ring.filter((c) => c[1] < lat - 1e-9).length;
        expect(north).toBe(south);
    });

    it('caps the head length at the final segment', () => {
        const short: Position[] = [
            [-108.4531, 39.0801],
            [-108.4388, 39.0801],
            [-108.4386, 39.0801],
        ];
        const poly = axisOfAdvancePolygon(short, 400)!;
        const lngs = poly.coordinates[0].map((c) => c[0]);
        // Nothing in the ring may sit west of the tail or east of the head
        expect(Math.min(...lngs)).toBeGreaterThanOrEqual(short[0][0] - 1e-9);
        expect(Math.max(...lngs)).toBeLessThanOrEqual(short[2][0] + 1e-9);
    });

    it('tolerates duplicate consecutive points', () => {
        const poly = axisOfAdvancePolygon([path[0], path[0], path[1], path[2]], 300);
        expect(poly).toBeDefined();
        expect(poly!.coordinates[0].every((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]))).toBe(true);
    });
});

describe('axisOfAdvanceCenterline', () => {
    it('reverses the drawn path so the head comes first', () => {
        const line = axisOfAdvanceCenterline(path);
        expect(line.coordinates[0]).toEqual(path[2]);
        expect(line.coordinates[2]).toEqual(path[0]);
        expect(path[0]).toEqual([-108.4531, 39.0801]);
    });
});
