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
    CompleteMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

test('Worker Data Transform: Non-GeoPDF should throw geospatial error', async (t) => {
    const mockAgent = new MockAgent();
    const originalDispatcher = getGlobalDispatcher();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
    const mockPool = mockAgent.get('http://localhost:5001');

    t.after(() => {
        Sinon.restore();
        setGlobalDispatcher(originalDispatcher);
        mockAgent.close();
    });

    mockPool.intercept({
        path: /api\/profile\/asset/,
        method: 'POST',
    }).reply((req) => {
        const body = JSON.parse(req.body) as {
            id: string;
        };

        return {
            statusCode: 200,
            data: JSON.stringify({
                id: body.id,
                artifacts: [],
            }),
        };
    });

    const ExternalOperations = [
        (command) => {
            assert.ok(command instanceof GetObjectCommand);
            assert.deepEqual(command.input, {
                Bucket: 'test-bucket',
                Key: 'import/ba58a298-a3fe-46b4-a29a-9dd33fbb2139.pdf',
            });

            return Promise.resolve({
                Body: fs.createReadStream(new URL('./fixtures/non-geopdf.pdf', import.meta.url)),
            });
        },
        (command) => {
            if (command instanceof CreateMultipartUploadCommand) {
                assert.equal(command.input.Bucket, 'test-bucket');
                assert.ok(command.input.Key.startsWith('profile/admin@example.com/'));
                assert.ok(command.input.Key.endsWith('.pdf'));
                return Promise.resolve({ UploadId: '123' });
            }

            assert.ok(command instanceof PutObjectCommand);
            assert.equal(command.input.Bucket, 'test-bucket');
            assert.ok(command.input.Key.startsWith('profile/admin@example.com/'));
            assert.ok(command.input.Key.endsWith('.pdf'));

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
            name: 'import.pdf',
            username: 'admin@example.com',
            source: 'Upload',
            config: {},
            source_id: null,
        },
    });

    let errorCaught = false;
    let errorMessage = '';

    worker.on('error', (err) => {
        errorCaught = true;
        errorMessage = err.message;
    });

    worker.on('success', () => {
        assert.fail('Expected error but got success');
    });

    await worker.process();

    assert.ok(errorCaught, 'Expected an error to be thrown');
    assert.ok(
        errorMessage.includes('does not contain geospatial information'),
        `Expected geospatial error message but got: ${errorMessage}`,
    );
    assert.ok(
        errorMessage.includes('GeoPDF'),
        `Expected error to mention GeoPDF but got: ${errorMessage}`,
    );
});
