import { describe, expect, it } from 'vitest';
import { normalizeEditing } from './types.ts';
import type { BasemapImport } from './types.ts';

describe('normalizeEditing', () => {
    it('keeps a TileJSON [lon, lat, zoom] center in full', () => {
        const editing = normalizeEditing({
            name: 'public/snapping.pmtiles',
            type: 'vector',
            tiles: ['https://tiles.example.com/tiles/public/snapping/tiles/{$z}/{$x}/{$y}.mvt'],
            center: [-105.1, 39.7, 14],
        } as BasemapImport);

        expect(editing.center).toEqual([-105.1, 39.7, 14]);
    });

    it('drops elements beyond [lon, lat, zoom]', () => {
        const editing = normalizeEditing({
            name: 'Test',
            center: [-105.1, 39.7, 14, 99],
        } as BasemapImport);

        expect(editing.center).toEqual([-105.1, 39.7, 14]);
    });

    it('keeps a 2 element center as-is', () => {
        const editing = normalizeEditing({
            name: 'Test',
            center: [12.5, 41.9],
        } as BasemapImport);

        expect(editing.center).toEqual([12.5, 41.9]);
    });

    it('falls back to [0, 0] when center is missing', () => {
        const editing = normalizeEditing({
            name: 'Test',
        } as BasemapImport);

        expect(editing.center).toEqual([0, 0]);
    });

    it('falls back to [0, 0] when center has fewer than 2 elements', () => {
        const editing = normalizeEditing({
            name: 'Test',
            center: [12.5],
        } as BasemapImport);

        expect(editing.center).toEqual([0, 0]);
    });
});
