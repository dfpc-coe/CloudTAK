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

test(`Worker DataPackage Import: Iconset`, async (t) => {
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
        path: '/api/iconset/6d180afb-89a6-4c07-b2b3-a89748b6a38f',
        method: 'GET'
    }).reply(() => {
        return {
            statusCode: 404,
            data: JSON.stringify({})
        };
    });

    mockPool.intercept({
        path: '/api/iconset',
        method: 'POST'
    }).reply((req) => {
        assert.deepEqual(JSON.parse(req.body), {
            uid: '6d180afb-89a6-4c07-b2b3-a89748b6a38f',
            version: 2,
            name: 'FalconView',
            skip_resize: false
        });

        return {
            statusCode: 200,
            data: JSON.stringify({})
        };
    });

    mockPool.intercept({
        path: /\/api\/iconset\//,
        method: 'POST'
    }).reply((req) => {
        const body = JSON.parse(req.body);

        assert.ok(body.name && body.name.endsWith('.png'));
        assert.ok(body.path && body.path.endsWith('.png'));
        assert.ok(body.data);

        return {
            statusCode: 200,
            data: JSON.stringify({})
        };
    }).persist();

    const ExternalOperations = [
            (command) => {
                assert.ok(command instanceof GetObjectCommand);
                assert.deepEqual(command.input, {
                    Bucket: 'test-bucket',
                    Key: `import/ba58a298-a3fe-46b4-a29a-9dd33fbb2139.zip`
                });

                return Promise.resolve({
                    Body: fs.createReadStream(new URL(`./fixtures/package/Iconset-FalconView.zip`, import.meta.url))
                })
            },
    ].reverse();

    const logStub = Sinon.stub(console, 'log');
    logStub.callThrough();
    logStub.withArgs(Sinon.match(/is not a Basemap/)).returns();

    const warnStub = Sinon.stub(console, 'warn');
    warnStub.callThrough();
    warnStub.withArgs(Sinon.match(/must have required property 'customMapSource'/)).returns();

    Sinon.stub(S3Client.prototype, 'send').callsFake((command) => {
        return ExternalOperations.pop()(command);
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

    await worker.process()
});
