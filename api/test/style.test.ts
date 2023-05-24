import test from 'node:test';
import assert from 'assert';
import Style from '../lib/style.js';

test('Style: Basic Point', async () => {
    const style = new Style({
        stale: 123,
        enabled_styles: true,
        styles: {
            point: {
                color: '#ffffff',
                remarks: 'Test Remarks'
            }
        }
    });

    assert.deepEqual(await style.feat({
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'Point',
            coordinates: [0, 0]
        }
    }), {
        type: 'Feature',
        properties: {
            color: '#ffffff',
            remarks: 'Test Remarks',
            stale: 123
        },
        geometry: {
            type: 'Point',
            coordinates: [0, 0]
        }
    });
});

test('Style: Basic Point: Disabled', async () => {
    const style = new Style({
        stale: 123,
        enabled_styles: false,
        styles: {
            point: {
                color: '#ffffff',
                remarks: 'Test Remarks'
            }
        }
    });

    assert.deepEqual(await style.feat({
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'Point',
            coordinates: [0, 0]
        }
    }), {
        type: 'Feature',
        properties: {
            stale: 123
        },
        geometry: {
            type: 'Point',
            coordinates: [0, 0]
        }
    });
});

test('Style: Basic Point: Stale only applied if stale is undefined on root feature', async () => {
    const style = new Style({
        stale: 123,
        enabled_styles: false,
        styles: {
            point: {
                color: '#ffffff',
                remarks: 'Test Remarks'
            }
        }
    });

    assert.deepEqual(await style.feat({
        type: 'Feature',
        properties: {
            stale: 321
        },
        geometry: {
            type: 'Point',
            coordinates: [0, 0]
        }
    }), {
        type: 'Feature',
        properties: {
            stale: 321
        },
        geometry: {
            type: 'Point',
            coordinates: [0, 0]
        }
    });
});
