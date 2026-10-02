import { describe, it, expect } from 'vitest';
import { TileType, type Header } from 'pmtiles';
import { profileAssetIdFromUrl, offlineTileJSON, isOfflineTileJSON } from './offline-tiles.ts';

describe('profileAssetIdFromUrl', () => {
    it('extracts the asset id from an absolute overlay URL', () => {
        expect(profileAssetIdFromUrl('https://api.example.com/api/profile/asset/1db1f443-23e2-44b1-b879-fab2db95ce66.pmtiles/tile'))
            .toBe('1db1f443-23e2-44b1-b879-fab2db95ce66');
    });

    it('accepts a bare path', () => {
        expect(profileAssetIdFromUrl('/api/profile/asset/1DB1F443-23E2-44B1-B879-FAB2DB95CE66.pmtiles/tile/'))
            .toBe('1DB1F443-23E2-44B1-B879-FAB2DB95CE66');
    });

    it('ignores non-profile tile URLs', () => {
        expect(profileAssetIdFromUrl('https://tiles.example.com/tiles/public/roads')).toBeUndefined();
        expect(profileAssetIdFromUrl('https://api.example.com/api/basemap/3/tiles/{z}/{x}/{y}')).toBeUndefined();
        expect(profileAssetIdFromUrl(undefined)).toBeUndefined();
        expect(profileAssetIdFromUrl('')).toBeUndefined();
    });
});

const HEADER = {
    tileType: TileType.Mvt,
    minZoom: 2,
    maxZoom: 12,
    minLon: -105.5,
    minLat: 39.5,
    maxLon: -104.5,
    maxLat: 40.5,
    centerLon: -105,
    centerLat: 40,
    centerZoom: 8,
} as Header;

describe('offlineTileJSON', () => {
    it('builds TileJSON from the archive header and metadata', () => {
        const tilejson = offlineTileJSON('abc', HEADER, {
            name: 'Roads',
            attribution: 'Test',
            vector_layers: [{ id: 'out', fields: {} }],
        });

        expect(tilejson).toEqual({
            tilejson: '3.0.0',
            version: '1.0.0',
            scheme: 'xyz',
            name: 'Roads',
            description: '',
            attribution: 'Test',
            format: 'mvt',
            minzoom: 2,
            maxzoom: 12,
            bounds: [-105.5, 39.5, -104.5, 40.5],
            center: [-105, 40, 8],
            tiles: ['cloudtak-pmtiles://abc/{z}/{x}/{y}'],
            vector_layers: [{ id: 'out', fields: {} }],
        });

        expect(isOfflineTileJSON(tilejson)).toBe(true);
    });

    it('falls back to the asset id and raster format without metadata', () => {
        const tilejson = offlineTileJSON('abc', { ...HEADER, tileType: TileType.Png }, null);

        expect(tilejson.name).toBe('abc');
        expect(tilejson.format).toBe('png');
        expect(tilejson.vector_layers).toBeUndefined();
        expect(isOfflineTileJSON({ tiles: ['https://tiles.example.com/{z}/{x}/{y}.mvt'] })).toBe(false);
    });
});
