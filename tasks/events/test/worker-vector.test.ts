import test from 'tape';
import path from 'node:path';
import Worker from '../src/worker.js';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import Sinon from 'sinon';
import {
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
} from '@aws-sdk/client-s3';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

for (const fixturename of await fsp.readdir(new URL('./fixtures/transform-vector/', import.meta.url))) {
    const { ext } = path.parse(fixturename);

    test(`Worker Data Transform Vector: ${fixturename}`, async (t) => {
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
            path: /api\/profile\/asset\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
            method: 'PATCH'
        }).reply((req) => {
            const body = JSON.parse(req.body) as {
                artifacts: string[]
            };

            t.deepEquals(body.artifacts, [{ "ext": ".geojsonld" }]);

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
                artifacts: string[]
            };

            t.deepEquals(body.artifacts, [{ "ext": ".geojsonld" }, { "ext": ".pmtiles" }]);

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
                    t.ok(command instanceof GetObjectCommand);
                    t.deepEquals(command.input, {
                        Bucket: 'test-bucket',
                        Key: `import/ba58a298-a3fe-46b4-a29a-9dd33fbb2139${ext}`
                    });

                    return Promise.resolve({
                        Body: fs.createReadStream(new URL(`./fixtures/transform-vector/${fixturename}`, import.meta.url))
                    })
                },
                (command) => {
                    t.ok(command instanceof PutObjectCommand);

                    t.equals(command.input.Bucket, 'test-bucket')
                    t.ok(command.input.Key.startsWith(`profile/admin@example.com/`))

                    t.ok(command.input.Key.endsWith(ext))

                    return Promise.resolve({});
                },
                (command) => {
                    t.ok(command instanceof PutObjectCommand);

                    t.equals(command.input.Bucket, 'test-bucket')
                    t.equals(command.input.Key, `profile/admin@example.com/${id}.geojsonld`);

                    return Promise.resolve({});
                },
                (command) => {
                    t.ok(command instanceof PutObjectCommand);

                    t.equals(command.input.Bucket, 'test-bucket')
                    t.equals(command.input.Key, `profile/admin@example.com/${id}.pmtiles`);

                    return Promise.resolve({});
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
                name: `import${ext}`,
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
}
