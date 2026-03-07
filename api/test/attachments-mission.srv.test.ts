process.env.SigningSecret = 'coe-wildland-fire';
import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import Sinon from 'sinon';
import {
    S3Client
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import S3 from '../lib/aws/s3.js';
import { DataPackage } from '@tak-ps/node-cot';
import stream2buffer from '../lib/stream.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

test('PUT: api/attachment?mission= - uploads to S3 and attaches to mission', async () => {
    const missionGuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const fakeHash = 'hash-mission-123';
    const takServerHash = 'tak-server-hash-456';

    let filesUploadCalled = false;
    let attachContentsCalled = false;

    const s3PutStub = Sinon.stub(S3, 'put').resolves();
    const hashStub = Sinon.stub(DataPackage, 'hash').resolves(fakeHash);

    const s3ListStub = Sinon.stub(S3, 'list').resolves([{
        Key: `attachment/${fakeHash}/image.png`,
        Size: 12,
        LastModified: new Date(),
        ETag: '"abc"'
    }]);

    const s3GetStub = Sinon.stub(S3, 'get').resolves(Readable.from(['file-content']));

    flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) return false;

        if (request.method === 'POST' && request.url.startsWith('/Marti/sync/upload')) {
            filesUploadCalled = true;

            const url = new URL(request.url, 'https://localhost');
            assert.equal(url.searchParams.get('name'), 'image.png');

            await stream2buffer(request);

            response.setHeader('Content-Type', 'text/plain');
            response.write(JSON.stringify({
                UID: 'uid-123',
                SubmissionDateTime: new Date().toISOString(),
                Keywords: [],
                MIMEType: 'image/png',
                SubmissionUser: 'admin',
                PrimaryKey: '1',
                Hash: takServerHash,
                CreatorUid: 'admin',
                Name: 'image.png'
            }));
            response.end();
            return true;
        }

        if (request.method === 'PUT' && request.url.startsWith(`/Marti/api/missions/guid/${encodeURIComponent(missionGuid)}/contents`)) {
            attachContentsCalled = true;

            const body = JSON.parse(String(await stream2buffer(request)));
            assert.deepEqual(body.hashes, [takServerHash]);

            response.setHeader('Content-Type', 'application/json');
            response.write(JSON.stringify({
                version: '3',
                type: 'Mission',
                data: {}
            }));
            response.end();
            return true;
        }

        return false;
    });

    try {
        const body = new FormData();
        body.append('file', new Blob(['file-content'], {
            type: 'image/png'
        }), 'image.png');

        const res = await flight.fetch(`/api/attachment?mission=${missionGuid}`, {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin
            },
            body
        }, true);

        assert.deepEqual(res.body, { hash: fakeHash });

        assert.ok(s3PutStub.calledOnce, 'S3 put should be called once');
        assert.equal(s3PutStub.firstCall.args[0], `attachment/${fakeHash}/image.png`);

        assert.ok(s3ListStub.calledOnce, 'S3 list should be called to find the uploaded file');
        assert.ok(s3GetStub.calledOnce, 'S3 get should be called to stream the file to TAK server');

        assert.ok(filesUploadCalled, 'TAK Server Files.upload should be called');
        assert.ok(attachContentsCalled, 'TAK Server Mission.attachContents should be called');
    } catch (err) {
        assert.ifError(err);
    }

    Sinon.restore();
    flight.tak.reset();
});

test('PUT: api/attachment (no mission param) - does NOT call TAK server', async () => {
    const fakeHash = 'hash-no-mission-789';

    const s3PutStub = Sinon.stub(S3, 'put').resolves();
    const hashStub = Sinon.stub(DataPackage, 'hash').resolves(fakeHash);

    try {
        const body = new FormData();
        body.append('file', new Blob(['file-content'], {
            type: 'text/plain'
        }), 'test.txt');

        const res = await flight.fetch('/api/attachment', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin
            },
            body
        }, true);

        assert.deepEqual(res.body, { hash: fakeHash });

        assert.ok(s3PutStub.calledOnce, 'S3 put should be called once');
        assert.equal(s3PutStub.firstCall.args[0], `attachment/${fakeHash}/test.txt`);
    } catch (err) {
        assert.ifError(err);
    }

    Sinon.restore();
    flight.tak.reset();
});

test('PUT: api/attachment?mission= - fails gracefully if S3 file not found', async () => {
    const missionGuid = 'fail-guid-1111-2222-333333333333';
    const fakeHash = 'hash-missing-file';

    const s3PutStub = Sinon.stub(S3, 'put').resolves();
    const hashStub = Sinon.stub(DataPackage, 'hash').resolves(fakeHash);

    const s3ListStub = Sinon.stub(S3, 'list').resolves([]);

    try {
        const body = new FormData();
        body.append('file', new Blob(['file-content'], {
            type: 'image/png'
        }), 'missing.png');

        const res = await flight.fetch(`/api/attachment?mission=${missionGuid}`, {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin
            },
            body
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Could not find uploaded attachment');
    } catch (err) {
        assert.ifError(err);
    }

    Sinon.restore();
    flight.tak.reset();
});

test('PUT: api/attachment?mission= - fails gracefully if mission not in user overlays', async () => {
    const missionGuid = 'no-overlay-1111-2222-333333333333';
    const fakeHash = 'hash-no-overlay';
    const takServerHash = 'tak-hash-no-overlay';

    const s3PutStub = Sinon.stub(S3, 'put').resolves();
    const hashStub = Sinon.stub(DataPackage, 'hash').resolves(fakeHash);

    const s3ListStub = Sinon.stub(S3, 'list').resolves([{
        Key: `attachment/${fakeHash}/photo.jpg`,
        Size: 50,
        LastModified: new Date(),
        ETag: '"def"'
    }]);

    const s3GetStub = Sinon.stub(S3, 'get').resolves(Readable.from(['photo-data']));

    flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) return false;

        if (request.method === 'POST' && request.url.startsWith('/Marti/sync/upload')) {
            await stream2buffer(request);

            response.setHeader('Content-Type', 'text/plain');
            response.write(JSON.stringify({
                UID: 'uid-no-overlay',
                SubmissionDateTime: new Date().toISOString(),
                Keywords: [],
                MIMEType: 'image/jpeg',
                SubmissionUser: 'admin',
                PrimaryKey: '1',
                Hash: takServerHash,
                CreatorUid: 'admin',
                Name: 'photo.jpg'
            }));
            response.end();
            return true;
        }

        if (request.method === 'PUT' && request.url.startsWith(`/Marti/api/missions/guid/${encodeURIComponent(missionGuid)}/contents`)) {
            await stream2buffer(request);

            assert.equal(request.headers['missionauthorization'], undefined);

            response.statusCode = 403;
            response.setHeader('Content-Type', 'application/json');
            response.write(JSON.stringify({
                status: 403,
                message: 'Forbidden'
            }));
            response.end();
            return true;
        }

        return false;
    });

    try {
        const body = new FormData();
        body.append('file', new Blob(['photo-data'], {
            type: 'image/jpeg'
        }), 'photo.jpg');

        const res = await flight.fetch(`/api/attachment?mission=${missionGuid}`, {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin
            },
            body
        }, false);

        assert.ok(!res.ok, 'Request should not succeed without mission overlay');
    } catch (err) {
        assert.ifError(err);
    }

    Sinon.restore();
    flight.tak.reset();
});

test('PUT: api/attachment?mission= - unauthenticated request fails', async () => {
    const missionGuid = 'unauth-guid';

    try {
        const body = new FormData();
        body.append('file', new Blob(['data']), 'file.txt');

        const res = await flight.fetch(`/api/attachment?mission=${missionGuid}`, {
            method: 'PUT',
            body
        }, false);

        assert.equal(res.status, 401);
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
