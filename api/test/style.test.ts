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
            metadata: {},
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

test('Style: Global Remarks & Callsign', async () => {
    const style = new Style({
        stale: 123,
        enabled_styles: true,
        styles: {
            remarks: '{{override}}',
            callsign: '{{override_callsign}}'
        }
    });

    assert.deepEqual((await style.feat({
        type: 'Feature',
        properties: {
            metadata: {
                override: 'OVERRIDE',
                override_callsign: 'OVERRIDE_CALLSIGN'
            }
        },
        geometry: {
            type: 'Point',
            coordinates: [0, 0]
        }
    })).properties, {
        stale: 123,
        remarks: 'OVERRIDE',
        callsign: 'OVERRIDE_CALLSIGN',
        metadata: {
            override: 'OVERRIDE',
            override_callsign: 'OVERRIDE_CALLSIGN'
        }
    });
});

test('Style: Global Remarks & Callsign - Override by Point', async () => {
    const style = new Style({
        stale: 123,
        enabled_styles: true,
        styles: {
            remarks: '{{override}}',
            callsign: '{{override_callsign}}',
            point: {
                remarks: '{{override_point}}',
                callsign: '{{override_point_callsign}}',
            }
        }
    });

    assert.deepEqual((await style.feat({
        type: 'Feature',
        properties: {
            metadata: {
                override: 'OVERRIDE',
                override_callsign: 'OVERRIDE_CALLSIGN',
                override_point: 'OVERRIDE_POINT',
                override_point_callsign: 'OVERRIDE_POINT_CALLSIGN'
            }
        },
        geometry: {
            type: 'Point',
            coordinates: [0, 0]
        }
    })).properties, {
        stale: 123,
        remarks: 'OVERRIDE_POINT',
        callsign: 'OVERRIDE_POINT_CALLSIGN',
        metadata: {
            override: 'OVERRIDE',
            override_callsign: 'OVERRIDE_CALLSIGN',
            override_point: 'OVERRIDE_POINT',
            override_point_callsign: 'OVERRIDE_POINT_CALLSIGN'
        }
    });
});

test('Style: Global Remarks & Callsign - Override by Global Query', async () => {
    const style = new Style({
        stale: 123,
        enabled_styles: true,
        styles: {
            remarks: '{{override}}',
            callsign: '{{override_callsign}}',
            point: {
                remarks: '{{override_point}}',
                callsign: '{{override_point_callsign}}',
            },
            queries: [{
                query: 'properties.metadata.override = "OVERRIDE"',
                styles: {
                    remarks: '{{override_query}}',
                    callsign: '{{override_query_callsign}}',
                }
            }]
        }
    });

    assert.deepEqual((await style.feat({
        type: 'Feature',
        properties: {
            metadata: {
                override: 'OVERRIDE',
                override_callsign: 'OVERRIDE_CALLSIGN',
                override_point: 'OVERRIDE_POINT',
                override_point_callsign: 'OVERRIDE_POINT_CALLSIGN',
                override_query: 'OVERRIDE_QUERY',
                override_query_callsign: 'OVERRIDE_QUERY_CALLSIGN'
            }
        },
        geometry: {
            type: 'Point',
            coordinates: [0, 0]
        }
    })).properties, {
        stale: 123,
        remarks: 'OVERRIDE_QUERY',
        callsign: 'OVERRIDE_QUERY_CALLSIGN',
        metadata: {
            override: 'OVERRIDE',
            override_callsign: 'OVERRIDE_CALLSIGN',
            override_point: 'OVERRIDE_POINT',
            override_point_callsign: 'OVERRIDE_POINT_CALLSIGN',
            override_query: 'OVERRIDE_QUERY',
            override_query_callsign: 'OVERRIDE_QUERY_CALLSIGN'
        }
    });
});

test('Style: Global Remarks & Callsign - Override by Query Point', async () => {
    const style = new Style({
        stale: 123,
        enabled_styles: true,
        styles: {
            remarks: '{{override}}',
            callsign: '{{override_callsign}}',
            point: {
                remarks: '{{override_point}}',
                callsign: '{{override_point_callsign}}',
            },
            queries: [{
                query: 'properties.metadata.override = "OVERRIDE"',
                styles: {
                    remarks: '{{override_query}}',
                    callsign: '{{override_query_callsign}}',
                    point: {
                        remarks: '{{override_query_point}}',
                        callsign: '{{override_query_point_callsign}}',
                    }
                }
            }]
        }
    });

    assert.deepEqual((await style.feat({
        type: 'Feature',
        properties: {
            metadata: {
                override: 'OVERRIDE',
                override_callsign: 'OVERRIDE_CALLSIGN',
                override_point: 'OVERRIDE_POINT',
                override_point_callsign: 'OVERRIDE_POINT_CALLSIGN',
                override_query: 'OVERRIDE_QUERY',
                override_query_callsign: 'OVERRIDE_QUERY_CALLSIGN',
                override_query_point: 'OVERRIDE_QUERY_POINT',
                override_query_point_callsign: 'OVERRIDE_QUERY_POINT_CALLSIGN'
            }
        },
        geometry: {
            type: 'Point',
            coordinates: [0, 0]
        }
    })).properties, {
        stale: 123,
        remarks: 'OVERRIDE_QUERY_POINT',
        callsign: 'OVERRIDE_QUERY_POINT_CALLSIGN',
        metadata: {
            override: 'OVERRIDE',
            override_callsign: 'OVERRIDE_CALLSIGN',
            override_point: 'OVERRIDE_POINT',
            override_point_callsign: 'OVERRIDE_POINT_CALLSIGN',
            override_query: 'OVERRIDE_QUERY',
            override_query_callsign: 'OVERRIDE_QUERY_CALLSIGN',
            override_query_point: 'OVERRIDE_QUERY_POINT',
            override_query_point_callsign: 'OVERRIDE_QUERY_POINT_CALLSIGN'
        }
    });
});

test('Style: Lowest Level Remarks', async () => {
    const style = new Style({
        stale: 123,
        enabled_styles: true,
        styles: {
            queries: [{
                query: 'true',
                styles: {
                    point: {
                        remarks: '{{override_query_point}}',
                        callsign: '{{override_query_point_callsign}}',
                    }
                }
            }]
        }
    });

    assert.deepEqual((await style.feat({
        type: 'Feature',
        properties: {
            metadata: {
                override_query_point: 'LOWEST_REMARKS',
                override_query_point_callsign: 'LOWEST_CALLSIGN'
            }
        },
        geometry: {
            type: 'Point',
            coordinates: [0, 0]
        }
    })).properties, {
        stale: 123,
        remarks: 'LOWEST_REMARKS',
        callsign: 'LOWEST_CALLSIGN',
        metadata: {
            override_query_point: 'LOWEST_REMARKS',
            override_query_point_callsign: 'LOWEST_CALLSIGN'
        }
    });
});
