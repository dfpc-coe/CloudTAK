import test from 'node:test';
import assert from 'node:assert';
import { esriToGeoJSON, parseFeatureSet } from '../stateless/lib/esri/geojson.js';

// Esri convention: clockwise exterior, counter-clockwise hole
const cw = (x0: number, y0: number, x1: number, y1: number) => [[x0, y0], [x0, y1], [x1, y1], [x1, y0], [x0, y0]];
const ccw = (x0: number, y0: number, x1: number, y1: number) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];

const signedArea = (ring: Array<Array<number>>) => {
    let area = 0;
    for (let i = 0; i < ring.length - 1; i++) {
        area += (ring[i + 1][0] - ring[i][0]) * (ring[i + 1][1] + ring[i][1]);
    }
    return area;
};

test('esriToGeoJSON: polygon holes are nested instead of flattened', () => {
    const fc = esriToGeoJSON(parseFeatureSet({
        objectIdFieldName: 'OBJECTID',
        geometryType: 'esriGeometryPolygon',
        features: [{
            attributes: { OBJECTID: 93455, Agency: 'Bureau of Land Management' },
            geometry: {
                rings: [
                    cw(0, 0, 10, 10),
                    ccw(1, 1, 2, 2),
                    ccw(5, 5, 6, 6),
                ],
            },
        }],
    }));

    assert.equal(fc.features.length, 1);
    const feat = fc.features[0];
    assert.equal(feat.id, 93455);
    assert.deepEqual(feat.properties, { OBJECTID: 93455, Agency: 'Bureau of Land Management' });
    assert.equal(feat.geometry.type, 'Polygon');

    const rings = feat.geometry.coordinates as Array<Array<Array<number>>>;
    assert.equal(rings.length, 3);
    assert.ok(signedArea(rings[0]) < 0, 'exterior is rewound counter-clockwise for GeoJSON');
    assert.ok(signedArea(rings[1]) > 0, 'hole is rewound clockwise for GeoJSON');
    assert.ok(signedArea(rings[2]) > 0, 'hole is rewound clockwise for GeoJSON');
});

test('esriToGeoJSON: multipart polygon assigns holes to the smallest containing exterior', () => {
    const fc = esriToGeoJSON(parseFeatureSet({
        objectIdFieldName: 'OBJECTID',
        features: [{
            attributes: { OBJECTID: 1 },
            geometry: {
                rings: [
                    cw(0, 0, 10, 10),
                    cw(20, 20, 30, 30),
                    ccw(2, 2, 8, 8),
                    cw(4, 4, 6, 6),
                    ccw(22, 22, 23, 23),
                ],
            },
        }],
    }));

    const geom = fc.features[0].geometry;
    assert.equal(geom.type, 'MultiPolygon');

    const polys = geom.coordinates as Array<Array<Array<Array<number>>>>;
    assert.equal(polys.length, 3);

    const byOrigin = (x: number, y: number) => polys.find(p => p[0].some(c => c[0] === x && c[1] === y));

    const big = byOrigin(0, 0)!;
    assert.equal(big.length, 2, 'big exterior has one hole');
    assert.equal(big[1].some(c => c[0] === 2 && c[1] === 2), true);

    const island = byOrigin(4, 4)!;
    assert.equal(island.length, 1, 'island inside the hole is its own exterior');

    const second = byOrigin(20, 20)!;
    assert.equal(second.length, 2, 'second exterior has one hole');
});

test('esriToGeoJSON: orphan hole becomes an exterior and degenerate rings are dropped', () => {
    const fc = esriToGeoJSON(parseFeatureSet({
        features: [{
            attributes: { FID: 7 },
            geometry: {
                rings: [
                    ccw(0, 0, 1, 1),
                    [[5, 5], [6, 6], [5, 5]],
                    [[7, 7], [8, 8]],
                ],
            },
        }],
    }));

    assert.equal(fc.features.length, 1);
    assert.equal(fc.features[0].id, 7);
    assert.equal(fc.features[0].geometry.type, 'Polygon');
    assert.equal((fc.features[0].geometry.coordinates as Array<unknown>).length, 1);
});

test('esriToGeoJSON: quantized transform is delta decoded and scaled', () => {
    const transform = {
        originPosition: 'upperLeft',
        scale: [0.001, 0.001],
        translate: [-110.390625, 38.8225909761771],
    };

    const fc = esriToGeoJSON(parseFeatureSet({
        objectIdFieldName: 'OBJECTID',
        transform,
        features: [{
            attributes: { OBJECTID: 1 },
            geometry: {
                rings: [[[-347, 1206], [5, 0], [0, -4], [-5, 0], [0, 4]]],
            },
        }, {
            attributes: { OBJECTID: 2 },
            geometry: { x: 10, y: 20 },
        }],
    }));

    const ring = fc.features[0].geometry.coordinates[0] as Array<Array<number>>;
    assert.equal(fc.features[0].geometry.type, 'Polygon');
    assert.deepEqual(ring[0], [transform.translate[0] - 347 * 0.001, transform.translate[1] - 1206 * 0.001]);
    assert.deepEqual(ring[1], [transform.translate[0] - 342 * 0.001, transform.translate[1] - 1206 * 0.001]);
    assert.deepEqual(ring[2], [transform.translate[0] - 342 * 0.001, transform.translate[1] - 1202 * 0.001]);
    assert.deepEqual(ring[4], ring[0]);

    assert.deepEqual(fc.features[1].geometry, {
        type: 'Point',
        coordinates: [transform.translate[0] + 10 * 0.001, transform.translate[1] - 20 * 0.001],
    });
});

test('esriToGeoJSON: points, multipoints and polylines', () => {
    const fc = esriToGeoJSON(parseFeatureSet({
        features: [
            { attributes: { OBJECTID: 1 }, geometry: { x: 1, y: 2 } },
            { attributes: { OBJECTID: 2 }, geometry: { points: [[1, 2], [3, 4]] } },
            { attributes: { OBJECTID: 3 }, geometry: { paths: [[[0, 0], [1, 1]]] } },
            { attributes: { OBJECTID: 4 }, geometry: { paths: [[[0, 0], [1, 1]], [[2, 2], [3, 3]]] } },
            { attributes: { OBJECTID: 5 }, geometry: null },
            { attributes: { OBJECTID: 6 } },
        ],
    }));

    assert.deepEqual(fc.features.map(f => [f.id, f.geometry.type]), [
        [1, 'Point'],
        [2, 'MultiPoint'],
        [3, 'LineString'],
        [4, 'MultiLineString'],
    ]);
});

test('parseFeatureSet: upstream error payloads throw', () => {
    assert.throws(() => {
        parseFeatureSet({ error: { code: 400, message: 'Invalid Token', details: ['Token Expired'] } });
    }, /Upstream Error: Invalid Token: Token Expired/);

    assert.throws(() => {
        parseFeatureSet({ hello: 'world' });
    }, /Invalid FeatureSet response/);
});
