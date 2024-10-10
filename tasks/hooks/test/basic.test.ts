import test from 'tape';
import { handler as hook } from '../src/index.js';
import Sinon from 'sinon';
import CW from '@aws-sdk/client-cloudwatch';
import { MockAgent, setGlobalDispatcher } from 'undici';

process.env.StackName = 'test';

test('Basic Feature - Unknown Type', async (t) => {
    let called = false;
    Sinon.stub(CW.CloudWatchClient.prototype, 'send').callsFake((command: any) => {
        called = true;

        t.deepEquals(command.input.Namespace, 'TAKETL');
        t.deepEquals(command.input.MetricData.length, 1);
        t.deepEquals(command.input.MetricData[0].MetricName, 'ConnectionSinkFailure');
        return Promise.resolve({});
    });

    try {
        await hook({
            Records: [{
                messageId: '123',
                receiptHandle: '123',
                attributes: {
                    ApproximateReceiveCount: '1',
                    SentTimestamp: String(new Date()),
                    SenderId: '123',
                    ApproximateFirstReceiveTimestamp: String(new Date())
                },
                messageAttributes: {},
                md5OfBody: '123',
                eventSource: 'source',
                eventSourceARN: 'arn:fake',
                awsRegion: 'us-east-1',
                body: JSON.stringify({
                    type: 'Unknown',
                    options: {
                        logging: true
                    }
                })
            }]
        })
    } catch (err) {
        t.error(err);
    }

    t.ok(called, 'CloudWatch Metrics Must be called');
    Sinon.restore();
    t.end();
})

test('Basic Point Feature', async (t) => {
    let called = false;
    Sinon.stub(CW.CloudWatchClient.prototype, 'send').callsFake((command: any) => {
        called = true;
        return Promise.resolve({});
    });

    const mockAgent = new MockAgent();
    setGlobalDispatcher(mockAgent);

    const mockPool = mockAgent.get(/.*/);
    mockPool.intercept({
        path: /.*\/query/,
        method: 'POST'
    }).reply(200, {
        features: []
    });
    mockPool.intercept({
        path: /.*\/addFeatures/,
        method: 'POST'
    }).reply(200, {
        addResults: []
    });

    try {
        await hook({
            Records: [{
                messageId: '123',
                receiptHandle: '123',
                attributes: {
                    ApproximateReceiveCount: '1',
                    SentTimestamp: String(new Date()),
                    SenderId: '123',
                    ApproximateFirstReceiveTimestamp: String(new Date())
                },
                messageAttributes: {},
                md5OfBody: '123',
                eventSource: 'source',
                eventSourceARN: 'arn:fake',
                awsRegion: 'us-east-1',
                body: JSON.stringify({
                    type: 'ArcGIS',
                    body: {
                        points: 'http://example.org/server/rest/services/Hosted/TAK_ETL_Service/FeatureServer/0'
                    },
                    secrets: {
                        referer: 'http://example.org',
                        token: 'fake-token'
                    },
                    options: {
                        logging: true
                    },
                    feat: {
                        id: 'base-uid',
                        type: 'Feature',
                        properties: {
                            callsign: 'Ingalls Test CoT',
                            type: 'a-f-G-E-V-C',
                            how: 'm-g',
                            time: String(new Date()),
                            start: String(new Date()),
                            stale: String(new Date())
                        },
                        geometry: {
                            type: 'Point',
                            coordinates: [
                                -108.63009398166237,
                                38.99509004827766
                            ]
                        }
                    }
                })
            }]
        })
    } catch (err) {
        t.error(err);
    }


    mockAgent.assertNoPendingInterceptors()
    t.ok(!called, 'CloudWatch Metrics Must NOT be called (Only called for errors)');
    Sinon.restore();
    t.end();
})

test('Basic LineString Feature', async (t) => {
    let called = false;
    Sinon.stub(CW.CloudWatchClient.prototype, 'send').callsFake((command: any) => {
        called = true;
        return Promise.resolve({});
    });

    const mockAgent = new MockAgent();
    setGlobalDispatcher(mockAgent);

    const mockPool = mockAgent.get(/.*/);
    mockPool.intercept({
        path: /.*\/query/,
        method: 'POST'
    }).reply(200, {
        features: []
    });
    mockPool.intercept({
        path: /.*\/addFeatures/,
        method: 'POST'
    }).reply(200, {
        addResults: []
    });

    try {
        await hook({
            Records: [{
                messageId: '123',
                receiptHandle: '123',
                attributes: {
                    ApproximateReceiveCount: '1',
                    SentTimestamp: String(new Date()),
                    SenderId: '123',
                    ApproximateFirstReceiveTimestamp: String(new Date())
                },
                messageAttributes: {},
                md5OfBody: '123',
                eventSource: 'source',
                eventSourceARN: 'arn:fake',
                awsRegion: 'us-east-1',
                body: JSON.stringify({
                    type: 'ArcGIS',
                    body: {
                        lines: 'http://example.org/server/rest/services/Hosted/TAK_ETL_Service/FeatureServer/0'
                    },
                    secrets: {
                        referer: 'http://example.org',
                        token: 'fake-token'
                    },
                    options: {
                        logging: true
                    },
                    feat: {
                        id: 'base-uid',
                        type: 'Feature',
                        properties: {
                            callsign: 'Ingalls Test CoT',
                            type: 'a-f-G-E-V-C',
                            how: 'm-g',
                            time: String(new Date()),
                            start: String(new Date()),
                            stale: String(new Date())
                        },
                        geometry: {
                            type: 'LineString',
                            coordinates: [
                                [
                                    -108.51522746231032,
                                    39.07204820477631
                                ],
                                [
                                    -108.51522746231032,
                                    39.03004491685587
                                ]
                            ],
                        }
                    }
                })
            }]
        })
    } catch (err) {
        t.error(err);
    }

    mockAgent.assertNoPendingInterceptors()
    t.ok(!called, 'CloudWatch Metrics Must NOT be called (Only called for errors)');
    Sinon.restore();
    t.end();
})

test('Basic Polygon Feature', async (t) => {
    let called = false;
    Sinon.stub(CW.CloudWatchClient.prototype, 'send').callsFake((command: any) => {
        called = true;
        return Promise.resolve({});
    });

    const mockAgent = new MockAgent();
    setGlobalDispatcher(mockAgent);

    const mockPool = mockAgent.get(/.*/);
    mockPool.intercept({
        path: /.*\/query/,
        method: 'POST'
    }).reply(200, {
        features: []
    });
    mockPool.intercept({
        path: /.*\/addFeatures/,
        method: 'POST'
    }).reply(200, {
        addResults: []
    });

    try {
        await hook({
            Records: [{
                messageId: '123',
                receiptHandle: '123',
                attributes: {
                    ApproximateReceiveCount: '1',
                    SentTimestamp: String(new Date()),
                    SenderId: '123',
                    ApproximateFirstReceiveTimestamp: String(new Date())
                },
                messageAttributes: {},
                md5OfBody: '123',
                eventSource: 'source',
                eventSourceARN: 'arn:fake',
                awsRegion: 'us-east-1',
                body: JSON.stringify({
                    type: 'ArcGIS',
                    body: {
                        polys: 'http://example.org/server/rest/services/Hosted/TAK_ETL_Service/FeatureServer/0'
                    },
                    secrets: {
                        referer: 'http://example.org',
                        token: 'fake-token'
                    },
                    options: {
                        logging: true
                    },
                    feat: {
                        id: 'base-uid',
                        type: 'Feature',
                        properties: {
                            callsign: 'Ingalls Test CoT',
                            type: 'a-f-G-E-V-C',
                            how: 'm-g',
                            time: String(new Date()),
                            start: String(new Date()),
                            stale: String(new Date())
                        },
                        geometry: {
                            type: "Polygon",
                            coordinates: [[
                                [ -108.52473775262523, 39.048384616259 ],
                                [ -108.52473775262523, 39.04113840451393 ],
                                [ -108.51527442875087, 39.04113840451393 ],
                                [ -108.51527442875087, 39.048384616259 ],
                                [ -108.52473775262523, 39.048384616259 ]
                            ]]
                        }
                    }
                })
            }]
        })
    } catch (err) {
        t.error(err);
    }

    mockAgent.assertNoPendingInterceptors()
    t.ok(!called, 'CloudWatch Metrics Must NOT be called (Only called for errors)');
    Sinon.restore();
    t.end();
})
