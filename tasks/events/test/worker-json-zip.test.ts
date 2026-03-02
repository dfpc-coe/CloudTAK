import test from 'node:test';
import assert from 'node:assert';
import Worker from '../src/worker.js';
import fs from 'node:fs';
import Sinon from 'sinon';
import {
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
    CreateMultipartUploadCommand,
    UploadPartCommand,
    CompleteMultipartUploadCommand
} from '@aws-sdk/client-s3';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

test(`Worker Data Transform Vector: JSON File within ZIP`, async (t) => {
    let id: string;

    const mockAgent = new MockAgent();
    const originalDispatcher = getGlobalDispatcher();

    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);

    t.after(() => {
        Sinon.restore();
        setGlobalDispatcher(originalDispatcher);
        mockAgent.close();
    });

    const mockPool = mockAgent.get('http://localhost:5001');

    mockPool.intercept({
        path: /profile\/asset/,
        method: 'POST'
    }).reply((req) => {
        const body = JSON.parse(req.body) as {
            id: string;
            name: string;
        };

        id = body.id;

        assert.ok(id, 'Asset id is set');
        assert.ok(body.name.toLowerCase().endsWith('.json'), 'Asset name has .json extension');

        return {
            statusCode: 200,
            data: JSON.stringify({
                id: body.id,
                artifacts: []
            })
        };
    });

    mockPool.intercept({
        path: /api\/profile\/asset\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        method: 'PATCH'
    }).reply((req) => {
        const body = JSON.parse(req.body) as {
            artifacts: Array<{ ext: string }>;
        };

        assert.deepEqual(body.artifacts, [{ ext: '.geojsonld' }], 'Has Correct Extension');

        return {
            statusCode: 200,
            data: JSON.stringify({
                id,
                artifacts: body.artifacts
            })
        };
    });

    mockPool.intercept({
        path: /api\/profile\/asset\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        method: 'PATCH'
    }).reply((req) => {
        const body = JSON.parse(req.body) as {
            artifacts: Array<{ ext: string }>;
        };

        assert.deepEqual(body.artifacts, [{ ext: '.geojsonld' }, { ext: '.pmtiles' }]);

        return {
            statusCode: 200,
            data: JSON.stringify({
                id,
                artifacts: body.artifacts
            })
        };
    });

    const ExternalOperations = [
        (command) => {
            assert.ok(command instanceof GetObjectCommand, 'S3.GetObjectCommand Call');
            assert.deepEqual(command.input, {
                Bucket: 'test-bucket',
                Key: `import/ba58a298-a3fe-46b4-a29a-9dd33fbb2139.zip`
            }, 'S3.GetObjectCommand Call Parameters');

            return Promise.resolve({
                Body: fs.createReadStream(new URL(`./fixtures/transform-vector/NewZealandRegions.zip`, import.meta.url))
            });
        },
        (command) => {
            if (command instanceof CreateMultipartUploadCommand) {
                assert.equal(command.input.Bucket, 'test-bucket', 'S3.CreateMultipartUploadCommand Bucket');
                assert.ok(command.input.Key.startsWith(`profile/admin@example.com/`), 'S3.CreateMultipartUploadCommand Key Prefix');
                assert.ok(command.input.Key.endsWith('.json'), 'S3.CreateMultipartUploadCommand Key Suffix');
                return Promise.resolve({ UploadId: '123' });
            }

            assert.ok(command instanceof PutObjectCommand, 'S3.PutObjectCommand Call');
            assert.equal(command.input.Bucket, 'test-bucket', 'S3.PutObjectCommand Bucket');
            assert.ok(command.input.Key.startsWith(`profile/admin@example.com/`), 'S3.PutObjectCommand Key Prefix');
            assert.ok(command.input.Key.endsWith('.json'), 'S3.PutObjectCommand Key Suffix');

            return Promise.resolve({});
        },
        (command) => {
            if (command instanceof CreateMultipartUploadCommand) {
                assert.equal(command.input.Bucket, 'test-bucket', 'S3.CreateMultipartUploadCommand Bucket');
                assert.ok(command.input.Key.startsWith(`profile/admin@example.com/`), 'S3.CreateMultipartUploadCommand Key Prefix');
                assert.ok(command.input.Key.endsWith('.geojsonld'), 'S3.CreateMultipartUploadCommand Key Suffix');
                return Promise.resolve({ UploadId: '123' });
            }

            assert.ok(command instanceof PutObjectCommand, 'S3.PutObjectCommand Call');
            assert.equal(command.input.Bucket, 'test-bucket', 'S3.PutObjectCommand Bucket');
            assert.ok(command.input.Key.startsWith(`profile/admin@example.com/`), 'S3.PutObjectCommand Key Prefix');
            assert.ok(command.input.Key.endsWith('.geojsonld'), 'S3.PutObjectCommand Key Suffix');

            return Promise.resolve({ ETag: '"123"' });
        },
        (command) => {
            if (command instanceof CreateMultipartUploadCommand) {
                assert.equal(command.input.Bucket, 'test-bucket', 'S3.CreateMultipartUploadCommand Bucket');
                assert.ok(command.input.Key.startsWith(`profile/admin@example.com/`), 'S3.CreateMultipartUploadCommand Key Prefix');
                assert.ok(command.input.Key.endsWith('.pmtiles'), 'S3.CreateMultipartUploadCommand Key Suffix');
                return Promise.resolve({ UploadId: '123' });
            }

            assert.ok(command instanceof PutObjectCommand, 'S3.PutObjectCommand Call');
            assert.equal(command.input.Bucket, 'test-bucket', 'S3.PutObjectCommand Bucket');
            assert.ok(command.input.Key.startsWith(`profile/admin@example.com/`), 'S3.PutObjectCommand Key Prefix');
            assert.ok(command.input.Key.endsWith('.pmtiles'), 'S3.PutObjectCommand Key Suffix');

            return Promise.resolve({ ETag: '"123"' });
        },
    ].reverse();

    Sinon.stub(S3Client.prototype, 'send').callsFake(async (command) => {
        if (command instanceof UploadPartCommand) {
            return { ETag: '"123"' };
        }
        if (command instanceof CompleteMultipartUploadCommand) {
            return { Location: '...' };
        }

        const validator = ExternalOperations.pop();
        if (!validator) throw new Error(`Unexpected command: ${command.constructor.name}`);

        return validator(command);
    });

    const worker = new Worker({
        api: 'http://localhost:5001',
        secret: 'coe-wildland-fire',
        bucket: 'test-bucket',
        job: {
            id: 'ba58a298-a3fe-46b4-a29a-9dd33fbb2139',
            created: '2025-08-25T18:08:21.563Z',
            updated: '2025-08-25T18:08:21.563Z',
            status: 'Running',
            error: null,
            result: {},
            name: `import.zip`,
            username: 'admin@example.com',
            source: 'Upload',
            config: {},
            source_id: null,
        }
    });

    worker.on('error', (err) => {
        assert.ifError(err);
    });

    worker.on('success', () => {
    });

    await worker.process();
});
