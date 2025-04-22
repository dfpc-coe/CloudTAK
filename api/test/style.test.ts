import test from 'node:test';
import assert from 'node:assert';
import Style from '../lib/style.js';

test('Style: Basic Point', async () => {
    const style = new Style({
        stale: 123,
        enabled_styles: true,
        styles: {
            point: {
                'marker-color': '#ffffff',
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
            'marker-color': '#ffffff',
            remarks: 'Test Remarks',
            metadata: {},
            stale: 123000
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
                'marker-color': '#ffffff',
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
            stale: 123000
        },
        geometry: {
            type: 'Point',
            coordinates: [0, 0]
        }
    });
});

test('Style: Basic Callsign', async () => {
    const style = new Style({
        stale: 123,
        enabled_styles: true,
        styles: {
            point: {
                'marker-color': '#ffffff',
                remarks: 'Test Remarks'
            }
        }
    });

    assert.deepEqual(await style.feat({
        type: 'Feature',
        properties: {
            callsign: 'CallSign Test'
        },
        geometry: {
            type: 'Point',
            coordinates: [0, 0]
        }
    }), {
        type: 'Feature',
        properties: {
            callsign: 'CallSign Test',
            'marker-color': '#ffffff',
            remarks: 'Test Remarks',
            metadata: {},
            stale: 123000
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
                'marker-color': '#ffffff',
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

    const feat = await style.feat({
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
    });

    if (!feat) assert.fail('Feature marked as null');

    assert.deepEqual(feat.properties, {
        stale: 123000,
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

    const feat = await style.feat({
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
    });

    if (!feat) assert.fail('Feature marked as null');

    assert.deepEqual(feat.properties, {
        stale: 123000,
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

    const feat = await style.feat({
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
    });

    if (!feat) assert.fail('Feature marked as null');

    assert.deepEqual(feat.properties, {
        stale: 123000,
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

    const feat = await style.feat({
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
    });

    if (!feat) assert.fail('Feature marked as null');

    assert.deepEqual(feat.properties, {
        stale: 123000,
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

    const feat = await style.feat({
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
    });

    if (!feat) assert.fail('Feature marked as null');

    assert.deepEqual(feat.properties, {
        stale: 123000,
        remarks: 'LOWEST_REMARKS',
        callsign: 'LOWEST_CALLSIGN',
        metadata: {
            override_query_point: 'LOWEST_REMARKS',
            override_query_point_callsign: 'LOWEST_CALLSIGN'
        }
    });
});

test('Style: Invalid Templates', async () => {
    assert.throws(() => {
        Style.validate({
            remarks: '{{{test}'
        })
    }, /Expecting/);

    assert.throws(() => {
        Style.validate({
            callsign: '{{{test}'
        })
    }, /Expecting/);

    assert.throws(() => {
        Style.validate({
            links: [{
                remarks: 'TEST',
                url: '{{{test}'
            }]
        })
    }, /Expecting/);

    assert.throws(() => {
        Style.validate({
            links: [{
                url: 'TEST',
                remarks: '{{{test}'
            }]
        })
    }, /Expecting/);

    assert.throws(() => {
        Style.validate({
            point: {
                remarks: '{{{test}'
            }
        })
    }, /Expecting/);

    assert.throws(() => {
        Style.validate({
            point: {
                callsign: '{{{test}'
            }
        })
    }, /Expecting/);

    assert.throws(() => {
        Style.validate({
            line: {
                remarks: '{{{test}'
            }
        })
    }, /Expecting/);

    assert.throws(() => {
        Style.validate({
            line: {
                callsign: '{{{test}'
            }
        })
    }, /Expecting/);

    assert.throws(() => {
        Style.validate({
            polygon: {
                remarks: '{{{test}'
            }
        })
    }, /Expecting/);

    assert.throws(() => {
        Style.validate({
            polygon: {
                callsign: '{{{test}'
            }
        })
    }, /Expecting/);

    assert.throws(() => {
        Style.validate({
            polygon: {
                links: [{
                    url: 'TEST',
                    remarks: '{{{test}'
                }]
            }
        })
    }, /Expecting/);

    assert.throws(() => {
        Style.validate({
            polygon: {
                links: [{
                    remarks: 'TEST',
                    url: '{{{test}'
                }]
            }
        })
    }, /Expecting/);

    assert.throws(() => {
        Style.validate({
            point: {
                links: [{
                    url: 'TEST',
                    remarks: '{{{test}'
                }]
            }
        })
    }, /Expecting/);

    assert.throws(() => {
        Style.validate({
            point: {
                links: [{
                    remarks: 'TEST',
                    url: '{{{test}'
                }]
            }
        })
    }, /Expecting/);

    assert.throws(() => {
        Style.validate({
            line: {
                links: [{
                    url: 'TEST',
                    remarks: '{{{test}'
                }]
            }
        })
    }, /Expecting/);

    assert.throws(() => {
        Style.validate({
            line: {
                links: [{
                    remarks: 'TEST',
                    url: '{{{test}'
                }]
            }
        })
    }, /Expecting/);

    // Query Templates

    assert.throws(() => {
        Style.validate({
            queries: [{
                query: '1 = 1',
                styles: {
                    remarks: '{{{test}'
                }
            }]
        })
    }, /Expecting/);

    assert.throws(() => {
        Style.validate({
            queries: [{
                query: '1 = 1',
                styles: {
                    callsign: '{{{test}'
                }
            }]
        })
    }, /Expecting/);

    assert.throws(() => {
        Style.validate({
            queries: [{
                query: '1 = 1',
                styles: {
                    links: [{
                        remarks: 'TEST',
                        url: '{{{test}'
                    }]
                }
            }]
        })
    }, /Expecting/);

    assert.throws(() => {
        Style.validate({
            queries: [{
                query: '1 = 1',
                styles: {
                    links: [{
                        url: 'TEST',
                        remarks: '{{{test}'
                    }]
                }
            }]
        })
    }, /Expecting/);

    assert.throws(() => {
        Style.validate({
            queries: [{
                query: '1 = 1',
                styles: {
                    point: {
                        remarks: '{{{test}'
                    }
                }
            }]
        })
    }, /Expecting/);

    assert.throws(() => {
        Style.validate({
            queries: [{
                query: '1 = 1',
                styles: {
                    point: {
                        callsign: '{{{test}'
                    }
                }
            }]
        })
    }, /Expecting/);

    assert.throws(() => {
        Style.validate({
            queries: [{
                query: '1 = 1',
                styles: {
                    line: {
                        remarks: '{{{test}'
                    }
                }
            }]
        })
    }, /Expecting/);

    assert.throws(() => {
        Style.validate({
            queries: [{
                query: '1 = 1',
                styles: {
                    line: {
                        callsign: '{{{test}'
                    }
                }
            }]
        })
    }, /Expecting/);

    assert.throws(() => {
        Style.validate({
            queries: [{
                query: '1 = 1',
                styles: {
                    polygon: {
                        remarks: '{{{test}'
                    }
                }
            }]
        })
    }, /Expecting/);

    assert.throws(() => {
        Style.validate({
            queries: [{
                query: '1 = 1',
                styles: {
                    polygon: {
                        callsign: '{{{test}'
                    }
                }
            }]
        })
    }, /Expecting/);

    assert.throws(() => {
        Style.validate({
            queries: [{
                query: '1 = 1',
                styles: {
                    polygon: {
                        links: [{
                            url: 'TEST',
                            remarks: '{{{test}'
                        }]
                    }
                }
            }]
        })
    }, /Expecting/);

    assert.throws(() => {
        Style.validate({
            queries: [{
                query: '1 = 1',
                styles: {
                    polygon: {
                        links: [{
                            remarks: 'TEST',
                            url: '{{{test}'
                        }]
                    }
                }
            }]
        })
    }, /Expecting/);

    assert.throws(() => {
        Style.validate({
            queries: [{
                query: '1 = 1',
                styles: {
                    point: {
                        links: [{
                            url: 'TEST',
                            remarks: '{{{test}'
                        }]
                    }
                }
            }]
        })
    }, /Expecting/);

    assert.throws(() => {
        Style.validate({
            queries: [{
                query: '1 = 1',
                styles: {
                    point: {
                        links: [{
                            remarks: 'TEST',
                            url: '{{{test}'
                        }]
                    }
                }
            }]
        })
    }, /Expecting/);

    assert.throws(() => {
        Style.validate({
            queries: [{
                query: '1 = 1',
                styles: {
                    line: {
                        links: [{
                            url: 'TEST',
                            remarks: '{{{test}'
                        }]
                    }
                }
            }]
        })
    }, /Expecting/);

    assert.throws(() => {
        Style.validate({
            queries: [{
                query: '1 = 1',
                styles: {
                    line: {
                        links: [{
                            remarks: 'TEST',
                            url: '{{{test}'
                        }]
                    }
                }
            }]
        })
    }, /Expecting/);
});

test('Style: {{fallback p1 p2 ...}}', async () => {
    const style = new Style({
        stale: 123,
        enabled_styles: true,
        styles: {
            callsign: '{{fallback none1 none2 yes1 none3 yes2}}'
        }
    });

    assert.deepEqual(await style.feat({
        type: 'Feature',
        properties: {
            metadata: {
                yes1: 'I exist',
                yes2: 'I exist but shouldn\'t be picked'
            }
        },
        geometry: {
            type: 'Point',
            coordinates: [0, 0]
        }
    }), {
        type: 'Feature',
        properties: {
            callsign: 'I exist',
            metadata: {
                yes1: 'I exist',
                yes2: "I exist but shouldn't be picked"
            },
            stale: 123000
        },
        geometry: {
            coordinates: [
                0,
                0
            ],
            type: 'Point'
        },
    });
});

test.skip('Style: Delete Feature by Style', async () => {
    const style = new Style({
        stale: 123,
        enabled_styles: true,
        styles: {
            queries: [{
                query: 'properties.metadata.delete = true',
                delete: true
            }]
        }
    });

    const feat = await style.feat({
        type: 'Feature',
        properties: {
            metadata: {
                delete: true
            }
        },
        geometry: {
            type: 'Point',
            coordinates: [0, 0]
        }
    });

    assert.equals(feat, null);
});
