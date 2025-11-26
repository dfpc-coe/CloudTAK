import test from 'tape';
import Flight from './flight.js';
import Sinon from 'sinon';
import {
    S3Client
} from '@aws-sdk/client-s3';
import { FormData } from 'undici';
import { Readable } from 'node:stream';
import S3 from '../lib/aws/s3.js';
import { DataPackage } from '@tak-ps/node-cot';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

const time = new Date('2025-03-04T22:54:15.447Z').toISOString()

test('GET: api/attachments - no result', async (t) => {
    try {
        Sinon.stub(S3Client.prototype, 'send').callsFake((command) => {
            t.deepEquals(command.input, {
                Bucket: 'fake-asset-bucket',
                Prefix: 'attachment/123/'
            });
            return Promise.resolve({
                Contents: []
            });
        });

        const res = await flight.fetch('/api/attachment?hash=123', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body, {
            total: 0,
            items: []
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    Sinon.restore();
    t.end();
});

test('GET: api/attachments - result', async (t) => {
    try {
        Sinon.stub(S3Client.prototype, 'send').callsFake((command) => {
            t.deepEquals(command.input, {
                Bucket: 'fake-asset-bucket',
                Prefix: 'attachment/123/'
            });
            return Promise.resolve({
                Contents: [{
                    Key: 'attachment/123/image.png',
                    Size: 123456,
                    LastModified: new Date(time),
                    ETag: '"123"'
                }]
            });
        });

        const res = await flight.fetch('/api/attachment?hash=123', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body, {
            total: 1,
            items: [{
                hash: '123',
                ext: '.png',
                name: 'image.png',
                size: 123456,
                created: '2025-03-04T22:54:15.447Z'
            }]
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    Sinon.restore();
    t.end();
});


test('PUT: api/attachment - success', async (t) => {
    try {
        const s3Stub = Sinon.stub(S3, 'put').resolves();
        const hashStub = Sinon.stub(DataPackage, 'hash').resolves('hash-123');

        const body = new FormData();
        body.append('file', new Blob(['file-content'], {
            type: 'text/plain'
        }), 'image.png');

        const res = await flight.fetch('/api/attachment', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin
            },
            body
        }, true);

        t.deepEquals(res.body, { hash: 'hash-123' });
        t.ok(s3Stub.calledOnce);
        t.ok(hashStub.calledOnce);
        t.equals(s3Stub.firstCall.args[0], 'attachment/hash-123/image.png');
    } catch (err) {
        t.error(err, 'no error');
    }

    Sinon.restore();
    t.end();
});

test('PUT: api/attachment - unsupported content type', async (t) => {
    try {
        const res = await flight.fetch('/api/attachment', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                foo: 'bar'
            }
        }, false);

        t.equals(res.status, 400);
        t.equals(res.body.message, 'Unsupported Content-Type');
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET: api/attachment/:hash - stream', async (t) => {
    try {
        Sinon.stub(S3Client.prototype, 'send').callsFake((command) => {
            if (command.constructor.name === 'ListObjectsV2Command') {
                t.deepEquals(command.input, {
                    Bucket: 'fake-asset-bucket',
                    Prefix: 'attachment/stream-hash/'
                });
                return Promise.resolve({
                    Contents: [{
                        Key: 'attachment/stream-hash/data.txt'
                    }]
                });
            } else if (command.constructor.name === 'GetObjectCommand') {
                t.deepEquals(command.input, {
                    Bucket: 'fake-asset-bucket',
                    Key: 'attachment/stream-hash/data.txt'
                });
                return Promise.resolve({
                    Body: Readable.from(['file-body'])
                });
            }

            throw new Error('Unexpected command');
        });

        const res = await flight.fetch('/api/attachment/stream-hash', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, {
            json: false
        });

        t.equals(res.status, 200);
        t.equals(res.body, 'file-body');
    } catch (err) {
        t.error(err, 'no error');
    }

    Sinon.restore();
    t.end();
});

test('GET: api/attachment/:hash - missing', async (t) => {
    try {
        Sinon.stub(S3Client.prototype, 'send').callsFake((command) => {
            if (command.constructor.name === 'ListObjectsV2Command') {
                return Promise.resolve({
                    Contents: []
                });
            }

            throw new Error('Unexpected command');
        });

        const res = await flight.fetch('/api/attachment/missing', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, false);

        t.equals(res.status, 404);
        t.equals(res.body.message, 'Attachment not found');
    } catch (err) {
        t.error(err, 'no error');
    }

    Sinon.restore();
    t.end();
});

flight.landing();
