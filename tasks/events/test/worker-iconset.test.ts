import test from 'tape';
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
        t.deepEquals(JSON.parse(req.body), {
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

        t.ok(body.name && body.name.endsWith('.png'));
        t.ok(body.path && body.path.endsWith('.png'));
        t.ok(body.data);

        return {
            statusCode: 200,
            data: JSON.stringify({})
        };
    }).persist();

    const ExternalOperations = [
            (command) => {
                t.ok(command instanceof GetObjectCommand);
                t.deepEquals(command.input, {
                    Bucket: 'test-bucket',
                    Key: `import/ba58a298-a3fe-46b4-a29a-9dd33fbb2139.zip`
                });

                return Promise.resolve({
                    Body: fs.createReadStream(new URL(`./fixtures/package/Iconset-FalconView.zip`, import.meta.url))
                })
            },
    ].reverse();

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
        t.error(err);
    });

    worker.on('success', () => {
        Sinon.restore();
        setGlobalDispatcher(originalDispatcher);
        mockAgent.close();
        t.end()
    });

    await worker.process()
});
