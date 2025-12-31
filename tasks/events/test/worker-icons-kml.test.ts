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

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

test(`Worker Import: KML-Samples.kml`, async (t) => {
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
    const googlePool = mockAgent.get('http://maps.google.com');

    googlePool.intercept({
        path: /mapfiles\/kml\/pal4\/icon28.png/,
        method: 'GET'
    }).reply(200, png);

    googlePool.intercept({
        path: /mapfiles\/kml\/pal3\/icon19.png/,
        method: 'GET'
    }).reply(200, png);

    mockPool.intercept({
        path: /profile\/asset/,
        method: 'POST'
    }).reply((req) => {
        const body = JSON.parse(req.body) as {
            id: string,
            name: string
        };

        assert.equal(body.name, 'KML-Samples.kml', 'Name should be KML-Samples.kml');

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
        method: 'PATCH',
        body: (str) => !!JSON.parse(str).iconset
    }).reply((req) => {
        const body = JSON.parse(req.body) as {
            iconset: string
        };

        assert.ok(body.iconset);

        return {
            statusCode: 200,
            data: JSON.stringify({
                id: id,
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

        assert.deepEqual(body, {
            artifacts: [ { ext: '.geojsonld' } ]
        });

        return {
            statusCode: 200,
            data: JSON.stringify({
                id: id,
                artifacts: [{
                    ext: '.geojsonld'
                }]
            })
        };
    });

    mockPool.intercept({
        path: /iconset$/,
        method: 'POST'
    }).reply((req) => {
        const body = JSON.parse(req.body) as {
            name: string;
            uid: string;
        };
        assert.equal(body.name, 'KML-Samples.kml Icons');
        return {
            statusCode: 200,
            data: JSON.stringify({ uid: body.uid })
        }
    });

    for (let i = 0; i < 2; i++) {
        mockPool.intercept({
            path: /iconset\/.*\/icon/,
            method: 'POST',
            query: { regen: 'false' }
        }).reply(200, {});
    }

    mockPool.intercept({
        path: /iconset\/.*\/regen/,
        method: 'POST'
    }).reply(200, {});

    mockPool.intercept({
        path: /profile\/asset\//,
        method: 'PATCH'
    }).reply((req) => {
        const body = JSON.parse(req.body) as {
            artifacts: Array<{ ext: string }>
        };

        assert.deepEqual(body, {
            artifacts: [ { ext: '.geojsonld' }, { ext: '.pmtiles' } ]
        });

        return {
            statusCode: 200,
            data: JSON.stringify({
                id: id,
                artifacts: [{
                    ext: '.geojsonld'
                }, {
                    ext: '.pmtiles'
                }]
            })
        };
    });

    const ExternalOperations = [
            (command) => {
                assert.ok(command instanceof GetObjectCommand);
                assert.deepEqual(command.input, {
                    Bucket: 'test-bucket',
                    Key: `import/ba58a298-a3fe-46b4-a29a-9dd33fbb2139.kml`
                });

                return Promise.resolve({
                    Body: fs.createReadStream(new URL(`./fixtures/KML-Samples.kml`, import.meta.url))
                })
            },
            (command) => {
                if (command instanceof CreateMultipartUploadCommand) {
                    assert.equal(command.input.Bucket, 'test-bucket');
                    assert.ok(command.input.Key.startsWith(`profile/admin@example.com/`))
                    assert.ok(command.input.Key.endsWith('.kml'))
                    return Promise.resolve({ UploadId: '123' });
                }
                assert.ok(command instanceof PutObjectCommand);
                assert.equal(command.input.Bucket, 'test-bucket');
                assert.ok(command.input.Key.startsWith(`profile/admin@example.com/`))
                assert.ok(command.input.Key.endsWith('.kml'))

                return Promise.resolve({ ETag: '"123"' })
            },
            (command) => {
                if (command instanceof CreateMultipartUploadCommand) {
                    assert.equal(command.input.Bucket, 'test-bucket');
                    assert.ok(command.input.Key.startsWith(`profile/admin@example.com/`))
                    assert.ok(command.input.Key.endsWith('.geojsonld'))
                    return Promise.resolve({ UploadId: '123' });
                }
                assert.ok(command instanceof PutObjectCommand);
                assert.equal(command.input.Bucket, 'test-bucket');
                assert.ok(command.input.Key.startsWith(`profile/admin@example.com/`))
                assert.ok(command.input.Key.endsWith('.geojsonld'))

                return Promise.resolve({ ETag: '"123"' })
            },
            (command) => {
                if (command instanceof CreateMultipartUploadCommand) {
                    assert.equal(command.input.Bucket, 'test-bucket');
                    assert.ok(command.input.Key.startsWith(`profile/admin@example.com/`))
                    assert.ok(command.input.Key.endsWith('.pmtiles'))
                    return Promise.resolve({ UploadId: '123' });
                }
                assert.ok(command instanceof PutObjectCommand);
                assert.equal(command.input.Bucket, 'test-bucket');
                assert.ok(command.input.Key.startsWith(`profile/admin@example.com/`))
                assert.ok(command.input.Key.endsWith('.pmtiles'))

                return Promise.resolve({ ETag: '"123"' })
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
            name: `KML-Samples.kml`,
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
