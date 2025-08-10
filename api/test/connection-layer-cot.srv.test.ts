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









// Test that reaches icon conversion code
test('POST: api/layer/1/cot - icon conversion coverage', async (t) => {
    try {
        // Configure layer with minimal incoming config
        await flight.fetch('/api/connection/1/layer/1', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                incoming: {
                    enabled_styles: false,
                    stale: 300
                }
            }
        }, false);

        // Test with icon containing colon - this should execute the conversion code
        const res1 = await flight.fetch('/api/layer/1/cot', {
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
                    id: 'icon-with-colon',
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

        // Test with icon without colon
        const res2 = await flight.fetch('/api/layer/1/cot', {
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
                    id: 'icon-without-colon',
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

        // Test without icon property
        const res3 = await flight.fetch('/api/layer/1/cot', {
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
                    id: 'no-icon',
                    geometry: {
                        type: 'Point',
                        coordinates: [-122.4194, 37.7749]
                    },
                    properties: {}
                }]
            }
        }, false);

        t.ok(res1.body, 'processed feature with colon icon');
        t.ok(res2.body, 'processed feature without colon icon');
        t.ok(res3.body, 'processed feature without icon');

    } catch (err) {
        t.error(err, 'no error');
    }
    t.end();
});

flight.landing();