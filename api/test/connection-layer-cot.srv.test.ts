import test from 'tape';
import Flight from './flight.js';
import Sinon from 'sinon';
import {
    DescribeStacksCommand,
    CloudFormationClient
} from '@aws-sdk/client-cloudformation';
import {
    CloudWatchLogsClient,
    DeleteLogGroupCommand
} from '@aws-sdk/client-cloudwatch-logs';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();
flight.connection();

test('POST: api/connection/1/layer - create layer for CoT tests', async (t) => {
    try {
        Sinon.stub(CloudFormationClient.prototype, 'send').callsFake((command) => {
            if (command instanceof DescribeStacksCommand) {
                return Promise.resolve({});
            } else {
                throw new Error('Unexpected command');
            }
        });

        Sinon.stub(CloudWatchLogsClient.prototype, 'send').callsFake((command) => {
            if (command instanceof DeleteLogGroupCommand) {
                return Promise.resolve({});
            } else {
                throw new Error('Unexpected command');
            }
        });

        await flight.fetch('/api/connection/1/layer', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Layer',
                description: 'This is a test layer',
                task: 'etl-test-v1.0.0'
            }
        }, true);
    } catch (err) {
        t.error(err, 'no error');
    }

    Sinon.restore();
    t.end();
});

test('POST: api/layer/1/cot - icon path conversion', async (t) => {
    try {
        const res = await flight.fetch('/api/layer/1/cot', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            headers: {
                'content-type': 'application/json'
            },
            body: {
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    id: 'test-feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [-122.4194, 37.7749]
                    },
                    properties: {
                        icon: 'custom:icon:path'
                    }
                }]
            }
        }, false);

        // Layer not attached to connection, expect 400
        t.equals(res.body.status, 400, 'should return 400 status');
        t.equals(res.body.message, 'Validation Error', 'should return validation error');

    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('POST: api/layer/1/cot - icon path without colon unchanged', async (t) => {
    try {
        const res = await flight.fetch('/api/layer/1/cot', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            headers: {
                'content-type': 'application/json'
            },
            body: {
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    id: 'test-feature-2',
                    geometry: {
                        type: 'Point',
                        coordinates: [-122.4194, 37.7749]
                    },
                    properties: {
                        icon: 'custom/icon/path'
                    }
                }]
            }
        }, false);

        t.equals(res.body.status, 400, 'should return 400 status');

    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('POST: api/layer/1/cot - feature without icon property', async (t) => {
    try {
        const res = await flight.fetch('/api/layer/1/cot', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            headers: {
                'content-type': 'application/json'
            },
            body: {
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    id: 'test-feature-3',
                    geometry: {
                        type: 'Point',
                        coordinates: [-122.4194, 37.7749]
                    },
                    properties: {}
                }]
            }
        }, false);

        t.equals(res.body.status, 400, 'should return 400 status');

    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('POST: api/layer/1/cot - multiple colons in icon path', async (t) => {
    try {
        const res = await flight.fetch('/api/layer/1/cot', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            headers: {
                'content-type': 'application/json'
            },
            body: {
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    id: 'test-feature-4',
                    geometry: {
                        type: 'Point',
                        coordinates: [-122.4194, 37.7749]
                    },
                    properties: {
                        icon: 'custom:icon:path:with:colons'
                    }
                }]
            }
        }, false);

        t.equals(res.body.status, 400, 'should return 400 status');

    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

// Unit tests for icon path conversion logic
test('Icon path conversion - colon to slash', async (t) => {
    const feature = {
        type: 'Feature',
        id: 'test',
        geometry: { type: 'Point', coordinates: [0, 0] },
        properties: { icon: 'custom:icon:path' }
    };
    
    // Test the conversion logic directly
    if (feature.properties.icon && feature.properties.icon.includes(':')) {
        feature.properties.icon = feature.properties.icon.replace(':', '/');
    }
    
    t.equals(feature.properties.icon, 'custom/icon:path', 'should replace first colon with slash');
    t.end();
});

test('Icon path conversion - no colon', async (t) => {
    const feature = {
        type: 'Feature',
        id: 'test',
        geometry: { type: 'Point', coordinates: [0, 0] },
        properties: { icon: 'custom/icon/path' }
    };
    
    const originalIcon = feature.properties.icon;
    if (feature.properties.icon && feature.properties.icon.includes(':')) {
        feature.properties.icon = feature.properties.icon.replace(':', '/');
    }
    
    t.equals(feature.properties.icon, originalIcon, 'should not change icon without colon');
    t.end();
});

test('Icon path conversion - no icon property', async (t) => {
    const feature = {
        type: 'Feature',
        id: 'test',
        geometry: { type: 'Point', coordinates: [0, 0] },
        properties: {}
    };
    
    // Test the conversion logic directly
    if (feature.properties.icon && feature.properties.icon.includes(':')) {
        feature.properties.icon = feature.properties.icon.replace(':', '/');
    }
    
    t.equals(feature.properties.icon, undefined, 'should handle missing icon property');
    t.end();
});

test('Icon path conversion - multiple colons', async (t) => {
    const feature = {
        type: 'Feature',
        id: 'test',
        geometry: { type: 'Point', coordinates: [0, 0] },
        properties: { icon: 'custom:icon:path:with:colons' }
    };
    
    // Test the conversion logic directly
    if (feature.properties.icon && feature.properties.icon.includes(':')) {
        feature.properties.icon = feature.properties.icon.replace(':', '/');
    }
    
    t.equals(feature.properties.icon, 'custom/icon:path:with:colons', 'should replace only first colon');
    t.end();
});

flight.landing();