import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import jwt from 'jsonwebtoken';
import Sinon from 'sinon';
import {
    S3Client,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import S3 from '../common/aws/s3.js';
import { DataPackage } from '@tak-ps/node-cot';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.integration('test-task');
flight.connection();

const time = new Date('2025-03-04T22:54:15.447Z').toISOString();

test('GET: api/attachments - no result', async () => {
    try {
        Sinon.stub(S3Client.prototype, 'send').callsFake((command) => {
            assert.deepEqual(command.input, {
                Bucket: 'fake-asset-bucket',
                Prefix: 'attachment/123/',
            });
            return Promise.resolve({
                Contents: [],
            });
        });

        const res = await flight.fetch('/api/attachment?hash=123', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            total: 0,
            items: [],
        });
    } catch (err) {
        assert.ifError(err);
    }

    Sinon.restore();
});

test('GET: api/attachments - result', async () => {
    try {
        Sinon.stub(S3Client.prototype, 'send').callsFake((command) => {
            assert.deepEqual(command.input, {
                Bucket: 'fake-asset-bucket',
                Prefix: 'attachment/123/',
            });
            return Promise.resolve({
                Contents: [{
                    Key: 'attachment/123/image.png',
                    Size: 123456,
                    LastModified: new Date(time),
                    ETag: '"123"',
                }],
            });
        });

        const res = await flight.fetch('/api/attachment?hash=123', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            total: 1,
            items: [{
                hash: '123',
                ext: '.png',
                name: 'image.png',
                size: 123456,
                created: '2025-03-04T22:54:15.447Z',
            }],
        });
    } catch (err) {
        assert.ifError(err);
    }

    Sinon.restore();
});

test('PUT: api/attachment - success', async () => {
    try {
        const s3Stub = Sinon.stub(S3, 'put').resolves();
        const hashStub = Sinon.stub(DataPackage, 'hash').resolves('hash-123');

        const body = new FormData();
        body.append('file', new Blob(['file-content'], {
            type: 'text/plain',
        }), 'image.png');

        const res = await flight.fetch('/api/attachment', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body,
        }, true);

        assert.deepEqual(res.body, { hash: 'hash-123' });
        assert.ok(s3Stub.calledOnce);
        assert.ok(hashStub.calledOnce);
        assert.equal(s3Stub.firstCall.args[0], 'attachment/hash-123/image.png');
    } catch (err) {
        assert.ifError(err);
    }

    Sinon.restore();
});

test('PUT: api/attachment - unsupported content type', async () => {
    try {
        const res = await flight.fetch('/api/attachment', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                foo: 'bar',
            },
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Unsupported Content-Type');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/attachment/:hash - stream', async () => {
    try {
        Sinon.stub(S3Client.prototype, 'send').callsFake((command) => {
            if (command.constructor.name === 'ListObjectsV2Command') {
                assert.deepEqual(command.input, {
                    Bucket: 'fake-asset-bucket',
                    Prefix: 'attachment/stream-hash/',
                });
                return Promise.resolve({
                    Contents: [{
                        Key: 'attachment/stream-hash/data.txt',
                    }],
                });
            } else if (command.constructor.name === 'GetObjectCommand') {
                assert.deepEqual(command.input, {
                    Bucket: 'fake-asset-bucket',
                    Key: 'attachment/stream-hash/data.txt',
                });
                return Promise.resolve({
                    Body: Readable.from(['file-body']),
                });
            }

            throw new Error('Unexpected command');
        });

        const res = await flight.fetch('/api/attachment/stream-hash', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, {
            json: false,
        });

        assert.equal(res.status, 200);
        assert.equal(res.body, 'file-body');
    } catch (err) {
        assert.ifError(err);
    }

    Sinon.restore();
});

test('GET: api/attachment/:hash - missing', async () => {
    try {
        Sinon.stub(S3Client.prototype, 'send').callsFake((command) => {
            if (command.constructor.name === 'ListObjectsV2Command') {
                return Promise.resolve({
                    Contents: [],
                });
            }

            throw new Error('Unexpected command');
        });

        const res = await flight.fetch('/api/attachment/missing', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, false);

        assert.equal(res.status, 404);
        assert.equal(res.body.message, 'Attachment not found');
    } catch (err) {
        assert.ifError(err);
    }

    Sinon.restore();
});

test('Layer token: api/attachment - attachment:read only', async () => {
    try {
        await flight.config!.models.Layer.generate({
            name: 'Attachment Layer',
            task: 1,
            version: '1.0.0',
            connection: 1,
            permissions: ['attachment:read'],
        });

        const layerToken = 'etl.' + jwt.sign({ access: 'layer', id: 1, internal: true }, 'coe-wildland-fire');

        Sinon.stub(S3Client.prototype, 'send').callsFake((command) => {
            if (command.constructor.name === 'ListObjectsV2Command') {
                return Promise.resolve({
                    Contents: [{
                        Key: 'attachment/layer-hash/data.txt',
                        Size: 9,
                        LastModified: new Date(time),
                    }],
                });
            } else if (command.constructor.name === 'GetObjectCommand') {
                return Promise.resolve({
                    Body: Readable.from(['file-body']),
                });
            }

            throw new Error('Unexpected command');
        });

        const list = await flight.fetch('/api/attachment?hash=layer-hash', {
            method: 'GET',
            auth: { bearer: layerToken },
        }, true);

        assert.deepEqual(list.body, {
            total: 1,
            items: [{
                hash: 'layer-hash',
                ext: '.txt',
                name: 'data.txt',
                size: 9,
                created: time,
            }],
        });

        const get = await flight.fetch('/api/attachment/layer-hash', {
            method: 'GET',
            auth: { bearer: layerToken },
        }, {
            json: false,
        });

        assert.equal(get.status, 200);
        assert.equal(get.body, 'file-body');

        const body = new FormData();
        body.append('file', new Blob(['file-content'], { type: 'text/plain' }), 'image.png');

        const upload = await flight.fetch('/api/attachment', {
            method: 'PUT',
            auth: { bearer: layerToken },
            body,
        }, false);

        assert.equal(upload.status, 403);
        assert.equal(upload.body.message, 'Layer token does not have the attachment:create permission');
    } catch (err) {
        assert.ifError(err);
    }

    Sinon.restore();
});

test('Layer token: api/attachment - attachment:create', async () => {
    try {
        await flight.config!.models.Layer.commit(1, { permissions: ['attachment:*'] });

        const layerToken = 'etl.' + jwt.sign({ access: 'layer', id: 1, internal: true }, 'coe-wildland-fire');

        const s3Stub = Sinon.stub(S3, 'put').resolves();
        Sinon.stub(DataPackage, 'hash').resolves('hash-layer');

        const body = new FormData();
        body.append('file', new Blob(['file-content'], { type: 'text/plain' }), 'image.png');

        const upload = await flight.fetch('/api/attachment', {
            method: 'PUT',
            auth: { bearer: layerToken },
            body,
        }, true);

        assert.deepEqual(upload.body, { hash: 'hash-layer' });
        assert.equal(s3Stub.firstCall.args[0], 'attachment/hash-layer/image.png');

        const missionBody = new FormData();
        missionBody.append('file', new Blob(['file-content'], { type: 'text/plain' }), 'image.png');

        const mission = await flight.fetch('/api/attachment?mission=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', {
            method: 'PUT',
            auth: { bearer: layerToken },
            body: missionBody,
        }, false);

        assert.equal(mission.status, 401);
        assert.equal(mission.body.message, 'Only an authenticated user can upload an attachment to a mission');
    } catch (err) {
        assert.ifError(err);
    }

    Sinon.restore();
});

test('Connection token: api/attachment - scoped', async () => {
    try {
        const unscoped = await flight.fetch('/api/connection/1/token', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: { name: 'Unscoped Token' },
        }, true);

        Sinon.stub(S3Client.prototype, 'send').callsFake(() => {
            return Promise.resolve({ Contents: [] });
        });

        const denied = await flight.fetch('/api/attachment?hash=123', {
            method: 'GET',
            auth: { bearer: unscoped.body.token },
        }, false);

        assert.equal(denied.status, 403);
        assert.equal(denied.body.message, 'Connection token does not have the attachment:read permission');

        // Connection JWTs carry no unique claim so two minted in the same second collide
        await new Promise(resolve => setTimeout(resolve, 1100));

        const scoped = await flight.fetch('/api/connection/1/token', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: { name: 'Attachment Token', permissions: ['attachment:read'] },
        }, true);

        const list = await flight.fetch('/api/attachment?hash=123', {
            method: 'GET',
            auth: { bearer: scoped.body.token },
        }, true);

        assert.deepEqual(list.body, { total: 0, items: [] });
    } catch (err) {
        assert.ifError(err);
    }

    Sinon.restore();
});

flight.landing();
