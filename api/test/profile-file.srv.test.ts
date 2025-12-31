import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import Sinon from 'sinon';
import {
    S3Client,
    HeadObjectCommand
} from '@aws-sdk/client-s3';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('GET: api/profile/asset', async () => {
    try {
        const res = await flight.fetch('/api/profile/asset', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.deepEqual(res.body, {
             total: 0,
             tiles: {
                 url: 'http://localhost:5001/tiles/profile/admin@example.com/'
             },
             items: [],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/profile/asset', async () => {
    try {
        Sinon.stub(S3Client.prototype, 'send').callsFake((command) => {

            assert.ok(command instanceof HeadObjectCommand);

            assert.deepEqual(command.input, {
                Bucket: 'fake-asset-bucket',
                Key: 'profile/admin@example.com/9e286ca6-1932-4365-804b-7dd4830f01d7.zip'
            });

            return Promise.resolve({
                ContentLength: 123
            });
        });

        const res = await flight.fetch('/api/profile/asset', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                id: '9e286ca6-1932-4365-804b-7dd4830f01d7',
                name: 'example.zip',
                path: '/',
                artifacts: []
            }
        }, true);

        assert.ok(res.body.created, 'has created');
        res.body.created = '2025-09-12T00:12:46.016Z';
        assert.ok(res.body.updated, 'has updated');
        res.body.updated = '2025-09-12T00:12:46.016Z';

        assert.deepEqual(res.body, {
            id: '9e286ca6-1932-4365-804b-7dd4830f01d7',
            created: '2025-09-12T00:12:46.016Z',
            updated: '2025-09-12T00:12:46.016Z',
            username: 'admin@example.com',
            path: '/',
            name: 'example.zip',
            iconset: null,
            size: 123,
            artifacts: []
        });

        Sinon.restore();
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/profile/asset/9e286ca6-1932-4365-804b-7dd4830f01d7', async () => {
    try {
        Sinon.stub(S3Client.prototype, 'send').callsFake((command) => {

            assert.ok(command instanceof HeadObjectCommand);

            assert.deepEqual(command.input, {
                Bucket: 'fake-asset-bucket',
                Key: 'profile/admin@example.com/9e286ca6-1932-4365-804b-7dd4830f01d7.zip'
            });

            return Promise.resolve({
                ContentLength: 123
            });
        });

        const res = await flight.fetch('/api/profile/asset/9e286ca6-1932-4365-804b-7dd4830f01d7', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
            }
        }, true);

        assert.ok(res.body.created, 'has created');
        res.body.created = '2025-09-12T00:12:46.016Z';
        assert.ok(res.body.updated, 'has updated');
        res.body.updated = '2025-09-12T00:12:46.016Z';

        assert.deepEqual(res.body, {
            id: '9e286ca6-1932-4365-804b-7dd4830f01d7',
            created: '2025-09-12T00:12:46.016Z',
            updated: '2025-09-12T00:12:46.016Z',
            username: 'admin@example.com',
            path: '/',
            name: 'example.zip',
            iconset: null,
            size: 123,
            artifacts: []
        });

        Sinon.restore();
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
