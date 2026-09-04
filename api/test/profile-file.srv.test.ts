import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import Sinon from 'sinon';
import { Readable } from 'node:stream';
import { ProfileFileChannel } from '../common/schema.js';
import {
    S3Client,
    HeadObjectCommand,
    GetObjectCommand,
    ListObjectsV2Command,
    DeleteObjectsCommand,
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
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            total: 0,
            tiles: {
                url: `${flight.base}/tiles/profile/admin@example.com/`,
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
                Key: 'profile/admin@example.com/9e286ca6-1932-4365-804b-7dd4830f01d7.zip',
            });

            return Promise.resolve({
                ContentLength: 123,
            });
        });

        const res = await flight.fetch('/api/profile/asset', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                id: '9e286ca6-1932-4365-804b-7dd4830f01d7',
                name: 'example.zip',
                path: '/',
                artifacts: [],
            },
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
            artifacts: [],
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
                Key: 'profile/admin@example.com/9e286ca6-1932-4365-804b-7dd4830f01d7.zip',
            });

            return Promise.resolve({
                ContentLength: 123,
            });
        });

        const res = await flight.fetch('/api/profile/asset/9e286ca6-1932-4365-804b-7dd4830f01d7', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                channels: [42, 7],
            },
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
            artifacts: [],
        });
    } catch (err) {
        assert.ifError(err);
    } finally {
        Sinon.restore();
    }
});

test('DELETE: api/profile/asset/9e286ca6-1932-4365-804b-7dd4830f01d7 cascades channel rows', async () => {
    try {
        Sinon.stub(S3Client.prototype, 'send').callsFake((command) => {
            if (command instanceof ListObjectsV2Command) {
                return Promise.resolve({
                    Contents: [],
                });
            } else if (command instanceof DeleteObjectsCommand) {
                return Promise.resolve({});
            }

            throw new Error(`Unknown S3 Command: ${command.constructor.name}`);
        });

        const res = await flight.fetch('/api/profile/asset/9e286ca6-1932-4365-804b-7dd4830f01d7', {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            status: 200,
            message: 'Asset Deleted',
        });

        const rows = await flight.config?.pg.select().from(ProfileFileChannel);
        assert.deepEqual(rows, []);
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
                        bitpos: 42,
                    }],
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
                key: 'shared-key',
            },
        });

        await flight.config?.models.ProfileFile.generate({
            id: '1db1f443-23e2-44b1-b879-fab2db95ce66',
            username: 'shared@example.com',
            path: '/Shared',
            name: 'shared.zip',
            iconset: null,
            size: 456,
            artifacts: [],
        });

        await flight.config?.pg.insert(ProfileFileChannel).values({
            file: '1db1f443-23e2-44b1-b879-fab2db95ce66',
            channel: 42n,
        });

        const res = await flight.fetch('/api/profile/asset', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.total, 1);
        assert.equal(res.body.tiles.url, `${flight.base}/tiles/profile/admin@example.com/`);

        const shared = res.body.items.find((item: { id: string }) => item.id === '1db1f443-23e2-44b1-b879-fab2db95ce66');
        assert.ok(shared);
        assert.equal(shared.username, 'shared@example.com');
        assert.deepEqual(shared.channels, [42]);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/profile/asset/:asset.:ext - channel shared file is downloadable', async () => {
    try {
        Sinon.stub(S3Client.prototype, 'send').callsFake((command) => {
            assert.ok(command instanceof GetObjectCommand);

            assert.deepEqual(command.input, {
                Bucket: 'fake-asset-bucket',
                Key: 'profile/shared@example.com/1db1f443-23e2-44b1-b879-fab2db95ce66.zip',
            });

            return Promise.resolve({
                Body: Readable.from(['shared-body']),
            });
        });

        const res = await flight.fetch('/api/profile/asset/1db1f443-23e2-44b1-b879-fab2db95ce66.zip', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, {
            json: false,
        });

        assert.equal(res.status, 200);
        assert.equal(res.body, 'shared-body');
    } catch (err) {
        assert.ifError(err);
    } finally {
        Sinon.restore();
    }
});

test('GET: api/profile/asset/:asset.:ext - unshared file from another user is forbidden', async () => {
    try {
        await flight.config?.models.Profile.generate({
            username: 'private@example.com',
            system_admin: false,
            auth: {
                cert: 'private-cert',
                key: 'private-key',
            },
        });

        await flight.config?.models.ProfileFile.generate({
            id: '7c1c2a3e-5d6f-4a7b-8c9d-0e1f2a3b4c5d',
            username: 'private@example.com',
            path: '/',
            name: 'private.zip',
            iconset: null,
            size: 12,
            artifacts: [],
        });

        const s3 = Sinon.stub(S3Client.prototype, 'send');

        const res = await flight.fetch('/api/profile/asset/7c1c2a3e-5d6f-4a7b-8c9d-0e1f2a3b4c5d.zip', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, false);

        assert.equal(res.status, 403);
        assert.equal(res.body.message, 'You do not have permission to view this asset');
        assert.equal(s3.callCount, 0);
    } catch (err) {
        assert.ifError(err);
    } finally {
        Sinon.restore();
    }
});

flight.landing();
