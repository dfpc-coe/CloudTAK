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









// Test icon conversion with colon
test('POST: api/layer/1/cot - icon conversion with colon', async (t) => {
    try {
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

        await flight.fetch('/api/layer/1/cot', {
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
                    id: 'test-colon-icon',
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

        t.pass('icon conversion with colon executed');
    } catch (err) {
        t.error(err, 'no error');
    }
    t.end();
});

// Test icon conversion without colon
test('POST: api/layer/1/cot - icon conversion without colon', async (t) => {
    try {
        await flight.fetch('/api/layer/1/cot', {
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
                    id: 'test-no-colon-icon',
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

        t.pass('icon conversion without colon executed');
    } catch (err) {
        t.error(err, 'no error');
    }
    t.end();
});

// Test no icon property
test('POST: api/layer/1/cot - no icon property', async (t) => {
    try {
        await flight.fetch('/api/layer/1/cot', {
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
                    id: 'test-no-icon',
                    geometry: {
                        type: 'Point',
                        coordinates: [-122.4194, 37.7749]
                    },
                    properties: {}
                }]
            }
        }, false);

        t.pass('no icon property executed');
    } catch (err) {
        t.error(err, 'no error');
    }
    t.end();
});

flight.landing();