import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import Sinon from 'sinon';
import { ProfileFileChannel } from '../lib/schema.js';
import {
    S3Client,
    HeadObjectCommand
} from '@aws-sdk/client-s3';

const flight = new Flight();

flight.init({ takserver: true });
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
            channels: [],
            artifacts: []
        });
    } catch (err) {
        assert.ifError(err);
    } finally {
        Sinon.restore();
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
                channels: [7, 42]
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
            channels: [7, 42],
            artifacts: []
        });
    } catch (err) {
        assert.ifError(err);
    } finally {
        Sinon.restore();
    }
});

test('GET: api/profile/asset includes channel shared files', async () => {
    try {
        flight.tak.mockMarti.unshift(async (request, response) => {
            if (request.method === 'GET' && request.url === '/Marti/api/groups/all?useCache=true') {
                response.setHeader('Content-Type', 'application/json');
                response.write(JSON.stringify({
                    version: '3',
                    type: 'com.bbn.marti.remote.groups.Group',
                    data: [{
                        name: 'Shared Ops',
                        direction: 'IN',
                        active: true,
                        bitpos: 42
                    }]
                }));
                response.end();
                return true;
            }

            return false;
        });

        await flight.config?.models.Profile.generate({
            username: 'shared@example.com',
            system_admin: false,
            auth: {
                cert: 'shared-cert',
                key: 'shared-key'
            }
        });

        await flight.config?.models.ProfileFile.generate({
            id: '1db1f443-23e2-44b1-b879-fab2db95ce66',
            username: 'shared@example.com',
            path: '/Shared',
            name: 'shared.zip',
            iconset: null,
            size: 456,
            artifacts: []
        });

        await flight.config?.pg.insert(ProfileFileChannel).values({
            file: '1db1f443-23e2-44b1-b879-fab2db95ce66',
            channel: 42n
        });

        const res = await flight.fetch('/api/profile/asset', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.equal(res.body.total, 2);
        assert.equal(res.body.tiles.url, 'http://localhost:5001/tiles/profile/admin@example.com/');

        const shared = res.body.items.find((item: { id: string }) => item.id === '1db1f443-23e2-44b1-b879-fab2db95ce66');
        assert.ok(shared);
        assert.equal(shared.username, 'shared@example.com');
        assert.deepEqual(shared.channels, [42]);
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
