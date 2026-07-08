import test from 'node:test';
import assert from 'node:assert';
import Worker from '../src/worker.js';
import fs from 'node:fs';
import Sinon from 'sinon';
import {
    S3Client,
    GetObjectCommand,
} from '@aws-sdk/client-s3';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

test(`Worker DataPackage Import: Corrupt Inner Zip`, async (t) => {
    const mockAgent = new MockAgent();
    const originalDispatcher = getGlobalDispatcher();

    mockAgent.disableNetConnect();

    setGlobalDispatcher(mockAgent);

    t.after(() => {
        Sinon.restore();
        setGlobalDispatcher(originalDispatcher);
        mockAgent.close();
    });

    Sinon.stub(S3Client.prototype, 'send').callsFake(async (command) => {
        assert.ok(command instanceof GetObjectCommand);
        assert.deepEqual(command.input, {
            Bucket: 'test-bucket',
            Key: `import/ba58a298-a3fe-46b4-a29a-9dd33fbb2139.zip`,
        });

        return Promise.resolve({
            Body: fs.createReadStream(new URL(`./fixtures/package/DP-CorruptInnerZip.zip`, import.meta.url)),
        });
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
        },
    });

    let error: Error | undefined = undefined;
    worker.on('error', (err) => {
        error = err;
    });

    worker.on('success', () => {
        assert.fail('Import of a package containing a corrupt zip should not succeed');
    });

    await worker.process();

    assert.ok(error, 'Expected worker to emit an error');
    assert.equal(error.message, `Package content 'corrupt.zip' is not a valid ZIP archive`);
});
