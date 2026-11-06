import { describe, expect, it } from 'vitest';
import {
    BasemapModes,
    beginMode,
    blankEditing,
    fromImport,
    resolveMode,
    toBasemapBody,
    validateEditing,
} from './modes.ts';
import type { BasemapImport } from './types.ts';

describe('resolveMode', () => {
    it('recognises url shapes before falling back to the stored protocol', () => {
        expect(resolveMode('https://example.com/arcgis/rest/services/Parcels/FeatureServer/1', 'zxy')).toBe('featureserver');
        expect(resolveMode('https://tiles.example.com/tiles/slope/4/tiles/{z}/{x}/{y}?layer=27:30:ffeb3b', 'zxy')).toBe('slope');
        expect(resolveMode('https://tiles.example.com/tiles/composite/eyJsYXllcnMiOltdfQ/tiles/{z}/{x}/{y}', 'zxy')).toBe('composite');
        expect(resolveMode('https://example.com/tiles/{$z}/{$x}/{$y}.png', 'hosted')).toBe('zxy');
    });

    it('uses the stored protocol when the url matches no pattern', () => {
        expect(resolveMode('https://example.com/arcgis/rest/services/Topo/MapServer/1/', 'mapserver')).toBe('mapserver');
    });

    it('defaults to zxy for import-only or unknown protocols', () => {
        expect(resolveMode('https://example.com/tiles', 'hosted')).toBe('zxy');
        expect(resolveMode('https://example.com/tiles', null)).toBe('zxy');
    });
});

describe('mode registry', () => {
    it('only form modes persist a protocol', () => {
        expect(BasemapModes.zxy.protocol).toBe('zxy');
        expect(BasemapModes.featureserver.protocol).toBe('featureserver');
        expect(BasemapModes.slope.protocol).toBe('zxy');
        expect(BasemapModes.composite.protocol).toBe('zxy');
        expect(BasemapModes.tilejson.protocol).toBeNull();
        expect(BasemapModes.upload.protocol).toBeNull();
        expect(BasemapModes.hosted.protocol).toBeNull();
    });

    it('gates the form on a tile source for import-first modes', () => {
        const editing = blankEditing();

        expect(BasemapModes.zxy.ready(editing)).toBe(true);
        expect(BasemapModes.mapserver.ready(editing)).toBe(false);
        expect(BasemapModes.mapserver.ready(editing, 9)).toBe(true);
        expect(BasemapModes.slope.ready({ ...editing, url: 'https://x/tiles/slope/1/tiles/{z}/{x}/{y}' })).toBe(true);
        expect(BasemapModes.tilejson.ready({ ...editing, url: 'https://x/{$z}/{$x}/{$y}' })).toBe(false);
    });
});

describe('beginMode', () => {
    it('applies the mode defaults but keeps fields already filled in', () => {
        const editing = beginMode('featureserver', blankEditing({ name: 'Parcels', url: 'stale', overlay: true }));

        expect(editing.name).toBe('Parcels');
        expect(editing.overlay).toBe(true);
        expect(editing.url).toBe('');
        expect(editing.type).toBe('vector');
        expect(editing.format).toBe('mvt');
        expect(editing.maxzoom).toBe(20);
    });
});

describe('fromImport', () => {
    it('infers the continuation mode from the imported tiles unless told otherwise', () => {
        const data = {
            name: 'Imported',
            tiles: ['https://example.com/arcgis/rest/services/Topo/MapServer/3'],
            vector_layers: [{ id: 'roads' }],
        } as BasemapImport;

        expect(fromImport(data).mode).toBe('mapserver');
        expect(fromImport(data, 'imageserver').mode).toBe('imageserver');
        expect(fromImport(data).vectorLayers).toEqual([{ id: 'roads' }]);
    });
});

describe('toBasemapBody', () => {
    it('serialises a vector basemap with every optional field present', () => {
        const body = toBasemapBody(blankEditing({
            name: 'Parcels',
            url: 'https://example.com/{$z}/{$x}/{$y}.mvt',
            type: 'vector',
            format: 'mvt',
            title: '{{owner}}',
            collection: ' Land ',
            attribution: 'County',
            frequency: 120,
            snapping_enabled: true,
            snapping_layer: 'parcels',
            tilejson: 'https://example.com/tilejson.json',
        }), 'zxy', 'server');

        expect(body).toMatchObject({
            scope: 'server',
            protocol: 'zxy',
            name: 'Parcels',
            title: '{{owner}}',
            collection: ' Land ',
            attribution: 'County',
            frequency: 120,
            snapping_layer: 'parcels',
            tilejson: 'https://example.com/tilejson.json',
            bounds: [-180, -90, 180, 90],
            center: [0, 0],
        });
        expect(body).not.toHaveProperty('encoding');
    });

    it('nulls blank text fields and drops fields that do not apply', () => {
        const body = toBasemapBody(blankEditing({
            name: 'Imagery',
            url: 'https://example.com/{$z}/{$x}/{$y}.png',
            title: '{{callsign}}',
            collection: '  ',
            attribution: '',
            frequency: 0,
            snapping_enabled: false,
            snapping_layer: 'stale',
            bounds: [],
            center: [],
            encoding: 'terrarium',
        }), 'zxy', 'user');

        expect(body.collection).toBeNull();
        expect(body.attribution).toBeNull();
        expect(body.frequency).toBeNull();
        expect(body.encoding).toBe('terrarium');
        expect(body).not.toHaveProperty('title');
        expect(body).not.toHaveProperty('snapping_layer');
        expect(body).not.toHaveProperty('bounds');
        expect(body).not.toHaveProperty('center');
        expect(body).not.toHaveProperty('tilejson');
    });
});

describe('validateEditing', () => {
    it('requires a name and a url', () => {
        expect(validateEditing(blankEditing())).toEqual({ name: 'Cannot be empty', url: 'Cannot be empty' });
        expect(validateEditing(blankEditing({ name: 'A', url: 'https://x' }))).toEqual({ name: '', url: '' });
    });
});
