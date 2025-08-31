import test from 'tape';
import Worker from '../src/worker.js';
import fs from 'node:fs';
import Sinon from 'sinon';
import {
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
} from '@aws-sdk/client-s3';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

test(`Worker DataPackage Import: Packaged File`, async (t) => {
    let id: string;

    const mockAgent = new MockAgent();
    const originalDispatcher = getGlobalDispatcher();

    mockAgent.disableNetConnect();

    setGlobalDispatcher(mockAgent);

    const mockPool = mockAgent.get('http://localhost:5001');

    mockPool.intercept({
        path: /profile\/asset/,
        method: 'POST'
    }).reply((req) => {
        const body = JSON.parse(req.body) as {
            id: string
        };

        id = body.id;

        return {
            statusCode: 200,
            data: JSON.stringify({
                id: body.id,
                artifacts: []
            })
        };
    });

    mockPool.intercept({
        path: /profile\/asset\//,
        method: 'PATCH'
    }).reply((req) => {
        const body = JSON.parse(req.body) as {
            artifacts: Array<{ ext: string }>
        };

        t.deepEquals(body, {
            artifacts: [ { ext: '.pmtiles' } ]
        });

        return {
            statusCode: 200,
            data: JSON.stringify({
                id: id,
                artifacts: [{
                    ext: '.pmtiles'
                }]
            })
        };
    });

    const ExternalOperations = [
            (command) => {
                t.ok(command instanceof GetObjectCommand);
                t.deepEquals(command.input, {
                    Bucket: 'test-bucket',
                    Key: `import/ba58a298-a3fe-46b4-a29a-9dd33fbb2139.zip`
                });

                return Promise.resolve({
                    Body: fs.createReadStream(new URL(`./fixtures/package/FilePackaged.zip`, import.meta.url))
                })
            },
            (command) => {
                t.ok(command instanceof PutObjectCommand);
                t.equals(command.input.Bucket, 'test-bucket');
                t.ok(command.input.Key.startsWith(`profile/admin@example.com/`))
                t.ok(command.input.Key.endsWith('.tiff'))

                return Promise.resolve({})
            },
            (command) => {
                t.ok(command instanceof PutObjectCommand);
                t.equals(command.input.Bucket, 'test-bucket');
                t.ok(command.input.Key.startsWith(`profile/admin@example.com/`))
                t.ok(command.input.Key.endsWith('.pmtiles'))

                return Promise.resolve({})
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
