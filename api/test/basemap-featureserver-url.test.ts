import test from 'node:test';
import assert from 'node:assert';
import FeatureServerBasemap from '../stateless/lib/basemap/featureserver.js';

const layer = 'https://example.com/arcgis/rest/services/Parcels/FeatureServer/0';

const quantization = (z: number, x: number, y: number) => {
    const url = FeatureServerBasemap.esriVectorTileURL(layer, z, x, y);
    return JSON.parse(url.searchParams.get('quantizationParameters')!);
};

test('esriVectorTileURL: quantization tolerance is one unit of a 4096 extent tile', () => {
    const z15 = quantization(15, 6502, 12515);

    assert.deepEqual(z15.mode, 'view');
    assert.ok(Math.abs(z15.tolerance - (z15.extent.xmax - z15.extent.xmin) / 4096) < 1e-12);
    assert.ok(z15.tolerance < 1e-5);
});

test('esriVectorTileURL: quantization tolerance halves with each zoom level', () => {
    for (let z = 0; z < 22; z++) {
        const coarse = quantization(z, 0, 0).tolerance;
        const fine = quantization(z + 1, 0, 0).tolerance;

        assert.ok(Math.abs(coarse / fine - 2) < 1e-9, `z${z} -> z${z + 1}`);
    }
});

test('esriVectorTileURL: quantization extent matches the geometry envelope', () => {
    const url = FeatureServerBasemap.esriVectorTileURL(layer, 15, 6502, 12515);

    const q = JSON.parse(url.searchParams.get('quantizationParameters')!);
    const geometry = JSON.parse(url.searchParams.get('geometry')!);

    assert.deepEqual(q.extent, geometry);
    assert.equal(url.searchParams.get('f'), 'json');
    assert.equal(url.pathname.endsWith('/FeatureServer/0/query'), true);
});
